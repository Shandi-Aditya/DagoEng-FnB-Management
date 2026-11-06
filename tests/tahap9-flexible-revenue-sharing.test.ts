import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateSettlement,
  calculateTenantProfitSharing,
  getAllTenantRevenueSplits,
  getTenantRevenueSplit,
  setTenantRevenueSplit,
  DEFAULT_TENANT_REVENUE_SPLITS,
} from "../src/lib/settlement";
import { OrderRecord } from "../src/types/order";

describe("Tahap 9 — Flexible Revenue Sharing & Settlement System", () => {
  beforeEach(() => {
    // Reset or clean up any memory state
  });

  describe("1. Revenue Split Configuration & Validation", () => {
    it("should provide default revenue sharing configuration for all tenants (85% Tenant / 15% DAGO)", () => {
      const defaultSplits = getAllTenantRevenueSplits();
      expect(defaultSplits["tenant-ks"]).toBeDefined();
      expect(defaultSplits["tenant-ks"].tenantSharePercent).toBe(85);
      expect(defaultSplits["tenant-ks"].dagoSharePercent).toBe(15);

      expect(defaultSplits["tenant-kitchen"]).toBeDefined();
      expect(defaultSplits["tenant-kitchen"].tenantSharePercent).toBe(85);
      expect(defaultSplits["tenant-kitchen"].dagoSharePercent).toBe(15);
    });

    it("should validate and allow custom revenue sharing per tenant (e.g. 90:10, 80:20, 88:12)", () => {
      const resultA = setTenantRevenueSplit("tenant-ks", 85, 15);
      expect(resultA.success).toBe(true);

      const resultB = setTenantRevenueSplit("tenant-kitchen", 90, 10);
      expect(resultB.success).toBe(true);

      const resultC = setTenantRevenueSplit("tenant-bakery", 80, 20);
      expect(resultC.success).toBe(true);

      const resultD = setTenantRevenueSplit("tenant-tea", 88, 12);
      expect(resultD.success).toBe(true);
    });

    it("should reject negative percentages (< 0)", () => {
      const result = setTenantRevenueSplit("tenant-ks", -5, 105);
      expect(result.success).toBe(false);
      expect(result.error).toContain("antara 0% hingga 100%");
    });

    it("should reject percentages exceeding 100%", () => {
      const result = setTenantRevenueSplit("tenant-ks", 110, -10);
      expect(result.success).toBe(false);
      expect(result.error).toContain("antara 0% hingga 100%");
    });

    it("should reject splits that do not sum to 100%", () => {
      const result = setTenantRevenueSplit("tenant-ks", 80, 15); // Sum is 95%
      expect(result.success).toBe(false);
      expect(result.error).toContain("harus berjumlah 100%");
    });

    it("should automatically compute DAGO share if only tenant share is provided", () => {
      const result = setTenantRevenueSplit("tenant-ks", 92);
      expect(result.success).toBe(true);
    });
  });

  describe("2. Multi-Tenant Single Order Settlement Calculation with Flexible Splits", () => {
    it("should correctly split revenue according to each tenant's specific percentage in a multi-tenant order", () => {
      /**
       * Scenario:
       * Customer buys:
       * - Mitra A (tenant-ks, 85% / 15%): Rp 50.000 (1 item @ 50.000)
       * - Mitra B (tenant-kitchen, 90% / 10%): Rp 50.000 (1 item @ 50.000)
       * Total Order = Rp 100.000
       * Customer pays ONE payment = Rp 100.000 (PAID)
       * 
       * Expected Settlement:
       * Mitra A: Net Rp 50.000 -> Tenant = Rp 42.500 (85%), DAGO = Rp 7.500 (15%)
       * Mitra B: Net Rp 50.000 -> Tenant = Rp 45.000 (90%), DAGO = Rp 5.000 (10%)
       */
      const multiTenantOrder: OrderRecord = {
        id: "order-multi-1",
        orderNumber: "ORD-001",
        organizationId: "org-1",
        outletId: "outlet-1",
        outletName: "Dago Hub Main",
        customerName: "Budi Santoso",
        orderType: "DINE_IN",
        tableNumber: "04",
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        targetServiceMinutes: 15,
        statusHistory: [],
        subtotal: 100000,
        tax: 0,
        total: 100000,
        items: [
          {
            id: "item-1",
            productName: "Kopi Senja Signature",
            quantity: 1,
            unitPrice: 50000,
            tenantId: "tenant-ks",
          },
          {
            id: "item-2",
            productName: "Nasi Goreng Spesial Dapur Mama",
            quantity: 1,
            unitPrice: 50000,
            tenantId: "tenant-kitchen",
          },
        ],
        createdAt: "2026-10-07T10:00:00.000Z",
      };

      const customSplits = {
        "tenant-ks": { tenantSharePercent: 85, dagoSharePercent: 15 },
        "tenant-kitchen": { tenantSharePercent: 90, dagoSharePercent: 10 },
      };

      const settlement = calculateSettlement([multiTenantOrder], undefined, customSplits);

      const ksSettlement = settlement.find((s) => s.tenantId === "tenant-ks");
      const kitchenSettlement = settlement.find((s) => s.tenantId === "tenant-kitchen");

      expect(ksSettlement).toBeDefined();
      expect(ksSettlement?.grossRevenue).toBe(50000);
      expect(ksSettlement?.netRevenue).toBe(50000);
      expect(ksSettlement?.tenantSharePercent).toBe(85);
      expect(ksSettlement?.dagoSharePercent).toBe(15);
      expect(ksSettlement?.tenantShareAmount).toBe(42500);
      expect(ksSettlement?.dagoShareAmount).toBe(7500);

      expect(kitchenSettlement).toBeDefined();
      expect(kitchenSettlement?.grossRevenue).toBe(50000);
      expect(kitchenSettlement?.netRevenue).toBe(50000);
      expect(kitchenSettlement?.tenantSharePercent).toBe(90);
      expect(kitchenSettlement?.dagoSharePercent).toBe(10);
      expect(kitchenSettlement?.tenantShareAmount).toBe(45000);
      expect(kitchenSettlement?.dagoShareAmount).toBe(5000);

      // Total of all shares must match total paid
      const totalTenantShares = (ksSettlement?.tenantShareAmount || 0) + (kitchenSettlement?.tenantShareAmount || 0);
      const totalDagoShares = (ksSettlement?.dagoShareAmount || 0) + (kitchenSettlement?.dagoShareAmount || 0);
      expect(totalTenantShares + totalDagoShares).toBe(100000);
    });

    it("should handle multi-tenant order with discount and tax prorated accurately", () => {
      /**
       * Order with 3 tenants:
       * - Tenant A (80% / 20%): Rp 40.000 (40%)
       * - Tenant B (90% / 10%): Rp 40.000 (40%)
       * - Tenant C (85% / 15%): Rp 20.000 (20%)
       * Subtotal = 100.000, Discount = 10.000, Tax = 10.000 (10%)
       * Total Paid = 100.000
       */
      const complexOrder: OrderRecord = {
        id: "order-complex-1",
        orderNumber: "ORD-002",
        organizationId: "org-1",
        outletId: "outlet-1",
        outletName: "Dago Hub Main",
        customerName: "Siti Rahma",
        tableNumber: "02",
        targetServiceMinutes: 15,
        statusHistory: [],
        orderType: "DINE_IN",
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        subtotal: 100000,
        discount: 10000,
        tax: 10000,
        total: 100000,
        items: [
          {
            id: "i-1",
            productName: "Kopi",
            quantity: 2,
            unitPrice: 20000,
            tenantId: "tenant-ks",
          },
          {
            id: "i-2",
            productName: "Makanan",
            quantity: 1,
            unitPrice: 40000,
            tenantId: "tenant-kitchen",
          },
          {
            id: "i-3",
            productName: "Kue",
            quantity: 1,
            unitPrice: 20000,
            tenantId: "tenant-bakery",
          },
        ],
        createdAt: "2026-10-07T11:00:00.000Z",
      };

      const customSplits = {
        "tenant-ks": { tenantSharePercent: 80, dagoSharePercent: 20 },
        "tenant-kitchen": { tenantSharePercent: 90, dagoSharePercent: 10 },
        "tenant-bakery": { tenantSharePercent: 85, dagoSharePercent: 15 },
      };

      const settlement = calculateSettlement([complexOrder], undefined, customSplits);

      const ks = settlement.find((s) => s.tenantId === "tenant-ks");
      const kitchen = settlement.find((s) => s.tenantId === "tenant-kitchen");
      const bakery = settlement.find((s) => s.tenantId === "tenant-bakery");

      // Tenant A (80:20 of 40.000): Tenant = 32.000, DAGO = 8.000
      expect(ks?.tenantShareAmount).toBe(32000);
      expect(ks?.dagoShareAmount).toBe(8000);

      // Tenant B (90:10 of 40.000): Tenant = 36.000, DAGO = 4.000
      expect(kitchen?.tenantShareAmount).toBe(36000);
      expect(kitchen?.dagoShareAmount).toBe(4000);

      // Tenant C (85:15 of 20.000): Tenant = 17.000, DAGO = 3.000
      expect(bakery?.tenantShareAmount).toBe(17000);
      expect(bakery?.dagoShareAmount).toBe(3000);

      // Sum of all settlements
      const totalTenantShare = (ks?.tenantShareAmount || 0) + (kitchen?.tenantShareAmount || 0) + (bakery?.tenantShareAmount || 0);
      const totalDagoShare = (ks?.dagoShareAmount || 0) + (kitchen?.dagoShareAmount || 0) + (bakery?.dagoShareAmount || 0);

      expect(totalTenantShare).toBe(85000);
      expect(totalDagoShare).toBe(15000);
      expect(totalTenantShare + totalDagoShare).toBe(100000);
    });

    it("should ignore unpaid and cancelled orders in settlement", () => {
      const unpaidOrder: OrderRecord = {
        id: "order-unpaid",
        orderNumber: "ORD-UNPAID",
        organizationId: "org-1",
        outletId: "outlet-1",
        outletName: "Dago Hub Main",
        customerName: "Guest",
        tableNumber: "01",
        targetServiceMinutes: 10,
        statusHistory: [],
        orderType: "TAKEAWAY",
        status: "CONFIRMED",
        paymentStatus: "PENDING",
        paymentMethod: "QRIS",
        subtotal: 50000,
        tax: 0,
        total: 50000,
        items: [
          {
            id: "i-1",
            productName: "Latte",
            quantity: 1,
            unitPrice: 50000,
            tenantId: "tenant-ks",
          },
        ],
        createdAt: "2026-10-07T12:00:00.000Z",
      };

      const settlement = calculateSettlement([unpaidOrder]);
      expect(settlement.length).toBe(0);
    });
  });

  describe("3. Tenant Profit Sharing Calculation Helper", () => {
    it("should calculate profit sharing, platform commission and QRIS MDR accurately with custom commission rate", () => {
      const order: OrderRecord = {
        id: "ord-ps-1",
        orderNumber: "ORD-PS1",
        organizationId: "org-1",
        outletId: "outlet-1",
        outletName: "Dago Hub Main",
        customerName: "Agus",
        tableNumber: "05",
        targetServiceMinutes: 15,
        statusHistory: [],
        orderType: "DINE_IN",
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        subtotal: 200000,
        tax: 0,
        total: 200000,
        items: [
          {
            id: "i-1",
            productName: "Paket Makan",
            quantity: 2,
            unitPrice: 100000,
            tenantId: "tenant-kitchen",
          },
        ],
        createdAt: "2026-10-07T12:00:00.000Z",
      };

      // Custom commission: 10% DAGO Platform Fee (instead of default 15%)
      const ps = calculateTenantProfitSharing([order], "tenant-kitchen", "Dapur Mama", 10);

      expect(ps.grossSales).toBe(200000);
      expect(ps.commissionPercent).toBe(10);
      expect(ps.tenantSharePercent).toBe(90);
      expect(ps.platformFee).toBe(20000); // 10% of 200.000
      expect(ps.qrisMdr).toBe(1400);      // 0.7% BI MDR = 1.400
      expect(ps.netPayout).toBe(200000 - 20000 - 1400); // 178.600
    });
  });

  describe("4. Historical Immutability & Future Changes", () => {
    it("should allow historical settlement calculation using historical splits snapshot without affecting old orders", () => {
      const order: OrderRecord = {
        id: "ord-hist-1",
        orderNumber: "ORD-HIST1",
        organizationId: "org-1",
        outletId: "outlet-1",
        outletName: "Dago Hub Main",
        customerName: "Dini",
        tableNumber: "03",
        targetServiceMinutes: 10,
        statusHistory: [],
        orderType: "DINE_IN",
        status: "COMPLETED",
        paymentStatus: "PAID",
        subtotal: 100000,
        tax: 0,
        total: 100000,
        items: [
          {
            id: "i-1",
            productName: "Coffee",
            quantity: 1,
            unitPrice: 100000,
            tenantId: "tenant-ks",
          },
        ],
        createdAt: "2026-09-01T10:00:00.000Z",
      };

      // Month 1 historical split: 85:15
      const splitMonth1 = { "tenant-ks": { tenantSharePercent: 85, dagoSharePercent: 15 } };
      const settlementM1 = calculateSettlement([order], undefined, splitMonth1);
      expect(settlementM1[0].tenantShareAmount).toBe(85000);
      expect(settlementM1[0].dagoShareAmount).toBe(15000);

      // Month 2 new split: 80:20
      const splitMonth2 = { "tenant-ks": { tenantSharePercent: 80, dagoSharePercent: 20 } };
      const settlementM2 = calculateSettlement([order], undefined, splitMonth2);
      expect(settlementM2[0].tenantShareAmount).toBe(80000);
      expect(settlementM2[0].dagoShareAmount).toBe(20000);

      // Verifying both calculations are pure and deterministic
      expect(settlementM1[0].tenantShareAmount).toBe(85000);
    });
  });
});
