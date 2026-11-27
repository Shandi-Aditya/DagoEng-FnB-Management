import type { CoworkingSpaceItem, SpaceType } from "@/types/coworking";
import type { EventCategory, PublicCommunityEvent } from "@/types/event";
import { formatEventPriceSummary } from "@/features/events-catalog/events-catalog-domain";

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
    price: formatEventPriceSummary(event),
    ticket: availability ? (availability.isSoldOut ? "habis" : "tersedia") : null,
  };
}

export interface LandingWorkspaceRow {
  id: string;
  name: string;
  line: string;
  price: string;
}

export const PRIMARY_LANDING_SPACE_TYPES: readonly SpaceType[] = [
  "OPEN_SPACE",
  "SPACE_MONITOR",
  "SMALL_MEETING_ROOM",
  "LARGE_MEETING_ROOM",
];

/** Formats a positive IDR amount with Indonesian thousands separators for public landing cards. */
export function formatLandingRupiah(amount: number): string {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
  return `Rp ${safeAmount.toLocaleString("id-ID")}`;
}

/**
 * Picks the 4 canonical Dago Creative Hub spaces in display order from live or seed spaces,
 * ignoring deprecated legacy entries while reflecting admin edits to name or hourlyRate.
 */
export function selectLandingWorkspaces(
  spaces: readonly CoworkingSpaceItem[],
  fallback: readonly LandingWorkspaceRow[] = [],
): LandingWorkspaceRow[] {
  if (!Array.isArray(spaces) || spaces.length === 0) {
    return [...fallback];
  }

  const picked: CoworkingSpaceItem[] = [];
  for (const spaceType of PRIMARY_LANDING_SPACE_TYPES) {
    const match = spaces.find(
      (space) => space.type === spaceType && typeof space.hourlyRate === "number" && space.hourlyRate > 0,
    );
    if (match) picked.push(match);
  }

  const source =
    picked.length > 0
      ? picked
      : spaces.filter((space) => typeof space.hourlyRate === "number" && space.hourlyRate > 0).slice(0, 4);

  if (source.length === 0) {
    return [...fallback];
  }

  return source.map((space) => ({
    id: space.id,
    name: space.name,
    line: space.description || space.area,
    price: formatLandingRupiah(space.hourlyRate),
  }));
}

interface TenantLike {
  id?: string;
  name?: string;
  status?: string;
}

interface TenantProfileLike {
  brandName?: string;
  status?: string;
}

/** Returns deduplicated active partner kitchen names from live tenant state or seed fallback. */
export function selectLandingKitchens(
  tenants: readonly TenantLike[],
  profiles?: Record<string, TenantProfileLike | undefined>,
  fallback: readonly string[] = [],
): string[] {
  if (!Array.isArray(tenants) || tenants.length === 0) {
    return [...fallback];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const tenant of tenants) {
    const profile = tenant.id ? profiles?.[tenant.id] : undefined;
    const status = profile?.status ?? tenant.status;
    if (status && status !== "ACTIVE") continue;

    const rawName = profile?.brandName || tenant.name || "";
    const trimmed = rawName.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result.length > 0 ? result : [...fallback];
}

export const FEATURED_LANDING_PRODUCT_IDS = ["prod-101", "prod-103", "prod-104"] as const;

/** Builds display name + formatted IDR price pairs for featured catalog products by ID. */
export function selectLandingFeaturedProducts(
  products: readonly { id: string; name: string; basePrice: number }[],
  ids: readonly string[] = FEATURED_LANDING_PRODUCT_IDS,
): { name: string; price: string }[] {
  return ids
    .map((id) => {
      const product = products.find((item) => item.id === id);
      return product ? { name: product.name, price: formatLandingRupiah(product.basePrice) } : null;
    })
    .filter((row): row is { name: string; price: string } => row !== null);
}
