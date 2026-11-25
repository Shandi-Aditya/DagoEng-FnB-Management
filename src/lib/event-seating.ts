/**
 * Domain module for event seating chart configuration, seat generation, and booking validation.
 * Supports simple grid layouts per ticket tier (e.g. VIP A1-A10, Reguler B1-B20).
 */

import type { EventTicketOrder, EventTicketTier } from "@/types/event";

export interface SeatValidationResult {
  valid: boolean;
  error?: string;
}

export interface ValidateSeatSelectionParams {
  hasSeatingChart?: boolean;
  selectedSeats?: string[];
  ticketCount: number;
  tierSeats?: string[];
  occupiedSeats: Set<string>;
}

function formatMultiCharRowSuffix(rowIndex: number): string {
  if (rowIndex < 26) {
    return String.fromCharCode(65 + rowIndex);
  }
  const first = String.fromCharCode(65 + Math.floor(rowIndex / 26) - 1);
  const second = String.fromCharCode(65 + (rowIndex % 26));
  return `${first}${second}`;
}

/**
 * Generates an ordered list of seat codes for a given ticket tier.
 * If rowPrefix is 1 char (e.g. "A"):
 *   - Increments row letter per row (A1..An, B1..Bn)
 * If rowPrefix is multi-char (e.g. "VIP"):
 *   - totalRows === 1 -> VIP1..VIPn
 *   - totalRows > 1 -> VIP-A1..VIP-An, VIP-B1..VIP-Bn
 * If rowPrefix is omitted:
 *   - Falls back to generic codes "K1", "K2", ..., "K{quota}"
 */
export function generateTierSeats(
  tier: Pick<EventTicketTier, "rowPrefix" | "totalRows" | "seatsPerRow" | "quota">
): string[] {
  const quota = typeof tier.quota === "number" && tier.quota > 0 ? tier.quota : 10;
  const rawPrefix = (tier.rowPrefix || "").trim().toUpperCase();

  if (!rawPrefix) {
    const seats: string[] = [];
    for (let i = 1; i <= quota; i++) {
      seats.push(`K${i}`);
    }
    return seats;
  }

  const seatsPerRow =
    typeof tier.seatsPerRow === "number" && tier.seatsPerRow > 0
      ? tier.seatsPerRow
      : quota;
  const totalRows =
    typeof tier.totalRows === "number" && tier.totalRows > 0
      ? tier.totalRows
      : Math.max(1, Math.ceil(quota / seatsPerRow));

  const seats: string[] = [];

  if (rawPrefix.length === 1) {
    const baseCharCode = rawPrefix.charCodeAt(0);
    for (let r = 0; r < totalRows; r++) {
      const rowLetter = String.fromCharCode(baseCharCode + r);
      for (let s = 1; s <= seatsPerRow; s++) {
        if (seats.length < quota || !tier.quota) {
          seats.push(`${rowLetter}${s}`);
        }
      }
    }
    return seats;
  }

  if (totalRows === 1) {
    for (let s = 1; s <= seatsPerRow; s++) {
      if (seats.length < quota || !tier.quota) {
        seats.push(`${rawPrefix}${s}`);
      }
    }
    return seats;
  }

  for (let r = 0; r < totalRows; r++) {
    const rowLetter = formatMultiCharRowSuffix(r);
    for (let s = 1; s <= seatsPerRow; s++) {
      if (seats.length < quota || !tier.quota) {
        seats.push(`${rawPrefix}-${rowLetter}${s}`);
      }
    }
  }

  return seats;
}

/**
 * Collects all currently occupied seats for an event from active bookings.
 * Automatically excludes CANCELLED, EXPIRED, REFUNDED, APPROVED refund, and expired PENDING bookings.
 */
