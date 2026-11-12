import { describe, expect, it } from "vitest";

import {
  buildOrderExportData,
  buildOrderReceiptData,
  buildReprintKitchenTicket,
  filterOrdersByTenant,
  orderStatusLabel,
  orderStatusTone,
  paymentStatusLabel,
  paymentMethodLabel,
  paymentStatusTone,
  slaStatusLabel,
  slaStatusTone,
} from "@/features/orders/orders-domain";
import type { OrderItemRecord, OrderRecord } from "@/types/order";

function makeItem(name: string, tenantId = "tenant-ks"): OrderItemRecord {
  return {
    id: `item-${name}`,
    productName: name,
    quantity: 2,
    unitPrice: 25000,
    tenantId,
    modifiers: ["Less Sugar"],
    notes: "Dingin",
  };
}

function makeOrder(id: string, overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id,
    orderNumber: `ORD-${id}`,
    organizationId: "org-1",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tableNumber: "T-01",
    customerName: "Budi Santoso",
    orderType: "DINE_IN",
    status: "NEW",
    items: [makeItem("Es Kopi")],
    subtotal: 50000,
    tax: 5000,
    serviceCharge: 2500,
    total: 57500,
    paymentStatus: "UNPAID",
    paymentMethod: "QRIS",
    statusHistory: [
      {
        fromStatus: "DRAFT",
        toStatus: "NEW",
        timestamp: "2026-11-11T10:00:00Z",
        actorName: "Kasir",
      },
    ],
    createdAt: "2026-11-11T10:00:00Z",
    ...overrides,
  } as OrderRecord;
}

describe("filterOrdersByTenant", () => {
  it("returns all orders when not tenant owner", () => {
    const orders = [makeOrder("1"), makeOrder("2")];
    expect(filterOrdersByTenant(orders, undefined, false)).toHaveLength(2);
  });

  it("filters orders containing at least one item of the tenant", () => {
    const orders = [
      makeOrder("1", { items: [makeItem("Kopi", "tenant-ks")] }),
      makeOrder("2", { items: [makeItem("Roti", "tenant-bakery")] }),
    ];
    const filtered = filterOrdersByTenant(orders, "tenant-ks", true);
    expect(filtered.map((o) => o.id)).toEqual(["1"]);
  });
});

describe("orderStatusLabel and orderStatusTone", () => {
  it("translates order statuses into human Indonesian labels", () => {
    expect(orderStatusLabel("NEW")).toBe("Baru");
    expect(orderStatusLabel("CONFIRMED")).toBe("Dikonfirmasi");
    expect(orderStatusLabel("KITCHEN_RECEIVED")).toBe("Diterima dapur");
    expect(orderStatusLabel("COOKING")).toBe("Dimasak");
    expect(orderStatusLabel("READY")).toBe("Siap saji");
    expect(orderStatusLabel("SERVED")).toBe("Disajikan");
    expect(orderStatusLabel("COMPLETED")).toBe("Selesai");
    expect(orderStatusLabel("CANCELLED")).toBe("Dibatalkan");
  });

  it("maps order status to semantic status tones", () => {
    expect(orderStatusTone("COMPLETED")).toBe("success");
    expect(orderStatusTone("SERVED")).toBe("info");
    expect(orderStatusTone("COOKING")).toBe("warning");
    expect(orderStatusTone("CANCELLED")).toBe("destructive");
  });
});

describe("paymentStatusLabel and paymentStatusTone", () => {
  it("translates payment status to Indonesian labels", () => {
    expect(paymentStatusLabel("PAID")).toBe("Lunas");
    expect(paymentStatusLabel("REFUNDED")).toBe("Dikembalikan");
    expect(paymentStatusLabel("PENDING")).toBe("Belum dibayar");
  });

  it("maps payment status to semantic tones", () => {
    expect(paymentStatusTone("PAID")).toBe("success");
    expect(paymentStatusTone("REFUNDED")).toBe("warning");
    expect(paymentStatusTone("UNPAID")).toBe("destructive");
  });
});

describe("slaStatusTone", () => {
  it("maps SLA statuses correctly", () => {
    expect(slaStatusTone("COMPLETED")).toBe("success");
    expect(slaStatusTone("ON_TIME")).toBe("success");
    expect(slaStatusTone("AT_RISK")).toBe("warning");
    expect(slaStatusTone("DELAYED")).toBe("destructive");
  });
});

describe("buildReprintKitchenTicket", () => {
  it("generates reprint ticket with correct items and purpose", () => {
    const order = makeOrder("101", { notes: "Alergi kacang" });
    const ticket = buildReprintKitchenTicket(order, "REPRINT", "Staff Budi");

    expect(ticket.orderNumber).toBe("ORD-101");
    expect(ticket.purpose).toBe("REPRINT");
    expect(ticket.reprintedBy).toBe("Staff Budi");
    expect(ticket.kitchenNotes).toBe("Alergi kacang");
    expect(ticket.items).toHaveLength(1);
    expect(ticket.items[0].productName).toBe("Es Kopi");
  });
});

describe("buildOrderReceiptData", () => {
  it("formats order into POS receipt data structure", () => {
    const order = makeOrder("102", {
      paymentStatus: "PAID",
      paymentMethod: "CASH",
    });
    const receipt = buildOrderReceiptData(order);

    expect(receipt.orderNumber).toBe("ORD-102");
    expect(receipt.customerName).toBe("Budi Santoso");
    expect(receipt.tableNumber).toBe("T-01");
    expect(receipt.grandTotal).toBe(57500);
    expect(receipt.paymentMethod).toBe("CASH");
  });
});

describe("buildOrderExportData", () => {
  it("formats table rows for CSV and Excel export", () => {
    const orders = [
      makeOrder("103", {
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        promoId: "PROMO-DISC",
        completedAt: "2026-11-11T10:30:00Z",
      }),
    ];
    const promos = [{ id: "PROMO-DISC", name: "Diskon 10%" }];

    const { headers, rows } = buildOrderExportData(orders, promos);

    expect(headers).toContain("No. Pesanan");
    expect(headers).toContain("Total Tagihan (Rp)");
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe("ORD-103");
    expect(rows[0][4]).toBe("Diskon 10%");
    expect(rows[0][7]).toBe("Selesai");
    expect(rows[0][8]).toBe("Lunas");
  });
});

describe("slaStatusLabel and paymentMethodLabel", () => {
  it("never shows raw SLA enums", () => {
    expect(slaStatusLabel("ON_TIME")).toBe("Tepat waktu");
    expect(slaStatusLabel("AT_RISK")).toBe("Mendekati target");
    expect(slaStatusLabel("DELAYED")).toBe("Lewat target");
  });

  it("labels payment methods and falls back to a dash", () => {
    expect(paymentMethodLabel("CASH")).toBe("Tunai");
    expect(paymentMethodLabel("QRIS")).toBe("QRIS");
    expect(paymentMethodLabel("EDC")).toBe("Kartu (EDC)");
    expect(paymentMethodLabel("TRANSFER")).toBe("Transfer");
    expect(paymentMethodLabel("SPLIT")).toBe("Split bill");
    expect(paymentMethodLabel(undefined)).toBe("—");
  });
});
