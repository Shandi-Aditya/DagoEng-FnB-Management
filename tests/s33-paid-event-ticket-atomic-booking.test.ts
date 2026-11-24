import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import * as dataStorage from "@/lib/data-storage";
import * as doku from "@/lib/doku";
import * as email from "@/lib/email";
import {
  createEventSubmission,
  createInvitationTicket,
  updateEventStatus,
  loadEventsFromDisk,
  loadBookingsFromDisk,
  saveEventsToDisk,
  saveBookingsToDisk,
  saveEventSettingsToDisk,
  getEventRevenuePolicy,
  resetLastCommittedTimestampsForTesting,
} from "@/lib/events";
import { POST as bookTicketRoute } from "@/app/api/events/[id]/book/route";
import type { CommunityEvent, EventRevenueSharingPolicy } from "@/types/event";

describe("TASK S-33 — Atomic Paid Ticket Booking & Anti-Duplicate Guard", () => {
  let tempDir = "";
  let prevDataDirOverride: string | undefined;
  let paidEvent: CommunityEvent;
  let freeEvent: CommunityEvent;

  const eventStartDate = "2026-12-25T19:00:00+08:00";
  const eventEndDate = "2026-12-25T23:00:00+08:00";

  beforeEach(async () => {
    vi.clearAllMocks();
    prevDataDirOverride = process.env.DATA_DIR_OVERRIDE;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "s33-booking-"));
    process.env.DATA_DIR_OVERRIDE = tempDir;
    resetLastCommittedTimestampsForTesting();

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
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (prevDataDirOverride === undefined) {
      delete process.env.DATA_DIR_OVERRIDE;
    } else {
      process.env.DATA_DIR_OVERRIDE = prevDataDirOverride;
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
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

  it("7. in-tx expirePendingBookingsSnapshot melepaskan kuota tiket dan promo secara atomik saat pemesanan atau undangan baru", async () => {
    const sub = await createEventSubmission({
      organizerName: "Promo Capacity Event",
      organizerEmail: "promo@dagocreative.id",
      organizerPhone: "081234567892",
      title: "Limited Promo Session",
      category: "WORKSHOP",
      description: "Event berkapasitas 1 kursi dengan 1 kode promo",
      startDate: eventStartDate,
      endDate: eventEndDate,
      location: "Studio Dago",
      isPaid: true,
      price: 100000,
      posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
      maxCapacity: 1,
      maxTicketsPerBooking: 1,
    });
    const promoEvent = await updateEventStatus(sub.id, "APPROVED");
    const allEvents = loadEventsFromDisk();
    const evIdx = allEvents.findIndex((e) => e.id === promoEvent.id);
    allEvents[evIdx].maxCapacity = 1;
    allEvents[evIdx].ticketTiers = [
      {
        id: "tier-promo-1",
        name: "Single VIP",
        price: 100000,
        quota: 1,
        isActive: true,
      },
    ];
    allEvents[evIdx].promoCodes = [
      {
        id: "promo-hemat-10",
        eventId: promoEvent.id,
        code: "HEMAT10",
        discountType: "PERCENT",
        discountValue: 10,
        quota: 1,
        usedCount: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    await saveEventsToDisk(allEvents);

    // First booking consumes the only seat and promo quota
    const res1 = await bookTicketRoute(
      new NextRequest(`http://localhost:3000/api/events/${promoEvent.id}/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.0.0.71",
        },
        body: JSON.stringify({
          guestName: "Tamu Kedaluwarsa",
          guestEmail: "expired.guest@example.com",
          guestPhone: "081233334444",
          ticketCount: 1,
          ticketTierId: "tier-promo-1",
          promoCode: "HEMAT10",
        }),
      }),
      { params: Promise.resolve({ id: promoEvent.id }) }
    );
    const json1 = await res1.json();
    expect(res1.status).toBe(201);
    expect(json1.data.discountAmount).toBe(10000);

    // Backdate booking beyond 60-minute expiry window without paymentProofUrl
    const bookings = loadBookingsFromDisk();
    const expiredIdx = bookings.findIndex((b) => b.id === json1.data.id);
    bookings[expiredIdx] = {
      ...bookings[expiredIdx],
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    };
    await saveBookingsToDisk(bookings);

    // Second booking arrives; in-tx expirePendingBookingsSnapshot releases seat & promo quota
    const res2 = await bookTicketRoute(
      new NextRequest(`http://localhost:3000/api/events/${promoEvent.id}/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.0.0.72",
        },
        body: JSON.stringify({
          guestName: "Tamu Baru",
          guestEmail: "fresh.guest@example.com",
          guestPhone: "081255556666",
          ticketCount: 1,
          ticketTierId: "tier-promo-1",
          promoCode: "HEMAT10",
        }),
      }),
      { params: Promise.resolve({ id: promoEvent.id }) }
    );
    const json2 = await res2.json();
    expect(res2.status).toBe(201);
    expect(json2.data.discountAmount).toBe(10000);
    expect(json2.data.totalPrice).toBe(90000);

    const updatedBookings = loadBookingsFromDisk();
    const firstStored = updatedBookings.find((b) => b.id === json1.data.id);
    expect(firstStored?.paymentStatus).toBe("EXPIRED");
    const updatedPromo = loadEventsFromDisk()
      .find((e) => e.id === promoEvent.id)
      ?.promoCodes?.find((p) => p.code === "HEMAT10");
    expect(updatedPromo?.usedCount).toBe(1);

    // Also verify createInvitationTicket releases expired pending bookings inside its tx
    const invBooking = updatedBookings.find((b) => b.id === json2.data.id)!;
    const invIdx = updatedBookings.findIndex((b) => b.id === invBooking.id);
    updatedBookings[invIdx] = {
      ...invBooking,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    };
    await saveBookingsToDisk(updatedBookings);

    const invitation = await createInvitationTicket(
      {
        eventId: promoEvent.id,
        guestName: "Tamu Undangan VIP",
        guestEmail: "vip.invite@example.com",
        ticketTierId: "tier-promo-1",
        ticketCount: 1,
      },
      "admin"
    );
    expect(invitation.paymentStatus).toBe("PAID");
    expect(
      loadBookingsFromDisk().find((b) => b.id === invBooking.id)?.paymentStatus
    ).toBe("EXPIRED");
  });

  it("8. retry clientReferenceId dengan guestPhone kosong atau tidak cocok tidak membocorkan guestToken", async () => {
    const initialRes = await bookTicketRoute(
      new NextRequest(`http://localhost:3000/api/events/${paidEvent.id}/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.0.0.81",
        },
        body: JSON.stringify({
          guestName: "Sari Rahayu",
          guestEmail: "sari.guard@example.com",
          guestPhone: "081234567890",
          ticketCount: 1,
          clientReferenceId: "ref-s33-token-guard-01",
        }),
      }),
      { params: Promise.resolve({ id: paidEvent.id }) }
    );
    const initialJson = await initialRes.json();
    expect(initialRes.status).toBe(201);
    const originalToken = initialJson.data.guestToken as string;
    expect(originalToken).toBeTruthy();

    // Retry with empty guestPhone
    const emptyPhoneRes = await bookTicketRoute(
      new NextRequest(`http://localhost:3000/api/events/${paidEvent.id}/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.0.0.82",
        },
        body: JSON.stringify({
          guestName: "Sari Rahayu",
          guestEmail: "sari.guard@example.com",
          guestPhone: "",
          ticketCount: 1,
          clientReferenceId: "ref-s33-token-guard-01",
        }),
      }),
      { params: Promise.resolve({ id: paidEvent.id }) }
    );
    const emptyPhoneBody = await emptyPhoneRes.text();
    expect(emptyPhoneRes.status).toBe(400);
    expect(emptyPhoneBody).not.toContain(originalToken);

    // Retry with mismatched guestPhone
    const mismatchPhoneRes = await bookTicketRoute(
      new NextRequest(`http://localhost:3000/api/events/${paidEvent.id}/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.0.0.83",
        },
        body: JSON.stringify({
          guestName: "Sari Rahayu",
          guestEmail: "sari.guard@example.com",
          guestPhone: "089988776655",
          ticketCount: 1,
          clientReferenceId: "ref-s33-token-guard-01",
        }),
      }),
      { params: Promise.resolve({ id: paidEvent.id }) }
    );
    const mismatchPhoneBody = await mismatchPhoneRes.text();
    expect(mismatchPhoneRes.status).toBe(400);
    expect(mismatchPhoneBody).not.toContain(originalToken);
  });

  it("9. Promise.all concurrent last-seat booking hanya mengizinkan 1 transaksi berhasil dan menolak sisanya", async () => {
    const sub = await createEventSubmission({
      organizerName: "Concurrent Event",
      organizerEmail: "race@dagocreative.id",
      organizerPhone: "081234567899",
      title: "Last Seat Race Test",
      category: "COMMUNITY",
      description: "Uji konkurensi kursi terakhir",
      startDate: eventStartDate,
      endDate: eventEndDate,
      location: "Studio B",
      isPaid: true,
      price: 75000,
      posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
      maxCapacity: 1,
      maxTicketsPerBooking: 1,
    });
    const raceEvent = await updateEventStatus(sub.id, "APPROVED");
    const allEvents = loadEventsFromDisk();
    const idx = allEvents.findIndex((e) => e.id === raceEvent.id);
    allEvents[idx].maxCapacity = 1;
    allEvents[idx].ticketTiers = [
      {
        id: "tier-race-1",
        name: "Last Seat",
        price: 75000,
        quota: 1,
        isActive: true,
      },
    ];
    await saveEventsToDisk(allEvents);

    const [resA, resB] = await Promise.all([
      bookTicketRoute(
        new NextRequest(`http://localhost:3000/api/events/${raceEvent.id}/book`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "10.0.0.91",
          },
          body: JSON.stringify({
            guestName: "Peserta A",
            guestEmail: "peserta.a@example.com",
            guestPhone: "081211112222",
            ticketCount: 1,
            ticketTierId: "tier-race-1",
          }),
        }),
        { params: Promise.resolve({ id: raceEvent.id }) }
      ),
      bookTicketRoute(
        new NextRequest(`http://localhost:3000/api/events/${raceEvent.id}/book`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "10.0.0.92",
          },
          body: JSON.stringify({
            guestName: "Peserta B",
            guestEmail: "peserta.b@example.com",
            guestPhone: "081233334444",
            ticketCount: 1,
            ticketTierId: "tier-race-1",
          }),
        }),
        { params: Promise.resolve({ id: raceEvent.id }) }
      ),
    ]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 400]);

    const activeRaceBookings = loadBookingsFromDisk().filter(
      (b) => b.eventId === raceEvent.id && b.paymentStatus !== "CANCELLED"
    );
    expect(activeRaceBookings).toHaveLength(1);
  });

  it("10. idempotent retry pada DOKU Checkout memakai ulang dokuPaymentUrl dan retry tiket gratis tidak menggandakan email", async () => {
    const dokuSpy = vi.spyOn(doku, "createDokuCheckoutSession");
    const emailSpy = vi.spyOn(email, "dispatchPaidTicketEmail").mockResolvedValue({
      sent: true,
      message: "mock-sent",
      timestamp: new Date().toISOString(),
    });

    // 1. DOKU Checkout retry reuses stored dokuPaymentUrl
    const dokuPayload = {
      guestName: "Rama DOKU",
      guestEmail: "rama.doku@example.com",
      guestPhone: "081299001122",
      ticketCount: 1,
      paymentMethod: "DOKU_CHECKOUT",
      clientReferenceId: "ref-s33-doku-retry-01",
    };

    const dokuRes1 = await bookTicketRoute(
      new NextRequest(`http://localhost:3000/api/events/${paidEvent.id}/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.0.0.101",
        },
        body: JSON.stringify(dokuPayload),
      }),
      { params: Promise.resolve({ id: paidEvent.id }) }
    );
    const dokuJson1 = await dokuRes1.json();
    expect(dokuRes1.status).toBe(201);
    expect(dokuJson1.data.paymentUrl).toBeTruthy();

    const dokuRes2 = await bookTicketRoute(
      new NextRequest(`http://localhost:3000/api/events/${paidEvent.id}/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.0.0.102",
        },
        body: JSON.stringify(dokuPayload),
      }),
      { params: Promise.resolve({ id: paidEvent.id }) }
    );
    const dokuJson2 = await dokuRes2.json();
    expect(dokuRes2.status).toBe(201);
    expect(dokuJson2.data.paymentUrl).toBe(dokuJson1.data.paymentUrl);
    expect(dokuSpy).toHaveBeenCalledTimes(1);

    // 2. Free ticket idempotent retry does NOT double-send email even when another booking expires in same call
    const freePayload = {
      guestName: "Dina Gratis",
      guestEmail: "dina.free@example.com",
      guestPhone: "081355667788",
      ticketCount: 1,
      clientReferenceId: "ref-s33-free-retry-01",
    };

    const freeRes1 = await bookTicketRoute(
      new NextRequest(`http://localhost:3000/api/events/${freeEvent.id}/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.0.0.103",
        },
        body: JSON.stringify(freePayload),
      }),
      { params: Promise.resolve({ id: freeEvent.id }) }
    );
    expect(freeRes1.status).toBe(201);
    expect(emailSpy).toHaveBeenCalledTimes(1);

    // Add an unrelated stale pending booking so expirePendingBookingsSnapshot triggers on retry
    const currentBookings = loadBookingsFromDisk();
    currentBookings.push({
      ...currentBookings[0],
      id: "tkt-stale-unrelated",
      ticketCode: "DAGO-EVT-99999",
      guestToken: "stale-token-unrelated",
      eventId: paidEvent.id,
      guestEmail: "stale.unrelated@example.com",
      totalPrice: 50000,
      paymentStatus: "PENDING",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });
    await saveBookingsToDisk(currentBookings);

    const freeRes2 = await bookTicketRoute(
      new NextRequest(`http://localhost:3000/api/events/${freeEvent.id}/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.0.0.104",
        },
        body: JSON.stringify(freePayload),
      }),
      { params: Promise.resolve({ id: freeEvent.id }) }
    );
    expect(freeRes2.status).toBe(201);
    expect(emailSpy).toHaveBeenCalledTimes(1);
  });
});
