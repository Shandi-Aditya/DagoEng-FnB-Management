/**
 * Pembangun dataset Laporan #10 (Settlement Mingguan per Mitra) dan #11 (Konsolidasi Semua Mitra).
 * Diekstrak dari settlement-weekly-domain.ts untuk menjaga modularitas dan batas ukuran berkas.
 */

import type { OrderRecord } from "@/types/order";
import {
  calculateSettlement,
  getTenantPayoutAccount,
  maskAccountNumber,
} from "@/lib/settlement";
import {
  getStoredSettlementReceiptPolicy,
  settlementBasisLabel,
  type SettlementBasisMode,
} from "@/lib/settlement-receipt-policy";
import type { OutletItem } from "@/lib/receipt-publisher";
import type { ReportDataset } from "./reports-domain";
import {
  calculateConsolidatedWeeklySettlement,
  getWeeklySettlementPeriod,
  type MdrBearerMode,
  type WeeklyTenantSettlement,
} from "./settlement-weekly-domain";

export interface BuildSettlementReportDatasetParams {
  scopeName: string;
  orders: OrderRecord[];
  tenantId?: string;
  settlementBasis?: SettlementBasisMode;
  customSplits?: Record<string, { tenantSharePercent: number; dagoSharePercent: number }>;
  mdrBearer?: MdrBearerMode;
  referenceDate?: Date | string;
  outlets?: readonly OutletItem[];
}

function mergeTenantSettlementRow(
  existing: WeeklyTenantSettlement,
  row: WeeklyTenantSettlement
): void {
  existing.transactionCount += row.transactionCount;
  existing.totalGrossSales += row.totalGrossSales;
  existing.totalDiscount += row.totalDiscount;
  existing.totalNetSales += row.totalNetSales;
  existing.cashGrossSales += row.cashGrossSales;
  existing.cashDiscount += row.cashDiscount;
  existing.cashNetSales += row.cashNetSales;
  existing.cashTenantShare += row.cashTenantShare;
  existing.cashDagoShare += row.cashDagoShare;
  existing.qrisGrossSales += row.qrisGrossSales;
  existing.qrisDiscount += row.qrisDiscount;
  existing.qrisNetSales += row.qrisNetSales;
  existing.qrisMdrFee += row.qrisMdrFee;
  existing.mdrTenantPortion += row.mdrTenantPortion;
  existing.mdrDagoPortion += row.mdrDagoPortion;
  existing.qrisTenantShare += row.qrisTenantShare;
  existing.qrisDagoShare += row.qrisDagoShare;
  existing.otherGrossSales += row.otherGrossSales;
  existing.otherDiscount += row.otherDiscount;
  existing.otherNetSales += row.otherNetSales;
  existing.otherTenantShare += row.otherTenantShare;
  existing.otherDagoShare += row.otherDagoShare;
  existing.refundDeduction = (existing.refundDeduction ?? 0) + (row.refundDeduction ?? 0);
  existing.tenantGrossShare += row.tenantGrossShare;
  existing.dagoGrossShare += row.dagoGrossShare;
  existing.tenantTotalEarnings += row.tenantTotalEarnings;
  existing.dagoTotalRevenue += row.dagoTotalRevenue;
  existing.netTransferAmount += row.netTransferAmount;

  const isInternal = existing.partnerType === "INTERNAL" || existing.tenantId === "DAGO_HUB";
  if (isInternal) {
    existing.actionDirection = "SETTLED";
    existing.actionLabel = "Mitra internal (tanpa settlement)";
  } else if (existing.netTransferAmount > 0) {
    existing.actionDirection = "DAGO_TO_MITRA";
    existing.actionLabel = `Dago transfer ke mitra (Rp ${existing.netTransferAmount.toLocaleString("id-ID")})`;
  } else if (existing.netTransferAmount < 0) {
    existing.actionDirection = "MITRA_TO_DAGO";
    existing.actionLabel = `Mitra setor ke Dago (Rp ${Math.abs(existing.netTransferAmount).toLocaleString("id-ID")})`;
  } else {
    existing.actionDirection = "SETTLED";
    existing.actionLabel = "Impas / Selesai";
  }
}

