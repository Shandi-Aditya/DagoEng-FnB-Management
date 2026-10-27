import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  expirePendingBookings,
  getEventTicketAvailability,
  loadBookingsFromDisk,
  saveBookingsToDisk,
  createEventBooking,
  createEventSubmission,
  updateEventStatus,
  getAdminEvents,
  updateBookingCheckIn,
  organizerCheckInAttendee,
  updateBookingPaymentStatus,
} from "@/lib/events";
import { POST as handleDokuWebhook } from "@/app/api/webhooks/doku/route";
import { GET as handleGetMyBookings } from "@/app/api/events/bookings/my/route";
import { POST as handleBookEvent } from "@/app/api/events/[id]/book/route";
import { GET as handleGetPortal } from "@/app/api/events/portal/route";
import { PATCH as handlePortalCheckIn } from "@/app/api/events/portal/check-in/route";
import { GET as handleGetTicketByToken } from "@/app/api/events/tickets/[token]/route";
import { isEmailServiceConfigured, sendTicketConfirmationEmail } from "@/lib/email";
import {
  generateDokuSignature,
  DokuCheckoutError,
} from "@/lib/doku";
import * as dokuModule from "@/lib/doku";
import * as serverAuthModule from "@/lib/server-auth";
import { EventTicketOrder } from "@/types/event";

function sanitizeReturnToTest(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.includes(":")
  ) {
    return trimmed;
  }
  return null;
}

