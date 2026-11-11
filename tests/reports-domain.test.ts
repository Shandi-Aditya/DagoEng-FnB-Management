import { describe, it, expect } from "vitest";
import {
  buildReportData,
  getReportCategories,
} from "@/features/reports/reports-domain";
import { OrderRecord } from "@/types/order";
import { MasterProduct } from "@/types/product";
import { ShiftRecord } from "@/types/shift";
import { IngredientItem } from "@/types/inventory";
import { ActivityLogEntry } from "@/types/audit";
import { EventTicketOrder } from "@/types/event";

describe("reports-domain", () => {
  const mockOrders: OrderRecord[] = [
    {
      id: "ord-1",
      orderNumber: "ORD-001",
      outletId: "out-1",
      outletName: "Outlet Singaraja",
      organizationId: "org-1",
      customerName: "Budi Santoso",
      orderType: "DINE_IN",
      tableNumber: "01",
      targetServiceMinutes: 15,
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
      subtotal: 50000,
      tax: 5000,
      serviceCharge: 2500,
      discount: 0,
      total: 57500,
      createdAt: "2026-11-10T10:00:00.000Z",
      statusHistory: [],
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          productName: "Espresso",
          quantity: 2,
          unitPrice: 25000,
        },
      ],
    },
    {
      id: "ord-2",
      orderNumber: "ORD-002",
      outletId: "out-1",
      outletName: "Outlet Singaraja",
      organizationId: "org-1",
      customerName: "Siti Rahma",
      orderType: "TAKEAWAY",
      tableNumber: "-",
      targetServiceMinutes: 10,
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      subtotal: 30000,
      tax: 3000,
      serviceCharge: 0,
      discount: 5000,
      total: 28000,
      createdAt: "2026-11-10T11:00:00.000Z",
      statusHistory: [],
      items: [
        {
          id: "item-2",
          productId: "prod-2",
          productName: "Matcha Latte",
          quantity: 1,
          unitPrice: 30000,
        },
      ],
    },
  ];

  const mockProducts: MasterProduct[] = [
    {
      id: "prod-1",
      name: "Espresso",
      category: "Coffee",
      basePrice: 25000,
      costPrice: 7000,
      tenantId: "DAGO_HUB",
      outletId: "out-1",
      status: "ACTIVE",
      sku: "CF-01",
      recipeYield: 1,
      stockNumber: 100,
      minStockAlert: 10,
      unit: "cup",
      taxIncluded: true,
      serviceChargeIncluded: false,
      grossMarginPercent: 72,
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z",
    },
    {
      id: "prod-2",
      name: "Matcha Latte",
      category: "Non-Coffee",
      basePrice: 30000,
      costPrice: 8400,
      tenantId: "DAGO_HUB",
      outletId: "out-1",
      status: "ACTIVE",
      sku: "NC-01",
      recipeYield: 1,
      stockNumber: 100,
      minStockAlert: 10,
      unit: "cup",
      taxIncluded: true,
      serviceChargeIncluded: false,
      grossMarginPercent: 72,
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z",
    },
  ];

  const mockShifts: ShiftRecord[] = [
    {
      id: "shift-1",
      shiftName: "Pagi",
      assignedCashierName: "Ayu",
      openingCash: 100000,
      cashSales: 28000,
      expectedCash: 128000,
      actualCash: 128000,
      cashVariance: 0,
      status: "CLOSED",
      startTime: "2026-11-10T08:00:00Z",
      endTime: "2026-11-10T16:00:00Z",
      cashierId: "emp-1",
      outletId: "out-1",
      outletName: "Outlet Singaraja",
    },
  ];

  const mockIngredients: IngredientItem[] = [
    {
      id: "ing-1",
      name: "Biji Kopi House Blend",
      category: "Raw Material",
      stockNumber: 15,
      min: 5,
      unit: "kg",
      costPerUnit: 120000,
      reorderAmount: 10,
      supplier: "Koperasi Kopi",
      sku: "RM-01",
      lastUpdated: "2026-11-10T00:00:00Z",
    },
  ];

  const mockLogs: ActivityLogEntry[] = [
    {
      id: "log-1",
      timestamp: "2026-11-10T09:00:00.000Z",
      actorName: "Ayu",
      module: "POS",
      action: "OPEN_SHIFT",
      description: "Modal awal Rp 100.000",
      severity: "INFO",
      status: "SUCCESS",
      outletId: "out-1",
    },
  ];

  const mockEvents: EventTicketOrder[] = [
    {
      id: "evt-1",
      ticketCode: "TCK-001",
      eventTitle: "Workshop Kopi",
      guestName: "Doni",
      guestPhone: "08123456789",
      ticketCount: 2,
      totalPrice: 200000,
      platformFeeAmount: 40000,
      organizerRevenueAmount: 160000,
      paymentMethod: "QRIS",
      paymentStatus: "PAID",
      checkInStatus: "CHECKED_IN",
      createdAt: "2026-11-10T12:00:00Z",
    },
  ];

  it("builds SALES report dataset correctly", () => {
    const report = buildReportData({
      type: "SALES",
      scopeName: "Outlet Singaraja",
      orders: mockOrders,
      products: mockProducts,
      shifts: mockShifts,
      ingredients: mockIngredients,
      logs: mockLogs,
    });

    expect(report.title).toBe("Laporan penjualan POS");
    expect(report.tableRows).toHaveLength(2);
    expect(report.summaryCards[0].label).toBe("Omzet");
    expect(report.summaryCards[1].value).toBe("2 pesanan");
    expect(report.summaryCards[3].value).toBe("3 item");
    expect(report.reconciliationInfo).toBeDefined();
    expect(report.reconciliationInfo?.length).toBeGreaterThan(0);
  });

  it("builds CLOSING report dataset correctly", () => {
    const report = buildReportData({
      type: "CLOSING",
      scopeName: "Outlet Singaraja",
      orders: mockOrders,
      products: mockProducts,
      shifts: mockShifts,
      ingredients: mockIngredients,
      logs: mockLogs,
      operatorName: "Putu Arya",
    });

    expect(report.title).toBe("Laporan closing kasir");
    expect(report.summaryCards[0].value).toBe("1 shift");
    expect(report.summaryCards[1].value).toBe("Rp 128.000");
    expect(report.summaryCards[2].value).toBe("Rp 0");
    expect(report.tableRows).toHaveLength(1);
    expect(report.reconciliationInfo?.[0]).toEqual({ label: "Status kas", value: "Seimbang" });
    expect(report.reconciliationInfo?.[1].value).toBe("Putu Arya");
  });

  it("builds PRODUCTS report dataset with dynamic top product instead of hardcoded text", () => {
    const report = buildReportData({
      type: "PRODUCTS",
      scopeName: "Outlet Singaraja",
      orders: mockOrders,
      products: mockProducts,
      shifts: mockShifts,
      ingredients: mockIngredients,
      logs: mockLogs,
    });

    expect(report.title).toBe("Laporan produk dan margin");
    expect(report.tableRows).toHaveLength(2);
    expect(report.summaryCards[2].value).toContain("Espresso (2 pcs)");
    expect(report.summaryCards[2].value).not.toBe("Kopi Senja Signature");
  });

  it("builds INVENTORY report dataset correctly", () => {
    const report = buildReportData({
      type: "INVENTORY",
      scopeName: "Outlet Singaraja",
      orders: mockOrders,
      products: mockProducts,
      shifts: mockShifts,
      ingredients: mockIngredients,
      logs: mockLogs,
    });

    expect(report.title).toBe("Laporan stok bahan");
    expect(report.summaryCards[0].value).toBe("1 bahan");
    expect(report.summaryCards[1].value).toBe("0 bahan");
    expect(report.summaryCards[2].value).toBe("Rp 1.800.000");
    expect(report.tableRows).toHaveLength(1);
  });

  it("builds SETTLEMENT and EVENTS report datasets correctly", () => {
    const settlementReport = buildReportData({
      type: "SETTLEMENT",
      scopeName: "Outlet Singaraja",
      orders: mockOrders,
      products: mockProducts,
      shifts: mockShifts,
      ingredients: mockIngredients,
      logs: mockLogs,
    });
    expect(settlementReport.title).toBe("Laporan settlement mitra");
    expect(settlementReport.tableHeaders).toContain("Rekening pencairan");

    const eventsReport = buildReportData({
      type: "EVENTS",
      scopeName: "Outlet Singaraja",
      orders: mockOrders,
      products: mockProducts,
      shifts: mockShifts,
      ingredients: mockIngredients,
      logs: mockLogs,
      eventBookings: mockEvents,
    });
    expect(eventsReport.title).toBe("Laporan tiket event");
    expect(eventsReport.summaryCards[0].value).toBe("Rp 200.000");
    expect(eventsReport.summaryCards[2].value).toBe("Rp 40.000");
    expect(eventsReport.summaryCards[3].value).toBe("Rp 160.000");
    // No marketing claim about the payment gateway
    expect(JSON.stringify(eventsReport.reconciliationInfo)).not.toContain("Terintegrasi");
  });

  it("generates report categories with permission awareness", () => {
    const categoriesWithoutEvents = getReportCategories({
      ordersCount: 10,
      tenantsCount: 3,
      shiftsCount: 4,
      productsCount: 12,
      materialsCount: 8,
      logsCount: 20,
      canAccessEvents: false,
    });
    expect(categoriesWithoutEvents.some((c) => c.id === "EVENTS")).toBe(false);

    const categoriesWithEvents = getReportCategories({
      ordersCount: 10,
      tenantsCount: 3,
      shiftsCount: 4,
      productsCount: 12,
      materialsCount: 8,
      logsCount: 20,
      paidEventsCount: 5,
      canAccessEvents: true,
    });
    expect(categoriesWithEvents.some((c) => c.id === "EVENTS")).toBe(true);
    expect(categoriesWithEvents.find((c) => c.id === "EVENTS")?.count).toBe("5 Peserta");
  });
});
