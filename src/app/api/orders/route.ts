import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getPersistentOrders,
  resetPersistentOrders,
  savePersistentOrder,
  getPersistentLoyaltyPoints,
  updatePersistentLoyaltyPoints,
  claimQrisSessionForOrder,
  appendAuditLog,
} from "@/lib/persistent-storage";
import { getRequestAuthUser } from "@/lib/server-auth";
import {
  authorizeSupervisorQrisOverride,
  SHARED_SUPERVISOR_PIN_LABEL,
} from "@/lib/qris-verification";
import {
  filterOrdersByTenant,
  normalizeTenantId,
  resolveNormalizedItemTenantId,
} from "@/features/orders/orders-domain";
import { OrderRecord, OrderStatus, OrderStatusHistoryItem } from "@/types/order";
import { RoleSlug, ScopeLevel } from "@/types/auth";

const ORDER_READ_ROLES: RoleSlug[] = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "CASHIER",
  "WAITER",
  "KITCHEN_STAFF",
];

const ORDER_WRITE_ROLES: RoleSlug[] = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "CASHIER",
];

const SUPERVISOR_ROLES: RoleSlug[] = ["SUPER_ADMIN", "OWNER", "MANAGER"];
const LOYALTY_READ_ROLES: RoleSlug[] = ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"];

const QRIS_CLAIM_MESSAGES = {
  NOT_FOUND: "Sesi QRIS untuk invoice ini tidak ditemukan di server.",
  UNVERIFIED: "Pembayaran QRIS belum terverifikasi webhook atau supervisor.",
  AMOUNT_MISMATCH: "Nominal pembayaran QRIS tidak sama dengan total transaksi.",
  ALREADY_CONSUMED: "Pembayaran QRIS ini sudah dipakai untuk transaksi lain.",
} as const;

const STATUS_ONLY_ROLES: RoleSlug[] = ["KITCHEN_STAFF", "WAITER"];
const ORDER_ACCESS_ROLES: RoleSlug[] = [...ORDER_WRITE_ROLES, ...STATUS_ONLY_ROLES];

// Fields that kitchen/floor workflow may change on an existing order. Everything else is the sale itself.
const WORKFLOW_FIELDS = new Set<string>([
  "status",
  "statusHistory",
  "tenantStatuses",
  "confirmedAt",
  "kitchenReceivedAt",
  "cookingStartedAt",
  "cookingFinishedAt",
  "readyAt",
  "servedAt",
  "completedAt",
  "loyaltyPointsCredited",
]);

const KITCHEN_STAGE_RANK: Record<OrderStatus, number> = {
  NEW: 0,
  CONFIRMED: 1,
  KITCHEN_RECEIVED: 2,
  COOKING: 3,
  READY: 4,
  SERVED: 5,
  COMPLETED: 6,
  CANCELLED: 7,
};

function computeAggregateOrderStatus(
  items: OrderRecord["items"],
  tenantStatuses: Record<string, OrderStatus>,
  fallbackStatus: OrderStatus
): OrderStatus {
  const tenants = Array.from(
    new Set(items.map((it) => resolveNormalizedItemTenantId(it)))
  );
  if (tenants.length <= 1) {
    return (tenants[0] && tenantStatuses[tenants[0]]) || fallbackStatus;
  }
  let earliest = fallbackStatus;
  let earliestRank = KITCHEN_STAGE_RANK[earliest] ?? 0;
  let initialized = false;
  for (const tid of tenants) {
    const stage = tenantStatuses[tid] ?? fallbackStatus;
    const rank = KITCHEN_STAGE_RANK[stage] ?? 0;
    if (!initialized || rank < earliestRank) {
      earliest = stage;
      earliestRank = rank;
      initialized = true;
    }
  }
  return earliest;
}