/**
 * Pembangun dataset Laporan #10 (Settlement Mingguan per Mitra).
 * Tetap mempertahankan mode non-mingguan jika `mdrBearer` tidak disetel untuk kompatibilitas laporan standar.
 */
export function buildSettlementReportDataset(
  params: BuildSettlementReportDatasetParams
): ReportDataset {
  const {
    scopeName,
    orders,
    tenantId,
    settlementBasis,
    customSplits,
    mdrBearer,
    referenceDate,
    outlets,
  } = params;

  const effectiveBasis = settlementBasis ?? getStoredSettlementReceiptPolicy().settlementBasis;

  if (!mdrBearer) {
    const rawSettlementData = calculateSettlement(orders, undefined, customSplits, {
      settlementBasis: effectiveBasis,
    });
    const settlementData = tenantId
      ? rawSettlementData.filter((s) => s.tenantId === tenantId)
      : rawSettlementData;
    const totalNetSettlement = settlementData.reduce(
      (sum, s) => sum + (s.dpp ?? s.grossRevenue - s.discount),
      0
    );
    const totalTenantShare = settlementData.reduce(
      (sum, s) => sum + (s.tenantShareAmount || 0),
      0
    );
    const totalDagoShare = settlementData.reduce(
      (sum, s) => sum + (s.dagoShareAmount || 0),
      0
    );
    const totalDiscount = settlementData.reduce((sum, s) => sum + s.discount, 0);

    const tableRows = settlementData.map((s) => {
      const payout = getTenantPayoutAccount(s.tenantId);
      const payoutDisplay =
        s.tenantId === "DAGO_HUB"
          ? "Rekening pusat DAGO"
          : `${payout.bankName} ${maskAccountNumber(payout.accountNumber)}`;
      const splitDisplay =
        s.tenantId === "DAGO_HUB"
          ? "100% DAGO"
          : `${s.tenantSharePercent}% Mitra / ${s.dagoSharePercent}% DAGO`;

      return [
        s.tenantId,
        s.tenantName,
        payoutDisplay,
        splitDisplay,
        s.transactionCount,
        `Rp ${s.grossRevenue.toLocaleString("id-ID")}`,
        `Rp ${(s.tenantShareAmount || 0).toLocaleString("id-ID")}`,
        `Rp ${(s.dagoShareAmount || 0).toLocaleString("id-ID")}`,
        `Rp ${(s.dpp ?? s.grossRevenue - s.discount).toLocaleString("id-ID")}`,
      ];
    });

    return {
      title: "Laporan settlement mitra",
      subtitle: `Rincian bagi hasil tenant dan rekonsiliasi pembayaran di ${scopeName}`,
      summaryCards: [
        { label: "Settlement bersih", value: `Rp ${totalNetSettlement.toLocaleString("id-ID")}` },
        { label: "Bagian mitra", value: `Rp ${totalTenantShare.toLocaleString("id-ID")}` },
        { label: "Bagian DAGO", value: `Rp ${totalDagoShare.toLocaleString("id-ID")}` },
        { label: "Diskon (prorata)", value: `Rp ${totalDiscount.toLocaleString("id-ID")}` },
      ],
      tableHeaders: [
        "ID mitra",
        "Mitra",
        "Rekening pencairan",
        "Bagi hasil",
        "Transaksi",
        "Kotor (Rp)",
        "Bagian mitra (Rp)",
        "Bagian DAGO (Rp)",
        "Bersih (Rp)",
      ],
      tableRows,
      reconciliationInfo: [
        { label: "Dasar bagi hasil", value: settlementBasisLabel(effectiveBasis) },
      ],
    };
  }

  const period = getWeeklySettlementPeriod(referenceDate);
  const effectiveMdrBearer: MdrBearerMode = mdrBearer;

  // Hitung per mitra (agregat semua outlet milik mitra untuk Laporan #10, atau filter ke tenantId jika tenant scope)
  const consolidated = calculateConsolidatedWeeklySettlement(orders, {
    mdrBearer: effectiveMdrBearer,
    customSplits,
    referenceDate,
    outlets,
    includeInternal: Boolean(tenantId),
  });

  // Agregasikan kembali per tenantId apabila satu mitra punya transaksi di banyak outlet,
  // sehingga angka pasca-MDR per mitra di #10 identik 100% dengan jumlah barisnya di #11.
  const byTenant = new Map<string, WeeklyTenantSettlement>();
  for (const row of consolidated.tenants) {
    if (tenantId && row.tenantId !== tenantId) continue;
    const existing = byTenant.get(row.tenantId);
    if (!existing) {
      byTenant.set(row.tenantId, { ...row });
    } else {
      mergeTenantSettlementRow(existing, row);
    }
  }

  const allTenants = Array.from(byTenant.values());
  const activeTenants = allTenants.filter(
    (s) => s.transactionCount > 0 || (s.refundDeduction ?? 0) > 0
  );
  const settlementData = tenantId
    ? allTenants
    : activeTenants.length > 0
    ? activeTenants
    : allTenants;

  const totalNetSettlement = settlementData.reduce((sum, s) => sum + s.totalNetSales, 0);
  const totalTenantSharePostMdr = settlementData.reduce(
    (sum, s) => sum + s.tenantTotalEarnings,
    0
  );
  const totalDagoSharePostMdr = settlementData.reduce(
    (sum, s) => sum + s.dagoTotalRevenue,
    0
  );
  const totalDiscount = settlementData.reduce((sum, s) => sum + s.totalDiscount, 0);

  const tableRows = settlementData.map((s) => {
    const isInternal = s.partnerType === "INTERNAL" || s.tenantId === "DAGO_HUB";
    const payoutDisplay =
      s.tenantId === "DAGO_HUB"
        ? "Rekening pusat DAGO"
        : `${s.bankName} ${s.accountNumber !== "-" ? maskAccountNumber(s.accountNumber) : "-"}`;
    const splitDisplay =
      s.tenantId === "DAGO_HUB"
        ? "100% DAGO"
        : isInternal
        ? "Internal DAGO"
        : `${s.tenantSharePercent}% Mitra / ${s.dagoSharePercent}% DAGO`;
    const statusLabel = isInternal
      ? "Internal"
      : s.status === "PAID"
      ? "Lunas"
      : "Belum lunas";

    return [
      s.tenantId,
      s.tenantName,
      payoutDisplay,
      splitDisplay,
      s.transactionCount,
      `Rp ${s.totalGrossSales.toLocaleString("id-ID")}`,
      `Rp ${s.tenantTotalEarnings.toLocaleString("id-ID")}`,
      `Rp ${s.dagoTotalRevenue.toLocaleString("id-ID")}`,
      `Rp ${s.totalNetSales.toLocaleString("id-ID")}`,
      `Rp ${s.cashNetSales.toLocaleString("id-ID")}`,
      `Rp ${s.cashDagoShare.toLocaleString("id-ID")}`,
      `Rp ${s.qrisNetSales.toLocaleString("id-ID")}`,
      `Rp ${s.qrisMdrFee.toLocaleString("id-ID")}`,
      `Rp ${s.qrisTenantShare.toLocaleString("id-ID")}`,
      `Rp ${s.otherNetSales.toLocaleString("id-ID")}`,
      s.actionLabel,
      statusLabel,
    ];
  });

  const mdrLabel =
    effectiveMdrBearer === "MITRA"
      ? "Ditanggung mitra"
      : effectiveMdrBearer === "DAGO"
      ? "Ditanggung DAGO"
      : "Dibagi proporsional";

  return {
    title: "Laporan settlement mitra",
    subtitle: `Rincian bagi hasil mingguan per metode bayar (Tunai, QRIS, Transfer/EDC) dan rekening pencairan di ${scopeName}`,
    summaryCards: [
      { label: "Settlement bersih", value: `Rp ${totalNetSettlement.toLocaleString("id-ID")}` },
      { label: "Bagian mitra", value: `Rp ${totalTenantSharePostMdr.toLocaleString("id-ID")}` },
      { label: "Bagian DAGO", value: `Rp ${totalDagoSharePostMdr.toLocaleString("id-ID")}` },
      { label: "Diskon (prorata)", value: `Rp ${totalDiscount.toLocaleString("id-ID")}` },
    ],
    tableHeaders: [
      "ID mitra",
      "Mitra",
      "Rekening pencairan",
      "Bagi hasil",
      "Transaksi",
      "Kotor (Rp)",
      "Bagian mitra (Rp)",
      "Bagian DAGO (Rp)",
      "Bersih (Rp)",
      "Tunai (Rp)",
      "Setor tunai ke DAGO (Rp)",
      "QRIS (Rp)",
      "MDR QRIS (Rp)",
      "Transfer QRIS ke mitra (Rp)",
      "Transfer / EDC (Rp)",
      "Aliran kas akhir",
      "Status",
    ],
    tableRows,
    reconciliationInfo: [
      { label: "Periode cut-off", value: period.periodLabel },
      { label: "Batas setor/transfer", value: period.paymentDueLabel },
      { label: "Dasar bagi hasil", value: settlementBasisLabel(effectiveBasis) },
      { label: "Beban MDR QRIS (0.7%)", value: mdrLabel },
    ],
  };
}

