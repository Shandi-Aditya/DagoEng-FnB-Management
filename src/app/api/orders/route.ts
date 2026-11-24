import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getPersistentOrders,
  resetPersistentOrders,
  mutatePersistentOrders,
  upsertOrderInList,
  getPersistentLoyaltyPoints,
  updatePersistentLoyaltyPoints,
  claimQrisSessionForOrder,
  appendAuditLog,
  isOrderBeforeCooking,
  deductPersistentOrderBOM,
  restorePersistentOrderBOMIfBeforeCooking,
} from "@/lib/persistent-storage";
import { getRequestAuthUser, type ServerAuthResult } from "@/lib/server-auth";
import {
  authorizeSupervisorQrisOverride,
  SHARED_SUPERVISOR_PIN_LABEL,
} from "@/lib/qris-verification";
import {
  filterOrdersByTenant,
  getOrderWorkflowTenants,
  isKdsGatedStatus,
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
  "bomDeducted",
  "bomRestored",
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
  const tenants = getOrderWorkflowTenants(items);
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

const STRIPPED_CLIENT_ORDER_FIELDS = [
  "syncStatus",
  "syncError",
  "supervisorPin",
  "orderId",
  "bomDeducted",
  "bomRestored",
] as const;

function targetsKdsStage(
  order: Pick<OrderRecord, "status" | "tenantStatuses">
): boolean {
  if (order.status === "CANCELLED") return false;
  if (isKdsGatedStatus(order.status)) return true;
  if (order.tenantStatuses) {
    return Object.values(order.tenantStatuses).some((stage) =>
      isKdsGatedStatus(stage)
    );
  }
  return false;
}

function withoutClientFields(order: OrderRecord): OrderRecord {
  const copy: Record<string, unknown> = { ...order };
  for (const field of STRIPPED_CLIENT_ORDER_FIELDS) delete copy[field];
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
  scopedTenantId: string,
  explicitTenantStage?: OrderStatus
): OrderRecord {
  const nextTenantStage =
    explicitTenantStage || orderData.tenantStatuses?.[scopedTenantId] || orderData.status;
  const mergedTenantStatuses: Record<string, OrderStatus> = {
    ...(existingOrder.tenantStatuses || {}),
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
  const effectivePaymentStatus = next.paymentStatus ?? existing?.paymentStatus ?? "PENDING";
  const isCancellingOrRefunding =
    next.status === "CANCELLED" ||
    next.paymentStatus === "REFUNDED" ||
    Boolean(next.voidReason);

  if (!isCancellingOrRefunding && targetsKdsStage(next) && effectivePaymentStatus !== "PAID") {
    return {
      allowed: false,
      status: 403,
      error: "FORBIDDEN: KDS_PAYMENT_REQUIRED: Pesanan belum lunas tidak dapat masuk dapur / KDS.",
    };
  }

  if (!existing) {
    if (isPosRole) return { allowed: true, auditPaidChange: false, requiresPinCheck: false };
    if (role === "WAITER" && next.paymentStatus === "PENDING") {
      return { allowed: true, auditPaidChange: false, requiresPinCheck: false };
    }
    return { allowed: false, error: `FORBIDDEN: Role [${role}] tidak diizinkan membuat transaksi POS ini.` };
  }

  const isClosed = existing.status === "CANCELLED" || existing.paymentStatus === "REFUNDED";
  if (
    existing.status === "CANCELLED" &&
    next.status === "CANCELLED" &&
    effectivePaymentStatus === existing.paymentStatus &&
    canonicalSale(existing) === canonicalSale(next)
  ) {
    if (isHubSupervisor) {
      return { allowed: true, auditPaidChange: false, requiresPinCheck: false };
    }
    if ((role === "CASHIER" || isTenantOwner) && hasSupervisorPin) {
      return { allowed: true, auditPaidChange: false, requiresPinCheck: true };
    }
  }

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

const CoworkingMetaSchema = z.object({
  spaceId: z.string(),
  spaceName: z.string(),
  spaceType: z.string().optional(),
  durationHours: z.number(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  bookingDate: z.string().optional(),
  rateLabel: z.string().optional(),
});

const OrderItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().optional(),
  tenantId: z.string().optional(),
  tenantName: z.string().optional(),
  itemType: z.enum(["FNB", "COWORKING"]).optional(),
  category: z.string().optional(),
  coworkingMeta: CoworkingMetaSchema.optional(),
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
  fnbDiscount: z.number().finite().nonnegative().optional(),
  coworkingDiscount: z.number().finite().nonnegative().optional(),
  tax: z.number().finite().nonnegative().optional(),
  fnbTax: z.number().finite().nonnegative().optional(),
  coworkingTax: z.number().finite().nonnegative().optional(),
  serviceCharge: z.number().finite().nonnegative().optional(),
  total: z.number().finite().nonnegative(),
  items: z.array(OrderItemSchema).optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "REFUNDED"]).optional(),
  paymentMethod: z.enum(["CASH", "QRIS", "EDC", "TRANSFER", "SPLIT"]).optional(),
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

function validateOrderPayload(orderData: OrderRecord):
  | { ok: true; total: number }
  | { ok: false; response: NextResponse } {
  const parsed = OrderPayloadSchema.safeParse({
    id: orderData.id,
    orderNumber: orderData.orderNumber,
    outletId: orderData.outletId,
    subtotal: Number(orderData.subtotal ?? 0),
    discount: orderData.discount !== undefined ? Number(orderData.discount) : undefined,
    fnbDiscount: orderData.fnbDiscount !== undefined ? Number(orderData.fnbDiscount) : undefined,
    coworkingDiscount:
      orderData.coworkingDiscount !== undefined ? Number(orderData.coworkingDiscount) : undefined,
    tax: orderData.tax !== undefined ? Number(orderData.tax) : undefined,
    fnbTax: orderData.fnbTax !== undefined ? Number(orderData.fnbTax) : undefined,
    coworkingTax:
      orderData.coworkingTax !== undefined ? Number(orderData.coworkingTax) : undefined,
    serviceCharge:
      orderData.serviceCharge !== undefined ? Number(orderData.serviceCharge) : undefined,
    total: Number(orderData.total ?? 0),
    items: Array.isArray(orderData.items) ? orderData.items : undefined,
    paymentStatus: orderData.paymentStatus,
    paymentMethod: orderData.paymentMethod as OrderRecord["paymentMethod"],
    notes: orderData.notes,
    status: orderData.status,
  });

  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "INVALID_ORDER_PAYLOAD: Struktur data pesanan tidak valid.",
          details: parsed.error.issues,
        },
        { status: 400 }
      ),
    };
  }

  const v = parsed.data;
  if (v.items && v.items.length > 0) {
    const itemsSubtotal = v.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
    if (Math.abs(itemsSubtotal - v.subtotal) > 2) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: `INVALID_ORDER_SUBTOTAL: Subtotal (${v.subtotal}) tidak cocok dengan total harga item (${itemsSubtotal}).`,
          },
          { status: 400 }
        ),
      };
    }
  }

  const expectedTotal =
    Math.max(0, v.subtotal - (v.discount ?? 0)) + (v.tax ?? 0) + (v.serviceCharge ?? 0);
  if (Math.abs(expectedTotal - v.total) > 2) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `INVALID_ORDER_TOTAL: Total (${v.total}) tidak konsisten dengan kalkulasi komponen (${expectedTotal}).`,
        },
        { status: 400 }
      ),
    };
  }

  return { ok: true, total: v.total };
}

