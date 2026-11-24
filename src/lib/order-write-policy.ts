import { z } from "zod";
import {
  getOrderWorkflowTenants,
  isKdsGatedStatus,
} from "@/features/orders/orders-domain";
import type { RoleSlug, ScopeLevel } from "@/types/auth";
import type { OrderRecord, OrderStatus, OrderStatusHistoryItem } from "@/types/order";

export const ORDER_READ_ROLES: RoleSlug[] = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "CASHIER",
  "WAITER",
  "KITCHEN_STAFF",
];

export const ORDER_WRITE_ROLES: RoleSlug[] = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "CASHIER",
];

export const SUPERVISOR_ROLES: RoleSlug[] = ["SUPER_ADMIN", "OWNER", "MANAGER"];
export const LOYALTY_READ_ROLES: RoleSlug[] = ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"];
export const STATUS_ONLY_ROLES: RoleSlug[] = ["KITCHEN_STAFF", "WAITER"];
export const ORDER_ACCESS_ROLES: RoleSlug[] = [...ORDER_WRITE_ROLES, ...STATUS_ONLY_ROLES];

export const STRIPPED_CLIENT_ORDER_FIELDS = [
  "syncStatus",
  "syncError",
  "supervisorPin",
  "supervisorPinVerified",
  "orderId",
  "loyaltyPointsReversed",
  "bomDeducted",
  "bomRestored",
] as const;

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
  "loyaltyPointsReversed",
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function omitUndefinedProperties<T extends object>(obj: T): T {
  const copy = { ...obj };
  for (const key of Object.keys(copy)) {
    if (Reflect.get(copy, key) === undefined) {
      Reflect.deleteProperty(copy, key);
    }
  }
  return copy;
}

export function withoutClientOrderFields(
  order: OrderRecord & { supervisorPin?: unknown; orderId?: unknown }
): OrderRecord {
  const {
    syncStatus: _syncStatus,
    syncError: _syncError,
    supervisorPin: _supervisorPin,
    supervisorPinVerified: _supervisorPinVerified,
    orderId: _orderId,
    loyaltyPointsReversed: _loyaltyPointsReversed,
    bomDeducted: _bomDeducted,
    bomRestored: _bomRestored,
    ...rest
  } = order;
  void _syncStatus;
  void _syncError;
  void _supervisorPin;
  void _supervisorPinVerified;
  void _orderId;
  void _loyaltyPointsReversed;
  void _bomDeducted;
  void _bomRestored;
  return rest;
}

export function withoutClientPatchFields(
  patch: Partial<OrderRecord> & { supervisorPin?: unknown; orderId?: unknown }
): Partial<OrderRecord> {
  const {
    syncStatus: _syncStatus,
    syncError: _syncError,
    supervisorPin: _supervisorPin,
    supervisorPinVerified: _supervisorPinVerified,
    orderId: _orderId,
    loyaltyPointsReversed: _loyaltyPointsReversed,
    bomDeducted: _bomDeducted,
    bomRestored: _bomRestored,
    ...rest
  } = patch;
  void _syncStatus;
  void _syncError;
  void _supervisorPin;
  void _supervisorPinVerified;
  void _orderId;
  void _loyaltyPointsReversed;
  void _bomDeducted;
  void _bomRestored;
  return rest;
}

export function computeAggregateOrderStatus(
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

export function mergeStatusHistory(
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

export function mergeTenantWorkflowStageUpdate(
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

export function targetsKdsStage(
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

export function historyOnlyAppends(previous: OrderRecord, next: OrderRecord): boolean {
  const before = previous.statusHistory ?? [];
  const after = next.statusHistory ?? [];
  return (
    after.length >= before.length &&
    before.every((entry, index) => JSON.stringify(entry) === JSON.stringify(after[index]))
  );
}

export function canonicalSale(order: OrderRecord): string {
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (isPlainObject(value)) {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, sortKeys(value[key])])
      );
    }
    return value;
  };
  const sale = Object.fromEntries(
    Object.entries(order).filter(([key, value]) => !WORKFLOW_FIELDS.has(key) && value !== undefined)
  );
  return JSON.stringify(sortKeys(sale));
}

