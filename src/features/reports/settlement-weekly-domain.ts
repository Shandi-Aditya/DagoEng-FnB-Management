/**
 * Domain Logika Murni: Skema Bagi Hasil Mingguan per Metode Bayar dan Settlement Mitra.
 *
 * Mengimplementasikan:
 * 1. Skema Bagi Hasil per Metode Bayar:
 *    - Tunai: Kas fisik dipegang kasir mitra -> Mitra wajib menyetor 15% (atau sesuai split) ke Dago.
 *    - QRIS: Uang digital masuk ke rekening Dago -> Dago mentransfer 85% ke mitra setelah MDR QRIS.
 *    - Basis: Penjualan bersih (setelah diskon, sebelum pajak / DPP). Refund mengurangi penjualan.
 * 2. Penanggung MDR QRIS (0.7%): "MITRA" | "DAGO" | "SPLIT" (dibagi proporsional).
 * 3. Periode Mingguan: Cut-off hari Minggu pukul 23:59:59 WITA, jatuh tempo setor/transfer Selasa.
 * 4. Netting Aliran Kas: Menghitung transfer bersih (Dago transfer ke mitra atau mitra setor ke Dago).
 * 5. Laporan #10 (Settlement Mingguan per Mitra) dan Laporan #11 (Konsolidasi Semua Mitra).
 * 6. Status Pelunasan: "PENDING" | "PAID" dengan pencatatan nama finance dan waktu bayar.
 */

import type { OrderRecord } from "@/types/order";
import {
  getOrderTaxBreakdown,
  allocateCategoryDiscounts,
  isCoworkingOrderItem,
  normalizeTenantId,
} from "@/lib/tax-breakdown";
import {
  getAllTenantRevenueSplits,
  getTenantPayoutAccount,
  getTenantRevenueSplit,
  resolveItemTenantId,
  type TenantRevenueSplitConfig,
} from "@/lib/settlement";
import { getTenantProfile } from "@/lib/tenant";
import { SEED_TENANT_PROFILES } from "@/lib/sync-domains/config-spec";

export type MdrBearerMode = "MITRA" | "DAGO" | "SPLIT";
export type SettlementPaymentStatus = "PENDING" | "PAID";

export const QRIS_DEFAULT_MDR_RATE = 0.007; // 0.7% sesuai standar BI
export const WEEKLY_SETTLEMENT_STATUS_KEY = "dagoeng_weekly_settlement_status_v1";

export interface WeeklySettlementPeriod {
  weekStartDate: string; // ISO
  weekCutoffDate: string; // ISO (Minggu 23:59:59)
  paymentDueDate: string; // ISO (Selasa 23:59:59)
  periodKey: string; // misal "2026-W49" atau "2026-11-30_2026-12-06"
  periodLabel: string; // "30 Nov - 06 Des 2026"
  paymentDueLabel: string; // "Selasa, 08 Des 2026"
}

export interface WeeklyTenantSettlement {
  tenantId: string;
  tenantName: string;
  outletName?: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  partnerType?: "EXTERNAL" | "INTERNAL";

  // Informasi periode
  periodKey: string;
  periodLabel: string;
  weekCutoffDate: string;
  paymentDueDate: string;
  paymentDueLabel: string;

  // Persentase bagi hasil
  tenantSharePercent: number; // e.g. 85
  dagoSharePercent: number; // e.g. 15

  // Transaksi Tunai (Cash)
  cashGrossSales: number;
  cashDiscount: number;
  cashNetSales: number;
  cashTenantShare: number; // hak mitra yang sudah dipegang mitra dalam kas fisik
  cashDagoShare: number; // bagian DAGO yang WAJIB DISETOR mitra ke Dago

  // Transaksi QRIS
  qrisGrossSales: number;
  qrisDiscount: number;
  qrisNetSales: number;
  qrisMdrRate: number;
  qrisMdrFee: number;
  mdrBearer: MdrBearerMode;
  mdrTenantPortion: number;
  mdrDagoPortion: number;
  qrisTenantShare: number; // hak mitra yang WAJIB DITRANSFER Dago ke mitra
  qrisDagoShare: number;

