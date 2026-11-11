import { describe, expect, it } from "vitest";

import { accountRoleLabel, canOpenDashboard, eventCategoryLabel, selectUpcomingEvents } from "@/features/landing/landing-logic";
import type { PublicCommunityEvent } from "@/types/event";

const NOW = new Date("2026-11-11T10:00:00Z").getTime();

function event(id: string, startDate: string, endDate: string, status = "APPROVED"): PublicCommunityEvent {
  return {
    id,
    title: id,
    category: "WORKSHOP",
    description: "",
    startDate,
    endDate,
    location: "Singaraja",
    isPaid: false,
    price: 0,
    posterUrl: "",
    organizerName: "Komunitas",
    status,
    createdAt: startDate,
  } as PublicCommunityEvent;
}

describe("selectUpcomingEvents", () => {
  it("keeps approved events that have not ended, sorted by start date", () => {
    const events = [
      event("later", "2026-11-20T10:00:00Z", "2026-11-20T12:00:00Z"),
      event("ongoing", "2026-11-11T08:00:00Z", "2026-11-11T12:00:00Z"),
      event("ended", "2026-11-01T08:00:00Z", "2026-11-01T12:00:00Z"),
      event("pending", "2026-11-15T08:00:00Z", "2026-11-15T12:00:00Z", "PENDING"),
    ];

    expect(selectUpcomingEvents(events, NOW).map((e) => e.id)).toEqual(["ongoing", "later"]);
  });

  it("ignores events with an unparseable end date", () => {
    expect(selectUpcomingEvents([event("bad", "2026-11-20T10:00:00Z", "not-a-date")], NOW)).toEqual([]);
  });

  it("limits the result and leaves the input untouched", () => {
    const events = ["a", "b", "c", "d"].map((id, i) =>
      event(id, `2026-11-2${i}T10:00:00Z`, `2026-11-2${i}T12:00:00Z`),
    );
    const snapshot = events.map((e) => e.id);

    expect(selectUpcomingEvents(events, NOW, 3).map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(events.map((e) => e.id)).toEqual(snapshot);
  });
});

describe("account helpers", () => {
  it("labels owners and customers in plain words, else falls back to the role name", () => {
    expect(accountRoleLabel({ slug: "OWNER", name: "Owner" })).toBe("Owner");
    expect(accountRoleLabel({ slug: "CUSTOMER", name: "Customer" })).toBe("Member");
    expect(accountRoleLabel({ slug: "CASHIER", name: "Kasir" })).toBe("Kasir");
    expect(accountRoleLabel(undefined)).toBe("Pengguna");
  });

  it("offers the dashboard only to owners, super admins and managers", () => {
    expect(canOpenDashboard("OWNER")).toBe(true);
    expect(canOpenDashboard("SUPER_ADMIN")).toBe(true);
    expect(canOpenDashboard("MANAGER")).toBe(true);
    expect(canOpenDashboard("CUSTOMER")).toBe(false);
    expect(canOpenDashboard(undefined)).toBe(false);
  });
});

describe("eventCategoryLabel", () => {
  it("shows a readable label instead of the raw enum", () => {
    expect(eventCategoryLabel("OTHER")).toBe("Lainnya");
    expect(eventCategoryLabel("TECH")).toBe("Teknologi");
  });
});
