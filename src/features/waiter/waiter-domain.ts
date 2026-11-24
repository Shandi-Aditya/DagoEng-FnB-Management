import type { TableItem, TableStatus } from "@/contexts/TableContext";
import type { OrderRecord, OrderStatus } from "@/types/order";

export interface TableStatusDisplay {
  label: string;
  tone: "success" | "warning" | "destructive" | "neutral" | "info";
}

export interface TableLifecycleAction {
  nextStatus: TableStatus;
  label: string;
  variant: "default" | "outline";
}

export interface WaiterFloorSummary {
  total: number;
  available: number;
  occupied: number;
  billing: number;
  cleaning: number;
  reserved: number;
}

export interface KitchenPrepStatusDisplay {
  label: string;
  tone: "info" | "warning" | "success" | "neutral";
}

export interface AreaWithTables {
  id: string;
  name: string;
  tables: TableItem[];
}

/**
 * Returns human-friendly Indonesian label and StatusBadge tone for a table status.
 */
export function getTableStatusDisplay(status: TableStatus): TableStatusDisplay {
  switch (status) {
    case "AVAILABLE":
      return { label: "Tersedia", tone: "neutral" };
    case "OCCUPIED":
      return { label: "Terisi", tone: "destructive" };
    case "BILLING":
      return { label: "Menunggu tagihan", tone: "warning" };
    case "CLEANING":
      return { label: "Dibersihkan", tone: "info" };
    case "RESERVED":
      return { label: "Reservasi", tone: "warning" };
    default:
      return { label: status, tone: "neutral" };
  }
}

/**
 * Deterministic State Machine for waiter table lifecycle:
 * AVAILABLE -> OCCUPIED -> BILLING -> CLEANING -> AVAILABLE
 * RESERVED -> OCCUPIED
 */
export function getTableLifecycleAction(status: TableStatus): TableLifecycleAction {
  switch (status) {
    case "AVAILABLE":
      return {
        nextStatus: "OCCUPIED",
        label: "Dudukkan tamu",
        variant: "default",
      };
    case "RESERVED":
      return {
        nextStatus: "OCCUPIED",
        label: "Dudukkan tamu reservasi",
        variant: "default",
      };
    case "OCCUPIED":
      return {
        nextStatus: "BILLING",
        label: "Minta tagihan",
        variant: "outline",
      };
    case "BILLING":
      return {
        nextStatus: "CLEANING",
        label: "Tandai meja dibersihkan",
        variant: "outline",
      };
    case "CLEANING":
      return {
        nextStatus: "AVAILABLE",
        label: "Selesai dibersihkan",
        variant: "default",
      };
    default:
      return {
        nextStatus: "AVAILABLE",
        label: "Perbarui status",
        variant: "outline",
      };
  }
}

/**
 * Calculates floor summary counts across all given tables.
 */
export function calculateWaiterFloorSummary(tables: TableItem[]): WaiterFloorSummary {
  let available = 0;
  let occupied = 0;
  let billing = 0;
  let cleaning = 0;
  let reserved = 0;

  for (const t of tables) {
    switch (t.status) {
      case "AVAILABLE":
        available++;
        break;
      case "OCCUPIED":
        occupied++;
        break;
      case "BILLING":
        billing++;
        break;
      case "CLEANING":
        cleaning++;
        break;
      case "RESERVED":
        reserved++;
        break;
    }
  }

  return {
    total: tables.length,
    available,
    occupied,
    billing,
    cleaning,
    reserved,
  };
}

/**
 * Filter tables for an area, or return all when areaId is "ALL".
 */
export function filterTablesByArea(
  areas: AreaWithTables[],
  areaId: string
): TableItem[] {
  if (areaId === "ALL") {
    return areas.flatMap((a) => a.tables);
  }
  const area = areas.find((a) => a.id === areaId);
  return area ? area.tables : [];
}

/**
 * Formats kitchen preparation status for waiter floor visibility.
 */
export function formatKitchenPrepStatus(status: OrderStatus | undefined): KitchenPrepStatusDisplay {
  switch (status) {
    case "COOKING":
      return { label: "Dimasak", tone: "warning" };
    case "READY":
      return { label: "Siap saji", tone: "success" };
    case "NEW":
    case "CONFIRMED":
    case "KITCHEN_RECEIVED":
      return { label: "Antre", tone: "info" };
    case "SERVED":
    case "COMPLETED":
      return { label: "Selesai", tone: "neutral" };
    default:
      return { label: "Diproses", tone: "neutral" };
  }
}

/**
 * Finds an active non-completed/non-cancelled order assigned to a table.
 */
export function findActiveOrderForTable(
  orders: OrderRecord[],
  tableNumber: string,
  tableId: string,
  outletId: string
): OrderRecord | undefined {
  return orders.find(
    (o) =>
      (o.tableNumber === tableNumber || o.tableNumber === tableId) &&
      o.outletId === outletId &&
      o.status !== "COMPLETED" &&
      o.status !== "CANCELLED"
  );
}

/**
 * Detects newly ready orders for floor waiters to serve to guests.
 * Includes paid or corporate invoice orders in READY status for the outlet that have not yet been dismissed.
 */
export function getReadyWaiterOrders(
  orders: readonly OrderRecord[],
  outletId: string,
  dismissedIds: ReadonlySet<string> = new Set()
): OrderRecord[] {
  return orders
    .filter(
      (o) =>
        o.status === "READY" &&
        (o.paymentStatus === "PAID" ||
          ((o.paymentMethod === "INVOICE" || o.corporateInfo?.billingType === "INVOICE") &&
            o.paymentStatus !== "REFUNDED")) &&
        (!outletId || outletId === "ALL" || o.outletId === outletId) &&
        !dismissedIds.has(o.id)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
