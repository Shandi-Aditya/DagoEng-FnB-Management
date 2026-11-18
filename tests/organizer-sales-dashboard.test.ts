import { describe, it, expect } from "vitest";
import type { CommunityEvent, EventTicketOrder } from "@/types/event";
import {
  calculateEventSalesSummary,
  filterOrganizerAttendees,
  calculateOrganizerEventMetrics,
} from "@/features/events-portal/events-portal-domain";

describe("organizer-sales-dashboard (Task S-15)", () => {
  const multiTierEvent: CommunityEvent = {
    id: "evt-multi-1",
    title: "Dago Tech Conference 2026",
    description: "Konferensi teknologi terbesar di Dago",
    category: "TECH",
    startDate: "2026-12-15T09:00:00Z",
    endDate: "2026-12-15T17:00:00Z",
    location: "Main Hall Dago",
    isPaid: true,
    price: 150000,
    status: "APPROVED",
    organizerName: "Tech Community",
    organizerEmail: "tech@dago.id",
    organizerPhone: "081234567890",
    ticketTiers: [
      {
        id: "tier-early",
        name: "Early Bird",
        price: 100000,
        quota: 20,
        remainingQuota: 5,
        isActive: true,
      },
      {
        id: "tier-reguler",
        name: "Reguler",
        price: 150000,
        quota: 50,
        remainingQuota: 50,
        isActive: true,
      },
      {
        id: "tier-vip",
        name: "VIP",
        price: 300000,
        quota: 10,
        remainingQuota: 0,
        isActive: true,
      },
    ],
    proposedRevenueSplit: {
      organizerPercent: 80,
      platformPercent: 20,
      agreed: true,
    },
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
  };

  const sampleBookings: EventTicketOrder[] = [
    // 15 Early Bird sold
    {
      id: "ord-1",
      eventId: "evt-multi-1",
      eventTitle: "Dago Tech Conference 2026",
      ticketCode: "TC-EB-001",
      guestName: "Alice Walker",
      guestEmail: "alice@example.com",
      ticketTierId: "tier-early",
      ticketTierName: "Early Bird",
      ticketCount: 10,
      totalPrice: 1000000,
      paymentStatus: "PAID",
      checkInStatus: "CHECKED_IN",
      organizerRevenueAmount: 800000,
      platformFeeAmount: 200000,
      createdAt: "2026-11-02T10:00:00Z",
      updatedAt: "2026-11-02T10:00:00Z",
    },
    {
      id: "ord-2",
      eventId: "evt-multi-1",
      eventTitle: "Dago Tech Conference 2026",
      ticketCode: "TC-EB-002",
      guestName: "Bob Smith",
      guestEmail: "bob@example.com",
      ticketTierId: "tier-early",
      ticketTierName: "Early Bird",
      ticketCount: 5,
      totalPrice: 500000,
      paymentStatus: "PAID",
      checkInStatus: "PENDING",
      organizerRevenueAmount: 400000,
      platformFeeAmount: 100000,
      createdAt: "2026-11-03T11:00:00Z",
      updatedAt: "2026-11-03T11:00:00Z",
    },
    // VIP sold out (10 tickets)
    {
      id: "ord-3",
      eventId: "evt-multi-1",
      eventTitle: "Dago Tech Conference 2026",
      ticketCode: "TC-VIP-001",
      guestName: "Charlie Brown",
      guestEmail: "charlie@example.com",
      ticketTierId: "tier-vip",
      ticketTierName: "VIP",
      ticketCount: 10,
      totalPrice: 3000000,
      paymentStatus: "PAID",
      checkInStatus: "PENDING",
      organizerRevenueAmount: 2400000,
      platformFeeAmount: 600000,
      createdAt: "2026-11-04T12:00:00Z",
      updatedAt: "2026-11-04T12:00:00Z",
    },
    // Unpaid / cancelled order should not count in sales
    {
      id: "ord-4",
      eventId: "evt-multi-1",
      eventTitle: "Dago Tech Conference 2026",
      ticketCode: "TC-EB-003",
      guestName: "Dave Miller",
      guestEmail: "dave@example.com",
      ticketTierId: "tier-early",
      ticketTierName: "Early Bird",
      ticketCount: 2,
      totalPrice: 200000,
      paymentStatus: "PENDING",
      checkInStatus: "PENDING",
      createdAt: "2026-11-05T13:00:00Z",
      updatedAt: "2026-11-05T13:00:00Z",
    },
    // Another event order should not mix in
    {
      id: "ord-5",
      eventId: "evt-other",
      eventTitle: "Other Event",
      ticketCode: "OTH-001",
      guestName: "Eve Adams",
      guestEmail: "eve@example.com",
      ticketCount: 1,
      totalPrice: 50000,
      paymentStatus: "PAID",
      checkInStatus: "PENDING",
      createdAt: "2026-11-06T14:00:00Z",
      updatedAt: "2026-11-06T14:00:00Z",
    },
  ];

  it("calculates sales breakdown per ticket tier accurately", () => {
    const summary = calculateEventSalesSummary(multiTierEvent, sampleBookings);

    expect(summary.eventId).toBe("evt-multi-1");
    expect(summary.totalCapacity).toBe(80); // 20 + 50 + 10
    expect(summary.totalTicketsSold).toBe(25); // 15 Early + 10 VIP
    expect(summary.remainingCapacity).toBe(55); // 80 - 25
    expect(summary.totalRevenue).toBe(4500000); // 1.5M + 3.0M
    expect(summary.organizerEarnings).toBe(3600000); // 80% of 4.5M
    expect(summary.isSoldOut).toBe(false);

    expect(summary.tierBreakdown).toHaveLength(3);

    // Early Bird
    const early = summary.tierBreakdown.find((t) => t.tierId === "tier-early")!;
    expect(early).toBeDefined();
    expect(early.soldCount).toBe(15);
    expect(early.remainingQuota).toBe(5);
    expect(early.revenue).toBe(1500000);
    expect(early.isSoldOut).toBe(false);

    // Reguler (none sold)
    const reguler = summary.tierBreakdown.find((t) => t.tierId === "tier-reguler")!;
    expect(reguler).toBeDefined();
    expect(reguler.soldCount).toBe(0);
    expect(reguler.remainingQuota).toBe(50);
    expect(reguler.revenue).toBe(0);
    expect(reguler.isSoldOut).toBe(false);

    // VIP (all 10 sold)
    const vip = summary.tierBreakdown.find((t) => t.tierId === "tier-vip")!;
    expect(vip).toBeDefined();
    expect(vip.soldCount).toBe(10);
    expect(vip.remainingQuota).toBe(0);
    expect(vip.revenue).toBe(3000000);
    expect(vip.isSoldOut).toBe(true);
  });

  it("handles single-tier or free events gracefully", () => {
    const freeEvent: CommunityEvent = {
      id: "evt-free-1",
      title: "Community Meetup",
      description: "Temu santai komunitas",
      category: "MEETUP",
      startDate: "2026-12-20T18:00:00Z",
      endDate: "2026-12-20T20:00:00Z",
      location: "Coworking Space",
      maxCapacity: 30,
      isPaid: false,
      price: 0,
      status: "APPROVED",
      organizerName: "Tech Community",
      organizerEmail: "tech@dago.id",
      organizerPhone: "081234567890",
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z",
    };

    const freeBookings: EventTicketOrder[] = [
      {
        id: "ord-free-1",
        eventId: "evt-free-1",
        eventTitle: "Community Meetup",
        ticketCode: "CM-001",
        guestName: "Frank Green",
        guestEmail: "frank@example.com",
        ticketCount: 2,
        totalPrice: 0,
        paymentStatus: "PAID",
        checkInStatus: "CHECKED_IN",
        createdAt: "2026-11-02T10:00:00Z",
        updatedAt: "2026-11-02T10:00:00Z",
      },
    ];

    const summary = calculateEventSalesSummary(freeEvent, freeBookings);
    expect(summary.totalCapacity).toBe(30);
    expect(summary.totalTicketsSold).toBe(2);
    expect(summary.remainingCapacity).toBe(28);
    expect(summary.totalRevenue).toBe(0);
    expect(summary.isSoldOut).toBe(false);
    expect(summary.tierBreakdown).toHaveLength(1);
    expect(summary.tierBreakdown[0].tierName).toBe("Tiket Masuk (Gratis)");
    expect(summary.tierBreakdown[0].price).toBe(0);
    expect(summary.tierBreakdown[0].soldCount).toBe(2);
  });

  it("filters attendees by event ID for isolated organizer views", () => {
    const attendees = filterOrganizerAttendees(sampleBookings, "evt-multi-1", "");
    expect(attendees).toHaveLength(4); // 4 orders for evt-multi-1 (including unpaid)
    expect(attendees.some((a) => a.eventId === "evt-other")).toBe(false);

    // Search inside organizer attendees
    const searchResult = filterOrganizerAttendees(sampleBookings, "evt-multi-1", "alice");
    expect(searchResult).toHaveLength(1);
    expect(searchResult[0].guestName).toBe("Alice Walker");
    expect(searchResult[0].ticketTierName).toBe("Early Bird");
  });

  it("calculates overall organizer metrics correctly across events", () => {
    const metrics = calculateOrganizerEventMetrics([multiTierEvent], sampleBookings);
    expect(metrics.totalEvents).toBe(1);
    expect(metrics.activeEvents).toBe(1);
    expect(metrics.totalAttendees).toBe(25); // 15 + 10
    expect(metrics.grossRevenue).toBe(4500000);
    expect(metrics.organizerEarnings).toBe(3600000);
  });
});
