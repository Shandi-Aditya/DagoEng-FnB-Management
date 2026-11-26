/**
 * Domain Logika Murni: Skema Bagi Hasil Mingguan per Metode Bayar dan Settlement Mitra.
 *
 * Mengimplementasikan:
 * 1. Skema Bagi Hasil per Metode Bayar:
 *    - Tunai: Kas fisik dipegang kasir mitra -> Mitra wajib menyetor 15% (atau sesuai split) ke Dago.
 *    - QRIS: Uang digital masuk ke rekening Dago -> Dago mentransfer 85% ke mitra setelah MDR QRIS.
 *    - Basis: Penjualan bersih (setelah diskon, sebelum pajak / DPP). Refund mengurangi penjualan.
 * 2. Penanggung MDR QRIS (0.7%): "MITRA" | "DAGO" | "SPLIT" (dibagi proporsional).
 * 3. Periode Mingguan: Cut-off hari Minggu pukul 23:59:59 WITA, jatuh tempo Selasa.
 * 4. Netting Aliran Kas: Menghitung transfer bersih (Dago transfer ke mitra atau mitra setor ke Dago).
 * 5. Pembangun dataset Laporan #10 (Settlement Mingguan per Mitra) dan #11 (Konsolidasi Mitra).
 * 6. Status Pelunasan: "PENDING" | "PAID" dengan persistensi server & catatan waktu bayar.
 */

import type { OrderRecord } from "@/types/order";
import {
  getOrderTaxBreakdown,
  allocateCategoryDiscounts,
  allocateIntegerProRata,
  isCoworkingOrderItem,
  normalizeTenantId,
} from "@/lib/tax-breakdown";
import {
  getTenantPayoutAccount,
  getTenantRevenueSplit,
  resolveItemTenantId,
} from "@/lib/settlement";
import { getTenantProfile } from "@/lib/tenant";
import { SEED_TENANT_PROFILES, tenantsSyncClient } from "@/lib/sync-domains/config-spec";
import { DEMO_OUTLETS, type OutletItem } from "@/lib/receipt-publisher";

export type MdrBearerMode = "MITRA" | "DAGO" | "SPLIT";
export type SettlementPaymentStatus = "PENDING" | "PAID";
export type SettlementActionDirection = "DAGO_TO_MITRA" | "MITRA_TO_DAGO" | "SETTLED";

export const QRIS_DEFAULT_MDR_RATE = 0.007; // 0.7% sesuai standar BI
export const WEEKLY_SETTLEMENT_STATUS_KEY = "dagoeng_weekly_settlement_status_v1";
export const WEEKLY_SETTLEMENTS_STORAGE_FILE = "weekly_settlements.json";

const WITA_TIMEZONE = "Asia/Makassar";
const WITA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface WeeklySettlementPeriod {
  weekStartDate: string; // ISO (Senin 00:00:00.000+08:00)
  weekCutoffDate: string; // ISO (Minggu 23:59:59.999+08:00)
  paymentDueDate: string; // ISO (Selasa 23:59:59.999+08:00)
  periodKey: string; // misal "2026-11-30_2026-12-06"
  periodLabel: string; // "30 Nov 2026 - 06 Des 2026"
  paymentDueLabel: string; // "Selasa, 08 Des 2026"
}

export interface WeeklyTenantSettlement {
  tenantId: string;
  tenantName: string;
  outletId?: string;
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

  // Transaksi Lainnya (Transfer / EDC)
  otherGrossSales: number;
  otherDiscount: number;
  otherNetSales: number;
  otherTenantShare: number;
  otherDagoShare: number;

  // Pengurang refund lintas minggu
  refundDeduction?: number;

  // Total Finansial
  totalGrossSales: number;
  totalDiscount: number;
  totalNetSales: number;
  tenantGrossShare: number; // Hak kotor mitra sebelum potongan MDR
  dagoGrossShare: number; // Hak kotor Dago sebelum beban MDR
  dagoTotalRevenue: number; // Total hak bagi hasil DAGO pasca-MDR (Tunai + QRIS + Lainnya)
  tenantTotalEarnings: number; // Total hak bagi hasil Mitra pasca-MDR
  transactionCount: number;

  // Perbandingan minggu sebelumnya
  previousNetSales?: number;
  previousDagoRevenue?: number;
  previousTenantNetSales?: number;
  previousTenantDagoRevenue?: number;
  trendLabel?: string;