/**
 * Pembangun dataset Laporan #11 (Konsolidasi Semua Mitra per Outlet).
 * Menyertakan mitra INTERNAL dengan nominal transfer/setoran 0, rincian Transfer/EDC, dan tren minggu lalu.
 */
export function buildConsolidatedSettlementReportDataset(
  params: Omit<BuildSettlementReportDatasetParams, "tenantId" | "settlementBasis">
): ReportDataset {
  const { scopeName, orders, customSplits, mdrBearer, referenceDate, outlets } = params;
  const period = getWeeklySettlementPeriod(referenceDate);
  const effectiveMdrBearer: MdrBearerMode = mdrBearer || "MITRA";

  const consolidated = calculateConsolidatedWeeklySettlement(orders, {
    mdrBearer: effectiveMdrBearer,
    customSplits,
    referenceDate,
    outlets,
    includeInternal: true,
  });

  const tenantRows = consolidated.tenants.map((s) => {
    const isInternal = s.partnerType === "INTERNAL" || s.tenantId === "DAGO_HUB";
    const payoutDisplay = isInternal
      ? "Internal DAGO"
      : `${s.bankName} ${s.accountNumber !== "-" ? maskAccountNumber(s.accountNumber) : "-"}`;
    const statusLabel = isInternal
      ? "Internal"
      : s.status === "PAID"
      ? "Lunas"
      : "Belum lunas";
    const netTransferStr =
      s.netTransferAmount > 0
        ? `+Rp ${s.netTransferAmount.toLocaleString("id-ID")}`
        : s.netTransferAmount < 0
        ? `-Rp ${Math.abs(s.netTransferAmount).toLocaleString("id-ID")}`
        : "Rp 0";
    const partnerOutletLabel = s.outletName
      ? `${s.tenantName} · ${s.outletName}${isInternal ? " (Internal)" : ""}`
      : s.tenantName;

    return [
      s.tenantId,
      partnerOutletLabel,
      payoutDisplay,
      `Rp ${s.totalNetSales.toLocaleString("id-ID")}`,
      s.trendLabel || "0% vs minggu lalu",
      `Rp ${s.cashNetSales.toLocaleString("id-ID")}`,
      `Rp ${s.cashDagoShare.toLocaleString("id-ID")}`,
      `Rp ${s.qrisNetSales.toLocaleString("id-ID")}`,
      `Rp ${s.qrisTenantShare.toLocaleString("id-ID")}`,
      `Rp ${s.otherNetSales.toLocaleString("id-ID")}`,
      `Rp ${s.qrisMdrFee.toLocaleString("id-ID")}`,
      `Rp ${s.dagoTotalRevenue.toLocaleString("id-ID")}`,
      netTransferStr,
      statusLabel,
    ];
  });

  const totalNetTransfer =
    consolidated.totalNetTransferDagoToMitra - consolidated.totalNetSetoranMitraToDago;
  const totalNetTransferStr =
    totalNetTransfer > 0
      ? `+Rp ${totalNetTransfer.toLocaleString("id-ID")}`
      : totalNetTransfer < 0
      ? `-Rp ${Math.abs(totalNetTransfer).toLocaleString("id-ID")}`
      : "Rp 0";
  const payableTenantCount = consolidated.tenants.filter(
    (s) => s.partnerType !== "INTERNAL" && s.tenantId !== "DAGO_HUB"
  ).length;

  const totalRow = [
    "Total",
    "Total konsolidasi semua mitra",
    "—",
    `Rp ${consolidated.totalNetSales.toLocaleString("id-ID")}`,
    consolidated.trendLabel || "0% vs minggu lalu",
    `Rp ${consolidated.totalCashNetSales.toLocaleString("id-ID")}`,
    `Rp ${consolidated.totalCashDagoShare.toLocaleString("id-ID")}`,
    `Rp ${consolidated.totalQrisNetSales.toLocaleString("id-ID")}`,
    `Rp ${consolidated.totalQrisTenantShare.toLocaleString("id-ID")}`,
    `Rp ${consolidated.totalOtherNetSales.toLocaleString("id-ID")}`,
    `Rp ${consolidated.totalMdrFee.toLocaleString("id-ID")}`,
    `Rp ${consolidated.totalDagoRevenue.toLocaleString("id-ID")}`,
    totalNetTransferStr,
    `${consolidated.paidCount}/${payableTenantCount} Lunas`,
  ];

  const tableRows = [...tenantRows, totalRow];

  return {
    title: "Laporan konsolidasi semua mitra",
    subtitle: `Konsolidasi omzet per outlet, bagi hasil per metode bayar, dan total pendapatan DAGO di ${scopeName}`,
    summaryCards: [
      {
        label: "Omzet bersih konsolidasi",
        value: `Rp ${consolidated.totalNetSales.toLocaleString("id-ID")}`,
        sub: consolidated.trendLabel,
      },
      {
        label: "Transfer QRIS ke mitra",
        value: `Rp ${consolidated.totalQrisTenantShare.toLocaleString("id-ID")}`,
      },
      {
        label: "Setoran tunai mitra",
        value: `Rp ${consolidated.totalCashDagoShare.toLocaleString("id-ID")}`,
      },
      {
        label: "Total pendapatan DAGO",
        value: `Rp ${consolidated.totalDagoRevenue.toLocaleString("id-ID")}`,
      },
    ],
    tableHeaders: [
      "ID mitra",
      "Mitra & outlet",
      "Rekening bank",
      "Omzet bersih (Rp)",
      "Tren mingguan",
      "Tunai (Rp)",
      "Setor tunai ke DAGO (Rp)",
      "QRIS (Rp)",
      "Transfer QRIS ke mitra (Rp)",
      "Transfer / EDC (Rp)",
      "MDR QRIS (Rp)",
      "Pendapatan DAGO (Rp)",
      "Net transfer (Rp)",
      "Status",
    ],
    tableRows,
    reconciliationInfo: [
      { label: "Periode cut-off", value: period.periodLabel },
      { label: "Batas setor/transfer", value: period.paymentDueLabel },
      { label: "Total transaksi", value: `${consolidated.totalTransactions} pesanan` },
      {
        label: "Status pelunasan",
        value: `${consolidated.paidCount} lunas, ${consolidated.pendingCount} menunggu`,
      },
    ],
  };
}
