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
