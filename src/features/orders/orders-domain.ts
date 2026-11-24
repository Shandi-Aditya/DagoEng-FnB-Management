import type { StatusTone } from "@/components/app/status-badge";
import type { OrderItemBOMInput } from "@/features/inventory/inventory-data";
import type { POSReceiptData, SplitGuestBill } from "@/features/pos/types";
import {
  resolveCoworkingReceiptPublisher,
  resolvePosReceiptPublisher,
} from "@/lib/receipt-publisher";
import { resolveItemTenantId } from "@/lib/settlement";
import {
  allocateCategoryDiscounts,
  allocateCategoryTaxAndService,
  getOrderTaxBreakdown,
  isCoworkingOrderItem,
  normalizeTenantId,
  type CoworkingIdentifiableItem,
} from "@/lib/tax-breakdown";
import { getTenantName } from "@/lib/tenant";
import type { OrderItemRecord, OrderRecord, OrderStatus } from "@/types/order";
import type { KitchenTicketData, PrintPurpose } from "@/types/printer";

export { isCoworkingOrderItem, normalizeTenantId };

export const KDS_GATED_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "KITCHEN_RECEIVED",
  "COOKING",
  "READY",
  "SERVED",
  "COMPLETED",
]);

const PRE_COOK_DISALLOWED_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "COOKING",
  "READY",
  "SERVED",
  "COMPLETED",
]);

export function isKdsGatedStatus(status: OrderStatus): boolean {
  return KDS_GATED_STATUSES.has(status);
}

export function isOrderBeforeCooking(
  order: Pick<OrderRecord, "status" | "cookingStartedAt" | "tenantStatuses">
): boolean {
  if (order.cookingStartedAt) return false;
  if (PRE_COOK_DISALLOWED_STATUSES.has(order.status)) return false;
  if (order.tenantStatuses) {
    for (const stage of Object.values(order.tenantStatuses)) {
      if (PRE_COOK_DISALLOWED_STATUSES.has(stage)) return false;
    }
  }
  return true;
}

export function toOrderBomItems(items: OrderRecord["items"]): OrderItemBOMInput[] {
  return (items || [])
    .filter((item) => !isCoworkingOrderItem(item))
    .map((item) => ({
      productId: item.productId || item.id,
      productName: item.productName,
      quantity: item.quantity,
      modifiers: item.modifiers,
    }));
}

export function resolveNormalizedItemTenantId(
  item: CoworkingIdentifiableItem,
  orderFallbackTenantId?: string
): string {
  if (isCoworkingOrderItem(item)) {
    return "DAGO_HUB";
  }
  const resolved = resolveItemTenantId(item, orderFallbackTenantId);
  return normalizeTenantId(resolved) ?? resolved;
}

export function getOrderWorkflowTenants(
  items: OrderRecord["items"],
  orderFallbackTenantId?: string
): string[] {
  const fnbItems = (items || []).filter((it) => !isCoworkingOrderItem(it));
  const statusItems = fnbItems.length > 0 ? fnbItems : items || [];
  return Array.from(
    new Set(statusItems.map((it) => resolveNormalizedItemTenantId(it, orderFallbackTenantId)))
  );
}