  // Transaksi Lainnya (Transfer / EDC jika ada)
  otherGrossSales: number;
  otherDiscount: number;
  otherNetSales: number;
  otherTenantShare: number;
  otherDagoShare: number;

  // Total Finansial
  totalGrossSales: number;
  totalDiscount: number;
  totalNetSales: number;
  tenantGrossShare: number; // Hak kotor mitra sebelum potongan MDR
  dagoGrossShare: number; // Hak kotor Dago sebelum beban MDR
  dagoTotalRevenue: number; // Total hak bagi hasil DAGO (Tunai + QRIS + Lainnya)
  tenantTotalEarnings: number; // Total hak bagi hasil Mitra
  transactionCount: number;

  // Netting Aliran Kas Akhir
  // Dago berhak atas cashDagoShare dari uang tunai di mitra
  // Mitra berhak atas qrisTenantShare dari uang QRIS di Dago
  // netTransferAmount = qrisTenantShare - cashDagoShare
  netTransferAmount: number;
  actionDirection: "DAGO_TO_MITRA" | "MITRA_TO_DAGO" | "SETTLED";
  actionLabel: string;

  // Status Pelunasan
  status: SettlementPaymentStatus;
  paidAt?: string;
  paidBy?: string;
  notes?: string;
}

export interface ConsolidatedSettlementSummary {
  period: WeeklySettlementPeriod;
  tenants: WeeklyTenantSettlement[];

  // Total Baris Konsolidasi
  totalGrossSales: number;
  totalDiscount: number;
  totalNetSales: number;
  totalCashNetSales: number;
  totalCashDagoShare: number;
  totalQrisNetSales: number;
  totalQrisTenantShare: number;
  totalMdrFee: number;
  totalDagoRevenue: number;
  totalNetTransferDagoToMitra: number;
  totalNetSetoranMitraToDago: number;
  totalTransactions: number;

  pendingCount: number;
  paidCount: number;
}

export interface SettlementStatusRecord {
  status: SettlementPaymentStatus;
  paidAt?: string;
  paidBy?: string;
  notes?: string;
  updatedAt: string;
}

/**
 * Menghitung periode mingguan dengan cut-off Minggu 23:59:59 WITA dan jatuh tempo Selasa 23:59:59 WITA.
 */
export function getWeeklySettlementPeriod(referenceDate?: Date | string): WeeklySettlementPeriod {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const d = isNaN(ref.getTime()) ? new Date() : ref;

  // Menentukan hari dalam minggu (0 = Minggu, 1 = Senin, ..., 6 = Sabtu)
  const day = d.getDay();
  // Jarak mundur ke hari Senin minggu berjalan (jika hari ini Minggu, mundur 6 hari)
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // Jatuh tempo adalah hari Selasa minggu berikutnya (H+2 setelah Minggu)
  const tuesday = new Date(sunday);
  tuesday.setDate(sunday.getDate() + 2);
  tuesday.setHours(23, 59, 59, 999);

  const formatShort = (dt: Date) =>
    dt.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Makassar",
    });

  const periodLabel = `${formatShort(monday)} - ${formatShort(sunday)}`;
  const paymentDueLabel = tuesday.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Makassar",
  });

  const periodKey = `${monday.toISOString().slice(0, 10)}_${sunday.toISOString().slice(0, 10)}`;

  return {
    weekStartDate: monday.toISOString(),
    weekCutoffDate: sunday.toISOString(),
    paymentDueDate: tuesday.toISOString(),
    periodKey,
    periodLabel,
    paymentDueLabel,
  };
}

export const memorySettlementStatusStore: Record<string, SettlementStatusRecord> = {};

/**
 * Membaca status pelunasan settlement dari local storage / in-memory cache.
 */
