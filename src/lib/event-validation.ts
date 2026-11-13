/**
 * Event Validation Library (Task S-03)
 * Single source of truth for event price, quota capacity, and role restrictions.
 * Safe for use in both server-side modules and client components.
 */

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