export function getEventOccupiedSeats(
  eventId: string,
  bookings: readonly EventTicketOrder[],
  nowMs: number = Date.now()
): Set<string> {
  const occupied = new Set<string>();

  for (const b of bookings) {
    if (b.eventId !== eventId) continue;
    if (b.paymentStatus === "CANCELLED" || b.paymentStatus === "EXPIRED" || b.paymentStatus === "REFUNDED") continue;
    if (b.refundStatus === "APPROVED") continue;
    if (b.paymentStatus === "PENDING" && !b.paymentProofUrl) {
      const expiresAtMs = b.expiresAt ? Date.parse(b.expiresAt) : NaN;
      const createdAtMs = b.createdAt ? Date.parse(b.createdAt) : NaN;
      const isExpiredByExpiresAt = Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs;
      const isExpiredByFallback =
        !Number.isFinite(expiresAtMs) &&
        Number.isFinite(createdAtMs) &&
        createdAtMs + 2 * 60 * 60 * 1000 <= nowMs;
      if (isExpiredByExpiresAt || isExpiredByFallback) {
        continue;
      }
    }

    if (Array.isArray(b.selectedSeats)) {
      for (const seat of b.selectedSeats) {
        if (typeof seat !== "string") continue;
        const clean = seat.trim().toUpperCase();
        if (clean) {
          occupied.add(clean);
        }
      }
    }
  }

  return occupied;
}

/**
 * Validates buyer seat selection against quota, availability, duplicates, and tier boundaries.
 */
export function validateSeatSelection({
  hasSeatingChart,
  selectedSeats,
  ticketCount,
  tierSeats,
  occupiedSeats,
}: ValidateSeatSelectionParams): SeatValidationResult {
  // If seating chart is disabled for this event, seats are not required.
  if (!hasSeatingChart) {
    return { valid: true };
  }

  if (
    Array.isArray(selectedSeats) &&
    selectedSeats.some((s) => typeof s !== "string" || s.trim().length === 0)
  ) {
    return {
      valid: false,
      error: "Format nomor kursi tidak valid. Setiap kursi harus berupa kode teks yang valid.",
    };
  }

  const cleanSeats = Array.isArray(selectedSeats)
    ? selectedSeats.map((s) => s.trim().toUpperCase()).filter(Boolean)
    : [];

  if (cleanSeats.length === 0) {
    return {
      valid: false,
      error: "Silakan pilih nomor kursi terlebih dahulu sebelum melanjutkan.",
    };
  }

  if (cleanSeats.length !== ticketCount) {
    return {
      valid: false,
      error: `Jumlah kursi yang dipilih (${cleanSeats.length}) harus sama dengan jumlah tiket (${ticketCount}).`,
    };
  }

  // Check internal duplicate selection
  const uniqueSelected = new Set(cleanSeats);
  if (uniqueSelected.size !== cleanSeats.length) {
    return {
      valid: false,
      error: "Terdapat duplikasi kursi dalam pilihan Anda. Setiap tiket memerlukan satu kursi unik.",
    };
  }

  // Check tier boundaries if tierSeats is provided
  if (Array.isArray(tierSeats) && tierSeats.length > 0) {
    const tierSeatSet = new Set(tierSeats.map((s) => s.trim().toUpperCase()));
    const invalidSeats = cleanSeats.filter((s) => !tierSeatSet.has(s));
    if (invalidSeats.length > 0) {
      return {
        valid: false,
        error: `Kursi [${invalidSeats.join(", ")}] tidak valid untuk kategori tiket ini.`,
      };
    }
  }

  // Check collision with already occupied seats in database
  const collidedSeats = cleanSeats.filter((s) => occupiedSeats.has(s));
  if (collidedSeats.length > 0) {
    return {
      valid: false,
      error: `Kursi [${collidedSeats.join(", ")}] sudah dipesan atau tidak tersedia. Silakan pilih kursi lain.`,
    };
  }

  return { valid: true };
}

/**
 * Formats seat codes into a human-readable string.
 */
export function formatSeatsList(seats?: string[]): string {
  if (!Array.isArray(seats) || seats.length === 0) {
    return "—";
  }
  return seats.join(", ");
}