export function canonicalCoreSale(order: OrderRecord): string {
  const PAYMENT_OR_WORKFLOW_FIELDS = new Set([
    ...WORKFLOW_FIELDS,
    "paymentStatus",
    "paymentMethod",
    "paidAmount",
    "changeDue",
    "paymentReference",
    "qrisVerification",
    "cashierName",
    "splitDetails",
  ]);
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (isPlainObject(value)) {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, sortKeys(value[key])])
      );
    }
    return value;
  };
  const normalized: OrderRecord = {
    ...order,
    tax: Math.round(order.tax ?? 0),
    serviceCharge: Math.round(order.serviceCharge ?? 0),
  };
  const sale = Object.fromEntries(
    Object.entries(normalized).filter(
      ([key, value]) => !PAYMENT_OR_WORKFLOW_FIELDS.has(key) && value !== undefined
    )
  );
  return JSON.stringify(sortKeys(sale));
}

export function validateOrderStateTransition(
  existingOrder: OrderRecord | undefined,
  orderData: OrderRecord
): { ok: true } | { ok: false; status: 400; error: string } {
  if (
    !existingOrder &&
    (orderData.status === "CANCELLED" ||
      orderData.paymentStatus === "REFUNDED" ||
      Boolean(orderData.voidReason) ||
      Boolean(orderData.refundReason))
  ) {
    return {
      ok: false,
      status: 400,
      error:
        "INVALID_ORDER_PAYLOAD: Pesanan baru tidak dapat dibuat langsung dalam status batal atau refund.",
    };
  }

  if (
    existingOrder &&
    existingOrder.paymentStatus !== "PAID" &&
    existingOrder.paymentStatus !== "REFUNDED" &&
    orderData.paymentStatus === "REFUNDED"
  ) {
    return {
      ok: false,
      status: 400,
      error: "INVALID_REFUND_STATE: Hanya pesanan yang sudah lunas yang dapat di-refund.",
    };
  }

  return { ok: true };
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

const CorporateInfoSchema = z.object({
  companyName: z.string(),
  picName: z.string(),
  picPhone: z.string(),
  headcount: z.number().int().positive().optional(),
  billingType: z.enum(["PREPAID", "INVOICE"]),
  invoiceNumber: z.string().optional(),
  invoiceDueDate: z.string().optional(),
  notes: z.string().optional(),
  linkedBookingCode: z.string().optional(),
  linkedSpaceName: z.string().optional(),
});

const OrderPayloadSchema = z.object({
  id: z.string().min(1),
  orderNumber: z.string().optional(),
  outletId: z.string().optional(),
  loyaltyMemberId: z.string().optional(),
  loyaltyPointsReversed: z.boolean().optional(),
  subtotal: z.number().finite().nonnegative(),
  discount: z.number().finite().nonnegative().optional(),
  fnbDiscount: z.number().finite().nonnegative().optional(),
  coworkingDiscount: z.number().finite().nonnegative().optional(),
  discountSource: z.enum(["MANUAL", "PROMO", "VOUCHER"]).optional(),
  manualDiscountReason: z.string().optional(),
  manualDiscountApprovedBy: z.string().optional(),
  voucherTitle: z.string().optional(),
  tax: z.number().finite().nonnegative().optional(),
  fnbTax: z.number().finite().nonnegative().optional(),
  coworkingTax: z.number().finite().nonnegative().optional(),
  serviceCharge: z.number().finite().nonnegative().optional(),
  total: z.number().finite().nonnegative(),
  items: z.array(OrderItemSchema).optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "REFUNDED"]).optional(),
  paymentMethod: z.enum(["CASH", "QRIS", "EDC", "TRANSFER", "SPLIT", "INVOICE"]).optional(),
  refundMethod: z.enum(["CASH", "QRIS"]).optional(),
  refundReason: z.string().optional(),
  refundApprovedBy: z.string().optional(),
  refundedAt: z.string().optional(),
  voidReason: z.string().optional(),
  voidApprovedBy: z.string().optional(),
  voidedAt: z.string().optional(),
  notes: z.string().optional(),
  corporateInfo: CorporateInfoSchema.optional(),
  status: z
    .enum([
      "NEW",
      "CONFIRMED",
      "KITCHEN_RECEIVED",
      "COOKING",
      "READY",
      "SERVED",
      "COMPLETED",
      "CANCELLED",
    ])
    .optional(),
});

