import type { EventCategory, PublicCommunityEvent } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";

// Reuse event category label from existing landing/admin domain logic
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
] as const;

/**
 * Pisahkan dan urutkan event mendatang (terdekat dulu) vs selesai (terbaru selesai dulu).
 * Fungsi murni tanpa mutasi input.
 */
export function sortPublicEvents(
  events: readonly PublicCommunityEvent[],
  tab: EventTimeTab,
  nowMs: number = Date.now()
): PublicCommunityEvent[] {
  const isPast = (e: PublicCommunityEvent) => {
    const end = new Date(e.endDate).getTime();
    return !Number.isNaN(end) && end < nowMs;
  };

  if (tab === "PAST") {
    return events
      .filter(isPast)
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
  }

  // Upcoming
  return events
    .filter((e) => !isPast(e))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

/**
 * Filter event publik berdasarkan tab waktu, kategori, filter harga, dan pencarian kata kunci.
 */
export function filterPublicEvents(
  events: readonly PublicCommunityEvent[],
  tab: EventTimeTab,
  category: string,
  priceFilter: EventPriceFilter,
  searchQuery: string,
  nowMs: number = Date.now()
): PublicCommunityEvent[] {
  const basePool = sortPublicEvents(events, tab, nowMs);
  const q = searchQuery.trim().toLowerCase();

  return basePool.filter((evt) => {
    const matchesCategory = category === "ALL" || evt.category === category;
    const matchesPrice =
      priceFilter === "ALL" ||
      (priceFilter === "FREE" && (!evt.isPaid || evt.price === 0)) ||
      (priceFilter === "PAID" && evt.isPaid && evt.price > 0);

    const matchesSearch =
      !q ||
      evt.title.toLowerCase().includes(q) ||
      (evt.description && evt.description.toLowerCase().includes(q)) ||
      (evt.location && evt.location.toLowerCase().includes(q)) ||
      (evt.organizerName && evt.organizerName.toLowerCase().includes(q));

    return matchesCategory && matchesPrice && matchesSearch;
  });
}

/**
 * Format label harga yang ramah dan konsisten.
 */
export function eventPriceLabel(isPaid?: boolean, price?: number): string {
  if (!isPaid || !price || price === 0) {
    return "Gratis";
  }
  return formatCurrencyIDR(price);
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
