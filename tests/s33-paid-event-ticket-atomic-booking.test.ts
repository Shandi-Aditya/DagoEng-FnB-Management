import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import * as dataStorage from "@/lib/data-storage";
import {
  createEventSubmission,
  updateEventStatus,
  loadEventsFromDisk,
  loadBookingsFromDisk,
  saveEventsToDisk,
  saveBookingsToDisk,
  saveEventSettingsToDisk,
  getEventRevenuePolicy,
} from "@/lib/events";
import { POST as bookTicketRoute } from "@/app/api/events/[id]/book/route";
import type { CommunityEvent, EventRevenueSharingPolicy } from "@/types/event";

describe("TASK S-33 — Atomic Paid Ticket Booking & Anti-Duplicate Guard", () => {
  const originalEnv = process.env;
  let paidEvent: CommunityEvent;
  let freeEvent: CommunityEvent;

  const eventStartDate = "2026-12-25T19:00:00+08:00";
  const eventEndDate = "2026-12-25T23:00:00+08:00";

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    dataStorage.resetStorageSyncStatus();
    dataStorage.setStorageSyncStatus("events.json", "SYNCED");
    dataStorage.setStorageSyncStatus("event_bookings.json", "SYNCED");
    dataStorage.setStorageSyncStatus("event_settings.json", "SYNCED");

    // Configure official platform bank account for paid event bookings
    const officialPolicy: EventRevenueSharingPolicy = {
      ...getEventRevenuePolicy(),
      bankAccounts: [
        {
          id: "bank-official-dago-bca",
          label: "BCA Rekening Resmi Operasional",
          bankName: "Bank BCA",
          accountNumber: "135002938411",
          accountHolder: "PT DAGO KREATIF MANDIRI",
          branch: "KCU Dago Singaraja",
          isDefault: true,
          isActive: true,
          accountType: "PLATFORM",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    await saveEventSettingsToDisk(officialPolicy);

    // Create approved paid event
    const createdPaid = await createEventSubmission({
      organizerName: "Dago Music Fest",
      organizerEmail: "fest@dagocreative.id",
      organizerPhone: "081234567890",
      title: "Dago Acoustic Night",
      category: "COMMUNITY",
      description: "Konser akustik intim di Dago Creative Hub",
      startDate: eventStartDate,
      endDate: eventEndDate,
      location: "Amfiteater Dago",
      isPaid: true,
      price: 50000,
      posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
    });
    paidEvent = await updateEventStatus(createdPaid.id, "APPROVED");

    // Create approved free event
    const createdFree = await createEventSubmission({
      organizerName: "Dago Tech Community",
      organizerEmail: "tech@dagocreative.id",
      organizerPhone: "081234567891",
      title: "Dago Tech Meetup",
      category: "WORKSHOP",
      description: "Sharing session pengembang web Dago",
      startDate: eventStartDate,
      endDate: eventEndDate,
      location: "Dago Hub Room A",
      isPaid: false,
      price: 0,
      posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
    });
    freeEvent = await updateEventStatus(createdFree.id, "APPROVED");

    await saveBookingsToDisk([]);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
  });

  it("1. Pesan sukses langsung menghasilkan paymentUrl dan status 201 tanpa error 503", async () => {
    const req = new NextRequest(`http://localhost:3000/api/events/${paidEvent.id}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName: "Budi Santoso",
        guestEmail: "budi.s33@example.com",
        guestPhone: "081298765432",
        ticketCount: 1,
      }),
    });

    const res = await bookTicketRoute(req, {
      params: Promise.resolve({ id: paidEvent.id }),
    });

    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
    expect(json.data.paymentStatus).toBe("PENDING");
    expect(json.data.paymentMethod).toBe("MANUAL_TRANSFER");
    expect(json.data.totalPrice).toBe(50000);
    expect(json.data.guestToken).toBeDefined();
    expect(json.data.paymentUrl).toBe(`/events/tickets/${json.data.guestToken}`);

    // Verify stored atomically
    const allBookings = loadBookingsFromDisk();
    const stored = allBookings.find((b) => b.id === json.data.id);
    expect(stored).toBeDefined();
    expect(stored?.guestEmail).toBe("budi.s33@example.com");
  });

  it("2. Bila pemesanan gagal validasi, tidak ada tiket yang tersimpan", async () => {
    const initialBookings = loadBookingsFromDisk();
    const countBefore = initialBookings.length;

    const req = new NextRequest(`http://localhost:3000/api/events/${paidEvent.id}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName: "Budi Santoso",
        guestEmail: "budi.invalid@example.com",
        guestPhone: "081298765432",
        ticketCount: 1,
        promoCode: "PROMO_TIDAK_ADA_XYZ",
      }),
    });

    const res = await bookTicketRoute(req, {
      params: Promise.resolve({ id: paidEvent.id }),
    });

    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.success).toBe(false);

    // Verify atomicity: no booking was stored
    const afterBookings = loadBookingsFromDisk();
    expect(afterBookings.length).toBe(countBefore);
    expect(afterBookings.some((b) => b.guestEmail === "budi.invalid@example.com")).toBe(false);
  });

  it("3. Tombol ditekan berulang secara cepat (idempotency guard) tidak membuat tiket ganda", async () => {
    const bookingPayload = {
      guestName: "Rani Indah",
      guestEmail: "rani.doubleclick@example.com",
      guestPhone: "081345678901",
      ticketCount: 2,
      clientReferenceId: "ref-test-doubleclick-rani-01",
    };

    // First request
    const req1 = new NextRequest(`http://localhost:3000/api/events/${paidEvent.id}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingPayload),
    });

    const res1 = await bookTicketRoute(req1, {
      params: Promise.resolve({ id: paidEvent.id }),
    });
    const json1 = await res1.json();
    expect(res1.status).toBe(201);
    expect(json1.success).toBe(true);

    // Second identical request arriving right after (simulating rapid double click)
    const req2 = new NextRequest(`http://localhost:3000/api/events/${paidEvent.id}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingPayload),
    });

    const res2 = await bookTicketRoute(req2, {
      params: Promise.resolve({ id: paidEvent.id }),
    });
    const json2 = await res2.json();
    expect(res2.status).toBe(201);
    expect(json2.success).toBe(true);

    // Both requests converge to the exact same ticket code and guestToken
    expect(json2.data.ticketCode).toBe(json1.data.ticketCode);
    expect(json2.data.guestToken).toBe(json1.data.guestToken);
    expect(json2.data.id).toBe(json1.data.id);

    // Exactly 1 booking order in database storage
    const allBookings = loadBookingsFromDisk();
    const matches = allBookings.filter((b) => b.guestEmail === "rani.doubleclick@example.com");
    expect(matches.length).toBe(1);
  });

  it("4. Pemesanan kedua setelah jeda debounce tetap ditolak oleh anti-duplicate spam guard", async () => {
    const bookingPayload = {
      guestName: "Dewi Lestari",
      guestEmail: "dewi.spam@example.com",
      guestPhone: "081987654321",
      ticketCount: 1,
    };

    // First request
    const req1 = new NextRequest(`http://localhost:3000/api/events/${paidEvent.id}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingPayload),
    });

    const res1 = await bookTicketRoute(req1, {
      params: Promise.resolve({ id: paidEvent.id }),
    });
    expect(res1.status).toBe(201);

    // Advance time past 15-second debounce window but within 3-minute spam window
    const originalDateNow = Date.now;
    const futureTime = originalDateNow() + 30 * 1000; // +30s
    global.Date.now = vi.fn(() => futureTime);

    try {
      const req2 = new NextRequest(`http://localhost:3000/api/events/${paidEvent.id}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingPayload),
      });

      const res2 = await bookTicketRoute(req2, {
        params: Promise.resolve({ id: paidEvent.id }),
      });
      const json2 = await res2.json();
      expect(res2.status).toBe(400);
      expect(json2.success).toBe(false);
      expect(json2.error).toContain("Pemesanan tiket untuk event ini baru saja dilakukan dari email yang sama");
    } finally {
      global.Date.now = originalDateNow;
    }
  });

  it("5. Double-click pada tiket gratis berhasil konvergen ke tiket yang sama (PAID)", async () => {
    const bookingPayload = {
      guestName: "Agus Pratama",
      guestEmail: "agus.free@example.com",
      guestPhone: "081234509876",
      ticketCount: 1,
      clientReferenceId: "ref-test-doubleclick-agus-01",
    };

    // Request 1
    const req1 = new NextRequest(`http://localhost:3000/api/events/${freeEvent.id}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingPayload),
    });
    const res1 = await bookTicketRoute(req1, {
      params: Promise.resolve({ id: freeEvent.id }),
    });
    const json1 = await res1.json();
    expect(res1.status).toBe(201);
    expect(json1.data.paymentStatus).toBe("PAID");

    // Request 2 (rapid click)
    const req2 = new NextRequest(`http://localhost:3000/api/events/${freeEvent.id}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingPayload),
    });
    const res2 = await bookTicketRoute(req2, {
      params: Promise.resolve({ id: freeEvent.id }),
    });
    const json2 = await res2.json();
    expect(res2.status).toBe(201);
    expect(json2.data.id).toBe(json1.data.id);
    expect(json2.data.ticketCode).toBe(json1.data.ticketCode);

    // Only 1 record in disk
    const allBookings = loadBookingsFromDisk();
    const records = allBookings.filter((b) => b.guestEmail === "agus.free@example.com");
    expect(records.length).toBe(1);
  });

  it("6. Double-click pada sisa kuota terakhir tidak terhalang validasi kuota habis", async () => {
    // Create an event with capacity limit of exactly 1
    const limitedSubmission = await createEventSubmission({
      organizerName: "Private Showcase",
      organizerEmail: "showcase@dagocreative.id",
      organizerPhone: "081299998888",
      title: "Exclusive Private Session",
      category: "COMMUNITY",
      description: "Sesi terbatas hanya 1 peserta",
      startDate: eventStartDate,
      endDate: eventEndDate,
      location: "VIP Lounge",
      isPaid: true,
      price: 100000,
      posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
      maxTicketsPerBooking: 1,
    });

    const limitedEvent = await updateEventStatus(limitedSubmission.id, "APPROVED");
    // Manually set capacity to 1 in events.json
    const allEvents = loadEventsFromDisk();
    const targetIdx = allEvents.findIndex((e) => e.id === limitedEvent.id);
    if (targetIdx !== -1) {
      allEvents[targetIdx].maxTicketsPerBooking = 1;
      // Add a single tier with quota = 1
      allEvents[targetIdx].ticketTiers = [
        {
          id: "tier-exclusive-1",
          name: "Single Seat",
          price: 100000,
          quota: 1,
          isActive: true,
        },
      ];
      await saveEventsToDisk(allEvents);
    }

    const payload = {
      guestName: "Hendra Wijaya",
      guestEmail: "hendra.exclusive@example.com",
      guestPhone: "081277778888",
      ticketCount: 1,
      ticketTierId: "tier-exclusive-1",
      clientReferenceId: "ref-test-doubleclick-hendra-01",
    };

    // First click consumes the only available seat
    const req1 = new NextRequest(`http://localhost:3000/api/events/${limitedEvent.id}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const res1 = await bookTicketRoute(req1, {
      params: Promise.resolve({ id: limitedEvent.id }),
    });
    const json1 = await res1.json();
    expect(res1.status).toBe(201);

    // Second click (arriving immediately after within 15s) must converge to the same booking, not throw "kuota habis"
    const req2 = new NextRequest(`http://localhost:3000/api/events/${limitedEvent.id}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const res2 = await bookTicketRoute(req2, {
      params: Promise.resolve({ id: limitedEvent.id }),
    });
    const json2 = await res2.json();
    expect(res2.status).toBe(201);
    expect(json2.data.id).toBe(json1.data.id);
    expect(json2.data.ticketCode).toBe(json1.data.ticketCode);
  });
});
