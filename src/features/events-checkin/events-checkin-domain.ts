import type { EventTicketOrder, AttendeeCheckInStatus } from "@/types/event";
import type { StatusTone } from "@/components/app/status-badge";
import { normalizeIndonesianPhone } from "@/lib/utils";

export interface ParsedTicketCode {
  cleanCode: string;
  baseCode: string;
  seatNumber?: number;
}

export type TicketValidationCode =
  | "OK"
  | "NOT_FOUND"
  | "WRONG_EVENT"
  | "UNPAID"
  | "ALREADY_USED"
  | "SEAT_ALREADY_USED"
  | "INVALID_SEAT";

export interface TicketValidationResult {
  valid: boolean;
  code: TicketValidationCode;
  message?: string;
  isComplete?: boolean;
  targetStatus?: AttendeeCheckInStatus;
}

export interface CheckInStats {
  totalTickets: number;
  checkedInCount: number;
  remainingCount: number;
  percentage: number;
  uncheckedOrders: number;
  checkedOrders: number;
  totalOrders: number;
}

/**
 * Parses raw scanner input (gun scanner, camera scanner, QR URL, JSON payload, or sub-ticket code).
 */
export function parseTicketScanCode(raw: string): ParsedTicketCode {
  let parsed = raw.trim();

  // Handle JSON payload: {"ticketCode": "..."}
  if (parsed.startsWith("{") && parsed.endsWith("}")) {
    try {
      const obj = JSON.parse(parsed);
      if (obj.ticketCode) {
        parsed = String(obj.ticketCode).trim();
      }
    } catch {
      // Ignore JSON parse error and fallback to regex/match
    }
  }

  // Handle escaped JSON snippet
  if (parsed.includes('"ticketCode"')) {
    const match = parsed.match(/"ticketCode"\s*:\s*"([^"]+)"/);
    if (match?.[1]) {
      parsed = match[1].trim();
    }
  }

  // Handle prefix DAGO-CHECKIN:
  if (parsed.startsWith("DAGO-CHECKIN:")) {
    const parts = parsed.split(":");
    if (parts[1]) {
      parsed = parts[1].trim();
    }
  }

  // Extract from URL if present
  const matchUrl = parsed.match(/DAGO-EVT-[A-Z0-9-]+/i);
  if (matchUrl) {
    parsed = matchUrl[0];
  }

  const cleanCode = parsed.trim().toUpperCase();

  // Match sub-ticket seat suffix, e.g. DAGO-EVT-96354-02
  const matchSeat = cleanCode.match(/^(DAGO-EVT-[A-Z0-9]+)-0*(\d+)$/i);
  const baseCode = matchSeat ? matchSeat[1] : cleanCode;
  const seatNumber = matchSeat ? parseInt(matchSeat[2], 10) : undefined;

  return { cleanCode, baseCode, seatNumber };
}

/**
 * Validates a ticket against an event and checks payment status and duplicate presence.
 */
export function validateTicketCheckIn(
  ticket: EventTicketOrder | null,
  currentEventId: string,
  requestedSeat?: number
): TicketValidationResult {
  if (!ticket) {
    return {
      valid: false,
      code: "NOT_FOUND",
      message: "Tiket tidak ditemukan pada data pemesanan.",
    };
  }

  if (currentEventId && ticket.eventId !== currentEventId) {
    return {
      valid: false,
      code: "WRONG_EVENT",
      message: `Tiket terdaftar pada "${ticket.eventTitle || "event lain"}", bukan event ini.`,
    };
  }

  if (ticket.paymentStatus !== "PAID") {
    return {
      valid: false,
      code: "UNPAID",
      message: `Tiket belum lunas (Status: ${ticket.paymentStatus}).`,
    };
  }

  const ticketCount = ticket.ticketCount || 1;
  const currentCheckedSeats: number[] = Array.isArray(ticket.checkedInSeats)
    ? [...ticket.checkedInSeats]
    : Array.from({ length: ticket.checkedInQty || 0 }, (_, i) => i + 1);

  // If a specific seat is requested (e.g. sub-ticket -02)
  if (requestedSeat !== undefined) {
    if (requestedSeat < 1 || requestedSeat > ticketCount) {
      return {
        valid: false,
        code: "INVALID_SEAT",
        message: `Nomor tiket #${requestedSeat} tidak valid (total ${ticketCount} tiket).`,
      };
    }

    if (currentCheckedSeats.includes(requestedSeat)) {
      return {
        valid: false,
        code: "SEAT_ALREADY_USED",
        message: `Tiket #${requestedSeat} sudah digunakan untuk check-in sebelumnya.`,
      };
    }

    const isComplete = currentCheckedSeats.length + 1 >= ticketCount;
    return {
      valid: true,
      code: "OK",
      isComplete,
      targetStatus: isComplete ? "CHECKED_IN" : "PARTIALLY_CHECKED_IN",
    };
  }

  // General check-in
  if (currentCheckedSeats.length >= ticketCount) {
    return {
      valid: false,
      code: "ALREADY_USED",
      message: `Seluruh tiket sudah digunakan untuk check-in sebelumnya.`,
    };
  }

  const isComplete = currentCheckedSeats.length + 1 >= ticketCount;
  return {
    valid: true,
    code: "OK",
    isComplete,
    targetStatus: isComplete ? "CHECKED_IN" : "PARTIALLY_CHECKED_IN",
  };
}

