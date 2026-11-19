import type {
  CommunityEvent,
  EventCategory,
  EventStatus,
  EventTicketOrder,
} from "@/types/event";
import type { DateRange } from "@/components/events/EventDateRangeFilter";
import {
  isEventInWitaPeriod,
  isTimestampInWitaPeriod,
} from "@/components/events/EventDateRangeFilter";
import { normalizeIndonesianPhone } from "@/lib/utils";

export type EventStatusTone = "warning" | "info" | "success" | "destructive" | "neutral";
export type PaymentStatusTone = "warning" | "success" | "destructive" | "neutral";
export type PayoutStatusTone = "warning" | "info" | "success" | "destructive";

/**
 * Pemetaan status pengajuan event ke label bahasa Indonesia berhuruf kalimat.
 */
export function eventStatusLabel(status: EventStatus | string): string {
  switch (status) {
    case "PENDING":
      return "Menunggu review";
    case "REVISION_REQUESTED":
      return "Perlu revisi";
    case "APPROVED":
      return "Disetujui";
    case "REJECTED":
      return "Ditolak";
    case "ARCHIVED":
      return "Diarsipkan";
    default:
      return status || "—";
  }
}

/**
 * Pemetaan status pengajuan event ke tone warna semantik StatusBadge.
 */
export function eventStatusTone(status: EventStatus | string): EventStatusTone {
  switch (status) {
    case "PENDING":
      return "warning";
    case "REVISION_REQUESTED":
      return "info";
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "destructive";
    case "ARCHIVED":
      return "neutral";
    default:
      return "neutral";
  }
}

/**
 * Pemetaan status pembayaran tiket ke label bahasa Indonesia.
 */
export function paymentStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Menunggu verifikasi";
    case "PAID":
      return "Lunas";
    case "REJECTED":
      return "Ditolak";
    case "EXPIRED":
      return "Kedaluwarsa";
    case "CANCELLED":
      return "Dibatalkan";
    default:
      return status || "—";
  }
}

/**
 * Pemetaan status pembayaran tiket ke tone warna semantik StatusBadge.
 */
export function paymentStatusTone(status: string): PaymentStatusTone {
  switch (status) {
    case "PAID":
      return "success";
    case "PENDING":
      return "warning";
    case "REJECTED":
    case "EXPIRED":
    case "CANCELLED":
      return "destructive";
    default:
      return "neutral";
  }
}

/**
 * Pemetaan status payout bagi hasil ke label bahasa Indonesia.
 */
export function payoutStatusLabel(status: string): string {
  switch (status) {
    case "REQUESTED":
      return "Diajukan";
    case "PROCESSING":
      return "Diproses";
    case "PAID":
      return "Selesai";
    case "REJECTED":
      return "Ditolak";
    default:
      return status || "—";
  }
}

/**
 * Pemetaan status payout bagi hasil ke tone warna semantik StatusBadge.
 */
export function payoutStatusTone(status: string): PayoutStatusTone {
  switch (status) {
    case "PAID":
      return "success";
    case "PROCESSING":
      return "info";
    case "REQUESTED":
      return "warning";
    case "REJECTED":
      return "destructive";
    default:
      return "warning";
  }
}

/**
 * Pemetaan kategori event ke bahasa Indonesia.
 */
export function eventCategoryLabel(category: EventCategory | string): string {
  switch (category) {
    case "WORKSHOP":
      return "Workshop";
    case "MEETUP":
      return "Meetup";
    case "CREATIVE":
      return "Kreatif";
    case "COMMUNITY":
      return "Komunitas";
    case "TECH":
      return "Teknologi";
    case "SEMINAR":
      return "Seminar";
    case "OTHER":
      return "Lainnya";
    default:
      return category || "Lainnya";
  }
}

/**
 * Pemformat tanggal aman yang menangani string kosong atau format invalid.
 */
export function formatDateSafe(isoString?: string | null, includeTime: boolean = false): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Makassar",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/**
 * Memformat nomor telepon menjadi link URL WhatsApp resmi dengan kode negara 62.
 */
export function formatWhatsAppUrl(phone?: string | null): string {
  if (!phone) return "#";
  const cleaned = phone.replace(/[^0-9]/g, "");
  if (!cleaned) return "#";
  if (cleaned.startsWith("0")) {
    return `https://wa.me/62${cleaned.slice(1)}`;
  }
  if (!cleaned.startsWith("62")) {
    return `https://wa.me/62${cleaned}`;
  }
  return `https://wa.me/${cleaned}`;
}

/**
 * Memeriksa apakah event yang belum disetujui sudah lewat dari tanggal jadwal selesainya.
 */
export function isPastUnapproved(e: CommunityEvent, nowMs: number = Date.now()): boolean {
  if (e.status !== "PENDING" && e.status !== "REVISION_REQUESTED") return false;
  const endMs = e.endDate
    ? new Date(e.endDate).getTime()
    : new Date(e.startDate).getTime() + 24 * 60 * 60 * 1000;
  return endMs < nowMs;
}