export function projectOrderForTenant(
  order: OrderRecord,
  tenantId: string
): OrderRecord | null {
  const normTenant = normalizeTenantId(tenantId);
  if (!normTenant) return order;

  const orderFallback = (order as { tenantId?: string }).tenantId;
  const matchingItems = order.items.filter(
    (it) => resolveNormalizedItemTenantId(it, orderFallback) === normTenant
  );
  if (matchingItems.length === 0) return null;

  const projectedStatus: OrderStatus =
    order.status !== "CANCELLED" &&
    order.status !== "COMPLETED" &&
    order.tenantStatuses?.[normTenant]
      ? order.tenantStatuses[normTenant]
      : order.status;

  if (matchingItems.length === order.items.length) {
    return projectedStatus === order.status ? order : { ...order, status: projectedStatus };
  }

  const lineTotal = (it: OrderItemRecord) =>
    Math.round((Number(it.unitPrice) || 0) * (Number(it.quantity) || 0));

  const itemBuckets = order.items.map((it) => ({
    isCoworking: isCoworkingOrderItem(it),
    subtotal: lineTotal(it),
    isMatch: resolveNormalizedItemTenantId(it, orderFallback) === normTenant,
  }));

  const breakdown = getOrderTaxBreakdown(order);
  const explicitDiscountSplit =
    order.fnbDiscount !== undefined || order.coworkingDiscount !== undefined
      ? { fnbDiscount: order.fnbDiscount, coworkingDiscount: order.coworkingDiscount }
      : undefined;
  const explicitTaxSplit =
    order.fnbTax !== undefined || order.coworkingTax !== undefined
      ? { fnbTax: order.fnbTax, coworkingTax: order.coworkingTax }
      : undefined;

  const itemDiscounts = allocateCategoryDiscounts(
    itemBuckets,
    breakdown.discount,
    explicitDiscountSplit
  );
  const itemTaxes = allocateCategoryTaxAndService(
    itemBuckets,
    breakdown.pb1,
    breakdown.serviceCharge,
    explicitTaxSplit
  );

  let tenantSubtotal = 0;
  let tenantDiscount = 0;
  let tenantTax = 0;
  let tenantServiceCharge = 0;
  let tenantFnbDiscount = 0;
  let tenantCwDiscount = 0;
  let tenantFnbTax = 0;
  let tenantCwTax = 0;

  itemBuckets.forEach((bucket, idx) => {
    if (!bucket.isMatch) return;
    const disc = Math.min(bucket.subtotal, itemDiscounts[idx] ?? 0);
    const tax = itemTaxes[idx]?.tax ?? 0;
    const svc = itemTaxes[idx]?.serviceCharge ?? 0;
    tenantSubtotal += bucket.subtotal;
    tenantDiscount += disc;
    tenantTax += tax;
    tenantServiceCharge += svc;
    if (bucket.isCoworking) {
      tenantCwDiscount += disc;
      tenantCwTax += tax;
    } else {
      tenantFnbDiscount += disc;
      tenantFnbTax += tax;
    }
  });

  const tenantTotal =
    Math.max(0, tenantSubtotal - tenantDiscount) + tenantTax + tenantServiceCharge;

  return {
    ...order,
    status: projectedStatus,
    items: matchingItems,
    subtotal: tenantSubtotal,
    discount: order.discount !== undefined ? tenantDiscount : undefined,
    ...(order.fnbDiscount !== undefined ? { fnbDiscount: tenantFnbDiscount } : {}),
    ...(order.coworkingDiscount !== undefined ? { coworkingDiscount: tenantCwDiscount } : {}),
    tax: tenantTax,
    ...(order.fnbTax !== undefined ? { fnbTax: tenantFnbTax } : {}),
    ...(order.coworkingTax !== undefined ? { coworkingTax: tenantCwTax } : {}),
    serviceCharge: order.serviceCharge !== undefined ? tenantServiceCharge : undefined,
    total: tenantTotal,
  };
}

export function filterOrdersByTenant(
  orders: OrderRecord[],
  userTenantId?: string,
  isTenantOwner?: boolean
): OrderRecord[] {
  if (!isTenantOwner || !userTenantId) return orders;
  return orders
    .map((o) => projectOrderForTenant(o, userTenantId))
    .filter((o): o is OrderRecord => o !== null);
}

const ORDER_STATUS_LABEL: Partial<Record<OrderRecord["status"], string>> = {
  NEW: "Baru",
  CONFIRMED: "Dikonfirmasi",
  KITCHEN_RECEIVED: "Diterima dapur",
  COOKING: "Dimasak",
  READY: "Siap saji",
  SERVED: "Disajikan",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

export function orderStatusLabel(status: OrderRecord["status"]): string {
  return ORDER_STATUS_LABEL[status] ?? status;
}

export function orderStatusTone(status: OrderRecord["status"]): StatusTone {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "SERVED":
      return "info";
    case "READY":
      return "info";
    case "COOKING":
    case "KITCHEN_RECEIVED":
    case "CONFIRMED":
    case "NEW":
      return "warning";
    case "CANCELLED":
      return "destructive";
    default:
      return "neutral";
  }
}

export function paymentStatusLabel(status: OrderRecord["paymentStatus"]): string {
  switch (status) {
    case "PAID":
      return "Lunas";
    case "REFUNDED":
      return "Dikembalikan";
    default:
      return "Belum dibayar";
  }
}

export function paymentStatusTone(status: OrderRecord["paymentStatus"]): StatusTone {
  switch (status) {
    case "PAID":
      return "success";
    case "REFUNDED":
      return "warning";
    default:
      return "destructive";
  }
}

