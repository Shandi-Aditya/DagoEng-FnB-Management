import { describe, it, expect } from "vitest";
import {
  calculateCartTaxAndService,
  getOrderTaxBreakdown,
  aggregateOrdersTaxAndRevenue,
} from "@/lib/tax-breakdown";
import { calculateSettlement } from "@/lib/settlement";
import { OrderRecord } from "@/types/order";

describe("POS B2: Formulasi Pajak & Service Charge Terpusat (POS-11, POS-27, TC-B09)", () => {
  it("B2.1 (TC-B09): calculateCartTaxAndService menghitung DPP, PB1 10%, dan service charge 5% secara presisi untuk dine-in", () => {
    const result = calculateCartTaxAndService({
      subtotal: 49000,
      discount: 0,
      taxRatePercent: 10,
      serviceChargePercent: 5,
      isTaxEnabled: true,
      orderType: "DINE_IN",
    });

    expect(result.subtotal).toBe(49000);
    expect(result.discount).toBe(0);
    expect(result.dpp).toBe(49000);
    expect(result.pb1).toBe(4900);
    expect(result.serviceCharge).toBe(2450);
    expect(result.totalTaxAndService).toBe(7350);
    expect(result.total).toBe(56350);
  });

  it("B2.2: calculateCartTaxAndService tidak membebankan service charge pada pesanan TAKEAWAY", () => {
    const result = calculateCartTaxAndService({
      subtotal: 49000,
      discount: 0,
      taxRatePercent: 10,
      serviceChargePercent: 5,
      isTaxEnabled: true,
      orderType: "TAKEAWAY",
    });

    expect(result.subtotal).toBe(49000);
    expect(result.discount).toBe(0);
    expect(result.dpp).toBe(49000);
    expect(result.pb1).toBe(4900);
    expect(result.serviceCharge).toBe(0);
    expect(result.totalTaxAndService).toBe(4900);
    expect(result.total).toBe(53900);
  });

  it("B2.3: calculateCartTaxAndService menghitung pajak dan service dari DPP setelah diskon promo", () => {
    const result = calculateCartTaxAndService({
      subtotal: 100000,
      discount: 20000,
      taxRatePercent: 10,
      serviceChargePercent: 5,
      isTaxEnabled: true,
      orderType: "DINE_IN",
    });

    expect(result.subtotal).toBe(100000);
    expect(result.discount).toBe(20000);
    expect(result.dpp).toBe(80000);
    expect(result.pb1).toBe(8000); // 10% of 80.000
    expect(result.serviceCharge).toBe(4000); // 5% of 80.000
    expect(result.totalTaxAndService).toBe(12000);
    expect(result.total).toBe(92000);
  });

  it("B2.4: Hasil calculateCartTaxAndService identik dengan getOrderTaxBreakdown saat order disimpan", () => {
    const cartCalc = calculateCartTaxAndService({
      subtotal: 150000,
      discount: 30000,
      taxRatePercent: 10,
      serviceChargePercent: 5,
      isTaxEnabled: true,
      orderType: "DINE_IN",
    });

    const savedOrder: Partial<OrderRecord> = {
      subtotal: cartCalc.subtotal,
      discount: cartCalc.discount,
      tax: cartCalc.pb1,
      serviceCharge: cartCalc.serviceCharge,
      taxRatePercent: 10,
      serviceChargePercent: 5,
      total: cartCalc.total,
      orderType: "DINE_IN",
    };

    const orderBreakdown = getOrderTaxBreakdown(savedOrder);

    expect(orderBreakdown.subtotal).toBe(cartCalc.subtotal);
    expect(orderBreakdown.discount).toBe(cartCalc.discount);
    expect(orderBreakdown.dpp).toBe(cartCalc.dpp);
    expect(orderBreakdown.pb1).toBe(cartCalc.pb1);
    expect(orderBreakdown.serviceCharge).toBe(cartCalc.serviceCharge);
    expect(orderBreakdown.totalTaxAndService).toBe(cartCalc.totalTaxAndService);
    expect(orderBreakdown.total).toBe(cartCalc.total);
  });
});