async function authorizeOrderRouteWrite(req: NextRequest): Promise<
  | { ok: true; auth: ServerAuthResult & { role: RoleSlug } }
  | { ok: false; response: NextResponse }
> {
  const auth = await getRequestAuthUser(req);
  if (!auth.isAuthenticated || !auth.role) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      ),
    };
  }

  if (!ORDER_ACCESS_ROLES.includes(auth.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `FORBIDDEN: Role [${auth.role}] tidak memiliki wewenang menyimpan transaksi POS.` },
        { status: 403 }
      ),
    };
  }

  return { ok: true, auth: auth as ServerAuthResult & { role: RoleSlug } };
}

type OrderWriteAction =
  | {
      mode: "UPSERT";
      initialOrderData: OrderRecord;
    }
  | {
      mode: "PATCH";
      targetId: string;
      rawPatch: Partial<OrderRecord>;
    }
  | {
      mode: "CANCEL_DELETE";
      targetId: string;
      voidReason: string;
    };

type OrderMutationOutcome =
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      savedOrder: OrderRecord;
      priorOrder: OrderRecord | undefined;
      auditPaidChange: boolean;
      validatedTotal: number;
      isCancelOrRefund: boolean;
      shouldAttemptRestore: boolean;
      cancelReason: string;
      creditsLoyalty: boolean;
      customerKey: string;
      serverEarnedPoints: number;
    };

