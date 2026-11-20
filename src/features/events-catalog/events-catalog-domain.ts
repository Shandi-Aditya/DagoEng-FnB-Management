import type { EventTicketTier, PublicCommunityEvent } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";
import { isEventInWitaPeriod, type DateRange } from "@/components/events/EventDateRangeFilter";

export { eventCategoryLabel } from "@/features/landing/landing-logic";

export type EventTimeTab = "UPCOMING" | "PAST";
export type EventPriceFilter = "ALL" | "FREE" | "PAID";

export const CATALOG_CATEGORIES: readonly { key: string; label: string }[] = [
  { key: "ALL", label: "Semua kategori" },
  { key: "WORKSHOP", label: "Workshop" },
  { key: "MEETUP", label: "Meetup" },
  { key: "CREATIVE", label: "Kreatif" },
  { key: "TECH", label: "Teknologi" },
  { key: "COMMUNITY", label: "Komunitas" },
  { key: "SEMINAR", label: "Seminar" },
  { key: "OTHER", label: "Lainnya" },
] as const;

export function resolveEventEffectiveMinPrice(
  evt: Pick<PublicCommunityEvent, "isPaid" | "price" | "ticketTiers">
): number {
  if (!isEventPaidEffective(evt)) return 0;
  if (evt.ticketTiers && evt.ticketTiers.length > 0) {
    const paidTiers = evt.ticketTiers.filter(
      (tier) => tier.isActive !== false && tier.price > 0
    );
    if (paidTiers.length === 0) return 0;
    return Math.min(...paidTiers.map((tier) => tier.price));
  }
  return evt.price > 0 ? evt.price : 0;
}

export function sortPublicEvents(
  events: readonly PublicCommunityEvent[],
  tab: EventTimeTab,
  nowMs: number = Date.now()
): PublicCommunityEvent[] {
  const isPast = (e: PublicCommunityEvent) => {
    const end = new Date(e.endDate || e.startDate).getTime();
    return !Number.isNaN(end) && end < nowMs;
  };

  if (tab === "PAST") {
    return events
      .filter(isPast)
      .sort((a, b) => new Date(b.endDate || b.startDate).getTime() - new Date(a.endDate || a.startDate).getTime());
  }

  return events
    .filter((e) => !isPast(e))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

export function filterPublicEvents(
  events: readonly PublicCommunityEvent[],
  tab: EventTimeTab,
  category: string,
  priceFilter: EventPriceFilter,
  searchQuery: string,
  nowMs: number = Date.now(),
  dateRange?: DateRange | null
): PublicCommunityEvent[] {
  const basePool = sortPublicEvents(events, tab, nowMs);
  const q = searchQuery.trim().toLowerCase();

  return basePool.filter((evt) => {
    const matchesCategory = category === "ALL" || evt.category === category;
    const isPaid = isEventPaidEffective(evt);
    const matchesPrice =
      priceFilter === "ALL" ||
      (priceFilter === "FREE" && !isPaid) ||
      (priceFilter === "PAID" && isPaid);

    if (dateRange && !isEventInWitaPeriod(evt, dateRange)) {
      return false;
    }

    const matchesSearch =
      !q ||
      (evt.title || "").toLowerCase().includes(q) ||
      Boolean(evt.description && evt.description.toLowerCase().includes(q)) ||
      Boolean(evt.location && evt.location.toLowerCase().includes(q)) ||
      Boolean(evt.organizerName && evt.organizerName.toLowerCase().includes(q));

    return matchesCategory && matchesPrice && matchesSearch;
  });
}

export function isEventPaidEffective(
  event?: {
    isPaid?: boolean;
    price?: number;
    ticketTiers?: readonly Pick<EventTicketTier, "price" | "isActive">[] | null;
  } | null
): boolean {
  if (!event) return false;
  if (event.ticketTiers && event.ticketTiers.length > 0) {
    return event.ticketTiers.some((t) => t.isActive !== false && Number(t.price) > 0);
  }
  return Boolean(event.isPaid && Number(event.price) > 0);
}

export function formatEventPriceSummary(
  event?: {
    isPaid?: boolean;
    price?: number;
    ticketTiers?: readonly Pick<EventTicketTier, "price" | "isActive">[] | null;
  } | null
): string {
  if (!event || !isEventPaidEffective(event)) {
    return "Gratis";
  }
  if (event.ticketTiers && event.ticketTiers.length > 0) {
    const activeTiers = event.ticketTiers.filter((tier) => tier.isActive !== false);
    const hasFree = activeTiers.some((t) => Number(t.price) === 0);
    const paidTiers = activeTiers.filter((tier) => Number(tier.price) > 0);
    if (paidTiers.length === 0) {
      return "Gratis";
    }
    const prices = paidTiers.map((t) => Number(t.price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    if (hasFree) {
      return `Gratis & Berbayar (Mulai ${formatCurrencyIDR(minPrice)})`;
    }
    if (minPrice !== maxPrice) {
      return `Mulai dari ${formatCurrencyIDR(minPrice)}`;
    }
    return formatCurrencyIDR(minPrice);
  }
  return formatCurrencyIDR(Number(event.price) || 0);
}

export function eventPriceLabel(
  isPaid?: boolean,
  price?: number,
  ticketTiers?: readonly Pick<EventTicketTier, "price" | "isActive">[]
): string {
  return formatEventPriceSummary({ isPaid, price, ticketTiers });
}

/**
 * Format jadwal event lengkap dengan zona waktu WITA.
 */
export function formatEventSchedule(startDateStr: string, endDateStr?: string): string {
  try {
    const start = new Date(startDateStr);
    const dateFormatted = start.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Makassar",
    });
    const startTime = start.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Makassar",
    });

    if (endDateStr) {
      const end = new Date(endDateStr);
      const endTime = end.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Makassar",
      });
      return `${dateFormatted}, ${startTime} – ${endTime} WITA`;
    }

    return `${dateFormatted}, ${startTime} WITA`;
  } catch {
    return startDateStr;
  }
}

/**
 * Parse bagian tanggal untuk tampilan kalender kartu.
 */
export function parseEventDateBadge(isoStr: string): { month: string; day: string } {
  try {
    const d = new Date(isoStr);
    const month = d.toLocaleDateString("id-ID", { month: "short", timeZone: "Asia/Makassar" });
    const day = d.toLocaleDateString("id-ID", { day: "numeric", timeZone: "Asia/Makassar" });
    return { month, day };
  } catch {
    return { month: "—", day: "--" };
  }
}

/**
 * Pesan keadaan kosong yang jujur.
 */
export function emptyCatalogMessage(
  tab: EventTimeTab,
  hasFilter: boolean
): { title: string; description: string } {
  if (hasFilter) {
    return {
      title: "Tidak ada event yang cocok",
      description: "Ubah kata kunci pencarian atau sesuaikan filter kategori dan harga.",
    };
  }

  if (tab === "PAST") {
    return {
      title: "Belum ada arsip event",
      description: "Event yang telah selesai dilaksanakan akan tersimpan di sini.",
    };
  }

  return {
    title: "Belum ada event mendatang",
    description: "Nantikan jadwal kegiatan komunitas berikutnya di Dago Creative Hub.",
  };
}