export function slaStatusTone(slaStatus: string): StatusTone {
  switch (slaStatus) {
    case "COMPLETED":
    case "ON_TIME":
      return "success";
    case "AT_RISK":
      return "warning";
    case "DELAYED":
      return "destructive";
    default:
      return "neutral";
  }
}

const SLA_STATUS_LABEL: Record<string, string> = {
  ON_TIME: "Tepat waktu",
  AT_RISK: "Mendekati target",
  DELAYED: "Lewat target",
};

/** Human label for an SLA status; raw enums never reach the UI. */
export function slaStatusLabel(slaStatus: string): string {
  return SLA_STATUS_LABEL[slaStatus] ?? "—";
}

const PAYMENT_METHOD_LABEL: Record<NonNullable<OrderRecord["paymentMethod"]>, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  EDC: "Kartu (EDC)",
  TRANSFER: "Transfer",
  SPLIT: "Split bill",
  INVOICE: "Invoice (Tempo)",
};

export function paymentMethodLabel(method: OrderRecord["paymentMethod"] | undefined): string {
  return method ? PAYMENT_METHOD_LABEL[method] : "—";
}

export function buildReprintKitchenTicket(
  order: OrderRecord,
  purpose: PrintPurpose = "REPRINT",
  cashierName?: string,
  tenantId?: string
): KitchenTicketData {
  const normTenant = normalizeTenantId(tenantId);
  const orderFallback = (order as { tenantId?: string }).tenantId;
  const fnbItems: OrderItemRecord[] = (order.items || []).filter(
    (i) => !isCoworkingOrderItem(i)
  );
  const scopedItems: OrderItemRecord[] = normTenant
    ? fnbItems.filter(
        (i) => resolveNormalizedItemTenantId(i, orderFallback) === normTenant
      )
    : fnbItems;

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    outletId: order.outletId,
    outletName: order.outletName || "Singaraja",
    tableNumber: order.tableNumber,
    customerName: order.customerName,
    orderType: order.orderType,
    purpose,
    items: scopedItems.map((i) => {
      const resolvedTenant = resolveNormalizedItemTenantId(i, orderFallback);
      return {
        id: i.id,
        productName: i.productName,
        quantity: i.quantity,
        modifiers: i.modifiers,
        notes: i.notes,
        tenantId: resolvedTenant,
        tenantName: getTenantName(resolvedTenant),
        itemType: i.itemType ?? "FNB",
      };
    }),
    cashierName: cashierName || order.cashierName || "Kasir / Petugas",
    timestamp: `${new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit" })} WITA`,
    reprintedBy: purpose === "REPRINT" ? cashierName || "Petugas" : undefined,
    kitchenNotes: order.notes,
  };
}

