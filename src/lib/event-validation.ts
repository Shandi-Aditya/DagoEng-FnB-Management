/**
 * Event Validation Library (Task S-03)
 * Single source of truth for event price, quota capacity, and role restrictions.
 * Safe for use in both server-side modules and client components.
 */

import type { EventTicketTier, EventRefundPolicy } from "@/types/event";

export const MIN_EVENT_CAPACITY = 1;
export const MAX_EVENT_CAPACITY = 1000;

export const CHECKIN_STAFF_SUBMISSION_BLOCKED_MESSAGE =
  "Akses ditolak: Akun Petugas Check-In tidak diizinkan untuk membuat atau mengajukan event.";

export interface EventValidationResult<T = number> {
  valid: boolean;
  error?: string;
  value?: T;
}

/**
 * Validates ticket price based on business policy S-03:
 * - Free event (isPaid === false): price must be 0 (or empty/undefined which defaults to 0).
 * - Paid event (isPaid === true):
 *   - Price must be a safe integer (> 0 and <= Number.MAX_SAFE_INTEGER).
 *   - Decimals (e.g. 0.9, 1000.5, 15000.75) are strictly rejected.
 *   - Zero, negative, NaN, Infinity, and numbers outside safe integer are rejected.
 *   - Coercion of invalid strings (e.g. "0.9", "1e58") is strictly prevented.
 *   - No arbitrary min Rp1.000 or max Rp50.000.000 (per S-03 prompt).
 */
export function validateEventPrice(isPaid: boolean, rawPrice: unknown): EventValidationResult<number> {
  if (!isPaid) {
    if (rawPrice === undefined || rawPrice === null || rawPrice === "" || rawPrice === 0 || rawPrice === "0") {
      return { valid: true, value: 0 };
    }

    const num = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);
    if (num === 0) {
      return { valid: true, value: 0 };
    }

    return {
      valid: false,
      error: "Event gratis harus menggunakan nominal harga Rp 0.",
    };
  }

  // Event berbayar (isPaid === true)
  if (rawPrice === undefined || rawPrice === null || rawPrice === "") {
    return {
      valid: false,
      error: "Nominal harga tiket wajib diisi untuk event berbayar.",
    };
  }

  if (typeof rawPrice === "string") {
    const trimmed = rawPrice.trim();
    if (!/^\d+$/.test(trimmed)) {
      return {
        valid: false,
        error: "Harga tiket harus berupa bilangan bulat rupiah tanpa pecahan desimal atau notasi eksponensial.",
      };
    }
  }

  if (typeof rawPrice !== "number" && typeof rawPrice !== "string") {
    return {
      valid: false,
      error: "Format harga tiket tidak valid.",
    };
  }

  const num = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);

  if (isNaN(num) || !Number.isFinite(num)) {
    return {
      valid: false,
      error: "Nominal harga tiket tidak valid.",
    };
  }

  if (!Number.isSafeInteger(num)) {
    return {
      valid: false,
      error: "Harga tiket harus berupa bilangan bulat rupiah yang aman (tanpa pecahan desimal atau nilai di luar batas safe integer).",
    };
  }

  if (num < 0) {
    return {
      valid: false,
      error: "Harga tiket tidak boleh bernilai negatif.",
    };
  }

  if (num === 0) {
    return {
      valid: false,
      error: "Nominal harga tiket wajib lebih dari Rp 0 untuk event berbayar.",
    };
  }

  return {
    valid: true,
    value: num,
  };
}

/**
 * Validates event capacity based on business policy S-03:
 * - Capacity must be a positive integer.
 * - Minimum: 1.
 * - Maximum: 1000.
 * - Decimals, zero, negative, NaN, Infinity, and extreme values (e.g. 1e58) are strictly rejected.
 * - Can be optional (isOptional = true) when organizer leaves quota open to venue default.
 */
