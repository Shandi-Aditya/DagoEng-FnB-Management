import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { POST as postCoworkingBookings } from "@/app/api/coworking/bookings/route";
import { CONTACT, HERO } from "@/features/landing/landing-content";
import { HOURS } from "@/features/landing/home/home-content";
import { DAGO_SPACES, INITIAL_SPACES, MEMBERSHIP_PLANS } from "@/features/coworking/coworking-data";
import {
  getCoworkingStartSlots,
  getNextOpenCoworkingDate,
  isWithinCoworkingHours,
  validateCoworkingBookingSchedule,
} from "@/lib/operating-hours";
import { accountRoleLabel, canOpenDashboard, eventCategoryLabel, eventNoticeRow, selectUpcomingEvents } from "@/features/landing/landing-logic";
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

describe("eventNoticeRow", () => {
  it("splits the start date into day, month and time in WITA", () => {
    const row = eventNoticeRow(event("e", "2026-11-20T02:00:00Z", "2026-11-20T04:00:00Z"));

    expect(row.day).toBe("20");
    expect(row.month).toBe("Nov");
    expect(row.time).toBe("Jum, 10.00");
  });

  it("labels free and paid events", () => {
    expect(eventNoticeRow(event("free", "2026-11-20T02:00:00Z", "2026-11-20T04:00:00Z")).price).toBe("Gratis");
    const paid = { ...event("paid", "2026-11-20T02:00:00Z", "2026-11-20T04:00:00Z"), isPaid: true, price: 75000 };
    expect(eventNoticeRow(paid).price).toBe("Rp 75.000");
  });

  it("reports ticket availability only when the server knows it", () => {
    const base = event("e", "2026-11-20T02:00:00Z", "2026-11-20T04:00:00Z");
    const availability = { totalCapacity: 10, ticketsReserved: 10, ticketsRemaining: 0, occupancyRate: 1, isConfirmed: true, capacitySource: "", capacityDescription: "", isSoldOut: true };

    expect(eventNoticeRow(base).ticket).toBeNull();
    expect(eventNoticeRow({ ...base, availability }).ticket).toBe("habis");
    expect(eventNoticeRow({ ...base, availability: { ...availability, isSoldOut: false, ticketsRemaining: 3 } }).ticket).toBe("tersedia");
  });
});

describe("HERO copywriting", () => {
  it("uses 'event' instead of 'kumpul' in the hero headline", () => {
    expect(HERO.title.toLowerCase()).toContain("event");
    expect(HERO.title.toLowerCase()).not.toContain("kumpul");
  });
});

describe("Dago Creative Hub and coworking office hours", () => {
  it("displays Monday to Friday 09.00 to 18.00 WITA office hours in landing content and footer", () => {
    expect(HOURS).toBe("Senin sampai Jumat, 09.00 sampai 18.00 WITA");
    expect(CONTACT.hours).toBe("Senin sampai Jumat, 09.00 sampai 18.00 WITA");
  });

  it("aligns all 7 coworking plans and Dago space amenities with Senin - Jumat 09:00 - 18:00 WITA", () => {
    expect(MEMBERSHIP_PLANS).toHaveLength(7);
    const expectedIds = [
      "plan-os-1w",
      "plan-os-2w",
      "plan-os-1m",
      "plan-smr-2w",
      "plan-smr-1m",
      "plan-lmr-2w",
      "plan-lmr-1m",
    ];
    expect(MEMBERSHIP_PLANS.map((p) => p.id)).toEqual(expectedIds);

    for (const plan of MEMBERSHIP_PLANS) {
      expect(plan.deskAccess).toContain("Senin - Jumat");
      expect(plan.deskAccess).toContain("09:00 - 18:00 WITA");
      expect(plan.deskAccess).not.toContain("24/7");
    }

    expect(DAGO_SPACES).toHaveLength(4);
    for (const space of INITIAL_SPACES) {
      expect(space.amenities.join(" ")).not.toContain("24/7");
    }
  });

  it("enforces Monday-Friday workdays and 09:00 to 18:00 WITA coworking bounds across helpers and API", async () => {
    expect(getCoworkingStartSlots(1)).toEqual([
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
    ]);
    expect(getCoworkingStartSlots(2)).toEqual([
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
    ]);
    expect(isWithinCoworkingHours("09:00", 9)).toBe(true);
    expect(isWithinCoworkingHours("17:00", 1)).toBe(true);
    expect(isWithinCoworkingHours("08:00", 1)).toBe(false);
    expect(isWithinCoworkingHours("17:00", 2)).toBe(false);
    expect(isWithinCoworkingHours("18:00", 1)).toBe(false);

    expect(getNextOpenCoworkingDate("2026-11-18")).toBe("2026-11-18");
    expect(getNextOpenCoworkingDate("2026-11-21")).toBe("2026-11-23");
    expect(getNextOpenCoworkingDate("2026-11-22")).toBe("2026-11-23");

    expect(
      validateCoworkingBookingSchedule({
        bookingType: "HOURLY",
        date: "2026-11-21",
        startTime: "10:00",
        duration: 2,
      }).isValid
    ).toBe(false);

    expect(
      validateCoworkingBookingSchedule({
        bookingType: "MONTHLY",
        date: "2026-11-18",
        endDate: "2026-12-17",
      }).isValid
    ).toBe(true);

    const saturdayReq = new NextRequest("http://localhost:3000/api/coworking/bookings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CUSTOMER_DEMO",
      },
      body: JSON.stringify({
        spaceId: "sp-hot-1",
        guestName: "Weekend Caller",
        bookingType: "HOURLY",
        date: "2026-11-21",
        startTime: "10:00 WITA",
        duration: 2,
        totalAmount: 30000,
      }),
    });
    expect((await postCoworkingBookings(saturdayReq)).status).toBe(400);

    const afterHoursReq = new NextRequest("http://localhost:3000/api/coworking/bookings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CUSTOMER_DEMO",
      },
      body: JSON.stringify({
        spaceId: "sp-hot-1",
        guestName: "Evening Caller",
        bookingType: "HOURLY",
        date: "2026-11-18",
        startTime: "17:00 WITA",
        duration: 2,
        totalAmount: 30000,
      }),
    });
    expect((await postCoworkingBookings(afterHoursReq)).status).toBe(400);
  });
});