export function getSettlementPaymentStatus(
  periodKey: string,
  tenantId: string
): SettlementStatusRecord {
  const key = `${periodKey}_${tenantId}`;
  if (typeof window === "undefined") {
    return memorySettlementStatusStore[key] || { status: "PENDING", updatedAt: new Date().toISOString() };
  }
  try {
    const raw = window.localStorage.getItem(WEEKLY_SETTLEMENT_STATUS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed[key]) {
        return parsed[key];
      }
    }
  } catch (e) {
    console.error("Gagal membaca settlement payment status", e);
  }
  return memorySettlementStatusStore[key] || { status: "PENDING", updatedAt: new Date().toISOString() };
}

/**
 * Menyimpan status pelunasan settlement (Tandai Lunas oleh Finance).
 */
export function setSettlementPaymentStatus(
  periodKey: string,
  tenantId: string,
  status: SettlementPaymentStatus,
  paidBy?: string,
  notes?: string
): SettlementStatusRecord {
  const record: SettlementStatusRecord = {
    status,
    paidAt: status === "PAID" ? new Date().toISOString() : undefined,
    paidBy: status === "PAID" ? paidBy || "Finance" : undefined,
    notes,
    updatedAt: new Date().toISOString(),
  };

  const key = `${periodKey}_${tenantId}`;
  memorySettlementStatusStore[key] = record;

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(WEEKLY_SETTLEMENT_STATUS_KEY);
      const store = raw ? JSON.parse(raw) : {};
      store[key] = record;
      window.localStorage.setItem(WEEKLY_SETTLEMENT_STATUS_KEY, JSON.stringify(store));
    } catch (e) {
      console.error("Gagal menyimpan settlement payment status", e);
    }
  }

  return record;
}

export interface CalculateWeeklySettlementOptions {
  referenceDate?: Date | string;
  mdrBearer?: MdrBearerMode;
  includeInternal?: boolean;
  customSplits?: Record<string, { tenantSharePercent: number; dagoSharePercent: number }>;
}

/**
 * Menghitung Laporan #10: Settlement Mingguan untuk satu Mitra spesifik.
 */
