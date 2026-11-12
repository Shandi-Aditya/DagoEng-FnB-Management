import { describe, expect, it } from "vitest";

import { countByQueue, emptyQueueMessage, ORDER_QUEUES, ordersInQueue, searchOrders } from "@/features/orders/orders-queue";
import type { OrderRecord } from "@/types/order";

function order(id: string, overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id,
    orderNumber: `ORD-${id}`,
    tableNumber: "T-01",
    customerName: "Budi",
    orderType: "DINE_IN",
    status: "NEW",
    paymentStatus: "PENDING",
    items: [],
    total: 10000,
    createdAt: "2026-11-12T10:00:00Z",
    ...overrides,
  } as OrderRecord;
}

const ORDERS = [
  order("a", { status: "COOKING", paymentStatus: "PENDING", createdAt: "2026-11-12T10:05:00Z" }),
  order("b", { status: "SERVED", paymentStatus: "PENDING", createdAt: "2026-11-12T09:50:00Z" }),
  order("c", { status: "COMPLETED", paymentStatus: "PAID", createdAt: "2026-11-12T09:00:00Z" }),
  order("d", { status: "CANCELLED", paymentStatus: "PENDING", createdAt: "2026-11-12T08:00:00Z" }),
  order("e", { status: "READY", paymentStatus: "PAID", createdAt: "2026-11-12T10:10:00Z" }),
];

describe("ordersInQueue", () => {
  it("lists unpaid, not cancelled orders oldest first so the longest wait is on top", () => {
    expect(ordersInQueue(ORDERS, "UNPAID").map((o) => o.id)).toEqual(["b", "a"]);
  });

  it("lists orders still being prepared, oldest first", () => {
    expect(ordersInQueue(ORDERS, "IN_PROGRESS").map((o) => o.id)).toEqual(["a", "e"]);
  });

  it("lists finished and cancelled orders newest first", () => {
    expect(ordersInQueue(ORDERS, "DONE").map((o) => o.id)).toEqual(["c"]);
    expect(ordersInQueue(ORDERS, "CANCELLED").map((o) => o.id)).toEqual(["d"]);
    expect(ordersInQueue(ORDERS, "ALL").map((o) => o.id)).toEqual(["e", "a", "b", "c", "d"]);
  });

  it("does not reorder the input", () => {
    const before = ORDERS.map((o) => o.id);
    ordersInQueue(ORDERS, "UNPAID");
    expect(ORDERS.map((o) => o.id)).toEqual(before);
  });
});

describe("countByQueue", () => {
  it("counts every queue so tabs can show a number", () => {
    expect(countByQueue(ORDERS)).toEqual({ ALL: 5, UNPAID: 2, IN_PROGRESS: 2, DONE: 1, CANCELLED: 1 });
  });

  it("exposes queues in tab order", () => {
    expect(ORDER_QUEUES.map((q) => q.id)).toEqual(["UNPAID", "IN_PROGRESS", "DONE", "CANCELLED", "ALL"]);
  });
});

describe("searchOrders", () => {
  it("matches order number, table and customer, ignoring case and spaces", () => {
    const list = [order("1", { orderNumber: "ORD-0912" }), order("2", { tableNumber: "VIP-2" }), order("3", { customerName: "Sari Dewi" })];
    expect(searchOrders(list, "0912").map((o) => o.id)).toEqual(["1"]);
    expect(searchOrders(list, "vip").map((o) => o.id)).toEqual(["2"]);
    expect(searchOrders(list, "  sari ").map((o) => o.id)).toEqual(["3"]);
    expect(searchOrders(list, "")).toHaveLength(3);
  });
});

describe("emptyQueueMessage", () => {
  it("says the queue is clear instead of blaming the filter", () => {
    expect(emptyQueueMessage("UNPAID", false).title).toBe("Tidak ada pesanan yang perlu dibayar");
    expect(emptyQueueMessage("ALL", false).title).toBe("Belum ada pesanan");
  });

  it("points at the search when a query hides results", () => {
    expect(emptyQueueMessage("UNPAID", true).title).toBe("Tidak ada pesanan yang cocok");
  });
});