export function validateEventCapacity(rawCapacity: unknown, isOptional = false): EventValidationResult<number> {
  if (rawCapacity === undefined || rawCapacity === null || rawCapacity === "") {
    if (isOptional) {
      return { valid: true, value: undefined };
    }
    return {
      valid: false,
      error: "Kapasitas maksimal venue/tiket wajib diisi.",
    };
  }

  if (typeof rawCapacity === "string") {
    const trimmed = rawCapacity.trim();
    if (!/^\d+$/.test(trimmed)) {
      return {
        valid: false,
        error: "Kapasitas maksimal venue/tiket harus berupa bilangan bulat positif tanpa pecahan desimal atau format ilmiah.",
      };
    }
  }

  if (typeof rawCapacity !== "number" && typeof rawCapacity !== "string") {
    return {
      valid: false,
      error: "Format kapasitas maksimal venue/tiket tidak valid.",
    };
  }

  const num = typeof rawCapacity === "number" ? rawCapacity : Number(rawCapacity);

  if (isNaN(num) || !Number.isFinite(num)) {
    return {
      valid: false,
      error: "Kapasitas maksimal venue/tiket tidak valid.",
    };
  }

  if (!Number.isSafeInteger(num)) {
    return {
      valid: false,
      error: "Kapasitas maksimal venue/tiket harus berupa bilangan bulat positif yang aman (tanpa pecahan desimal atau nilai eksponensial).",
    };
  }

  if (num < MIN_EVENT_CAPACITY) {
    return {
      valid: false,
      error: `Kapasitas maksimal venue/tiket harus berupa bilangan bulat positif minimal ${MIN_EVENT_CAPACITY} peserta.`,
    };
  }

  if (num > MAX_EVENT_CAPACITY) {
    return {
      valid: false,
      error: `Kapasitas maksimal venue/tiket tidak boleh melebihi ${MAX_EVENT_CAPACITY.toLocaleString("id-ID")} peserta.`,
    };
  }

  return {
    valid: true,
    value: num,
  };
}

/**
 * Checks whether the given role or user object belongs to CHECKIN_STAFF.
 */
export function isCheckInStaffRole(role: unknown): boolean {
  if (!role) return false;
  if (typeof role === "string") {
    return role.trim().toUpperCase() === "CHECKIN_STAFF";
  }
  if (typeof role === "object" && role !== null && "slug" in (role as any)) {
    return String((role as any).slug).trim().toUpperCase() === "CHECKIN_STAFF";
  }
  return false;
}

export const DEFAULT_PLATFORM_FEE_PERCENT = 20;
export const MIN_PLATFORM_FEE_PERCENT = 0;
export const MAX_PLATFORM_FEE_PERCENT = 50;

export interface RevenueSplitValidationResult {
  valid: boolean;
  error?: string;
  value?: number;
}

/**
 * Validates platform fee percent strictly according to business policy:
 * - Must be a safe integer
 * - Must be between 0 and 50 inclusive
 * - Rejects decimals, string decimals, NaN, Infinity, negative, >50
 * - Does NOT round or clamp invalid values
 */
export function validatePlatformFeePercent(raw: unknown): RevenueSplitValidationResult {
  if (raw === undefined || raw === null || raw === "") {
    return { valid: false, error: "Persentase komisi platform wajib diisi." };
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) {
      return {
        valid: false,
        error: "Persentase komisi platform harus berupa bilangan bulat tanpa pecahan desimal atau notasi eksponensial.",
      };
    }
  }

  if (typeof raw !== "number" && typeof raw !== "string") {
    return { valid: false, error: "Format persentase komisi platform tidak valid." };
  }

  const num = typeof raw === "number" ? raw : Number(raw);

  if (isNaN(num) || !Number.isFinite(num)) {
    return { valid: false, error: "Persentase komisi platform harus berupa angka yang valid." };
  }

  if (!Number.isSafeInteger(num)) {
    return {
      valid: false,
      error: "Persentase komisi platform harus berupa bilangan bulat tanpa desimal.",
    };
  }

  if (num < MIN_PLATFORM_FEE_PERCENT || num > MAX_PLATFORM_FEE_PERCENT) {
    return {
      valid: false,
      error: `Persentase komisi platform harus berada dalam rentang ${MIN_PLATFORM_FEE_PERCENT}% hingga ${MAX_PLATFORM_FEE_PERCENT}% (bagian penyelenggara 50% hingga 100%).`,
    };
  }

  return { valid: true, value: num };
}