export function validateOrderPayload(
  orderData: OrderRecord
): { ok: true; total: number } | { ok: false; error: string; details?: z.ZodIssue[] } {
  const parsed = OrderPayloadSchema.safeParse({
    id: orderData.id,
    orderNumber: orderData.orderNumber,
    outletId: orderData.outletId,
    loyaltyMemberId: orderData.loyaltyMemberId,
    loyaltyPointsReversed: orderData.loyaltyPointsReversed,
    subtotal: Number(orderData.subtotal ?? 0),
    discount: orderData.discount !== undefined ? Number(orderData.discount) : undefined,
    fnbDiscount: orderData.fnbDiscount !== undefined ? Number(orderData.fnbDiscount) : undefined,
    coworkingDiscount:
      orderData.coworkingDiscount !== undefined ? Number(orderData.coworkingDiscount) : undefined,
    discountSource: orderData.discountSource,
    manualDiscountReason: orderData.manualDiscountReason,
    manualDiscountApprovedBy: orderData.manualDiscountApprovedBy,
    voucherTitle: orderData.voucherTitle,
    tax: orderData.tax !== undefined ? Number(orderData.tax) : undefined,
    fnbTax: orderData.fnbTax !== undefined ? Number(orderData.fnbTax) : undefined,
    coworkingTax:
      orderData.coworkingTax !== undefined ? Number(orderData.coworkingTax) : undefined,
    serviceCharge:
      orderData.serviceCharge !== undefined ? Number(orderData.serviceCharge) : undefined,
    total: Number(orderData.total ?? 0),
    items: Array.isArray(orderData.items) ? orderData.items : undefined,
    paymentStatus: orderData.paymentStatus,
    paymentMethod: orderData.paymentMethod,
    refundMethod: orderData.refundMethod,
    refundReason: orderData.refundReason,
    refundApprovedBy: orderData.refundApprovedBy,
    refundedAt: orderData.refundedAt,
    voidReason: orderData.voidReason,
    voidApprovedBy: orderData.voidApprovedBy,
    voidedAt: orderData.voidedAt,
    notes: orderData.notes,
    corporateInfo: orderData.corporateInfo,
    status: orderData.status,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "INVALID_ORDER_PAYLOAD: Struktur data pesanan tidak valid.",
      details: parsed.error.issues,
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
        error: `INVALID_ORDER_SUBTOTAL: Subtotal (${v.subtotal}) tidak cocok dengan total harga item (${itemsSubtotal}).`,
      };
    }
  }

  const expectedTotal =
    Math.max(0, v.subtotal - (v.discount ?? 0)) + (v.tax ?? 0) + (v.serviceCharge ?? 0);
  if (Math.abs(expectedTotal - v.total) > 2) {
    return {
      ok: false,
      error: `INVALID_ORDER_TOTAL: Total (${v.total}) tidak konsisten dengan kalkulasi komponen (${expectedTotal}).`,
    };
  }

  return { ok: true, total: v.total };
}

export type OrderWriteDecision =
  | { allowed: true; auditPaidChange: boolean; requiresPinCheck: boolean }
  | { allowed: false; error: string; status?: number };

export function decideOrderWrite(
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
  const isCorporateInvoice =
    next.paymentMethod === "INVOICE" ||
    next.corporateInfo?.billingType === "INVOICE" ||
    existing?.paymentMethod === "INVOICE" ||
    existing?.corporateInfo?.billingType === "INVOICE";
  const createsOrSwitchesToInvoice =
    (next.paymentMethod === "INVOICE" || next.corporateInfo?.billingType === "INVOICE") &&
    (!existing ||
      (existing.paymentMethod !== "INVOICE" && existing.corporateInfo?.billingType !== "INVOICE"));

  if (createsOrSwitchesToInvoice && !isPosRole) {
    return {
      allowed: false,
      status: 403,
      error:
        "FORBIDDEN: Hanya peran kasir atau manajemen yang dapat menerbitkan pesanan tagihan perusahaan (INVOICE).",
    };
  }

  if (
    !isCancellingOrRefunding &&
    !isCorporateInvoice &&
    targetsKdsStage(next) &&
    effectivePaymentStatus !== "PAID"
  ) {
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
    if (next.paymentStatus === "PAID") {
      if (canonicalCoreSale(existing) !== canonicalCoreSale(next)) {
        return {
          allowed: false,
          error: "FORBIDDEN: Item dan nilai transaksi tidak boleh diubah saat pelunasan.",
        };
      }
      if (Array.isArray(next.splitDetails) && next.splitDetails.length > 0) {
        const hasInvalidSplitAmount = next.splitDetails.some((g) => {
          const amt = Number(g.amount);
          return !Number.isFinite(amt) || amt < 0;
        });
        const splitSum = next.splitDetails.reduce(
          (sum, g) => sum + Math.round(Number(g.amount || 0)),
          0
        );
        if (hasInvalidSplitAmount || Math.abs(splitSum - Math.round(existing.total)) > 1) {
          return {
            allowed: false,
            status: 400,
            error:
              "INVALID_SPLIT_TOTAL: Total rincian split payment tidak sesuai dengan total pesanan.",
          };
        }
      }
    }
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
