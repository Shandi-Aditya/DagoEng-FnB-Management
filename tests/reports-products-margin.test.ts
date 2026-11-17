import { describe, it, expect } from "vitest";
import { findTopProduct, buildReportData } from "@/features/reports/reports-domain";
import type { OrderRecord } from "@/types/order";
import type { MasterProduct } from "@/types/product";

describe("Task S-11: Laporan Produk & Margin — Menu Terjual Hanya Dari Pesanan Lunas", () => {
  const dummyProducts: MasterProduct[] = [
    {
      id: "prod-1",
      name: "Kopi Senja Aren",
      category: "Minuman",
      basePrice: 24000,
      cogsEstimate: 8640,
      grossMarginPercent: "64.0%",
      status: "ACTIVE",
      outletId: "ALL",
      outletName: "Semua Outlet",
      isAvailable: true,
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-17T00:00:00Z",
    },
    {
      id: "prod-2",
      name: "Croissant Butter",
      category: "Pastry",
      basePrice: 28000,
      cogsEstimate: 12000,
      grossMarginPercent: "57.1%",
      status: "ACTIVE",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      isAvailable: true,
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-17T00:00:00Z",
    },
    {
      id: "prod-3",
      name: "Matcha Blend Denpasar",
      category: "Minuman",
      basePrice: 32000,
      cogsEstimate: 14000,
      grossMarginPercent: "56.3%",
      status: "ACTIVE",
      outletId: "outlet-dps",
      outletName: "Denpasar",
      isAvailable: true,
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-17T00:00:00Z",
    },
  ];

  describe("1. findTopProduct Logic", () => {
    it("returns '-' when order list is empty", () => {
      expect(findTopProduct([])).toBe("-");
    });

    it("returns '-' when orders exist but none are paid (PENDING / UNPAID / NEW)", () => {
      const unpaidOrders: OrderRecord[] = [
        {
          id: "ord-unpaid-1",
          orderNumber: "ORD-UNPAID-1",
          organizationId: "org-1",
          outletId: "outlet-sgr",
          outletName: "Singaraja",
          tableNumber: "01",
          customerName: "Guest Walk-in",
          orderType: "DINE_IN",
          status: "NEW",
          paymentStatus: "PENDING",
          subtotal: 48000,
          tax: 4800,
          total: 52800,
          items: [
            {
              id: "item-1",
              productId: "prod-1",
              productName: "Kopi Senja Aren",
              quantity: 2,
              unitPrice: 24000,
            },
          ],
          targetServiceMinutes: 15,
          createdAt: "2026-11-13T10:00:00Z",
          statusHistory: [],
        },
      ];

      // Proves the bug: Previously counted "Kopi Senja Aren (2 pcs)" from unpaid order
      expect(findTopProduct(unpaidOrders)).toBe("-");
    });

    it("returns '-' when orders are CANCELLED even if previously marked with items", () => {
      const cancelledOrders: OrderRecord[] = [
        {
          id: "ord-can-1",
          orderNumber: "ORD-CAN-1",
          organizationId: "org-1",
          outletId: "outlet-sgr",
          outletName: "Singaraja",
          tableNumber: "02",
          customerName: "Guest Cancelled",
          orderType: "TAKEAWAY",
          status: "CANCELLED",
          paymentStatus: "PAID",
          subtotal: 72000,
          tax: 7200,
          total: 79200,
          items: [
            {
              id: "item-2",
              productId: "prod-1",
              productName: "Kopi Senja Aren",
              quantity: 3,
              unitPrice: 24000,
            },
          ],
          targetServiceMinutes: 15,
          createdAt: "2026-11-13T10:00:00Z",
          statusHistory: [],
        },
      ];

      expect(findTopProduct(cancelledOrders)).toBe("-");
    });

    it("calculates top product strictly from PAID orders", () => {
      const mixedOrders: OrderRecord[] = [
        // Unpaid order with 5 Croissants -> must be ignored!
        {
          id: "ord-pending",
          orderNumber: "ORD-PENDING",
          organizationId: "org-1",
          outletId: "outlet-sgr",
          outletName: "Singaraja",
          tableNumber: "03",
          customerName: "Pending Guest",
          orderType: "DINE_IN",
          status: "NEW",
          paymentStatus: "PENDING",
          subtotal: 140000,
          tax: 14000,
          total: 154000,
          items: [
            {
              id: "item-3",
              productId: "prod-2",
              productName: "Croissant Butter",
              quantity: 5,
              unitPrice: 28000,
            },
          ],
          targetServiceMinutes: 15,
          createdAt: "2026-11-13T10:00:00Z",
          statusHistory: [],
        },
        // Paid order with 2 Kopi Senja Aren -> valid!
        {
          id: "ord-paid-1",
          orderNumber: "ORD-PAID-1",
          organizationId: "org-1",
          outletId: "outlet-sgr",
          outletName: "Singaraja",
          tableNumber: "04",
          customerName: "Paid Guest 1",
          orderType: "DINE_IN",
          status: "CONFIRMED",
          paymentStatus: "PAID",
          subtotal: 48000,
          tax: 4800,
          total: 52800,
          items: [
            {
              id: "item-4",
              productId: "prod-1",
              productName: "Kopi Senja Aren",
              quantity: 2,
              unitPrice: 24000,
            },
          ],
          targetServiceMinutes: 15,
          createdAt: "2026-11-13T10:05:00Z",
          statusHistory: [],
        },
        // Another paid order with 1 Kopi Senja Aren -> valid!
        {
          id: "ord-paid-2",
          orderNumber: "ORD-PAID-2",
          organizationId: "org-1",
          outletId: "outlet-sgr",
          outletName: "Singaraja",
          tableNumber: "05",
          customerName: "Paid Guest 2",
          orderType: "DINE_IN",
          status: "COMPLETED",
          paymentStatus: "PAID",
          subtotal: 24000,
          tax: 2400,
          total: 26400,
          items: [
            {
              id: "item-5",
              productId: "prod-1",
              productName: "Kopi Senja Aren",
              quantity: 1,
              unitPrice: 24000,
            },
          ],
          targetServiceMinutes: 15,
          createdAt: "2026-11-13T10:15:00Z",
          statusHistory: [],
        },
      ];

      expect(findTopProduct(mixedOrders)).toBe("Kopi Senja Aren (3 pcs)");
    });
  });

  describe("2. buildReportData PRODUCTS Dataset", () => {
    it("reports '-' for 'Paling laris' when no paid orders exist", () => {
      const report = buildReportData({
        type: "PRODUCTS",
        scopeName: "Singaraja",
        orders: [],
        products: dummyProducts,
        shifts: [],
        ingredients: [],
        logs: [],
      });

      expect(report.title).toBe("Laporan produk dan margin");
      const topProductCard = report.summaryCards.find((c) => c.label === "Paling laris");
      expect(topProductCard?.value).toBe("-");
      const menuCountCard = report.summaryCards.find((c) => c.label === "Menu terdaftar");
      expect(menuCountCard?.value).toBe("3 menu");
    });

    it("displays correct top product card when paid orders exist", () => {
      const paidOrders: OrderRecord[] = [
        {
          id: "ord-paid-3",
          orderNumber: "ORD-PAID-3",
          organizationId: "org-1",
          outletId: "outlet-sgr",
          outletName: "Singaraja",
          tableNumber: "01",
          customerName: "Dewi",
          orderType: "DINE_IN",
          status: "COMPLETED",
          paymentStatus: "PAID",
          subtotal: 56000,
          tax: 5600,
          total: 61600,
          items: [
            {
              id: "it-1",
              productId: "prod-2",
              productName: "Croissant Butter",
              quantity: 2,
              unitPrice: 28000,
            },
          ],
          targetServiceMinutes: 15,
          createdAt: "2026-11-13T11:00:00Z",
          statusHistory: [],
        },
      ];

      const report = buildReportData({
        type: "PRODUCTS",
        scopeName: "Singaraja",
        orders: paidOrders,
        products: dummyProducts,
        shifts: [],
        ingredients: [],
        logs: [],
      });

      const topProductCard = report.summaryCards.find((c) => c.label === "Paling laris");
      expect(topProductCard?.value).toBe("Croissant Butter (2 pcs)");
    });
  });

  describe("3. Outlet-Scoped Products Filtering (ALL and Branch)", () => {
    it("retains products with outletId === 'ALL' and matching branch when scoped to a specific outlet", () => {
      const activeOutletId = "outlet-sgr";
      const filtered = dummyProducts.filter(
        (p) =>
          activeOutletId === "ALL" ||
          p.outletId === "ALL" ||
          p.outletId === activeOutletId ||
          !p.outletId
      );

      // prod-1 (ALL) and prod-2 (outlet-sgr) must be kept; prod-3 (outlet-dps) must be filtered out
      expect(filtered).toHaveLength(2);
      expect(filtered.map((p) => p.id)).toEqual(["prod-1", "prod-2"]);
    });

    it("retains all products when activeOutletId is 'ALL'", () => {
      const activeOutletId = "ALL";
      const filtered = dummyProducts.filter(
        (p) =>
          activeOutletId === "ALL" ||
          p.outletId === "ALL" ||
          p.outletId === activeOutletId ||
          !p.outletId
      );

      expect(filtered).toHaveLength(3);
    });
  });
});