function buildOrderCandidateForWrite(
  action: OrderWriteAction,
  existingOrder: OrderRecord | undefined,
  auth: ServerAuthResult & { role: RoleSlug }
): { ok: true; orderData: OrderRecord } | { ok: false; response: NextResponse } {
  if (action.mode === "UPSERT") {
    return { ok: true, orderData: action.initialOrderData };
  }

  if (!existingOrder) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `NOT_FOUND: Pesanan [${action.targetId}] tidak ditemukan.` },
        { status: 404 }
      ),
    };
  }

  if (action.mode === "CANCEL_DELETE") {
    const nowIso = new Date().toISOString();
    const nextPaymentStatus =
      existingOrder.paymentStatus === "PAID"
        ? ("REFUNDED" as const)
        : existingOrder.paymentStatus;
    return {
      ok: true,
      orderData: {
        ...existingOrder,
        status: "CANCELLED",
        paymentStatus: nextPaymentStatus,
        voidReason: action.voidReason,
        voidedAt: existingOrder.voidedAt || nowIso,
        ...(nextPaymentStatus === "REFUNDED"
          ? {
              refundReason: existingOrder.refundReason || action.voidReason,
              refundedAt: existingOrder.refundedAt || nowIso,
            }
          : {}),
        statusHistory:
          existingOrder.status === "CANCELLED"
            ? existingOrder.statusHistory
            : [
                ...(existingOrder.statusHistory ?? []),
                {
                  id: `h-del-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  orderId: existingOrder.id,
                  fromStatus: existingOrder.status,
                  toStatus: "CANCELLED",
                  timestamp: nowIso,
                  actorId: auth.userId ?? undefined,
                  actorName: auth.name || auth.role,
                  note: action.voidReason,
                },
              ],
      },
    };
  }

  const patchEntries = Object.entries(action.rawPatch as unknown as Record<string, unknown>).filter(
    ([, value]) => value !== undefined
  );
  const mergedOrder: OrderRecord = {
    ...existingOrder,
    ...(Object.fromEntries(patchEntries) as Partial<OrderRecord>),
    id: existingOrder.id,
  };

  const rawHasHistory =
    Array.isArray(action.rawPatch.statusHistory) && action.rawPatch.statusHistory.length > 0;
  if (!rawHasHistory && mergedOrder.status && mergedOrder.status !== existingOrder.status) {
    const nowIso = new Date().toISOString();
    mergedOrder.statusHistory = [
      ...(existingOrder.statusHistory ?? []),
      {
        id: `h-patch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderId: existingOrder.id,
        fromStatus: existingOrder.status,
        toStatus: mergedOrder.status,
        timestamp: nowIso,
        actorId: auth.userId ?? undefined,
        actorName: auth.name || auth.role,
        note:
          mergedOrder.status === "CANCELLED"
            ? mergedOrder.voidReason || mergedOrder.refundReason || "Pesanan dibatalkan"
            : `Status diubah menjadi ${mergedOrder.status}`,
      },
    ];
  }

  return { ok: true, orderData: mergedOrder };
}

async function executeAuthorizedOrderWrite(params: {
  auth: ServerAuthResult & { role: RoleSlug };
  action: OrderWriteAction;
  supervisorPin: string;
}): Promise<NextResponse> {
  const { auth, action, supervisorPin } = params;

  if (action.mode === "UPSERT") {
    const preValidation = validateOrderPayload(action.initialOrderData);
    if (!preValidation.ok) return preValidation.response;
  }

  const scopedTenantId =
    (auth.scopeLevel === "TENANT" || auth.role === "KITCHEN_STAFF") && auth.tenantId
      ? normalizeTenantId(auth.tenantId)
      : undefined;

  const outcome = await mutatePersistentOrders<OrderMutationOutcome>(async (existingOrders) => {
    const targetId =
      action.mode === "UPSERT" ? action.initialOrderData.id : action.targetId;
    const existingOrder = existingOrders.find((o) => o.id === targetId);

    const candidate = buildOrderCandidateForWrite(action, existingOrder, auth);
    if (!candidate.ok) {
      return { nextOrders: existingOrders, result: candidate };
    }

    let orderData = candidate.orderData;
    const validation = validateOrderPayload(orderData);
    if (!validation.ok) {
      return { nextOrders: existingOrders, result: { ok: false, response: validation.response } };
    }
    const validatedTotal = validation.total;

    if (existingOrder && scopedTenantId) {
      const orderFallback = (existingOrder as { tenantId?: string }).tenantId;
      const allExistingTenants = Array.from(
        new Set(
          existingOrder.items.map((it) => resolveNormalizedItemTenantId(it, orderFallback))
        )
      );
      if (!allExistingTenants.includes(scopedTenantId)) {
        return {
          nextOrders: existingOrders,
          result: {
            ok: false,
            response: NextResponse.json(
              { error: "FORBIDDEN: Pesanan ini tidak memiliki item untuk tenant Anda." },
              { status: 403 }
            ),
          },
        };
      }

      const requestsReversal =
        orderData.status === "CANCELLED" ||
        orderData.paymentStatus === "REFUNDED" ||
        Boolean(orderData.voidReason);
      if (allExistingTenants.length > 1 && requestsReversal) {
        return {
          nextOrders: existingOrders,
          result: {
            ok: false,
            response: NextResponse.json(
              {
                error:
                  "FORBIDDEN: Pembatalan atau refund pesanan multi-mitra harus diproses oleh kasir atau supervisor hub.",
              },
              { status: 403 }
            ),
          },
        };
      }

      const existingTenants = getOrderWorkflowTenants(existingOrder.items, orderFallback);

      const isClosed =
        existingOrder.status === "CANCELLED" || existingOrder.paymentStatus === "REFUNDED";
      const explicitTenantStage =
        action.mode === "PATCH"
          ? action.rawPatch.tenantStatuses?.[scopedTenantId] ?? action.rawPatch.status
          : action.mode === "UPSERT"
          ? action.initialOrderData.tenantStatuses?.[scopedTenantId] ??
            action.initialOrderData.status
          : orderData.status;
      if (existingTenants.length > 1) {
        if (!isClosed) {
          orderData = mergeTenantWorkflowStageUpdate(
            existingOrder,
            orderData,
            scopedTenantId,
            explicitTenantStage
          );
        }
      } else if (!isClosed && !requestsReversal && (orderData.tenantStatuses || existingOrder.tenantStatuses)) {
        const scopedStage = explicitTenantStage || orderData.tenantStatuses?.[scopedTenantId];
        orderData = {
          ...orderData,
          ...(scopedStage ? { status: scopedStage } : {}),
          tenantStatuses: {
            ...(existingOrder.tenantStatuses || {}),
            ...(scopedStage ? { [scopedTenantId]: scopedStage } : {}),
          },
        };
      }
    }

    if (existingOrder) {
      orderData = {
        ...orderData,
        confirmedAt: existingOrder.confirmedAt || orderData.confirmedAt,
        kitchenReceivedAt: existingOrder.kitchenReceivedAt || orderData.kitchenReceivedAt,
        cookingStartedAt: existingOrder.cookingStartedAt || orderData.cookingStartedAt,
        cookingFinishedAt: existingOrder.cookingFinishedAt || orderData.cookingFinishedAt,
        readyAt: existingOrder.readyAt || orderData.readyAt,
        servedAt: existingOrder.servedAt || orderData.servedAt,
        completedAt: existingOrder.completedAt || orderData.completedAt,
      };
    }

    const hasCookingStage =
      orderData.status === "COOKING" ||
      Object.values(orderData.tenantStatuses ?? {}).some((stage) => stage === "COOKING");
    if (hasCookingStage && !orderData.cookingStartedAt) {
      orderData = { ...orderData, cookingStartedAt: new Date().toISOString() };
    }

    const decision = decideOrderWrite(
      auth.role,
      auth.scopeLevel,
      existingOrder,
      orderData,
      Boolean(supervisorPin)
    );
    if (!decision.allowed) {
      return {
        nextOrders: existingOrders,
        result: {
          ok: false,
          response: NextResponse.json(
            { error: decision.error },
            { status: decision.status || 403 }
          ),
        },
      };
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
        return {
          nextOrders: existingOrders,
          result: {
            ok: false,
            response: NextResponse.json(
              { error: message },
              { status: pinCheck.statusCode || 403 }
            ),
          },
        };
      }
      orderData = {
        ...orderData,
        supervisorPinVerified: true,
      };
    }

    // A PAID QRIS order must consume exactly one verified QRIS session, identified by its gateway invoice number.
    const alreadySettledByThisPayment =
      existingOrder?.paymentStatus === "PAID" &&
      existingOrder.paymentMethod === "QRIS" &&
      existingOrder.total === orderData.total &&
      existingOrder.qrisVerification?.invoiceNumber === orderData.qrisVerification?.invoiceNumber;
    if (
      orderData.paymentMethod === "QRIS" &&
      orderData.paymentStatus === "PAID" &&
      !alreadySettledByThisPayment
    ) {
      const qrisInvoiceNumber = orderData.qrisVerification?.invoiceNumber?.trim();
      const claim = qrisInvoiceNumber
        ? await claimQrisSessionForOrder({
            invoiceNumber: qrisInvoiceNumber,
            orderId: orderData.id,
            amount: validatedTotal,
          })
        : ({ ok: false, reason: "NOT_FOUND" } as const);

      if (!claim.ok) {
        return {
          nextOrders: existingOrders,
          result: {
            ok: false,
            response: NextResponse.json(
              {
                error: `QRIS_PAYMENT_UNVERIFIED [${claim.reason}]: ${QRIS_CLAIM_MESSAGES[claim.reason]}`,
              },
              { status: 409 }
            ),
          },
        };
      }
    }

    const isCancelOrRefund =
      orderData.status === "CANCELLED" || orderData.paymentStatus === "REFUNDED";
    const shouldAttemptRestore = Boolean(
      existingOrder && isCancelOrRefund && isOrderBeforeCooking(existingOrder)
    );
    const cancelReason =
      orderData.refundReason ||
      orderData.voidReason ||
      (orderData.paymentStatus === "REFUNDED"
        ? "Refund transaksi pelanggan"
        : "Pembatalan (void) pesanan");

    // Loyalty is earned once, when an order first becomes PAID, by the customer named on that order.
    const becomesPaid =
      orderData.paymentStatus === "PAID" &&
      orderData.status !== "CANCELLED" &&
      existingOrder?.paymentStatus !== "PAID" &&
      !existingOrder?.loyaltyPointsCredited;
    const customerKey = String(orderData.customerName || "").trim();
    const serverEarnedPoints = becomesPaid ? Math.floor(validatedTotal / 10000) : 0;
    const creditsLoyalty = Boolean(customerKey) && serverEarnedPoints > 0;

    const orderToPersist = creditsLoyalty
      ? { ...orderData, loyaltyPointsCredited: true }
      : orderData;
    const { nextOrders, savedOrder } = upsertOrderInList(existingOrders, orderToPersist);

    return {
      nextOrders,
      result: {
        ok: true,
        savedOrder,
        priorOrder: existingOrder,
        auditPaidChange: decision.auditPaidChange,
        validatedTotal,
        isCancelOrRefund,
        shouldAttemptRestore,
        cancelReason,
        creditsLoyalty,
        customerKey,
        serverEarnedPoints,
      },
    };
  });

  if (!outcome.ok) return outcome.response;

  const {
    savedOrder,
    priorOrder,
    auditPaidChange,
    validatedTotal,
    isCancelOrRefund,
    shouldAttemptRestore,
    cancelReason,
    creditsLoyalty,
    customerKey,
    serverEarnedPoints,
  } = outcome;

  let bomRestoration: { restored: boolean; reason: string; restoredItems: number } | null = null;
  if (priorOrder && isCancelOrRefund) {
    if (shouldAttemptRestore) {
      bomRestoration = await restorePersistentOrderBOMIfBeforeCooking(priorOrder, {
        reason: cancelReason,
      });
    } else {
      bomRestoration = {
        restored: false,
        reason: "already-cooking-or-beyond",
        restoredItems: 0,
      };
    }
  }

  let bomDeduction: { applied: boolean; deductedItems: number } | null = null;
  if (
    savedOrder.paymentStatus === "PAID" &&
    savedOrder.status !== "CANCELLED" &&
    !savedOrder.bomDeducted
  ) {
    bomDeduction = await deductPersistentOrderBOM(savedOrder, {
      reason: "POS Server Order Settlement",
    });
  }

  const finalOrder: OrderRecord =
    (await getPersistentOrders()).find((o) => o.id === savedOrder.id) ?? {
      ...savedOrder,
      ...(bomDeduction?.applied ? { bomDeducted: true } : {}),
      ...(bomRestoration?.restored ? { bomRestored: true } : {}),
    };

  if (auditPaidChange) {
    const isRefund = finalOrder.paymentStatus === "REFUNDED";
    const isVoid = !isRefund && (finalOrder.status === "CANCELLED" || Boolean(finalOrder.voidReason));
    const auditAction = isRefund
      ? "REFUND_ORDER"
      : isVoid
      ? "VOID_ORDER"
      : "PAID_ORDER_CHANGED_BY_SUPERVISOR";
    const supervisorLabel = isRefund
      ? finalOrder.refundApprovedBy || auth.name || SHARED_SUPERVISOR_PIN_LABEL
      : isVoid
      ? finalOrder.voidApprovedBy || auth.name || SHARED_SUPERVISOR_PIN_LABEL
      : auth.name || auth.email || "Supervisor";
    const auditReason = isRefund
      ? finalOrder.refundReason || "Refund transaksi pelanggan"
      : isVoid
      ? finalOrder.voidReason || "Pembatalan (void) pesanan"
      : "Perubahan transaksi lunas oleh supervisor";
    const actorName = auth.name || auth.email || "Supervisor";

    await appendAuditLog({
      id: `audit-order-reversal-${finalOrder.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
      recordId: finalOrder.orderNumber || finalOrder.id,
      referenceId: finalOrder.id,
      outletId: finalOrder.outletId,
      outletName: finalOrder.outletName,
      previousValue: `Status: ${priorOrder?.status || "-"}, Payment: ${priorOrder?.paymentStatus || "-"}, Total: Rp ${(priorOrder?.total ?? 0).toLocaleString("id-ID")}`,
      newValue: `Status: ${finalOrder.status}, Payment: ${finalOrder.paymentStatus}, Total: Rp ${validatedTotal.toLocaleString("id-ID")}`,
      description: isRefund
        ? `Refund transaksi ${finalOrder.orderNumber || finalOrder.id} sebesar Rp ${validatedTotal.toLocaleString("id-ID")}. Disetujui: ${supervisorLabel}`
        : isVoid
        ? `Pembatalan (void) pesanan ${finalOrder.orderNumber || finalOrder.id}. Disetujui: ${supervisorLabel}`
        : `Transaksi lunas ${finalOrder.orderNumber || finalOrder.id} diubah supervisor: status ${finalOrder.paymentStatus}/${finalOrder.status}, total ${priorOrder?.total} -> ${validatedTotal}.`,
      reason: auditReason,
      status: "SUCCESS",
      severity: "HIGH",
      category: "TRANSACTION",
      metadata: {
        previousStatus: priorOrder?.status,
        previousPaymentStatus: priorOrder?.paymentStatus,
        previousTotal: priorOrder?.total,
        total: validatedTotal,
        paymentStatus: finalOrder.paymentStatus,
        status: finalOrder.status,
        supervisorApprovedBy: supervisorLabel,
        supervisorPinVerified: Boolean(finalOrder.supervisorPinVerified),
      },
    });
  }

  const loyaltyRecord = creditsLoyalty
    ? await updatePersistentLoyaltyPoints(customerKey, serverEarnedPoints, finalOrder.customerName, finalOrder.id)
    : null;

  return NextResponse.json({
    success: true,
    order: finalOrder,
    loyaltyRecord,
    ...(bomDeduction ? { bomDeduction } : {}),
    ...(bomRestoration ? { bomRestoration } : {}),
  });
}

export async function POST(req: NextRequest) {
  try {
    const authCheck = await authorizeOrderRouteWrite(req);
    if (!authCheck.ok) return authCheck.response;

    const body = await req.json();
    const supervisorPin = typeof body.supervisorPin === "string" ? body.supervisorPin.trim() : "";
    const orderData: OrderRecord = withoutClientFields(body.order || body);

    if (!orderData || !orderData.id) {
      return NextResponse.json(
        { error: "Order payload with valid id is required." },
        { status: 400 }
      );
    }

    return await executeAuthorizedOrderWrite({
      auth: authCheck.auth,
      action: { mode: "UPSERT", initialOrderData: orderData },
      supervisorPin,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan transaksi POS.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authCheck = await authorizeOrderRouteWrite(req);
    if (!authCheck.ok) return authCheck.response;

    const body = await req.json().catch(() => ({}));
    const supervisorPin = typeof body?.supervisorPin === "string" ? body.supervisorPin.trim() : "";
    const rawPatch = withoutClientFields((body?.order || body || {}) as OrderRecord);
    const targetId = String(rawPatch?.id || body?.orderId || "").trim();

    if (!targetId) {
      return NextResponse.json(
        { error: "Order payload with valid id is required." },
        { status: 400 }
      );
    }

    return await executeAuthorizedOrderWrite({
      auth: authCheck.auth,
      action: { mode: "PATCH", targetId, rawPatch },
      supervisorPin,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui transaksi POS.";
    return NextResponse.json({ error: message }, { status: 500 });
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

    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = searchParams.get("action") || (typeof body?.action === "string" ? body.action : undefined);
    const targetId =
      searchParams.get("id") ||
      searchParams.get("orderId") ||
      (typeof body?.id === "string" ? body.id : undefined) ||
      (typeof body?.orderId === "string" ? body.orderId : undefined);

    if (targetId && action !== "RESET") {
      if (!ORDER_ACCESS_ROLES.includes(auth.role)) {
        return NextResponse.json(
          { error: `FORBIDDEN: Role [${auth.role}] tidak memiliki wewenang membatalkan transaksi POS.` },
          { status: 403 }
        );
      }

      const supervisorPin = typeof body?.supervisorPin === "string" ? body.supervisorPin.trim() : "";
      const voidReason =
        (typeof body?.voidReason === "string" && body.voidReason.trim()) ||
        searchParams.get("reason") ||
        "Dibatalkan via DELETE /api/orders";

      return await executeAuthorizedOrderWrite({
        auth: auth as ServerAuthResult & { role: RoleSlug },
        action: { mode: "CANCEL_DELETE", targetId: targetId.trim(), voidReason },
        supervisorPin,
      });
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