  // Netting Aliran Kas Akhir
  netTransferAmount: number;
  actionDirection: SettlementActionDirection;
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
  totalOtherNetSales: number;
  totalMdrFee: number;
  totalDagoRevenue: number;
  totalTenantEarnings: number;
  totalNetTransferDagoToMitra: number;
  totalNetSetoranMitraToDago: number;
  totalTransactions: number;

  previousTotalNetSales?: number;
  previousTotalDagoRevenue?: number;
  previousTenantTotals?: Record<
    string,
    {
      previousNetSales: number;
      previousDagoRevenue: number;
      currentNetSales: number;
      currentDagoRevenue: number;
      trendLabel: string;
    }
  >;
  trendLabel?: string;

  pendingCount: number;
  paidCount: number;
}

export interface SettlementStatusRecord {
  status: SettlementPaymentStatus;
  paidAt?: string;
  paidBy?: string;
  notes?: string;
  updatedAt: string;
  periodKey?: string;
  tenantId?: string;
  direction?: SettlementActionDirection;
}

function getWitaYmdParts(referenceDate?: Date | string): [number, number, number] {
  let target: Date;
  if (typeof referenceDate === "string") {
    const trimmed = referenceDate.trim();
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnly) return [Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3])];
    target = new Date(trimmed);
  } else {
    target = referenceDate instanceof Date ? referenceDate : new Date();
  }
  const safeDate = Number.isNaN(target.getTime()) ? new Date() : target;
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: WITA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(safeDate)
    .split("-")
    .map(Number);
  return [y, m, d];
}

/**
 * Menggeser tanggal acuan sebesar N minggu berdasarkan kalender WITA secara deterministik.
 */
export function shiftWeeklyPeriodDate(
  referenceDate: Date | string | undefined,
  deltaWeeks: number
): string {
  const [y, m, d] = getWitaYmdParts(referenceDate);
  const shiftedMs = Date.UTC(y, m - 1, d + deltaWeeks * 7);
  return new Date(shiftedMs).toISOString().slice(0, 10);
}

/**
 * Menghitung periode mingguan dengan cut-off Minggu 23:59:59.999 WITA dan jatuh tempo Selasa 23:59:59.999 WITA.
 * Seluruh aritmetika hari dilakukan pada stempel UTC murni agar kebal terhadap zona waktu OS (mis. TZ=UTC).
 */
export function getWeeklySettlementPeriod(referenceDate?: Date | string): WeeklySettlementPeriod {
  const [year, month, day] = getWitaYmdParts(referenceDate);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayUtcMs = Date.UTC(year, month - 1, day + diffToMonday);
  const sundayUtcMs = Date.UTC(year, month - 1, day + diffToMonday + 6);
  const tuesdayUtcMs = Date.UTC(year, month - 1, day + diffToMonday + 8);
  const mondayYmd = new Date(mondayUtcMs).toISOString().slice(0, 10);
  const sundayYmd = new Date(sundayUtcMs).toISOString().slice(0, 10);

  const formatShort = (utcMidnightMs: number) =>
    new Date(utcMidnightMs + 12 * 60 * 60 * 1000).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: WITA_TIMEZONE,
    });

  return {
    weekStartDate: new Date(mondayUtcMs - WITA_OFFSET_MS).toISOString(),
    weekCutoffDate: new Date(sundayUtcMs + DAY_MS - 1 - WITA_OFFSET_MS).toISOString(),
    paymentDueDate: new Date(tuesdayUtcMs + DAY_MS - 1 - WITA_OFFSET_MS).toISOString(),
    periodKey: `${mondayYmd}_${sundayYmd}`,
    periodLabel: `${formatShort(mondayUtcMs)} - ${formatShort(sundayUtcMs)}`,
    paymentDueLabel: new Date(tuesdayUtcMs + 12 * 60 * 60 * 1000).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: WITA_TIMEZONE,
    }),
  };
}

export const memorySettlementStatusStore: Record<string, SettlementStatusRecord> = {};

function makeStatusKey(periodKey: string, tenantId: string): string {
  return `${periodKey}_${normalizeTenantId(tenantId) ?? tenantId.trim()}`;
}

function readLocalSettlementStore(): Record<string, SettlementStatusRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(WEEKLY_SETTLEMENT_STATUS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, SettlementStatusRecord>) : {};
  } catch (e) {
    console.error("Gagal membaca settlement status dari localStorage", e);
    return {};
  }
}

function writeLocalSettlementStore(store: Record<string, SettlementStatusRecord>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WEEKLY_SETTLEMENT_STATUS_KEY, JSON.stringify(store));
  } catch (e) {
    console.error("Gagal menyimpan settlement status ke localStorage", e);
  }
}

