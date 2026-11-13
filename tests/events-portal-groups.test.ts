import { describe, expect, it } from "vitest";

import {
  checkedInGuests,
  eventBalances,
  pendingAction,
  groupOrganizerEvents,
  organizerSharePercent,
} from "@/features/events-portal/events-portal-groups";
import type { CommunityEvent, EventTicketOrder, PayoutRecord } from "@/types/event";

const NOW = new Date("2026-11-13T04:00:00.000Z");

function event(overrides: Partial<CommunityEvent>): CommunityEvent {
  return {
    id: "evt",
    title: "Workshop",
    category: "WORKSHOP",
    description: "",
    startDate: "2026-11-20T02:00:00.000Z",
    endDate: "2026-11-20T05:00:00.000Z",
    location: "Hall",
    isPaid: true,
    price: 50000,
    posterUrl: "",
    organizerName: "Komunitas",
    organizerEmail: "o@example.test",
    organizerPhone: "08",
    status: "APPROVED",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

function booking(overrides: Partial<EventTicketOrder>): EventTicketOrder {
  return {
    id: "b",
    ticketCode: "T",
    eventId: "evt",
    eventTitle: "Workshop",
    eventDate: "",
    eventLocation: "",
    guestName: "Tamu",
    guestEmail: "t@example.test",
    guestPhone: "08",
    ticketCount: 1,
    unitPrice: 100000,
    totalPrice: 100000,
    platformFeePercent: 15,
    platformFeeAmount: 15000,
    organizerRevenueAmount: 85000,
    paymentMethod: "QRIS",
    paymentStatus: "PAID",
    checkInStatus: "REGISTERED",
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function payout(overrides: Partial<PayoutRecord>): PayoutRecord {
  return { id: "p", amount: 10000, status: "PAID", requestedAt: "2026-11-02T00:00:00.000Z", ...overrides } as PayoutRecord;
}

describe("groupOrganizerEvents", () => {
  it("puts revision requests and admin split proposals under needs action", () => {
    const groups = groupOrganizerEvents(
      [
        event({ id: "rev", status: "REVISION_REQUESTED" }),
        event({
          id: "split",
          proposedRevenueSplit: { organizerPercent: 75, platformPercent: 25, proposedBy: "ADMIN", status: "PENDING" },
        }),
      ],
      NOW,
    );
    expect(groups.needsAction.map((e) => e.id)).toEqual(["rev", "split"]);
    expect(groups.upcoming).toEqual([]);
  });

  it("keeps the organizer's own pending split proposal in review, not in needs action", () => {
    const groups = groupOrganizerEvents(
      [
        event({
          id: "mine",
          proposedRevenueSplit: { organizerPercent: 90, platformPercent: 10, proposedBy: "ORGANIZER", status: "PENDING" },
        }),
      ],
      NOW,
    );
    expect(groups.needsAction).toEqual([]);
    expect(groups.upcoming.map((e) => e.id)).toEqual(["mine"]);
  });

  it("splits approved events into upcoming and past by end date, and sends pending to review", () => {
    const groups = groupOrganizerEvents(
      [
        event({ id: "late", startDate: "2026-12-01T02:00:00.000Z", endDate: "2026-12-01T05:00:00.000Z" }),
        event({ id: "soon" }),
        event({ id: "old", endDate: "2026-10-01T05:00:00.000Z" }),
        event({ id: "wait", status: "PENDING" }),
        event({ id: "no", status: "REJECTED" }),
        event({ id: "arch", status: "ARCHIVED" }),
      ],
      NOW,
    );
    expect(groups.upcoming.map((e) => e.id)).toEqual(["soon", "late"]);
    expect(groups.inReview.map((e) => e.id)).toEqual(["wait"]);
    expect(groups.past.map((e) => e.id).sort()).toEqual(["arch", "no", "old"]);
  });
});

describe("groupOrganizerEvents with lapsed submissions", () => {
  it("moves a pending or revision event whose date has passed to past", () => {
    const groups = groupOrganizerEvents(
      [
        event({ id: "lapsed", status: "PENDING", endDate: "2026-10-01T05:00:00.000Z" }),
        event({ id: "lapsed-rev", status: "REVISION_REQUESTED", endDate: "2026-10-01T05:00:00.000Z" }),
      ],
      NOW,
    );
    expect(groups.past.map((e) => e.id)).toEqual(["lapsed", "lapsed-rev"]);
    expect(groups.needsAction).toEqual([]);
    expect(groups.inReview).toEqual([]);
  });
});

describe("organizerSharePercent", () => {
  it("uses the event's agreed organizer share, then the platform override, then 80", () => {
    expect(organizerSharePercent(event({ organizerFeePercent: 85 }))).toBe(85);
    expect(organizerSharePercent(event({ customPlatformFeePercent: 10 }))).toBe(90);
    expect(organizerSharePercent(event({}))).toBe(80);
  });
});

describe("eventBalances", () => {
  it("sums the organizer revenue actually recorded on paid tickets, minus committed payouts", () => {
    const events = [
      event({ id: "a", organizerFeePercent: 85, payoutHistory: [payout({ amount: 20000, status: "PAID" }), payout({ id: "q", amount: 5000, status: "REQUESTED" }), payout({ id: "r", amount: 9999, status: "REJECTED" })] }),
      event({ id: "b", title: "Meetup" }),
    ];
    const bookings = [
      booking({ eventId: "a" }),
      booking({ id: "b2", eventId: "a", paymentStatus: "PENDING" }),
      booking({ id: "b3", eventId: "b", totalPrice: 50000, organizerRevenueAmount: 40000 }),
    ];
    const result = eventBalances(events, bookings);
    expect(result.rows[0]).toMatchObject({ eventId: "a", gross: 100000, earnings: 85000, paidOut: 20000, pending: 5000, available: 60000, sharePercent: 85 });
    expect(result.rows[1]).toMatchObject({ eventId: "b", earnings: 40000, available: 40000 });
    expect(result.totals).toEqual({ gross: 150000, earnings: 125000, paidOut: 20000, pending: 5000, available: 100000 });
  });

  it("never reports a negative balance", () => {
    const result = eventBalances([event({ payoutHistory: [payout({ amount: 999999 })] })], []);
    expect(result.rows[0].available).toBe(0);
  });
});

describe("checkedInGuests", () => {
  it("counts checked-in seats on paid tickets, falling back to the whole order when fully checked in", () => {
    const bookings = [
      booking({ ticketCount: 3, checkedInQty: 2 }),
      booking({ id: "b2", ticketCount: 2, checkInStatus: "CHECKED_IN" }),
      booking({ id: "b3", ticketCount: 4, checkedInQty: 4, paymentStatus: "PENDING" }),
      booking({ id: "b4", eventId: "other", checkedInQty: 1 }),
    ];
    expect(checkedInGuests("evt", bookings)).toBe(4);
  });
});

describe("pendingAction", () => {
  it("names the organizer's next step", () => {
    expect(pendingAction(event({ status: "REVISION_REQUESTED" }))).toBe("revision");
    expect(
      pendingAction(event({ proposedRevenueSplit: { organizerPercent: 70, platformPercent: 30, proposedBy: "ADMIN", status: "PENDING" } })),
    ).toBe("split");
    expect(pendingAction(event({}))).toBeNull();
  });
});
