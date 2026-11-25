import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  calculateWeeklyTenantSettlement,
  calculateConsolidatedWeeklySettlement,
  getWeeklySettlementPeriod,
  getSettlementPaymentStatus,
  setSettlementPaymentStatus,
  buildSettlementReportDataset,
  buildConsolidatedSettlementReportDataset,
  memorySettlementStatusStore,
} from "@/features/reports/settlement-weekly-domain";
import {
  buildReportData,
  recalculateReportSummaryCards,
} from "@/features/reports/reports-domain";
import {
  computeReportColumnWidths,
  isNumericOrCurrencyCell,
} from "@/features/reports/report-pdf-domain";
import { calculateTenantProfitSharing } from "@/lib/settlement";
import { GET, POST } from "@/app/api/reports/settlement/route";
import { getAuditLogs, readPersistentDomainState } from "@/lib/persistent-storage";
import { DEMO_OUTLETS } from "@/lib/receipt-publisher";
import { tenantsDomainSpec } from "@/lib/sync-domains/config-spec";
import type { OrderRecord } from "@/types/order";

describe("Task S-39: Skema Bagi Hasil per Metode Bayar dan Settlement Mingguan", () => {
  const baseOrderDate = "2026-12-03T10:00:00.000Z"; // Kamis minggu pertama Des 2026 (2026-11-30 s.d. 2026-12-06)
  let tempDataDir: string | null = null;

  beforeEach(() => {
    for (const k of Object.keys(memorySettlementStatusStore)) {
      delete memorySettlementStatusStore[k];
    }
  });

  afterEach(() => {
    delete process.env.DATA_DIR_OVERRIDE;
    if (tempDataDir && fs.existsSync(tempDataDir)) {
      fs.rmSync(tempDataDir, { recursive: true, force: true });
      tempDataDir = null;
    }
  });

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

  describe("1. Periode Mingguan, Cut-Off Minggu 23:59:59 WITA, dan Jatuh Tempo Selasa", () => {
    it("menentukan cut-off hari Minggu pukul 23:59:59 WITA dan jatuh tempo hari Selasa secara konsisten di zona waktu apa pun", () => {
      const period = getWeeklySettlementPeriod(new Date("2026-12-03T10:00:00Z"));
      expect(period).toBeDefined();
      expect(period.periodKey).toBe("2026-11-30_2026-12-06");
      expect(period.weekStartDate).toBe("2026-11-29T16:00:00.000Z"); // 30 Nov 00:00:00 WITA
      expect(period.weekCutoffDate).toBe("2026-12-06T15:59:59.999Z"); // 06 Des 23:59:59.999 WITA
      expect(period.paymentDueDate).toBe("2026-12-08T15:59:59.999Z"); // 08 Des 23:59:59.999 WITA

      const cutoff = new Date(period.weekCutoffDate);
      const due = new Date(period.paymentDueDate);
      expect(due.getTime()).toBeGreaterThan(cutoff.getTime());
      expect(period.paymentDueLabel).toBe("Selasa, 08 Des 2026");

      // Cek input string tanggal kalender "2026-12-02" di bawah TZ=UTC sekalipun
      const wedPeriod = getWeeklySettlementPeriod("2026-12-02");
      expect(wedPeriod.periodKey).toBe("2026-11-30_2026-12-06");
      expect(wedPeriod.paymentDueLabel).toBe("Selasa, 08 Des 2026");
    });
  });

  describe("2. Skema Bagi Hasil per Metode Bayar: Tunai vs QRIS & Filter Mingguan Ketat", () => {
    it("Tunai: basis penjualan bersih, mitra setor 15% ke Dago", () => {
      const settlement = calculateWeeklyTenantSettlement([cashOrder1], "tenant-ks", {
        mdrBearer: "MITRA",
        referenceDate: baseOrderDate,
      });

      expect(settlement.cashNetSales).toBe(100000);
      expect(settlement.cashTenantShare).toBe(85000);
      expect(settlement.cashDagoShare).toBe(15000);

      expect(settlement.qrisNetSales).toBe(0);
      expect(settlement.qrisTenantShare).toBe(0);

      expect(settlement.netTransferAmount).toBe(-15000);
      expect(settlement.actionDirection).toBe("MITRA_TO_DAGO");
      expect(settlement.actionLabel).toContain("Mitra setor ke Dago");
    });

    it("QRIS: basis penjualan bersih setelah diskon (DPP 180.000), Dago transfer 85% ke mitra setelah MDR", () => {
      const settlement = calculateWeeklyTenantSettlement([qrisOrder1], "tenant-ks", {
        mdrBearer: "MITRA",
        referenceDate: baseOrderDate,
      });

      expect(settlement.qrisNetSales).toBe(180000);
      expect(settlement.qrisMdrFee).toBe(1260);
      expect(settlement.qrisTenantShare).toBe(151740);
      expect(settlement.qrisDagoShare).toBe(27000);

      expect(settlement.netTransferAmount).toBe(151740);
      expect(settlement.actionDirection).toBe("DAGO_TO_MITRA");
      expect(settlement.actionLabel).toContain("Dago transfer ke mitra");
    });

    it("Netting Transaksi Campuran (Tunai + QRIS): memperhitungkan transfer bersih", () => {
      const settlement = calculateWeeklyTenantSettlement([cashOrder1, qrisOrder1], "tenant-ks", {
        mdrBearer: "MITRA",
        referenceDate: baseOrderDate,
      });

      expect(settlement.totalNetSales).toBe(280000);
      expect(settlement.cashDagoShare).toBe(15000);
      expect(settlement.qrisTenantShare).toBe(151740);
      expect(settlement.netTransferAmount).toBe(136740);
      expect(settlement.actionDirection).toBe("DAGO_TO_MITRA");
      expect(settlement.dagoTotalRevenue).toBe(42000);
    });

    it("memfilter order secara ketat ke rentang minggu terpilih (mengabaikan minggu lain)", () => {
      const prevWeekOrder: OrderRecord = {
        ...cashOrder1,
        id: "ord-prev-week",
        createdAt: "2026-11-29T15:59:59.000Z", // 29 Nov 23:59:59 WITA (minggu sebelumnya)
      };
      const nextWeekOrder: OrderRecord = {
        ...cashOrder1,
        id: "ord-next-week",
        createdAt: "2026-12-06T16:00:00.000Z", // 07 Des 00:00:00 WITA (minggu berikutnya)
      };

      const settlement = calculateWeeklyTenantSettlement(
        [prevWeekOrder, cashOrder1, nextWeekOrder],
        "tenant-ks",
        { referenceDate: baseOrderDate }
      );

      expect(settlement.transactionCount).toBe(1);
      expect(settlement.totalNetSales).toBe(100000);
    });

    it("memecah order SPLIT secara pro-rata berdasarkan splitDetails (CASH, QRIS, TRANSFER/EDC)", () => {
      const splitOrder: OrderRecord = {
        ...qrisOrder1,
        id: "ord-split-1",
        paymentMethod: "SPLIT",
        subtotal: 200000,
        discount: 20000, // DPP = 180.000
        splitDetails: [
          { guestNumber: 1, amount: 110000, method: "CASH" },
          { guestNumber: 2, amount: 110000, method: "QRIS" },
        ],
      };

      const settlement = calculateWeeklyTenantSettlement([splitOrder], "tenant-ks", {
        mdrBearer: "MITRA",
        referenceDate: baseOrderDate,
      });

      // 50% CASH (90.000) dan 50% QRIS (90.000)
      expect(settlement.cashNetSales).toBe(90000);
      expect(settlement.qrisNetSales).toBe(90000);
      expect(settlement.otherNetSales).toBe(0);
      expect(settlement.cashDagoShare).toBe(13500);
      expect(settlement.qrisMdrFee).toBe(630);
      expect(settlement.qrisTenantShare).toBe(75870);

      // Pastikan calculateTenantProfitSharing di src/lib/settlement.ts juga memecah SPLIT QRIS
      const profitShare = calculateTenantProfitSharing([splitOrder], "tenant-ks", "Kopi Senja");
      expect(profitShare.qrisMdr).toBe(630);
    });
  });

  describe("3. Pilihan Penanggung MDR QRIS (Mitra / Dago / Dibagi)", () => {
    it("MDR ditanggung DAGO: MDR memotong porsi Dago, hak mitra tetap utuh 85%", () => {
      const settlement = calculateWeeklyTenantSettlement([qrisOrder1], "tenant-ks", {
        mdrBearer: "DAGO",
        referenceDate: baseOrderDate,
      });

      expect(settlement.qrisMdrFee).toBe(1260);
      expect(settlement.mdrTenantPortion).toBe(0);
      expect(settlement.mdrDagoPortion).toBe(1260);
      expect(settlement.qrisTenantShare).toBe(153000);
      expect(settlement.qrisDagoShare).toBe(25740);
    });

    it("MDR DIBAGI: MDR dibagi proporsional 85% mitra dan 15% Dago", () => {
      const settlement = calculateWeeklyTenantSettlement([qrisOrder1], "tenant-ks", {
        mdrBearer: "SPLIT",
        referenceDate: baseOrderDate,
      });

      expect(settlement.mdrTenantPortion).toBe(1071);
      expect(settlement.mdrDagoPortion).toBe(189);
      expect(settlement.qrisTenantShare).toBe(151929);
      expect(settlement.qrisDagoShare).toBe(26811);
    });
  });

  describe("4. Pengurang Refund Transaksi (Minggu Sama & Lintas Minggu)", () => {
    it("order yang di-refund di minggu yang sama bernilai bersih 0", () => {
      const refundedOrder: OrderRecord = {
        ...cashOrder1,
        id: "ord-cash-refunded",
        status: "CANCELLED",
        paymentStatus: "REFUNDED",
        refundedAt: baseOrderDate,
      };

      const settlement = calculateWeeklyTenantSettlement([cashOrder1, refundedOrder], "tenant-ks", {
        referenceDate: baseOrderDate,
      });
      expect(settlement.totalNetSales).toBe(100000);
      expect(settlement.transactionCount).toBe(1);
    });

    it("refund lintas minggu mengurangi penjualan bersih di minggu terjadinya refund sesuai refundMethod", () => {
      const prevWeekQrisOrderRefundedInCurrentWeek: OrderRecord = {
        ...qrisOrder1,
        id: "ord-cross-refund",
        subtotal: 100000,
        discount: 0,
        total: 110000,
        createdAt: "2026-11-26T10:00:00.000Z", // Minggu sebelumnya (23-29 Nov)
        status: "CANCELLED",
        paymentStatus: "REFUNDED",
        paymentMethod: "QRIS",
        refundMethod: "CASH", // Direfund tunai (pola V-34) pada minggu berjalan
        refundedAt: baseOrderDate,
        items: [
          {
            id: "it-cr-1",
            productName: "Kopi Senja",
            quantity: 1,
            unitPrice: 100000,
            tenantId: "tenant-ks",
          },
        ],
      };

      const week2CashOrder: OrderRecord = {
        ...cashOrder1,
        id: "ord-w2-cash",
        subtotal: 200000,
        total: 220000,
        items: [
          {
            id: "it-w2-1",
            productName: "Kopi Senja",
            quantity: 2,
            unitPrice: 100000,
            tenantId: "tenant-ks",
          },
        ],
      };

      // Di minggu 1 (saat order dibuat): tetap terhitung sebagai QRIS net 100.000
      const week1Settlement = calculateWeeklyTenantSettlement(
        [prevWeekQrisOrderRefundedInCurrentWeek],
        "tenant-ks",
        { referenceDate: "2026-11-26" }
      );
      expect(week1Settlement.qrisNetSales).toBe(100000);

      // Di minggu 2 (saat direfund tunai): kas tunai 200.000 dikurangi refund 100.000 -> 100.000
      const week2Settlement = calculateWeeklyTenantSettlement(
        [prevWeekQrisOrderRefundedInCurrentWeek, week2CashOrder],
        "tenant-ks",
        { referenceDate: baseOrderDate }
      );
      expect(week2Settlement.cashNetSales).toBe(100000);
      expect(week2Settlement.refundDeduction).toBe(100000);
      expect(week2Settlement.totalNetSales).toBe(100000);
    });
  });

  describe("5. Status Pelunasan Finance & API Server /api/reports/settlement", () => {
    it("default status adalah PENDING, dan dapat ditandai PAID pada helper sinkron", () => {
      const periodKey = "2026-11-30_2026-12-06";
      const tenantId = "tenant-ks";

      const initialStatus = getSettlementPaymentStatus(periodKey, tenantId);
      expect(initialStatus.status).toBe("PENDING");

      const updated = setSettlementPaymentStatus(
        periodKey,
        tenantId,
        "PAID",
        "Shandi Finance",
        "Transfer via BCA"
      );
      expect(updated.status).toBe("PAID");
      expect(updated.paidBy).toBe("Shandi Finance");
      expect(updated.paidAt).toBeDefined();

      const reCheck = getSettlementPaymentStatus(periodKey, tenantId);
      expect(reCheck.status).toBe("PAID");
      expect(reCheck.paidBy).toBe("Shandi Finance");
    });

    it("menegakkan RBAC dan persistensi server di GET/POST /api/reports/settlement serta memperbarui setoran mitra", async () => {
      tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dago-s39-settlement-"));
      process.env.DATA_DIR_OVERRIDE = tempDataDir;

      // 401 tanpa login
      const unauthGet = await GET(
        new NextRequest("http://localhost:3000/api/reports/settlement")
      );
      expect(unauthGet.status).toBe(401);

      const unauthPost = await POST(
        new NextRequest("http://localhost:3000/api/reports/settlement", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            periodKey: "2026-11-30_2026-12-06",
            tenantId: "tenant-ks",
            status: "PAID",
          }),
        })
      );
      expect(unauthPost.status).toBe(401);

      // 403 untuk MANAGER, CASHIER, dan TENANT OWNER pada POST
      for (const persona of ["COWORK_MANAGER", "CASHIER_SGR", "TENANT_OWNER_KS"]) {
        const forbiddenPost = await POST(
          new NextRequest("http://localhost:3000/api/reports/settlement", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              cookie: `dagoeng_active_persona=${persona}`,
            },
            body: JSON.stringify({
              periodKey: "2026-11-30_2026-12-06",
              tenantId: "tenant-ks",
              status: "PAID",
            }),
          })
        );
        expect(forbiddenPost.status, `POST untuk ${persona} harus 403`).toBe(403);
      }

      // 403 untuk CASHIER pada GET
      const cashierGet = await GET(
        new NextRequest("http://localhost:3000/api/reports/settlement", {
          headers: { cookie: "dagoeng_active_persona=CASHIER_SGR" },
        })
      );
      expect(cashierGet.status).toBe(403);

      // 200 untuk DAGO_OWNER menyimpan status PAID MITRA_TO_DAGO + audit + update lastSettlementDepositDate
      const postRes = await POST(
        new NextRequest("http://localhost:3000/api/reports/settlement", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=DAGO_OWNER",
          },
          body: JSON.stringify({
            periodKey: "2026-11-30_2026-12-06",
            tenantId: "tenant-ks",
            status: "PAID",
            direction: "MITRA_TO_DAGO",
            notes: "Setoran tunai minggu 49",
          }),
        })
      );
      expect(postRes.status).toBe(200);
      const postJson = await postRes.json();
      expect(postJson.success).toBe(true);
      expect(postJson.record.status).toBe("PAID");

      // Simpan data mitra kedua untuk menguji isolasi GET TENANT_OWNER_KS
      await POST(
        new NextRequest("http://localhost:3000/api/reports/settlement", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=SUPER_ADMIN",
          },
          body: JSON.stringify({
            periodKey: "2026-11-30_2026-12-06",
            tenantId: "tenant-kitchen",
            status: "PAID",
            direction: "DAGO_TO_MITRA",
          }),
        })
      );

      // MANAGER bisa baca semua
      const managerGet = await GET(
        new NextRequest(
          "http://localhost:3000/api/reports/settlement?periodKey=2026-11-30_2026-12-06",
          {
            headers: { cookie: "dagoeng_active_persona=COWORK_MANAGER" },
          }
        )
      );
      expect(managerGet.status).toBe(200);
      const managerJson = await managerGet.json();
      expect(Object.keys(managerJson.records)).toHaveLength(2);

      // TENANT_OWNER_KS hanya bisa baca milik tenant-ks
      const tenantGet = await GET(
        new NextRequest(
          "http://localhost:3000/api/reports/settlement?periodKey=2026-11-30_2026-12-06",
          {
            headers: { cookie: "dagoeng_active_persona=TENANT_OWNER_KS" },
          }
        )
      );
      expect(tenantGet.status).toBe(200);
      const tenantJson = await tenantGet.json();
      expect(Object.keys(tenantJson.records)).toEqual(["2026-11-30_2026-12-06_tenant-ks"]);

      // Verifikasi audit log & pembaruan lastSettlementDepositDate
      const logs = await getAuditLogs();
      expect(
        logs.some(
          (l) =>
            l.module === "FINANCE" &&
            l.action === "WEEKLY_SETTLEMENT_MARKED_PAID" &&
            l.recordId === "2026-11-30_2026-12-06_tenant-ks"
        )
      ).toBe(true);

      const tenantsState = await readPersistentDomainState(tenantsDomainSpec);
      expect(tenantsState.profiles["tenant-ks"]?.status).toBe("ACTIVE");
      expect(tenantsState.profiles["tenant-ks"]?.lastSettlementDepositDate).toMatch(
        /^\d{4}-\d{2}-\d{2}$/
      );

      // Saat direction tidak dikirim, sinkronisasi lastSettlementDepositDate tetap berjalan untuk tenant mitra
      const postOmittedRes = await POST(
        new NextRequest("http://localhost:3000/api/reports/settlement", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=DAGO_OWNER",
          },
          body: JSON.stringify({
            periodKey: "2026-11-30_2026-12-06",
            tenantId: "tenant-bakery",
            status: "PAID",
          }),
        })
      );
      expect(postOmittedRes.status).toBe(200);
      const tenantsAfterOmitted = await readPersistentDomainState(tenantsDomainSpec);
      expect(tenantsAfterOmitted.profiles["tenant-bakery"]?.lastSettlementDepositDate).toMatch(
        /^\d{4}-\d{2}-\d{2}$/
      );
    });
  });

  describe("6. Laporan #10 & #11: Konsistensi Pasca-MDR, Outlet, Tren, INTERNAL, & PDF", () => {
    it("Laporan #11 menghitung konsolidasi seluruh mitra dengan baris total yang cocok 100% dengan jumlah di Laporan #10", () => {
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

      const edcOrder: OrderRecord = {
        ...cashOrder1,
        id: "ord-edc-1",
        paymentMethod: "TRANSFER",
        subtotal: 50000,
        total: 55000,
        items: [
          {
            id: "it-edc-1",
            productName: "Kopi Senja",
            quantity: 1,
            unitPrice: 50000,
            tenantId: "tenant-ks",
          },
        ],
      };

      const allOrders = [cashOrder1, qrisOrder1, edcOrder, kitchenOrder];

      const ksSettlement = calculateWeeklyTenantSettlement(allOrders, "tenant-ks", {
        referenceDate: baseOrderDate,
      });
      const kitchenSettlement = calculateWeeklyTenantSettlement(allOrders, "tenant-kitchen", {
        referenceDate: baseOrderDate,
      });

      const consolidated = calculateConsolidatedWeeklySettlement(allOrders, {
        referenceDate: baseOrderDate,
      });

      expect(consolidated.tenants.length).toBeGreaterThanOrEqual(2);
      expect(consolidated.totalNetSales).toBe(
        ksSettlement.totalNetSales + kitchenSettlement.totalNetSales
      );
      expect(consolidated.totalDagoRevenue).toBe(
        ksSettlement.dagoTotalRevenue + kitchenSettlement.dagoTotalRevenue
      );
      expect(consolidated.totalCashDagoShare).toBe(
        ksSettlement.cashDagoShare + kitchenSettlement.cashDagoShare
      );
      expect(consolidated.totalQrisTenantShare).toBe(
        ksSettlement.qrisTenantShare + kitchenSettlement.qrisTenantShare
      );
      expect(consolidated.totalOtherNetSales).toBe(50000);

      // Verifikasi paritas dataset #10 dan #11 (termasuk kolom Transfer / EDC dan angka pasca-MDR)
      const report10 = buildSettlementReportDataset({
        scopeName: "Singaraja",
        orders: allOrders,
        mdrBearer: "DAGO",
        referenceDate: baseOrderDate,
      });
      const report11 = buildConsolidatedSettlementReportDataset({
        scopeName: "Singaraja",
        orders: allOrders,
        mdrBearer: "DAGO",
        referenceDate: baseOrderDate,
      });

      expect(report10.tableHeaders).toContain("Transfer / EDC (Rp)");
      expect(report11.tableHeaders).toContain("Transfer / EDC (Rp)");
      expect(report11.tableHeaders).toContain("Tren mingguan");

      // Angka pasca-MDR "Bagian DAGO" di #10 harus identik dengan "Total pendapatan DAGO" di #11
      const dago10Card = report10.summaryCards.find((c) => c.label === "Bagian DAGO")?.value;
      const dago11Card = report11.summaryCards.find(
        (c) => c.label === "Total pendapatan DAGO"
      )?.value;
      expect(dago10Card).toBe(dago11Card);

      // Copy & penulisan sesuai DESIGN_SYSTEM.md §8
      expect(report10.subtitle).not.toContain("#10:");
      expect(report11.title).not.toContain("#11");
      expect(report11.subtitle).not.toContain("#11:");
      const totalRow = report11.tableRows[report11.tableRows.length - 1];
      expect(totalRow[0]).toBe("Total");
    });

    it("memecah konsolidasi #11 per outlet dan menghitung tren vs minggu sebelumnya", () => {
      const prevWeekOrder: OrderRecord = {
        ...cashOrder1,
        id: "ord-ks-w1",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        createdAt: "2026-11-26T10:00:00.000Z", // Minggu lalu: 100.000
      };
      const currWeekSgr: OrderRecord = {
        ...cashOrder1,
        id: "ord-ks-w2-sgr",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        subtotal: 150000,
        total: 165000,
        items: [
          {
            id: "it-sgr",
            productName: "Kopi Senja",
            quantity: 3,
            unitPrice: 50000,
            tenantId: "tenant-ks",
          },
        ],
      };
      const currWeekDps: OrderRecord = {
        ...cashOrder1,
        id: "ord-ks-w2-dps",
        outletId: "outlet-dps",
        outletName: "Denpasar",
        subtotal: 80000,
        total: 88000,
        items: [
          {
            id: "it-dps",
            productName: "Kopi Senja",
            quantity: 1,
            unitPrice: 80000,
            tenantId: "tenant-ks",
          },
        ],
      };

      const consolidated = calculateConsolidatedWeeklySettlement(
        [prevWeekOrder, currWeekSgr, currWeekDps],
        { referenceDate: baseOrderDate }
      );

      const ksRows = consolidated.tenants.filter((t) => t.tenantId === "tenant-ks");
      expect(ksRows).toHaveLength(2);

      const sgrRow = ksRows.find((r) => r.outletId === "outlet-sgr");
      const dpsRow = ksRows.find((r) => r.outletId === "outlet-dps");
      expect(sgrRow?.outletName).toBe(DEMO_OUTLETS[0].name);
      expect(sgrRow?.trendLabel).toBe("+50% vs minggu lalu");
      expect(dpsRow?.outletName).toBe("Denpasar");
      expect(dpsRow?.trendLabel).toBe("Baru");
    });

    it("mendukung persentase dinamis 70/30 (template Ka Ari) selain default 85/15", () => {
      const customSplits = {
        "tenant-ks": { tenantSharePercent: 70, dagoSharePercent: 30 },
      };

      const settlement = calculateWeeklyTenantSettlement([cashOrder1], "tenant-ks", {
        customSplits,
        referenceDate: baseOrderDate,
      });

      expect(settlement.tenantSharePercent).toBe(70);
      expect(settlement.dagoSharePercent).toBe(30);
      expect(settlement.cashTenantShare).toBe(70000);
      expect(settlement.cashDagoShare).toBe(30000);
    });

    it("melewati mitra INTERNAL pada mode settlement standar tetapi menyertakannya di Laporan #11 dengan transfer/setoran 0", async () => {
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

      const consolidated = calculateConsolidatedWeeklySettlement([internalOrder], {
        includeInternal: false,
        referenceDate: baseOrderDate,
      });
      expect(consolidated.tenants.find((t) => t.tenantId === "tenant-internal-test")).toBeUndefined();

      const consolidatedWithInt = calculateConsolidatedWeeklySettlement([internalOrder], {
        includeInternal: true,
        referenceDate: baseOrderDate,
      });
      const foundInt = consolidatedWithInt.tenants.find(
        (t) => t.tenantId === "tenant-internal-test"
      );
      expect(foundInt).toBeDefined();
      expect(foundInt?.cashDagoShare).toBe(0);
      expect(foundInt?.qrisTenantShare).toBe(0);
      expect(foundInt?.netTransferAmount).toBe(0);

      // Laporan #11 menyertakan mitra INTERNAL secara otomatis
      const report11 = buildReportData({
        type: "SETTLEMENT_CONSOLIDATED",
        scopeName: "Singaraja",
        orders: [internalOrder],
        mdrBearer: "MITRA",
        referenceDate: baseOrderDate,
      });
      const intRow = report11.tableRows.find((r) => r[0] === "tenant-internal-test");
      expect(intRow).toBeDefined();
      expect(intRow?.[intRow.length - 1]).toBe("Internal");
      expect(intRow?.[intRow.length - 2]).toBe("Rp 0");
    });

    it("mendukung deteksi +/-Rp di PDF, alokasi lebar colgroup 100%, dan hitung ulang summaryCards saat filter pencarian", () => {
      expect(isNumericOrCurrencyCell("+Rp 151.740")).toBe(true);
      expect(isNumericOrCurrencyCell("-Rp 15.000")).toBe(true);

      const report11 = buildConsolidatedSettlementReportDataset({
        scopeName: "Singaraja",
        orders: [cashOrder1, qrisOrder1],
        mdrBearer: "MITRA",
        referenceDate: baseOrderDate,
      });

      const widths = computeReportColumnWidths(report11.tableHeaders);
      expect(widths).toHaveLength(report11.tableHeaders.length);
      expect(widths.reduce((s, w) => s + w, 0)).toBe(100);

      const ksRows = report11.tableRows.filter((r) => r[0] === "tenant-ks");
      const recalculated = recalculateReportSummaryCards(
        report11,
        ksRows,
        "SETTLEMENT_CONSOLIDATED"
      );
      expect(recalculated.find((c) => c.label === "Omzet bersih konsolidasi")?.value).toBe(
        "Rp 280.000"
      );
    });

    it("mengakumulasi refundDeduction multi-outlet di #10 sehingga mitra tetap muncul dan angkanya konsisten", () => {
      const sgrOrder: OrderRecord = {
        ...cashOrder1,
        id: "ord-multi-sgr",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        subtotal: 100000,
        total: 110000,
      };
      const dpsCrossRefundOnly: OrderRecord = {
        ...cashOrder1,
        id: "ord-multi-dps-refund",
        outletId: "outlet-dps",
        outletName: "Denpasar",
        subtotal: 50000,
        discount: 0,
        total: 55000,
        createdAt: "2026-11-26T10:00:00.000Z", // Minggu lalu
        status: "CANCELLED",
        paymentStatus: "REFUNDED",
        refundMethod: "CASH",
        refundedAt: baseOrderDate, // Direfund minggu ini
        items: [
          {
            id: "it-dps-ref",
            productName: "Kopi Senja",
            quantity: 1,
            unitPrice: 50000,
            tenantId: "tenant-ks",
          },
        ],
      };

      // Kasus A: outlet-sgr punya transaksi, outlet-dps hanya punya refund lintas minggu
      const report10WithSales = buildSettlementReportDataset({
        scopeName: "Semua outlet",
        orders: [sgrOrder, dpsCrossRefundOnly],
        mdrBearer: "MITRA",
        referenceDate: baseOrderDate,
      });
      const ksRowWithSales = report10WithSales.tableRows.find((r) => r[0] === "tenant-ks");
      expect(ksRowWithSales).toBeDefined();
      expect(ksRowWithSales?.[8]).toBe("Rp 100.000");

      // Kasus B: kedua outlet 0 transaksi minggu ini, tetapi outlet-dps punya refund lintas minggu -> tidak boleh hilang
      const sgrCrossRefundZeroed: OrderRecord = {
        ...sgrOrder,
        id: "ord-multi-sgr-same-week-refund",
        status: "CANCELLED",
        paymentStatus: "REFUNDED",
        refundedAt: baseOrderDate,
      };
      const report10RefundOnly = buildSettlementReportDataset({
        scopeName: "Semua outlet",
        orders: [sgrCrossRefundZeroed, dpsCrossRefundOnly],
        mdrBearer: "MITRA",
        referenceDate: baseOrderDate,
      });
      const ksRefundOnlyRow = report10RefundOnly.tableRows.find((r) => r[0] === "tenant-ks");
      expect(ksRefundOnlyRow).toBeDefined();
      expect(ksRefundOnlyRow?.[4]).toBe(0);
    });

    it("mengecualikan mitra INTERNAL (dan DAGO_HUB) dari pendingCount serta penyebut Lunas di #11", async () => {
      const { saveTenantProfile } = await import("@/lib/tenant");
      saveTenantProfile({
        tenantId: "tenant-internal-count",
        brandName: "Dago Internal Kitchen",
        tagline: "Internal",
        description: "Mitra internal",
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

      const period = getWeeklySettlementPeriod(baseOrderDate);
      setSettlementPaymentStatus(period.periodKey, "tenant-ks", "PAID", "Owner");

      const internalOrder: OrderRecord = {
        ...cashOrder1,
        id: "ord-int-cnt",
        items: [
          {
            id: "it-int-cnt",
            productName: "Menu Internal",
            quantity: 1,
            unitPrice: 50000,
            tenantId: "tenant-internal-count",
          },
        ],
      };

      const dagoHubSettlement = calculateWeeklyTenantSettlement([cashOrder1], "DAGO_HUB", {
        referenceDate: baseOrderDate,
      });
      expect(dagoHubSettlement.partnerType).toBe("INTERNAL");
      expect(dagoHubSettlement.netTransferAmount).toBe(0);
      expect(dagoHubSettlement.actionLabel).toBe("Mitra internal (tanpa settlement)");

      const consolidated = calculateConsolidatedWeeklySettlement([cashOrder1, internalOrder], {
        includeInternal: true,
        referenceDate: baseOrderDate,
      });
      const payableRows = consolidated.tenants.filter((t) => t.partnerType !== "INTERNAL");
      expect(consolidated.tenants.length).toBeGreaterThan(payableRows.length);
      expect(consolidated.paidCount).toBe(1);
      expect(consolidated.pendingCount).toBe(payableRows.length - 1);

      const report11 = buildConsolidatedSettlementReportDataset({
        scopeName: "Singaraja",
        orders: [cashOrder1, internalOrder],
        mdrBearer: "MITRA",
        referenceDate: baseOrderDate,
      });
      const intRow = report11.tableRows.find((r) => r[0] === "tenant-internal-count");
      expect(intRow?.[intRow.length - 1]).toBe("Internal");
      const totalRow = report11.tableRows[report11.tableRows.length - 1];
      expect(totalRow[totalRow.length - 1]).toBe(`1/${payableRows.length} Lunas`);
    });

    it("memasukkan outlet yang aktif di minggu lalu namun idle di minggu ini ke total pembanding per mitra", () => {
      const prevWeekIdleOutletOrder: OrderRecord = {
        ...cashOrder1,
        id: "ord-prev-idle-dps",
        outletId: "outlet-dps",
        outletName: "Denpasar",
        subtotal: 100000,
        discount: 0,
        total: 110000,
        createdAt: "2026-11-26T10:00:00.000Z", // Minggu N-1: 100.000 (Dago 15.000)
      };
      const currWeekActiveOutletOrder: OrderRecord = {
        ...cashOrder1,
        id: "ord-curr-sgr",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        subtotal: 200000,
        discount: 0,
        total: 220000,
        items: [
          {
            id: "it-curr-sgr",
            productName: "Kopi Senja",
            quantity: 2,
            unitPrice: 100000,
            tenantId: "tenant-ks",
          },
        ],
      };

      const consolidated = calculateConsolidatedWeeklySettlement(
        [prevWeekIdleOutletOrder, currWeekActiveOutletOrder],
        { referenceDate: baseOrderDate }
      );

      expect(consolidated.previousTotalNetSales).toBe(100000);
      expect(consolidated.previousTotalDagoRevenue).toBe(15000);
      expect(consolidated.previousTenantTotals?.["tenant-ks"]).toEqual({
        previousNetSales: 100000,
        previousDagoRevenue: 15000,
        currentNetSales: 200000,
        currentDagoRevenue: 30000,
        trendLabel: "+100% vs minggu lalu",
      });

      const sgrRow = consolidated.tenants.find(
        (t) => t.tenantId === "tenant-ks" && t.outletId === "outlet-sgr"
      );
      expect(sgrRow?.previousTenantNetSales).toBe(100000);
      expect(sgrRow?.previousTenantDagoRevenue).toBe(15000);
    });
  });
});
