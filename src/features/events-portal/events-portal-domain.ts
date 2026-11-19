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
import { resolveVenueCapacity } from "@/lib/event-capacity";
import { normalizeIndonesianPhone } from "@/lib/utils";

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
      (e.title || "").toLowerCase().includes(query) ||
      Boolean(e.location && e.location.toLowerCase().includes(query));

    const matchDate = dateRange ? isEventInWitaPeriod(e, dateRange) : true;

    return matchStatus && matchSearch && matchDate;
  });
}

export function filterOrganizerAttendees(
  bookings: readonly EventTicketOrder[],
  selectedEventId: string,
  searchQuery: string,
  dateRange?: DateRange | null,
  paymentStatusFilter: string = "ALL",
  checkInStatusFilter: string = "ALL"
): EventTicketOrder[] {
  const query = searchQuery.trim().toLowerCase();
  const normPhone = normalizeIndonesianPhone(query);

  return bookings.filter((b) => {
    const matchEvent = selectedEventId === "ALL" || b.eventId === selectedEventId;

    if (paymentStatusFilter !== "ALL") {
      if (paymentStatusFilter === "REJECTED") {
        if (String(b.paymentStatus) !== "REJECTED" && !b.paymentRejectionReason) return false;
      } else if (b.paymentStatus !== paymentStatusFilter) {
        return false;
      }
    }

    if (checkInStatusFilter !== "ALL") {
      const qty = b.ticketCount || 1;
      const checkedQty =
        typeof b.checkedInQty === "number"
          ? b.checkedInQty
          : b.checkInStatus === "CHECKED_IN"
          ? qty
          : 0;
      const isChecked = b.checkInStatus === "CHECKED_IN" || checkedQty >= qty;
      const isPartial = !isChecked && checkedQty > 0;
      if (checkInStatusFilter === "CHECKED_IN" && !isChecked) return false;
      if (checkInStatusFilter === "PARTIALLY_CHECKED_IN" && !isPartial) return false;
      if (checkInStatusFilter === "REGISTERED" && (isChecked || isPartial)) return false;
    }

    const matchSearch =
      !query ||
      (b.ticketCode || "").toLowerCase().includes(query) ||
      (b.guestName || "").toLowerCase().includes(query) ||
      (b.guestEmail || "").toLowerCase().includes(query) ||
      (b.institution || "").toLowerCase().includes(query) ||
      (b.guestPhone || "").toLowerCase().includes(query) ||
      (normPhone.length >= 4 && normalizeIndonesianPhone(b.guestPhone || "").includes(normPhone));

    const matchDate = dateRange ? isTimestampInWitaPeriod(b.createdAt, dateRange) : true;

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

  const eventIds = new Set(events.map((e) => e.id));
  const paidBookings = bookings.filter(
    (b) => b.paymentStatus === "PAID" && (eventIds.size === 0 || eventIds.has(b.eventId))
  );
  const totalAttendees = paidBookings.reduce((sum, b) => sum + (b.ticketCount || 1), 0);
  const grossRevenue = paidBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  const organizerEarnings = paidBookings.reduce(
    (sum, b) => sum + (b.organizerRevenueAmount ?? Math.round((b.totalPrice || 0) * 0.8)),
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
    b.ticketTierName || (b.isInvitation ? "Tiket Undangan" : "Standar"),
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

export interface EventTierSalesStats {
  tierId: string;
  tierName: string;
  price: number;
  quota: number;
  soldCount: number;
  remainingQuota: number;
  revenue: number;
  organizerRevenue: number;
  isSoldOut: boolean;
}

export interface EventSalesSummary {
  eventId: string;
  eventTitle: string;
  totalCapacity: number;
  totalTicketsSold: number;
  remainingCapacity: number;
  occupancyRate: number;
  totalRevenue: number;
  organizerEarnings: number;
  tierBreakdown: EventTierSalesStats[];
  attendeeCount: number;
  isSoldOut: boolean;
}

/**
 * Menghitung ringkasan performa penjualan tiket per jenis (tier) dan sisa kuota event.
 */
export function calculateEventSalesSummary(
  event: CommunityEvent,
  bookings: readonly EventTicketOrder[]
): EventSalesSummary {
  const eventBookings = bookings.filter((b) => b.eventId === event.id);
  const paidBookings = eventBookings.filter((b) => b.paymentStatus === "PAID");

  const totalTicketsSold = paidBookings.reduce((sum, b) => sum + (b.ticketCount || 1), 0);
  const totalRevenue = paidBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  const organizerEarnings = paidBookings.reduce(
    (sum, b) => sum + (b.organizerRevenueAmount ?? Math.round((b.totalPrice || 0) * 0.8)),
    0
  );

  let totalCapacity = 0;
  if (event.ticketTiers && event.ticketTiers.length > 0) {
    totalCapacity = event.ticketTiers.reduce((sum, t) => sum + (t.quota || 0), 0);
  } else if (typeof event.maxCapacity === "number" && event.maxCapacity > 0) {
    totalCapacity = event.maxCapacity;
  } else {
    const capacityRes = resolveVenueCapacity(event);
    totalCapacity = capacityRes.capacity || 0;
  }

  const remainingCapacity = Math.max(0, totalCapacity - totalTicketsSold);
  const occupancyRate =
    totalCapacity > 0 ? Math.min(100, Math.round((totalTicketsSold / totalCapacity) * 100)) : 0;

  const tierBreakdown: EventTierSalesStats[] = [];

  if (event.ticketTiers && event.ticketTiers.length > 0) {
    const knownTierIds = new Set(event.ticketTiers.map((t) => t.id));

    for (const tier of event.ticketTiers) {
      const tierBookings = paidBookings.filter((b) => b.ticketTierId === tier.id);
      const soldCount = tierBookings.reduce((sum, b) => sum + (b.ticketCount || 1), 0);
      const remainingQuota = Math.max(0, (tier.quota || 0) - soldCount);
      const revenue = tierBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
      const organizerRevenue = tierBookings.reduce(
        (sum, b) => sum + (b.organizerRevenueAmount ?? Math.round((b.totalPrice || 0) * 0.8)),
        0
      );
      const isSoldOut = tier.quota > 0 && soldCount >= tier.quota;

      tierBreakdown.push({
        tierId: tier.id,
        tierName: tier.name,
        price: tier.price,
        quota: tier.quota,
        soldCount,
        remainingQuota,
        revenue,
        organizerRevenue,
        isSoldOut,
      });
    }

    const nonTierBookings = paidBookings.filter((b) => !b.ticketTierId || !knownTierIds.has(b.ticketTierId));
    if (nonTierBookings.length > 0) {
      const soldCount = nonTierBookings.reduce((sum, b) => sum + (b.ticketCount || 1), 0);
      const revenue = nonTierBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
      const organizerRevenue = nonTierBookings.reduce(
        (sum, b) => sum + (b.organizerRevenueAmount ?? Math.round((b.totalPrice || 0) * 0.8)),
        0
      );
      tierBreakdown.push({
        tierId: "other",
        tierName: nonTierBookings.some((b) => b.isInvitation) ? "Tiket Undangan" : "Standar / Lainnya",
        price: 0,
        quota: soldCount,
        soldCount,
        remainingQuota: 0,
        revenue,
        organizerRevenue,
        isSoldOut: true,
      });
    }
  } else {
    const isFree = !event.isPaid || event.price === 0;
    tierBreakdown.push({
      tierId: "default",
      tierName: isFree ? "Tiket Masuk (Gratis)" : "Tiket Masuk (Reguler)",
      price: event.price || 0,
      quota: totalCapacity,
      soldCount: totalTicketsSold,
      remainingQuota: remainingCapacity,
      revenue: totalRevenue,
      organizerRevenue: organizerEarnings,
      isSoldOut: totalCapacity > 0 && totalTicketsSold >= totalCapacity,
    });
  }

  return {
    eventId: event.id,
    eventTitle: event.title,
    totalCapacity,
    totalTicketsSold,
    remainingCapacity,
    occupancyRate,
    totalRevenue,
    organizerEarnings,
    tierBreakdown,
    attendeeCount: paidBookings.length,
    isSoldOut: totalCapacity > 0 && totalTicketsSold >= totalCapacity,
  };
}
