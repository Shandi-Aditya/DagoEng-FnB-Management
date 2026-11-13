import type {
  CommunityEvent,
  EventCategory,
  EventStatus,
  EventTicketOrder,
} from "@/types/event";
import type { DateRange } from "@/components/events/EventDateRangeFilter";
import { isTimestampInWitaPeriod } from "@/components/events/EventDateRangeFilter";
import { resolveVenueCapacity } from "@/lib/event-capacity";

// Reuse and re-export shared domain logic from events-admin for maximum efficiency
export {
  eventStatusLabel,
  eventStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
  payoutStatusLabel,
  payoutStatusTone,
  eventCategoryLabel,
  formatDateSafe,
  formatWhatsAppUrl,
  isPastUnapproved,
  getEffectiveStatus,
} from "@/features/events-admin/events-admin-domain";

export interface OrganizerEventMetrics {
  totalEvents: number;
  activeEvents: number;
  actionRequiredCount: number;
  totalAttendees: number;
  grossRevenue: number;
  organizerEarnings: number;
}

export interface EventOccupancyResult {
  ticketsPaid: number;
  totalCapacity: number;
  occupancyRate: number;
}

/**
 * Filter event mitra secara murni tanpa mutasi input.
 */
export function filterOrganizerEvents(
  events: readonly CommunityEvent[],
  status: string,
  searchQuery: string,
  dateRange?: DateRange | null
): CommunityEvent[] {
  const query = searchQuery.trim().toLowerCase();

  return events.filter((e) => {
    const matchStatus = status === "ALL" || e.status === status;
    const matchSearch =
      !query ||
      e.title.toLowerCase().includes(query) ||
      (e.location && e.location.toLowerCase().includes(query));

    let matchDate = true;
    if (dateRange && e.startDate) {
      matchDate = isTimestampInWitaPeriod(e.startDate, dateRange);
    }

    return matchStatus && matchSearch && matchDate;
  });
}

/**
 * Filter daftar peserta dan pemesanan tiket secara murni.
 */
export function filterOrganizerAttendees(
  bookings: readonly EventTicketOrder[],
  selectedEventId: string,
  searchQuery: string,
  dateRange?: DateRange | null
): EventTicketOrder[] {
  const query = searchQuery.trim().toLowerCase();

  return bookings.filter((b) => {
    const matchEvent = selectedEventId === "ALL" || b.eventId === selectedEventId;
    const matchSearch =
      !query ||
      b.ticketCode.toLowerCase().includes(query) ||
      b.guestName.toLowerCase().includes(query) ||
      (b.institution || "").toLowerCase().includes(query) ||
      (b.guestPhone || "").toLowerCase().includes(query);

    let matchDate = true;
    if (dateRange && b.createdAt) {
      matchDate = isTimestampInWitaPeriod(b.createdAt, dateRange);
    }

    return matchEvent && matchSearch && matchDate;
  });
}

/**
 * Menghitung metrik operasional dan performa penjualan mitra penyelenggara.
 */
export function calculateOrganizerEventMetrics(
  events: readonly CommunityEvent[],
  bookings: readonly EventTicketOrder[]
): OrganizerEventMetrics {
  const totalEvents = events.length;
  const activeEvents = events.filter((e) => e.status === "APPROVED").length;
  const actionRequiredCount = events.filter(
    (e) => e.status === "PENDING" || e.status === "REVISION_REQUESTED"
  ).length;

  const paidBookings = bookings.filter((b) => b.paymentStatus === "PAID");
  const totalAttendees = paidBookings.reduce((sum, b) => sum + (b.ticketCount || 1), 0);
  const grossRevenue = paidBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  const organizerEarnings = paidBookings.reduce(
    (sum, b) => sum + (b.organizerRevenueAmount ?? Math.round(b.totalPrice * 0.8)),
    0
  );

  return {
    totalEvents,
    activeEvents,
    actionRequiredCount,
    totalAttendees,
    grossRevenue,
    organizerEarnings,
  };
}

/**
 * Menghitung persentase okupansi keterisian kapasitas event (0 - 100%).
 */
export function calculateEventOccupancy(
  event: CommunityEvent,
  bookings: readonly EventTicketOrder[]
): EventOccupancyResult {
  const eventBookings = bookings.filter((b) => b.eventId === event.id);
  const paidBookings = eventBookings.filter((b) => b.paymentStatus === "PAID");
  const ticketsPaid = paidBookings.reduce((sum, b) => sum + (b.ticketCount || 1), 0);

  const capacityRes = resolveVenueCapacity(event);
  const totalCapacity = capacityRes.capacity || 0;
  const occupancyRate =
    totalCapacity > 0 ? Math.min(100, Math.round((ticketsPaid / totalCapacity) * 100)) : 0;

  return {
    ticketsPaid,
    totalCapacity,
    occupancyRate,
  };
}

/**
 * Pesan keadaan kosong untuk daftar event yang jujur.
 */
export function emptyOrganizerEventMessage(
  status: string,
  hasSearch: boolean
): { title: string; description: string } {
  if (hasSearch) {
    return {
      title: "Tidak ada event yang cocok",
      description: "Ubah kata kunci pencarian atau sesuaikan filter status.",
    };
  }

  switch (status) {
    case "APPROVED":
      return {
        title: "Belum ada event tayang",
        description: "Event yang disetujui kurator akan tampil di marketplace publik.",
      };
    case "PENDING":
      return {
        title: "Tidak ada event meninjau",
        description: "Event baru yang diajukan akan menunggu review kurator di sini.",
      };
    case "REVISION_REQUESTED":
      return {
        title: "Tidak ada event perlu revisi",
        description: "Semua pengajuan event Anda bebas dari catatan kurator.",
      };
    case "REJECTED":
      return {
        title: "Tidak ada event ditolak",
        description: "Catatan penolakan proposal akan tercatat di sini.",
      };
    case "ARCHIVED":
      return {
        title: "Tidak ada arsip event",
        description: "Event yang telah selesai atau lewat masa tayang akan diarsipkan di sini.",
      };
    default:
      return {
        title: "Belum ada event terdaftar",
        description: "Mulai buat event komunitas baru untuk ditayangkan di ekosistem Dago.",
      };
  }
}

/**
 * Pesan keadaan kosong untuk daftar peserta tiket yang jujur.
 */
export function emptyOrganizerAttendeeMessage(hasSearch: boolean): {
  title: string;
  description: string;
} {
  if (hasSearch) {
    return {
      title: "Tidak ada peserta yang cocok",
      description: "Coba cari berdasarkan kode tiket, nama, atau instansi lain.",
    };
  }

  return {
    title: "Belum ada pesanan tiket",
    description: "Pesanan tiket dari peserta event akan muncul di sini.",
  };
}

/**
 * Baris data tabular untuk ekspor CSV peserta.
 */
export function buildAttendeesExportRows(
  bookings: readonly EventTicketOrder[]
): string[][] {
  return bookings.map((b) => [
    b.ticketCode,
    b.eventTitle || "—",
    b.guestName,
    b.guestPhone || "—",
    b.institution || "—",
    String(b.ticketCount || 1),
    b.paymentStatus === "PAID"
      ? "Lunas"
      : b.paymentStatus === "CANCELLED"
      ? "Batal"
      : "Menunggu pembayaran",
    b.checkInStatus === "CHECKED_IN" ? "Hadir" : "Belum hadir",
    b.checkInTime ? new Date(b.checkInTime).toLocaleString("id-ID") : "—",
  ]);
}
