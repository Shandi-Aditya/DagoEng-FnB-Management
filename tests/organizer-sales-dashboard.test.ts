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
    posterUrl: "https://example.com/poster.jpg",
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
        isActive: true,
      },
      {
        id: "tier-reguler",
        name: "Reguler",
        price: 150000,
        quota: 50,
        isActive: true,
      },
      {
        id: "tier-vip",
        name: "VIP",
        price: 300000,
        quota: 10,
        isActive: true,
      },
    ],
    proposedRevenueSplit: {
      proposedBy: "ORGANIZER",
      status: "ACCEPTED",
      organizerPercent: 80,
      platformPercent: 20,
      organizerFeePercent: 80,
      customPlatformFeePercent: 20,
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
      eventDate: "2026-12-15T09:00:00Z",
      eventLocation: "Main Hall Dago",
      ticketCode: "TC-EB-001",
      guestName: "Alice Walker",
      guestEmail: "alice@example.com",
      guestPhone: "081234567890",
      ticketTierId: "tier-early",
      ticketTierName: "Early Bird",
      ticketCount: 10,
      unitPrice: 100000,
      totalPrice: 1000000,
      paymentMethod: "MANUAL_TRANSFER",
      paymentStatus: "PAID",
      checkInStatus: "CHECKED_IN",
      platformFeePercent: 20,
      organizerRevenueAmount: 800000,
      platformFeeAmount: 200000,
      createdAt: "2026-11-02T10:00:00Z",
      updatedAt: "2026-11-02T10:00:00Z",
    },
    {
      id: "ord-2",
      eventId: "evt-multi-1",
      eventTitle: "Dago Tech Conference 2026",
      eventDate: "2026-12-15T09:00:00Z",
      eventLocation: "Main Hall Dago",
      ticketCode: "TC-EB-002",
      guestName: "Bob Smith",
      guestEmail: "bob@example.com",
      guestPhone: "081234567891",
      ticketTierId: "tier-early",
      ticketTierName: "Early Bird",
      ticketCount: 5,
      unitPrice: 100000,
      totalPrice: 500000,
      paymentMethod: "MANUAL_TRANSFER",
      paymentStatus: "PAID",
      checkInStatus: "REGISTERED",
      platformFeePercent: 20,
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
      eventDate: "2026-12-15T09:00:00Z",
      eventLocation: "Main Hall Dago",
      ticketCode: "TC-VIP-001",
      guestName: "Charlie Brown",
      guestEmail: "charlie@example.com",
      guestPhone: "081234567892",
      ticketTierId: "tier-vip",
      ticketTierName: "VIP",
      ticketCount: 10,
      unitPrice: 300000,
      totalPrice: 3000000,
      paymentMethod: "MANUAL_TRANSFER",
      paymentStatus: "PAID",
      checkInStatus: "REGISTERED",
      platformFeePercent: 20,
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
      eventDate: "2026-12-15T09:00:00Z",
      eventLocation: "Main Hall Dago",
      ticketCode: "TC-EB-003",
      guestName: "Dave Miller",
      guestEmail: "dave@example.com",
      guestPhone: "081234567893",
      ticketTierId: "tier-early",
      ticketTierName: "Early Bird",
      ticketCount: 2,
      unitPrice: 100000,
      totalPrice: 200000,
      paymentMethod: "MANUAL_TRANSFER",
      paymentStatus: "PENDING",
      checkInStatus: "REGISTERED",
      platformFeePercent: 20,
      organizerRevenueAmount: 160000,
      platformFeeAmount: 40000,
      createdAt: "2026-11-05T13:00:00Z",
      updatedAt: "2026-11-05T13:00:00Z",
    },
    // Another event order should not mix in
    {
      id: "ord-5",
      eventId: "evt-other",
      eventTitle: "Other Event",
      eventDate: "2026-12-15T09:00:00Z",
      eventLocation: "Other Location",
      ticketCode: "OTH-001",
      guestName: "Eve Adams",
      guestEmail: "eve@example.com",
      guestPhone: "081234567894",
      ticketCount: 1,
      unitPrice: 50000,
      totalPrice: 50000,
      paymentMethod: "MANUAL_TRANSFER",
      paymentStatus: "PAID",
      checkInStatus: "REGISTERED",
      platformFeePercent: 20,
      organizerRevenueAmount: 40000,
      platformFeeAmount: 10000,
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
      posterUrl: "https://example.com/poster.jpg",
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
        eventDate: "2026-12-20T18:00:00Z",
        eventLocation: "Coworking Space",
        ticketCode: "CM-001",
        guestName: "Frank Green",
        guestEmail: "frank@example.com",
        guestPhone: "081234567895",
        ticketCount: 2,
        unitPrice: 0,
        totalPrice: 0,
        paymentMethod: "MANUAL_TRANSFER",
        paymentStatus: "PAID",
        checkInStatus: "CHECKED_IN",
        platformFeePercent: 20,
        organizerRevenueAmount: 0,
        platformFeeAmount: 0,
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
    expect(summary.tierBreakdown[0].tierName).toBe("Tiket masuk (gratis)");
    expect(summary.tierBreakdown[0].price).toBe(0);
    expect(summary.tierBreakdown[0].soldCount).toBe(2);
  });

  it("deducts active PENDING reservations from remainingCapacity and sets isSoldOut", () => {
    const limitedEvent: CommunityEvent = {
      id: "evt-pending-1",
      title: "Exclusive Masterclass",
      description: "Masterclass terbatas",
      category: "WORKSHOP",
      startDate: "2026-12-20T10:00:00Z",
      endDate: "2026-12-20T13:00:00Z",
      location: "VIP Lounge",
      maxCapacity: 10,
      isPaid: true,
      price: 100000,
      posterUrl: "https://example.com/poster.jpg",
      status: "APPROVED",
      organizerName: "Tech Community",
      organizerEmail: "tech@dago.id",
      organizerPhone: "081234567890",
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z",
    };

    const nowIso = new Date().toISOString();
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const bookingsWithPending: EventTicketOrder[] = [
      {
        id: "ord-paid-1",
        eventId: "evt-pending-1",
        eventTitle: "Exclusive Masterclass",
        ticketCode: "MC-001",
        guestName: "Paid Guest",
        guestEmail: "paid@example.com",
        ticketCount: 4,
        unitPrice: 100000,
        totalPrice: 400000,
        paymentStatus: "PAID",
        paymentMethod: "MANUAL_TRANSFER",
        createdAt: nowIso,
      },
      {
        id: "ord-pending-1",
        eventId: "evt-pending-1",
        eventTitle: "Exclusive Masterclass",
        ticketCode: "MC-002",
        guestName: "Pending Guest",
        guestEmail: "pending@example.com",
        ticketCount: 6,
        unitPrice: 100000,
        totalPrice: 600000,
        paymentStatus: "PENDING",
        paymentMethod: "MANUAL_TRANSFER",
        expiresAt: futureDate,
        createdAt: nowIso,
      },
    ] as any;

    const summary = calculateEventSalesSummary(limitedEvent, bookingsWithPending);
    expect(summary.totalCapacity).toBe(10);
    expect(summary.totalTicketsSold).toBe(4); // only PAID is sold
    expect(summary.remainingCapacity).toBe(0); // 10 - (4 + 6) = 0
    expect(summary.isSoldOut).toBe(true);
  });

  it("separates invitation tickets from soldCount on non-tier events with isSoldOut false", () => {
    const nonTierEvent: CommunityEvent = {
      id: "evt-inv-1",
      title: "Community Concert",
      description: "Konser komunitas",
      category: "CREATIVE",
      startDate: "2026-12-25T19:00:00Z",
      endDate: "2026-12-25T22:00:00Z",
      location: "Main Stage",
      maxCapacity: 100,
      isPaid: true,
      price: 50000,
      posterUrl: "https://example.com/poster.jpg",
      status: "APPROVED",
      organizerName: "Art Community",
      organizerEmail: "art@dago.id",
      organizerPhone: "081234567890",
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z",
    };

    const bookingsWithInv: EventTicketOrder[] = [
      {
        id: "ord-reg-1",
        eventId: "evt-inv-1",
        eventTitle: "Community Concert",
        ticketCode: "CC-REG-001",
        guestName: "Regular Buyer",
        guestEmail: "buyer@example.com",
        ticketCount: 10,
        unitPrice: 50000,
        totalPrice: 500000,
        paymentStatus: "PAID",
        paymentMethod: "MANUAL_TRANSFER",
        createdAt: "2026-11-02T10:00:00Z",
      },
      {
        id: "ord-inv-1",
        eventId: "evt-inv-1",
        eventTitle: "Community Concert",
        ticketCode: "CC-INV-001",
        guestName: "VIP Guest",
        guestEmail: "vip@example.com",
        ticketCount: 5,
        unitPrice: 0,
        totalPrice: 0,
        isInvitation: true,
        paymentMethod: "INVITATION",
        paymentStatus: "PAID",
        createdAt: "2026-11-02T10:00:00Z",
      },
    ] as any;

    const summary = calculateEventSalesSummary(nonTierEvent, bookingsWithInv);
    expect(summary.totalTicketsSold).toBe(15);
    expect(summary.tierBreakdown).toHaveLength(2);

    const regularRow = summary.tierBreakdown.find((t) => t.tierId === "default")!;
    expect(regularRow.tierName).toBe("Tiket masuk (reguler)");
    expect(regularRow.soldCount).toBe(10); // regular buyers only
    expect(regularRow.revenue).toBe(500000);

    const invRow = summary.tierBreakdown.find((t) => t.tierId === "invitation")!;
    expect(invRow.tierName).toBe("Tiket undangan");
    expect(invRow.soldCount).toBe(5);
    expect(invRow.revenue).toBe(0);
    expect(invRow.isSoldOut).toBe(false);
  });

  it("calculates organizer revenue using custom resolveOrganizerSharePercent", () => {
    const customSplitEvent: CommunityEvent = {
      id: "evt-split-1",
      title: "Shared Art Show",
      description: "Pameran seni",
      category: "CREATIVE",
      startDate: "2026-12-25T10:00:00Z",
      endDate: "2026-12-25T18:00:00Z",
      location: "Gallery Room",
      maxCapacity: 50,
      isPaid: true,
      price: 200000,
      posterUrl: "https://example.com/poster.jpg",
      status: "APPROVED",
      organizerName: "Gallery Guild",
      organizerEmail: "gallery@dago.id",
      organizerPhone: "081234567890",
      customPlatformFeePercent: 10,
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z",
    };

    const bookings: EventTicketOrder[] = [
      {
        id: "ord-split-1",
        eventId: "evt-split-1",
        eventTitle: "Shared Art Show",
        ticketCode: "SAS-001",
        guestName: "Art Fan",
        guestEmail: "fan@example.com",
        ticketCount: 1,
        unitPrice: 200000,
        totalPrice: 200000,
        paymentStatus: "PAID",
        paymentMethod: "MANUAL_TRANSFER",
        createdAt: "2026-11-02T10:00:00Z",
      },
    ] as any;

    const summary = calculateEventSalesSummary(customSplitEvent, bookings);
    expect(summary.totalRevenue).toBe(200000);
    // 90% of 200,000 = 180,000
    expect(summary.organizerEarnings).toBe(180000);
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
