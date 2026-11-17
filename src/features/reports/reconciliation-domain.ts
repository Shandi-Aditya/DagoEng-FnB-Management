import { OrderRecord } from "@/types/order";
import { ShiftRecord } from "@/types/shift";
import { calculateSettlement } from "@/lib/settlement";

export type DiscrepancyType =
  | "UNCONFIRMED_QRIS"
  | "REFUND"
  | "MANUAL_DISCOUNT"
  | "CASH_VARIANCE"
  | "VOID_ORDER";

export interface DiscrepancyCauseItem {
  id: string;
  referenceNo: string;
  timestamp: string;
  cashierOrStaff: string;
  type: DiscrepancyType;
  typeLabel: string;
  amount: number;
  formattedAmount: string;
  financialImpact: string;
  reason: string;
  severity: "warning" | "destructive" | "info";
}

export interface ReconciliationTripartiteSummary {
  // 1. Kasir Physical / Shift Data
  totalCashierActual: number;
  totalCashierExpected: number;
  totalCashVariance: number;

  // 2. Struk / POS Transaction Data
  totalReceiptsGross: number;
  totalReceiptsNet: number;
  totalPaidRevenue: number;
  totalRefundAmount: number;
  totalPendingAmount: number;
  totalDiscountAmount: number;

  // 3. Settlement Data
  totalSettlementNet: number;
  totalTenantShare: number;
  totalDagoShare: number;

  // Analysis & Status
  totalDiscrepancyAmount: number;
  status: "BALANCED" | "NEEDS_ATTENTION";
  statusLabel: string;
  discrepanciesCount: number;
}

export interface ReconciliationAnalysisResult {
  summary: ReconciliationTripartiteSummary;
  discrepancies: DiscrepancyCauseItem[];
}

/**
 * Menghitung perbandingan tripartit (Kasir vs Struk vs Settlement)
 * serta mengidentifikasi seluruh transaksi spesifik yang menjadi penyebab selisih.
 * Sesuai kriteria Task V-16:
 * Ada selisih -> sistem menunjukkan transaksi penyebabnya (QRIS pending, refund, diskon, variansi kas fisik).
 */
