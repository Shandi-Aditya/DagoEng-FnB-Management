import { describe, it, expect } from "vitest";
import {
  buildReportData,
  getReportCategories,
  getReportTypeBadgeTone,
  emptyReportMessage,
  eventPaymentMethodLabel,
  eventPaymentStatusLabel,
  eventCheckInLabel,
  auditModuleLabel,
  auditActionLabel,
  filterReportRows,
  isNumericReportCell,
  calculateReportSummaryMetrics,
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

  const mockProducts: any[] = [
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
      grossMarginPercent: 72 as any,
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
      grossMarginPercent: 72 as any,
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z",
    },
  ];

  const mockShifts: any[] = [
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

  const mockIngredients: any[] = [
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

  const mockEvents: any[] = [
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

  it("maps report types to semantic badge status tones", () => {
    expect(getReportTypeBadgeTone("SALES")).toBe("success");
    expect(getReportTypeBadgeTone("SETTLEMENT")).toBe("info");
    expect(getReportTypeBadgeTone("EVENTS")).toBe("warning");
    expect(getReportTypeBadgeTone("CLOSING")).toBe("neutral");
  });

  it("generates honest empty-state copy for reports without data and search", () => {
    const emptyMsg = emptyReportMessage("Singaraja", "01 Nov - 12 Nov 2026");
    expect(emptyMsg.title).toBe("Tidak ada data pada periode ini");
    expect(emptyMsg.description).toContain("Singaraja");
    expect(emptyMsg.description).toContain("01 Nov - 12 Nov 2026");

    const searchEmptyMsg = emptyReportMessage("Singaraja", "01 Nov - 12 Nov 2026", true);
    expect(searchEmptyMsg.title).toBe("Tidak ada data yang cocok");
    expect(searchEmptyMsg.description).toContain("Ubah kata kunci");
  });

  it("exposes numeric rawCount in report categories alongside count label", () => {
    const categories = getReportCategories({
      ordersCount: 12,
      tenantsCount: 4,
      shiftsCount: 3,
      productsCount: 15,
      materialsCount: 9,
      logsCount: 7,
      paidEventsCount: 6,
      canAccessEvents: true,
    });

    expect(categories.find((c) => c.id === "SALES")?.rawCount).toBe(12);
    expect(categories.find((c) => c.id === "SETTLEMENT")?.rawCount).toBe(4);
    expect(categories.find((c) => c.id === "EVENTS")?.rawCount).toBe(6);
    expect(categories.find((c) => c.id === "CLOSING")?.rawCount).toBe(3);
  });

  it("formats raw event payment, status, and check-in enums into Indonesian labels and rounds rupiah", () => {
    expect(eventPaymentMethodLabel("FREE")).toBe("Gratis");
    expect(eventPaymentMethodLabel("MANUAL_TRANSFER")).toBe("Transfer manual");
    expect(eventPaymentMethodLabel("QRIS")).toBe("QRIS");

    expect(eventPaymentStatusLabel("PAID")).toBe("Lunas");
    expect(eventPaymentStatusLabel("EXPIRED")).toBe("Kedaluwarsa");
    expect(eventPaymentStatusLabel("PENDING")).toBe("Menunggu");

    expect(eventCheckInLabel("CHECKED_IN")).toBe("Hadir");
    expect(eventCheckInLabel("REGISTERED")).toBe("Belum hadir");

    const fractionalEvent: EventTicketOrder = {
      ...mockEvents[0],
      id: "evt-frac",
      paymentMethod: "MANUAL_TRANSFER",
      paymentStatus: "EXPIRED",
      checkInStatus: "REGISTERED",
      totalPrice: 0.9,
      platformFeeAmount: 0.18,
      organizerRevenueAmount: 0.72,
    };

    const report = buildReportData({
      type: "EVENTS",
      scopeName: "Outlet Singaraja",
      orders: mockOrders,
      products: mockProducts,
      shifts: mockShifts,
      ingredients: mockIngredients,
      logs: mockLogs,
      eventBookings: [fractionalEvent],
    });

    expect(report.tableRows[0][5]).toBe("Transfer manual");
    expect(report.tableRows[0][6]).toBe("Kedaluwarsa");
    expect(report.tableRows[0][7]).toBe("Belum hadir");
    expect(report.tableRows[0][8]).toBe("Rp 1");
  });

  it("uses Indonesian category labels for INVENTORY and translated module/action labels for FINANCE_AUDIT", () => {
    const dairyIngredient: IngredientItem = {
      ...mockIngredients[0],
      category: "Dairy",
    };

    const invReport = buildReportData({
      type: "INVENTORY",
      scopeName: "Outlet Singaraja",
      orders: mockOrders,
      products: mockProducts,
      shifts: mockShifts,
      ingredients: [dairyIngredient],
      logs: mockLogs,
    });
    expect(invReport.tableRows[0][1]).toBe("Susu dan olahan");

    expect(auditModuleLabel("FINANCE")).toBe("Keuangan");
    expect(auditModuleLabel("COMMERCIAL")).toBe("Komersial");
    expect(auditActionLabel("OPEN_SHIFT")).toBe("Buka shift");

    const auditReport = buildReportData({
      type: "FINANCE_AUDIT",
      scopeName: "Outlet Singaraja",
      orders: mockOrders,
      products: mockProducts,
      shifts: mockShifts,
      ingredients: mockIngredients,
      logs: [{ ...mockLogs[0], module: "FINANCE", action: "OPEN_SHIFT" }],
    });
    expect(auditReport.tableRows[0][2]).toBe("Keuangan");
    expect(auditReport.tableRows[0][3]).toBe("Buka shift");
  });

  it("filters report rows case-insensitively without mutating source array and detects numeric cells", () => {
    const rows: (string | number)[][] = [
      ["ORD-001", "Budi Santoso", "Rp 57.500"],
      ["ORD-002", "Siti Rahma", "Rp 28.000"],
    ];

    expect(filterReportRows(rows, "")).toHaveLength(2);
    expect(filterReportRows(rows, "siti")).toHaveLength(1);
    expect(filterReportRows(rows, "57.500")).toHaveLength(1);
    expect(filterReportRows(rows, "tidak-ada")).toHaveLength(0);
    expect(rows).toHaveLength(2);

    expect(isNumericReportCell(42)).toBe(true);
    expect(isNumericReportCell("Rp 100.000")).toBe(true);
    expect(isNumericReportCell("-Rp 5.000")).toBe(true);
    expect(isNumericReportCell("72.0%")).toBe(true);
    expect(isNumericReportCell("Budi Santoso")).toBe(false);
  });

  it("calculates summary metrics aggregating count and amounts from numeric cells", () => {
    const rows: (string | number)[][] = [
      ["ORD-001", "Budi", "Rp 50.000", "Rp 5.000"],
      ["ORD-002", "Siti", "Rp 30.000", "Rp 3.000"],
      ["ORD-003", "Andi", "-", "0"],
    ];

    const metrics = calculateReportSummaryMetrics(rows, 2);
    expect(metrics.count).toBe(3);
    expect(metrics.totalAmount).toBe(80000);
    expect(metrics.formattedTotal).toBe("Rp 80.000");

    const emptyMetrics = calculateReportSummaryMetrics([], 2);
    expect(emptyMetrics.count).toBe(0);
    expect(emptyMetrics.totalAmount).toBe(0);
    expect(emptyMetrics.formattedTotal).toBe("Rp 0");
  });
});

