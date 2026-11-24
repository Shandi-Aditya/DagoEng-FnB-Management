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
  | "INVALID_SEAT"
  | "REFUNDED";

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

export interface BookingAttendance {
  ticketCount: number;
  checkedInQty: number;
  remainingQty: number;
  isCheckedIn: boolean;
  isPartial: boolean;
  isUnchecked: boolean;
  attendanceLabel: string;
}

/**
 * Calculates canonical attendance metrics for an event ticket booking.
 */
export function getBookingAttendance(
  booking: Pick<EventTicketOrder, "ticketCount" | "checkedInQty" | "checkInStatus" | "checkedInSeats">
): BookingAttendance {
  const ticketCount =
    typeof booking.ticketCount === "number" && booking.ticketCount > 0
      ? booking.ticketCount
      : 1;
  const checkedInQty =
    typeof booking.checkedInQty === "number"
      ? booking.checkedInQty
      : Array.isArray(booking.checkedInSeats)
      ? booking.checkedInSeats.length
      : booking.checkInStatus === "CHECKED_IN"
      ? ticketCount
      : 0;

  const isCheckedIn = booking.checkInStatus === "CHECKED_IN" || checkedInQty >= ticketCount;
  const isPartial = !isCheckedIn && checkedInQty > 0;
  const isUnchecked = !isCheckedIn && !isPartial;
  const remainingQty = Math.max(0, ticketCount - checkedInQty);

  const attendanceLabel = isCheckedIn
    ? "Hadir"
    : isPartial
    ? `Hadir ${checkedInQty}/${ticketCount}`
    : "Belum hadir";

  return {
    ticketCount,
    checkedInQty,
    remainingQty,
    isCheckedIn,
    isPartial,
    isUnchecked,
    attendanceLabel,
  };
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

const UNPAID_PAYMENT_MESSAGES: Record<string, string> = {
  CANCELLED: "Tiket telah dibatalkan (CANCELLED) dan tidak dapat digunakan untuk check-in.",
  EXPIRED: "Tiket telah kedaluwarsa (EXPIRED) dan tidak dapat digunakan untuk check-in.",
  PENDING: "Tiket belum diverifikasi lunas (status pembayaran masih PENDING).",
};

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

  if (ticket.paymentStatus === "REFUNDED" || ticket.refundStatus === "REQUESTED") {
    return {
      valid: false,
      code: "REFUNDED",
      message:
        ticket.paymentStatus === "REFUNDED"
          ? "Tiket ini telah dikembalikan (REFUNDED) dan tidak dapat digunakan untuk check-in."
          : "Tiket ini sedang dalam proses pengajuan refund (REQUESTED) dan tidak dapat digunakan untuk check-in.",
    };
  }

  if (ticket.paymentStatus !== "PAID") {
    return {
      valid: false,
      code: "UNPAID",
      message:
        UNPAID_PAYMENT_MESSAGES[ticket.paymentStatus] ||
        `Tiket belum lunas (Status: ${ticket.paymentStatus}).`,
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
      const priorTime = ticket.seatCheckInTimes?.[String(requestedSeat)] || ticket.checkInTime;
      const timeFormatted = priorTime ? formatCheckInTime(priorTime) : "";
      const timeSuffix = timeFormatted && timeFormatted !== "—" ? ` (check-in pukul ${timeFormatted})` : "";
      return {
        valid: false,
        code: "SEAT_ALREADY_USED",
        message: `Tiket #${requestedSeat} sudah digunakan untuk check-in sebelumnya${timeSuffix}.`,
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
    const priorTime = ticket.checkInTime;
    const timeFormatted = priorTime ? formatCheckInTime(priorTime) : "";
    const timeSuffix = timeFormatted && timeFormatted !== "—" ? ` (check-in pukul ${timeFormatted})` : "";
    return {
      valid: false,
      code: "ALREADY_USED",
      message: `Tiket sudah digunakan untuk check-in sebelumnya${timeSuffix}.`,
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

export const WITA_TIMEZONE = "Asia/Makassar";

export type EventDateStatus = "TODAY" | "PAST" | "UPCOMING";

/**
 * Returns YYYY-MM-DD date string in WITA timezone (Asia/Makassar, UTC+8).
 */
export function getWitaDateString(date: Date | string | number = new Date()): string {
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: WITA_TIMEZONE }).format(d);
  } catch {
    const tzOffset = 8 * 60;
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const witaDate = new Date(utc + tzOffset * 60000);
    return witaDate.toISOString().slice(0, 10);
  }
}

/**
 * Determines whether an event is in the past, occurs today, or is upcoming in WITA timezone.
 * Sanity-checks duration (caps at 7 days) to prevent corrupted multi-year dummy end dates from staying active.
 */
export function getEventDateStatusWita(
  event: { startDate: string; endDate?: string | null },
  referenceDate: Date = new Date()
): EventDateStatus {
  const todayWita = getWitaDateString(referenceDate);
  const startWita = getWitaDateString(event.startDate);

  if (!startWita || !todayWita) return "PAST";

  const startMs = new Date(event.startDate).getTime();
  let endMs = event.endDate ? new Date(event.endDate).getTime() : startMs;

  if (isNaN(startMs)) return "PAST";
  if (isNaN(endMs) || endMs < startMs) {
    endMs = startMs;
  }

  // Dago Hub community events last hours or a few days. Cap anomalous durations > 7 days to start date.
  const MAX_EVENT_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
  if (endMs - startMs > MAX_EVENT_DURATION_MS) {
    endMs = startMs;
  }

  const endWita = getWitaDateString(new Date(endMs));

  if (endWita < todayWita) {
    return "PAST";
  }

  if (startWita > todayWita) {
    return "UPCOMING";
  }

  return "TODAY";
}

/**
 * Checks whether an event occurs today in WITA timezone (Asia/Makassar).
 */
export function isEventTodayWita(
  event: { startDate: string; endDate?: string | null },
  referenceDate: Date = new Date()
): boolean {
  return getEventDateStatusWita(event, referenceDate) === "TODAY";
}

/**
 * Filters a list of events to strictly those taking place today in WITA timezone.
 * Excludes past events and upcoming events.
 */
export function filterTodayEventsWita<T extends { startDate: string; endDate?: string | null }>(
  events: readonly T[],
  referenceDate: Date = new Date()
): T[] {
  return events.filter((e) => isEventTodayWita(e, referenceDate));
}