/**
 * Resolves the effective platform fee percentage (0-50%) for an event.
 * Uses event.customPlatformFeePercent as the single source of truth (SSOT).
 * If customPlatformFeePercent is provided, it MUST be valid; invalid values throw an Error.
 * If not provided (null/undefined), resolves to backend default (default: 20%).
 * Strictly ignores legacy `organizerFeePercent` to uphold backend policy as SSOT.
 */
export function resolveEffectivePlatformFeePercent(
  event?: { customPlatformFeePercent?: number | null; organizerFeePercent?: number | null } | null,
  fallbackDefault?: number
): number {
  if (event && event.customPlatformFeePercent !== undefined && event.customPlatformFeePercent !== null) {
    const validation = validatePlatformFeePercent(event.customPlatformFeePercent);
    if (!validation.valid || validation.value === undefined) {
      throw new Error(validation.error || "Persentase komisi platform tidak valid.");
    }
    return validation.value;
  }

  // If fallbackDefault is supplied, validate it
  if (fallbackDefault !== undefined && fallbackDefault !== null) {
    const fallbackValidation = validatePlatformFeePercent(fallbackDefault);
    if (!fallbackValidation.valid || fallbackValidation.value === undefined) {
      throw new Error(fallbackValidation.error || "Default persentase komisi platform tidak valid.");
    }
    return fallbackValidation.value;
  }

  return DEFAULT_PLATFORM_FEE_PERCENT;
}

/**
 * Resolves organizer share percentage (50-100%) for an event.
 * Formula: 100 - effectivePlatformFeePercent.
 */
export function resolveOrganizerSharePercent(
  event?: { customPlatformFeePercent?: number | null; organizerFeePercent?: number | null } | null,
  fallbackDefault?: number
): number {
  const platformFee = resolveEffectivePlatformFeePercent(event, fallbackDefault);
  return 100 - platformFee;
}

/**
 * Normalizes date/datetime-local string into ISO string with WITA (+08:00) offset.
 */
export function normalizeDateToWitaIso(dateInput: string): string {
  if (!dateInput) return "";
  const trimmed = dateInput.trim();
  let parsed: Date;
  if (trimmed.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    parsed = new Date(trimmed);
  } else if (trimmed.includes("T")) {
    const withSec = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
    parsed = new Date(`${withSec}+08:00`);
  } else {
    parsed = new Date(`${trimmed}T00:00:00+08:00`);
  }
  if (isNaN(parsed.getTime())) {
    throw new Error(`Format tanggal tidak valid: '${dateInput}'.`);
  }
  return parsed.toISOString();
}

/**
 * Validates ticket tiers array based on Task S-12 policy:
 * - Each tier must have unique ID (auto-generated if empty), clean name (2..80 chars).
 * - Price must be safe integer >= 0 (rejects decimals like 0.9, negative, NaN, 1e58).
 * - Quota validated via validateEventCapacity(tier.quota, false) (1..1000).
 * - Sales start and end dates normalized to ISO WIT (+08:00) with salesEndDate >= salesStartDate.
 * - Total sum of quotas must not exceed MAX_EVENT_CAPACITY (1000) or explicit maxCapacity.
 */
