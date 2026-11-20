import { describe, it, expect } from "vitest";
import {
  buildTransactionTemplateWorkbook,
  formatPeriodRange,
  resolveProductCategory,
} from "@/lib/transaction-export-template";
import type { OrderRecord } from "@/types/order";

describe("Task V-10: Export laporan transaksi sama persis dengan template", () => {
  const mockOrders: OrderRecord[] = [
    {
      id: "ord-1",
      orderNumber: "ORD-001",
      organizationId: "org-1",
      outletId: "outlet-1",
      outletName: "Dago Creative Hub",
      tableNumber: "1",
      customerName: "Wirawan",
      orderType: "DINE_IN",
      status: "COMPLETED",
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
      subtotal: 25000,
      discount: 3750,
      tax: 0,
      total: 21250,
      notes: "Less ice",
      createdAt: "2025-06-01T23:53:00",
      targetServiceMinutes: 15,
      statusHistory: [],
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          tenantId: "tenant-ks",
          productName: "Homebro's Special",
          quantity: 1,
          unitPrice: 25000,
        },
      ],
    },
    {
      id: "ord-2",
      orderNumber: "ORD-002",
      organizationId: "org-1",
      outletId: "outlet-1",
      outletName: "Dago Creative Hub",
      tableNumber: "2",
      customerName: "Arik",
      orderType: "DINE_IN",
      status: "COMPLETED",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      subtotal: 30000,
      discount: 0,
      tax: 0,
      total: 30000,
      createdAt: "2025-06-02T01:00:00",
      targetServiceMinutes: 15,
      statusHistory: [],
      items: [
        {
          id: "item-2",
          productId: "prod-2",
          tenantId: "tenant-kitchen",
          productName: "Rice Bowl Chicken",
          quantity: 2,
          unitPrice: 15000,
        },
      ],
    },
  ];

  it("formats date range string matching template format DD/MM/YYYY s/d DD/MM/YYYY", () => {
    const range = formatPeriodRange(mockOrders, "2025-06-01", "2025-06-30");
    expect(range).toBe("01/06/2025 s/d 30/06/2025");
  });

  it("resolves product category using master products lookup or heuristic fallback", () => {
    const cat1 = resolveProductCategory("prod-1", "Homebro's Special", [
      {
        id: "prod-1",
        name: "Homebro's Special",
        category: "Coffee & Espresso",
        basePrice: 25000,
        cogsEstimate: 10000,
        grossMarginPercent: "60%",
        status: "ACTIVE",
        outletId: "outlet-1",
        outletName: "Dago Creative Hub",
        isAvailable: true,
        tenantId: "tenant-ks",
        createdAt: "2025-06-01T00:00:00Z",
        updatedAt: "2025-06-01T00:00:00Z",
      },
    ]);
    expect(cat1).toBe("Coffee & Espresso");

    const cat2 = resolveProductCategory(undefined, "Air Mineral");
    expect(cat2).toBe("Minuman");
  });

  it("generates an ExcelJS workbook with exactly 3 sheets and matching sheet names", async () => {
    const wb = await buildTransactionTemplateWorkbook({
      orders: mockOrders,
      startDate: "2025-06-01",
      endDate: "2025-06-30",
    });

    const sheetNames = wb.worksheets.map((ws) => ws.name);
    expect(sheetNames).toEqual(["transaction", "transactionDetail", "tenantShares"]);
  });

  it("Sheet 1 (transaction) matches kop rows, exact headers, and data calculations", async () => {
    const wb = await buildTransactionTemplateWorkbook({
      orders: mockOrders,
      startDate: "2025-06-01",
      endDate: "2025-06-30",
    });

    const ws = wb.getWorksheet("transaction");
    expect(ws).toBeDefined();

    // Kop check
    expect(ws?.getCell("A1").value).toBe("DAGO CREATIVE HUB & COFFE LAB");
    expect(ws?.getCell("A2").value).toBe("Transaction Report");
    expect(ws?.getCell("A3").value).toBe("01/06/2025 s/d 30/06/2025");

    // Headers check on row 4
    const headers = [
      "datetime",
      "tax",
      "discount",
      "tax total",
      "discount total",
      "sub total",
      "total",
      "cust name",
      "table number",
      "note",
      "order type",
      "payment status",
      "qris",
      "qris total",
      "Grand Total",
    ];

    headers.forEach((h, idx) => {
      expect(ws?.getRow(4).getCell(idx + 1).value).toBe(h);
    });

    // Row 5 check (QRIS order with 15% discount)
    const row5 = ws?.getRow(5);
    expect(row5?.getCell(1).value).toBe("01/06/2025 23:53"); // datetime
    expect(row5?.getCell(2).value).toBe(0); // tax
    expect(row5?.getCell(3).value).toBe(15); // discount %
    expect(row5?.getCell(4).value).toBe(0); // tax total
    expect(row5?.getCell(5).value).toBe(3750); // discount total
    expect(row5?.getCell(6).value).toBe(25000); // sub total
    expect(row5?.getCell(7).value).toBe(21250); // total
    expect(row5?.getCell(8).value).toBe("Wirawan"); // cust name
    expect(row5?.getCell(9).value).toBe("1"); // table number
    expect(row5?.getCell(10).value).toBe("Less ice"); // note
    expect(row5?.getCell(11).value).toBe("dineIn"); // order type
    expect(row5?.getCell(12).value).toBe("qris"); // payment status
    expect(row5?.getCell(13).value).toBe("0.7%"); // qris
    expect(row5?.getCell(14).value).toBe(148.75); // qris total (21250 * 0.007)
    expect(row5?.getCell(15).value).toBe(21101.25); // Grand Total (21250 - 148.75)

    // Row 6 check (Cash order, 0 QRIS fee)
    const row6 = ws?.getRow(6);
    expect(row6?.getCell(12).value).toBe("cash");
    expect(row6?.getCell(13).value).toBe("");
    expect(row6?.getCell(14).value).toBe(0);
    expect(row6?.getCell(15).value).toBe(30000);
  });

  it("Sheet 2 (transactionDetail) matches headers, item breakdown, and tenant splits", async () => {
    const wb = await buildTransactionTemplateWorkbook({
      orders: mockOrders,
      startDate: "2025-06-01",
      endDate: "2025-06-30",
    });

    const ws = wb.getWorksheet("transactionDetail");
    expect(ws).toBeDefined();

    // Headers check on row 4
    const headers = [
      "Datetime",
      "Merchant",
      "Category Product",
      "Product",
      "Quantity",
      "Price",
      "Tax",
      "Discount",
      "Sub Total",
      "Total",
      "qris",
      "qris total",
      "Grand Total",
      "Share Tenant",
      "Share Dago",
      "Note",
      "Payment",
    ];

    headers.forEach((h, idx) => {
      expect(ws?.getRow(4).getCell(idx + 1).value).toBe(h);
    });

    // Row 5 item check
    const row5 = ws?.getRow(5);
    expect(row5?.getCell(1).value).toBe("01/06/2025 23:53");
    expect(row5?.getCell(2).value).toBe("Kopi Senja"); // resolved merchant
    expect(row5?.getCell(4).value).toBe("Homebro's Special");
    expect(row5?.getCell(5).value).toBe(1); // qty
    expect(row5?.getCell(6).value).toBe(25000); // price
    expect(row5?.getCell(8).value).toBe(3750); // discount
    expect(row5?.getCell(9).value).toBe(25000); // sub total
    expect(row5?.getCell(10).value).toBe(21250); // total
    expect(row5?.getCell(11).value).toBe("0.7%"); // qris
    expect(row5?.getCell(12).value).toBe(148.75); // qris total
    expect(row5?.getCell(13).value).toBe(21101.25); // grand total
    // Share tenant (85%) and Share Dago (15%)
    expect(row5?.getCell(14).value).toBe(17936.063); // 21101.25 * 0.85
    expect(row5?.getCell(15).value).toBe(3165.188); // 21101.25 * 0.15
    expect(row5?.getCell(16).value).toBe("Less ice"); // note
    expect(row5?.getCell(17).value).toBe("qris"); // payment
  });

  it("Sheet 3 (tenantShares) aggregates per merchant and has Grandtotal summary row", async () => {
    const wb = await buildTransactionTemplateWorkbook({
      orders: mockOrders,
      startDate: "2025-06-01",
      endDate: "2025-06-30",
    });

    const ws = wb.getWorksheet("tenantShares");
    expect(ws).toBeDefined();

    expect(ws?.getCell("A2").value).toBe("Tenant Shares");
    expect(ws?.getCell("A3").value).toBe("01/06/2025 s/d 30/06/2025");

    const headers = [
      "merchant",
      "tax total",
      "discount total",
      "subtotal",
      "total",
      "qris total",
      "grandtotal",
      "share tenant",
      "share dago",
    ];

    headers.forEach((h, idx) => {
      expect(ws?.getRow(4).getCell(idx + 1).value).toBe(h);
    });

    // Check last row is Grandtotal
    const lastRow = ws?.lastRow;
    expect(lastRow?.getCell(1).value).toBe("Grandtotal");

    // Subtotal sum: 25000 + 30000 = 55000
    expect(lastRow?.getCell(4).value).toBe(55000);
    // Total sum: 21250 + 30000 = 51250
    expect(lastRow?.getCell(5).value).toBe(51250);
    // QRIS total sum: 148.75 + 0 = 148.75
    expect(lastRow?.getCell(6).value).toBe(148.75);
    // Grandtotal sum: 21101.25 + 30000 = 51101.25
    expect(lastRow?.getCell(7).value).toBe(51101.25);
  });

  it("produces a valid OOXML .xlsx buffer with all 3 sheets and non-zero bytes", async () => {
    const wb = await buildTransactionTemplateWorkbook({
      orders: mockOrders,
      startDate: "2025-06-01",
      endDate: "2025-06-30",
    });

    const buffer = await wb.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(5000);
  });
});
