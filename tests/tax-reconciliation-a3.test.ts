import { describe, it, expect } from "vitest";
import { OrderRecord } from "@/types/order";
import { ShiftRecord } from "@/types/shift";
import {
  getOrderTaxBreakdown,
  aggregateOrdersTaxAndRevenue,
  aggregateShiftOrdersTaxAndRevenue,
  computeClosingVerificationHash,
} from "@/lib/tax-breakdown";
import { calculateSettlement } from "@/lib/settlement";

describe("QA Handover A3 — Sinkronisasi Pajak Laporan vs Struk & Settlement (POS-34)", () => {
  it("A3.1 (TC-K05): Struk, laporan penjualan, dan closing shift menghasilkan nilai PB1 Rp 4.900 dan Service Charge Rp 2.450 yang identik persis", () => {
    const subtotal = 49000;
    const taxRatePercent = 10;
    const serviceRatePercent = 5;

    const receiptPB1 = Math.round(subtotal * (taxRatePercent / 100)); // 4.900
    const receiptService = Math.round(subtotal * (serviceRatePercent / 100)); // 2.450
    const grandTotal = subtotal + receiptPB1 + receiptService; // 56.350

    const storedOrder: OrderRecord = {
      id: "ord-pos-5612",
      orderNumber: "ORD-POS-5612",
      organizationId: "org-dago-hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-02",
      customerName: "Ketut Dian",
      orderType: "DINE_IN",
      status: "COMPLETED",
      items: [
        {
          id: "it-1",
          productId: "prod-1",
          productName: "Menu F&B Kopi Senja",
          quantity: 1,
          unitPrice: 49000,
          tenantId: "tenant-ks",
        },
      ],
      subtotal,
      discount: 0,
      tax: receiptPB1,
      serviceCharge: receiptService,
      taxRatePercent,
      serviceChargePercent: serviceRatePercent,
      total: grandTotal,
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      targetServiceMinutes: 10,
      createdAt: new Date().toISOString(),
      statusHistory: [],
    };

    const breakdown = getOrderTaxBreakdown(storedOrder);
    expect(breakdown.pb1).toBe(4900);
    expect(breakdown.serviceCharge).toBe(2450);
    expect(breakdown.discount).toBe(0);
    expect(breakdown.total).toBe(56350);

    const report = aggregateOrdersTaxAndRevenue([storedOrder]);
    expect(report.totalTaxPB1).toBe(4900);
    expect(report.totalServiceCharge).toBe(2450);
    expect(report.totalDiscounts).toBe(0);
    expect(report.totalNetSales).toBe(49000);
  });

  it("A3.2 (TC-H01): Order dine-in dengan diskon dan service charge menghasilkan discount dan settlement mitra yang akurat (A3-1)", () => {
    // Subtotal 100.000, Diskon 10.000 -> DPP 90.000, PB1 (10%) = 9.000, Service (5%) = 4.500 -> Total = 103.500
    const discountedOrder: OrderRecord = {
      id: "ord-disc-1",
      orderNumber: "ORD-DISC-1",
      organizationId: "org-dago-hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-05",
      customerName: "Guest Promo",
      orderType: "DINE_IN",
      status: "COMPLETED",
      items: [
        {
          id: "it-ks",
          productId: "prod-ks",
          productName: "Paket Kopi Senja",
          quantity: 2,
          unitPrice: 50000,
          tenantId: "tenant-ks",
        },
      ],
      subtotal: 100000,
      // Even when discount field is omitted on legacy record, getOrderTaxBreakdown derives 10.000 accurately
      tax: 9000,
      serviceCharge: 4500,
      total: 103500,
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
      targetServiceMinutes: 10,
      createdAt: new Date().toISOString(),
      statusHistory: [],
    };

    const breakdown = getOrderTaxBreakdown(discountedOrder);
    expect(breakdown.discount).toBe(10000);
    expect(breakdown.dpp).toBe(90000);
    expect(breakdown.pb1).toBe(9000);
    expect(breakdown.serviceCharge).toBe(4500);

    const settlements = calculateSettlement([discountedOrder]);
    expect(settlements.length).toBe(1);
    const ksSettlement = settlements[0];
    expect(ksSettlement.grossRevenue).toBe(100000);
    expect(ksSettlement.discount).toBe(10000);
    expect(ksSettlement.tax).toBe(9000);
    expect(ksSettlement.serviceCharge).toBe(4500);
    expect(ksSettlement.netRevenue).toBe(103500);
  });

  it("A3.3: Menghormati taxRatePercent = 0 dan tidak menerapkan service charge pada order TAKEAWAY legacy (A3-3)", () => {
    const zeroTaxTakeaway: OrderRecord = {
      id: "ord-takeaway-0",
      orderNumber: "ORD-TW-0",
      organizationId: "org-1",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "-",
      customerName: "Takeaway Guest",
      orderType: "TAKEAWAY",
      status: "COMPLETED",
      items: [],
      subtotal: 50000,
      tax: 0,
      taxRatePercent: 0,
      serviceChargePercent: 0,
      total: 50000,
      paymentStatus: "PAID",
      targetServiceMinutes: 10,
      createdAt: new Date().toISOString(),
      statusHistory: [],
    };

    const breakdown = getOrderTaxBreakdown(zeroTaxTakeaway);
    expect(breakdown.pb1).toBe(0);
    expect(breakdown.serviceCharge).toBe(0);
    expect(breakdown.discount).toBe(0);
  });

  it("R10: aggregateShiftOrdersTaxAndRevenue hanya menghitung order dalam rentang [startTime, endTime] shift tersebut dan tidak mencampur order shift sebelumnya", () => {
    const shiftStart = Date.parse("2026-11-09T08:00:00.000Z");
    const shiftEnd = Date.parse("2026-11-09T16:00:00.000Z");

    const shift: ShiftRecord = {
      id: `shf-${shiftStart}-sgr`,
      shiftName: "Shift Pagi",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      assignedCashierId: "user-cashier-sgr",
      assignedCashierName: "Ni Kadek Sri",
      startTime: new Date(shiftStart).toISOString(),
      endTime: new Date(shiftEnd).toISOString(),
      closedAt: new Date(shiftEnd).toISOString(),
      status: "CLOSED",
      openingCash: 500000,
      cashSales: 55000,
      nonCashSales: 0,
      refundAmount: 0,
      expectedCash: 555000,
      actualCash: 555000,
      cashVariance: 0,
    };

    const orderBeforeShift: OrderRecord = {
      id: "ord-prev-day",
      orderNumber: "ORD-PREV",
      organizationId: "org-1",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-01",
      customerName: "Kemarin",
      orderType: "DINE_IN",
      status: "COMPLETED",
      items: [],
      subtotal: 200000,
      tax: 20000,
      serviceCharge: 10000,
      total: 230000,
      paymentStatus: "PAID",
      targetServiceMinutes: 10,
      createdAt: "2026-11-08T12:00:00.000Z",
      statusHistory: [],
    };

    const orderInsideShift: OrderRecord = {
      id: "ord-in-shift",
      orderNumber: "ORD-IN",
      organizationId: "org-1",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-02",
      customerName: "Tamu Shift Pagi",
      orderType: "DINE_IN",
      status: "COMPLETED",
      items: [],
      subtotal: 50000,
      tax: 5000,
      serviceCharge: 0,
      total: 55000,
      paymentStatus: "PAID",
      targetServiceMinutes: 10,
      createdAt: "2026-11-09T10:30:00.000Z",
      statusHistory: [],
    };

    const orderAfterShift: OrderRecord = {
      id: "ord-next-shift",
      orderNumber: "ORD-NEXT",
      organizationId: "org-1",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-03",
      customerName: "Tamu Shift Malam",
      orderType: "DINE_IN",
      status: "COMPLETED",
      items: [],
      subtotal: 100000,
      tax: 10000,
      serviceCharge: 0,
      total: 110000,
      paymentStatus: "PAID",
      targetServiceMinutes: 10,
      createdAt: "2026-11-09T19:00:00.000Z",
      statusHistory: [],
    };

    const agg = aggregateShiftOrdersTaxAndRevenue(
      [orderBeforeShift, orderInsideShift, orderAfterShift],
      shift
    );

    expect(agg.orderCount).toBe(1);
    expect(agg.totalRevenue).toBe(55000);
    expect(agg.totalTaxPB1).toBe(5000);
    expect(agg.totalNetSales).toBe(50000);

    const hash1 = computeClosingVerificationHash(shift, agg);
    const hash2 = computeClosingVerificationHash({ ...shift, cashSales: 999999 }, agg);
    expect(hash1).toMatch(/^SHA256-[0-9A-F]{16}$/);
    expect(hash1).not.toBe(hash2);
  });
});
