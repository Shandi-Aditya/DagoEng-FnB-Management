import type { OrderRecord } from "@/types/order";

export type OrderQueueId = "UNPAID" | "IN_PROGRESS" | "DONE" | "CANCELLED" | "ALL";

interface OrderQueue {
  id: OrderQueueId;
  label: string;
  /** Waiting queues read oldest first; history reads newest first. */
  order: "oldest" | "newest";
  matches: (order: OrderRecord) => boolean;
}

const KITCHEN_STATUSES = new Set<OrderRecord["status"]>(["NEW", "CONFIRMED", "KITCHEN_RECEIVED", "COOKING", "READY"]);

export const ORDER_QUEUES: readonly OrderQueue[] = [
  {
    id: "UNPAID",
    label: "Perlu dibayar",
    order: "oldest",
    matches: (o) => o.paymentStatus !== "PAID" && o.paymentStatus !== "REFUNDED" && o.status !== "CANCELLED",
  },
  { id: "IN_PROGRESS", label: "Diproses", order: "oldest", matches: (o) => KITCHEN_STATUSES.has(o.status) },
  { id: "DONE", label: "Selesai", order: "newest", matches: (o) => o.status === "COMPLETED" },
  { id: "CANCELLED", label: "Dibatalkan", order: "newest", matches: (o) => o.status === "CANCELLED" },
  { id: "ALL", label: "Semua", order: "newest", matches: () => true },
];

const createdAt = (o: OrderRecord) => new Date(o.createdAt).getTime();

function queueById(id: OrderQueueId): OrderQueue {
  return ORDER_QUEUES.find((queue) => queue.id === id) ?? ORDER_QUEUES[ORDER_QUEUES.length - 1];
}

/** Orders in one queue, sorted for that queue. `filter` copies, so the input is never reordered. */
export function ordersInQueue(orders: readonly OrderRecord[], id: OrderQueueId): OrderRecord[] {
  const queue = queueById(id);
  const direction = queue.order === "oldest" ? 1 : -1;
  return orders.filter(queue.matches).sort((a, b) => (createdAt(a) - createdAt(b)) * direction);
}

export function countByQueue(orders: readonly OrderRecord[]): Record<OrderQueueId, number> {
  return ORDER_QUEUES.reduce(
    (counts, queue) => ({ ...counts, [queue.id]: orders.filter(queue.matches).length }),
    {} as Record<OrderQueueId, number>,
  );
}

/** Case-insensitive match on order number, table and customer name. */
export function searchOrders(orders: readonly OrderRecord[], query: string): OrderRecord[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...orders];
  return orders.filter((o) =>
    [o.orderNumber, o.tableNumber, o.customerName].some((field) => field?.toLowerCase().includes(needle)),
  );
}

const EMPTY_QUEUE: Record<OrderQueueId, { title: string; description: string }> = {
  UNPAID: { title: "Tidak ada pesanan yang perlu dibayar", description: "Semua pesanan aktif sudah lunas." },
  IN_PROGRESS: { title: "Dapur sedang kosong", description: "Pesanan baru akan muncul di sini sampai siap disajikan." },
  DONE: { title: "Belum ada pesanan selesai", description: "Pesanan yang sudah dibayar dan disajikan akan muncul di sini." },
  CANCELLED: { title: "Tidak ada pesanan batal", description: "Pesanan yang dibatalkan akan tercatat di sini." },
  ALL: { title: "Belum ada pesanan", description: "Pesanan dari POS dan self-order akan muncul di sini." },
};

/** Empty-state copy: an empty queue is good news; an empty search is a filter problem. */
export function emptyQueueMessage(id: OrderQueueId, hasSearch: boolean): { title: string; description: string } {
  if (hasSearch) return { title: "Tidak ada pesanan yang cocok", description: "Ubah kata kunci atau pilih antrean lain." };
  return EMPTY_QUEUE[id];
}