function mergeSettlementStatusEntries(
  target: Record<string, SettlementStatusRecord>,
  records: Record<string, SettlementStatusRecord>,
  periodKey?: string
): void {
  if (periodKey) {
    const prefix = `${periodKey}_`;
    for (const key of Object.keys(target)) {
      if (key.startsWith(prefix)) delete target[key];
    }
  }
  for (const [key, value] of Object.entries(records || {})) {
    target[key] = { ...value };
  }
}

export function hydrateSettlementStatusStore(
  records: Record<string, SettlementStatusRecord>,
  periodKey?: string
): void {
  mergeSettlementStatusEntries(memorySettlementStatusStore, records, periodKey);
  if (typeof window !== "undefined") {
    const parsed = readLocalSettlementStore();
    mergeSettlementStatusEntries(parsed, records, periodKey);
    writeLocalSettlementStore(parsed);
  }
}

export async function fetchWeeklySettlementStatuses(
  periodKey?: string
): Promise<Record<string, SettlementStatusRecord>> {
  const query = periodKey ? `?periodKey=${encodeURIComponent(periodKey)}` : "";
  const res = await fetch(`/api/reports/settlement${query}`, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; records?: Record<string, SettlementStatusRecord>; error?: string }
    | null;
  if (!res.ok || !json?.success || !json.records) {
    throw new Error(json?.error || "Gagal memuat status settlement mingguan.");
  }
  hydrateSettlementStatusStore(json.records, periodKey);
  return json.records;
}

export async function persistWeeklySettlementStatus(params: {
  periodKey: string;
  tenantId: string;
  status: SettlementPaymentStatus;
  direction?: SettlementActionDirection;
  notes?: string;
}): Promise<{ success: boolean; key?: string; record?: SettlementStatusRecord; error?: string }> {
  try {
    const res = await fetch("/api/reports/settlement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const json = (await res.json().catch(() => null)) as
      | { success?: boolean; key?: string; record?: SettlementStatusRecord; error?: string }
      | null;
    if (!res.ok || !json?.success || !json.record || !json.key) {
      return { success: false, error: json?.error || "Gagal menyimpan status settlement ke server." };
    }
    hydrateSettlementStatusStore({ [json.key]: json.record });
    return { success: true, key: json.key, record: json.record };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menghubungi server settlement.",
    };
  }
}

export function getSettlementPaymentStatus(
  periodKey: string,
  tenantId: string
): SettlementStatusRecord {
  const key = makeStatusKey(periodKey, tenantId);
  const rawKey = `${periodKey}_${tenantId}`;
  if (memorySettlementStatusStore[key]) return memorySettlementStatusStore[key];
  if (rawKey !== key && memorySettlementStatusStore[rawKey]) return memorySettlementStatusStore[rawKey];

  const parsed = readLocalSettlementStore();
  if (parsed[key]) return parsed[key];
  if (rawKey !== key && parsed[rawKey]) return parsed[rawKey];
  return { status: "PENDING", updatedAt: new Date().toISOString() };
}

export function setSettlementPaymentStatus(
  periodKey: string,
  tenantId: string,
  status: SettlementPaymentStatus,
  paidBy?: string,
  notes?: string
): SettlementStatusRecord {
  const normTenantId = normalizeTenantId(tenantId) ?? tenantId.trim();
  const record: SettlementStatusRecord = {
    status,
    paidAt: status === "PAID" ? new Date().toISOString() : undefined,
    paidBy: status === "PAID" ? paidBy || "Finance" : undefined,
    notes,
    updatedAt: new Date().toISOString(),
    periodKey,
    tenantId: normTenantId,
  };
  const key = makeStatusKey(periodKey, normTenantId);
  memorySettlementStatusStore[key] = record;
  const store = readLocalSettlementStore();
  store[key] = record;
  writeLocalSettlementStore(store);
  return record;
}

export interface CalculateWeeklySettlementOptions {
  referenceDate?: Date | string;
  mdrBearer?: MdrBearerMode;
  includeInternal?: boolean;
  customSplits?: Record<string, { tenantSharePercent: number; dagoSharePercent: number }>;
  outletId?: string;
  outletName?: string;
  outlets?: readonly OutletItem[];
  skipPreviousWeek?: boolean;
}

interface TenantOrderAllocation {
  hasTenantItem: boolean;
  orderTenantGross: number;
  allocatedDiscount: number;
}

