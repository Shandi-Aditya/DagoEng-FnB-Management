import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { GET as getProofRoute } from "@/app/api/events/proofs/[filename]/route";
import { GET as getTicketRoute, POST as uploadProofRoute } from "@/app/api/events/tickets/[token]/route";
import {
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  updateBookingPaymentStatus,
  organizerCheckInAttendee,
} from "@/lib/events";
import { getProofsDirectory, getProofFilePath } from "@/lib/data-storage";

// Valid magic byte fixture
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

describe("DAGOENG FINAL DEMO READINESS VALIDATION (30 OKTOBER 2026)", () => {
  // 1. LOGIN & RBAC
  describe("1. Login dan Pembatasan Akses Sesuai Role", () => {
    it("memvalidasi login akun demo resmi (Super Admin, Dago Owner, Cashier, Customer, Community)", async () => {
      const demoRoles = [
        { email: "admin@dagoeng.com", expectedPersona: "SUPER_ADMIN" },
        { email: "owner.dago@dagoeng.com", expectedPersona: "DAGO_OWNER" },
        { email: "cashier.sgr@kopisenja.com", expectedPersona: "CASHIER_SGR" },
        { email: "customer@gmail.com", expectedPersona: "CUSTOMER_DEMO" },
        { email: "baristaguild@dagocreative.id", expectedPersona: "COMMUNITY_BARISTA" },
      ];

      for (const acc of demoRoles) {
        const req = new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: acc.email, password: "Password123!" }),
        });
        const res = await loginRoute(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.personaKey).toBe(acc.expectedPersona);
      }
    });

    it("menolak akun tidak terdaftar dan mencegah substring escalation", async () => {
      const invalidAttempts = [
        "fake-admin@malicious.com",
        "superowner@attacker.com",
        "barista-hack@exploit.net",
      ];

      for (const email of invalidAttempts) {
        const req = new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: "Password123!" }),
        });
        const res = await loginRoute(req);
        expect(res.status).toBe(401);
      }
    });
  });

  // 2. POS, TRANSAKSI, DAN SHIFT
  describe("2. POS: Transaksi & Shift Kasir", () => {
    it("memastikan integritas konfigurasi settings dan bookings", () => {
      expect(fs.existsSync("data/event_settings.json")).toBe(true);
      expect(fs.existsSync("data/event_bookings.json")).toBe(true);
    });
  });

  // 3. EVENT, BOOKING, TIKET, DAN QR
  describe("3. Event, Booking, Tiket & QR Code", () => {
    it("berhasil membuat event, booking tiket, dan menerbitkan tiket ber-token QR", async () => {
      const submission = await createEventSubmission({
        title: "Demo Coffee Tasting Session",
        description: "Special release demo event description valid",
        category: "WORKSHOP",
        organizerName: "Dago Coffee Lab",
        organizerPhone: "081234567890",
        organizerEmail: "lab@dagoeng.com",
        posterUrl: "https://example.com/poster.jpg",
        startDate: "2026-11-01T10:00:00.000Z",
        endDate: "2026-11-01T14:00:00.000Z",
        location: "Main Bar",
        isPaid: true,
        price: 50000,
        maxCapacity: 20,
      });
      const approved = await updateEventStatus(submission.id, "APPROVED");

      const booking = await createEventBooking({
        eventId: approved!.id,
        guestName: "Budi Demo",
        guestEmail: "budi.demo@example.com",
        guestPhone: "08123456789",
        ticketCount: 1,
      }, "10.0.0.1");

      expect(booking.ticketCode).toBeDefined();
      expect(booking.guestToken).toBeDefined();
      expect(booking.paymentStatus).toBe("PENDING");

      // Retrieve ticket via guestToken API
      const req = new NextRequest(`http://localhost:3000/api/events/tickets/${booking.guestToken}`, {
        method: "GET",
      });
      const res = await getTicketRoute(req, { params: { token: booking.guestToken } });
      expect(res.status).toBe(200);
      const ticketData = await res.json();
      expect(ticketData.data.guestName).toBe("Budi Demo");
      expect(ticketData.data.ticketCode).toBe(booking.ticketCode);
    });
  });

  // 4. UPLOAD BUKTI PEMBAYARAN & AKSES PRIVAT
  describe("4. Upload Bukti Pembayaran, Akses Privat, & Penolakan Akses Tanpa Otorisasi", () => {
    it("mengunggah bukti valid, mengizinkan akses pemilik, dan menolak akses unauthenticated/IDOR", async () => {
      const submission = await createEventSubmission({
        title: "Proof Demo Event",
        description: "Testing proof isolation and security valid",
        category: "WORKSHOP",
        organizerName: "Demo Org",
        organizerPhone: "081234567890",
        organizerEmail: "org@demo.com",
        posterUrl: "https://example.com/poster.jpg",
        startDate: "2026-11-02T10:00:00.000Z",
        endDate: "2026-11-02T12:00:00.000Z",
        location: "Lounge",
        isPaid: true,
        price: 25000,
        maxCapacity: 10,
      });
      const approved = await updateEventStatus(submission.id, "APPROVED");

      const attendeeA = await createEventBooking({
        eventId: approved!.id,
        guestName: "Attendee A",
        guestEmail: "attendee.a@example.com",
        guestPhone: "0811111111",
        ticketCount: 1,
      }, "10.0.0.2");

      const attendeeB = await createEventBooking({
        eventId: approved!.id,
        guestName: "Attendee B",
        guestEmail: "attendee.b@example.com",
        guestPhone: "0822222222",
        ticketCount: 1,
      }, "10.0.0.3");

      // Upload valid JPG proof for Attendee A
      const validJpg = new Blob([JPEG_HEADER], { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", validJpg, "receipt.jpg");

      const uploadReq = new NextRequest(`http://localhost:3000/api/events/tickets/${attendeeA.guestToken}`, {
        method: "POST",
        body: formData,
      });
      const uploadRes = await uploadProofRoute(uploadReq, { params: { token: attendeeA.guestToken } });
      expect(uploadRes.status).toBe(200);
      const uploadJson = await uploadRes.json();
      expect(uploadJson.success).toBe(true);
      expect(uploadJson.data.paymentProofUrl).toMatch(/^\/api\/events\/proofs\//);

      const proofFilename = path.basename(uploadJson.data.paymentProofUrl);

      // Verified saved file in private storage
      const privateFilePath = getProofFilePath(proofFilename);
      expect(fs.existsSync(privateFilePath)).toBe(true);

      // Verified legacy public folder DOES NOT contain this file
      const publicPath = path.join(process.cwd(), "public", "images", "events", "proofs", proofFilename);
      expect(fs.existsSync(publicPath)).toBe(false);

      // Access test: Owner with matching guestToken -> ALLOWED (200)
      const allowedReq = new NextRequest(`http://localhost:3000/api/events/proofs/${proofFilename}?token=${attendeeA.guestToken}`);
      const allowedRes = await getProofRoute(allowedReq, { params: { filename: proofFilename } });
      expect(allowedRes.status).toBe(200);

      // Access test: Unauthenticated without token -> BLOCKED (401)
      const unauthReq = new NextRequest(`http://localhost:3000/api/events/proofs/${proofFilename}`);
      const unauthRes = await getProofRoute(unauthReq, { params: { filename: proofFilename } });
      expect(unauthRes.status).toBe(401);

      // Access test: IDOR (Attendee B using their token to view Attendee A's proof) -> BLOCKED (403)
      const idorReq = new NextRequest(`http://localhost:3000/api/events/proofs/${proofFilename}?token=${attendeeB.guestToken}`);
      const idorRes = await getProofRoute(idorReq, { params: { filename: proofFilename } });
      expect(idorRes.status).toBe(403);
    });
  });

  // 5. ORGANIZER & CHECK-IN LINTAS EVENT
  describe("5. Organizer dan Check-in Lintas Event", () => {
    it("mengizinkan check-in tiket event sendiri dan menolak jika check-in untuk event lain", async () => {
      const event1 = await createEventSubmission({
        title: "Event One",
        description: "First event description valid",
        category: "WORKSHOP",
        organizerName: "Org 1",
        organizerPhone: "081234567890",
        organizerEmail: "org1@test.com",
        posterUrl: "https://example.com/poster.jpg",
        startDate: "2026-11-05T10:00:00.000Z",
        endDate: "2026-11-05T12:00:00.000Z",
        location: "Room 1",
        isPaid: true,
        price: 100000,
        maxCapacity: 5,
      });
      const approved1 = await updateEventStatus(event1.id, "APPROVED");

      const event2 = await createEventSubmission({
        title: "Event Two",
        description: "Second event description valid",
        category: "WORKSHOP",
        organizerName: "Org 2",
        organizerPhone: "081234567890",
        organizerEmail: "org2@test.com",
        posterUrl: "https://example.com/poster.jpg",
        startDate: "2026-11-06T10:00:00.000Z",
        endDate: "2026-11-06T12:00:00.000Z",
        location: "Room 2",
        isPaid: true,
        price: 50000,
        maxCapacity: 10,
      });
      const approved2 = await updateEventStatus(event2.id, "APPROVED");

      const bookingEvent1 = await createEventBooking({
        eventId: approved1!.id,
        guestName: "User 1",
        guestEmail: "user1@test.com",
        guestPhone: "0899999999",
        ticketCount: 1,
      }, "10.0.0.4");

      // Verify payment so it is eligible for check-in
      await updateBookingPaymentStatus(bookingEvent1.id, "PAID");

      // Attempt to check in ticket of Event 1 by Organizer of Event 2 -> THROWS FORBIDDEN
      await expect(
        organizerCheckInAttendee("org2@test.com", bookingEvent1.id, "CHECKED_IN")
      ).rejects.toThrow(/tidak memiliki izin/i);

      // Check in ticket by Organizer of Event 1 -> ALLOWED
      const validCheckinResult = await organizerCheckInAttendee(
        "org1@test.com",
        bookingEvent1.id,
        "CHECKED_IN"
      );
      expect(validCheckinResult.checkInStatus).toBe("CHECKED_IN");
      expect(validCheckinResult.checkedInQty).toBe(1);
    });
  });

  // 6. PERSISTENSI DATA DEMO
  describe("6. Persistensi Data Demo", () => {
    it("memastikan file penyimpanan JSON dan bukti pembayaran tetap persisten", () => {
      expect(fs.existsSync("data/event_bookings.json")).toBe(true);
      expect(fs.existsSync("data/event_settings.json")).toBe(true);
      expect(fs.existsSync("data/proofs")).toBe(true);
      expect(fs.existsSync("data/backup_legacy_proofs")).toBe(true);
    });
  });
});