export function analyzeTransactionDiscrepancies(params: {
  orders: readonly OrderRecord[];
  shifts: readonly ShiftRecord[];
}): ReconciliationAnalysisResult {
  const { orders, shifts } = params;
  const discrepancies: DiscrepancyCauseItem[] = [];

  // --- 1. Analisis Data Kasir (Shift) ---
  let totalCashierActual = 0;
  let totalCashierExpected = 0;
  let totalCashVariance = 0;

  for (const shift of shifts) {
    if (shift.status === "CLOSED" || shift.status === "NEEDS_RECONCILIATION") {
      totalCashierActual += shift.actualCash || 0;
      totalCashierExpected += shift.expectedCash || 0;
      const variance = shift.cashVariance || 0;
      totalCashVariance += variance;

      // Jika ada selisih kas fisik pada shift
      if (variance !== 0) {
        const isShortage = variance < 0;
        discrepancies.push({
          id: `var-shift-${shift.id}`,
          referenceNo: `Shift #${shift.id}`,
          timestamp: shift.endTime || shift.startTime || "-",
          cashierOrStaff: shift.assignedCashierName || "Kasir Shift",
          type: "CASH_VARIANCE",
          typeLabel: isShortage ? "Kurang Kas Fisik" : "Lebih Kas Fisik",
          amount: Math.abs(variance),
          formattedAmount: `${variance > 0 ? "+" : "-"}Rp ${Math.abs(variance).toLocaleString("id-ID")}`,
          financialImpact: isShortage
            ? "Kas fisik lebih kecil dari penerimaan sistem"
            : "Kas fisik lebih besar dari penerimaan sistem",
          reason: shift.closingNotes || (isShortage ? "Uang kas fisik tekor saat closing" : "Kelebihan kas fisik"),
          severity: isShortage ? "destructive" : "warning",
        });
      }
    }
  }

  // --- 2. Analisis Transaksi POS (Orders & Struk) ---
  let totalReceiptsGross = 0;
  let totalPaidRevenue = 0;
  let totalRefundAmount = 0;
  let totalPendingAmount = 0;
  let totalDiscountAmount = 0;

  for (const order of orders) {
    const orderTotal = order.total || 0;
    const orderSubtotal = order.subtotal || orderTotal;
    const orderDiscount = order.discount || 0;

    totalReceiptsGross += orderSubtotal;
    totalDiscountAmount += orderDiscount;

    // A. Deteksi Transaksi Refund
    if (order.paymentStatus === "REFUNDED") {
      totalRefundAmount += orderTotal;
      discrepancies.push({
        id: `refund-${order.id}`,
        referenceNo: order.orderNumber,
        timestamp: order.refundedAt || order.createdAt || "-",
        cashierOrStaff: order.refundApprovedBy ? `${order.refundApprovedBy} (SPV)` : "Kasir",
        type: "REFUND",
        typeLabel: `Refund (${order.paymentMethod || "Transaksi"})`,
        amount: orderTotal,
        formattedAmount: `-Rp ${orderTotal.toLocaleString("id-ID")}`,
        financialImpact: "Pengembalian dana membatalkan penerimaan kas/rekening",
        reason: order.refundReason || "Pengembalian dana transaksi",
        severity: "destructive",
      });
      continue;
    }

    // B. Deteksi Transaksi QRIS Menggantung / Belum Terkonfirmasi
    if (order.paymentMethod === "QRIS" && order.paymentStatus === "PENDING") {
      totalPendingAmount += orderTotal;
      discrepancies.push({
        id: `pending-qris-${order.id}`,
        referenceNo: order.orderNumber,
        timestamp: order.createdAt || "-",
        cashierOrStaff: "Sistem Gateway",
        type: "UNCONFIRMED_QRIS",
        typeLabel: "QRIS Belum Konfirmasi",
        amount: orderTotal,
        formattedAmount: `Rp ${orderTotal.toLocaleString("id-ID")}`,
        financialImpact: "Dana belum masuk rekening settlement DAGO",
        reason: "Pembayaran QRIS belum diverifikasi webhook / supervisor",
        severity: "warning",
      });
      continue;
    }

    // C. Deteksi Transaksi Dibatalkan (Void)
    if (order.status === "CANCELLED") {
      discrepancies.push({
        id: `void-${order.id}`,
        referenceNo: order.orderNumber,
        timestamp: order.createdAt || "-",
        cashierOrStaff: "Kasir",
        type: "VOID_ORDER",
        typeLabel: "Pesanan Dibatalkan (Void)",
        amount: orderTotal,
        formattedAmount: `Rp ${orderTotal.toLocaleString("id-ID")}`,
        financialImpact: "Struk dibatalkan sebelum pembayaran diproses",
        reason: "Pesanan dibatalkan",
        severity: "info",
      });
      continue;
    }

    // D. Deteksi Diskon Manual / Promo Terapan
    if (order.paymentStatus === "PAID") {
      totalPaidRevenue += orderTotal;

      if (orderDiscount > 0) {
        discrepancies.push({
          id: `disc-${order.id}`,
          referenceNo: order.orderNumber,
          timestamp: order.createdAt || "-",
          cashierOrStaff: "Kasir",
          type: "MANUAL_DISCOUNT",
          typeLabel: "Diskon Promo/Manual",
          amount: orderDiscount,
          formattedAmount: `-Rp ${orderDiscount.toLocaleString("id-ID")}`,
          financialImpact: "Mengurangi kas bersih dibanding harga menu kotor",
          reason: order.promoId ? `Promo Voucher: ${order.promoId}` : "Potongan harga penjualan",
          severity: "info",
        });
      }
    }
  }

  // --- 3. Analisis Settlement Mitra ---
  const settlementItems = calculateSettlement(orders as OrderRecord[]);
  const totalTenantShare = settlementItems.reduce((acc, s) => acc + (s.tenantShareAmount || 0), 0);
  const totalDagoShare = settlementItems.reduce((acc, s) => acc + (s.dagoShareAmount || 0), 0);
  const totalSettlementNet = settlementItems.reduce(
    (acc, s) => acc + (s.dpp ?? (s.grossRevenue - s.discount)),
    0
  );

  // Perhitungan total selisih bersih yang menuntut perhatian
  const totalDiscrepancyAmount =
    Math.abs(totalCashVariance) + totalRefundAmount + totalPendingAmount + totalDiscountAmount;

  const hasIssues = discrepancies.length > 0;

  const summary: ReconciliationTripartiteSummary = {
    totalCashierActual,
    totalCashierExpected,
    totalCashVariance,
    totalReceiptsGross,
    totalReceiptsNet: totalPaidRevenue,
    totalPaidRevenue,
    totalRefundAmount,
    totalPendingAmount,
    totalDiscountAmount,
    totalSettlementNet,
    totalTenantShare,
    totalDagoShare,
    totalDiscrepancyAmount,
    status: hasIssues ? "NEEDS_ATTENTION" : "BALANCED",
    statusLabel: hasIssues
      ? `${discrepancies.length} Transaksi Selisih Perlu Rekonsiliasi`
      : "Seimbang (Tidak Ada Selisih)",
    discrepanciesCount: discrepancies.length,
  };

  return {
    summary,
    discrepancies,
  };
}
