import { describe, expect, it } from "vitest";
import { buildReportData } from "@/features/reports/reports-domain";
import type { OrderRecord, CorporateOrderInfo } from "@/types/order";
import type { CoworkingBooking } from "@/types/coworking";

describe("S-36 Corporate Order, Bundling, Invoicing & Report Filtering", () => {
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
    orderNumber: "20261123-001",
    outletId: "singaraja",
    orderType: "DINE_IN",
    customerName: "PT Dago Ekosistem Digital (PIC: Budi Santoso)",
    items: [
      {
        id: "item-space-1",
        productId: "space-mr-1",
        productName: "Sewa Ruang Meeting: Singaraja Room",
        quantity: 2,
        unitPrice: 100000,
        subtotal: 200000,
        itemType: "COWORKING_SPACE",
      },
      {
        id: "item-fnb-1",
        productId: "prod-fnb-1",
        productName: "Paket Nasi Kotak Tim",
        quantity: 12,
        unitPrice: 25000,
        subtotal: 300000,
        itemType: "FNB",
      },
      {
        id: "item-fnb-2",
        productId: "prod-fnb-2",
        productName: "Kopi Susu Gula Aren",
        quantity: 12,
        unitPrice: 15000,
        subtotal: 180000,
        itemType: "FNB",
      },
    ],
    subtotal: 680000,
    tax: 68000,
    total: 748000,
    status: "COMPLETED",
    paymentStatus: "PAID",
    paymentMethod: "QRIS",
    createdAt: "2026-11-23T10:00:00.000Z",
    corporateInfo: mockCorporateInfoPrepaid,
  };

  const sampleCorporateInvoiceOrder: OrderRecord = {
    id: "ord-corp-002",
    orderNumber: "20261123-002",
    outletId: "singaraja",
    orderType: "DINE_IN",
    customerName: "Singaraja Tech Ventures (PIC: Siti Rahma)",
    items: [
      {
        id: "item-space-2",
        productId: "space-mr-1",
        productName: "Sewa Ruang Meeting: Singaraja Room",
        quantity: 4,
        unitPrice: 100000,
        subtotal: 400000,
        itemType: "COWORKING_SPACE",
      },
      {
        id: "item-fnb-3",
        productId: "prod-fnb-3",
        productName: "Coffee Break & Snack Box",
        quantity: 8,
        unitPrice: 30000,
        subtotal: 240000,
        itemType: "FNB",
      },
    ],
    subtotal: 640000,
    tax: 64000,
    total: 704000,
    status: "COMPLETED",
    paymentStatus: "PENDING",
    paymentMethod: "INVOICE",
    createdAt: "2026-11-23T11:00:00.000Z",
    corporateInfo: mockCorporateInfoInvoice,
  };

  const sampleRegularOrder: OrderRecord = {
    id: "ord-reg-003",
    orderNumber: "20261123-003",
    outletId: "singaraja",
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
        subtotal: 20000,
        itemType: "FNB",
      },
    ],
    subtotal: 20000,
    tax: 2000,
    total: 22000,
    status: "COMPLETED",
    paymentStatus: "PAID",
    paymentMethod: "CASH",
    createdAt: "2026-11-23T12:00:00.000Z",
  };

  const sampleCorporateCoworkingBooking: CoworkingBooking = {
    id: "cw-corp-001",
    bookingCode: "CW-CORP-01",
    guestName: "Agus Pratama",
    phone: "08111222333",
    company: "PT Dago Ekosistem Digital",
    spaceId: "space-mr-1",
    spaceName: "Meeting Room Singaraja",
    spaceType: "MEETING_ROOM",
    date: "2026-11-23",
    startTime: "14:00",
    endTime: "16:00",
    duration: 2,
    subtotal: 200000,
    totalAmount: 220000,
    tax: 20000,
    paymentMethod: "TRANSFER",
    paymentStatus: "PAID",
    checkInStatus: "COMPLETED",
    createdAt: "2026-11-23T08:00:00.000Z",
  };

  it("should correctly represent a corporate order with meeting room bundling and F&B catering", () => {
    expect(sampleCorporatePrepaidOrder.corporateInfo?.companyName).toBe("PT Dago Ekosistem Digital");
    expect(sampleCorporatePrepaidOrder.corporateInfo?.billingType).toBe("PREPAID");
    expect(sampleCorporatePrepaidOrder.paymentStatus).toBe("PAID");
    expect(sampleCorporatePrepaidOrder.items).toHaveLength(3);

    // Verify meeting room bundling
    const spaceItem = sampleCorporatePrepaidOrder.items.find((it) => it.itemType === "COWORKING_SPACE");
    expect(spaceItem).toBeDefined();
    expect(spaceItem?.productName).toContain("Meeting");
    expect(spaceItem?.subtotal).toBe(200000);

    // Verify catering items
    const fnbItems = sampleCorporatePrepaidOrder.items.filter((it) => it.itemType === "FNB");
    expect(fnbItems).toHaveLength(2);
    const fnbTotal = fnbItems.reduce((acc, it) => acc + it.subtotal, 0);
    expect(fnbTotal).toBe(480000);

    // Subtotal & PB1 tax calculation
    expect(sampleCorporatePrepaidOrder.subtotal).toBe(680000);
    expect(sampleCorporatePrepaidOrder.tax).toBe(68000);
    expect(sampleCorporatePrepaidOrder.total).toBe(748000);
  });

  it("should support deferred invoice billing with net-14 terms and PENDING payment status", () => {
    expect(sampleCorporateInvoiceOrder.corporateInfo?.billingType).toBe("INVOICE");
    expect(sampleCorporateInvoiceOrder.paymentMethod).toBe("INVOICE");
    expect(sampleCorporateInvoiceOrder.paymentStatus).toBe("PENDING");
    expect(sampleCorporateInvoiceOrder.corporateInfo?.invoiceDueDate).toBe("2026-12-07");
    expect(sampleCorporateInvoiceOrder.corporateInfo?.notes).toContain("net-14");
  });

  it("should filter sales report by company name, including matching F&B orders and coworking bookings", () => {
    const allOrders = [
      sampleCorporatePrepaidOrder,
      sampleCorporateInvoiceOrder,
      sampleRegularOrder,
    ];
    const allCoworking = [sampleCorporateCoworkingBooking];

    // Filter report by "PT Dago Ekosistem Digital"
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

    // Table rows should only contain orders / bookings matching "PT Dago Ekosistem Digital"
    // (sampleCorporatePrepaidOrder + sampleCorporateCoworkingBooking)
    expect(reportData.tableRows.length).toBe(2);

    // Verify row for the corporate prepaid order
    const orderRow = reportData.tableRows.find((r) => r[0] === sampleCorporatePrepaidOrder.orderNumber);
    expect(orderRow).toBeDefined();
    // Customer column should display company tag
    expect(orderRow?.[1]).toContain("[PT Dago Ekosistem Digital]");

    // Verify row for the coworking booking
    const bookingRow = reportData.tableRows.find((r) => r[0] === sampleCorporateCoworkingBooking.bookingCode);
    expect(bookingRow).toBeDefined();

    // Verify regular order is NOT present
    const regularRow = reportData.tableRows.find((r) => r[0] === sampleRegularOrder.orderNumber);
    expect(regularRow).toBeUndefined();

    // Verify company total summary
    const summaryRevenue = reportData.summaryCards.find((c) => c.label === "Omzet");
    expect(summaryRevenue).toBeDefined();
    // Revenue should be prepaid order (748,000) + coworking booking (220,000) = 968,000
    expect(summaryRevenue?.value).toContain("968.000");
  });

  it("should include all companies and regular orders when companyName is 'ALL' or omitted", () => {
    const allOrders = [
      sampleCorporatePrepaidOrder,
      sampleCorporateInvoiceOrder,
      sampleRegularOrder,
    ];
    const allCoworking = [sampleCorporateCoworkingBooking];

    const reportDataAll = buildReportData({
      type: "SALES",
      scopeName: "Singaraja",
      orders: allOrders,
      products: [],
      shifts: [],
      ingredients: [],
      logs: [],
      coworkingBookings: allCoworking,
      companyName: "ALL",
    });

    // Subtitle should not have corporate filter tag
    expect(reportDataAll.subtitle).not.toContain("Filter perusahaan:");

    // Both settled paid orders (Prepaid corp + Regular) and paid coworking booking must be included
    expect(reportDataAll.tableRows.length).toBe(3);
    expect(reportDataAll.tableRows.some((r) => r[0] === sampleCorporatePrepaidOrder.orderNumber)).toBe(true);
    expect(reportDataAll.tableRows.some((r) => r[0] === sampleRegularOrder.orderNumber)).toBe(true);
    expect(reportDataAll.tableRows.some((r) => r[0] === sampleCorporateCoworkingBooking.bookingCode)).toBe(true);
  });
});