describe("POS B3: Perhitungan Bagi Hasil Mitra dari DPP (POS-35, TC-K06, TC-H05)", () => {
  it("B3.1 (TC-K06): Transaksi Rp 49.000 + pajak membagi hasil 85/15 dari DPP sebelum pajak", () => {
    const order: OrderRecord = {
      id: "ord-tc-k06",
      orderNumber: "ORD-K06",
      organizationId: "org-1",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-02",
      customerName: "Ketut Dian",
      orderType: "DINE_IN",
      status: "COMPLETED",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      subtotal: 49000,
      discount: 0,
      tax: 4900, // 10% PB1
      serviceCharge: 2450, // 5% Service
      total: 56350,
      targetServiceMinutes: 10,
      createdAt: "2026-11-06T09:40:00.000Z",
      statusHistory: [],
      items: [
        {
          id: "it-1",
          productName: "Kopi Senja Aren",
          quantity: 2,
          unitPrice: 24500,
          tenantId: "tenant-ks",
        },
      ],
    };

    const settlements = calculateSettlement([order]);
    expect(settlements).toHaveLength(1);

    const ks = settlements[0];
    expect(ks.tenantId).toBe("tenant-ks");
    expect(ks.grossRevenue).toBe(49000);
    expect(ks.discount).toBe(0);
    expect(ks.dpp).toBe(49000);
    expect(ks.tax).toBe(4900);
    expect(ks.serviceCharge).toBe(2450);

    // 85% of DPP (49.000) = 41.650 (NOT 85% of 56.350 = 47.898)
    expect(ks.tenantShareAmount).toBe(41650);
    // 15% of DPP (49.000) = 7.350 (NOT 15% of 56.350 = 8.452)
    expect(ks.dagoShareAmount).toBe(7350);

    // Sum of shares matches DPP exactly
    expect((ks.tenantShareAmount || 0) + (ks.dagoShareAmount || 0)).toBe(49000);
  });

  it("B3.2 (TC-H05): Transaksi multi-mitra dengan diskon menghitung bagi hasil dari DPP masing-masing mitra", () => {
    const multiOrder: OrderRecord = {
      id: "ord-multi-b3",
      orderNumber: "ORD-MB3",
      organizationId: "org-1",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-05",
      customerName: "Budi Santoso",
      orderType: "DINE_IN",
      status: "COMPLETED",
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
      subtotal: 100000,
      discount: 20000,
      tax: 8000, // 10% of 80.000 DPP
      serviceCharge: 4000, // 5% of 80.000 DPP
      total: 92000,
      targetServiceMinutes: 15,
      createdAt: "2026-11-06T10:00:00.000Z",
      statusHistory: [],
      items: [
        {
          id: "it-ks",
          productName: "Minuman Kopi Senja",
          quantity: 3,
          unitPrice: 20000, // 60.000 (60%)
          tenantId: "tenant-ks",
        },
        {
          id: "it-mama",
          productName: "Nasi Goreng Dapur Mama",
          quantity: 1,
          unitPrice: 40000, // 40.000 (40%)
          tenantId: "tenant-kitchen",
        },
      ],
    };

    const customSplits = {
      "tenant-ks": { tenantSharePercent: 85, dagoSharePercent: 15 },
      "tenant-kitchen": { tenantSharePercent: 90, dagoSharePercent: 10 },
    };

    const settlements = calculateSettlement([multiOrder], undefined, customSplits);
    const ks = settlements.find((s) => s.tenantId === "tenant-ks");
    const kitchen = settlements.find((s) => s.tenantId === "tenant-kitchen");

    expect(ks).toBeDefined();
    expect(kitchen).toBeDefined();

    // KS: Gross = 60.000, Discount alloc = 12.000 -> DPP = 48.000
    expect(ks?.grossRevenue).toBe(60000);
    expect(ks?.discount).toBe(12000);
    expect(ks?.dpp).toBe(48000);
    expect(ks?.tax).toBe(4800);
    expect(ks?.serviceCharge).toBe(2400);
    // 85% of DPP 48.000 = 40.800
    expect(ks?.tenantShareAmount).toBe(40800);
    // 15% of DPP 48.000 = 7.200
    expect(ks?.dagoShareAmount).toBe(7200);

    // Kitchen: Gross = 40.000, Discount alloc = 8.000 -> DPP = 32.000
    expect(kitchen?.grossRevenue).toBe(40000);
    expect(kitchen?.discount).toBe(8000);
    expect(kitchen?.dpp).toBe(32000);
    expect(kitchen?.tax).toBe(3200);
    expect(kitchen?.serviceCharge).toBe(1600);
    // 90% of DPP 32.000 = 28.800
    expect(kitchen?.tenantShareAmount).toBe(28800);
    // 10% of DPP 32.000 = 3.200
    expect(kitchen?.dagoShareAmount).toBe(3200);

    // Total share across both tenants = 48.000 + 32.000 = 80.000 (Total DPP)
    const totalAllShares =
      (ks?.tenantShareAmount || 0) +
      (ks?.dagoShareAmount || 0) +
      (kitchen?.tenantShareAmount || 0) +
      (kitchen?.dagoShareAmount || 0);

    expect(totalAllShares).toBe(80000);
  });
});