export function calculateWeeklyTenantSettlement(
  orders: OrderRecord[],
  tenantId: string,
  options?: CalculateWeeklySettlementOptions
): WeeklyTenantSettlement {
  const normTenantId = normalizeTenantId(tenantId) ?? tenantId;
  const period = getWeeklySettlementPeriod(options?.referenceDate);
  const mdrBearer: MdrBearerMode = options?.mdrBearer ?? "MITRA";

  // Profil dan rekening mitra
  let tenantName = normTenantId;
  let partnerType: "EXTERNAL" | "INTERNAL" = "EXTERNAL";
  let bankName = "BCA";
  let accountNumber = "-";
  let accountHolder = "-";

  try {
    const profile = getTenantProfile(normTenantId);
    if (profile) {
      tenantName = profile.brandName || normTenantId;
      partnerType = profile.partnerType || "EXTERNAL";
      if (profile.bankName) bankName = profile.bankName;
      if (profile.bankAccountNumber) accountNumber = profile.bankAccountNumber;
      if (profile.bankAccountHolder) accountHolder = profile.bankAccountHolder;
    }
  } catch {}

  if (accountNumber === "-" || accountNumber === "") {
    const payout = getTenantPayoutAccount(normTenantId);
    bankName = payout.bankName;
    accountNumber = payout.accountNumber;
    accountHolder = payout.accountHolder;
  }

  // Persentase bagi hasil
  const splitConfig = options?.customSplits?.[normTenantId] || getTenantRevenueSplit(normTenantId);
  const tenantSharePct = normTenantId === "DAGO_HUB" ? 0 : splitConfig.tenantSharePercent ?? 85;
  const dagoSharePct = normTenantId === "DAGO_HUB" ? 100 : splitConfig.dagoSharePercent ?? 15;

  let cashGross = 0;
  let cashDiscount = 0;
  let qrisGross = 0;
  let qrisDiscount = 0;
  let otherGross = 0;
  let otherDiscount = 0;
  let transactionCount = 0;

  // Filter order yang aktif, lunas, dan bukan dibatalkan/refund
  const validOrders = orders.filter(
    (o) =>
      o.paymentStatus === "PAID" &&
      o.status !== "CANCELLED" &&
      !o.refundedAt &&
      o.syncStatus !== "REJECTED"
  );

  validOrders.forEach((order) => {
    let orderHasTenantItem = false;
    let orderTenantGross = 0;
    const fallbackTenantId = typeof order.tenantId === "string" ? order.tenantId : undefined;

    const itemBuckets = order.items.map((item) => {
      const qty = typeof item.quantity === "number" ? item.quantity : Number(item.quantity) || 1;
      const price =
        typeof item.unitPrice === "number" ? item.unitPrice : Number(item.unitPrice) || 0;
      const itemGross = Math.max(0, qty * price);
      const ownerId = normalizeTenantId(resolveItemTenantId(item, fallbackTenantId)) ?? resolveItemTenantId(item, fallbackTenantId);
      const isMatch = ownerId === normTenantId;
      if (isMatch) {
        orderHasTenantItem = true;
        orderTenantGross += itemGross;
      }
      return {
        isCoworking: isCoworkingOrderItem(item),
        subtotal: itemGross,
        isMatch,
      };
    });

    if (orderHasTenantItem && orderTenantGross > 0) {
      transactionCount++;
      const breakdown = getOrderTaxBreakdown(order);
      const explicitDiscountSplit =
        order.fnbDiscount !== undefined || order.coworkingDiscount !== undefined
          ? { fnbDiscount: order.fnbDiscount, coworkingDiscount: order.coworkingDiscount }
          : undefined;

      const itemDiscounts = allocateCategoryDiscounts(
        itemBuckets,
        breakdown.discount,
        explicitDiscountSplit
      );

      const allocatedDiscount = itemBuckets.reduce(
        (sum, bucket, idx) => sum + (bucket.isMatch ? itemDiscounts[idx] ?? 0 : 0),
        0
      );

      const method = (order.paymentMethod || "CASH").toUpperCase();
      if (method === "CASH") {
        cashGross += orderTenantGross;
        cashDiscount += allocatedDiscount;
      } else if (method === "QRIS") {
        qrisGross += orderTenantGross;
        qrisDiscount += allocatedDiscount;
      } else {
        otherGross += orderTenantGross;
        otherDiscount += allocatedDiscount;
      }
    }
  });

  // Hitung basis penjualan bersih (DPP setelah diskon, sebelum pajak)
  const cashNetSales = Math.max(0, Math.round(cashGross - cashDiscount));
  const qrisNetSales = Math.max(0, Math.round(qrisGross - qrisDiscount));
  const otherNetSales = Math.max(0, Math.round(otherGross - otherDiscount));
  const totalNetSales = cashNetSales + qrisNetSales + otherNetSales;

  // 1. Tunai (Cash): Mitra pegang uang tunai -> Mitra setor dagoSharePercent ke Dago
  const cashTenantShare = Math.round(cashNetSales * (tenantSharePct / 100));
  const cashDagoShare = cashNetSales - cashTenantShare;

  // 2. QRIS: Uang ada di Dago -> Dago transfer tenantSharePercent ke Mitra setelah MDR
  const qrisMdrFee = Math.round(qrisNetSales * QRIS_DEFAULT_MDR_RATE);
  let mdrTenantPortion = 0;
  let mdrDagoPortion = 0;

  if (mdrBearer === "MITRA") {
    mdrTenantPortion = qrisMdrFee;
    mdrDagoPortion = 0;
  } else if (mdrBearer === "DAGO") {
    mdrTenantPortion = 0;
    mdrDagoPortion = qrisMdrFee;
  } else {
    // SPLIT: Dibagi proporsional sesuai rasio bagi hasil
    mdrTenantPortion = Math.round(qrisMdrFee * (tenantSharePct / 100));
    mdrDagoPortion = qrisMdrFee - mdrTenantPortion;
  }

  const rawQrisTenantShare = Math.round(qrisNetSales * (tenantSharePct / 100));
  const qrisTenantShare = Math.max(0, rawQrisTenantShare - mdrTenantPortion);
  const qrisDagoShare = Math.max(0, qrisNetSales - rawQrisTenantShare - mdrDagoPortion);

  // 3. Lainnya (Transfer/EDC): Uang masuk ke Dago
  const otherTenantShare = Math.round(otherNetSales * (tenantSharePct / 100));
  const otherDagoShare = otherNetSales - otherTenantShare;

  // Total Pendapatan Dago dari Bagi Hasil
  const tenantGrossShare = Math.round(totalNetSales * (tenantSharePct / 100));
  const dagoGrossShare = totalNetSales - tenantGrossShare;
  const dagoTotalRevenue = cashDagoShare + qrisDagoShare + otherDagoShare;
  const tenantTotalEarnings = cashTenantShare + qrisTenantShare + otherTenantShare;

  // 4. Netting Aliran Kas Akhir:
  // Hak Mitra yang dipegang Dago = qrisTenantShare + otherTenantShare
  // Hak Dago yang dipegang Mitra (dari kas fisik tunai) = cashDagoShare
  // netTransferAmount = (Hak Mitra di Dago) - (Hak Dago di Mitra)
  const netTransferAmount = qrisTenantShare + otherTenantShare - cashDagoShare;

  let actionDirection: "DAGO_TO_MITRA" | "MITRA_TO_DAGO" | "SETTLED" = "SETTLED";
  let actionLabel = "Impas / Selesai";

  if (netTransferAmount > 0) {
    actionDirection = "DAGO_TO_MITRA";
    actionLabel = `Dago transfer ke mitra (Rp ${netTransferAmount.toLocaleString("id-ID")})`;
  } else if (netTransferAmount < 0) {
    actionDirection = "MITRA_TO_DAGO";
    actionLabel = `Mitra setor ke Dago (Rp ${Math.abs(netTransferAmount).toLocaleString("id-ID")})`;
  }

  const statusRecord = getSettlementPaymentStatus(period.periodKey, normTenantId);

  return {
    tenantId: normTenantId,
    tenantName,
    partnerType,
    bankName,
    accountNumber,
    accountHolder,
    periodKey: period.periodKey,
    periodLabel: period.periodLabel,
    weekCutoffDate: period.weekCutoffDate,
    paymentDueDate: period.paymentDueDate,
    paymentDueLabel: period.paymentDueLabel,
    tenantSharePercent: tenantSharePct,
    dagoSharePercent: dagoSharePct,
    cashGrossSales: Math.round(cashGross),
    cashDiscount: Math.round(cashDiscount),
    cashNetSales,
    cashTenantShare,
    cashDagoShare,
    qrisGrossSales: Math.round(qrisGross),
    qrisDiscount: Math.round(qrisDiscount),
    qrisNetSales,
    qrisMdrRate: QRIS_DEFAULT_MDR_RATE,
    qrisMdrFee,
    mdrBearer,
    mdrTenantPortion,
    mdrDagoPortion,
    qrisTenantShare,
    qrisDagoShare,
    otherGrossSales: Math.round(otherGross),
    otherDiscount: Math.round(otherDiscount),
    otherNetSales,
    otherTenantShare,
    otherDagoShare,
    totalGrossSales: Math.round(cashGross + qrisGross + otherGross),
    totalDiscount: Math.round(cashDiscount + qrisDiscount + otherDiscount),
    totalNetSales,
    tenantGrossShare,
    dagoGrossShare,
    dagoTotalRevenue,
    tenantTotalEarnings,
    transactionCount,
    netTransferAmount,
    actionDirection,
    actionLabel,
    status: statusRecord.status,
    paidAt: statusRecord.paidAt,
    paidBy: statusRecord.paidBy,
    notes: statusRecord.notes,
  };
}

