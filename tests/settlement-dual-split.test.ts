import { describe, it, expect } from "vitest";
import {
  resolveTenantSplitPercentages,
  calculateSettlement,
  calculateTenantProfitSharing,
} from "@/lib/settlement";
import { calculateWeeklyTenantSettlement } from "@/features/reports/settlement-weekly-domain";
import type { OrderRecord } from "@/types/order";

describe("TSK-02 & TSK-09: Dual Revenue Sharing Split & MDR Bearer Domain", () => {
  describe("resolveTenantSplitPercentages", () => {
    it("resolves dual split percentages when both cash and qris splits are defined", () => {
      const split = {
        tenantId: "tenant-ks",
        tenantName: "Kopi Senja",
        tenantSharePercent: 85,
        dagoSharePercent: 15,
        cashTenantSharePercent: 80,
        cashDagoSharePercent: 20,
        qrisTenantSharePercent: 90,
        qrisDagoSharePercent: 10,
        status: "ACTIVE" as const,
      };

      const resolved = resolveTenantSplitPercentages(split);
      expect(resolved.cashTenantPercent).toBe(80);
      expect(resolved.cashDagoPercent).toBe(20);
      expect(resolved.qrisTenantPercent).toBe(90);
      expect(resolved.qrisDagoPercent).toBe(10);
      expect(resolved.tenantPercent).toBe(85);
      expect(resolved.dagoPercent).toBe(15);
    });

    it("falls back to base tenantSharePercent when dual split percentages are omitted", () => {
      const split = {
        tenantId: "tenant-kitchen",
        tenantName: "Dapur Mama",
        tenantSharePercent: 75,
        dagoSharePercent: 25,
        status: "ACTIVE" as const,
      };

      const resolved = resolveTenantSplitPercentages(split);
      expect(resolved.cashTenantPercent).toBe(75);
      expect(resolved.cashDagoPercent).toBe(25);
      expect(resolved.qrisTenantPercent).toBe(75);
      expect(resolved.qrisDagoPercent).toBe(25);
    });
  });

  describe("calculateSettlement with Dual Splits", () => {
    const dualSplitConfig = {
      "tenant-ks": {
        tenantId: "tenant-ks",
        tenantName: "Kopi Senja",
        tenantSharePercent: 85,
        dagoSharePercent: 15,
        cashTenantSharePercent: 80,
        cashDagoSharePercent: 20,
        qrisTenantSharePercent: 90,
        qrisDagoSharePercent: 10,
        status: "ACTIVE" as const,
      },
    };

    it("applies cash split (80/20) to CASH orders", () => {
      const cashOrder: OrderRecord = {
        id: "ord-cash-1",
        tenantId: "tenant-ks",
        paymentStatus: "PAID",
        paymentMethod: "CASH",
        status: "COMPLETED",
        total: 100000,
        tax: 0,
        serviceCharge: 0,
        discount: 0,
        createdAt: "2026-11-25T10:00:00.000Z",
        items: [
          {
            id: "i1",
            name: "Espresso",
            price: 50000,
            unitPrice: 50000,
            quantity: 2,
            tenantId: "tenant-ks",
          },
        ],
      };

      const summaryList = calculateSettlement([cashOrder], undefined, dualSplitConfig);
      const tenantSettlement = summaryList.find((s) => s.tenantId === "tenant-ks");
      expect(tenantSettlement).toBeDefined();
      expect(tenantSettlement?.settlementBasisAmount).toBe(100000);
      // 80% of 100,000 = 80,000
      expect(tenantSettlement?.tenantShareAmount).toBe(80000);
      // 20% of 100,000 = 20,000
      expect(tenantSettlement?.dagoShareAmount).toBe(20000);
      expect(tenantSettlement?.tenantShareAmount! + tenantSettlement?.dagoShareAmount!).toBe(100000);
    });

    it("applies QRIS split (90/10) to QRIS orders", () => {
      const qrisOrder: OrderRecord = {
        id: "ord-qris-1",
        tenantId: "tenant-ks",
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        status: "COMPLETED",
        total: 100000,
        tax: 0,
        serviceCharge: 0,
        discount: 0,
        createdAt: "2026-11-25T10:00:00.000Z",
        items: [
          {
            id: "i1",
            name: "Latte",
            price: 50000,
            unitPrice: 50000,
            quantity: 2,
            tenantId: "tenant-ks",
          },
        ],
      };

      const summaryList = calculateSettlement([qrisOrder], undefined, dualSplitConfig);
      const tenantSettlement = summaryList.find((s) => s.tenantId === "tenant-ks");
      expect(tenantSettlement).toBeDefined();
      expect(tenantSettlement?.settlementBasisAmount).toBe(100000);
      // 90% of 100,000 = 90,000
      expect(tenantSettlement?.tenantShareAmount).toBe(90000);
      // 10% of 100,000 = 10,000
      expect(tenantSettlement?.dagoShareAmount).toBe(10000);
      expect(tenantSettlement?.tenantShareAmount! + tenantSettlement?.dagoShareAmount!).toBe(100000);
    });

    it("pro-rata calculates split payment orders (CASH + QRIS) with exact integer conservation", () => {
      const splitOrder: OrderRecord = {
        id: "ord-split-1",
        tenantId: "tenant-ks",
        paymentStatus: "PAID",
        paymentMethod: "SPLIT",
        status: "COMPLETED",
        total: 100000,
        tax: 0,
        serviceCharge: 0,
        discount: 0,
        createdAt: "2026-11-25T10:00:00.000Z",
        splitDetails: [
          { method: "CASH", amount: 60000 },
          { method: "QRIS", amount: 40000 },
        ],
        items: [
          {
            id: "i1",
            name: "Combo Coffee",
            price: 100000,
            unitPrice: 100000,
            quantity: 1,
            tenantId: "tenant-ks",
          },
        ],
      };

      const summaryList = calculateSettlement([splitOrder], undefined, dualSplitConfig);
      const tenantSettlement = summaryList.find((s) => s.tenantId === "tenant-ks");
      expect(tenantSettlement).toBeDefined();
      // Cash portion: 60,000 * 80% = 48,000
      // QRIS portion: 40,000 * 90% = 36,000
      // Total tenant share = 48,000 + 36,000 = 84,000
      expect(tenantSettlement?.tenantShareAmount).toBe(84000);
      // Dago share = 16,000
      expect(tenantSettlement?.dagoShareAmount).toBe(16000);
      expect(tenantSettlement?.tenantShareAmount! + tenantSettlement?.dagoShareAmount!).toBe(100000);
    });
  });

  describe("calculateTenantProfitSharing with MDR Bearer Modes", () => {
    const qrisOrders: OrderRecord[] = [
      {
        id: "ord-qris-profit",
        tenantId: "tenant-ks",
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        status: "COMPLETED",
        total: 200000,
        tax: 0,
        serviceCharge: 0,
        discount: 0,
        createdAt: "2026-11-25T10:00:00.000Z",
        items: [
          {
            id: "i1",
            name: "Single Origin",
            price: 100000,
            unitPrice: 100000,
            quantity: 2,
            tenantId: "tenant-ks",
          },
        ],
      },
    ];

    it("handles MDR Bearer = MITRA (Mitra absorbs 100% of QRIS MDR)", () => {
      const result = calculateTenantProfitSharing(
        qrisOrders,
        "tenant-ks",
        "Kopi Senja",
        {
          mdrBearer: "MITRA",
          customCommissionPercent: 15,
        }
      );

      // MDR = 200,000 * 0.007 = 1,400
      expect(result.qrisMdr).toBe(1400);
      // Tenant share before MDR: 200,000 * 85% = 170,000
      // Tenant payout = 170,000 - 1,400 = 168,600
      expect(result.netPayout).toBe(168600);
      expect(result.platformFee).toBe(30000);
      expect(result.mdrTenantPortion).toBe(1400);
      expect(result.mdrDagoPortion).toBe(0);
    });

    it("handles MDR Bearer = DAGO (Dago absorbs 100% of QRIS MDR)", () => {
      const result = calculateTenantProfitSharing(
        qrisOrders,
        "tenant-ks",
        "Kopi Senja",
        {
          mdrBearer: "DAGO",
          customCommissionPercent: 15,
        }
      );

      expect(result.qrisMdr).toBe(1400);
      // Tenant payout receives full 85% = 170,000
      expect(result.netPayout).toBe(170000);
      expect(result.platformFee).toBe(30000);
      expect(result.mdrTenantPortion).toBe(0);
      expect(result.mdrDagoPortion).toBe(1400);
    });

    it("handles MDR Bearer = SPLIT (proportional shared MDR sesuai rasio bagi hasil)", () => {
      const result = calculateTenantProfitSharing(
        qrisOrders,
        "tenant-ks",
        "Kopi Senja",
        {
          mdrBearer: "SPLIT",
          customCommissionPercent: 15,
        }
      );

      // MDR 1,400 -> 85% tenant = 1,190; 15% Dago = 210
      expect(result.qrisMdr).toBe(1400);
      expect(result.mdrTenantPortion).toBe(1190);
      expect(result.mdrDagoPortion).toBe(210);
      // Tenant payout = 170,000 - 1,190 = 168,810
      expect(result.netPayout).toBe(168810);
      expect(result.platformFee).toBe(30000);
    });
  });

  describe("calculateWeeklyTenantSettlement with Dual Splits", () => {
    it("accurately computes weekly settlement with cash 80% and QRIS 85%", () => {
      const orders: OrderRecord[] = [
        {
          id: "ord-w-cash",
          tenantId: "tenant-ks",
          paymentStatus: "PAID",
          paymentMethod: "CASH",
          status: "COMPLETED",
          total: 100000,
          tax: 0,
          serviceCharge: 0,
          discount: 0,
          createdAt: "2026-11-25T10:00:00.000+08:00",
          items: [
            {
              id: "i1",
              name: "Espresso",
              unitPrice: 50000,
              quantity: 2,
              tenantId: "tenant-ks",
            },
          ],
        },
        {
          id: "ord-w-qris",
          tenantId: "tenant-ks",
          paymentStatus: "PAID",
          paymentMethod: "QRIS",
          status: "COMPLETED",
          total: 100000,
          tax: 0,
          serviceCharge: 0,
          discount: 0,
          createdAt: "2026-11-25T11:00:00.000+08:00",
          items: [
            {
              id: "i2",
              name: "Latte",
              unitPrice: 50000,
              quantity: 2,
              tenantId: "tenant-ks",
            },
          ],
        },
      ];

      const weekly = calculateWeeklyTenantSettlement(orders, "tenant-ks", {
        referenceDate: "2026-11-25T12:00:00.000+08:00",
        customSplits: {
          "tenant-ks": {
            tenantSharePercent: 85,
            dagoSharePercent: 15,
            cashTenantSharePercent: 80,
            cashDagoSharePercent: 20,
            qrisTenantSharePercent: 85,
            qrisDagoSharePercent: 15,
          },
        },
        mdrBearer: "MITRA",
      });

      expect(weekly.cashNetSales).toBe(100000);
      expect(weekly.cashTenantShare).toBe(80000);
      expect(weekly.cashDagoShare).toBe(20000);

      expect(weekly.qrisNetSales).toBe(100000);
      expect(weekly.qrisMdrFee).toBe(700);
      expect(weekly.qrisTenantShare).toBe(84300);
      expect(weekly.qrisDagoShare).toBe(15000);

      expect(weekly.netTransferAmount).toBe(64300);
      expect(weekly.actionDirection).toBe("DAGO_TO_MITRA");
    });
  });
});
