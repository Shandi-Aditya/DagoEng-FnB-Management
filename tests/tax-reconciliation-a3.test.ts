import { describe, it, expect } from "vitest";
import { OrderRecord } from "@/types/order";

// Function simulating report aggregation of stored taxes
export function aggregateReportTaxAndService(orders: OrderRecord[]): {
  totalRevenue: number;
  totalTaxPB1: number;
  totalServiceCharge: number;
  totalDiscounts: number;
} {
  const validOrders = orders.filter((o) => o.status !== "CANCELLED");

  const totalRevenue = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalTaxPB1 = validOrders.reduce((sum, o) => sum + (o.tax || 0), 0);
  const totalServiceCharge = validOrders.reduce((sum, o) => sum + (o.serviceCharge || 0), 0);
  const totalDiscounts = validOrders.reduce((sum, o) => sum + (o.discount || 0), 0);

  return {
    totalRevenue,
    totalTaxPB1,
    totalServiceCharge,
    totalDiscounts,
  };
}

describe("QA Handover A3 — Sinkronisasi Pajak Laporan vs Struk (POS-34)", () => {
  it("A3.1: Struk dan laporan menghasilkan nilai PB1 dan Service Charge yang identik persis", () => {
    // Simulasi pesanan ORD-POS-5612 dari QA Report
    const subtotal = 49000;
    const taxRatePercent = 10;
    const serviceRatePercent = 5;

    const receiptPB1 = Math.round(subtotal * (taxRatePercent / 100)); // 4.900
    const receiptService = Math.round(subtotal * (serviceRatePercent / 100)); // 2.450
    const grandTotal = subtotal + receiptPB1 + receiptService; // 56.350

    expect(receiptPB1).toBe(4900);
    expect(receiptService).toBe(2450);
    expect(grandTotal).toBe(56350);

    // Order record yang disimpan di sistem
    const storedOrder: OrderRecord = {
      id: "ord-pos-5612",
      orderNumber: "ORD-POS-5612",
      organizationId: "org-dago-hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-02",
      customerName: "Ketut Dian",
      orderType: "DINE_IN",
      status: "COMPLETED",
      items: [
        {
          id: "it-1",
          productId: "prod-1",
          productName: "Menu F&B Kopi Senja",
          quantity: 1,
          unitPrice: 49000,
        },
      ],
      subtotal,
      discount: 0,
      tax: receiptPB1, // Disimpan terpisah sebagai nilai PB1 final
      serviceCharge: receiptService, // Disimpan terpisah sebagai nilai service final
      taxRatePercent,
      serviceChargePercent: serviceRatePercent,
      total: grandTotal,
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      targetServiceMinutes: 10,
      createdAt: new Date().toISOString(),
      statusHistory: [],
    };

    // Jalankan agregasi laporan
    const report = aggregateReportTaxAndService([storedOrder]);

    // Verifikasi bahwa laporan menghasilkan PB1 Rp 4.900 (bukan Rp 5.635)
    expect(report.totalTaxPB1).toBe(4900);
    expect(report.totalTaxPB1).not.toBe(5635);

    // Verifikasi bahwa laporan menghasilkan Service Charge Rp 2.450 (bukan Rp 2.818)
    expect(report.totalServiceCharge).toBe(2450);
    expect(report.totalServiceCharge).not.toBe(2818);

    // Selisih antara struk dan laporan harus persis nol
    expect(report.totalTaxPB1 - receiptPB1).toBe(0);
    expect(report.totalServiceCharge - receiptService).toBe(0);
  });

  it("A3.2: Agregasi multi-order mengakumulasi nilai pajak tersimpan tanpa floating point drift", () => {
    const orders: OrderRecord[] = [
      {
        id: "ord-1",
        orderNumber: "ORD-1",
        organizationId: "org-1",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "T-01",
        customerName: "Guest 1",
        orderType: "DINE_IN",
        status: "COMPLETED",
        items: [],
        subtotal: 100000,
        tax: 10000,
        serviceCharge: 5000,
        total: 115000,
        paymentStatus: "PAID",
        targetServiceMinutes: 10,
        createdAt: new Date().toISOString(),
        statusHistory: [],
      },
      {
        id: "ord-2",
        orderNumber: "ORD-2",
        organizationId: "org-1",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "T-02",
        customerName: "Guest 2",
        orderType: "TAKEAWAY",
        status: "COMPLETED",
        items: [],
        subtotal: 50000,
        tax: 5000,
        serviceCharge: 0, // Takeaway no service charge
        total: 55000,
        paymentStatus: "PAID",
        targetServiceMinutes: 10,
        createdAt: new Date().toISOString(),
        statusHistory: [],
      },
    ];

    const report = aggregateReportTaxAndService(orders);
    expect(report.totalTaxPB1).toBe(15000);
    expect(report.totalServiceCharge).toBe(5000);
    expect(report.totalRevenue).toBe(170000);
  });
});
