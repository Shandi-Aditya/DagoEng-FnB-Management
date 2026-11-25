import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateWeeklyTenantSettlement,
  calculateConsolidatedWeeklySettlement,
  getWeeklySettlementPeriod,
  getSettlementPaymentStatus,
  setSettlementPaymentStatus,
  type MdrBearerMode,
  type WeeklyTenantSettlement,
} from "@/features/reports/settlement-weekly-domain";
import type { OrderRecord } from "@/types/order";

describe("Task S-39: Skema Bagi Hasil per Metode Bayar dan Settlement Mingguan", () => {
  const baseOrderDate = "2026-12-03T10:00:00.000Z"; // Kamis minggu pertama Des 2026

  // Order Tunai (Cash): Total Rp 100.000 (Subtotal 100.000, Diskon 0)
  const cashOrder1: OrderRecord = {
    id: "ord-cash-1",
    orderNumber: "ORD-CASH-1",
    organizationId: "org-1",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    customerName: "Agus",
    orderType: "DINE_IN",
    tableNumber: "01",
    status: "COMPLETED",
    paymentStatus: "PAID",
    paymentMethod: "CASH",
    subtotal: 100000,
    discount: 0,
    tax: 10000,
    total: 110000,
    createdAt: baseOrderDate,
    statusHistory: [],
    targetServiceMinutes: 15,
    items: [
      {
        id: "item-c1",
        productId: "prod-ks-1",
        productName: "Kopi Senja Spesial",
        quantity: 2,
        unitPrice: 50000,
        tenantId: "tenant-ks",
      },
    ],
  };

  // Order QRIS: Total Rp 200.000 (Subtotal 200.000, Diskon 20.000 -> DPP 180.000)
  const qrisOrder1: OrderRecord = {
    id: "ord-qris-1",
    orderNumber: "ORD-QRIS-1",
    organizationId: "org-1",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    customerName: "Budi",
    orderType: "DINE_IN",
    tableNumber: "02",
    status: "COMPLETED",
    paymentStatus: "PAID",
    paymentMethod: "QRIS",
    subtotal: 200000,
    discount: 20000,
    tax: 18000,
    total: 198000,
    createdAt: baseOrderDate,
    statusHistory: [],
    targetServiceMinutes: 15,
    items: [
      {
        id: "item-q1",
        productId: "prod-ks-2",
        productName: "Paket Kopi Senja",
        quantity: 2,
        unitPrice: 100000,
        tenantId: "tenant-ks",
      },
    ],
  };

  describe("1. Periode Mingguan, Cut-Off Minggu 23:59:59, dan Jatuh Tempo Selasa", () => {
    it("menentukan cut-off hari Minggu pukul 23:59:59 dan jatuh tempo hari Selasa", () => {
      // Tanggal 3 Des 2026 (Kamis) berada di minggu:
      // Senin: 30 Nov 2026 (atau 1 Des tergantung cut-off)
      // Cut-off: Minggu 6 Des 2026 23:59:59 WITA
      // Jatuh tempo: Selasa 8 Des 2026 23:59:59 WITA
      const period = getWeeklySettlementPeriod(new Date("2026-12-03T10:00:00Z"));
      expect(period).toBeDefined();
      expect(period.periodKey).toBeDefined();
      expect(period.weekCutoffDate).toBeDefined();
      expect(period.paymentDueDate).toBeDefined();

      const cutoff = new Date(period.weekCutoffDate);
      const due = new Date(period.paymentDueDate);

      // Hari jatuh tempo harus setelah cut-off
      expect(due.getTime()).toBeGreaterThan(cutoff.getTime());
      expect(period.paymentDueLabel).toContain("Selasa");
    });
  });

  describe("2. Skema Bagi Hasil per Metode Bayar: Tunai vs QRIS", () => {
    it("Tunai: basis penjualan bersih, mitra setor 15% ke Dago", () => {
      // Order Tunai: Net Sales 100.000
      // Pembagian default: 85% Mitra, 15% Dago
      // cashTenantShare = 85.000 (sudah dipegang mitra dalam kas fisik)
      // cashDagoShare = 15.000 (wajib disetor mitra ke Dago)
      const settlement = calculateWeeklyTenantSettlement([cashOrder1], "tenant-ks", {
        mdrBearer: "MITRA",
      });

      expect(settlement.cashNetSales).toBe(100000);
      expect(settlement.cashTenantShare).toBe(85000);
      expect(settlement.cashDagoShare).toBe(15000);

      // Tidak ada QRIS
      expect(settlement.qrisNetSales).toBe(0);
      expect(settlement.qrisTenantShare).toBe(0);

      // Aliran kas: Mitra harus menyetor 15.000 ke Dago
      expect(settlement.netTransferAmount).toBe(-15000);
      expect(settlement.actionDirection).toBe("MITRA_TO_DAGO");
      expect(settlement.actionLabel).toContain("Mitra setor ke Dago");
    });

    it("QRIS: basis penjualan bersih setelah diskon (DPP 180.000), Dago transfer 85% ke mitra setelah MDR", () => {
      // Order QRIS: Subtotal 200.000, Diskon 20.000 -> DPP 180.000
      // MDR 0.7% = 180.000 * 0.007 = 1.260
      // Default MDR ditanggung Mitra:
      // Hak kotor mitra: 85% * 180.000 = 153.000
      // Potongan MDR: 1.260
      // qrisTenantShare = 153.000 - 1.260 = 151.740
      // qrisDagoShare = 15% * 180.000 = 27.000
      const settlement = calculateWeeklyTenantSettlement([qrisOrder1], "tenant-ks", {
        mdrBearer: "MITRA",
      });

      expect(settlement.qrisNetSales).toBe(180000);
      expect(settlement.qrisMdrFee).toBe(1260);
      expect(settlement.qrisTenantShare).toBe(151740);
      expect(settlement.qrisDagoShare).toBe(27000);

      // Aliran kas: Dago harus transfer ke Mitra
      expect(settlement.netTransferAmount).toBe(151740);
      expect(settlement.actionDirection).toBe("DAGO_TO_MITRA");
      expect(settlement.actionLabel).toContain("Dago transfer ke mitra");
    });

    it("Netting Transaksi Campuran (Tunai + QRIS): memperhitungkan transfer bersih", () => {
      // Tunai: Net 100.000 -> Mitra berutang setor 15.000 ke Dago
      // QRIS: Net 180.000 -> Dago berutang transfer 151.740 ke Mitra (MDR ditanggung mitra)
      // Net Transfer = 151.740 - 15.000 = 136.740 (Dago transfer ke mitra)
      const settlement = calculateWeeklyTenantSettlement([cashOrder1, qrisOrder1], "tenant-ks", {
        mdrBearer: "MITRA",
      });

      expect(settlement.totalNetSales).toBe(280000);
      expect(settlement.cashDagoShare).toBe(15000);
      expect(settlement.qrisTenantShare).toBe(151740);
      expect(settlement.netTransferAmount).toBe(136740);
      expect(settlement.actionDirection).toBe("DAGO_TO_MITRA");

      // Total pendapatan Dago dari bagi hasil = 15.000 (tunai) + 27.000 (QRIS) = 42.000
      expect(settlement.dagoTotalRevenue).toBe(42000);
    });
  });

  describe("3. Pilihan Penanggung MDR QRIS (Mitra / Dago / Dibagi)", () => {
    it("MDR ditanggung DAGO: MDR memotong porsi Dago, hak mitra tetap utuh 85%", () => {
      const settlement = calculateWeeklyTenantSettlement([qrisOrder1], "tenant-ks", {
        mdrBearer: "DAGO",
      });

      expect(settlement.qrisMdrFee).toBe(1260);
      expect(settlement.mdrTenantPortion).toBe(0);
      expect(settlement.mdrDagoPortion).toBe(1260);

      // Hak mitra utuh 85% * 180.000 = 153.000
      expect(settlement.qrisTenantShare).toBe(153000);
      // Porsi Dago berkurang: 27.000 - 1.260 = 25.740
      expect(settlement.qrisDagoShare).toBe(25740);
    });

    it("MDR DIBAGI (SPLIT): MDR dibagi proporsional 85% mitra dan 15% Dago", () => {
      const settlement = calculateWeeklyTenantSettlement([qrisOrder1], "tenant-ks", {
        mdrBearer: "SPLIT",
      });

      // Total MDR = 1.260
      // 85% dari 1.260 = 1.071 (mitra)
      // 15% dari 1.260 = 189 (Dago)
      expect(settlement.mdrTenantPortion).toBe(1071);
      expect(settlement.mdrDagoPortion).toBe(189);

      expect(settlement.qrisTenantShare).toBe(153000 - 1071); // 151.929
      expect(settlement.qrisDagoShare).toBe(27000 - 189);     // 26.811
    });
  });

  describe("4. Pengurang Refund Transaksi", () => {
    it("order yang di-refund mengurangi penjualan bersih dan bagi hasil", () => {
      const refundedOrder: OrderRecord = {
        ...cashOrder1,
        id: "ord-cash-refunded",
        status: "CANCELLED",
        paymentStatus: "REFUNDED",
        refundedAt: baseOrderDate,
      };

      const settlement = calculateWeeklyTenantSettlement([cashOrder1, refundedOrder], "tenant-ks");
      // Hanya 1 order aktif yang dihitung
      expect(settlement.totalNetSales).toBe(100000);
      expect(settlement.transactionCount).toBe(1);
    });
  });

  describe("5. Status Pelunasan Finance (Tandai Lunas)", () => {
    it("default status adalah PENDING, dan dapat ditandai PAID oleh Finance", () => {
      const periodKey = "2026-W49";
      const tenantId = "tenant-ks";

      // Awalnya PENDING
      const initialStatus = getSettlementPaymentStatus(periodKey, tenantId);
      expect(initialStatus.status).toBe("PENDING");

      // Finance menandai lunas
      const updated = setSettlementPaymentStatus(periodKey, tenantId, "PAID", "Shandi Finance", "Transfer via BCA");
      expect(updated.status).toBe("PAID");
      expect(updated.paidBy).toBe("Shandi Finance");
      expect(updated.paidAt).toBeDefined();

      // Terbaca kembali dengan benar
      const reCheck = getSettlementPaymentStatus(periodKey, tenantId);
      expect(reCheck.status).toBe("PAID");
      expect(reCheck.paidBy).toBe("Shandi Finance");
    });
  });

  describe("6. Laporan #11: Konsolidasi Semua Mitra & Invarian Konsistensi", () => {
    it("Laporan #11 menghitung konsolidasi seluruh mitra dengan baris total yang cocok 100% dengan jumlah di Laporan #10", () => {
      // Mitra 1: Kopi Senja (tenant-ks) -> cashOrder1 (100.000) & qrisOrder1 (180.000)
      // Mitra 2: Dapur Mama (tenant-kitchen) -> Order Tunai 200.000
      const kitchenOrder: OrderRecord = {
        id: "ord-kitchen-1",
        orderNumber: "ORD-KITCHEN-1",
        organizationId: "org-1",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        customerName: "Rudi",
        orderType: "DINE_IN",
        tableNumber: "05",
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "CASH",
        subtotal: 200000,
        discount: 0,
        tax: 20000,
        total: 220000,
        createdAt: baseOrderDate,
        statusHistory: [],
        targetServiceMinutes: 15,
        items: [
          {
            id: "it-k1",
            productId: "prod-kitchen-1",
            productName: "Nasi Ayam Dapur Mama",
            quantity: 2,
            unitPrice: 100000,
            tenantId: "tenant-kitchen",
          },
        ],
      };

      const allOrders = [cashOrder1, qrisOrder1, kitchenOrder];

      // Laporan #10 per mitra individual
      const ksSettlement = calculateWeeklyTenantSettlement(allOrders, "tenant-ks");
      const kitchenSettlement = calculateWeeklyTenantSettlement(allOrders, "tenant-kitchen");

      // Laporan #11 konsolidasi
      const consolidated = calculateConsolidatedWeeklySettlement(allOrders);

      expect(consolidated.tenants.length).toBeGreaterThanOrEqual(2);

      // Invarian Konsistensi:
      // 1. Total Net Sales di #11 = jumlah Net Sales semua mitra di #10
      const sumNetSales = ksSettlement.totalNetSales + kitchenSettlement.totalNetSales;
      expect(consolidated.totalNetSales).toBe(sumNetSales);

      // 2. Total Pendapatan Dago di #11 = jumlah Pendapatan Dago semua mitra di #10
      const sumDagoRevenue = ksSettlement.dagoTotalRevenue + kitchenSettlement.dagoTotalRevenue;
      expect(consolidated.totalDagoRevenue).toBe(sumDagoRevenue);

      // 3. Total Tunai yang disetor ke Dago di #11 = jumlah setoran tunai mitra di #10
      const sumCashDago = ksSettlement.cashDagoShare + kitchenSettlement.cashDagoShare;
      expect(consolidated.totalCashDagoShare).toBe(sumCashDago);

      // 4. Total QRIS yang ditransfer Dago di #11 = jumlah transfer QRIS mitra di #10
      const sumQrisTenant = ksSettlement.qrisTenantShare + kitchenSettlement.qrisTenantShare;
      expect(consolidated.totalQrisTenantShare).toBe(sumQrisTenant);
    });

    it("mendukung persentase dinamis 70/30 (template Ka Ari) selain default 85/15", () => {
      // Custom split 70% Mitra / 30% Dago
      const customSplits = {
        "tenant-ks": { tenantSharePercent: 70, dagoSharePercent: 30 },
      };

      const settlement = calculateWeeklyTenantSettlement([cashOrder1], "tenant-ks", {
        customSplits,
      });

      expect(settlement.tenantSharePercent).toBe(70);
      expect(settlement.dagoSharePercent).toBe(30);
      expect(settlement.cashTenantShare).toBe(70000); // 70% dari 100.000
      expect(settlement.cashDagoShare).toBe(30000);   // 30% dari 100.000
    });

    it("melewati mitra bertipe INTERNAL dari konsolidasi settlement kecuali diminta eksplisit", async () => {
      // Order untuk mitra internal
      const internalOrder: OrderRecord = {
        ...cashOrder1,
        id: "ord-internal-1",
        items: [
          {
            id: "it-int",
            productName: "Menu Internal",
            quantity: 1,
            unitPrice: 50000,
            tenantId: "tenant-internal-test",
          },
        ],
      };

      // Simpan profile internal sementara
      const { saveTenantProfile } = await import("@/lib/tenant");
      saveTenantProfile({
        tenantId: "tenant-internal-test",
        brandName: "Mitra Dago Internal",
        tagline: "Mitra Internal Dago",
        description: "Mitra internal khusus",
        contactPerson: "Izzy",
        contactPhone: "081234567890",
        bankName: "BCA",
        bankAccountNumber: "12345678",
        bankAccountHolder: "Dago Internal",
        partnerType: "INTERNAL",
        status: "ACTIVE",
        receiptHeader: "",
        receiptFooter: "",
        lowStockThresholdPercent: 20,
      });

      // Default: exclude internal
      const consolidated = calculateConsolidatedWeeklySettlement([internalOrder], {
        includeInternal: false,
      });
      const foundInternal = consolidated.tenants.find((t) => t.tenantId === "tenant-internal-test");
      expect(foundInternal).toBeUndefined();

      // Explicit: include internal
      const consolidatedWithInt = calculateConsolidatedWeeklySettlement([internalOrder], {
        includeInternal: true,
      });
      const foundInternalIncluded = consolidatedWithInt.tenants.find((t) => t.tenantId === "tenant-internal-test");
      expect(foundInternalIncluded).toBeDefined();
    });
  });
});
