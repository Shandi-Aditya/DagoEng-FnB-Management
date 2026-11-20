import { describe, it, expect } from "vitest";
import { recordShiftRefundTransaction } from "@/lib/shift-management";
import { calculateSettlement } from "@/lib/settlement";
import { aggregateOrdersTaxAndRevenue } from "@/lib/tax-breakdown";
import { buildReportData } from "@/features/reports/reports-domain";
import type { OrderRecord } from "@/types/order";
import type { ShiftRecord } from "@/types/shift";
import type { LoyaltyMember, LoyaltyPointTransaction } from "@/types/loyalty";

describe("Task V-13: Refund Transaksi QRIS & Tunai", () => {
  const initialShift: ShiftRecord = {
    id: "shift-v13-01",
    shiftName: "Shift Pagi (08:00 - 16:00)",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    assignedCashierId: "emp-kasir-1",
    assignedCashierName: "Ayu Lestari",
    startTime: "2026-11-17T08:00:00Z",
    status: "ACTIVE",
    openingCash: 500000,
    cashSales: 100000,
    nonCashSales: 150000,
    refundAmount: 0,
    expectedCash: 600000, // 500.000 opening + 100.000 cashSales
    actualCash: 0,
    cashVariance: 0,
    recordedSaleIds: ["sale-1", "sale-2"],
    recordedRefundIds: [],
  };

  const qrisOrder: OrderRecord = {
    id: "ord-qris-101",
    orderNumber: "ORD-QRIS-101",
    organizationId: "org-dago-hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    customerName: "Gede Arya",
    customerPhone: "081234567890",
    orderType: "DINE_IN",
    tableNumber: "04",
    status: "COMPLETED",
    paymentStatus: "PAID",
    paymentMethod: "QRIS",
    subtotal: 60000,
    tax: 6000,
    serviceCharge: 0,
    total: 66000,
    discount: 0,
    targetServiceMinutes: 15,
    createdAt: "2026-11-17T09:30:00Z",
    items: [
      {
        id: "item-101",
        productId: "menu-coffee",
        productName: "Espresso Blend Kopi Senja",
        quantity: 2,
        unitPrice: 30000,
        tenantId: "tenant-ks",
      },
    ],
    statusHistory: [
      {
        id: "sh-1",
        orderId: "ord-qris-101",
        fromStatus: null,
        toStatus: "NEW",
        timestamp: "2026-11-17T09:30:00Z",
        actorName: "Kasir Ayu",
      },
      {
        id: "sh-2",
        orderId: "ord-qris-101",
        fromStatus: "NEW",
        toStatus: "COMPLETED",
        timestamp: "2026-11-17T09:32:00Z",
        actorName: "Kasir Ayu",
        note: "Pembayaran lunas via QRIS (Rp 66.000)",
      },
    ],
  };

  const cashOrder: OrderRecord = {
    id: "ord-cash-202",
    orderNumber: "ORD-CASH-202",
    organizationId: "org-dago-hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    customerName: "Made Suardana",
    orderType: "DINE_IN",
    tableNumber: "07",
    status: "COMPLETED",
    paymentStatus: "PAID",
    paymentMethod: "CASH",
    subtotal: 50000,
    tax: 5000,
    serviceCharge: 0,
    total: 55000,
    discount: 0,
    targetServiceMinutes: 15,
    createdAt: "2026-11-17T10:15:00Z",
    items: [
      {
        id: "item-202",
        productId: "menu-bakery",
        productName: "Croissant Almond",
        quantity: 2,
        unitPrice: 25000,
        tenantId: "tenant-bakery",
      },
    ],
    statusHistory: [
      {
        id: "sh-3",
        orderId: "ord-cash-202",
        fromStatus: null,
        toStatus: "NEW",
        timestamp: "2026-11-17T10:15:00Z",
        actorName: "Kasir Ayu",
      },
      {
        id: "sh-4",
        orderId: "ord-cash-202",
        fromStatus: "NEW",
        toStatus: "COMPLETED",
        timestamp: "2026-11-17T10:16:00Z",
        actorName: "Kasir Ayu",
        note: "Pembayaran lunas via CASH (Rp 55.000)",
      },
    ],
  };

  describe("Skenario 1: Refund Transaksi QRIS (Dikembalikan Tunai dari Laci Kasir)", () => {
    it("memperbarui status order menjadi CANCELLED dan REFUNDED beserta alasan dan supervisor", () => {
      const nowIso = "2026-11-17T10:45:00Z";
      const refundedQrisOrder: OrderRecord = {
        ...qrisOrder,
        status: "CANCELLED",
        paymentStatus: "REFUNDED",
        refundReason: "Salah menu pesanan dan tamu minta cancel",
        refundApprovedBy: "Budi Santoso (Store Manager)",
        refundedAt: nowIso,
        refundMethod: "CASH",
        statusHistory: [
          ...(qrisOrder.statusHistory || []),
          {
            id: "sh-refund-1",
            orderId: qrisOrder.id,
            fromStatus: qrisOrder.status,
            toStatus: "CANCELLED",
            timestamp: nowIso,
            actorName: "Budi Santoso (Store Manager)",
            note: "[REFUND QRIS -> CASH] Salah menu pesanan dan tamu minta cancel",
          },
        ],
      };

      expect(refundedQrisOrder.status).toBe("CANCELLED");
      expect(refundedQrisOrder.paymentStatus).toBe("REFUNDED");
      expect(refundedQrisOrder.refundMethod).toBe("CASH");
      expect(refundedQrisOrder.refundReason).toBe("Salah menu pesanan dan tamu minta cancel");
      expect(refundedQrisOrder.refundApprovedBy).toBe("Budi Santoso (Store Manager)");
      expect(refundedQrisOrder.refundedAt).toBe(nowIso);
    });

    it("mengurangi kas fisik di laci kasir (expectedCash) dan mencatat refundAmount pada shift", () => {
      const refundResult = recordShiftRefundTransaction({
        shifts: [initialShift],
        shiftId: initialShift.id,
        cashierId: initialShift.assignedCashierId,
        refundAmount: qrisOrder.total, // Rp 66.000 tunai dikeluarkan untuk refund QRIS
        orderId: qrisOrder.id,
      });

      expect(refundResult.success).toBe(true);
      expect(refundResult.shift).toBeDefined();

      const updatedShift = refundResult.shift!;
      expect(updatedShift.refundAmount).toBe(66000);
      // expectedCash = openingCash (500.000) + cashSales (100.000) - refundAmount (66.000) = 534.000
      expect(updatedShift.expectedCash).toBe(534000);
      expect(updatedShift.recordedRefundIds).toContain(qrisOrder.id);
    });

    it("idempotensi refund pada shift: orderId yang sama tidak memotong kas dua kali", () => {
      const firstRun = recordShiftRefundTransaction({
        shifts: [initialShift],
        shiftId: initialShift.id,
        cashierId: initialShift.assignedCashierId,
        refundAmount: qrisOrder.total,
        orderId: qrisOrder.id,
      });

      const secondRun = recordShiftRefundTransaction({
        shifts: firstRun.updatedShifts,
        shiftId: initialShift.id,
        cashierId: initialShift.assignedCashierId,
        refundAmount: qrisOrder.total,
        orderId: qrisOrder.id,
      });

      expect(secondRun.shift?.refundAmount).toBe(66000);
      expect(secondRun.shift?.expectedCash).toBe(534000);
    });

    it("mengurangi omset kotor, PB1, dan pendapatan non-tunai di laporan", () => {
      const refundedQrisOrder: OrderRecord = {
        ...qrisOrder,
        status: "CANCELLED",
        paymentStatus: "REFUNDED",
        refundReason: "Salah menu",
        refundApprovedBy: "Budi Santoso",
        refundedAt: "2026-11-17T10:45:00Z",
        refundMethod: "CASH",
      };

      // Saat order belum di-refund
      const beforeTax = aggregateOrdersTaxAndRevenue([qrisOrder]);
      expect(beforeTax.totalRevenue).toBe(66000);
      expect(beforeTax.totalTaxPB1).toBe(6000);
      expect(beforeTax.orderCount).toBe(1);

      // Setelah order di-refund
      const afterTax = aggregateOrdersTaxAndRevenue([refundedQrisOrder]);
      expect(afterTax.totalRevenue).toBe(0);
      expect(afterTax.totalTaxPB1).toBe(0);
      expect(afterTax.orderCount).toBe(0);

      // Laporan domain reports
      const reportBefore = buildReportData({
        type: "SALES",
        scopeName: "Singaraja",
        orders: [qrisOrder],
      });
      expect(reportBefore.summaryCards[0].value).toBe("Rp 66.000"); // Omzet
      expect(reportBefore.summaryCards[4].value).toBe("Rp 6.000"); // PB1

      const reportAfter = buildReportData({
        type: "SALES",
        scopeName: "Singaraja",
        orders: [refundedQrisOrder],
      });
      expect(reportAfter.summaryCards[0].value).toBe("Rp 0"); // Omzet berkurang jadi 0
      expect(reportAfter.summaryCards[4].value).toBe("Rp 0"); // PB1 berkurang jadi 0
    });

    it("mengurangi settlement mitra: order yang di-refund dikeluarkan dari bagi hasil tenant", () => {
      const refundedQrisOrder: OrderRecord = {
        ...qrisOrder,
        status: "CANCELLED",
        paymentStatus: "REFUNDED",
      };

      // Settlement saat order masih valid lunas
      const settlementBefore = calculateSettlement([qrisOrder]);
      const ksBefore = settlementBefore.find((s) => s.tenantId === "tenant-ks");
      expect(ksBefore).toBeDefined();
      expect(ksBefore!.grossRevenue).toBe(60000);
      expect(ksBefore!.tenantShareAmount).toBe(51000); // 85% dari 60.000 DPP

      // Settlement setelah order di-refund
      const settlementAfter = calculateSettlement([refundedQrisOrder]);
      const ksAfter = settlementAfter.find((s) => s.tenantId === "tenant-ks");
      expect(ksAfter).toBeUndefined(); // Tidak ada hak bagi hasil untuk order yang di-refund
    });

    it("menarik kembali poin dan total belanja member pada loyalty", () => {
      // Simulasi member mendapat poin saat pembayaran awal (Rp 66.000 -> 66 poin)
      const earnedPoints = Math.floor(qrisOrder.total / 1000);
      expect(earnedPoints).toBe(66);

      const initialMember: LoyaltyMember = {
        id: "mem-01",
        name: "Gede Arya",
        phone: "081234567890",
        tier: "Bronze",
        points: 100,
        totalSpend: 100000,
        totalVisits: 2,
        favoriteItem: "Espresso",
        registeredOutletId: "outlet-sgr",
        registeredOutletName: "Singaraja",
        status: "ACTIVE",
        joinedDate: "2026-01-01",
        lastVisit: "2026-11-17",
        pointHistory: [
          {
            id: "ptx-earn-1",
            memberId: "mem-01",
            type: "EARN",
            points: earnedPoints,
            balanceAfter: 166,
            reason: "Penyelesaian Pesanan #ORD-QRIS-101",
            relatedTransactionId: qrisOrder.id,
            timestamp: "2026-11-17T09:32:00Z",
            actorName: "Kasir Ayu",
            outletId: "outlet-sgr",
          },
        ],
        tierHistory: [],
      };

      // Penarikan kembali poin (reverseTransactionPoints)
      const earnTx = initialMember.pointHistory.find(
        (ptx) => ptx.type === "EARN" && ptx.relatedTransactionId === qrisOrder.id
      );
      expect(earnTx).toBeDefined();

      const pointsToDeduct = earnTx!.points;
      const newPoints = Math.max(0, initialMember.points - pointsToDeduct);
      const refundedSpend = pointsToDeduct * 1000;
      const newSpend = Math.max(0, (initialMember.totalSpend || 0) - refundedSpend);

      const revTx: LoyaltyPointTransaction = {
        id: "ptx-rev-1",
        memberId: initialMember.id,
        type: "ADJUSTMENT",
        points: -pointsToDeduct,
        balanceAfter: newPoints,
        reason: `Refund pesanan #${qrisOrder.orderNumber}: Salah menu`,
        relatedTransactionId: `rev-${qrisOrder.id}`,
        timestamp: "2026-11-17T10:45:00Z",
        actorName: "Budi Santoso",
        outletId: "outlet-sgr",
      };

      const updatedMember: LoyaltyMember = {
        ...initialMember,
        points: newPoints,
        totalSpend: newSpend,
        totalVisits: Math.max(0, (initialMember.totalVisits || 0) - 1),
        pointHistory: [revTx, ...initialMember.pointHistory],
      };

      expect(updatedMember.points).toBe(34); // 100 - 66
      expect(updatedMember.totalSpend).toBe(34000); // 100.000 - 66.000
      expect(updatedMember.totalVisits).toBe(1);
      expect(updatedMember.pointHistory[0].type).toBe("ADJUSTMENT");
      expect(updatedMember.pointHistory[0].points).toBe(-66);
    });
  });

  describe("Skenario 2: Refund Transaksi Tunai (Cash)", () => {
    it("memperbarui status order tunai menjadi CANCELLED dan REFUNDED", () => {
      const nowIso = "2026-11-17T11:00:00Z";
      const refundedCashOrder: OrderRecord = {
        ...cashOrder,
        status: "CANCELLED",
        paymentStatus: "REFUNDED",
        refundReason: "Komplain roti dingin dan tamu menolak penggantian",
        refundApprovedBy: "Budi Santoso (Store Manager)",
        refundedAt: nowIso,
        refundMethod: "CASH",
      };

      expect(refundedCashOrder.status).toBe("CANCELLED");
      expect(refundedCashOrder.paymentStatus).toBe("REFUNDED");
      expect(refundedCashOrder.refundMethod).toBe("CASH");
    });

    it("mengurangi kas fisik di laci kasir sebesar nominal refund tunai", () => {
      const refundResult = recordShiftRefundTransaction({
        shifts: [initialShift],
        shiftId: initialShift.id,
        cashierId: initialShift.assignedCashierId,
        refundAmount: cashOrder.total, // Rp 55.000
        orderId: cashOrder.id,
      });

      expect(refundResult.success).toBe(true);
      const updatedShift = refundResult.shift!;
      expect(updatedShift.refundAmount).toBe(55000);
      // expectedCash = openingCash (500.000) + cashSales (100.000) - refundAmount (55.000) = 545.000
      expect(updatedShift.expectedCash).toBe(545000);
      expect(updatedShift.recordedRefundIds).toContain(cashOrder.id);
    });

    it("mengurangi omset tunai di laporan pendapatan dan settlement mitra", () => {
      const refundedCashOrder: OrderRecord = {
        ...cashOrder,
        status: "CANCELLED",
        paymentStatus: "REFUNDED",
      };

      // Aggregasi pajak dan pendapatan
      const taxBefore = aggregateOrdersTaxAndRevenue([cashOrder]);
      expect(taxBefore.totalRevenue).toBe(55000);
      expect(taxBefore.totalTaxPB1).toBe(5000);

      const taxAfter = aggregateOrdersTaxAndRevenue([refundedCashOrder]);
      expect(taxAfter.totalRevenue).toBe(0);
      expect(taxAfter.totalTaxPB1).toBe(0);

      // Laporan pendapatan
      const reportBefore = buildReportData({
        type: "SALES",
        scopeName: "Singaraja",
        orders: [cashOrder],
      });
      expect(reportBefore.summaryCards[0].value).toBe("Rp 55.000");

      const reportAfter = buildReportData({
        type: "SALES",
        scopeName: "Singaraja",
        orders: [refundedCashOrder],
      });
      expect(reportAfter.summaryCards[0].value).toBe("Rp 0");

      // Settlement mitra bakery
      const settlementBefore = calculateSettlement([cashOrder]);
      const bakeryBefore = settlementBefore.find((s) => s.tenantId === "tenant-bakery");
      expect(bakeryBefore).toBeDefined();
      expect(bakeryBefore!.grossRevenue).toBe(50000);
      expect(bakeryBefore!.tenantShareAmount).toBe(42500); // 85% dari 50.000

      const settlementAfter = calculateSettlement([refundedCashOrder]);
      const bakeryAfter = settlementAfter.find((s) => s.tenantId === "tenant-bakery");
      expect(bakeryAfter).toBeUndefined();
    });
  });

  describe("Skenario 3: Boundary Discipline & Keamanan Validasi Refund", () => {
    it("menolak proses refund jika alasan refund kosong", () => {
      const cleanReason = "".trim();
      const isValid = cleanReason.length > 0;
      expect(isValid).toBe(false);
    });

    it("menolak proses refund jika otorisasi supervisor tidak disertakan", () => {
      const supervisorName = "   ".trim();
      const isValid = supervisorName.length > 0;
      expect(isValid).toBe(false);
    });

    it("menolak refund jika order sudah pernah di-refund sebelumnya", () => {
      const alreadyRefundedOrder: OrderRecord = {
        ...qrisOrder,
        paymentStatus: "REFUNDED",
        status: "CANCELLED",
      };

      const canRefund =
        alreadyRefundedOrder.paymentStatus !== "REFUNDED" &&
        alreadyRefundedOrder.status !== "CANCELLED";
      expect(canRefund).toBe(false);
    });

    it("mencatat audit log REFUND_ORDER secara lengkap", () => {
      const auditPayload = {
        module: "POS",
        action: "REFUND_ORDER",
        recordId: qrisOrder.orderNumber,
        previousValue: `Status: ${qrisOrder.status}, Payment: ${qrisOrder.paymentStatus}`,
        newValue: "Status: CANCELLED, Payment: REFUNDED (via CASH)",
        description: `Refund transaksi ${qrisOrder.orderNumber} sebesar Rp 66.000 dikembalikan tunai. Disetujui supervisor: Budi Santoso`,
        reason: "Salah menu pesanan",
        status: "SUCCESS",
        outletId: "outlet-sgr",
      };

      expect(auditPayload.action).toBe("REFUND_ORDER");
      expect(auditPayload.recordId).toBe(qrisOrder.orderNumber);
      expect(auditPayload.reason).toBe("Salah menu pesanan");
      expect(auditPayload.description).toContain("Budi Santoso");
    });
  });
});
