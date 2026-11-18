import { describe, it, expect } from "vitest";
import type { CommunityEvent, EventTicketOrder } from "@/types/event";
import {
  filterOrganizerEvents,
  filterOrganizerAttendees,
  calculateOrganizerEventMetrics,
  calculateEventOccupancy,
  emptyOrganizerEventMessage,
  emptyOrganizerAttendeeMessage,
  buildAttendeesExportRows,
  eventStatusLabel,
  eventStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
} from "@/features/events-portal/events-portal-domain";

describe("events-portal-domain", () => {
  const mockEvents: CommunityEvent[] = [
    {
      id: "evt-1",
      title: "Latte Art Workshop",
      description: "Belajar membuat latte art",
      category: "WORKSHOP",
      startDate: "2026-11-20T10:00:00Z",
      endDate: "2026-11-20T13:00:00Z",
      location: "Amphitheater Dago",
      isPaid: true,
      price: 50000,
      status: "APPROVED",
      organizerName: "Barista Guild",
      organizerEmail: "barista@dago.id",
      organizerPhone: "081234567890",
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z",
    },
    {
      id: "evt-2",
      title: "Coffee Cupping Session",
      description: "Uji cita rasa kopi nusantara",
      category: "CREATIVE",
      startDate: "2026-11-25T14:00:00Z",
      endDate: "2026-11-25T16:00:00Z",
      location: "Creative Hall",
      isPaid: false,
      price: 0,
      status: "PENDING",
      organizerName: "Barista Guild",
      organizerEmail: "barista@dago.id",
      organizerPhone: "081234567890",
      createdAt: "2026-11-02T00:00:00Z",
      updatedAt: "2026-11-02T00:00:00Z",
    },
    {
      id: "evt-3",
      title: "Manual Brewing Guide",
      description: "Sesi seduh manual V60 dan AeroPress",
      category: "WORKSHOP",
      startDate: "2026-11-28T09:00:00Z",
      endDate: "2026-11-28T12:00:00Z",
      location: "Workshop Room",
      isPaid: true,
      price: 75000,
      status: "REVISION_REQUESTED",
      revisionNotes: "Harap lengkapi panduan protokol keselamatan alat seduh.",
      organizerName: "Barista Guild",
      organizerEmail: "barista@dago.id",
      organizerPhone: "081234567890",
      createdAt: "2026-11-03T00:00:00Z",
      updatedAt: "2026-11-03T00:00:00Z",
    },
  ];

  const mockBookings: EventTicketOrder[] = [
    {
      id: "bk-1",
      eventId: "evt-1",
      eventTitle: "Latte Art Workshop",
      ticketCode: "DAGO-EVT-001",
      guestName: "Budi Santoso",
      guestEmail: "budi@example.com",
      guestPhone: "081211112222",
      institution: "Universitas Dago",
      ticketCount: 2,
      totalPrice: 100000,
      paymentStatus: "PAID",
      checkInStatus: "CHECKED_IN",
      checkInTime: "2026-11-20T10:15:00Z",
      organizerRevenueAmount: 80000,
      platformFeeAmount: 20000,
      createdAt: "2026-11-05T08:00:00Z",
      updatedAt: "2026-11-05T08:00:00Z",
    },
    {
      id: "bk-2",
      eventId: "evt-1",
      eventTitle: "Latte Art Workshop",
      ticketCode: "DAGO-EVT-002",
      guestName: "Siti Rahma",
      guestEmail: "siti@example.com",
      guestPhone: "081333334444",
      ticketCount: 1,
      totalPrice: 50000,
      paymentStatus: "PAID",
      checkInStatus: "PENDING",
      organizerRevenueAmount: 40000,
      platformFeeAmount: 10000,
      createdAt: "2026-11-06T09:00:00Z",
      updatedAt: "2026-11-06T09:00:00Z",
    },
    {
      id: "bk-3",
      eventId: "evt-2",
      eventTitle: "Coffee Cupping Session",
      ticketCode: "DAGO-EVT-003",
      guestName: "Rian Pratama",
      guestEmail: "rian@example.com",
      guestPhone: "081555556666",
      ticketCount: 1,
      totalPrice: 0,
      paymentStatus: "PAID",
      checkInStatus: "PENDING",
      createdAt: "2026-11-07T10:00:00Z",
      updatedAt: "2026-11-07T10:00:00Z",
    },
    {
      id: "bk-4",
      eventId: "evt-1",
      eventTitle: "Latte Art Workshop",
      ticketCode: "DAGO-EVT-004",
      guestName: "Ahmad Dani",
      guestEmail: "ahmad@example.com",
      ticketCount: 1,
      totalPrice: 50000,
      paymentStatus: "CANCELLED",
      checkInStatus: "PENDING",
      createdAt: "2026-11-08T11:00:00Z",
      updatedAt: "2026-11-08T11:00:00Z",
    },
  ];

  it("filters organizer events by status and search query without mutating original", () => {
    const originalCopy = [...mockEvents];
    const approved = filterOrganizerEvents(mockEvents, "APPROVED", "");
    expect(approved).toHaveLength(1);
    expect(approved[0].id).toBe("evt-1");

    const searchResult = filterOrganizerEvents(mockEvents, "ALL", "cupping");
    expect(searchResult).toHaveLength(1);
    expect(searchResult[0].id).toBe("evt-2");

    const needRevision = filterOrganizerEvents(mockEvents, "REVISION_REQUESTED", "");
    expect(needRevision).toHaveLength(1);
    expect(needRevision[0].id).toBe("evt-3");

    expect(mockEvents).toEqual(originalCopy);
  });

  it("filters attendees by event, search query, and handles case-insensitivity", () => {
    const forEvt1 = filterOrganizerAttendees(mockBookings, "evt-1", "");
    expect(forEvt1).toHaveLength(3);

    const searchByCode = filterOrganizerAttendees(mockBookings, "ALL", "dago-evt-002");
    expect(searchByCode).toHaveLength(1);
    expect(searchByCode[0].guestName).toBe("Siti Rahma");

    const searchByName = filterOrganizerAttendees(mockBookings, "ALL", "budi");
    expect(searchByName).toHaveLength(1);
    expect(searchByName[0].ticketCode).toBe("DAGO-EVT-001");
  });

  it("calculates executive metrics accurately for organizer dashboard", () => {
    const metrics = calculateOrganizerEventMetrics(mockEvents, mockBookings);
    expect(metrics.totalEvents).toBe(3);
    expect(metrics.activeEvents).toBe(1);
    expect(metrics.actionRequiredCount).toBe(2); // 1 PENDING + 1 REVISION_REQUESTED
    expect(metrics.totalAttendees).toBe(4); // 2 + 1 + 1 (PAID only)
    expect(metrics.grossRevenue).toBe(150000); // 100k + 50k (PAID only)
    expect(metrics.organizerEarnings).toBe(120000); // 80k + 40k
  });

  it("calculates event occupancy accurately bounded to 100%", () => {
    const occupancy = calculateEventOccupancy(mockEvents[0], mockBookings);
    expect(occupancy.ticketsPaid).toBe(3); // 2 + 1
    expect(occupancy.totalCapacity).toBeGreaterThan(0);
    expect(occupancy.occupancyRate).toBeGreaterThanOrEqual(0);
    expect(occupancy.occupancyRate).toBeLessThanOrEqual(100);
  });

  it("generates honest empty state messages for events", () => {
    const normalEmpty = emptyOrganizerEventMessage("APPROVED", false);
    expect(normalEmpty.title).toBe("Belum ada event tayang");
    expect(normalEmpty.description).toContain("Event yang disetujui");

    const searchEmpty = emptyOrganizerEventMessage("ALL", true);
    expect(searchEmpty.title).toBe("Tidak ada event yang cocok");
  });

  it("generates honest empty state messages for attendees", () => {
    const normalEmpty = emptyOrganizerAttendeeMessage(false);
    expect(normalEmpty.title).toBe("Belum ada pesanan tiket");

    const searchEmpty = emptyOrganizerAttendeeMessage(true);
    expect(searchEmpty.title).toBe("Tidak ada peserta yang cocok");
  });

  it("builds valid export rows for attendees CSV without breaking formatting", () => {
    const rows = buildAttendeesExportRows(mockBookings);
    expect(rows).toHaveLength(4);
    expect(rows[0][0]).toBe("DAGO-EVT-001");
    expect(rows[0][1]).toBe("Latte Art Workshop");
    expect(rows[0][2]).toBe("Standar");
    expect(rows[0][3]).toBe("Budi Santoso");
    expect(rows[0][7]).toBe("Lunas");
    expect(rows[0][8]).toBe("Hadir");
  });

  it("re-exports or maps status labels and tones consistently with events-admin", () => {
    expect(eventStatusLabel("APPROVED")).toBe("Disetujui");
    expect(eventStatusTone("APPROVED")).toBe("success");
    expect(eventStatusLabel("REVISION_REQUESTED")).toBe("Perlu revisi");
    expect(eventStatusTone("REVISION_REQUESTED")).toBe("info");

    expect(paymentStatusLabel("PAID")).toBe("Lunas");
    expect(paymentStatusTone("PAID")).toBe("success");
  });
});