function mergeStatusHistory(
  existing: OrderStatusHistoryItem[] = [],
  incoming: OrderStatusHistoryItem[] = []
): OrderStatusHistoryItem[] {
  const seen = new Set(
    existing.map((e) => e.id || `${e.timestamp}:${e.toStatus}`)
  );
  const appended = incoming.filter((e) => {
    const key = e.id || `${e.timestamp}:${e.toStatus}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...existing, ...appended];
}

// Client-side bookkeeping that must never be stored on the server.
const CLIENT_ONLY_FIELDS = ["syncStatus", "syncError"] as const;

function withoutClientFields(order: OrderRecord): OrderRecord {
  const copy: Record<string, unknown> = { ...order };
  for (const field of CLIENT_ONLY_FIELDS) delete copy[field];
  return copy as unknown as OrderRecord;
}

function historyOnlyAppends(previous: OrderRecord, next: OrderRecord): boolean {
  const before = previous.statusHistory ?? [];
  const after = next.statusHistory ?? [];
  return (
    after.length >= before.length &&
    before.every((entry, index) => JSON.stringify(entry) === JSON.stringify(after[index]))
  );
}

function canonicalSale(order: OrderRecord): string {
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.keys(value as Record<string, unknown>)
          .sort()
          .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])])
      );
    }
    return value;
  };
  const sale = Object.fromEntries(
    Object.entries(order).filter(([key, value]) => !WORKFLOW_FIELDS.has(key) && value !== undefined)
  );
  return JSON.stringify(sortKeys(sale));
}

type OrderWriteDecision =
  | { allowed: true; auditPaidChange: boolean; requiresPinCheck: boolean }
  | { allowed: false; error: string; status?: number };

function mergeTenantWorkflowStageUpdate(
  existingOrder: OrderRecord,
  orderData: OrderRecord,
  scopedTenantId: string
): OrderRecord {
  const nextTenantStage = orderData.tenantStatuses?.[scopedTenantId] || orderData.status;
  const mergedTenantStatuses: Record<string, OrderStatus> = {
    ...(existingOrder.tenantStatuses || {}),
    ...(orderData.tenantStatuses || {}),
    [scopedTenantId]: nextTenantStage,
  };
  return {
    ...existingOrder,
    status: computeAggregateOrderStatus(
      existingOrder.items,
      mergedTenantStatuses,
      existingOrder.status
    ),
    tenantStatuses: mergedTenantStatuses,
    statusHistory: mergeStatusHistory(existingOrder.statusHistory, orderData.statusHistory),
    confirmedAt: existingOrder.confirmedAt || orderData.confirmedAt,
    kitchenReceivedAt: existingOrder.kitchenReceivedAt || orderData.kitchenReceivedAt,
    cookingStartedAt: existingOrder.cookingStartedAt || orderData.cookingStartedAt,
    cookingFinishedAt: existingOrder.cookingFinishedAt || orderData.cookingFinishedAt,
    readyAt: existingOrder.readyAt || orderData.readyAt,
    servedAt: existingOrder.servedAt || orderData.servedAt,
  };
}

function decideOrderWrite(
  role: RoleSlug,
  scopeLevel: ScopeLevel | null,
  existing: OrderRecord | undefined,
  next: OrderRecord,
  hasSupervisorPin: boolean
): OrderWriteDecision {
  const isPosRole = ORDER_WRITE_ROLES.includes(role);
  const isTenantOwner = role === "OWNER" && scopeLevel === "TENANT";
  const isHubSupervisor = SUPERVISOR_ROLES.includes(role) && !isTenantOwner;

  if (!existing) {
    if (isPosRole) return { allowed: true, auditPaidChange: false, requiresPinCheck: false };
    if (role === "WAITER" && next.paymentStatus === "PENDING") {
      return { allowed: true, auditPaidChange: false, requiresPinCheck: false };
    }
    return { allowed: false, error: `FORBIDDEN: Role [${role}] tidak diizinkan membuat transaksi POS ini.` };
  }

  const isClosed = existing.status === "CANCELLED" || existing.paymentStatus === "REFUNDED";
  const workflowOnly =
    !isClosed &&
    next.status !== "CANCELLED" &&
    canonicalSale(existing) === canonicalSale(next) &&
    historyOnlyAppends(existing, next);
  if (workflowOnly) return { allowed: true, auditPaidChange: false, requiresPinCheck: false };

  const isRefundOrVoid =
    !isClosed &&
    (next.status === "CANCELLED" ||
      next.paymentStatus === "REFUNDED" ||
      Boolean(next.voidReason));

  if (isRefundOrVoid) {
    if (isHubSupervisor) {
      return { allowed: true, auditPaidChange: true, requiresPinCheck: false };
    }
    if (role === "CASHIER" || isTenantOwner) {
      if (!hasSupervisorPin) {
        if (existing.paymentStatus === "PAID") {
          return {
            allowed: false,
            error:
              "FORBIDDEN: ORDER_ALREADY_PAID: Pesanan ini sudah berstatus lunas. Pembayaran kedua ditolak. Perubahan data atau pembatalan transaksi yang sudah lunas wajib dilakukan oleh supervisor (Manager/Owner).",
          };
        }
        return {
          allowed: false,
          error:
            "FORBIDDEN: SUPERVISOR_PIN_REQUIRED: Pembatalan (void) pesanan wajib disetujui dengan PIN Supervisor.",
        };
      }
      return { allowed: true, auditPaidChange: true, requiresPinCheck: true };
    }
    return {
      allowed: false,
      error: `FORBIDDEN: Role [${role}] tidak diizinkan membatalkan atau me-refund pesanan.`,
    };
  }

  if (existing.paymentStatus === "PAID") {
    if (!isHubSupervisor) {
      return {
        allowed: false,
        error:
          "FORBIDDEN: ORDER_ALREADY_PAID: Pesanan ini sudah berstatus lunas. Pembayaran kedua ditolak. Perubahan data atau pembatalan transaksi yang sudah lunas wajib dilakukan oleh supervisor (Manager/Owner).",
      };
    }
  }

  if (existing.paymentStatus !== "PAID" && !isClosed) {
    return isPosRole
      ? { allowed: true, auditPaidChange: false, requiresPinCheck: false }
      : { allowed: false, error: `FORBIDDEN: Role [${role}] hanya boleh mengubah status pesanan.` };
  }

  return isHubSupervisor
    ? { allowed: true, auditPaidChange: true, requiresPinCheck: false }
    : {
        allowed: false,
        error:
          "FORBIDDEN: Perubahan data atau pembatalan transaksi yang sudah lunas wajib dilakukan oleh supervisor (Manager/Owner).",
      };
}

const OrderItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().optional(),
  tenantId: z.string().optional(),
  productName: z.string().min(1),
  quantity: z.number().finite().positive(),
  unitPrice: z.number().finite().nonnegative(),
  notes: z.string().optional(),
  modifiers: z.array(z.string()).optional(),
});

const OrderPayloadSchema = z.object({
  id: z.string().min(1),
  orderNumber: z.string().optional(),
  outletId: z.string().optional(),
  subtotal: z.number().finite().nonnegative(),
  discount: z.number().finite().nonnegative().optional(),
  tax: z.number().finite().nonnegative().optional(),
  serviceCharge: z.number().finite().nonnegative().optional(),
  total: z.number().finite().nonnegative(),
  items: z.array(OrderItemSchema).optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "REFUNDED"]).optional(),
  paymentMethod: z.enum(["CASH", "QRIS", "EDC", "TRANSFER", "SPLIT", "INVOICE"]).optional(),
  notes: z.string().optional(),
  status: z
    .enum(["NEW", "CONFIRMED", "KITCHEN_RECEIVED", "COOKING", "READY", "SERVED", "COMPLETED", "CANCELLED"])
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    if (!ORDER_READ_ROLES.includes(auth.role)) {
      return NextResponse.json(
        { error: `FORBIDDEN: Role [${auth.role}] tidak diizinkan mengakses daftar transaksi POS.` },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId");
    const status = searchParams.get("status");
    const customerKey = searchParams.get("customerKey");

    let orders = await getPersistentOrders();
    if (outletId && outletId !== "ALL") {
      orders = orders.filter((o) => o.outletId === outletId);
    }

    const scopedTenantId =
      (auth.scopeLevel === "TENANT" || auth.role === "KITCHEN_STAFF") && auth.tenantId
        ? normalizeTenantId(auth.tenantId)
        : undefined;
    if (scopedTenantId) {
      orders = filterOrdersByTenant(orders, scopedTenantId, true);
    }

    if (status) {
      orders = orders.filter((o) => o.status === status || o.paymentStatus === status);
    }

    let loyaltyPoints = LOYALTY_READ_ROLES.includes(auth.role)
      ? await getPersistentLoyaltyPoints()
      : [];
    if (customerKey) {
      const normalized = customerKey.trim().toLowerCase();
      loyaltyPoints = loyaltyPoints.filter((l) => l.customerKey.toLowerCase() === normalized);
    }

    return NextResponse.json({ orders, loyaltyPoints });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    if (!ORDER_ACCESS_ROLES.includes(auth.role)) {
      return NextResponse.json(
        { error: `FORBIDDEN: Role [${auth.role}] tidak memiliki wewenang menyimpan transaksi POS.` },
        { status: 403 }
      );
    }

    const body = await req.json();
    const supervisorPin = typeof body.supervisorPin === "string" ? body.supervisorPin.trim() : "";
    let orderData: OrderRecord = withoutClientFields(body.order || body);

    if (!orderData || !orderData.id) {
      return NextResponse.json(
        { error: "Order payload with valid id is required." },
        { status: 400 }
      );
    }

    const parsed = OrderPayloadSchema.safeParse({
      id: orderData.id,
      orderNumber: orderData.orderNumber,
      outletId: orderData.outletId,
      subtotal: Number(orderData.subtotal ?? 0),
      discount: orderData.discount !== undefined ? Number(orderData.discount) : undefined,
      tax: orderData.tax !== undefined ? Number(orderData.tax) : undefined,
      serviceCharge:
        orderData.serviceCharge !== undefined ? Number(orderData.serviceCharge) : undefined,
      total: Number(orderData.total ?? 0),
      items: Array.isArray(orderData.items) ? orderData.items : undefined,
      paymentStatus: orderData.paymentStatus,
      paymentMethod: orderData.paymentMethod as any,
      notes: orderData.notes,
      status: orderData.status,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "INVALID_ORDER_PAYLOAD: Struktur data pesanan tidak valid.",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const v = parsed.data;
    if (v.items && v.items.length > 0) {
      const itemsSubtotal = v.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
      );
      if (Math.abs(itemsSubtotal - v.subtotal) > 2) {
        return NextResponse.json(
          {
            error: `INVALID_ORDER_SUBTOTAL: Subtotal (${v.subtotal}) tidak cocok dengan total harga item (${itemsSubtotal}).`,
          },
          { status: 400 }
        );
      }
    }

    const expectedTotal =
      Math.max(0, v.subtotal - (v.discount ?? 0)) + (v.tax ?? 0) + (v.serviceCharge ?? 0);
    if (Math.abs(expectedTotal - v.total) > 2) {
      return NextResponse.json(
        {
          error: `INVALID_ORDER_TOTAL: Total (${v.total}) tidak konsisten dengan kalkulasi komponen (${expectedTotal}).`,
        },
        { status: 400 }
      );
    }

    const existingOrder = (await getPersistentOrders()).find((o) => o.id === orderData.id);
    const scopedTenantId =
      (auth.scopeLevel === "TENANT" || auth.role === "KITCHEN_STAFF") && auth.tenantId
        ? normalizeTenantId(auth.tenantId)
        : undefined;

    if (existingOrder && scopedTenantId) {
      const orderFallback = (existingOrder as { tenantId?: string }).tenantId;
      const existingTenants = Array.from(
        new Set(
          existingOrder.items.map((it) => resolveNormalizedItemTenantId(it, orderFallback))
        )
      );
      if (!existingTenants.includes(scopedTenantId)) {
        return NextResponse.json(
          { error: "FORBIDDEN: Pesanan ini tidak memiliki item untuk tenant Anda." },
          { status: 403 }
        );
      }

      if (existingTenants.length > 1) {
        const requestsReversal =
          orderData.status === "CANCELLED" ||
          orderData.paymentStatus === "REFUNDED" ||
          Boolean(orderData.voidReason);
        if (requestsReversal) {
          return NextResponse.json(
            {
              error:
                "FORBIDDEN: Pembatalan atau refund pesanan multi-mitra harus diproses oleh kasir atau supervisor hub.",
            },
            { status: 403 }
          );
        }

        const clientItemsMatchTenant =
          Array.isArray(orderData.items) &&
          orderData.items.length > 0 &&
          orderData.items.every(
            (it) => resolveNormalizedItemTenantId(it, orderFallback) === scopedTenantId
          );

        if (clientItemsMatchTenant) {
          orderData = mergeTenantWorkflowStageUpdate(existingOrder, orderData, scopedTenantId);
        }
      }
    }

    const decision = decideOrderWrite(
      auth.role,
      auth.scopeLevel,
      existingOrder,
      orderData,
      Boolean(supervisorPin)
    );
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.error }, { status: decision.status || 403 });
    }

    if (decision.requiresPinCheck) {
      const pinCheck = authorizeSupervisorQrisOverride({
        pin: supervisorPin,
        referenceNumber: (orderData.orderNumber || orderData.id || "ORDER").padEnd(4, "0"),
        actorKey: auth.userId || auth.role,
      });
      if (!pinCheck.allowed) {
        const message =
          pinCheck.statusCode === 403
            ? "FORBIDDEN: PIN Supervisor tidak valid. Otorisasi pembatalan atau refund pesanan ditolak."
            : pinCheck.error;
        return NextResponse.json(
          { error: message },
          { status: pinCheck.statusCode || 403 }
        );
      }
      orderData = {
        ...orderData,
        supervisorPinVerified: true,
      };
    }

    const reversesPaidOrder = decision.auditPaidChange;

    // A PAID QRIS order must consume exactly one verified QRIS session, identified by its gateway invoice number.
    const alreadySettledByThisPayment =
      existingOrder?.paymentStatus === "PAID" &&
      existingOrder.paymentMethod === "QRIS" &&
      existingOrder.total === orderData.total &&
      existingOrder.qrisVerification?.invoiceNumber === orderData.qrisVerification?.invoiceNumber;
    if (orderData.paymentMethod === "QRIS" && orderData.paymentStatus === "PAID" && !alreadySettledByThisPayment) {
      const qrisInvoiceNumber = orderData.qrisVerification?.invoiceNumber?.trim();
      const claim = qrisInvoiceNumber
        ? await claimQrisSessionForOrder({
            invoiceNumber: qrisInvoiceNumber,
            orderId: orderData.id,
            amount: v.total,
          })
        : ({ ok: false, reason: "NOT_FOUND" } as const);

      if (!claim.ok) {
        return NextResponse.json(
          {
            error: `QRIS_PAYMENT_UNVERIFIED [${claim.reason}]: ${QRIS_CLAIM_MESSAGES[claim.reason]}`,
          },
          { status: 409 }
        );
      }
    }

    if (reversesPaidOrder) {
      const isRefund = orderData.paymentStatus === "REFUNDED";
      const isVoid = !isRefund && (orderData.status === "CANCELLED" || Boolean(orderData.voidReason));
      const auditAction = isRefund
        ? "REFUND_ORDER"
        : isVoid
        ? "VOID_ORDER"
        : "PAID_ORDER_CHANGED_BY_SUPERVISOR";
      const supervisorLabel = isRefund
        ? orderData.refundApprovedBy || auth.name || SHARED_SUPERVISOR_PIN_LABEL
        : isVoid
        ? orderData.voidApprovedBy || auth.name || SHARED_SUPERVISOR_PIN_LABEL
        : auth.name || auth.email || "Supervisor";
      const auditReason = isRefund
        ? orderData.refundReason || "Refund transaksi pelanggan"
        : isVoid
        ? orderData.voidReason || "Pembatalan (void) pesanan"
        : "Perubahan transaksi lunas oleh supervisor";
      const actorName = auth.name || auth.email || "Supervisor";

      await appendAuditLog({
        id: `audit-order-reversal-${orderData.id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorId: auth.userId || "unknown",
        actorName,
        actorRole: auth.role,
        role: auth.role,
        userId: auth.userId || "unknown",
        userName: actorName,
        userRole: auth.role,
        action: auditAction,
        module: "POS",
        recordId: orderData.orderNumber || orderData.id,
        referenceId: orderData.id,
        outletId: orderData.outletId,
        outletName: orderData.outletName,
        previousValue: `Status: ${existingOrder?.status || "-"}, Payment: ${existingOrder?.paymentStatus || "-"}, Total: Rp ${(existingOrder?.total ?? 0).toLocaleString("id-ID")}`,
        newValue: `Status: ${orderData.status}, Payment: ${orderData.paymentStatus}, Total: Rp ${v.total.toLocaleString("id-ID")}`,
        description: isRefund
          ? `Refund transaksi ${orderData.orderNumber || orderData.id} sebesar Rp ${v.total.toLocaleString("id-ID")}. Disetujui: ${supervisorLabel}`
          : isVoid
          ? `Pembatalan (void) pesanan ${orderData.orderNumber || orderData.id}. Disetujui: ${supervisorLabel}`
          : `Transaksi lunas ${orderData.orderNumber || orderData.id} diubah supervisor: status ${orderData.paymentStatus}/${orderData.status}, total ${existingOrder?.total} -> ${v.total}.`,
        reason: auditReason,
        status: "SUCCESS",
        severity: "HIGH",
        category: "TRANSACTION",
        metadata: {
          previousStatus: existingOrder?.status,
          previousPaymentStatus: existingOrder?.paymentStatus,
          previousTotal: existingOrder?.total,
          total: v.total,
          paymentStatus: orderData.paymentStatus,
          status: orderData.status,
          supervisorApprovedBy: supervisorLabel,
          supervisorPinVerified: Boolean(orderData.supervisorPinVerified),
        },
      });
    }

    // Loyalty is earned once, when an order first becomes PAID, by the customer named on that order.
    const becomesPaid =
      orderData.paymentStatus === "PAID" &&
      orderData.status !== "CANCELLED" &&
      existingOrder?.paymentStatus !== "PAID" &&
      !existingOrder?.loyaltyPointsCredited;
    const customerKey = String(orderData.customerName || "").trim();
    const serverEarnedPoints = becomesPaid ? Math.floor(v.total / 10000) : 0;
    const creditsLoyalty = Boolean(customerKey) && serverEarnedPoints > 0;

    const savedOrder = await savePersistentOrder(
      creditsLoyalty ? { ...orderData, loyaltyPointsCredited: true } : orderData
    );

    const loyaltyRecord = creditsLoyalty
      ? await updatePersistentLoyaltyPoints(customerKey, serverEarnedPoints, orderData.customerName, orderData.id)
      : null;

    return NextResponse.json({
      success: true,
      order: savedOrder,
      loyaltyRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    const canResetOrders =
      auth.role === "SUPER_ADMIN" ||
      (auth.role === "OWNER" && auth.scopeLevel !== "TENANT");
    if (!canResetOrders) {
      return NextResponse.json(
        {
          error: `FORBIDDEN: Role [${auth.role}] tidak diizinkan mereset data transaksi POS.`,
        },
        { status: 403 }
      );
    }

    const previousCount = (await getPersistentOrders()).length;
    await resetPersistentOrders();

    const actorName = auth.name || auth.email || "Admin";
    await appendAuditLog({
      id: `audit-orders-reset-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: auth.userId || "unknown",
      actorName,
      actorRole: auth.role,
      role: auth.role,
      userId: auth.userId || "unknown",
      userName: actorName,
      userRole: auth.role,
      action: "RESET_ORDERS",
      module: "POS",
      recordId: "pos_orders",
      referenceId: "pos_orders",
      previousValue: `${previousCount} transaksi`,
      newValue: "0 transaksi",
      description: `Reset seluruh data transaksi POS (${previousCount} pesanan dihapus).`,
      reason: "Reset data operasional POS oleh Super Admin / Hub Owner",
      status: "WARNING",
      severity: "HIGH",
      category: "CONFIGURATION",
    });

    return NextResponse.json({
      success: true,
      orders: [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mereset data transaksi POS.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