/**
 * Mengambil status efektif event (event lewat tanpa persetujuan otomatis diarsipkan).
 */
export function getEffectiveStatus(e: CommunityEvent, nowMs: number = Date.now()): EventStatus {
  if (isPastUnapproved(e, nowMs)) return "ARCHIVED";
  return e.status;
}

/**
 * Filter antrean moderasi event murni tanpa mutasi array asal.
 */
export function filterEvents(
  events: readonly CommunityEvent[],
  statusTab: string,
  query: string,
  dateRange?: DateRange | null,
): CommunityEvent[] {
  const needle = query.trim().toLowerCase();

  return events
    .filter((e) => {
      // 1. Filter Tab Status
      if (statusTab === "REVENUE_SPLIT") {
        const hasProposal = Boolean(e.proposedRevenueSplit && e.proposedRevenueSplit.status === "PENDING");
        if (!hasProposal) return false;
      } else if (statusTab !== "ALL") {
        const effStatus = getEffectiveStatus(e);
        if (effStatus !== statusTab) return false;
      }

      // 2. Filter Rentang Tanggal
      if (dateRange && !isEventInWitaPeriod(e, dateRange)) {
        return false;
      }

      if (needle) {
        const matchTitle = (e.title || "").toLowerCase().includes(needle);
        const matchOrganizer = (e.organizerName || "").toLowerCase().includes(needle);
        const matchEmail = (e.organizerEmail || "").toLowerCase().includes(needle);
        const matchPhone = (e.organizerPhone || "").toLowerCase().includes(needle);
        const matchLocation = (e.location || "").toLowerCase().includes(needle);
        const matchNotes =
          e.adminNotes?.toLowerCase().includes(needle) ||
          e.rejectionReason?.toLowerCase().includes(needle) ||
          e.revisionNotes?.toLowerCase().includes(needle);
        if (!matchTitle && !matchOrganizer && !matchEmail && !matchPhone && !matchLocation && !matchNotes) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function filterBookings(
  bookings: readonly EventTicketOrder[],
  filterStatus: string,
  query: string,
  dateRange?: DateRange | null,
): EventTicketOrder[] {
  const needle = query.trim().toLowerCase();
  const normPhone = normalizeIndonesianPhone(needle);

  return bookings.filter((b) => {
    if (filterStatus === "PENDING_PROOF") {
      const isPendingWithProof =
        b.totalPrice > 0 &&
        b.paymentStatus === "PENDING" &&
        Boolean(b.paymentProofUrl) &&
        !b.paymentRejectionReason;
      if (!isPendingWithProof) return false;
    } else if (filterStatus === "REJECTED") {
      const isRejected =
        String(b.paymentStatus) === "REJECTED" ||
        b.paymentStatus === "CANCELLED" ||
        Boolean(b.paymentRejectionReason);
      if (!isRejected) return false;
    } else if (filterStatus !== "ALL") {
      if (b.paymentStatus !== filterStatus) return false;
    }

    if (dateRange && !isTimestampInWitaPeriod(b.createdAt, dateRange)) {
      return false;
    }

    if (needle) {
      const matchCode = (b.ticketCode || "").toLowerCase().includes(needle);
      const matchName = (b.guestName || "").toLowerCase().includes(needle);
      const matchEmail = (b.guestEmail || "").toLowerCase().includes(needle);
      const matchEvent = (b.eventTitle || "").toLowerCase().includes(needle);
      const matchPhone =
        (b.guestPhone || "").toLowerCase().includes(needle) ||
        (normPhone.length >= 4 && normalizeIndonesianPhone(b.guestPhone || "").includes(normPhone));
      if (!matchCode && !matchName && !matchEmail && !matchEvent && !matchPhone) {
        return false;
      }
    }

    return true;
  });
}

export function calculateEventsKPI(
  events: readonly CommunityEvent[],
  bookings: readonly EventTicketOrder[],
) {
  let pendingReviewsCount = 0;
  let approvedEventsCount = 0;
  let revisionEventsCount = 0;

  for (const e of events) {
    const status = getEffectiveStatus(e);
    if (status === "PENDING") pendingReviewsCount += 1;
    else if (status === "APPROVED") approvedEventsCount += 1;
    else if (status === "REVISION_REQUESTED") revisionEventsCount += 1;
  }

  let pendingPaymentsCount = 0;
  let totalRevenuePaid = 0;
  let totalTicketsSold = 0;

  for (const b of bookings) {
    if (
      b.totalPrice > 0 &&
      b.paymentStatus === "PENDING" &&
      Boolean(b.paymentProofUrl) &&
      !b.paymentRejectionReason
    ) {
      pendingPaymentsCount += 1;
    }
    if (b.paymentStatus === "PAID") {
      totalRevenuePaid += b.totalPrice;
      totalTicketsSold += b.ticketCount || 1;
    }
  }

  return {
    pendingReviewsCount,
    approvedEventsCount,
    revisionEventsCount,
    pendingPaymentsCount,
    totalRevenuePaid,
    totalTicketsSold,
  };
}
