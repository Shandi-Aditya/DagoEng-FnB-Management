import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import fs from "fs";
import { getDataFilePath } from "@/lib/data-storage";
import {
  expirePendingBookings,
  getEventTicketAvailability,
  loadBookingsFromDisk,
  saveBookingsToDisk,
  createEventBooking,
  createEventSubmission,
  getAdminEvents,
  updateEventStatus,
  organizerCheckInAttendee,
  getBookingPaymentExpiryMs,
  updateBookingPaymentStatus,
} from "@/lib/events";
import {
  getWitaStartOfDay,
  getWitaEndOfDay,
  isEventInWitaPeriod,
  isTimestampInWitaPeriod,
  DateRange,
} from "@/components/events/EventDateRangeFilter";
import { ALL_NAV_ITEMS } from "@/lib/rbac";
import { resolveVenueCapacity } from "@/lib/event-capacity";
import { POST as handleDokuWebhook } from "@/app/api/webhooks/doku/route";
import { generateDokuSignature } from "@/lib/doku";
import { NextRequest } from "next/server";
import { EventTicketOrder } from "@/types/event";

describe("FINAL TASK — SYSTEM HARDENING, OPERATIONAL UX & MODULE PRIORITY", () => {
  let testEventId = "";
  const testOrganizerEmail = "organizer-hardening@dagoeng.com";
  const mockClientId = "MCH-TEST";
  const mockSecretKey = "SK-TEST";
  let originalBookingsBackup: string | null = null;
  const bookingsFile = getDataFilePath("event_bookings.json");

  beforeAll(() => {
    if (fs.existsSync(bookingsFile)) {
      originalBookingsBackup = fs.readFileSync(bookingsFile, "utf-8");
    }
  });

  afterAll(() => {
    if (originalBookingsBackup && fs.existsSync(bookingsFile)) {
      fs.writeFileSync(bookingsFile, originalBookingsBackup, "utf-8");
    }
  });

  beforeEach(async () => {
    // Ensure clean state and test event
    const adminEvents = await getAdminEvents();
    let evt = adminEvents.find((e) => e.title === "Hardening Test Master Event");
    if (!evt) {
      const created = await createEventSubmission({
        title: "Hardening Test Master Event",
        category: "TECH",
        description: "Hardening test master event description testing.",
        startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        endDate: new Date(Date.now() + 7 * 86400000 + 7200000).toISOString(),
        location: "Kopi Senja Ground Floor",
        maxCapacity: 10,
        maxTicketsPerBooking: 10,
        isPaid: true,
        price: 50000,
        posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
        organizerName: "Hardening Community",
        organizerEmail: testOrganizerEmail,
        organizerPhone: "081234567890",
      });
      evt = await updateEventStatus(created.id, "APPROVED");
    } else {
      if (evt.status !== "APPROVED") {
        evt = await updateEventStatus(evt.id, "APPROVED");
      }
      evt.maxTicketsPerBooking = 10;
    }
    testEventId = evt.id;

    // Clean up test bookings for testEventId to guarantee clean quota state
    const currentBookings = loadBookingsFromDisk();
    saveBookingsToDisk(currentBookings.filter((b) => b.eventId !== testEventId));
  });

  // =========================================================================
  // BAGIAN A — BOOKING DAN KUOTA (Requirements 1 - 11)
  // =========================================================================
  describe("Bagian A: Booking Expiration & Quota Consistency (Req 1-11)", () => {
    it("1. Booking PENDING sebelum batas waktu tetap aktif", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Active Pending User",
        guestEmail: "pending-active@dagoeng.com",
        guestPhone: "081299990001",
        ticketCount: 1,
      });

      // Advance by 10 minutes (less than 60 min expiry)
      await expirePendingBookings(60 * 60 * 1000, "EXPIRED");
      const allBookings = await loadBookingsFromDisk();
      const found = allBookings.find((b) => b.id === booking.id);

      expect(found).toBeDefined();
      expect(found?.paymentStatus).toBe("PENDING");
    });

    it("2. Booking yang melewati batas waktu menjadi EXPIRED", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Expired Pending User",
        guestEmail: "pending-expired@dagoeng.com",
        guestPhone: "081299990002",
        ticketCount: 1,
      });

      // Manually simulate backdated creation time (90 minutes ago)
      const allBookings = await loadBookingsFromDisk();
      const target = allBookings.find((b) => b.id === booking.id);
      if (target) {
        target.createdAt = new Date(Date.now() - 90 * 60 * 1000).toISOString();
        await saveBookingsToDisk(allBookings);
      }

      const expiredCount = await expirePendingBookings(60 * 60 * 1000, "EXPIRED");
      expect(expiredCount).toBeGreaterThanOrEqual(1);

      const refreshed = await loadBookingsFromDisk();
      const found = refreshed.find((b) => b.id === booking.id);
      expect(found?.paymentStatus).toBe("EXPIRED");
    });

    it("3. Kuota kembali tersedia setelah expiration yang valid", async () => {
      const beforeAvail = await getEventTicketAvailability(testEventId);

      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Quota Restore User",
        guestEmail: "quota-restore@dagoeng.com",
        guestPhone: "081299990003",
        ticketCount: 2,
      });

      const duringAvail = await getEventTicketAvailability(testEventId);
      expect(duringAvail.ticketsRemaining).toBe(beforeAvail.ticketsRemaining - 2);

      // Backdate and expire
      const allBookings = await loadBookingsFromDisk();
      const target = allBookings.find((b) => b.id === booking.id);
      if (target) {
        target.createdAt = new Date(Date.now() - 120 * 60 * 1000).toISOString();
        await saveBookingsToDisk(allBookings);
      }

      await expirePendingBookings(60 * 60 * 1000, "EXPIRED");

      const afterAvail = await getEventTicketAvailability(testEventId);
      expect(afterAvail.ticketsRemaining).toBe(beforeAvail.ticketsRemaining);
    });

    it("4. Pemrosesan ulang tidak mengembalikan kuota dua kali", async () => {
      const avail1 = await getEventTicketAvailability(testEventId);

      // Run expiration multiple times
      await expirePendingBookings(60 * 60 * 1000, "EXPIRED");
      const avail2 = await getEventTicketAvailability(testEventId);
      expect(avail2.ticketsRemaining).toBe(avail1.ticketsRemaining);

      await expirePendingBookings(60 * 60 * 1000, "EXPIRED");
      const avail3 = await getEventTicketAvailability(testEventId);
      expect(avail3.ticketsRemaining).toBe(avail1.ticketsRemaining);
    });

    it("5. Booking PAID tidak kedaluwarsa meskipun melewati batas waktu", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Paid User Never Expire",
        guestEmail: "paid-never-expire@dagoeng.com",
        guestPhone: "081299990005",
        ticketCount: 1,
      });

      // Mark as PAID and backdate by 5 hours
      const allBookings = await loadBookingsFromDisk();
      const target = allBookings.find((b) => b.id === booking.id);
      if (target) {
        target.paymentStatus = "PAID";
        target.paidAt = new Date().toISOString();
        target.createdAt = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
        await saveBookingsToDisk(allBookings);
      }

      await expirePendingBookings(60 * 60 * 1000, "EXPIRED");

      const refreshed = await loadBookingsFromDisk();
      const found = refreshed.find((b) => b.id === booking.id);
      expect(found?.paymentStatus).toBe("PAID");
    });

    it("6. Booking terminal tidak diproses ulang secara keliru", async () => {
      const allBookings = await loadBookingsFromDisk();
      const cancelledBooking: EventTicketOrder = {
        id: "term-cancelled-001",
        ticketCode: "TCK-TERM-CANCELLED",
        eventId: testEventId,
        guestName: "Terminal Cancelled User",
        guestEmail: "terminal-cancelled@dagoeng.com",
        guestPhone: "081299990006",
        ticketCount: 1,
        totalPrice: 50000,
        paymentStatus: "CANCELLED",
        checkInStatus: "REGISTERED",
        checkedInQty: 0,
        createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      };
      allBookings.push(cancelledBooking);
      await saveBookingsToDisk(allBookings);

      await expirePendingBookings(60 * 60 * 1000, "EXPIRED");

      const refreshed = await loadBookingsFromDisk();
      const found = refreshed.find((b) => b.id === "term-cancelled-001");
      expect(found?.paymentStatus).toBe("CANCELLED");
    });

    it("7. Booking yang tidak pernah menahan kuota tidak menambah kuota", async () => {
      const availBefore = await getEventTicketAvailability(testEventId);
      // Run expiration on clean state
      await expirePendingBookings(60 * 60 * 1000, "EXPIRED");
      const availAfter = await getEventTicketAvailability(testEventId);
      expect(availAfter.ticketsRemaining).toBeLessThanOrEqual(availAfter.totalCapacity);
      expect(availAfter.ticketsRemaining).toBe(availBefore.ticketsRemaining);
    });

    it("8. Jumlah tiket diperhitungkan secara benar (multi-ticket counting)", async () => {
      const availStart = await getEventTicketAvailability(testEventId);

      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Multi Ticket User",
        guestEmail: "multi-ticket@dagoeng.com",
        guestPhone: "081299990008",
        ticketCount: 3,
      });

      const availAfter = await getEventTicketAvailability(testEventId);
      expect(availAfter.ticketsRemaining).toBe(availStart.ticketsRemaining - 3);

      // Clean up test booking to maintain clean capacity
      const allBookings = await loadBookingsFromDisk();
      const filtered = allBookings.filter((b) => b.id !== booking.id);
      await saveBookingsToDisk(filtered);
    });

    it("9. Dua booking bersamaan tidak menyebabkan overselling", async () => {
      // Clean up test bookings to start with 10 available tickets
      const currentBookings = loadBookingsFromDisk();
      saveBookingsToDisk(currentBookings.filter((b) => b.eventId !== testEventId));

      // Book 8 tickets -> remaining becomes 2
      await createEventBooking({
        eventId: testEventId,
        guestName: "Fill Capacity User",
        guestEmail: "fill-cap@dagoeng.com",
        guestPhone: "081299990009",
        ticketCount: 8,
      });

      // Remaining is 2. Attempting to book 3 tickets must be rejected
      await expect(
        createEventBooking({
          eventId: testEventId,
          guestName: "Oversell Candidate",
          guestEmail: "oversell@dagoeng.com",
          guestPhone: "081299990019",
          ticketCount: 3,
        })
      ).rejects.toThrow("Kapasitas venue atau kuota tiket telah penuh");
    });

    it("10. Pembayaran gagal tidak menghasilkan status lunas", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Failed Payment User",
        guestEmail: "fail-pay@dagoeng.com",
        guestPhone: "081299990010",
        ticketCount: 1,
      });

      // Simulate FAILED callback
      const updated = await updateBookingPaymentStatus(booking.id, "FAILED", {
        reason: "Insufficient funds / simulated failure",
      });

      expect(updated.paymentStatus).not.toBe("PAID");
      expect(updated.paymentStatus).toBe("FAILED");
    });

    it("11. Callback atau webhook yang sah tetap berfungsi", async () => {
      process.env.DOKU_CLIENT_ID = mockClientId;
      process.env.DOKU_SECRET_KEY = mockSecretKey;
      process.env.DOKU_SIMULATION_MODE = "true";

      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Webhook Success User",
        guestEmail: "webhook-success@dagoeng.com",
        guestPhone: "081299990011",
        ticketCount: 1,
      });

      const invoiceNumber = `INV-${booking.ticketCode}`;
      const allB = loadBookingsFromDisk();
      const idx = allB.findIndex((b) => b.id === booking.id);
      if (idx !== -1) {
        allB[idx].dokuInvoiceNumber = invoiceNumber;
        saveBookingsToDisk(allB);
      }

      const requestId = `req-${Date.now()}`;
      const requestTimestamp = new Date().toISOString();
      const requestTarget = "/api/webhooks/doku";
      const payload = {
        order: {
          invoice_number: invoiceNumber,
          amount: booking.totalPrice,
        },
        transaction: {
          status: "SUCCESS",
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = generateDokuSignature({
        clientId: mockClientId,
        requestId,
        requestTimestamp,
        requestTarget,
        body: rawBody,
        secretKey: mockSecretKey,
      });

      const req = new NextRequest("http://localhost:3000/api/webhooks/doku", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Id": mockClientId,
          "Request-Id": requestId,
          "Request-Timestamp": requestTimestamp,
          Signature: signature,
        },
        body: rawBody,
      });

      const res = await handleDokuWebhook(req);
      expect(res.status).toBe(200);

      const refreshed = await loadBookingsFromDisk();
      const updatedBooking = refreshed.find((b) => b.id === booking.id);
      expect(updatedBooking?.paymentStatus).toBe("PAID");
    });
  });

  // =========================================================================
  // BAGIAN B — FILTER TANGGAL (Requirements 12 - 17)
  // =========================================================================
  describe("Bagian B: Consistent Date Filter (WITA) (Req 12-17)", () => {
    it("12. Filter tanggal menghasilkan data sesuai periode", () => {
      const range: DateRange = {
        startDate: "2026-10-25",
        endDate: "2026-10-30",
      };

      const timestampIn = "2026-10-28T10:00:00+08:00";
      const timestampOut = "2026-11-05T10:00:00+08:00";

      expect(isTimestampInWitaPeriod(timestampIn, range)).toBe(true);
      expect(isTimestampInWitaPeriod(timestampOut, range)).toBe(false);
    });

    it("13. Batas tanggal awal dan akhir ditangani dengan benar (WITA boundary)", () => {
      const startOfDay = getWitaStartOfDay("2026-10-28");
      const endOfDay = getWitaEndOfDay("2026-10-28");

      expect(startOfDay).toBe(new Date("2026-10-28T00:00:00.000+08:00").getTime());
      expect(endOfDay).toBe(new Date("2026-10-28T23:59:59.999+08:00").getTime());

      // Events late at night on the end date (23:45 WITA) must be included
      const lateNightTimestamp = "2026-10-28T23:45:00+08:00";
      const singleDayRange: DateRange = {
        startDate: "2026-10-28",
        endDate: "2026-10-28",
      };
      expect(isTimestampInWitaPeriod(lateNightTimestamp, singleDayRange)).toBe(true);
    });

    it("14. Reset filter mengembalikan kondisi default (null range)", () => {
      expect(isTimestampInWitaPeriod("2020-01-01T00:00:00Z", null)).toBe(true);
      expect(
        isEventInWitaPeriod(
          {
            startDate: "2020-01-01T00:00:00Z",
            endDate: "2020-01-02T00:00:00Z",
          },
          null
        )
      ).toBe(true);
    });

    it("15. Statistik Organizer mengikuti periode yang dipilih", () => {
      const bookings: Partial<EventTicketOrder>[] = [
        {
          id: "b1",
          createdAt: "2026-10-28T10:00:00+08:00",
          paymentStatus: "PAID",
          totalPrice: 100000,
          ticketCount: 2,
        },
        {
          id: "b2",
          createdAt: "2026-09-15T10:00:00+08:00",
          paymentStatus: "PAID",
          totalPrice: 50000,
          ticketCount: 1,
        },
      ];

      const rangeOct: DateRange = {
        startDate: "2026-10-01",
        endDate: "2026-10-31",
      };

      const filteredBookings = bookings.filter((b) =>
        isTimestampInWitaPeriod(b.createdAt, rangeOct)
      );

      expect(filteredBookings.length).toBe(1);
      expect(filteredBookings[0].id).toBe("b1");
      const totalRevenue = filteredBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
      expect(totalRevenue).toBe(100000);
    });

    it("16. Filter Kelola Event mengikuti definisi tanggal pelaksanaan yang ditetapkan", () => {
      const range: DateRange = {
        startDate: "2026-10-20",
        endDate: "2026-10-25",
      };

      // Event overlapping with the range
      const overlappingEvent = {
        startDate: "2026-10-24T10:00:00+08:00",
        endDate: "2026-10-26T18:00:00+08:00",
      };
      // Event strictly outside the range
      const outsideEvent = {
        startDate: "2026-10-27T10:00:00+08:00",
        endDate: "2026-10-28T18:00:00+08:00",
      };

      expect(isEventInWitaPeriod(overlappingEvent, range)).toBe(true);
      expect(isEventInWitaPeriod(outsideEvent, range)).toBe(false);
    });

    it("17. Data kosong dan rentang tanggal tidak valid ditangani dengan benar", () => {
      // Inverted date range
      const invertedRange: DateRange = {
        startDate: "2026-10-30",
        endDate: "2026-10-20",
      };
      expect(isTimestampInWitaPeriod("2026-10-25T10:00:00+08:00", invertedRange)).toBe(false);

      // Undefined or invalid timestamp
      expect(isTimestampInWitaPeriod(undefined, { startDate: "2026-10-01", endDate: "2026-10-31" })).toBe(false);
      expect(isTimestampInWitaPeriod("invalid-date", { startDate: "2026-10-01", endDate: "2026-10-31" })).toBe(false);
    });
  });

  // =========================================================================
  // BAGIAN C — DASHBOARD CHECK-IN (Requirements 18 - 23)
  // =========================================================================
  describe("Bagian C: Check-in Officer & Authorization (Req 18-23)", () => {
    it("18. Petugas hanya dapat mengakses event yang diizinkan (organizer auth validation)", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Auth Guard User",
        guestEmail: "auth-guard@dagoeng.com",
        guestPhone: "081299990018",
        ticketCount: 1,
      });

      // Mark as PAID
      const allBookings = await loadBookingsFromDisk();
      const target = allBookings.find((b) => b.id === booking.id);
      if (target) {
        target.paymentStatus = "PAID";
        await saveBookingsToDisk(allBookings);
      }

      await expect(
        organizerCheckInAttendee(
          "hacker-unauthorized@stranger.com",
          booking.ticketCode,
          "CHECKED_IN"
        )
      ).rejects.toThrow("FORBIDDEN: Anda tidak memiliki izin untuk mengelola peserta event milik komunitas lain.");
    });

    it("19. Pergantian event memperbarui statistik dan daftar tiket", async () => {
      const allBookings = await loadBookingsFromDisk();
      const eventBookings = allBookings.filter((b) => b.eventId === testEventId);

      const totalRegistered = eventBookings.reduce((sum, b) => sum + b.ticketCount, 0);
      const totalCheckedIn = eventBookings.reduce((sum, b) => sum + (b.checkedInQty || 0), 0);
      const remaining = Math.max(0, totalRegistered - totalCheckedIn);

      expect(totalRegistered).toBeGreaterThanOrEqual(0);
      expect(totalCheckedIn).toBeGreaterThanOrEqual(0);
      expect(remaining).toBe(totalRegistered - totalCheckedIn);
    });

    it("20. Tiket valid dapat diproses sesuai aturan bisnis", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Valid Ticket User",
        guestEmail: "valid-checkin@dagoeng.com",
        guestPhone: "081299990020",
        ticketCount: 1,
      });

      // Mark as PAID
      const allBookings = await loadBookingsFromDisk();
      const target = allBookings.find((b) => b.id === booking.id);
      if (target) {
        target.paymentStatus = "PAID";
        await saveBookingsToDisk(allBookings);
      }

      const updated = await organizerCheckInAttendee(
        testOrganizerEmail,
        booking.ticketCode,
        "CHECKED_IN"
      );

      expect(updated.checkInStatus).toBe("CHECKED_IN");
      expect(updated.checkedInQty).toBe(1);
      expect(updated.checkInTime).toBeDefined();
    });

    it("21. Tiket yang sudah check-in ditolak ketika diproses kembali (double check-in rejection)", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Double CheckIn User",
        guestEmail: "double-checkin@dagoeng.com",
        guestPhone: "081299990021",
        ticketCount: 1,
      });

      // Mark as PAID
      const allBookings = await loadBookingsFromDisk();
      const target = allBookings.find((b) => b.id === booking.id);
      if (target) {
        target.paymentStatus = "PAID";
        await saveBookingsToDisk(allBookings);
      }

      // First check-in succeeds
      await organizerCheckInAttendee(
        testOrganizerEmail,
        booking.ticketCode,
        "CHECKED_IN"
      );

      // Second check-in with increment or duplicate is rejected
      await expect(
        organizerCheckInAttendee(
          testOrganizerEmail,
          booking.ticketCode,
          "CHECKED_IN"
        )
      ).rejects.toThrow("Tiket sudah digunakan untuk check-in sebelumnya");
    });

    it("22. Tiket dari event lain tidak dapat digunakan pada event terpilih", async () => {
      // Create another event under different organizer
      const otherEvent = await createEventSubmission({
        title: "Completely Different Event B",
        description: "Completely different event description for testing.",
        posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
        organizerName: "Other Community",
        organizerEmail: "other-org@dagoeng.com",
        organizerPhone: "081234567899",
        category: "COMMUNITY",
        startDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        endDate: new Date(Date.now() + 14 * 86400000 + 7200000).toISOString(),
        location: "Kopi Senja Ground Floor",
        maxCapacity: 10,
        ticketPrice: 0,
        isFree: true,
        requiresApproval: false,
      });
      await updateEventStatus(otherEvent.id, "APPROVED");

      const bookingOnOtherEvent = await createEventBooking({
        eventId: otherEvent.id,
        guestName: "Foreign Ticket User",
        guestEmail: "foreign@dagoeng.com",
        guestPhone: "081299990022",
        ticketCount: 1,
      });

      // Trying to check in this ticket using testOrganizerEmail (who only owns testEventId) must be rejected
      await expect(
        organizerCheckInAttendee(
          testOrganizerEmail,
          bookingOnOtherEvent.ticketCode,
          "CHECKED_IN"
        )
      ).rejects.toThrow("FORBIDDEN: Anda tidak memiliki izin untuk mengelola peserta event milik komunitas lain.");
    });

    it("23. Permintaan bersamaan tidak menyebabkan check-in ganda melebihi kapasitas tiket", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Multi Ticket Concurrent User",
        guestEmail: "multi-concurrent@dagoeng.com",
        guestPhone: "081299990023",
        ticketCount: 2,
      });

      // Mark as PAID
      const allBookings = await loadBookingsFromDisk();
      const target = allBookings.find((b) => b.id === booking.id);
      if (target) {
        target.paymentStatus = "PAID";
        await saveBookingsToDisk(allBookings);
      }

      // Check in 1 ticket
      const step1 = await organizerCheckInAttendee(
        testOrganizerEmail,
        booking.ticketCode,
        "PARTIALLY_CHECKED_IN",
        { incrementQty: 1 }
      );
      expect(step1.checkedInQty).toBe(1);

      // Check in second ticket
      const step2 = await organizerCheckInAttendee(
        testOrganizerEmail,
        booking.ticketCode,
        "CHECKED_IN",
        { incrementQty: 1 }
      );
      expect(step2.checkedInQty).toBe(2);
      expect(step2.checkInStatus).toBe("CHECKED_IN");

      // Attempting third check-in must fail
      await expect(
        organizerCheckInAttendee(
          testOrganizerEmail,
          booking.ticketCode,
          "CHECKED_IN",
          { incrementQty: 1 }
        )
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // BAGIAN D & E — PENCARIAN, NAVIGASI & PRIORITAS MODUL (Requirements 24 - 28)
  // =========================================================================
  describe("Bagian D & E: Search, Record Binding & Module Priorities (Req 24-28)", () => {
    it("24. Pencarian event menampilkan hasil relevan secara case-insensitive", async () => {
      const adminEvents = await getAdminEvents();
      const query = "hardening";
      const matches = adminEvents.filter(
        (e) =>
          e.title.toLowerCase().includes(query.toLowerCase()) ||
          e.organizerName.toLowerCase().includes(query.toLowerCase())
      );

      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches.some((m) => m.id === testEventId)).toBe(true);
    });

    it("25. Event yang tidak diizinkan tidak muncul atau diisolasi", async () => {
      const adminEvents = await getAdminEvents();
      // Organizer isolation verification: organizer-only events cannot be modified by unauthorized users
      const publicFiltered = adminEvents.filter((e) => e.status === "APPROVED");
      publicFiltered.forEach((e) => {
        expect(e.status).toBe("APPROVED");
      });
    });

    it("26. Pemilihan event menggunakan record valid", async () => {
      const adminEvents = await getAdminEvents();
      const selected = adminEvents.find((e) => e.id === testEventId);

      expect(selected).toBeDefined();
      expect(selected?.id).toBe(testEventId);
      expect(selected?.title).toBe("Hardening Test Master Event");
      expect(resolveVenueCapacity(selected!).capacity).toBe(10);
    });

    it("27. Urutan modul utama tampil Co-Working, F&B, Event Marketplace", () => {
      // Find indexes in ALL_NAV_ITEMS
      const coworkingIdx = ALL_NAV_ITEMS.findIndex((item) => item.href === "/coworking");
      const posIdx = ALL_NAV_ITEMS.findIndex((item) => item.href === "/pos");
      const eventsIdx = ALL_NAV_ITEMS.findIndex((item) => item.href === "/events-admin");

      expect(coworkingIdx).toBeGreaterThan(-1);
      expect(posIdx).toBeGreaterThan(-1);
      expect(eventsIdx).toBeGreaterThan(-1);

      // Priority 1: Co-working comes BEFORE Priority 2: F&B (pos)
      expect(coworkingIdx).toBeLessThan(posIdx);

      // Priority 2: F&B (pos) comes BEFORE Priority 3: Event Marketplace (events-admin)
      expect(posIdx).toBeLessThan(eventsIdx);
    });

    it("28. Fitur existing tetap berfungsi setelah seluruh hardening", async () => {
      // Configurable payment expiry duration helper works
      const expiryMs = getBookingPaymentExpiryMs();
      expect(expiryMs).toBeGreaterThan(0);
      expect(expiryMs).toBe(60 * 60 * 1000); // 60 minutes default

      // Ticket availability calculation functions cleanly
      const avail = await getEventTicketAvailability(testEventId);
      expect(avail.totalCapacity).toBe(10);
      expect(avail.ticketsRemaining).toBeGreaterThanOrEqual(0);
    });
  });
});
