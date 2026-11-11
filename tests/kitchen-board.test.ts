import { describe, expect, it } from "vitest";

import {
  KDS_COLUMNS,
  buildReprintTicket,
  filterKitchenOrders,
  orderTypeLabel,
  slaTone,
  ticketItems,
} from "@/features/kitchen/kitchen-board";
import type { OrderItemRecord, OrderRecord } from "@/types/order";

function item(productName: string, tenantId = "tenant-a"): OrderItemRecord {
  return { id: `it-${productName}`, productName, quantity: 1, unitPrice: 10000, tenantId };
}

function order(id: string, overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id,
    orderNumber: `ORD-${id}`,
    organizationId: "org",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tableNumber: "T-01",
    customerName: "Tamu",
    orderType: "DINE_IN",
    status: "NEW",
    items: [item("Nasi goreng")],
    subtotal: 10000,
    tax: 1000,
    total: 11000,
    paymentStatus: "PAID",
    targetServiceMinutes: 10,
    createdAt: "2026-11-11T10:00:00Z",
    ...overrides,
  } as OrderRecord;
}

const ALL_FILTERS = { type: "ALL", station: "ALL", multiStation: false } as const;

describe("filterKitchenOrders", () => {
  it("keeps only active kitchen statuses, oldest first (FIFO)", () => {
    const orders = [
      order("late", { createdAt: "2026-11-11T10:05:00Z", status: "COOKING" }),
      order("served", { status: "SERVED" }),
      order("early", { createdAt: "2026-11-11T09:55:00Z", status: "READY" }),
      order("paid", { status: "COMPLETED" as OrderRecord["status"] }),
    ];

    expect(filterKitchenOrders(orders, ALL_FILTERS).map((o) => o.id)).toEqual(["early", "late"]);
  });

  it("matches takeaway and delivery under the takeaway filter", () => {
    const orders = [
      order("dine"),
      order("take", { orderType: "TAKEAWAY" }),
      order("deliv", { orderType: "DELIVERY" }),
    ];

    expect(filterKitchenOrders(orders, { ...ALL_FILTERS, type: "TAKEAWAY_DELIVERY" }).map((o) => o.id)).toEqual([
      "take",
      "deliv",
    ]);
    expect(filterKitchenOrders(orders, { ...ALL_FILTERS, type: "DINE_IN" }).map((o) => o.id)).toEqual(["dine"]);
  });

  it("hides tickets without items for the signed-in tenant", () => {
    const orders = [order("mine"), order("theirs", { items: [item("Roti", "tenant-b")] })];

    expect(filterKitchenOrders(orders, { ...ALL_FILTERS, tenantId: "tenant-a" }).map((o) => o.id)).toEqual(["mine"]);
  });

  it("routes items to stations only when multi-station is active", () => {
    const orders = [
      order("coffee", { items: [item("Kopi Senja Aren")] }),
      order("pastry", { items: [item("Butter Croissant")] }),
      order("hot", { items: [item("Beef Bowl")] }),
    ];

    expect(filterKitchenOrders(orders, { ...ALL_FILTERS, station: "BARISTA" })).toHaveLength(3);
    expect(filterKitchenOrders(orders, { ...ALL_FILTERS, station: "BARISTA", multiStation: true }).map((o) => o.id)).toEqual(["coffee"]);
    expect(filterKitchenOrders(orders, { ...ALL_FILTERS, station: "PASTRY", multiStation: true }).map((o) => o.id)).toEqual(["pastry"]);
    expect(filterKitchenOrders(orders, { ...ALL_FILTERS, station: "KITCHEN", multiStation: true }).map((o) => o.id)).toEqual(["hot"]);
  });

  it("does not reorder the input array", () => {
    const orders = [order("b", { createdAt: "2026-11-11T10:05:00Z" }), order("a", { createdAt: "2026-11-11T09:00:00Z" })];
    filterKitchenOrders(orders, ALL_FILTERS);
    expect(orders.map((o) => o.id)).toEqual(["b", "a"]);
  });
});

describe("ticket helpers", () => {
  it("shows only the tenant's own items on a shared ticket", () => {
    const shared = order("x", { items: [item("Kopi", "tenant-a"), item("Roti", "tenant-b")] });
    expect(ticketItems(shared, "tenant-b").map((i) => i.productName)).toEqual(["Roti"]);
    expect(ticketItems(shared, undefined)).toHaveLength(2);
  });

  it("builds a reprint ticket that carries the visible queue number", () => {
    const o = order("x", { notes: "Tanpa es" });
    const ticket = buildReprintTicket(o, o.items, 3, "10.00.00 WITA");

    expect(ticket).toMatchObject({
      orderId: "x",
      purpose: "REPRINT",
      sequenceNumber: 3,
      kitchenNotes: "Tanpa es",
      timestamp: "10.00.00 WITA",
    });
    expect(ticket.items).toEqual([{ id: "it-Nasi goreng", productName: "Nasi goreng", quantity: 1, modifiers: undefined, notes: undefined }]);
  });

  it("labels order types and SLA states", () => {
    expect(orderTypeLabel("DINE_IN")).toBe("Dine in");
    expect(orderTypeLabel("DELIVERY")).toBe("Delivery");
    expect(slaTone("ON_TIME")).toBe("success");
    expect(slaTone("AT_RISK")).toBe("warning");
    expect(slaTone("DELAYED")).toBe("destructive");
  });

  it("moves each column's tickets to the next status in order", () => {
    expect(KDS_COLUMNS.map((c) => c.nextStatus)).toEqual(["KITCHEN_RECEIVED", "COOKING", "READY", "SERVED"]);
  });
});