export function validateEventTicketTiers(
  rawTiers: unknown,
  options?: { maxCapacity?: number }
): EventValidationResult<EventTicketTier[]> {
  if (rawTiers === undefined || rawTiers === null) {
    return { valid: true, value: undefined };
  }

  if (!Array.isArray(rawTiers)) {
    return { valid: false, error: "Format daftar jenis tiket (ticketTiers) harus berupa array." };
  }

  if (rawTiers.length === 0) {
    return { valid: true, value: [] };
  }

  const validatedTiers: EventTicketTier[] = [];
  const seenIds = new Set<string>();
  let sumTierQuota = 0;

  for (let i = 0; i < rawTiers.length; i++) {
    const rawTier = rawTiers[i];
    if (!rawTier || typeof rawTier !== "object") {
      return { valid: false, error: `Jenis tiket ke-${i + 1} harus berupa objek yang valid.` };
    }

    const t = rawTier as Record<string, unknown>;

    // 1. Name
    const name = typeof t.name === "string" ? t.name.trim() : "";
    if (name.length < 2 || name.length > 80) {
      return {
        valid: false,
        error: `Nama jenis tiket ke-${i + 1} wajib diisi antara 2 hingga 80 karakter.`,
      };
    }

    // 2. ID
    let id = typeof t.id === "string" && t.id.trim() ? t.id.trim() : "";
    if (!id) {
      id = `tier-${i + 1}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    }
    if (seenIds.has(id)) {
      return {
        valid: false,
        error: `ID jenis tiket harus unik. Ditemukan duplikasi ID: ${id}`,
      };
    }
    seenIds.add(id);

    // 3. Price (safe integer >= 0, strict rejection of decimals like 0.9, 1e58, negative)
    if (t.price === undefined || t.price === null || t.price === "") {
      return {
        valid: false,
        error: `Harga tiket untuk jenis '${name}' wajib diisi.`,
      };
    }

    if (typeof t.price === "string") {
      const trimmedPrice = t.price.trim();
      if (!/^\d+$/.test(trimmedPrice)) {
        return {
          valid: false,
          error: `Harga tiket untuk jenis '${name}' harus berupa bilangan bulat rupiah tanpa pecahan desimal atau notasi eksponensial.`,
        };
      }
    }

    if (typeof t.price !== "number" && typeof t.price !== "string") {
      return {
        valid: false,
        error: `Format harga tiket untuk jenis '${name}' tidak valid.`,
      };
    }

    const numPrice = typeof t.price === "number" ? t.price : Number(t.price);
    if (isNaN(numPrice) || !Number.isFinite(numPrice) || !Number.isSafeInteger(numPrice) || numPrice < 0) {
      return {
        valid: false,
        error: `Harga tiket untuk jenis '${name}' harus berupa bilangan bulat rupiah yang aman (>= 0).`,
      };
    }

    // 4. Quota (1..1000)
    const capVal = validateEventCapacity(t.quota, false);
    if (!capVal.valid || capVal.value === undefined) {
      return {
        valid: false,
        error: `Kuota jenis tiket '${name}': ${capVal.error || "Kuota tidak valid."}`,
      };
    }
    const quota = capVal.value;
    sumTierQuota += quota;

    // 5. Sales dates
    let salesStartDate: string | undefined;
    let salesEndDate: string | undefined;

    if (t.salesStartDate && typeof t.salesStartDate === "string" && t.salesStartDate.trim()) {
      try {
        salesStartDate = normalizeDateToWitaIso(t.salesStartDate);
      } catch {
        return {
          valid: false,
          error: `Waktu mulai penjualan jenis tiket '${name}' tidak valid.`,
        };
      }
      if (isNaN(new Date(salesStartDate).getTime())) {
        return {
          valid: false,
          error: `Waktu mulai penjualan jenis tiket '${name}' tidak valid.`,
        };
      }
    }

    if (t.salesEndDate && typeof t.salesEndDate === "string" && t.salesEndDate.trim()) {
      try {
        salesEndDate = normalizeDateToWitaIso(t.salesEndDate);
      } catch {
        return {
          valid: false,
          error: `Waktu selesai penjualan jenis tiket '${name}' tidak valid.`,
        };
      }
      if (isNaN(new Date(salesEndDate).getTime())) {
        return {
          valid: false,
          error: `Waktu selesai penjualan jenis tiket '${name}' tidak valid.`,
        };
      }
    }

    if (salesStartDate && salesEndDate) {
      if (new Date(salesEndDate).getTime() < new Date(salesStartDate).getTime()) {
        return {
          valid: false,
          error: `Waktu selesai penjualan jenis tiket '${name}' tidak boleh mendahului waktu mulai.`,
        };
      }
    }

    validatedTiers.push({
      id,
      name,
      price: numPrice,
      quota,
      description: typeof t.description === "string" ? t.description.trim() : undefined,
      salesStartDate,
      salesEndDate,
      isActive: t.isActive !== undefined ? Boolean(t.isActive) : true,
    });
  }

  // Check sum of quotas
  if (sumTierQuota > MAX_EVENT_CAPACITY) {
    return {
      valid: false,
      error: `Total kuota seluruh jenis tiket (${sumTierQuota}) tidak boleh melebihi batas maksimal event (${MAX_EVENT_CAPACITY} peserta).`,
    };
  }

  if (options?.maxCapacity !== undefined && options.maxCapacity !== null && (options.maxCapacity as unknown) !== "") {
    const maxCap = Number(options.maxCapacity);
    if (Number.isSafeInteger(maxCap) && sumTierQuota > maxCap) {
      return {
        valid: false,
        error: `Total kuota seluruh jenis tiket (${sumTierQuota}) tidak boleh melebihi kapasitas event (${maxCap} peserta).`,
      };
    }
  }

  return { valid: true, value: validatedTiers };
}

/**
 * Validates event refund policy:
 * - policyType: "NO_REFUND" | "REFUNDABLE_UNTIL_H_MINUS"
 * - hMinusDays: safe integer 0..60
 * - refundFeePercent: safe integer 0..100
 */
export function validateEventRefundPolicy(rawPolicy: unknown): EventValidationResult<EventRefundPolicy> {
  if (rawPolicy === undefined || rawPolicy === null) {
    return { valid: true, value: { policyType: "NO_REFUND" } };
  }

  if (typeof rawPolicy !== "object" || rawPolicy === null) {
    return { valid: false, error: "Kebijakan refund harus berupa objek yang valid." };
  }

  const p = rawPolicy as Record<string, unknown>;
  const policyType = p.policyType;

  if (policyType !== "NO_REFUND" && policyType !== "REFUNDABLE_UNTIL_H_MINUS") {
    return {
      valid: false,
      error: "Tipe kebijakan refund tidak valid (hanya NO_REFUND atau REFUNDABLE_UNTIL_H_MINUS).",
    };
  }

  const description = typeof p.description === "string" ? p.description.trim() : undefined;

  if (policyType === "NO_REFUND") {
    return {
      valid: true,
      value: {
        policyType: "NO_REFUND",
        description,
      },
    };
  }

  // REFUNDABLE_UNTIL_H_MINUS
  if (p.hMinusDays === undefined || p.hMinusDays === null || p.hMinusDays === "") {
    return {
      valid: false,
      error: "Batas hari pengajuan refund (H-) wajib diisi.",
    };
  }

  if (typeof p.hMinusDays !== "number" && typeof p.hMinusDays !== "string") {
    return {
      valid: false,
      error: "Batas hari pengajuan refund (H-) harus berupa angka atau teks numerik.",
    };
  }

  if (typeof p.hMinusDays === "string") {
    const trimmedDays = p.hMinusDays.trim();
    if (!/^\d+$/.test(trimmedDays)) {
      return {
        valid: false,
        error: "Batas hari pengajuan refund (H-) harus berupa bilangan bulat tanpa pecahan desimal.",
      };
    }
  }

  const days = typeof p.hMinusDays === "number" ? p.hMinusDays : Number(p.hMinusDays);
  if (!Number.isSafeInteger(days) || days < 0 || days > 60) {
    return {
      valid: false,
      error: "Batas hari pengajuan refund (H-) harus berupa bilangan bulat antara 0 hingga 60 hari.",
    };
  }

  if (p.refundFeePercent === undefined || p.refundFeePercent === null || p.refundFeePercent === "") {
    return {
      valid: false,
      error: "Potongan biaya admin refund wajib diisi.",
    };
  }

  if (typeof p.refundFeePercent !== "number" && typeof p.refundFeePercent !== "string") {
    return {
      valid: false,
      error: "Potongan biaya admin refund harus berupa angka atau teks numerik.",
    };
  }

  if (typeof p.refundFeePercent === "string") {
    const trimmedFee = p.refundFeePercent.trim();
    if (!/^\d+$/.test(trimmedFee)) {
      return {
        valid: false,
        error: "Potongan biaya admin refund harus berupa bilangan bulat tanpa pecahan desimal.",
      };
    }
  }

  const fee = typeof p.refundFeePercent === "number" ? p.refundFeePercent : Number(p.refundFeePercent);
  if (!Number.isSafeInteger(fee) || fee < 0 || fee > 100) {
    return {
      valid: false,
      error: "Potongan biaya admin refund harus berupa bilangan bulat antara 0% hingga 100%.",
    };
  }

  return {
    valid: true,
    value: {
      policyType: "REFUNDABLE_UNTIL_H_MINUS",
      hMinusDays: days,
      refundFeePercent: fee,
      description,
    },
  };
}
