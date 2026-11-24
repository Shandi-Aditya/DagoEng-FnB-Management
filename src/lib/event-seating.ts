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

/**
 * Generates an ordered list of seat codes for a given ticket tier.
 * If rowPrefix is given (e.g. "A"):
 *   - totalRows: number of rows (e.g. 2 -> A and B)
 *   - seatsPerRow: seats per row (e.g. 5 -> A1-A5, B1-B5)
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

  const baseCharCode = rawPrefix.charCodeAt(0);
  const seats: string[] = [];

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

/**
 * Collects all currently occupied seats for an event from active bookings.
 * Automatically excludes CANCELLED, EXPIRED, and APPROVED refund bookings.
 */
export function getEventOccupiedSeats(
  eventId: string,
  bookings: readonly EventTicketOrder[]
): Set<string> {
  const occupied = new Set<string>();

  for (const b of bookings) {
    if (b.eventId !== eventId) continue;
    if (b.paymentStatus === "CANCELLED" || b.paymentStatus === "EXPIRED" || b.paymentStatus === "REFUNDED") continue;
    if (b.refundStatus === "APPROVED") continue;

    if (Array.isArray(b.selectedSeats)) {
      for (const seat of b.selectedSeats) {
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
