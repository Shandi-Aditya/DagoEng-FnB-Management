import type { StatusTone } from "@/components/app/status-badge";
import type { OrderItemRecord, OrderRecord, OrderStatus, SLAStatus } from "@/types/order";
import type { KitchenTicketData } from "@/types/printer";

export type KitchenTypeFilter = "ALL" | "DINE_IN" | "TAKEAWAY_DELIVERY";
export type KitchenStation = "ALL" | "BARISTA" | "KITCHEN" | "PASTRY";

export interface KitchenFilters {
  tenantId?: string;
  type: KitchenTypeFilter;
  station: KitchenStation;
  multiStation: boolean;
}

export interface KdsColumn {
  statuses: readonly OrderStatus[];
  title: string;
  tone: StatusTone;
  nextStatus: OrderStatus;
  nextLabel: string;
}

export const KDS_COLUMNS: readonly KdsColumn[] = [
  { statuses: ["NEW", "CONFIRMED"], title: "Baru", tone: "info", nextStatus: "KITCHEN_RECEIVED", nextLabel: "Terima" },
  { statuses: ["KITCHEN_RECEIVED"], title: "Antre", tone: "neutral", nextStatus: "COOKING", nextLabel: "Mulai masak" },
  { statuses: ["COOKING"], title: "Dimasak", tone: "warning", nextStatus: "READY", nextLabel: "Selesai" },
  { statuses: ["READY"], title: "Siap saji", tone: "success", nextStatus: "SERVED", nextLabel: "Sajikan" },
];

export const TYPE_FILTERS: readonly { value: KitchenTypeFilter; label: string }[] = [
  { value: "ALL", label: "Semua" },
  { value: "DINE_IN", label: "Dine in" },
  { value: "TAKEAWAY_DELIVERY", label: "Takeaway dan delivery" },
];

export const STATION_FILTERS: readonly { value: KitchenStation; label: string }[] = [
  { value: "ALL", label: "Semua stasiun" },
  { value: "BARISTA", label: "Barista" },
  { value: "KITCHEN", label: "Dapur panas" },
  { value: "PASTRY", label: "Pastry" },
];

const ACTIVE_STATUSES = new Set<OrderStatus>(KDS_COLUMNS.flatMap((column) => column.statuses));
const BARISTA_KEYWORDS = ["kopi", "tea", "latte", "espresso", "ice", "matcha"];
const PASTRY_KEYWORDS = ["croissant", "pastry", "cake", "toast"];

function includesAny(name: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => name.includes(keyword));
}

/** Station an item is prepared at, guessed from its name. Hot kitchen is everything else. */
export function stationFor(productName: string): Exclude<KitchenStation, "ALL"> {
  const name = productName.toLowerCase();
  if (includesAny(name, BARISTA_KEYWORDS)) return "BARISTA";
  if (includesAny(name, PASTRY_KEYWORDS)) return "PASTRY";
  return "KITCHEN";
}

/** Items a kitchen should see on a ticket: a tenant only sees its own. */
export function ticketItems(order: OrderRecord, tenantId: string | undefined): OrderItemRecord[] {
  return tenantId ? order.items.filter((item) => item.tenantId === tenantId) : order.items;
}

function matchesType(order: OrderRecord, type: KitchenTypeFilter): boolean {
  if (type === "ALL") return true;
  if (type === "DINE_IN") return order.orderType === "DINE_IN";
  return order.orderType === "TAKEAWAY" || order.orderType === "DELIVERY";
}

/** Active tickets for the board, oldest first so the queue is served FIFO. */
export function filterKitchenOrders(orders: readonly OrderRecord[], filters: KitchenFilters): OrderRecord[] {
  return orders
    .filter((order) => ACTIVE_STATUSES.has(order.status))
    .filter((order) => ticketItems(order, filters.tenantId).length > 0)
    .filter((order) => matchesType(order, filters.type))
    .filter((order) => {
      if (!filters.multiStation || filters.station === "ALL") return true;
      return ticketItems(order, filters.tenantId).some((item) => stationFor(item.productName) === filters.station);
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/** Kitchen ticket payload for a reprint; the queue number matches the board. */
export function buildReprintTicket(
  order: OrderRecord,
  items: readonly OrderItemRecord[],
  queueNumber: number,
  timestamp: string,
): KitchenTicketData {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    outletId: order.outletId,
    outletName: order.outletName || "Singaraja",
    tableNumber: order.tableNumber,
    customerName: order.customerName,
    orderType: order.orderType,
    purpose: "REPRINT",
    sequenceNumber: queueNumber,
    items: items.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      modifiers: item.modifiers,
      notes: item.notes,
    })),
    cashierName: "Dapur KDS",
    timestamp,
    reprintedBy: "Kitchen Staff",
    kitchenNotes: order.notes,
  };
}

const ORDER_TYPE_LABEL: Record<OrderRecord["orderType"], string> = {
  DINE_IN: "Dine in",
  TAKEAWAY: "Takeaway",
  DELIVERY: "Delivery",
};

export function orderTypeLabel(type: OrderRecord["orderType"]): string {
  return ORDER_TYPE_LABEL[type];
}

const SLA_TONE: Record<SLAStatus, StatusTone> = {
  ON_TIME: "success",
  AT_RISK: "warning",
  DELAYED: "destructive",
};

export function slaTone(status: SLAStatus): StatusTone {
  return SLA_TONE[status];
}
