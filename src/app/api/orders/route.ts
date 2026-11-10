import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getPersistentOrders,
  savePersistentOrder,
  getPersistentLoyaltyPoints,
  updatePersistentLoyaltyPoints,
  claimQrisSessionForOrder,
  appendAuditLog,
} from "@/lib/persistent-storage";
import { getRequestAuthUser } from "@/lib/server-auth";
import { OrderRecord } from "@/types/order";
import { RoleSlug } from "@/types/auth";

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
  "confirmedAt",
  "kitchenReceivedAt",
  "cookingStartedAt",
  "cookingFinishedAt",
  "readyAt",
  "servedAt",
  "completedAt",
  "loyaltyPointsCredited",
]);

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
  | { allowed: true; auditPaidChange: boolean }
  | { allowed: false; error: string; status?: number };

/**
 * Who may write what:
 * - new order: POS roles; a waiter only an unpaid (PENDING) order
 * - workflow-only change (status/timestamps) that does not cancel: POS roles, kitchen and waiter
 * - any other change to an unpaid order: POS roles
 * - any other change to a PAID, CANCELLED or REFUNDED order: supervisors only, and it is audited
 * - workflow history may only grow by appending
 */
function decideOrderWrite(
  role: RoleSlug,
  existing: OrderRecord | undefined,
  next: OrderRecord
): OrderWriteDecision {
  const isPosRole = ORDER_WRITE_ROLES.includes(role);
  const isSupervisor = SUPERVISOR_ROLES.includes(role);

  if (!existing) {
    if (isPosRole) return { allowed: true, auditPaidChange: false };
    if (role === "WAITER" && next.paymentStatus === "PENDING") return { allowed: true, auditPaidChange: false };
    return { allowed: false, error: `FORBIDDEN: Role [${role}] tidak diizinkan membuat transaksi POS ini.` };
  }

  const isClosed = existing.status === "CANCELLED" || existing.paymentStatus === "REFUNDED";
  const workflowOnly =
    !isClosed &&
    next.status !== "CANCELLED" &&
    canonicalSale(existing) === canonicalSale(next) &&
    historyOnlyAppends(existing, next);
  if (workflowOnly) return { allowed: true, auditPaidChange: false };

  if (existing.paymentStatus === "PAID") {
    if (!isSupervisor) {
      return {
        allowed: false,
        error:
          "FORBIDDEN: ORDER_ALREADY_PAID: Pesanan ini sudah berstatus lunas. Pembayaran kedua ditolak. Perubahan data atau pembatalan transaksi yang sudah lunas wajib dilakukan oleh supervisor (Manager/Owner).",
      };
    }
  }

  if (existing.paymentStatus !== "PAID" && !isClosed) {
    return isPosRole
      ? { allowed: true, auditPaidChange: false }
      : { allowed: false, error: `FORBIDDEN: Role [${role}] hanya boleh mengubah status pesanan.` };
  }

  return isSupervisor
    ? { allowed: true, auditPaidChange: true }
    : {
        allowed: false,
        error:
          "FORBIDDEN: Perubahan data atau pembatalan transaksi yang sudah lunas wajib dilakukan oleh supervisor (Manager/Owner).",
      };
}

const OrderItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().optional(),
  productName: z.string().min(1),
  quantity: z.number().finite().positive(),
  unitPrice: z.number().finite().nonnegative(),
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
  paymentMethod: z.enum(["CASH", "QRIS", "EDC", "TRANSFER", "SPLIT"]).optional(),
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
    const orderData: OrderRecord = withoutClientFields(body.order || body);

    if (!orderData || !orderData.id) {
      return NextResponse.json(
        { error: "Order payload with valid id is required." },
        { status: 400 }
      );
    }

    // R8: Validate order schema & mathematical consistency on the server
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
    const decision = decideOrderWrite(auth.role, existingOrder, orderData);
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.error }, { status: decision.status || 403 });
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
      await appendAuditLog({
        id: `audit-order-reversal-${orderData.id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: auth.userId || "unknown",
        userName: auth.name || auth.email || "Supervisor",
        userRole: auth.role,
        action: "PAID_ORDER_CHANGED_BY_SUPERVISOR",
        module: "POS",
        description: `Transaksi lunas ${orderData.orderNumber || orderData.id} diubah supervisor: status ${orderData.paymentStatus}/${orderData.status}, total ${existingOrder?.total} -> ${v.total}.`,
        referenceId: orderData.id,
        metadata: {
          previousPaymentStatus: existingOrder?.paymentStatus,
          previousTotal: existingOrder?.total,
          total: v.total,
          paymentStatus: orderData.paymentStatus,
          status: orderData.status,
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
