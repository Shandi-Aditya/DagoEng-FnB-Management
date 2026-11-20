import { describe, expect, it } from "vitest";

import type { OrderRecord } from "@/types/order";
import {
  buildOrdersReportDocNumber,
  buildOrdersReportSignatories,
  computeOrdersReportPdfMetrics,
  formatOrdersReportDate,
} from "@/features/orders/orders-report-pdf-domain";

describe("orders-report-pdf-domain", () => {
  const sampleOrders: OrderRecord[] = [
    {
      id: "ord-1",
      orderNumber: "ORD-1001",
      organizationId: "org-dago-hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      orderType: "DINE_IN",
      tableNumber: "Meja 01",
      customerName: "Gede Arya",
      items: [
        { id: "i1", productId: "p1", productName: "Kopi Senja Aren", quantity: 2, unitPrice: 25000 },
        { id: "i2", productId: "p2", productName: "Croissant Butter", quantity: 1, unitPrice: 30000 },
      ],
      subtotal: 80000,
      tax: 0,
      total: 80000,
      status: "COMPLETED",
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
      targetServiceMinutes: 15,
      statusHistory: [],
      createdAt: "2026-11-15T08:00:00Z",
      completedAt: "2026-11-15T08:30:00Z",
    },
    {
      id: "ord-2",
      orderNumber: "ORD-1002",
      organizationId: "org-dago-hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      orderType: "DINE_IN",
      tableNumber: "Meja 02",
      customerName: "Putu Dewi",
      items: [
        { id: "i3", productId: "p3", productName: "Matcha Latte", quantity: 1, unitPrice: 32000 },
      ],
      subtotal: 32000,
      tax: 0,
      total: 32000,
      status: "COOKING",
      paymentStatus: "PENDING",
      paymentMethod: "CASH",
      targetServiceMinutes: 15,
      statusHistory: [],
      createdAt: "2026-11-15T08:15:00Z",
    },
    {
      id: "ord-3",
      orderNumber: "ORD-1003",
      organizationId: "org-dago-hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      orderType: "TAKEAWAY",
      tableNumber: "TAKEAWAY",
      customerName: "Kadek Budi",
      items: [
        { id: "i4", productId: "p1", productName: "Kopi Senja Aren", quantity: 3, unitPrice: 25000 },
      ],
      subtotal: 75000,
      tax: 0,
      total: 75000,
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
      targetServiceMinutes: 15,
      statusHistory: [],
      createdAt: "2026-11-15T08:20:00Z",
      confirmedAt: "2026-11-15T08:25:00Z",
    },
  ];

  it("computes executive summary metrics accurately without mutating input", () => {
    const ordersCopy = JSON.parse(JSON.stringify(sampleOrders));
    const metrics = computeOrdersReportPdfMetrics(sampleOrders);

    expect(metrics.totalRevenue).toBe(187000);
    expect(metrics.completedCount).toBe(1);
    expect(metrics.inProgressCount).toBe(2);
    expect(metrics.totalItemsSold).toBe(7);

    // Verify immutability
    expect(sampleOrders.length).toBe(ordersCopy.length);
  });

  it("handles empty orders gracefully with safe defaults", () => {
    const metrics = computeOrdersReportPdfMetrics([]);

    expect(metrics.totalRevenue).toBe(0);
    expect(metrics.completedCount).toBe(0);
    expect(metrics.inProgressCount).toBe(0);
    expect(metrics.totalItemsSold).toBe(0);
  });

  it("builds a deterministic official document number without Math.random", () => {
    const fixedDate = new Date("2026-11-15T09:30:00Z");
    const docNumber = buildOrdersReportDocNumber(fixedDate, 47);

    expect(docNumber).toBe("REP-ORD-20261115-47");
  });

  it("builds 3 factual accountable signatories for the outlet", () => {
    const signatories = buildOrdersReportSignatories("Komang Kasir", "Singaraja (Pusat)");

    expect(signatories.preparer.role).toBe("Staf / Kasir POS");
    expect(signatories.preparer.name).toBe("Komang Kasir");

    expect(signatories.reviewer.role).toBe("Supervisor Gerai");
    expect(signatories.reviewer.name).toContain("Supervisor");

    expect(signatories.approver.role).toBe("Pimpinan / Owner Gerai");
    expect(signatories.approver.name).toContain("Pimpinan");
  });

  it("formats report date according to Indonesian WITA conventions", () => {
    const fixedDate = new Date("2026-11-15T10:30:00Z");
    const formatted = formatOrdersReportDate(fixedDate);

    expect(formatted).toContain("15");
    expect(formatted).toContain("Nov");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("WITA");
  });
});