/**
 * Calculates check-in statistics across attendee bookings for an event.
 */
export function calculateCheckInStats(tickets: readonly EventTicketOrder[]): CheckInStats {
  const totalTickets = tickets.reduce((acc, b) => acc + (b.ticketCount || 1), 0);

  const checkedInCount = tickets.reduce((acc, b) => {
    if (typeof b.checkedInQty === "number") return acc + b.checkedInQty;
    return b.checkInStatus === "CHECKED_IN" ? acc + (b.ticketCount || 1) : acc;
  }, 0);

  const remainingCount = Math.max(0, totalTickets - checkedInCount);
  const percentage = totalTickets > 0 ? Math.round((checkedInCount / totalTickets) * 100) : 0;

  const uncheckedOrders = tickets.filter((b) => b.checkInStatus !== "CHECKED_IN").length;
  const checkedOrders = tickets.filter((b) => b.checkInStatus === "CHECKED_IN").length;
  const totalOrders = tickets.length;

  return {
    totalTickets,
    checkedInCount,
    remainingCount,
    percentage,
    uncheckedOrders,
    checkedOrders,
    totalOrders,
  };
}

/**
 * Filters tickets by active status tab and query search.
 * Returns a new array copy (does not mutate source).
 */
export function filterCheckInTickets(
  tickets: readonly EventTicketOrder[],
  tab: "UNCHECKED" | "CHECKED" | "ALL",
  searchQuery: string
): EventTicketOrder[] {
  let list = tickets.slice();

  if (tab === "UNCHECKED") {
    list = list.filter((b) => b.checkInStatus !== "CHECKED_IN");
  } else if (tab === "CHECKED") {
    list = list.filter((b) => b.checkInStatus === "CHECKED_IN");
  }

  const q = searchQuery.trim().toLowerCase();
  if (!q) return list;

  const normQ = normalizeIndonesianPhone(q);

  return list.filter((b) => {
    const matchCode = (b.ticketCode || "").toLowerCase().includes(q);
    const matchName = (b.guestName || "").toLowerCase().includes(q);
    const matchEmail = (b.guestEmail || "").toLowerCase().includes(q);
    const matchPhone =
      (b.guestPhone || "").toLowerCase().includes(q) ||
      (normQ.length >= 4 && normalizeIndonesianPhone(b.guestPhone || "").includes(normQ));
    const matchInst = (b.institution || "").toLowerCase().includes(q);
    return matchCode || matchName || matchEmail || matchPhone || matchInst;
  });
}

/**
 * Formats check-in timestamp into Indonesian WITA representation.
 */
export function formatCheckInTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "—";
    const time = date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Makassar",
    });
    return `${time} WITA`;
  } catch {
    return "—";
  }
}

/**
 * Maps payment status string to semantic StatusTone.
 */
export function getPaymentStatusTone(status: string): StatusTone {
  switch (status) {
    case "PAID":
      return "success";
    case "PENDING":
      return "warning";
    case "EXPIRED":
    case "CANCELLED":
    case "REFUNDED":
      return "destructive";
    default:
      return "neutral";
  }
}

/**
 * Returns human-readable label for payment status.
 */
export function formatPaymentStatusLabel(status: string): string {
  switch (status) {
    case "PAID":
      return "Lunas";
    case "PENDING":
      return "Menunggu";
    case "EXPIRED":
      return "Kedaluwarsa";
    case "CANCELLED":
      return "Dibatalkan";
    case "REFUNDED":
      return "Dikembalikan";
    default:
      return status;
  }
}

/**
 * Maps check-in status and attendance progress to semantic StatusTone and human label.
 */
export function getCheckInStatusTone(ticket: EventTicketOrder): { tone: StatusTone; label: string } {
  const count = ticket.ticketCount || 1;
  const checked =
    typeof ticket.checkedInQty === "number"
      ? ticket.checkedInQty
      : ticket.checkInStatus === "CHECKED_IN"
      ? count
      : 0;

  if (ticket.checkInStatus === "CHECKED_IN" || checked >= count) {
    return {
      tone: "success",
      label: count > 1 ? `Hadir (${count})` : "Hadir",
    };
  }

  if (checked > 0) {
    return {
      tone: "info",
      label: `Hadir ${checked}/${count}`,
    };
  }

  return {
    tone: "warning",
    label: count > 1 ? `Belum hadir (0/${count})` : "Belum hadir",
  };
}
