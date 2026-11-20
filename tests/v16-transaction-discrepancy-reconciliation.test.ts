import { describe, it, expect } from "vitest";
import {
  analyzeTransactionDiscrepancies,
  DiscrepancyCauseItem,
} from "@/features/reports/reconciliation-domain";
import { buildReportData } from "@/features/reports/reports-domain";
import { OrderRecord } from "@/types/order";
import { ShiftRecord } from "@/types/shift";

describe("Task V-16: Pelacakan Selisih Per Transaksi & Rekonsiliasi Tripartit", () => {
  const mockShifts: ShiftRecord[] = [
    {
      id: "shf-001",
      shiftName: "Shift Pagi (08:00 - 16:00)",
      assignedCashierId: "emp-01",
      assignedCashierName: "Budi Santoso",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      openingCash: 200000,
      expectedCash: 750000,
      actualCash: 700000,
      cashVariance: -50000,
      cashSales: 550000,
      nonCashSales: 0,
      refundAmount: 0,
      closingNotes: "Selisih uang kembalian receh tidak pas saat jam ramai",
      status: "NEEDS_RECONCILIATION",
      startTime: "2026-11-17T08:00:00.000Z",
      endTime: "2026-11-17T16:00:00.000Z",
    },
    {
      id: "shf-002",
      shiftName: "Shift Sore (16:00 - 23:00)",
      assignedCashierId: "emp-02",
      assignedCashierName: "Siti Rahma",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      openingCash: 200000,
      expectedCash: 600000,
      actualCash: 600000,
      cashVariance: 0,
      cashSales: 400000,
      nonCashSales: 0,
      refundAmount: 0,
      status: "CLOSED",
      startTime: "2026-11-17T16:00:00.000Z",
      endTime: "2026-11-17T23:00:00.000Z",
    },
  ];

  const mockOrders: OrderRecord[] = [
    // 1. Transaksi Normal Lunas Tunai
    {
      id: "ord-1",
      orderNumber: "INV-20261117-001",
      organizationId: "org-1",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-01",
      customerName: "Agus Pratama",
      orderType: "DINE_IN",
      status: "COMPLETED",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      subtotal: 50000,
      discount: 0,
      tax: 5000,
      total: 55000,
      createdAt: "2026-11-17T09:00:00.000Z",
      targetServiceMinutes: 15,
      statusHistory: [],
      items: [
        {
          id: "it-1",
          productName: "Kopi Latte",
          quantity: 2,
          unitPrice: 25000,
          tenantId: "tenant-ks",
        },
      ],
    },
    // 2. Transaksi QRIS Belum Terkonfirmasi (Menggantung)
    {
      id: "ord-2",
      orderNumber: "INV-20261117-002",
      organizationId: "org-1",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-02",
      customerName: "Dewi Lestari",
      orderType: "DINE_IN",
      status: "NEW",
      paymentStatus: "PENDING",
      paymentMethod: "QRIS",
      subtotal: 80000,
      discount: 0,
      tax: 8000,
      total: 88000,
      createdAt: "2026-11-17T10:15:00.000Z",
      targetServiceMinutes: 15,
      statusHistory: [],
      items: [
        {
          id: "it-2",
          productName: "Nasi Goreng Spesial",
          quantity: 2,
          unitPrice: 40000,
          tenantId: "tenant-dm",
        },
      ],
    },
    // 3. Transaksi Refund (Kas Dikembalikan)
    {
      id: "ord-3",
      orderNumber: "INV-20261117-003",
      organizationId: "org-1",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-03",
      customerName: "Rudi Hartono",
      orderType: "DINE_IN",
      status: "COMPLETED",
      paymentStatus: "REFUNDED",
      paymentMethod: "CASH",
      subtotal: 60000,
      discount: 0,
      tax: 6000,
      total: 66000,
      refundReason: "Makanan tumpah saat disajikan pramusaji",
      refundApprovedBy: "Hendra Wijaya (Supervisor)",
      refundedAt: "2026-11-17T11:45:00.000Z",
      createdAt: "2026-11-17T11:00:00.000Z",
      targetServiceMinutes: 15,
      statusHistory: [],
      items: [
        {
          id: "it-3",
          productName: "Mie Goreng Seafood",
          quantity: 2,
          unitPrice: 30000,
          tenantId: "tenant-dm",
        },
      ],
    },
    // 4. Transaksi dengan Diskon Manual / Promo
    {
      id: "ord-4",
      orderNumber: "INV-20261117-004",
      organizationId: "org-1",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-04",
      customerName: "Maya Putri",
      orderType: "DINE_IN",
      status: "COMPLETED",
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
      subtotal: 100000,
      discount: 20000,
      promoId: "PROMO-HEMAT-20K",
      tax: 8000,
      total: 88000,
      createdAt: "2026-11-17T13:00:00.000Z",
      targetServiceMinutes: 15,
      statusHistory: [],
      items: [
        {
          id: "it-4",
          productName: "Paket Roti Sisir & Kopi",
          quantity: 2,
          unitPrice: 50000,
          tenantId: "tenant-mb",
        },
      ],
    },
  ];

  describe("Skenario 1: Deteksi & Pelacakan Transaksi Penyebab Selisih", () => {
    it("harus mendeteksi selisih kas fisik shift kasir (CASH_VARIANCE)", () => {
      const result = analyzeTransactionDiscrepancies({
        orders: mockOrders,
        shifts: mockShifts,
      });

      const shiftVariance = result.discrepancies.find((d) => d.type === "CASH_VARIANCE");
      expect(shiftVariance).toBeDefined();
      expect(shiftVariance?.referenceNo).toBe("Shift #shf-001");
      expect(shiftVariance?.cashierOrStaff).toBe("Budi Santoso");
      expect(shiftVariance?.amount).toBe(50000);
      expect(shiftVariance?.formattedAmount).toBe("-Rp 50.000");
      expect(shiftVariance?.reason).toContain("Selisih uang kembalian receh");
      expect(shiftVariance?.severity).toBe("destructive");
    });

    it("harus mendeteksi transaksi QRIS belum terkonfirmasi (UNCONFIRMED_QRIS)", () => {
      const result = analyzeTransactionDiscrepancies({
        orders: mockOrders,
        shifts: mockShifts,
      });

      const pendingQris = result.discrepancies.find((d) => d.type === "UNCONFIRMED_QRIS");
      expect(pendingQris).toBeDefined();
      expect(pendingQris?.referenceNo).toBe("INV-20261117-002");
      expect(pendingQris?.amount).toBe(88000);
      expect(pendingQris?.financialImpact).toContain("belum masuk rekening settlement");
      expect(pendingQris?.severity).toBe("warning");
    });

    it("harus mendeteksi transaksi refund beserta alasan dan supervisor otorisasi (REFUND)", () => {
      const result = analyzeTransactionDiscrepancies({
        orders: mockOrders,
        shifts: mockShifts,
      });

      const refundDiscrepancy = result.discrepancies.find((d) => d.type === "REFUND");
      expect(refundDiscrepancy).toBeDefined();
      expect(refundDiscrepancy?.referenceNo).toBe("INV-20261117-003");
      expect(refundDiscrepancy?.amount).toBe(66000);
      expect(refundDiscrepancy?.cashierOrStaff).toContain("Hendra Wijaya");
      expect(refundDiscrepancy?.reason).toBe("Makanan tumpah saat disajikan pramusaji");
      expect(refundDiscrepancy?.severity).toBe("destructive");
    });

    it("harus mendeteksi diskon manual atau promo yang mengurangi pendapatan kotor (MANUAL_DISCOUNT)", () => {
      const result = analyzeTransactionDiscrepancies({
        orders: mockOrders,
        shifts: mockShifts,
      });

      const discountDiscrepancy = result.discrepancies.find((d) => d.type === "MANUAL_DISCOUNT");
      expect(discountDiscrepancy).toBeDefined();
      expect(discountDiscrepancy?.referenceNo).toBe("INV-20261117-004");
      expect(discountDiscrepancy?.amount).toBe(20000);
      expect(discountDiscrepancy?.reason).toContain("PROMO-HEMAT-20K");
    });
  });

  describe("Skenario 2: Perbandingan Tripartit (Total Kasir vs Total Struk vs Total Settlement)", () => {
    it("harus menghitung metrik perbandingan secara akurat", () => {
      const result = analyzeTransactionDiscrepancies({
        orders: mockOrders,
        shifts: mockShifts,
      });

      const { summary } = result;

      // Kasir
      expect(summary.totalCashierActual).toBe(1300000); // 700.000 + 600.000
      expect(summary.totalCashierExpected).toBe(1350000); // 750.000 + 600.000
      expect(summary.totalCashVariance).toBe(-50000);

      // Struk / POS
      expect(summary.totalReceiptsGross).toBe(290000); // 50k + 80k + 60k + 100k
      expect(summary.totalPaidRevenue).toBe(143000); // ord-1 (55k) + ord-4 (88k)
      expect(summary.totalRefundAmount).toBe(66000); // ord-3
      expect(summary.totalPendingAmount).toBe(88000); // ord-2
      expect(summary.totalDiscountAmount).toBe(20000); // ord-4

      // Status
      expect(summary.status).toBe("NEEDS_ATTENTION");
      expect(summary.discrepanciesCount).toBe(4);
    });
  });

  describe("Skenario 3: Kriteria Selesai (Ada Selisih -> Sistem Menunjukkan Transaksi Penyebabnya)", () => {
    it("sistem menunjukkan transaksi penyebab ketika ada selisih", () => {
      const result = analyzeTransactionDiscrepancies({
        orders: mockOrders,
        shifts: mockShifts,
      });

      expect(result.discrepancies.length).toBeGreaterThan(0);
      result.discrepancies.forEach((item: DiscrepancyCauseItem) => {
        expect(item.referenceNo).toBeTruthy();
        expect(item.amount).toBeGreaterThan(0);
        expect(item.typeLabel).toBeTruthy();
        expect(item.reason).toBeTruthy();
        expect(item.financialImpact).toBeTruthy();
      });
    });

    it("sistem menyatakan Seimbang ketika seluruh transaksi lunas tanpa anomali dan kasir seimbang", () => {
      const balancedShifts: ShiftRecord[] = [
        {
          ...mockShifts[1],
          cashVariance: 0,
          status: "CLOSED",
        },
      ];

      const balancedOrders: OrderRecord[] = [
        {
          ...mockOrders[0],
          paymentStatus: "PAID",
          discount: 0,
        },
      ];

      const result = analyzeTransactionDiscrepancies({
        orders: balancedOrders,
        shifts: balancedShifts,
      });

      expect(result.summary.status).toBe("BALANCED");
      expect(result.summary.discrepanciesCount).toBe(0);
      expect(result.discrepancies).toHaveLength(0);
    });
  });

  describe("Skenario 4: Pewarnaan Indikator Semantik di Laporan Rekonsiliasi", () => {
    it("memberikan tone warna semantik destruktif/peringatan pada kartu indikator saat terjadi anomali kas", () => {
      const report = buildReportData({
        type: "RECONCILIATION",
        scopeName: "Singaraja",
        orders: mockOrders,
        shifts: mockShifts,
        products: [],
        ingredients: [],
        logs: [],
      });

      // Kartu 1: Total kasir fisik (ada kekurangan kas fisik aktual vs ekspektasi)
      const cashierCard = report.summaryCards.find((c) => c.label === "Total kasir fisik");
      expect(cashierCard).toBeDefined();
      expect(cashierCard?.value).toBe("Rp 1.300.000");
      expect(cashierCard?.sub).toBe("Seharusnya Rp 1.350.000");
      expect(cashierCard?.valueTone).toBe("destructive");
      expect(cashierCard?.subTone).toBe("destructive");

      // Kartu 4: Selisih kas shift (negatif 50.000)
      const varianceCard = report.summaryCards.find((c) => c.label === "Selisih kas shift");
      expect(varianceCard).toBeDefined();
      expect(varianceCard?.value).toBe("-Rp 50.000");
      expect(varianceCard?.valueTone).toBe("destructive");
      expect(varianceCard?.subTone).toBe("destructive");
      expect(varianceCard?.sub).toBe("Ada selisih kas fisik");

      // Kartu 5: Transaksi bermasalah (terdapat refund)
      const troubleCard = report.summaryCards.find((c) => c.label === "Transaksi bermasalah");
      expect(troubleCard).toBeDefined();
      expect(troubleCard?.value).toBe("4 transaksi");
      expect(troubleCard?.valueTone).toBe("destructive");
      expect(troubleCard?.subTone).toBe("destructive");
      expect(troubleCard?.sub).toContain("Terdapat refund");

      // Reconciliation Info: tone audit dan refund
      const statusAudit = report.reconciliationInfo?.find((r) => r.label === "Status audit");
      expect(statusAudit?.value).toBe("Perlu verifikasi");
      expect(statusAudit?.tone).toBe("destructive");

      const refundItem = report.reconciliationInfo?.find((r) => r.label === "Total refund");
      expect(refundItem?.tone).toBe("destructive");

      const pendingQrisItem = report.reconciliationInfo?.find((r) => r.label === "Pending QRIS");
      expect(pendingQrisItem?.tone).toBe("warning");
    });

    it("memberikan tone sukses (hijau) saat pembukuan kasir dan transaksi seimbang", () => {
      const balancedShifts: ShiftRecord[] = [
        {
          ...mockShifts[1],
          cashVariance: 0,
          status: "CLOSED",
        },
      ];

      const balancedOrders: OrderRecord[] = [
        {
          ...mockOrders[0],
          paymentStatus: "PAID",
          discount: 0,
        },
      ];

      const report = buildReportData({
        type: "RECONCILIATION",
        scopeName: "Singaraja",
        orders: balancedOrders,
        shifts: balancedShifts,
        products: [],
        ingredients: [],
        logs: [],
      });

      const cashierCard = report.summaryCards.find((c) => c.label === "Total kasir fisik");
      expect(cashierCard?.subTone).toBe("success");

      const varianceCard = report.summaryCards.find((c) => c.label === "Selisih kas shift");
      expect(varianceCard?.valueTone).toBe("success");
      expect(varianceCard?.subTone).toBe("success");

      const troubleCard = report.summaryCards.find((c) => c.label === "Transaksi bermasalah");
      expect(troubleCard?.valueTone).toBe("success");
      expect(troubleCard?.subTone).toBe("success");

      const statusAudit = report.reconciliationInfo?.find((r) => r.label === "Status audit");
      expect(statusAudit?.value).toBe("Seimbang");
      expect(statusAudit?.tone).toBe("success");
    });
  });
});