describe("End-to-End Flow Hardening & Audit Fixes (BUG-01 to BUG-04)", () => {
  const mockSecretKey = "SK-DAGOENG-TEST-SECRET-KEY-12345";
  const mockClientId = "MCH-DAGOENG-TEST-001";
  let testEventId = "";

  beforeEach(async () => {
    process.env.DOKU_CLIENT_ID = mockClientId;
    process.env.DOKU_SECRET_KEY = mockSecretKey;
    process.env.DOKU_API_URL = "https://api-sandbox.doku.com";
    process.env.DOKU_SIMULATION_MODE = "true";

    // Setup an approved paid event with capacity 10
    const allEvents = await getAdminEvents();
    const existing = allEvents.find((e) => e.title === "Audit Flow Test Event");
    if (!existing) {
      const created = await createEventSubmission({
        title: "Audit Flow Test Event",
        category: "WORKSHOP",
        description: "Event for testing flow hardening and expiry",
        startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        endDate: new Date(Date.now() + 7 * 86400000 + 7200000).toISOString(),
        location: "Kopi Senja Ground Floor",
        maxCapacity: 10,
        isPaid: true,
        price: 50000,
        posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
        organizerName: "Bandung Developer",
        organizerEmail: "halo@bandungdev.org",
        organizerPhone: "081234567890",
      });
      const approved = await updateEventStatus(created.id, "APPROVED");
      testEventId = approved.id;
    } else {
      testEventId = existing.id;
    }

    // Clean up test bookings for testEventId
    const currentBookings = loadBookingsFromDisk();
    saveBookingsToDisk(currentBookings.filter((b) => b.eventId !== testEventId));
  });

  // =========================================================================
  // BUG-01: Booking Expiry, Capacity Restoration & Webhook Race Condition
  // =========================================================================
  describe("BUG-01: Automated Booking Expiry & Webhook Reconciliation", () => {
    it("otomatis membatalkan booking PENDING yang telah melebihi batas waktu 60 menit dan memulihkan kuota", async () => {
      // 1. Buat booking berbayar baru
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Peserta Expiry Test",
        guestEmail: "expiry.test@example.com",
        guestPhone: "081234567891",
        ticketCount: 3,
        paymentMethod: "QRIS",
      });

      expect(booking.paymentStatus).toBe("PENDING");

      // Cek ketersediaan tiket: kapasitas 10, terpesan 3, sisa 7
      let avail = getEventTicketAvailability(testEventId);
      expect(avail.ticketsReserved).toBe(3);
      expect(avail.ticketsRemaining).toBe(7);

      // 2. Simulasikan waktu berlalu 65 menit (melebihi batas 60 menit)
      const allBookings = loadBookingsFromDisk();
      const idx = allBookings.findIndex((b) => b.id === booking.id);
      expect(idx).not.toBe(-1);
      allBookings[idx].createdAt = new Date(Date.now() - 65 * 60 * 1000).toISOString();
      saveBookingsToDisk(allBookings);

      // 3. Panggil expirePendingBookings atau getEventTicketAvailability
      const expiredCount = expirePendingBookings();
      expect(expiredCount).toBeGreaterThanOrEqual(1);

      // 4. Pastikan status booking berubah menjadi CANCELLED
      const updatedBookings = loadBookingsFromDisk();
      const target = updatedBookings.find((b) => b.id === booking.id);
      expect(target?.paymentStatus).toBe("CANCELLED");

      // 5. Kuota harus pulih kembali penuh 10 tiket
      avail = getEventTicketAvailability(testEventId);
      expect(avail.ticketsReserved).toBe(0);
      expect(avail.ticketsRemaining).toBe(10);
    });

    it("menangani race condition: webhook DOKU SUCCESS merekonsiliasi booking yang sempat CANCELLED karena expiry", async () => {
      // 1. Buat booking yang expired
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Peserta Race Condition",
        guestEmail: "race.condition@example.com",
        guestPhone: "081234567892",
        ticketCount: 2,
        paymentMethod: "QRIS",
      });

      const invoiceNumber = `INV-${booking.ticketCode}`;
      const allBookings = loadBookingsFromDisk();
      const idx = allBookings.findIndex((b) => b.id === booking.id);
      allBookings[idx] = {
        ...allBookings[idx],
        paymentStatus: "CANCELLED",
        dokuInvoiceNumber: invoiceNumber,
      };
      saveBookingsToDisk(allBookings);

      // 2. Webhook DOKU sukses tiba setelah booking berstatus CANCELLED
      const requestId = "req-race-condition";
      const requestTimestamp = new Date().toISOString();
      const requestTarget = "/api/webhooks/doku";
      const payload = {
        order: { invoice_number: invoiceNumber, amount: booking.totalPrice },
        transaction: { status: "SUCCESS" },
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
          "client-id": mockClientId,
          "request-id": requestId,
          "request-timestamp": requestTimestamp,
          signature,
        },
        body: rawBody,
      });

      const res = await handleDokuWebhook(req);
      expect(res.status).toBe(200);

      // 3. Verifikasi rekonsiliasi: status berhasil dipulihkan menjadi PAID
      const reconciledBookings = loadBookingsFromDisk();
      const reconciled = reconciledBookings.find((b) => b.id === booking.id);
      expect(reconciled?.paymentStatus).toBe("PAID");
      expect(reconciled?.paidAt).toBeDefined();
    });

    it("memproses webhook FAILED dan EXPIRED untuk segera membatalkan booking dan membebaskan kuota", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Peserta Failed Payment",
        guestEmail: "failed.payment@example.com",
        guestPhone: "081234567893",
        ticketCount: 2,
        paymentMethod: "QRIS",
      });

      const invoiceNumber = `INV-${booking.ticketCode}`;
      const allBookings = loadBookingsFromDisk();
      const idx = allBookings.findIndex((b) => b.id === booking.id);
      allBookings[idx].dokuInvoiceNumber = invoiceNumber;
      saveBookingsToDisk(allBookings);

      // Webhook FAILED
      const requestId = "req-failed-payment";
      const requestTimestamp = new Date().toISOString();
      const requestTarget = "/api/webhooks/doku";
      const payload = {
        order: { invoice_number: invoiceNumber, amount: booking.totalPrice },
        transaction: { status: "FAILED" },
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
          "client-id": mockClientId,
          "request-id": requestId,
          "request-timestamp": requestTimestamp,
          signature,
        },
        body: rawBody,
      });

      const res = await handleDokuWebhook(req);
      expect(res.status).toBe(200);

      const target = loadBookingsFromDisk().find((b) => b.id === booking.id);
      expect(target?.paymentStatus).toBe("CANCELLED");

      // Idempotency check: kirim ulang webhook FAILED kedua kali dengan request baru
      const reqDup = new NextRequest("http://localhost:3000/api/webhooks/doku", {
        method: "POST",
        headers: {
          "client-id": mockClientId,
          "request-id": requestId,
          "request-timestamp": requestTimestamp,
          signature,
        },
        body: rawBody,
      });
      const resDup = await handleDokuWebhook(reqDup);
      expect(resDup.status).toBe(200);
      const jsonDup = await resDup.json();
      expect(jsonDup.status).toBe("ALREADY_PROCESSED");
    });
  });

  // =========================================================================
  // BUG-02: Open Redirect Validation for returnTo
  // =========================================================================
  describe("BUG-02: Open Redirect Prevention", () => {
    it("menolak URL berbahaya/eksternal dan mengembalikan null", () => {
      expect(sanitizeReturnToTest("https://evil.com")).toBeNull();
      expect(sanitizeReturnToTest("http://attacker.com/steal")).toBeNull();
      expect(sanitizeReturnToTest("//evil.com")).toBeNull();
      expect(sanitizeReturnToTest("/\\evil.com")).toBeNull();
      expect(sanitizeReturnToTest("javascript:alert(1)")).toBeNull();
      expect(sanitizeReturnToTest("data:text/html,<script>alert(1)</script>")).toBeNull();
    });

    it("mengizinkan relative URL yang sah dalam aplikasi", () => {
      expect(sanitizeReturnToTest("/events/portal")).toBe("/events/portal");
      expect(sanitizeReturnToTest("/events")).toBe("/events");
      expect(sanitizeReturnToTest("/customer?tab=TICKETS")).toBe("/customer?tab=TICKETS");
      expect(sanitizeReturnToTest("/dashboard")).toBe("/dashboard");
    });
  });

  // =========================================================================
  // BUG-03: Guest Ticket Endpoint Privacy & High-Entropy Token Access
  // =========================================================================
  describe("BUG-03: Attendee Data Privacy & Guest Token Verification", () => {
    it("menolak akses publik tanpa autentikasi yang hanya menyertakan parameter email (HTTP 401)", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/bookings/my?email=victim@example.com");
      const res = await handleGetMyBookings(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Akses riwayat tiket untuk tamu memerlukan login");
    });

    it("mengizinkan guest mengakses tiket secara aman menggunakan guestToken berkekuatan tinggi", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Guest Token Holder",
        guestEmail: "guest.token@example.com",
        guestPhone: "081234567894",
        ticketCount: 1,
        paymentMethod: "QRIS",
      });

      expect(booking.guestToken).toBeDefined();
      expect(booking.guestToken!.length).toBeGreaterThanOrEqual(32);

      const req = new NextRequest(
        `http://localhost:3000/api/events/bookings/my?guestToken=${booking.guestToken}`
      );
      const res = await handleGetMyBookings(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.count).toBe(1);
      expect(json.data[0].id).toBe(booking.id);
      expect(json.data[0].guestEmail).toBe("guest.token@example.com");
    });

    it("mengizinkan user login mengakses tiket miliknya dan menolak saat mencoba mengambil email orang lain (HTTP 403)", async () => {
      // Mock session user sebagai 'alice@example.com'
      const spyAuth = vi.spyOn(serverAuthModule, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        email: "alice@example.com",
        role: "CUSTOMER",
      } as any);

      try {
        // Akses tiket sendiri: sukses
        const reqSelf = new NextRequest("http://localhost:3000/api/events/bookings/my");
        const resSelf = await handleGetMyBookings(reqSelf);
        expect(resSelf.status).toBe(200);

        // Percobaan manipulasi query email orang lain
        const reqOther = new NextRequest("http://localhost:3000/api/events/bookings/my?email=bob@example.com");
        const resOther = await handleGetMyBookings(reqOther);
        expect(resOther.status).toBe(403);
        const jsonOther = await resOther.json();
        expect(jsonOther.error).toContain("FORBIDDEN");
      } finally {
        spyAuth.mockRestore();
      }
    });
  });

  // =========================================================================
  // BUG-04: DOKU Checkout Initiation Failure Safeguard
  // =========================================================================
  describe("BUG-04: DOKU Checkout Initiation Failure & Quota Rollback", () => {
    it("membatalkan booking secara otomatis dan melepas kuota jika DOKU mengalami definite preflight failure (HTTP 502)", async () => {
      // Mock createDokuCheckoutSession melempar DokuCheckoutError dengan isDefiniteFailure = true
      const spyDoku = vi
        .spyOn(dokuModule, "createDokuCheckoutSession")
        .mockRejectedValue(
          new DokuCheckoutError("MCH-400: Invalid merchant configuration", true, 400)
        );

      try {
        const payload = {
          guestName: "Pembeli Gagal Doku",
          guestEmail: "doku.fail@example.com",
          guestPhone: "081234567895",
          ticketCount: 2,
          paymentMethod: "QRIS",
        };

        const req = new NextRequest(`http://localhost:3000/api/events/${testEventId}/book`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const res = await handleBookEvent(req, { params: { id: testEventId } });
        expect(res.status).toBe(502);

        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toContain("Kuota tiket telah dilepaskan secara aman");

        // Periksa kuota tiket tidak tersandera
        const avail = getEventTicketAvailability(testEventId);
        expect(avail.ticketsReserved).toBe(0);
      } finally {
        spyDoku.mockRestore();
      }
    });

    it("mempertahankan status PENDING jika terjadi network timeout pada gateway (HTTP 504)", async () => {
      // Mock createDokuCheckoutSession melempar DokuCheckoutError dengan isDefiniteFailure = false (timeout)
      const spyDoku = vi
        .spyOn(dokuModule, "createDokuCheckoutSession")
        .mockRejectedValue(
          new DokuCheckoutError("Gateway socket timeout after 10000ms", false)
        );

      try {
        const payload = {
          guestName: "Pembeli Timeout Doku",
          guestEmail: "doku.timeout@example.com",
          guestPhone: "081234567896",
          ticketCount: 1,
          paymentMethod: "QRIS",
        };

        const req = new NextRequest(`http://localhost:3000/api/events/${testEventId}/book`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const res = await handleBookEvent(req, { params: { id: testEventId } });
        expect(res.status).toBe(504);

        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.bookingId).toBeDefined();

        // Booking tersimpan sebagai PENDING agar webhook tetap dapat memproses jika pembayaran berhasil
        const target = loadBookingsFromDisk().find((b) => b.id === json.bookingId);
        expect(target?.paymentStatus).toBe("PENDING");
      } finally {
        spyDoku.mockRestore();
      }
    });
  });

  // =========================================================================
  // SECTION E: Free vs Paid Ticket Registration & Guest Token Leak Prevention
  // =========================================================================
  describe("SECTION E: Participant Flow - Free vs Paid Registration & Token Protection", () => {
    it("tiket GRATIS langsung diterbitkan dengan status PAID tanpa inisiasi pembayaran", async () => {
      // Buat event gratis
      const freeEventSub = await createEventSubmission({
        title: "Community Free Gathering",
        category: "COMMUNITY",
        description: "Gathering santai gratis komunitas Dago",
        startDate: new Date(Date.now() + 5 * 86400000).toISOString(),
        endDate: new Date(Date.now() + 5 * 86400000 + 7200000).toISOString(),
        location: "Ruang Kolaborasi Lantai 2",
        maxCapacity: 20,
        isPaid: false,
        price: 0,
        posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
        organizerName: "Komunitas Kreatif",
        organizerEmail: "info@aksarapriangan.id",
        organizerPhone: "081234567800",
      });
      const freeEvent = await updateEventStatus(freeEventSub.id, "APPROVED");

      const req = new NextRequest(`http://localhost:3000/api/events/${freeEvent.id}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: "Peserta Gratis",
          guestEmail: "free.attendee@example.com",
          guestPhone: "081234567897",
          ticketCount: 1,
        }),
      });

      const res = await handleBookEvent(req, { params: { id: freeEvent.id } });
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.paymentStatus).toBe("PAID");
      expect(json.data.paymentUrl).toBeNull();
      expect(json.data.guestToken).toBeDefined();
      expect(json.data.checkInStatus).toBe("REGISTERED");
    });

    it("guestToken TIDAK dibocorkan ke portal organizer (data sanitization)", async () => {
      // Mock session organizer
      const spyAuth = vi.spyOn(serverAuthModule, "assertOrganizerAuth").mockResolvedValue({
        authorized: true,
        email: "halo@bandungdev.org",
        isAdmin: false,
      } as any);

      try {
        const req = new NextRequest("http://localhost:3000/api/events/portal");
        const res = await handleGetPortal(req);
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.success).toBe(true);
        expect(Array.isArray(json.data.bookings)).toBe(true);

        // Pastikan tidak ada booking yang membocorkan guestToken
        for (const b of json.data.bookings) {
          expect(b.guestToken).toBeUndefined();
        }
      } finally {
        spyAuth.mockRestore();
      }
    });
  });

  // =========================================================================
  // SECTION F: Server-Side QR Check-In & Partial Check-In Validation Engine
  // =========================================================================
  describe("SECTION F: Server-Side QR Check-In & Partial Check-In Engine", () => {
    it("menolak check-in tiket yang statusnya CANCELLED", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Peserta Cancelled Ticket",
        guestEmail: "cancelled.ticket@example.com",
        guestPhone: "081234567898",
        ticketCount: 1,
        paymentMethod: "QRIS",
      });

      // Update jadi CANCELLED
      const all = loadBookingsFromDisk();
      const idx = all.findIndex((b) => b.id === booking.id);
      all[idx].paymentStatus = "CANCELLED";
      saveBookingsToDisk(all);

      await expect(
        updateBookingCheckIn(booking.id, "CHECKED_IN")
      ).rejects.toThrow("Tiket dengan status CANCELLED tidak dapat digunakan untuk check-in.");
    });

    it("menolak check-in tiket berbayar yang statusnya masih PENDING (belum lunas)", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Peserta Pending Ticket",
        guestEmail: "pending.ticket@example.com",
        guestPhone: "081234567899",
        ticketCount: 1,
        paymentMethod: "QRIS",
      });

      expect(booking.paymentStatus).toBe("PENDING");

      await expect(
        updateBookingCheckIn(booking.id, "CHECKED_IN")
      ).rejects.toThrow("Tiket berbayar belum diverifikasi lunas");
    });

    it("menolak check-in dengan ID pemesanan yang tidak ada (404)", async () => {
      await expect(
        updateBookingCheckIn("tkt-non-existent-99999", "CHECKED_IN")
      ).rejects.toThrow("tidak ditemukan");
    });

    it("mendukung Partial Check-In bertahap berdasarkan QTY tiket dan menolak jika melebihi kuota", async () => {
      // 1. Buat pesanan 3 tiket lunas (PAID)
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Keluarga 3 Pax",
        guestEmail: "family3@example.com",
        guestPhone: "081234567812",
        ticketCount: 3,
        paymentMethod: "QRIS",
      });

      // Set lunas
      await updateBookingPaymentStatus(booking.id, "PAID");

      // 2. Check-in 1 orang pertama (incrementQty: 1) -> PARTIALLY_CHECKED_IN (1/3)
      const step1 = await updateBookingCheckIn(booking.id, "PARTIALLY_CHECKED_IN", { incrementQty: 1 });
      expect(step1.checkInStatus).toBe("PARTIALLY_CHECKED_IN");
      expect(step1.checkedInQty).toBe(1);

      // 3. Check-in orang kedua (incrementQty: 1) -> PARTIALLY_CHECKED_IN (2/3)
      const step2 = await updateBookingCheckIn(booking.id, "PARTIALLY_CHECKED_IN", { incrementQty: 1 });
      expect(step2.checkInStatus).toBe("PARTIALLY_CHECKED_IN");
      expect(step2.checkedInQty).toBe(2);

      // 4. Check-in orang ketiga (incrementQty: 1) -> CHECKED_IN (3/3)
      const step3 = await updateBookingCheckIn(booking.id, "CHECKED_IN", { incrementQty: 1 });
      expect(step3.checkInStatus).toBe("CHECKED_IN");
      expect(step3.checkedInQty).toBe(3);

      // 5. Percobaan check-in orang ke-4 (melebihi tiketCount 3) -> DITOLAK
      await expect(
        updateBookingCheckIn(booking.id, "CHECKED_IN", { incrementQty: 1 })
      ).rejects.toThrow("Tiket sudah digunakan untuk check-in sebelumnya");

      // 6. Reset check-in kembali ke 0
      const reset = await updateBookingCheckIn(booking.id, "REGISTERED", { reset: true });
      expect(reset.checkInStatus).toBe("REGISTERED");
      expect(reset.checkedInQty).toBe(0);
    });
  });

  describe("Tahap 5: Dynamic QR E-Ticket & Staff Camera Scanner Validation", () => {
    it("5.1. Mendukung check-in via kode tiket (ticketCode) langsung hasil pemindaian QR kamera", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Budi Peserta QR",
        guestEmail: "budi.qr@example.com",
        guestPhone: "081234567899",
        ticketCount: 1,
        paymentMethod: "QRIS",
      });

      // Tiket belum dibayar -> Ditolak saat discan
      await expect(
        organizerCheckInAttendee("halo@bandungdev.org", booking.ticketCode, "CHECKED_IN")
      ).rejects.toThrow("Tiket berbayar belum diverifikasi lunas");

      // Verifikasi lunas
      await updateBookingPaymentStatus(booking.id, "PAID");

      // Scan QR menghasilkan ticketCode -> check-in berhasil
      const checkedIn = await organizerCheckInAttendee(
        "halo@bandungdev.org",
        booking.ticketCode,
        "CHECKED_IN"
      );
      expect(checkedIn.checkInStatus).toBe("CHECKED_IN");
      expect(checkedIn.checkedInQty).toBe(1);

      // Pemindaian kedua pada tiket yang sama -> Ditolak (anti double check-in)
      await expect(
        organizerCheckInAttendee("halo@bandungdev.org", booking.ticketCode, "CHECKED_IN")
      ).rejects.toThrow("Tiket sudah digunakan untuk check-in sebelumnya");
    });

    it("5.2. Mendukung pemindaian bertahap (partial check-in) via ticketCode untuk rombongan", async () => {
      const groupBooking = await createEventBooking({
        eventId: testEventId,
        guestName: "Rombongan Komunitas QR",
        guestEmail: "rombongan.qr@example.com",
        guestPhone: "081234567888",
        ticketCount: 3,
        paymentMethod: "QRIS",
      });

      await updateBookingPaymentStatus(groupBooking.id, "PAID");

      // Scan 1: 1 orang hadir
      const scan1 = await organizerCheckInAttendee(
        "halo@bandungdev.org",
        groupBooking.ticketCode,
        "PARTIALLY_CHECKED_IN",
        { incrementQty: 1 }
      );
      expect(scan1.checkInStatus).toBe("PARTIALLY_CHECKED_IN");
      expect(scan1.checkedInQty).toBe(1);

      // Scan 2: orang kedua hadir
      const scan2 = await organizerCheckInAttendee(
        "halo@bandungdev.org",
        groupBooking.ticketCode,
        "PARTIALLY_CHECKED_IN",
        { incrementQty: 1 }
      );
      expect(scan2.checkedInQty).toBe(2);

      // Scan 3: orang ketiga hadir -> otomatis selesai
      const scan3 = await organizerCheckInAttendee(
        "halo@bandungdev.org",
        groupBooking.ticketCode,
        "CHECKED_IN",
        { incrementQty: 1 }
      );
      expect(scan3.checkInStatus).toBe("CHECKED_IN");
      expect(scan3.checkedInQty).toBe(3);

      // Scan 4: pemindaian berlebih ditolak
      await expect(
        organizerCheckInAttendee(
          "halo@bandungdev.org",
          groupBooking.ticketCode,
          "CHECKED_IN",
          { incrementQty: 1 }
        )
      ).rejects.toThrow("Tiket sudah digunakan untuk check-in sebelumnya");
    });

    it("5.3. Menolak tiket yang berstatus CANCELLED untuk check-in via QR", async () => {
      const cancelledBooking = await createEventBooking({
        eventId: testEventId,
        guestName: "Peserta Batal QR",
        guestEmail: "batal.qr@example.com",
        guestPhone: "081234567877",
        ticketCount: 1,
        paymentMethod: "QRIS",
      });

      await updateBookingPaymentStatus(cancelledBooking.id, "CANCELLED");

      await expect(
        organizerCheckInAttendee(
          "halo@bandungdev.org",
          cancelledBooking.ticketCode,
          "CHECKED_IN"
        )
      ).rejects.toThrow("Tiket dengan status CANCELLED tidak dapat digunakan untuk check-in.");
    });

    it("5.4. Cross-community protection: Petugas komunitas lain tidak dapat memvalidasi tiket event ini", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Peserta Komunitas Asli",
        guestEmail: "asli.qr@example.com",
        guestPhone: "081234567866",
        ticketCount: 1,
        paymentMethod: "QRIS",
      });

      await updateBookingPaymentStatus(booking.id, "PAID");

      // Petugas dari organizer asing memindai
      await expect(
        organizerCheckInAttendee(
          "other.organizer@example.com",
          booking.ticketCode,
          "CHECKED_IN"
        )
      ).rejects.toThrow("FORBIDDEN: Anda tidak memiliki izin untuk mengelola peserta event milik komunitas lain.");
    });

    it("5.5. Endpoint PATCH /api/events/portal/check-in menerima ticketCode dari scanner kamera", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Peserta API Scanner",
        guestEmail: "api.scanner@example.com",
        guestPhone: "081234567855",
        ticketCount: 2,
        paymentMethod: "QRIS",
      });

      await updateBookingPaymentStatus(booking.id, "PAID");

      // Mock session organizer auth
      vi.spyOn(serverAuthModule, "assertOrganizerAuth").mockResolvedValueOnce({
        authorized: true,
        email: "halo@bandungdev.org",
      });

      const patchReq = new NextRequest("http://localhost:3000/api/events/portal/check-in", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "halo@bandungdev.org",
          ticketCode: booking.ticketCode,
          checkInStatus: "CHECKED_IN",
          incrementQty: 1,
        }),
      });

      const res = await handlePortalCheckIn(patchReq);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.checkedInQty).toBe(1);
      expect(json.data.checkInStatus).toBe("PARTIALLY_CHECKED_IN");
    });
  });

  describe("Tahap 6: Eventbrite-Style Private Ticket Access, Recovery & Email Transparency", () => {
    it("6.1. Guest memesan tiket dan dapat mengakses e-tiket resmi melalui private token URL tanpa login", async () => {
      // 1. Guest memesan tiket
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Audrey Eventbrite Guest",
        guestEmail: "audrey.eventbrite@example.com",
        guestPhone: "081299887766",
        ticketCount: 1,
        paymentMethod: "FREE",
      });

      expect(booking.guestToken).toBeDefined();
      expect(typeof booking.guestToken).toBe("string");
      expect(booking.guestToken!.length).toBeGreaterThanOrEqual(24);

      // 2. Akses tiket via GET /api/events/tickets/[token]
      const req = new NextRequest(`http://localhost:3000/api/events/tickets/${booking.guestToken}`);
      const res = await handleGetTicketByToken(req, { params: { token: booking.guestToken! } });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.ticketCode).toBe(booking.ticketCode);
      expect(json.data.guestName).toBe("Audrey Eventbrite Guest");
      expect(json.data.eventId).toBe(testEventId);
      expect(json.data.eventDetails).toBeDefined();
      expect(json.data.eventDetails.title).toBe("Audit Flow Test Event");
    });

    it("6.2. Tiket berbayar yang masih PENDING menampilkan status belum lunas dan QR terkunci", async () => {
      const pendingBooking = await createEventBooking({
        eventId: testEventId,
        guestName: "Dimas Pending Guest",
        guestEmail: "dimas.pending@example.com",
        guestPhone: "081299887755",
        ticketCount: 1,
        paymentMethod: "QRIS",
      });

      expect(pendingBooking.paymentStatus).toBe("PENDING");

      const req = new NextRequest(`http://localhost:3000/api/events/tickets/${pendingBooking.guestToken}`);
      const res = await handleGetTicketByToken(req, { params: { token: pendingBooking.guestToken! } });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.paymentStatus).toBe("PENDING");
      // Check-in tidak sah untuk tiket pending
      await expect(
        organizerCheckInAttendee("halo@bandungdev.org", json.data.ticketCode, "CHECKED_IN")
      ).rejects.toThrow("Tiket berbayar belum diverifikasi lunas");
    });

    it("6.3. Menolak token akses tiket yang tidak valid, format salah, atau tidak ditemukan (400 & 404)", async () => {
      // Token terlalu pendek
      const shortReq = new NextRequest("http://localhost:3000/api/events/tickets/abc");
      const shortRes = await handleGetTicketByToken(shortReq, { params: { token: "abc" } });
      expect(shortRes.status).toBe(400);

      // Token acak yang tidak ada di database
      const nonExistentToken = "0123456789abcdef0123456789abcdef";
      const notFoundReq = new NextRequest(`http://localhost:3000/api/events/tickets/${nonExistentToken}`);
      const notFoundRes = await handleGetTicketByToken(notFoundReq, { params: { token: nonExistentToken } });
      expect(notFoundRes.status).toBe(404);
      const notFoundJson = await notFoundRes.json();
      expect(notFoundJson.success).toBe(false);
      expect(notFoundJson.error).toContain("Tiket tidak ditemukan");
    });

    it("6.4. Layanan email melaporkan secara jujur EMAIL_SERVICE_NOT_CONFIGURED jika vendor belum disetup", async () => {
      // Verifikasi status saat tidak ada SMTP_HOST atau RESEND_API_KEY
      delete process.env.RESEND_API_KEY;
      delete process.env.SENDGRID_API_KEY;
      delete process.env.SMTP_HOST;

      expect(isEmailServiceConfigured()).toBe(false);

      const result = await sendTicketConfirmationEmail({
        recipientEmail: "test.guest@example.com",
        recipientName: "Test Guest",
        eventTitle: "Community Gathering",
        eventDate: new Date().toISOString(),
        eventLocation: "Courtyard Garden",
        ticketCode: "DAGO-EVT-99999",
        ticketCount: 1,
        totalPrice: 0,
        paymentStatus: "PAID",
        privateAccessUrl: "http://localhost:3000/events/tickets/sample-token",
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toBe("EMAIL_SERVICE_NOT_CONFIGURED");
      expect(result.message).toContain("Layanan pengiriman email belum dikonfigurasi");
    });

    it("6.5. Pemulihan tiket: lookup dengan kode tiket + email yang cocok berhasil mengembalikan tiket", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Rani Recovery Test",
        guestEmail: "rani.recovery@example.com",
        guestPhone: "081299887744",
        ticketCount: 2,
        paymentMethod: "FREE",
      });

      // 1. Lookup berhasil jika ticketCode dan email cocok
      const successReq = new NextRequest(
        `http://localhost:3000/api/events/bookings/my?ticketCode=${booking.ticketCode}&email=rani.recovery@example.com`
      );
      const successRes = await handleGetMyBookings(successReq);
      expect(successRes.status).toBe(200);
      const successJson = await successRes.json();
      expect(successJson.count).toBe(1);
      expect(successJson.data[0].guestToken).toBe(booking.guestToken);

      // 2. Lookup gagal jika email tidak cocok
      const wrongEmailReq = new NextRequest(
        `http://localhost:3000/api/events/bookings/my?ticketCode=${booking.ticketCode}&email=imposter@example.com`
      );
      const wrongEmailRes = await handleGetMyBookings(wrongEmailReq);
      expect(wrongEmailRes.status).toBe(200);
      const wrongEmailJson = await wrongEmailRes.json();
      expect(wrongEmailJson.count).toBe(0);

      // 3. Menolak pemanenan riwayat tanpa token atau login
      const harvestReq = new NextRequest(
        "http://localhost:3000/api/events/bookings/my?email=rani.recovery@example.com"
      );
      const harvestRes = await handleGetMyBookings(harvestReq);
      expect(harvestRes.status).toBe(401);
    });

    it("6.6. Pengalihan tombol Tiket Saya: sanitasi returnTo memastikan URL aman", () => {
      // Valid relative internal paths
      expect(sanitizeReturnToTest("/customer?tab=PROFILE")).toBe("/customer?tab=PROFILE");
      expect(sanitizeReturnToTest("/events/tickets/sample-token")).toBe("/events/tickets/sample-token");

      // Malicious open redirect attempts are rejected
      expect(sanitizeReturnToTest("https://evil.com")).toBeNull();
      expect(sanitizeReturnToTest("//evil.com")).toBeNull();
      expect(sanitizeReturnToTest("/\\evil.com")).toBeNull();
      expect(sanitizeReturnToTest("javascript:alert(1)")).toBeNull();
    });
  });
});