function resolveTenantOrderAllocation(
  order: OrderRecord,
  normTenantId: string
): TenantOrderAllocation {
  let hasTenantItem = false;
  let orderTenantGross = 0;
  const fallbackTenantId = typeof order.tenantId === "string" ? order.tenantId : undefined;

  const itemBuckets = (order.items || []).map((item) => {
    const qty = typeof item.quantity === "number" ? item.quantity : Number(item.quantity) || 1;
    const price =
      typeof item.unitPrice === "number" ? item.unitPrice : Number(item.unitPrice) || 0;
    const itemGross = Math.max(0, qty * price);
    const resolvedOwner = resolveItemTenantId(item, fallbackTenantId);
    const ownerId = normalizeTenantId(resolvedOwner) ?? resolvedOwner;
    const isMatch = ownerId === normTenantId;
    if (isMatch) {
      hasTenantItem = true;
      orderTenantGross += itemGross;
    }
    return {
      isCoworking: isCoworkingOrderItem(item),
      subtotal: itemGross,
      isMatch,
    };
  });

  if (!hasTenantItem || orderTenantGross <= 0) {
    return { hasTenantItem: false, orderTenantGross: 0, allocatedDiscount: 0 };
  }

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

  return { hasTenantItem: true, orderTenantGross, allocatedDiscount };
}

function resolveSplitBucketWeights(order: OrderRecord): {
  cashWeight: number;
  qrisWeight: number;
  otherWeight: number;
  totalWeight: number;
} {
  let cashWeight = 0;
  let qrisWeight = 0;
  let otherWeight = 0;
  for (const part of order.splitDetails || []) {
    const amt = Math.max(0, Number(part.amount) || 0);
    if (amt <= 0) continue;
    const m = (part.method || "").toUpperCase();
    if (m === "CASH") cashWeight += amt;
    else if (m === "QRIS") qrisWeight += amt;
    else otherWeight += amt;
  }
  return {
    cashWeight,
    qrisWeight,
    otherWeight,
    totalWeight: cashWeight + qrisWeight + otherWeight,
  };
}

function distributeChannelAmount(
  amount: number,
  channel: string,
  splitDetails?: OrderRecord["splitDetails"]
): [number, number, number] {
  const upper = channel.toUpperCase();
  if (upper === "SPLIT" && Array.isArray(splitDetails) && splitDetails.length > 0) {
    const weights = resolveSplitBucketWeights({ splitDetails } as OrderRecord);
    if (weights.totalWeight > 0) {
      const [c, q, o] = allocateIntegerProRata(Math.round(amount), [
        weights.cashWeight,
        weights.qrisWeight,
        weights.otherWeight,
      ]);
      return [c ?? 0, q ?? 0, o ?? 0];
    }
    return [0, 0, amount];
  }
  if (upper === "CASH") return [amount, 0, 0];
  if (upper === "QRIS") return [0, amount, 0];
  return [0, 0, amount];
}

