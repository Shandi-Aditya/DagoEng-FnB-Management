import type { StatusTone } from "@/components/app/status-badge";

export interface TicketPassData {
  id: string;
  ticketCode: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  institution?: string | null;
  ticketCount: number;
  unitPrice: number;
  totalPrice: number;
  paymentMethod: string;
  paymentStatus: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED" | "REFUNDED";
  paymentProofUrl?: string | null;
  paymentProofUploadedAt?: string | null;
  paymentProofNote?: string | null;
  checkInStatus: "REGISTERED" | "PARTIALLY_CHECKED_IN" | "CHECKED_IN";
  checkedInQty?: number;
  checkedInSeats?: number[];
  seatCheckInTimes?: Record<string, string> | null;
  checkInTime?: string | null;
  ticketTierId?: string | null;
  ticketTierName?: string | null;
  selectedSeats?: string[];
  isInvitation?: boolean;
  invitationNote?: string | null;
  promoCode?: string | null;
  discountAmount?: number;
  subtotalPrice?: number;
  refundStatus?: string | null;
  refundRequest?: any;
  refundPolicy?: any;
  refundEligibility?: any;
  destinationBankSnapshot?: {
    bankId: string;
    label?: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    branch?: string;
    badge?: string;
  } | null;
  activeDestinationBank?: {
    bankId?: string;
    label?: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    branch?: string;
    badge?: string;
  } | null;
  isOriginalBankDeactivated?: boolean;
  activeBankAccounts?: Array<{
    bankId: string;
    label?: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    branch?: string;
    badge?: string;
  }>;
  paymentRejectionReason?: string | null;
  paymentVerificationNote?: string | null;
  createdAt: string;
  eventDetails?: {
    id: string;
    title: string;
    category?: string;
    organizerName?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
  } | null;
}

export interface PaymentDeadlineResult {
  minutes: number;
  seconds: number;
  isExpired: boolean;
  deadlineIso: string;
  formattedDeadline: string;
}

export interface SubTicketInfo {
  subTicketCode: string;
  guestLabel: string;
  isCheckedIn: boolean;
  subPayload: string;
}

export interface TicketSummaryInput {
  ticketCode: string;
  guestName: string;
  ticketCount: number;
  eventId?: string;
  checkedInSeats?: number[];
  checkedInQty?: number;
  checkInStatus?: string;
}

/**
 * Calculates countdown deadline from ticket creation timestamp.
 */
export function calculatePaymentDeadline(
  createdAtIso: string,
  nowMs = Date.now(),
  durationMinutes = 60
): PaymentDeadlineResult {
  const createdMs = new Date(createdAtIso).getTime();
  const deadlineMs = createdMs + durationMinutes * 60 * 1000;
  const diffMs = deadlineMs - nowMs;

  const deadlineDate = new Date(deadlineMs);
  const formattedDeadline = !isNaN(deadlineDate.getTime())
    ? deadlineDate.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Makassar",
      }) + " WITA"
    : "—";

  if (diffMs <= 0 || isNaN(diffMs)) {
    return {
      minutes: 0,
      seconds: 0,
      isExpired: true,
      deadlineIso: new Date(deadlineMs).toISOString(),
      formattedDeadline,
    };
  }

  const totalSec = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;

  return {
    minutes,
    seconds,
    isExpired: false,
    deadlineIso: new Date(deadlineMs).toISOString(),
    formattedDeadline,
  };
}

/**
 * Formats event date into full Indonesian localized string with WITA time.
 */
export function formatTicketEventDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";

    const dateFormatted = d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Makassar",
    });

    const timeFormatted = d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Makassar",
    });

    return `${dateFormatted}, pukul ${timeFormatted} WITA`;
  } catch {
    return "—";
  }
}

/**
 * Computes sub-ticket seat code, label, payload, and check-in status.
 */
export function getSubTicketDetails(
  ticket: TicketSummaryInput,
  index: number
): SubTicketInfo {
  const totalCount = ticket.ticketCount || 1;
  const isMulti = totalCount > 1;

  const subTicketCode = isMulti
    ? `${ticket.ticketCode}-${String(index).padStart(2, "0")}`
    : ticket.ticketCode;

  const guestLabel = isMulti
    ? index === 1
      ? `${ticket.guestName} (Pemesan Utama)`
      : `Tamu Pax #${index}`
    : ticket.guestName;

  let isCheckedIn = false;
  if (Array.isArray(ticket.checkedInSeats)) {
    isCheckedIn = ticket.checkedInSeats.includes(index);
  } else if (typeof ticket.checkedInQty === "number") {
    isCheckedIn = ticket.checkedInQty >= index;
  } else {
    isCheckedIn = ticket.checkInStatus === "CHECKED_IN";
  }

  const subPayload = JSON.stringify({
    ticketCode: subTicketCode,
    eventId: ticket.eventId || "",
    seat: index,
  });

  return {
    subTicketCode,
    guestLabel,
    isCheckedIn,
    subPayload,
  };
}

/**
 * Maps payment status string to semantic StatusTone and Indonesian copy.
 */
export function getTicketPaymentStatusTone(status: string): {
  tone: StatusTone;
  label: string;
} {
  switch (status) {
    case "PAID":
      return { tone: "success", label: "Terkonfirmasi (Lunas)" };
    case "PENDING":
      return { tone: "warning", label: "Menunggu pembayaran" };
    case "REFUNDED":
      return { tone: "destructive", label: "Dikembalikan" };
    case "CANCELLED":
    case "EXPIRED":
      return { tone: "destructive", label: "Dibatalkan" };
    default:
      return { tone: "neutral", label: status };
  }
}

/**
 * Maps check-in status and attendance progress to semantic StatusTone and label.
 */
export function getTicketCheckInStatusTone(
  checkInStatus: string,
  ticketCount = 1,
  checkedInQty = 0
): {
  tone: StatusTone;
  label: string;
} {
  if (checkInStatus === "CHECKED_IN" || checkedInQty >= ticketCount) {
    return { tone: "success", label: "Selesai check-in" };
  }
  if (checkInStatus === "PARTIALLY_CHECKED_IN" || checkedInQty > 0) {
    return { tone: "info", label: `Sebagian hadir (${checkedInQty}/${ticketCount})` };
  }
  return { tone: "neutral", label: "Belum check-in" };
}

/**
 * Formats payment method identifier to human-readable Indonesian text.
 */
export function formatPaymentMethodLabel(method: string): string {
  switch (method) {
    case "BANK_TRANSFER":
    case "MANUAL_TRANSFER":
      return "Transfer Bank Manual";
    case "QRIS":
      return "QRIS";
    case "DOKU":
      return "DOKU Payment Gateway";
    case "CASH":
      return "Tunai di Lokasi";
    case "INVITATION":
      return "Tiket undangan";
    default:
      return method || "Transfer Bank";
  }
}
