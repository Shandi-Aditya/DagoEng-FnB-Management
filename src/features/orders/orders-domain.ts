import type { StatusTone } from "@/components/app/status-badge";
import type { POSReceiptData, SplitGuestBill } from "@/features/pos/types";
import { resolvePosReceiptPublisher } from "@/lib/receipt-publisher";
import { resolveItemTenantId } from "@/lib/settlement";
import { getOrderTaxBreakdown } from "@/lib/tax-breakdown";
import { getTenantName } from "@/lib/tenant";
import type { OrderItemRecord, OrderRecord, OrderStatus } from "@/types/order";
import type { KitchenTicketData, PrintPurpose } from "@/types/printer";

const TENANT_ID_ALIASES: Record<string, string> = {
  "tenant-kopi-senja": "tenant-ks",
  "tenant-dapur-mama": "tenant-kitchen",
  "tenant-manis-bakery": "tenant-bakery",
  "tenant-teh-nusantara": "tenant-tea",
};

export function normalizeTenantId(tenantId?: string | null): string | undefined {
  const trimmed = tenantId?.trim();
  if (!trimmed) return undefined;
  return TENANT_ID_ALIASES[trimmed] ?? trimmed;
}

export function resolveNormalizedItemTenantId(
  item: { tenantId?: string; productId?: string; productName?: string },
  orderFallbackTenantId?: string
): string {
  const resolved = resolveItemTenantId(item, orderFallbackTenantId);
  return normalizeTenantId(resolved) ?? resolved;
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

  const totalGross = order.items.reduce(
    (sum, it) => sum + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0),
    0
  );
  const tenantSubtotal = Math.round(
    matchingItems.reduce(
      (sum, it) => sum + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0),
      0
    )
  );
  const ratio = totalGross > 0 ? tenantSubtotal / totalGross : 0;
  const breakdown = getOrderTaxBreakdown(order);
  const tenantDiscount = Math.round(breakdown.discount * ratio);
  const tenantTax = Math.round(breakdown.pb1 * ratio);
  const tenantServiceCharge = Math.round(breakdown.serviceCharge * ratio);
  const tenantTotal =
    Math.max(0, tenantSubtotal - tenantDiscount) + tenantTax + tenantServiceCharge;

  return {
    ...order,
    status: projectedStatus,
    items: matchingItems,
    subtotal: tenantSubtotal,
    discount: order.discount !== undefined ? tenantDiscount : undefined,
    tax: tenantTax,
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
  const scopedItems: OrderItemRecord[] = normTenant
    ? (order.items || []).filter(
        (i) => resolveNormalizedItemTenantId(i, orderFallback) === normTenant
      )
    : order.items || [];

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
      };
    }),
    cashierName: cashierName || order.cashierName || "Kasir / Petugas",
    timestamp: `${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WITA`,
    reprintedBy: purpose === "REPRINT" ? cashierName || "Petugas" : undefined,
    kitchenNotes: order.notes,
  };
}

export function buildOrderReceiptData(order: OrderRecord): POSReceiptData {
  const primaryTenantId =
    resolveNormalizedItemTenantId(order.items[0] || {}, (order as { tenantId?: string }).tenantId) ||
    "tenant-ks";
  const posPublisher = resolvePosReceiptPublisher(
    order.items.map((i) => ({ tenantId: resolveNormalizedItemTenantId(i) })),
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
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    cashierName: order.cashierName || "Kasir",
    tenantId: posPublisher.tenantId || primaryTenantId,
    tenantName: posPublisher.brandName,
    outletName: posPublisher.outletName,
    outletAddress: posPublisher.outletAddress,
    outletPhone: posPublisher.outletPhone,
    tableNumber: order.tableNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    orderType: (order.orderType as POSReceiptData["orderType"]) || "DINE_IN",
    items: order.items.map((i) => {
      const resolvedTenant = resolveNormalizedItemTenantId(i);
      return {
        name: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.quantity * i.unitPrice,
        modifiers: i.modifiers,
        notes: i.notes,
        tenantId: resolvedTenant,
        tenantName: getTenantName(resolvedTenant),
      };
    }),
    subtotal: order.subtotal,
    tax: getOrderTaxBreakdown(order).pb1,
    serviceCharge: getOrderTaxBreakdown(order).serviceCharge,
    promoName: order.promoId,
    discount: getOrderTaxBreakdown(order).discount,
    grandTotal: order.total,
    paymentMethod: (order.paymentMethod as POSReceiptData["paymentMethod"]) || "QRIS",
    amountPaid: order.total,
    changeDue: 0,
    splitDetails,
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
      ? new Date(o.completedAt).toLocaleString("id-ID")
      : o.paymentStatus === "PAID"
        ? new Date(o.createdAt).toLocaleString("id-ID")
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
      new Date(o.createdAt).toLocaleString("id-ID"),
      settlementTime,
    ];
  });

  return { headers, rows };
}
