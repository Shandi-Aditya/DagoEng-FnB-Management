import { describe, it, expect } from "vitest";
import { buildReportData } from "@/features/reports/reports-domain";
import { buildClosingReportData } from "@/features/employees/employees-domain";
import { buildClosingReportPdfUrl } from "@/features/pos/pos-closing-report";
import type { ShiftRecord } from "@/types/shift";
import type { OrderRecord } from "@/types/order";

describe("Task V-12: Cashier Closing Status & Front Office (FO) Report Format", () => {
  const mockOrders: any[] = [
    {
      id: "ord-1",
      orderNumber: "ORD-001",
      customerName: "Gede Widi",
      orderType: "DINE_IN",
      status: "COMPLETED",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      subtotal: 50000,
      tax: 5000,
      total: 55000,
      discount: 0,
      serviceCharge: 0,
      createdAt: "2026-11-15T09:00:00Z",
      items: [
        {
          id: "item-1",
          menuItemId: "menu-1",
          productName: "Kopi Susu Gula Aren",
          quantity: 2,
          unitPrice: 25000,
          tenantId: "tenant-ks",
        },
      ],
    },
    {
      id: "ord-2",
      orderNumber: "ORD-002",
      customerName: "Kadek Ayu",
      orderType: "DINE_IN",
      status: "COMPLETED",
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
      subtotal: 60000,
      tax: 6000,
      total: 66000,
      discount: 0,
      serviceCharge: 0,
      createdAt: "2026-11-15T10:00:00Z",
      items: [
        {
          id: "item-2",
          menuItemId: "menu-2",
          productName: "Nasi Goreng Spesial",
          quantity: 2,
          unitPrice: 30000,
          tenantId: "tenant-kitchen",
        },
      ],
    },
  ];

  describe("1. CLOSING Report Domain (reports-domain.ts)", () => {
    it("reports NEEDS_RECONCILIATION shifts accurately instead of 0 shift and false Seimbang", () => {
      const overdueShifts: any[] = [
        {
          id: "shf-overdue-1",
          shiftName: "Shift Pagi (Auto-reconciled)",
          assignedCashierName: "Wayan Kasir",
          openingCash: 200000,
          cashSales: 150000,
          expectedCash: 350000,
          actualCash: 300000,
          cashVariance: -50000,
          status: "NEEDS_RECONCILIATION",
          startTime: "2026-11-14T08:00:00Z",
          endTime: "2026-11-15T01:00:00Z",
          closingNotes: "Otomatis dialihkan: Melebihi batas durasi operasional (Perlu Rekonsiliasi)",
        },
      ];

      const report = buildReportData({
        type: "CLOSING",
        scopeName: "Outlet Singaraja",
        orders: mockOrders,
        products: [],
        shifts: overdueShifts,
        ingredients: [],
        logs: [],
        operatorName: "Manager Arya",
      });

      // Shift count must NOT be '0 shift'
      expect(report.summaryCards[0].value).toContain("1 shift");
      expect(report.summaryCards[0].value).toContain("perlu rekonsiliasi");

      // Status kas must NOT be 'Seimbang'
      const statusKas = report.reconciliationInfo?.find((r) => r.label === "Status kas");
      expect(statusKas?.value).toBe("Perlu rekonsiliasi");

      // Table rows should include status
      expect(report.tableHeaders).toContain("Status");
      expect(report.tableRows[0]).toContain("Perlu rekonsiliasi");
    });

    it("reports Seimbang only when all shifts are CLOSED and variance is 0", () => {
      const balancedShifts: any[] = [
        {
          id: "shf-closed-1",
          shiftName: "Shift Pagi",
          assignedCashierName: "Ketut Kasir",
          openingCash: 200000,
          cashSales: 100000,
          expectedCash: 300000,
          actualCash: 300000,
          cashVariance: 0,
          status: "CLOSED",
          startTime: "2026-11-15T08:00:00Z",
          endTime: "2026-11-15T16:00:00Z",
        },
      ];

      const report = buildReportData({
        type: "CLOSING",
        scopeName: "Outlet Singaraja",
        orders: mockOrders,
        products: [],
        shifts: balancedShifts,
        ingredients: [],
        logs: [],
      });

      expect(report.summaryCards[0].value).toBe("1 shift");
      const statusKas = report.reconciliationInfo?.find((r) => r.label === "Status kas");
      expect(statusKas?.value).toBe("Seimbang");
    });

    it("reports Ada selisih when shifts are CLOSED but variance is non-zero", () => {
      const varianceShifts: any[] = [
        {
          id: "shf-closed-2",
          shiftName: "Shift Sore",
          assignedCashierName: "Komang Kasir",
          openingCash: 200000,
          cashSales: 100000,
          expectedCash: 300000,
          actualCash: 290000,
          cashVariance: -10000,
          status: "CLOSED",
          startTime: "2026-11-15T16:00:00Z",
          endTime: "2026-11-15T23:00:00Z",
        },
      ];

      const report = buildReportData({
        type: "CLOSING",
        scopeName: "Outlet Singaraja",
        orders: mockOrders,
        products: [],
        shifts: varianceShifts,
        ingredients: [],
        logs: [],
      });

      const statusKas = report.reconciliationInfo?.find((r) => r.label === "Status kas");
      expect(statusKas?.value).toBe("Ada selisih");
    });
  });

  describe("2. Front Office (FO) Closing Report Data Builder", () => {
    it("builds FO closing report with complete cash drawer reconciliation metrics", () => {
      const sampleShift: any = {
        id: "shf-fo-1",
        shiftName: "Shift 1 (Pagi)",
        assignedCashierName: "Made Suantara",
        openingCash: 300000,
        cashSales: 150000,
        nonCashSales: 200000,
        expectedCash: 450000,
        actualCash: 445000,
        cashVariance: -5000,
        closingNotes: "Kembalian receh selisih Rp 5.000",
        status: "CLOSED",
        startTime: "2026-11-15T08:00:00Z",
        endTime: "2026-11-15T16:00:00Z",
      };

      const closingData = buildClosingReportData(
        sampleShift,
        mockOrders,
        "Singaraja Hub",
        "Made Suantara"
      );

      // FO Cash Drawer Reconciliation
      expect(closingData.initialCash).toBe(300000);
      expect(closingData.totalCashSales).toBe(150000);
      expect(closingData.expectedCash).toBe(450000);
      expect(closingData.actualCashEnding).toBe(445000);
      expect(closingData.cashDifference).toBe(-5000);
      expect(closingData.shiftNotes).toBe("Kembalian receh selisih Rp 5.000");

      // Tenant Breakdown per F&B Partner
      expect(closingData.tenantBreakdowns).toBeDefined();
      expect(closingData.tenantBreakdowns!.length).toBeGreaterThan(0);
      const kopiSenja = closingData.tenantBreakdowns!.find((t) => t.tenantName === "Kopi Senja");
      expect(kopiSenja).toBeDefined();
      expect(kopiSenja?.tenantSharePercent).toBe(85);
      expect(kopiSenja?.dagoSharePercent).toBe(15);
    });
  });

  describe("3. PDF URL Generator & Server Rendering Integration", () => {
    it("includes FO cash reconciliation parameters in the closing PDF endpoint URL", () => {
      const sampleShift: any = {
        id: "shf-fo-2",
        shiftName: "Shift Malam",
        assignedCashierName: "Budi",
        openingCash: 250000,
        cashSales: 120000,
        expectedCash: 370000,
        actualCash: 370000,
        cashVariance: 0,
        closingNotes: "Uang laci cocok sempurna",
        status: "CLOSED",
        startTime: "2026-11-15T16:00:00Z",
      };

      const closingData = buildClosingReportData(
        sampleShift,
        mockOrders,
        "Denpasar Hub",
        "Budi"
      );

      const url = buildClosingReportPdfUrl(closingData);
      expect(url).toContain("initialCash=250000");
      expect(url).toContain("expectedCash=370000");
      expect(url).toContain("actualCash=370000");
      expect(url).toContain("variance=0");
    });
  });
});
