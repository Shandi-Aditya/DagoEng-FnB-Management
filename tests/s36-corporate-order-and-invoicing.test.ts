import fs from "fs";
import path from "path";
import os from "os";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { buildReportData, extractAvailableReportCompanies } from "@/features/reports/reports-domain";
import { formatOrderCustomerName } from "@/features/orders/orders-domain";
import { calculateMixedCartTaxAndService } from "@/lib/tax-breakdown";
import { writePersistentData } from "@/lib/persistent-storage";
import * as serverAuth from "@/lib/server-auth";
import { PUT as putOrders } from "@/app/api/orders/route";
import { DEFAULT_CORPORATE_DRAFT, type OrderRecord, type CorporateOrderInfo } from "@/types/order";
import type { CoworkingBooking } from "@/types/coworking";

describe("S-36 Corporate Order, Bundling, Invoicing & Report Filtering", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "s36-corp-"));
    process.env.DATA_DIR_OVERRIDE = tempDir;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.DATA_DIR_OVERRIDE;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    vi.restoreAllMocks();
  });

  const mockCorporateInfoPrepaid: CorporateOrderInfo = {
    companyName: "PT Dago Ekosistem Digital",
    picName: "Budi Santoso",
    picPhone: "081234567890",
    headcount: 12,
    billingType: "PREPAID",
    invoiceNumber: "INV-20261123-001",
    linkedSpaceName: "Meeting Room Singaraja",
  };

  const mockCorporateInfoInvoice: CorporateOrderInfo = {
    companyName: "Singaraja Tech Ventures",
    picName: "Siti Rahma",
    picPhone: "089876543210",
    headcount: 8,
    billingType: "INVOICE",
    invoiceNumber: "INV-20261123-002",
    invoiceDueDate: "2026-12-07",
    linkedSpaceName: "Meeting Room Singaraja",
    notes: "Tagihan net-14 hari via transfer bank",
  };

  const sampleCorporatePrepaidOrder: OrderRecord = {
    id: "ord-corp-001",
    organizationId: "org-dago",
    orderNumber: "20261123-001",
    outletId: "singaraja",
    outletName: "Singaraja",
    targetServiceMinutes: 15,
    orderType: "DINE_IN",
    tableNumber: "01",
    customerName: "PT Dago Ekosistem Digital (PIC: Budi Santoso)",
    items: [
      {
        id: "item-space-1",
        productId: "space-mr-1",
        productName: "Sewa Ruang Meeting: Singaraja Room",
        quantity: 2,
        unitPrice: 100000,
        itemType: "COWORKING",
        tenantId: "DAGO_HUB",
        coworkingMeta: {
          spaceId: "space-mr-1",
          spaceName: "Singaraja Room",
          spaceType: "MEETING_ROOM",
          durationHours: 2,
          startTime: "09:00",
          endTime: "11:00",
          bookingDate: "2026-11-23",
        },
      },
      {
        id: "item-fnb-1",
        productId: "prod-fnb-1",
        productName: "Paket Nasi Kotak Tim",
        quantity: 12,
        unitPrice: 25000,
        itemType: "FNB",
        tenantId: "tenant-ks",
      },
      {
        id: "item-fnb-2",
        productId: "prod-fnb-2",
        productName: "Kopi Susu Gula Aren",
        quantity: 12,
        unitPrice: 15000,
        itemType: "FNB",
        tenantId: "tenant-ks",
      },
    ],
    subtotal: 680000,
    tax: 48000,
    total: 728000,
    status: "COMPLETED",
    paymentStatus: "PAID",
    paymentMethod: "QRIS",
    createdAt: "2026-11-23T10:00:00.000Z",
    statusHistory: [
      {
        id: "hist-001",
        orderId: "ord-corp-001",
        fromStatus: "NEW",
        toStatus: "COMPLETED",
        timestamp: "2026-11-23T10:00:00.000Z",
        actorName: "Kasir",
      },
    ],
    corporateInfo: mockCorporateInfoPrepaid,
  };

  const sampleCorporateInvoiceOrder: OrderRecord = {
    id: "ord-corp-002",
    organizationId: "org-dago",
    orderNumber: "20261123-002",
    outletId: "singaraja",
    outletName: "Singaraja",
    targetServiceMinutes: 15,
    orderType: "DINE_IN",
    tableNumber: "02",
    customerName: "Singaraja Tech Ventures (PIC: Siti Rahma)",
    items: [
      {
        id: "item-space-2",
        productId: "space-mr-1",
        productName: "Sewa Ruang Meeting: Singaraja Room",
        quantity: 4,
        unitPrice: 100000,
        itemType: "COWORKING",
        tenantId: "DAGO_HUB",
        coworkingMeta: {
          spaceId: "space-mr-1",
          spaceName: "Singaraja Room",
          spaceType: "MEETING_ROOM",
          durationHours: 4,
          startTime: "09:00",
          endTime: "13:00",
          bookingDate: "2026-11-23",
        },
      },
      {
        id: "item-fnb-3",
        productId: "prod-fnb-3",
        productName: "Coffee Break & Snack Box",
        quantity: 8,
        unitPrice: 30000,
        itemType: "FNB",
        tenantId: "tenant-ks",
      },
    ],
    subtotal: 640000,
    tax: 24000,
    total: 664000,
    status: "COMPLETED",
    paymentStatus: "PENDING",
    paymentMethod: "INVOICE",
    createdAt: "2026-11-23T11:00:00.000Z",
    statusHistory: [
      {
        id: "hist-002",
        orderId: "ord-corp-002",
        fromStatus: "NEW",
        toStatus: "COMPLETED",
        timestamp: "2026-11-23T11:00:00.000Z",
        actorName: "Kasir",
      },
    ],
    corporateInfo: mockCorporateInfoInvoice,
  };

  const sampleRegularOrder: OrderRecord = {
    id: "ord-reg-003",
    organizationId: "org-dago",
    orderNumber: "20261123-003",
    outletId: "singaraja",
    outletName: "Singaraja",
    targetServiceMinutes: 15,
    orderType: "DINE_IN",
    customerName: "Pelanggan Biasa",
    tableNumber: "05",
    items: [
      {
        id: "item-fnb-4",
        productId: "prod-fnb-4",
        productName: "Espresso Single",
        quantity: 1,
        unitPrice: 20000,
        itemType: "FNB",
        tenantId: "tenant-ks",
      },
    ],
    subtotal: 20000,
    tax: 2000,
    total: 22000,
    status: "COMPLETED",
    paymentStatus: "PAID",
    paymentMethod: "CASH",
    createdAt: "2026-11-23T12:00:00.000Z",
    statusHistory: [
      {
        id: "hist-003",
        orderId: "ord-reg-003",
        fromStatus: "NEW",
        toStatus: "COMPLETED",
        timestamp: "2026-11-23T12:00:00.000Z",
        actorName: "Kasir",
      },
    ],
  };

  const sampleStandaloneCoworkingBooking: CoworkingBooking = {
    id: "cw-corp-standalone",
    bookingCode: "CW-CORP-01",
    guestName: "Agus Pratama",
    guestPhone: "08111222333",
    guestEmail: "agus@example.com",
    company: "PT Dago Ekosistem Digital",
    spaceId: "space-mr-1",
    spaceName: "Meeting Room Singaraja",
    spaceType: "MEETING_ROOM",
    bookingType: "HOURLY",
    date: "2026-11-23",
    startTime: "14:00",
    endTime: "16:00",
    duration: 2,
    price: 100000,
    totalAmount: 200000,
    paidAmount: 200000,
    paymentMethod: "TRANSFER",
    paymentStatus: "PAID",
    checkInStatus: "COMPLETED",
    createdAt: "2026-11-23T08:00:00.000Z",
  };

  const sampleBundledCoworkingBooking: CoworkingBooking = {
    id: "cw-corp-bundled",
    bookingCode: "CW-BUNDLE-01",
    guestName: "Budi Santoso",
    guestPhone: "081234567890",
    guestEmail: "budi@example.com",
    company: "PT Dago Ekosistem Digital",
    spaceId: "space-mr-1",
    spaceName: "Meeting Room Singaraja",
    spaceType: "MEETING_ROOM",
    bookingType: "HOURLY",
    date: "2026-11-23",
    startTime: "09:00",
    endTime: "11:00",
    duration: 2,
    price: 100000,
    totalAmount: 200000,
    paidAmount: 200000,
    paymentMethod: "QRIS",
    paymentStatus: "PAID",
    checkInStatus: "CHECKED_IN",
    linkedOrderId: "20261123-001",
    billedViaPosOrder: true,
    createdAt: "2026-11-23T10:00:00.000Z",
  };

  it("proves PB1 tax exemption for COWORKING space items in mixed-cart calculation", () => {
    const taxItems = sampleCorporatePrepaidOrder.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productName: it.productName,
      itemType: it.itemType,
      tenantId: it.tenantId,
      coworkingMeta: it.coworkingMeta,
      price: it.unitPrice,
      quantity: it.quantity,
    }));

    const result = calculateMixedCartTaxAndService(taxItems, {
      fnbTaxRatePercent: 10,
      isFnbTaxEnabled: true,
      coworkingTaxRatePercent: 0,
      isCoworkingTaxEnabled: false,
      fnbServiceChargePercent: 0,
      coworkingServiceChargePercent: 0,
      discount: 0,
    });

    // F&B total: 300,000 + 180,000 = 480,000 -> PB1 10% = 48,000
    // Co-working total: 200,000 -> PB1 0% = 0
    expect(result.pb1).toBe(48000);
    expect(result.dpp).toBe(680000);
    expect(result.total).toBe(728000);
  });

  it("eliminates double counting of bundled coworking revenue in buildReportData('SALES')", () => {
    const allOrders = [
      sampleCorporatePrepaidOrder,
      sampleCorporateInvoiceOrder,
      sampleRegularOrder,
    ];
    // Both standalone booking (200k) and bundled booking (200k)
    const allCoworking = [
      sampleStandaloneCoworkingBooking,
      sampleBundledCoworkingBooking,
    ];

    const reportData = buildReportData({
      type: "SALES",
      scopeName: "Singaraja",
      orders: allOrders,
      products: [],
      shifts: [],
      ingredients: [],
      logs: [],
      coworkingBookings: allCoworking,
      companyName: "PT Dago Ekosistem Digital",
    });

    // Subtitle must reflect the active company filter
    expect(reportData.subtitle).toContain("Filter perusahaan: PT Dago Ekosistem Digital");

    // Table rows should include sampleCorporatePrepaidOrder and sampleStandaloneCoworkingBooking.
    // sampleBundledCoworkingBooking must be excluded because linkedOrderId / billedViaPosOrder is true.
    expect(reportData.tableRows.length).toBe(2);
    expect(reportData.tableRows.some((r) => r[0] === sampleCorporatePrepaidOrder.orderNumber)).toBe(true);
    expect(reportData.tableRows.some((r) => r[0] === sampleStandaloneCoworkingBooking.bookingCode)).toBe(true);
    expect(reportData.tableRows.some((r) => r[0] === sampleBundledCoworkingBooking.bookingCode)).toBe(false);

    // Revenue calculation:
    // sampleCorporatePrepaidOrder: total 728,000 (includes 200,000 room rental)
    // sampleStandaloneCoworkingBooking: total 200,000
    // Total: 728,000 + 200,000 = 928,000 (NOT 1,128,000!)
    const summaryRevenue = reportData.summaryCards.find((c) => c.label === "Omzet");
    expect(summaryRevenue).toBeDefined();
    expect(summaryRevenue?.value).toContain("928.000");
  });

  it("allows CASHIER to settle COMPLETED + INVOICE order via PUT /api/orders and returns HTTP 200", async () => {
    await writePersistentData("pos_orders.json", [sampleCorporateInvoiceOrder]);

    vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
      isAuthenticated: true,
      userId: "user-cashier-1",
      name: "Kasir Bertugas",
      role: "CASHIER",
      scopeLevel: "OUTLET",
      permissions: [],
    });

    const settlementPayload = {
      ...sampleCorporateInvoiceOrder,
      paymentStatus: "PAID",
      paymentMethod: "TRANSFER",
    };

    const req = new NextRequest("http://localhost:3000/api/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settlementPayload),
    });

    const res = await putOrders(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.order.paymentStatus).toBe("PAID");
    expect(json.order.paymentMethod).toBe("TRANSFER");
  });

  it("rejects unauthorized price manipulation during cashier settlement with HTTP 400 or 403", async () => {
    await writePersistentData("pos_orders.json", [sampleCorporateInvoiceOrder]);

    vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
      isAuthenticated: true,
      userId: "user-cashier-1",
      name: "Kasir Bertugas",
      role: "CASHIER",
      scopeLevel: "OUTLET",
      permissions: [],
    });

    // Cashier attempts to manipulate the total price during settlement
    const manipulatedPayload = {
      ...sampleCorporateInvoiceOrder,
      total: 999999,
      paymentStatus: "PAID",
      paymentMethod: "TRANSFER",
    };

    const req = new NextRequest("http://localhost:3000/api/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manipulatedPayload),
    });

    const res = await putOrders(req);
    expect([400, 403]).toContain(res.status);
  });

  it("filters sales report and product report correctly by company name", () => {
    const allOrders = [
      sampleCorporatePrepaidOrder,
      sampleCorporateInvoiceOrder,
      sampleRegularOrder,
    ];
    const allCoworking = [sampleStandaloneCoworkingBooking];

    const sampleProducts = [
      {
        id: "prod-fnb-1",
        name: "Paket Nasi Kotak Tim",
        category: "Food",
        basePrice: 25000,
        cogsEstimate: 15000,
        tenantId: "tenant-ks",
      },
      {
        id: "prod-fnb-4",
        name: "Espresso Single",
        category: "Beverage",
        basePrice: 20000,
        cogsEstimate: 8000,
        tenantId: "tenant-ks",
      },
    ];

    // Filter PRODUCTS report by "PT Dago Ekosistem Digital"
    const productReport = buildReportData({
      type: "PRODUCTS",
      scopeName: "Singaraja",
      orders: allOrders,
      products: sampleProducts as any,
      shifts: [],
      ingredients: [],
      logs: [],
      coworkingBookings: allCoworking,
      companyName: "PT Dago Ekosistem Digital",
    });

    expect(productReport.subtitle).toContain("Filter perusahaan: PT Dago Ekosistem Digital");
    // Should include items from sampleCorporatePrepaidOrder (Paket Nasi Kotak Tim)
    expect(productReport.tableRows.some((r) => String(r[1]).includes("Paket Nasi Kotak Tim"))).toBe(true);
    // Should not include Espresso Single from sampleRegularOrder
    expect(productReport.tableRows.some((r) => String(r[1]).includes("Espresso Single"))).toBe(false);
  });

  it("extracts available report companies uniquely and cleanly", () => {
    const companies = extractAvailableReportCompanies(
      [sampleCorporatePrepaidOrder, sampleCorporateInvoiceOrder, sampleRegularOrder],
      [sampleStandaloneCoworkingBooking]
    );
    expect(companies).toEqual(["PT Dago Ekosistem Digital", "Singaraja Tech Ventures"]);
  });

  it("formats corporate customer name cleanly via formatOrderCustomerName", () => {
    expect(formatOrderCustomerName(sampleCorporatePrepaidOrder)).toBe(
      "PT Dago Ekosistem Digital (PIC: Budi Santoso)"
    );
    expect(formatOrderCustomerName(sampleRegularOrder)).toBe("Pelanggan Biasa");
  });

  it("provides a safe default corporate draft object", () => {
    expect(DEFAULT_CORPORATE_DRAFT.enabled).toBe(false);
    expect(DEFAULT_CORPORATE_DRAFT.companyName).toBe("");
    expect(DEFAULT_CORPORATE_DRAFT.billingType).toBe("PREPAID");
    expect(DEFAULT_CORPORATE_DRAFT.headcount).toBe(1);
    expect(DEFAULT_CORPORATE_DRAFT.meetingDurationHours).toBe(1);
  });
});
