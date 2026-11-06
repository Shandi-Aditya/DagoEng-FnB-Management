import { describe, it, expect } from "vitest";
import { OrderRecord } from "../src/types/order";
import {
  getMinutesDiff,
  formatMinutesToHuman,
  calculateOrderMetrics,
  analyzeOperationalBottlenecks,
} from "../src/lib/order-analytics";

describe("Order Lifecycle & Service Time Tracking", () => {
  it("formats minute values into human readable minutes and seconds", () => {
    expect(formatMinutesToHuman(14.366)).toBe("14m 22s");
    expect(formatMinutesToHuman(9.0)).toBe("9m 00s");
    expect(formatMinutesToHuman(1.8)).toBe("1m 48s");
  });

  it("calculates exact segment durations for completed order stages", () => {
    const sampleOrder: OrderRecord = {
      id: "test-ord-1",
      orderNumber: "ORD-TEST-01",
      organizationId: "org-ks",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-01",
      customerName: "Budi Santoso",
      orderType: "DINE_IN",
      status: "COMPLETED",
      targetServiceMinutes: 10,
      items: [{ id: "1", productName: "Kopi Senja Aren", quantity: 1, unitPrice: 24000 }],
      subtotal: 24000,
      tax: 2400,
      total: 26400,
      paymentStatus: "PAID",
      createdAt: "2026-09-14T19:02:00Z",
      confirmedAt: "2026-09-14T19:02:00Z",
      kitchenReceivedAt: "2026-09-14T19:04:00Z", // 2m Queue
      cookingStartedAt: "2026-09-14T19:05:00Z",
      readyAt: "2026-09-14T19:14:00Z",          // 9m Cooking
      servedAt: "2026-09-14T19:17:00Z",         // 3m Serving
      completedAt: "2026-09-14T19:45:00Z",
      statusHistory: [],
    };

    const metrics = calculateOrderMetrics(sampleOrder);

    expect(metrics.kitchenQueueMinutes).toBe(2.0);
    expect(metrics.cookingMinutes).toBe(9.0);
    expect(metrics.servingMinutes).toBe(3.0);
    expect(metrics.totalCustomerWaitingMinutes).toBe(15.0); // 19:02 to 19:17
    expect(metrics.isDelayed).toBe(true); // 15m > 10m target
    expect(metrics.slaStatus).toBe("DELAYED");
    expect(metrics.delayMinutes).toBe(5.0);
  });

  it("correctly identifies ON_TIME and AT_RISK SLA statuses", () => {
    const fastOrder: OrderRecord = {
      id: "test-ord-fast",
      orderNumber: "ORD-FAST",
      organizationId: "org-ks",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-02",
      customerName: "Siti",
      orderType: "DINE_IN",
      status: "SERVED",
      targetServiceMinutes: 10,
      items: [],
      subtotal: 20000,
      tax: 2000,
      total: 22000,
      paymentStatus: "PAID",
      createdAt: "2026-09-14T10:00:00Z",
      servedAt: "2026-09-14T10:06:00Z", // 6 minutes (<= 7.5m = ON_TIME)
      statusHistory: [],
    };

    const metricsFast = calculateOrderMetrics(fastOrder);
    expect(metricsFast.slaStatus).toBe("ON_TIME");
    expect(metricsFast.isDelayed).toBe(false);

    const atRiskOrder: OrderRecord = {
      ...fastOrder,
      id: "test-ord-risk",
      servedAt: "2026-09-14T10:08:30Z", // 8.5 minutes (>7.5m but <=10m = AT_RISK)
    };

    const metricsRisk = calculateOrderMetrics(atRiskOrder);
    expect(metricsRisk.slaStatus).toBe("AT_RISK");
    expect(metricsRisk.isDelayed).toBe(false);
  });

  it("diagnoses operational bottlenecks across multiple orders accurately", () => {
    const orders: OrderRecord[] = [
      {
        id: "ord-1",
        orderNumber: "ORD-1",
        organizationId: "org-ks",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "T-01",
        customerName: "A",
        orderType: "DINE_IN",
        status: "SERVED",
        targetServiceMinutes: 10,
        items: [],
        subtotal: 50000,
        tax: 5000,
        total: 55000,
        paymentStatus: "PAID",
        createdAt: "2026-09-14T10:00:00Z",
        confirmedAt: "2026-09-14T10:01:00Z",
        kitchenReceivedAt: "2026-09-14T10:02:00Z", // 1m Queue
        cookingStartedAt: "2026-09-14T10:02:00Z",
        readyAt: "2026-09-14T10:11:00Z",          // 9m Cooking (Major!)
        servedAt: "2026-09-14T10:13:00Z",         // 2m Serving
        statusHistory: [],
      },
    ];

    const analysis = analyzeOperationalBottlenecks(orders, 10);

    expect(analysis.primaryBottleneck).toBe("COOKING");
    expect(analysis.diagnosisStatement).toContain("Proses memasak di dapur adalah bottleneck utama");
  });
});