export function buildOrderReceiptData(order: OrderRecord): POSReceiptData {
  const orderFallback = (order as { tenantId?: string }).tenantId;
  const mappedItems = (order.items || []).map((i) => {
    const isCoworking = isCoworkingOrderItem(i);
    const resolvedTenant = isCoworking
      ? "DAGO_HUB"
      : resolveNormalizedItemTenantId(i, orderFallback);
    const resolvedTenantName = isCoworking
      ? i.tenantName || "Dago Creative Hub (Co-Working)"
      : i.tenantName || getTenantName(resolvedTenant);
    return {
      name: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      subtotal: i.quantity * i.unitPrice,
      modifiers: i.modifiers,
      notes: i.notes,
      tenantId: resolvedTenant,
      tenantName: resolvedTenantName,
      itemType: i.itemType ?? (isCoworking ? ("COWORKING" as const) : undefined),
      category: i.category,
      coworkingMeta: i.coworkingMeta,
    };
  });

  const allCoworking =
    mappedItems.length > 0 && mappedItems.every((i) => isCoworkingOrderItem(i));
  const primaryTenantId =
    mappedItems[0]?.tenantId ||
    resolveNormalizedItemTenantId(order.items[0] || {}, orderFallback) ||
    "tenant-ks";
  const posPublisher = allCoworking
    ? resolveCoworkingReceiptPublisher({ name: order.outletName || "Singaraja (Pusat)" })
    : resolvePosReceiptPublisher(
        mappedItems.map((i) => ({ tenantId: i.tenantId, tenantName: i.tenantName })),
        { name: order.outletName || "Singaraja (Pusat)" },
        primaryTenantId
      );

  const splitDetails: SplitGuestBill[] | undefined = order.splitDetails?.length
    ? order.splitDetails.map((s, idx) => ({
        id: `split-${idx + 1}`,
        guestLabel: s.label || `Tamu ${s.guestNumber}`,
        assignedAmount: s.amount,
        paymentMethod: (s.method === "CASH" || s.method === "EDC" ? s.method : "QRIS") as SplitGuestBill["paymentMethod"],
        isPaid: true,
      }))
    : undefined;

  return {
    orderNumber: order.orderNumber,
    date: new Date(order.createdAt).toLocaleDateString("id-ID", {
      timeZone: "Asia/Makassar",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    cashierName: order.cashierName || "Kasir",
    tenantId: allCoworking ? "DAGO_HUB" : posPublisher.tenantId || primaryTenantId,
    tenantName: posPublisher.brandName,
    brandName: posPublisher.brandName,
    tagline: posPublisher.tagline,
    outletName: posPublisher.outletName,
    outletAddress: posPublisher.outletAddress,
    outletPhone: posPublisher.outletPhone,
    tableNumber: order.tableNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    orderType: (order.orderType as POSReceiptData["orderType"]) || "DINE_IN",
    items: mappedItems,
    subtotal: order.subtotal,
    tax: getOrderTaxBreakdown(order).pb1,
    fnbTax: order.fnbTax,
    coworkingTax: order.coworkingTax,
    serviceCharge: getOrderTaxBreakdown(order).serviceCharge,
    promoName: order.promoId,
    discount: getOrderTaxBreakdown(order).discount,
    fnbDiscount: order.fnbDiscount,
    coworkingDiscount: order.coworkingDiscount,
    grandTotal: order.total,
    paymentMethod: (order.paymentMethod as POSReceiptData["paymentMethod"]) || "QRIS",
    amountPaid: order.total,
    changeDue: 0,
    splitDetails,
    corporateInfo: order.corporateInfo,
    qrisVerification: order.qrisVerification
      ? {
          type: order.qrisVerification.type,
          referenceNumber: order.qrisVerification.referenceNumber,
          invoiceNumber: order.qrisVerification.invoiceNumber,
          supervisorPinVerified: order.qrisVerification.supervisorPinVerified,
          verifiedAt: order.qrisVerification.verifiedAt,
          note: order.qrisVerification.note,
        }
      : undefined,
  };
}

export function buildOrderExportData(
  orders: OrderRecord[],
  promos: Array<{ id: string; name?: string }>
): { headers: string[]; rows: (string | number)[][] } {
  const headers = [
    "No. Pesanan",
    "Meja",
    "Pelanggan",
    "Tipe Pesanan",
    "Promo",
    "Diskon (Rp)",
    "Total Tagihan (Rp)",
    "Status Operasional",
    "Status Pembayaran",
    "Metode Pembayaran",
    "Jumlah Item",
    "Waktu Dibuat",
    "Waktu Pelunasan",
  ];

  const rows = orders.map((o) => {
    const promoName = promos.find((p) => p.id === o.promoId)?.name || o.promoId || "-";
    const discountVal = getOrderTaxBreakdown(o).discount;
    const opStatusLabel = orderStatusLabel(o.status);
    const payStatusLabel = paymentStatusLabel(o.paymentStatus);

    const settlementTime = o.completedAt
      ? new Date(o.completedAt).toLocaleString("id-ID", { timeZone: "Asia/Makassar" })
      : o.paymentStatus === "PAID"
        ? new Date(o.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Makassar" })
        : "-";

    return [
      o.orderNumber,
      o.tableNumber,
      o.customerName,
      o.orderType,
      promoName,
      discountVal > 0 ? `-Rp ${discountVal.toLocaleString("id-ID")}` : "Rp 0",
      `Rp ${o.total.toLocaleString("id-ID")}`,
      opStatusLabel,
      payStatusLabel,
      o.paymentMethod || "-",
      o.items.length,
      new Date(o.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Makassar" }),
      settlementTime,
    ];
  });

  return { headers, rows };
}

export function formatOrderCustomerName(order: {
  customerName?: string;
  corporateInfo?: import("@/types/order").CorporateOrderInfo;
}): string {
  if (order.corporateInfo?.companyName?.trim()) {
    const comp = order.corporateInfo.companyName.trim();
    const pic = order.corporateInfo.picName?.trim();
    return pic ? `${comp} (PIC: ${pic})` : comp;
  }
  return order.customerName || "-";
}