/**
 * Menghitung Laporan #11: Konsolidasi Semua Mitra beserta Baris Total Konsolidasi.
 */
export function calculateConsolidatedWeeklySettlement(
  orders: OrderRecord[],
  options?: CalculateWeeklySettlementOptions
): ConsolidatedSettlementSummary {
  const period = getWeeklySettlementPeriod(options?.referenceDate);

  // Kumpulkan semua tenantId yang ada dari seed atau dari orders
  const knownTenantIds = new Set<string>();
  Object.keys(SEED_TENANT_PROFILES).forEach((id) => knownTenantIds.add(id));

  orders.forEach((o) => {
    if (o.items) {
      o.items.forEach((it) => {
        const id = resolveItemTenantId(it, typeof o.tenantId === "string" ? o.tenantId : undefined);
        if (id && id !== "DAGO_HUB") knownTenantIds.add(id);
      });
    }
  });

  const tenantSettlements: WeeklyTenantSettlement[] = [];

  Array.from(knownTenantIds).sort().forEach((tid) => {
    // Lewati mitra internal jika tidak diikutsertakan
    if (!options?.includeInternal) {
      try {
        const prof = getTenantProfile(tid);
        if (prof?.partnerType === "INTERNAL") return;
      } catch {}
    }

    const item = calculateWeeklyTenantSettlement(orders, tid, options);
    tenantSettlements.push(item);
  });

  // Urutkan mitra berdasarkan omzet bersih terbesar
  tenantSettlements.sort((a, b) => b.totalNetSales - a.totalNetSales);

  // Agregasi Baris Total Konsolidasi
  let totalGross = 0;
  let totalDiscount = 0;
  let totalNet = 0;
  let totalCashNet = 0;
  let totalCashDago = 0;
  let totalQrisNet = 0;
  let totalQrisTenant = 0;
  let totalMdr = 0;
  let totalDagoRev = 0;
  let totalNetTransferToMitra = 0;
  let totalNetSetoranToDago = 0;
  let totalTrx = 0;
  let pendingCount = 0;
  let paidCount = 0;

  tenantSettlements.forEach((s) => {
    totalGross += s.totalGrossSales;
    totalDiscount += s.totalDiscount;
    totalNet += s.totalNetSales;
    totalCashNet += s.cashNetSales;
    totalCashDago += s.cashDagoShare;
    totalQrisNet += s.qrisNetSales;
    totalQrisTenant += s.qrisTenantShare;
    totalMdr += s.qrisMdrFee;
    totalDagoRev += s.dagoTotalRevenue;
    totalTrx += s.transactionCount;

    if (s.netTransferAmount > 0) {
      totalNetTransferToMitra += s.netTransferAmount;
    } else if (s.netTransferAmount < 0) {
      totalNetSetoranToDago += Math.abs(s.netTransferAmount);
    }

    if (s.status === "PAID") paidCount++;
    else pendingCount++;
  });

  return {
    period,
    tenants: tenantSettlements,
    totalGrossSales: totalGross,
    totalDiscount: totalDiscount,
    totalNetSales: totalNet,
    totalCashNetSales: totalCashNet,
    totalCashDagoShare: totalCashDago,
    totalQrisNetSales: totalQrisNet,
    totalQrisTenantShare: totalQrisTenant,
    totalMdrFee: totalMdr,
    totalDagoRevenue: totalDagoRev,
    totalNetTransferDagoToMitra: totalNetTransferToMitra,
    totalNetSetoranMitraToDago: totalNetSetoranToDago,
    totalTransactions: totalTrx,
    pendingCount,
    paidCount,
  };
}
