import { describe, expect, it } from "vitest";

import {
  checkedInGuests,
  eventBalances,
  pendingAction,
  groupOrganizerEvents,
  organizerSharePercent,
} from "@/features/events-portal/events-portal-groups";
import { getEventEffectivePlatformFeePercent } from "@/lib/events";
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

describe("organizerSharePercent SSOT & Strict Validation", () => {
  it("resolves default fee 20% to organizer 80%", () => {
    const e = event({});
    expect(organizerSharePercent(e)).toBe(80);
    expect(organizerSharePercent(e)).toBe(100 - getEventEffectivePlatformFeePercent(e));
  });

  it("resolves custom fee 0% to organizer 100%", () => {
    const e = event({ customPlatformFeePercent: 0 });
    expect(organizerSharePercent(e)).toBe(100);
    expect(organizerSharePercent(e)).toBe(100 - getEventEffectivePlatformFeePercent(e));
  });

  it("resolves custom fee 10% to organizer 90%", () => {
    const e = event({ customPlatformFeePercent: 10 });
    expect(organizerSharePercent(e)).toBe(90);
    expect(organizerSharePercent(e)).toBe(100 - getEventEffectivePlatformFeePercent(e));
  });

  it("resolves custom fee 50% to organizer 50%", () => {
    const e = event({ customPlatformFeePercent: 50 });
    expect(organizerSharePercent(e)).toBe(50);
    expect(organizerSharePercent(e)).toBe(100 - getEventEffectivePlatformFeePercent(e));
  });

  it("strictly rejects decimal fee without rounding or clamping", () => {
    const e1 = event({ customPlatformFeePercent: 10.5 });
    expect(() => organizerSharePercent(e1)).toThrow(/tanpa pecahan desimal|tanpa desimal/);
    expect(() => getEventEffectivePlatformFeePercent(e1)).toThrow(/tanpa pecahan desimal|tanpa desimal/);

    const e2 = event({ customPlatformFeePercent: 0.1 });
    expect(() => organizerSharePercent(e2)).toThrow(/tanpa pecahan desimal|tanpa desimal/);
  });

  it("strictly rejects NaN and Infinity fee", () => {
    const eNaN = event({ customPlatformFeePercent: NaN });
    expect(() => organizerSharePercent(eNaN)).toThrow(/angka yang valid/);
    expect(() => getEventEffectivePlatformFeePercent(eNaN)).toThrow(/angka yang valid/);

    const eInf = event({ customPlatformFeePercent: Infinity });
    expect(() => organizerSharePercent(eInf)).toThrow(/angka yang valid/);
  });

  it("strictly rejects fee below 0% and above 50%", () => {
    const eNegative = event({ customPlatformFeePercent: -5 });
    expect(() => organizerSharePercent(eNegative)).toThrow(/0% hingga 50%/);
    expect(() => getEventEffectivePlatformFeePercent(eNegative)).toThrow(/0% hingga 50%/);

    const eTooHigh = event({ customPlatformFeePercent: 51 });
    expect(() => organizerSharePercent(eTooHigh)).toThrow(/0% hingga 50%/);
    expect(() => getEventEffectivePlatformFeePercent(eTooHigh)).toThrow(/0% hingga 50%/);
  });

  it("ensures legacy organizerFeePercent does NOT override backend default", () => {
    // When customPlatformFeePercent is absent, backend default (20% fee -> 80% organizer) is strictly applied
    // and legacy organizerFeePercent (e.g. 70 or 85) does not defeat backend default
    const e = event({ customPlatformFeePercent: null, organizerFeePercent: 70 });
    expect(organizerSharePercent(e)).toBe(80);
    expect(organizerSharePercent(e)).toBe(100 - getEventEffectivePlatformFeePercent(e));
  });

  it("ensures legacy organizerFeePercent does NOT override customPlatformFeePercent", () => {
    // customPlatformFeePercent is 10% (organizer 90%), even if legacy organizerFeePercent is 75%
    const e = event({ customPlatformFeePercent: 10, organizerFeePercent: 75 });
    expect(organizerSharePercent(e)).toBe(90);
    expect(organizerSharePercent(e)).toBe(100 - getEventEffectivePlatformFeePercent(e));
  });

  it("frontend and backend produce identical results across all boundary matrix", () => {
    const testCases = [
      { custom: 0, expectedOrg: 100 },
      { custom: 1, expectedOrg: 99 },
      { custom: 20, expectedOrg: 80 },
      { custom: 35, expectedOrg: 65 },
      { custom: 50, expectedOrg: 50 },
    ];

    for (const tc of testCases) {
      const e = event({ customPlatformFeePercent: tc.custom });
      const fe = organizerSharePercent(e);
      const be = 100 - getEventEffectivePlatformFeePercent(e);
      expect(fe).toBe(tc.expectedOrg);
      expect(be).toBe(tc.expectedOrg);
      expect(fe).toBe(be);
    }
  });
});

describe("eventBalances", () => {
  it("sums the organizer revenue actually recorded on paid tickets, minus committed payouts", () => {
    const events = [
      event({ id: "a", customPlatformFeePercent: 15, organizerFeePercent: 85, payoutHistory: [payout({ amount: 20000, status: "PAID" }), payout({ id: "q", amount: 5000, status: "REQUESTED" }), payout({ id: "r", amount: 9999, status: "REJECTED" })] }),
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