function formatTrendLabel(current: number, previous: number): string {
  if (current === 0 && previous === 0) return "0% vs minggu lalu";
  if (previous <= 0 && current > 0) return "Baru";
  const pct = Math.round(((current - previous) / previous) * 100);
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs minggu lalu`;
}

function resolveTenantMeta(normTenantId: string): {
  tenantName: string;
  partnerType: "EXTERNAL" | "INTERNAL";
  bankName: string;
  accountNumber: string;
  accountHolder: string;
} {
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
  const isInternal = partnerType === "INTERNAL" || normTenantId === "DAGO_HUB";
  return {
    tenantName,
    partnerType: isInternal ? "INTERNAL" : partnerType,
    bankName,
    accountNumber,
    accountHolder,
  };
}

/**
 * Menghitung Laporan #10: Settlement Mingguan untuk satu Mitra spesifik (atau per outlet).
 */
export function calculateWeeklyTenantSettlement(
  orders: OrderRecord[],
  tenantId: string,
  options?: CalculateWeeklySettlementOptions
): WeeklyTenantSettlement {
  const normTenantId = normalizeTenantId(tenantId) ?? tenantId;
  const period = getWeeklySettlementPeriod(options?.referenceDate);
  const weekStartMs = new Date(period.weekStartDate).getTime();
  const weekCutoffMs = new Date(period.weekCutoffDate).getTime();
  const mdrBearer: MdrBearerMode = options?.mdrBearer ?? "MITRA";
  const meta = resolveTenantMeta(normTenantId);
  const isInternalPartner = meta.partnerType === "INTERNAL";
  const splitConfig = options?.customSplits?.[normTenantId] || getTenantRevenueSplit(normTenantId);
  const tenantSharePct = isInternalPartner ? 0 : splitConfig.tenantSharePercent ?? 85;
  const dagoSharePct = isInternalPartner ? 100 : splitConfig.dagoSharePercent ?? 15;

  let cashGross = 0, cashDiscount = 0, qrisGross = 0, qrisDiscount = 0;
  let otherGross = 0, otherDiscount = 0, cashRefund = 0, qrisRefund = 0, otherRefund = 0;
  let transactionCount = 0;

  for (const order of orders) {
    if (order.syncStatus === "REJECTED") continue;

    const createdMs = new Date(order.createdAt).getTime();
    if (!Number.isFinite(createdMs)) continue;

    const refundedMs = order.refundedAt ? new Date(order.refundedAt).getTime() : NaN;
    const hasValidRefundTimestamp = Boolean(order.refundedAt) && Number.isFinite(refundedMs);

    // 1. Order aktif dalam minggu berjalan:
    //    - Dibuat di dalam [weekStartMs, weekCutoffMs]
    //    - Lunas & tidak dibatalkan, atau baru di-refund pada minggu berikutnya
    const isPaidDuringThisWeek =
      (order.paymentStatus === "PAID" && order.status !== "CANCELLED") ||
      (order.paymentStatus === "REFUNDED" && hasValidRefundTimestamp && refundedMs > weekCutoffMs);
    const isActiveInWeek =
      isPaidDuringThisWeek &&
      createdMs >= weekStartMs &&
      createdMs <= weekCutoffMs &&
      (!hasValidRefundTimestamp || refundedMs > weekCutoffMs);

    if (isActiveInWeek) {
      const alloc = resolveTenantOrderAllocation(order, normTenantId);
      if (alloc.hasTenantItem && alloc.orderTenantGross > 0) {
        transactionCount++;
        const method = order.paymentMethod || "CASH";
        const [cG, qG, oG] = distributeChannelAmount(
          alloc.orderTenantGross,
          method,
          order.splitDetails
        );
        const [cD, qD, oD] = distributeChannelAmount(
          alloc.allocatedDiscount,
          method,
          order.splitDetails
        );
        cashGross += cG;
        cashDiscount += cD;
        qrisGross += qG;
        qrisDiscount += qD;
        otherGross += oG;
        otherDiscount += oD;
      }
      continue;
    }

    // 2. Refund lintas minggu:
    //    - Order dibuat sebelum minggu berjalan (createdMs < weekStartMs)
    //    - Di-refund pada minggu berjalan (refundedMs di dalam [weekStartMs, weekCutoffMs])
    const isCrossWeekRefund =
      hasValidRefundTimestamp &&
      createdMs < weekStartMs &&
      refundedMs >= weekStartMs &&
      refundedMs <= weekCutoffMs;

    if (isCrossWeekRefund) {
      const alloc = resolveTenantOrderAllocation(order, normTenantId);
      if (alloc.hasTenantItem && alloc.orderTenantGross > 0) {
        const netRefund = Math.max(
          0,
          Math.round(alloc.orderTenantGross - alloc.allocatedDiscount)
        );
        const refundChannel = order.refundMethod || order.paymentMethod || "CASH";
        const [cR, qR, oR] = distributeChannelAmount(
          netRefund,
          refundChannel,
          order.refundMethod ? undefined : order.splitDetails
        );
        cashRefund += cR;
        qrisRefund += qR;
        otherRefund += oR;
      }
    }
  }

  // Hitung basis penjualan bersih (DPP setelah diskon, dikurangi refund lintas minggu, sebelum pajak)
  const cashNetSales = Math.max(0, Math.round(cashGross - cashDiscount - cashRefund));
  const qrisNetSales = Math.max(0, Math.round(qrisGross - qrisDiscount - qrisRefund));
  const otherNetSales = Math.max(0, Math.round(otherGross - otherDiscount - otherRefund));
  const totalNetSales = cashNetSales + qrisNetSales + otherNetSales;
  const refundDeduction = Math.round(cashRefund + qrisRefund + otherRefund);

  const qrisMdrFee = Math.round(qrisNetSales * QRIS_DEFAULT_MDR_RATE);

  let cashTenantShare = 0, cashDagoShare = 0, mdrTenantPortion = 0, mdrDagoPortion = 0;
  let qrisTenantShare = 0, qrisDagoShare = 0, otherTenantShare = 0, otherDagoShare = 0;
  let tenantGrossShare = 0, dagoGrossShare = 0, dagoTotalRevenue = 0, tenantTotalEarnings = 0;
  let netTransferAmount = 0;
  let actionDirection: SettlementActionDirection = "SETTLED";
  let actionLabel = "Impas / Selesai";

  if (isInternalPartner) {
    // Mitra internal dimiliki Dago: tampil di laporan konsolidasi dengan transfer/setoran settlement 0
    mdrDagoPortion = qrisMdrFee;
    qrisDagoShare = Math.max(0, qrisNetSales - qrisMdrFee);
    dagoGrossShare = totalNetSales;
    dagoTotalRevenue = Math.max(0, totalNetSales - qrisMdrFee);
    actionLabel = "Mitra internal (tanpa settlement)";
  } else {
    cashTenantShare = Math.round(cashNetSales * (tenantSharePct / 100));
    cashDagoShare = cashNetSales - cashTenantShare;

    if (mdrBearer === "MITRA") {
      mdrTenantPortion = qrisMdrFee;
    } else if (mdrBearer === "DAGO") {
      mdrDagoPortion = qrisMdrFee;
    } else {
      mdrTenantPortion = Math.round(qrisMdrFee * (tenantSharePct / 100));
      mdrDagoPortion = qrisMdrFee - mdrTenantPortion;
    }

    const rawQrisTenantShare = Math.round(qrisNetSales * (tenantSharePct / 100));
    qrisTenantShare = Math.max(0, rawQrisTenantShare - mdrTenantPortion);
    qrisDagoShare = Math.max(0, qrisNetSales - rawQrisTenantShare - mdrDagoPortion);

    otherTenantShare = Math.round(otherNetSales * (tenantSharePct / 100));
    otherDagoShare = otherNetSales - otherTenantShare;

    tenantGrossShare = Math.round(totalNetSales * (tenantSharePct / 100));
    dagoGrossShare = totalNetSales - tenantGrossShare;
    dagoTotalRevenue = cashDagoShare + qrisDagoShare + otherDagoShare;
    tenantTotalEarnings = cashTenantShare + qrisTenantShare + otherTenantShare;

    netTransferAmount = qrisTenantShare + otherTenantShare - cashDagoShare;
    if (netTransferAmount > 0) {
      actionDirection = "DAGO_TO_MITRA";
      actionLabel = `Dago transfer ke mitra (Rp ${netTransferAmount.toLocaleString("id-ID")})`;
    } else if (netTransferAmount < 0) {
      actionDirection = "MITRA_TO_DAGO";
      actionLabel = `Mitra setor ke Dago (Rp ${Math.abs(netTransferAmount).toLocaleString("id-ID")})`;
    }
  }

  const statusRecord = getSettlementPaymentStatus(period.periodKey, normTenantId);

  return {
    tenantId: normTenantId,
    ...meta,
    outletId: options?.outletId,
    outletName: options?.outletName,
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
    refundDeduction,
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

function buildOutletLookup(
  orders: readonly OrderRecord[],
  outlets?: readonly OutletItem[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const outlet of outlets && outlets.length > 0 ? outlets : DEMO_OUTLETS) {
    if (outlet.id) map.set(outlet.id, outlet.name);
  }
  for (const order of orders) {
    if (order.outletId && order.outletName && !map.has(order.outletId)) {
      map.set(order.outletId, order.outletName);
    }
  }
  return map;
}

function applyPreviousWeekComparison(
  orders: OrderRecord[],
  tenantSettlements: WeeklyTenantSettlement[],
  tenantOutletsInPeriod: Map<string, Set<string>>,
  weekStartMs: number,
  defaultOutletId: string,
  options?: CalculateWeeklySettlementOptions
): {
  previousTotalNetSales: number;
  previousTotalDagoRevenue: number;
  previousTenantTotals: ConsolidatedSettlementSummary["previousTenantTotals"];
} {
  const prevSummary = calculateConsolidatedWeeklySettlement(orders, {
    ...options,
    referenceDate: new Date(weekStartMs - DAY_MS),
    skipPreviousWeek: true,
  });
  const prevByTenantOutlet = new Map<string, { netSales: number; dagoRevenue: number }>();
  const prevByTenant = new Map<string, { netSales: number; dagoRevenue: number }>();
  const addBucket = (
    map: Map<string, { netSales: number; dagoRevenue: number }>,
    key: string,
    netSales: number,
    dagoRevenue: number
  ) => {
    const acc = map.get(key) || { netSales: 0, dagoRevenue: 0 };
    acc.netSales += netSales;
    acc.dagoRevenue += dagoRevenue;
    map.set(key, acc);
  };

  for (const prevRow of prevSummary.tenants) {
    addBucket(
      prevByTenantOutlet,
      `${prevRow.tenantId}::${prevRow.outletId || defaultOutletId}`,
      prevRow.totalNetSales,
      prevRow.dagoTotalRevenue
    );
    addBucket(prevByTenant, prevRow.tenantId, prevRow.totalNetSales, prevRow.dagoTotalRevenue);
  }

  const currByTenant = new Map<string, { netSales: number; dagoRevenue: number }>();
  for (const row of tenantSettlements) {
    addBucket(currByTenant, row.tenantId, row.totalNetSales, row.dagoTotalRevenue);
    const hasActiveOutlets = (tenantOutletsInPeriod.get(row.tenantId)?.size ?? 0) > 0;
    const matched = prevByTenantOutlet.get(`${row.tenantId}::${row.outletId || defaultOutletId}`);
    const tenantPrev = prevByTenant.get(row.tenantId);
    const prevNet = hasActiveOutlets ? matched?.netSales ?? 0 : tenantPrev?.netSales ?? 0;
    const prevDago = hasActiveOutlets ? matched?.dagoRevenue ?? 0 : tenantPrev?.dagoRevenue ?? 0;
    row.previousNetSales = prevNet;
    row.previousDagoRevenue = prevDago;
    row.previousTenantNetSales = tenantPrev?.netSales ?? 0;
    row.previousTenantDagoRevenue = tenantPrev?.dagoRevenue ?? 0;
    row.trendLabel = formatTrendLabel(row.totalNetSales, prevNet);
  }

  const previousTenantTotals: NonNullable<ConsolidatedSettlementSummary["previousTenantTotals"]> = {};
  for (const tid of Array.from(new Set([...currByTenant.keys(), ...prevByTenant.keys()])).sort()) {
    const curr = currByTenant.get(tid) || { netSales: 0, dagoRevenue: 0 };
    const prev = prevByTenant.get(tid) || { netSales: 0, dagoRevenue: 0 };
    previousTenantTotals[tid] = {
      previousNetSales: prev.netSales,
      previousDagoRevenue: prev.dagoRevenue,
      currentNetSales: curr.netSales,
      currentDagoRevenue: curr.dagoRevenue,
      trendLabel: formatTrendLabel(curr.netSales, prev.netSales),
    };
  }

  return {
    previousTotalNetSales: prevSummary.totalNetSales,
    previousTotalDagoRevenue: prevSummary.totalDagoRevenue,
    previousTenantTotals,
  };
}

/**
 * Menghitung Laporan #11: Konsolidasi Semua Mitra per (tenantId, outletId) beserta perbandingan minggu lalu.
 */
export function calculateConsolidatedWeeklySettlement(
  orders: OrderRecord[],
  options?: CalculateWeeklySettlementOptions
): ConsolidatedSettlementSummary {
  const period = getWeeklySettlementPeriod(options?.referenceDate);
  const weekStartMs = new Date(period.weekStartDate).getTime();
  const weekCutoffMs = new Date(period.weekCutoffDate).getTime();
  const outletLookup = buildOutletLookup(orders, options?.outlets);
  const defaultOutletId =
    options?.outletId ||
    (options?.outlets && options.outlets[0]?.id) ||
    DEMO_OUTLETS[0]?.id ||
    "outlet-sgr";
  const defaultOutletName = outletLookup.get(defaultOutletId) || "Singaraja";

  // Kumpulkan semua tenantId yang ada dari seed atau dari orders
  const knownTenantIds = new Set<string>();
  Object.keys(SEED_TENANT_PROFILES).forEach((id) => knownTenantIds.add(id));
  try {
    const syncProfiles = tenantsSyncClient.getSnapshot().profiles;
    if (syncProfiles && typeof syncProfiles === "object") {
      Object.keys(syncProfiles).forEach((id) => knownTenantIds.add(id));
    }
  } catch {}

  // Petakan pasangan (tenantId, outletId) yang punya transaksi atau refund di minggu berjalan
  const tenantOutletsInPeriod = new Map<string, Set<string>>();

  for (const o of orders) {
    if (o.syncStatus === "REJECTED") continue;
    const createdMs = new Date(o.createdAt).getTime();
    const refundedMs = o.refundedAt ? new Date(o.refundedAt).getTime() : NaN;
    const inPeriod =
      (Number.isFinite(createdMs) && createdMs >= weekStartMs && createdMs <= weekCutoffMs) ||
      (Number.isFinite(refundedMs) && refundedMs >= weekStartMs && refundedMs <= weekCutoffMs);

    const oid = o.outletId || defaultOutletId;
    for (const it of o.items || []) {
      const rawId = resolveItemTenantId(it, typeof o.tenantId === "string" ? o.tenantId : undefined);
      const id = normalizeTenantId(rawId) ?? rawId;
      if (id && id !== "DAGO_HUB") {
        knownTenantIds.add(id);
        if (inPeriod) {
          const set = tenantOutletsInPeriod.get(id) || new Set<string>();
          set.add(oid);
          tenantOutletsInPeriod.set(id, set);
        }
      }
    }
  }

  const tenantSettlements: WeeklyTenantSettlement[] = [];

  for (const tid of Array.from(knownTenantIds).sort()) {
    if (!options?.includeInternal) {
      if (tid === "DAGO_HUB") continue;
      try {
        if (getTenantProfile(tid)?.partnerType === "INTERNAL") continue;
      } catch {}
    }

    const outletSet = tenantOutletsInPeriod.get(tid);
    if (outletSet && outletSet.size > 0) {
      for (const oid of Array.from(outletSet).sort()) {
        const outletOrders = orders.filter((o) => (o.outletId || defaultOutletId) === oid);
        tenantSettlements.push(
          calculateWeeklyTenantSettlement(outletOrders, tid, {
            ...options,
            outletId: oid,
            outletName: outletLookup.get(oid) || oid,
          })
        );
      }
    } else {
      tenantSettlements.push(
        calculateWeeklyTenantSettlement(orders, tid, {
          ...options,
          outletId: defaultOutletId,
          outletName: defaultOutletName,
        })
      );
    }
  }

  const comparison = !options?.skipPreviousWeek
    ? applyPreviousWeekComparison(
        orders,
        tenantSettlements,
        tenantOutletsInPeriod,
        weekStartMs,
        defaultOutletId,
        options
      )
    : undefined;

  tenantSettlements.sort((a, b) => b.totalNetSales - a.totalNetSales);

  const totals = {
    totalGrossSales: 0, totalDiscount: 0, totalNetSales: 0, totalCashNetSales: 0,
    totalCashDagoShare: 0, totalQrisNetSales: 0, totalQrisTenantShare: 0,
    totalOtherNetSales: 0, totalMdrFee: 0, totalDagoRevenue: 0, totalTenantEarnings: 0,
    totalNetTransferDagoToMitra: 0, totalNetSetoranMitraToDago: 0, totalTransactions: 0,
    pendingCount: 0, paidCount: 0,
  };

  for (const s of tenantSettlements) {
    totals.totalGrossSales += s.totalGrossSales;
    totals.totalDiscount += s.totalDiscount;
    totals.totalNetSales += s.totalNetSales;
    totals.totalCashNetSales += s.cashNetSales;
    totals.totalCashDagoShare += s.cashDagoShare;
    totals.totalQrisNetSales += s.qrisNetSales;
    totals.totalQrisTenantShare += s.qrisTenantShare;
    totals.totalOtherNetSales += s.otherNetSales;
    totals.totalMdrFee += s.qrisMdrFee;
    totals.totalDagoRevenue += s.dagoTotalRevenue;
    totals.totalTenantEarnings += s.tenantTotalEarnings;
    totals.totalTransactions += s.transactionCount;
    if (s.netTransferAmount > 0) totals.totalNetTransferDagoToMitra += s.netTransferAmount;
    else if (s.netTransferAmount < 0) totals.totalNetSetoranMitraToDago += Math.abs(s.netTransferAmount);
    if (s.partnerType !== "INTERNAL" && s.tenantId !== "DAGO_HUB") {
      if (s.status === "PAID") totals.paidCount++;
      else totals.pendingCount++;
    }
  }

  return {
    period,
    tenants: tenantSettlements,
    ...totals,
    ...comparison,
    trendLabel: comparison
      ? formatTrendLabel(totals.totalNetSales, comparison.previousTotalNetSales)
      : undefined,
  };
}

export {
  buildSettlementReportDataset,
  buildConsolidatedSettlementReportDataset,
  type BuildSettlementReportDatasetParams,
} from "./settlement-report-builders";
