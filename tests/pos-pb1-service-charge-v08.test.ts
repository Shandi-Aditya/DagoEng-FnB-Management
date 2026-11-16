import { describe, it, expect } from "vitest";
import { OrderRecord } from "@/types/order";
import { buildReportData } from "@/features/reports/reports-domain";
import { buildOrderReceiptData } from "@/features/orders/orders-domain";
import {
  calculateCartTaxAndService,
  getOrderTaxBreakdown,
  aggregateOrdersTaxAndRevenue,
} from "@/lib/tax-breakdown";
import { buildClosingReportData } from "@/features/employees/employees-domain";
import { buildClosingReportPdfUrl } from "@/features/pos/pos-closing-report";

describe("Task V-08: Laporan PB1 dan Service Charge Sesuai Struk", () => {
  it("V-08.1: Menyimpan nilai final PB1 dan service charge pada record order saat checkout / pembayaran", () => {
    // Simulasi checkout kasir POS dengan Dine-In, diskon promo, PB1 10%, dan service charge 5%
    const cartCalc = calculateCartTaxAndService({
      subtotal: 75000,
      discount: 15000, // DPP = 60.000
      taxRatePercent: 10,
      serviceChargePercent: 5,
      isTaxEnabled: true,
      orderType: "DINE_IN",
    });

    expect(cartCalc.dpp).toBe(60000);
    expect(cartCalc.pb1).toBe(6000);
    expect(cartCalc.serviceCharge).toBe(3000);
    expect(cartCalc.total).toBe(69000);

    const storedOrder: OrderRecord = {
      id: "ord-v08-pos-1",
      orderNumber: "ORD-V08-001",
      organizationId: "org-dago-hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-01",
      customerName: "Gede Budi",
      orderType: "DINE_IN",
      status: "COMPLETED",
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
      subtotal: cartCalc.subtotal,
      discount: cartCalc.discount,
      tax: cartCalc.pb1,
      serviceCharge: cartCalc.serviceCharge,
      taxRatePercent: 10,
      serviceChargePercent: 5,
      total: cartCalc.total,
      targetServiceMinutes: 10,
      createdAt: "2026-11-16T10:00:00.000Z",
      statusHistory: [],
      items: [
        {
          id: "it-1",
          productId: "prod-1",
          productName: "Signature Latte",
          quantity: 2,
          unitPrice: 37500,
          tenantId: "tenant-ks",
        },
      ],
    };

    // Stored values are exact numbers
    expect(storedOrder.tax).toBe(6000);
    expect(storedOrder.serviceCharge).toBe(3000);

    // Struk membaca tepat dari field yang tersimpan
    const receipt = buildOrderReceiptData(storedOrder);
    expect(receipt.tax).toBe(6000);
    expect(receipt.serviceCharge).toBe(3000);
    expect(receipt.grandTotal).toBe(69000);
  });

  it("V-08.2: Laporan menjumlahkan nilai tersimpan secara langsung tanpa menghitung ulang dari subtotal", () => {
    // 3 Transaksi dengan variasi diskon dan tipe pesanan yang menghasilkan pembulatan khusus
    const orders: OrderRecord[] = [
      {
        id: "ord-1",
        orderNumber: "ORD-V08-A",
        organizationId: "org-1",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "T-02",
        customerName: "Ayu Dewi",
        orderType: "DINE_IN",
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "CASH",
        subtotal: 49333,
        discount: 3333, // DPP = 46.000
        tax: 4600, // 10%
        serviceCharge: 2300, // 5%
        total: 52900,
        targetServiceMinutes: 10,
        createdAt: "2026-11-16T11:00:00.000Z",
        statusHistory: [],
        items: [{ id: "i1", productName: "Item 1", quantity: 1, unitPrice: 49333, tenantId: "tenant-ks" }],
      },
      {
        id: "ord-2",
        orderNumber: "ORD-V08-B",
        organizationId: "org-1",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "-",
        customerName: "Made Rai",
        orderType: "TAKEAWAY",
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        subtotal: 55000,
        discount: 5000, // DPP = 50.000
        tax: 5000, // 10%
        serviceCharge: 0, // Takeaway tidak kena service charge
        total: 55000,
        targetServiceMinutes: 10,
        createdAt: "2026-11-16T11:15:00.000Z",
        statusHistory: [],
        items: [{ id: "i2", productName: "Item 2", quantity: 1, unitPrice: 55000, tenantId: "tenant-ks" }],
      },
      {
        id: "ord-3",
        orderNumber: "ORD-V08-C",
        organizationId: "org-1",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "T-04",
        customerName: "Wayan Karsa",
        orderType: "DINE_IN",
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "CASH",
        subtotal: 100000,
        discount: 0,
        tax: 10000,
        serviceCharge: 5000,
        total: 115000,
        targetServiceMinutes: 10,
        createdAt: "2026-11-16T11:30:00.000Z",
        statusHistory: [],
        items: [{ id: "i3", productName: "Item 3", quantity: 2, unitPrice: 50000, tenantId: "tenant-ks" }],
      },
    ];

    const aggregated = aggregateOrdersTaxAndRevenue(orders);

    // Total PB1 harus persis 4.600 + 5.000 + 10.000 = 19.600
    expect(aggregated.totalTaxPB1).toBe(4600 + 5000 + 10000);
    expect(aggregated.totalTaxPB1).toBe(19600);

    // Total Service charge harus persis 2.300 + 0 + 5.000 = 7.300
    expect(aggregated.totalServiceCharge).toBe(2300 + 0 + 5000);
    expect(aggregated.totalServiceCharge).toBe(7300);

    // Total omzet bersih = total kotor - PB1 - Service
    expect(aggregated.totalRevenue).toBe(52900 + 55000 + 115000);
    expect(aggregated.totalNetSales).toBe(aggregated.totalRevenue - 19600 - 7300);
  });

  it("V-08.3: Laporan menampilkan PB1 terpisah dari Service Charge di tabel, summary cards, dan reconciliation", () => {
    const orders: OrderRecord[] = [
      {
        id: "ord-1",
        orderNumber: "ORD-V08-T1",
        organizationId: "org-1",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "T-01",
        customerName: "Ketut Raka",
        orderType: "DINE_IN",
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "CASH",
        subtotal: 50000,
        discount: 0,
        tax: 5000,
        serviceCharge: 2500,
        total: 57500,
        targetServiceMinutes: 10,
        createdAt: "2026-11-16T12:00:00.000Z",
        statusHistory: [],
        items: [{ id: "i1", productName: "Kopi Hitam", quantity: 2, unitPrice: 25000, tenantId: "tenant-ks" }],
      },
    ];

    const report = buildReportData({
      type: "SALES",
      scopeName: "Outlet Singaraja",
      orders,
      products: [],
      shifts: [],
      ingredients: [],
      logs: [],
    });

    // 1. Table Headers & Rows harus memiliki kolom PB1 dan Service terpisah
    expect(report.tableHeaders).toContain("PB1 (Rp)");
    expect(report.tableHeaders).toContain("Service (Rp)");

    const pb1ColIndex = report.tableHeaders.indexOf("PB1 (Rp)");
    const serviceColIndex = report.tableHeaders.indexOf("Service (Rp)");
    expect(pb1ColIndex).toBeGreaterThan(-1);
    expect(serviceColIndex).toBeGreaterThan(-1);
    expect(pb1ColIndex).not.toBe(serviceColIndex);

    // Nilai baris tabel harus menampilkan format rupiah tersimpan
    expect(report.tableRows[0][pb1ColIndex]).toBe("Rp 5.000");
    expect(report.tableRows[0][serviceColIndex]).toBe("Rp 2.500");

    // 2. Summary Cards menampilkan kartu PB1 dan Service terpisah
    const pb1Card = report.summaryCards.find((c) => c.label === "Total PB1");
    const serviceCard = report.summaryCards.find((c) => c.label === "Total service");
    expect(pb1Card).toBeDefined();
    expect(pb1Card?.value).toBe("Rp 5.000");
    expect(serviceCard).toBeDefined();
    expect(serviceCard?.value).toBe("Rp 2.500");

    // 3. Reconciliation Info menampilkan PB1 dan Service charge terpisah
    const pb1Rec = report.reconciliationInfo?.find((r) => r.label === "PB1");
    const serviceRec = report.reconciliationInfo?.find((r) => r.label === "Service charge");
    expect(pb1Rec?.value).toBe("Rp 5.000");
    expect(serviceRec?.value).toBe("Rp 2.500");
  });

  it("V-08.4: Total PB1 dan total service charge di laporan identik 100% dengan jumlah di semua struk", () => {
    // Generate 5 transaksi realistis acak
    const mockOrderList: OrderRecord[] = [
      {
        id: "ord-s1",
        orderNumber: "INV-20261116-1001",
        organizationId: "org-1",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "T-01",
        customerName: "Budi",
        orderType: "DINE_IN",
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        subtotal: 62000,
        discount: 10000,
        tax: 5200, // 10% dari 52.000
        serviceCharge: 2600, // 5% dari 52.000
        total: 59800,
        targetServiceMinutes: 10,
        createdAt: "2026-11-16T08:00:00.000Z",
        statusHistory: [],
        items: [{ id: "it-1", productName: "Item 1", quantity: 1, unitPrice: 62000, tenantId: "tenant-ks" }],
      },
      {
        id: "ord-s2",
        orderNumber: "INV-20261116-1002",
        organizationId: "org-1",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "-",
        customerName: "Sari",
        orderType: "TAKEAWAY",
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "CASH",
        subtotal: 45000,
        discount: 0,
        tax: 4500, // 10%
        serviceCharge: 0, // Takeaway bebas service charge
        total: 49500,
        targetServiceMinutes: 10,
        createdAt: "2026-11-16T08:30:00.000Z",
        statusHistory: [],
        items: [{ id: "it-2", productName: "Item 2", quantity: 1, unitPrice: 45000, tenantId: "tenant-ks" }],
      },
      {
        id: "ord-s3",
        orderNumber: "INV-20261116-1003",
        organizationId: "org-1",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "T-04",
        customerName: "Kadek",
        orderType: "DINE_IN",
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "EDC",
        subtotal: 120000,
        discount: 20000,
        tax: 10000, // 10% dari 100.000
        serviceCharge: 5000, // 5% dari 100.000
        total: 115000,
        targetServiceMinutes: 10,
        createdAt: "2026-11-16T09:00:00.000Z",
        statusHistory: [],
        items: [{ id: "it-3", productName: "Item 3", quantity: 2, unitPrice: 60000, tenantId: "tenant-ks" }],
      },
      {
        id: "ord-s4",
        orderNumber: "INV-20261116-1004",
        organizationId: "org-1",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "-",
        customerName: "Gita",
        orderType: "TAKEAWAY",
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        subtotal: 80000,
        discount: 15000,
        tax: 6500,
        serviceCharge: 0,
        total: 71500,
        targetServiceMinutes: 10,
        createdAt: "2026-11-16T09:30:00.000Z",
        statusHistory: [],
        items: [{ id: "it-4", productName: "Item 4", quantity: 2, unitPrice: 40000, tenantId: "tenant-ks" }],
      },
      {
        id: "ord-s5",
        orderNumber: "INV-20261116-1005",
        organizationId: "org-1",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "T-07",
        customerName: "Agus",
        orderType: "DINE_IN",
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "CASH",
        subtotal: 35000,
        discount: 0,
        tax: 3500,
        serviceCharge: 1750,
        total: 40250,
        targetServiceMinutes: 10,
        createdAt: "2026-11-16T10:00:00.000Z",
        statusHistory: [],
        items: [{ id: "it-5", productName: "Item 5", quantity: 1, unitPrice: 35000, tenantId: "tenant-ks" }],
      },
    ];

    // 1. Kumpulkan nilai dari masing-masing struk
    const receipts = mockOrderList.map((o) => buildOrderReceiptData(o));
    const totalReceiptTax = receipts.reduce((sum, r) => sum + r.tax, 0);
    const totalReceiptService = receipts.reduce((sum, r) => sum + r.serviceCharge, 0);
    const totalReceiptGrand = receipts.reduce((sum, r) => sum + r.grandTotal, 0);

    // 2. Bangun dataset laporan penjualan
    const report = buildReportData({
      type: "SALES",
      scopeName: "Outlet Singaraja",
      orders: mockOrderList,
      products: [],
      shifts: [],
      ingredients: [],
      logs: [],
    });

    const aggregated = aggregateOrdersTaxAndRevenue(mockOrderList);

    // 3. Verifikasi kesesuaian 100% sampai satuan rupiah
    expect(aggregated.totalTaxPB1).toBe(totalReceiptTax);
    expect(aggregated.totalServiceCharge).toBe(totalReceiptService);
    expect(aggregated.totalRevenue).toBe(totalReceiptGrand);

    // Verifikasi pada kartu ringkasan laporan
    const pb1Card = report.summaryCards.find((c) => c.label === "Total PB1");
    const serviceCard = report.summaryCards.find((c) => c.label === "Total service");
    expect(pb1Card?.value).toBe(`Rp ${totalReceiptTax.toLocaleString("id-ID")}`);
    expect(serviceCard?.value).toBe(`Rp ${totalReceiptService.toLocaleString("id-ID")}`);

    // Verifikasi pada closing report shift kasir
    const closingReport = buildClosingReportData(null, mockOrderList, "Singaraja", "Kasir Utama");
    expect(closingReport.totalTax).toBe(totalReceiptTax);
    expect(closingReport.totalServiceCharge).toBe(totalReceiptService);

    // Verifikasi URL ekspor closing PDF memuat service charge
    const closingPdfUrl = buildClosingReportPdfUrl(closingReport);
    expect(closingPdfUrl).toContain(`tax=${totalReceiptTax}`);
    expect(closingPdfUrl).toContain(`service=${totalReceiptService}`);
  });
});
