import type { StatusTone } from "@/components/app/status-badge";
import type { POSReceiptData } from "@/features/pos/types";
import { resolvePosReceiptPublisher } from "@/lib/receipt-publisher";
import { getOrderTaxBreakdown } from "@/lib/tax-breakdown";
import { getTenantName } from "@/lib/tenant";
import type { OrderRecord } from "@/types/order";
import type { KitchenTicketData, PrintPurpose } from "@/types/printer";

export function filterOrdersByTenant(
  orders: OrderRecord[],
  userTenantId?: string,
  isTenantOwner?: boolean
): OrderRecord[] {
  if (!isTenantOwner || !userTenantId) return orders;
  return orders.filter((o) => o.items.some((it) => it.tenantId === userTenantId));
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
  cashierName?: string
): KitchenTicketData {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    outletId: order.outletId,
    outletName: order.outletName || "Singaraja",
    tableNumber: order.tableNumber,
    customerName: order.customerName,
    orderType: order.orderType,
    purpose,
    items: (order.items || []).map((i) => ({
      id: i.id,
      productName: i.productName,
      quantity: i.quantity,
      modifiers: i.modifiers,
      notes: i.notes,
    })),
    cashierName: cashierName || "Kasir / Petugas",
    timestamp: `${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WITA`,
    reprintedBy: purpose === "REPRINT" ? cashierName || "Petugas" : undefined,
    kitchenNotes: order.notes,
  };
}

export function buildOrderReceiptData(order: OrderRecord): POSReceiptData {
  const primaryTenantId = order.items[0]?.tenantId || "tenant-ks";
  const posPublisher = resolvePosReceiptPublisher(
    order.items.map((i) => ({ tenantId: i.tenantId })),
    { name: order.outletName || "Singaraja (Pusat)" },
    primaryTenantId
  );

  return {
    orderNumber: order.orderNumber,
    date: new Date(order.createdAt).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    cashierName: "Kasir",
    tenantId: posPublisher.tenantId || primaryTenantId,
    tenantName: posPublisher.brandName,
    outletName: posPublisher.outletName,
    outletAddress: posPublisher.outletAddress,
    outletPhone: posPublisher.outletPhone,
    tableNumber: order.tableNumber,
    customerName: order.customerName,
    orderType: (order.orderType as any) || "DINE_IN",
    items: order.items.map((i) => ({
      name: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      subtotal: i.quantity * i.unitPrice,
      modifiers: i.modifiers,
      notes: i.notes,
      tenantId: i.tenantId,
      tenantName: getTenantName(i.tenantId),
    })),
    subtotal: order.subtotal,
    tax: getOrderTaxBreakdown(order).pb1,
    serviceCharge: getOrderTaxBreakdown(order).serviceCharge,
    promoName: order.promoId,
    discount: getOrderTaxBreakdown(order).discount,
    grandTotal: order.total,
    paymentMethod: (order.paymentMethod as any) || "QRIS",
    amountPaid: order.total,
    changeDue: 0,
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
