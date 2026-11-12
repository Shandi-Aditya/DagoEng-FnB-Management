import type { EventCategory, PublicCommunityEvent } from "@/types/event";

const DEFAULT_EVENT_LIMIT = 3;
const DASHBOARD_ROLES = new Set(["OWNER", "SUPER_ADMIN", "MANAGER"]);

interface RoleLike {
  slug?: string;
  name?: string;
}

/** Approved events that have not ended yet, earliest first. `filter` copies, so the input is never sorted in place. */
export function selectUpcomingEvents(
  events: readonly PublicCommunityEvent[],
  nowMs: number,
  limit: number = DEFAULT_EVENT_LIMIT,
): PublicCommunityEvent[] {
  return events
    .filter((event) => {
      if (event.status !== "APPROVED") return false;
      const endMs = new Date(event.endDate).getTime();
      return !Number.isNaN(endMs) && endMs >= nowMs;
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, limit);
}

/** Short role label for the account menu. */
export function accountRoleLabel(role: RoleLike | undefined): string {
  if (role?.slug === "OWNER") return "Owner";
  if (role?.slug === "CUSTOMER") return "Member";
  return role?.name || role?.slug || "Pengguna";
}

/** Whether the account menu should link to the management dashboard. */
export function canOpenDashboard(roleSlug: string | undefined): boolean {
  return roleSlug !== undefined && DASHBOARD_ROLES.has(roleSlug);
}

const EVENT_CATEGORY_LABEL: Record<EventCategory, string> = {
  WORKSHOP: "Workshop",
  MEETUP: "Meetup",
  CREATIVE: "Kreatif",
  COMMUNITY: "Komunitas",
  TECH: "Teknologi",
  SEMINAR: "Seminar",
  OTHER: "Lainnya",
};

/** Readable Indonesian label for an event category. */
export function eventCategoryLabel(category: EventCategory): string {
  return EVENT_CATEGORY_LABEL[category];
}

const WITA = "Asia/Makassar";

export interface EventNoticeRow {
  day: string;
  month: string;
  /** Short weekday and start time, e.g. "Jum, 10.00". */
  time: string;
  price: string;
  /** Null when the server does not report capacity. */
  ticket: "tersedia" | "habis" | null;
}

function datePart(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("id-ID", { ...options, timeZone: WITA }).format(date);
}

/** One row on the landing page's event notice board. */
export function eventNoticeRow(event: PublicCommunityEvent): EventNoticeRow {
  const start = new Date(event.startDate);
  const weekday = datePart(start, { weekday: "short" });
  const hour = datePart(start, { hour: "2-digit", minute: "2-digit", hour12: false });
  const availability = event.availability;

  return {
    day: datePart(start, { day: "numeric" }),
    month: datePart(start, { month: "short" }),
    time: `${weekday}, ${hour}`,
    price: event.isPaid && event.price > 0 ? `Rp ${event.price.toLocaleString("id-ID")}` : "Gratis",
    ticket: availability ? (availability.isSoldOut ? "habis" : "tersedia") : null,
  };
}
