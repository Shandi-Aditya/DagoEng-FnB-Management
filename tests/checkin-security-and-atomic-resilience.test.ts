import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  updateBookingPaymentStatus,
  updateBookingCheckIn,
  organizerCheckInAttendee,
  getEventBookings,
} from "@/lib/events";
import {
  PATCH as handleAdminCheckIn,
  DELETE as handleDeleteBooking,
} from "@/app/api/events/bookings/[id]/route";
import { PATCH as handleOrganizerCheckIn } from "@/app/api/events/portal/check-in/route";

describe("Check-in Security, Anti-Bypass, and Atomic Resilience Test Suite", () => {
  const orgEmail = "security-audit-org@dagocreative.id";
  let futureEventId: string;
  let nowEventId: string;

  beforeEach(async () => {
    // 1. Event in the distant future (Dec 25, 2026 10:00 WITA)
    const futureEv = await createEventSubmission({
      organizerName: "Komunitas Audit",
      organizerEmail: orgEmail,
      organizerPhone: "081234567890",
      title: "Konser Natal 2026",
      category: "COMMUNITY",
      description: "Konser Musik Akhir Tahun",
      startDate: "2026-12-25T10:00:00+08:00",
      endDate: "2026-12-25T23:00:00+08:00",
      location: "Amphitheater Dago",
      isPaid: true,
      price: 100000,
      posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
    });
    await updateEventStatus(futureEv.id, "APPROVED");
    futureEventId = futureEv.id;

    // 2. Event happening right now (start 1 hour ago)
    const nowIso = new Date(Date.now() - 3600000).toISOString();
    const endIso = new Date(Date.now() + 5 * 3600000).toISOString();
    const nowEv = await createEventSubmission({
      organizerName: "Komunitas Audit",
      organizerEmail: orgEmail,
      organizerPhone: "081234567890",
      title: "Live Event Hari Ini",
      category: "COMMUNITY",
      description: "Event yang sedang berlangsung",
      startDate: nowIso,
      endDate: endIso,
      location: "Coworking Space Dago",
      isPaid: true,
      price: 50000,
      posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
    });
    await updateEventStatus(nowEv.id, "APPROVED");
    nowEventId = nowEv.id;
  });

  describe("1. Client-Controlled Bypass Elimination", () => {
    it("menolak request check-in jika dilakukan sebelum H-2 dan mengabaikan bypassWindow dari request body", async () => {
      const booking = await createEventBooking({
        eventId: futureEventId,
        guestName: "Hacker Attempt",
        guestEmail: "hacker@example.com",
        guestPhone: "08123456780",
        ticketCount: 1,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      // Attempt to hit admin endpoint with bypassWindow=true in body
      const req = new NextRequest(
        `http://localhost:3000/api/events/bookings/${booking.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            cookie: "dagoeng_active_persona=SUPER_ADMIN",
          },
          body: JSON.stringify({
            checkInStatus: "CHECKED_IN",
            bypassWindow: true,
            bypassDateWindow: true,
          }),
        }
      );

      const res = await handleAdminCheckIn(req, {
        params: Promise.resolve({ id: booking.id }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/check-in belum dibuka/i);
    });

    it("menolak request portal organizer jika dilakukan sebelum H-2 dan mengabaikan bypassDateWindow dari body", async () => {
      const booking = await createEventBooking({
        eventId: futureEventId,
        guestName: "Organizer Early Bypass",
        guestEmail: "early@example.com",
        guestPhone: "08123456780",
        ticketCount: 1,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      const req = new NextRequest("http://localhost:3000/api/events/portal/check-in", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: "dagoeng_active_persona=SUPER_ADMIN",
        },
        body: JSON.stringify({
          email: orgEmail,
          ticketCode: booking.ticketCode,
          eventId: futureEventId,
          checkInStatus: "CHECKED_IN",
          bypassDateWindow: true,
          bypassWindow: true,
        }),
      });

      const res = await handleOrganizerCheckIn(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/check-in belum dibuka/i);
    });

    it("menolak request check-in dari customer yang tidak memiliki hak akses check-in", async () => {
      const booking = await createEventBooking({
        eventId: nowEventId,
        guestName: "Customer Direct Scan",
        guestEmail: "cust@example.com",
        guestPhone: "08123456780",
        ticketCount: 1,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      const req = new NextRequest(
        `http://localhost:3000/api/events/bookings/${booking.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            cookie: "dagoeng_active_persona=CUSTOMER",
          },
          body: JSON.stringify({
            checkInStatus: "CHECKED_IN",
          }),
        }
      );

      const res = await handleAdminCheckIn(req, {
        params: Promise.resolve({ id: booking.id }),
      });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toMatch(/UNAUTHORIZED|FORBIDDEN/i);
    });
    it("menolak request check-in jika dilakukan oleh organizer terhadap event milik komunitas lain", async () => {
      const booking = await createEventBooking({
        eventId: nowEventId,
        guestName: "Cross Org Attendee",
        guestEmail: "cross@example.com",
        guestPhone: "08123456789",
        ticketCount: 1,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      // Attempt by another organizer
      await expect(
        organizerCheckInAttendee("another.organizer@dagocreative.id", booking.ticketCode, "CHECKED_IN")
      ).rejects.toThrow(/FORBIDDEN|tidak memiliki izin/i);
    });

    it("menolak check-in jika event berstatus CANCELLED / ARCHIVED", async () => {
      const booking = await createEventBooking({
        eventId: nowEventId,
        guestName: "Cancelled Evt Attendee",
        guestEmail: "cancel@example.com",
        guestPhone: "08123456789",
        ticketCount: 1,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      await updateEventStatus(nowEventId, "REJECTED");

      await expect(
        updateBookingCheckIn(booking.ticketCode, "CHECKED_IN", {
          enforceDateWindow: false,
        })
      ).rejects.toThrow(/telah dibatalkan atau ditolak/i);
    });
  });

  describe("2. Backward Compatibility & Seat Normalization", () => {
    it("menormalisasi tiket legacy single (tanpa suffix) menjadi seat 1 dan atomic lock berjalan", async () => {
      const booking = await createEventBooking({
        eventId: nowEventId,
        guestName: "Legacy Single Ticket",
        guestEmail: "legacy@example.com",
        guestPhone: "08111111111",
        ticketCount: 1,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      // Check-in without suffix (only passing raw ticket code e.g. DAGO-EVT-XXXXX)
      const res = await updateBookingCheckIn(booking.ticketCode, "CHECKED_IN", {
        enforceDateWindow: false,
      });

      expect(res.checkInStatus).toBe("CHECKED_IN");
      expect(res.checkedInQty).toBe(1);
      expect(res.checkedInSeats).toEqual([1]);
      expect(res.seatCheckInTimes?.["1"]).toBeDefined();

      // Attempting to check in again must be rejected
      await expect(
        updateBookingCheckIn(booking.ticketCode, "CHECKED_IN", {
          enforceDateWindow: false,
        })
      ).rejects.toThrow(/sudah dipakai, check-in pukul/i);
    });

    it("memproses dua tiket berbeda dalam booking yang sama secara terpisah", async () => {
      const booking = await createEventBooking({
        eventId: nowEventId,
        guestName: "Group Two",
        guestEmail: "group2@example.com",
        guestPhone: "08222222222",
        ticketCount: 2,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      const t1 = `${booking.ticketCode}-01`;
      const t2 = `${booking.ticketCode}-02`;

      const res1 = await updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: t1,
        enforceDateWindow: false,
      });
      expect(res1.checkedInQty).toBe(1);
      expect(res1.checkInStatus).toBe("PARTIALLY_CHECKED_IN");
      expect(res1.checkedInSeats).toEqual([1]);

      const res2 = await updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: t2,
        enforceDateWindow: false,
      });
      expect(res2.checkedInQty).toBe(2);
      expect(res2.checkInStatus).toBe("CHECKED_IN");
      expect(res2.checkedInSeats).toEqual(expect.arrayContaining([1, 2]));
    });
  });

  describe("3. Storage Conflict Handling & Retry Resilience", () => {
    it("retry berhasil saat terjadi konflik konkurensi (LOST_UPDATE_PREVENTED)", async () => {
      const booking = await createEventBooking({
        eventId: nowEventId,
        guestName: "Retry Attendee",
        guestEmail: "retry@example.com",
        guestPhone: "08333333333",
        ticketCount: 1,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      // Verify that checking in succeeds cleanly
      const res = await updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: `${booking.ticketCode}-01`,
        enforceDateWindow: false,
      });

      expect(res.checkInStatus).toBe("CHECKED_IN");
      expect(res.checkedInQty).toBe(1);
    });
  });

  describe("4. Distinct QR Payload Verification", () => {
    it("menghasilkan payload unik untuk setiap sub-tiket kursi dalam pemesanan multi-tiket", async () => {
      const booking = await createEventBooking({
        eventId: nowEventId,
        guestName: "Family Ticket",
        guestEmail: "family@example.com",
        guestPhone: "08444444444",
        ticketCount: 3,
        paymentMethod: "MANUAL_TRANSFER",
      });

      const qrPayloads = Array.from({ length: booking.ticketCount }).map((_, i) => {
        const seatNum = i + 1;
        const subCode = `${booking.ticketCode}-${String(seatNum).padStart(2, "0")}`;
        return JSON.stringify({
          ticketCode: subCode,
          eventId: booking.eventId,
          seat: seatNum,
        });
      });

      // Verify payloads are 100% distinct
      const uniquePayloads = new Set(qrPayloads);
      expect(uniquePayloads.size).toBe(3);

      // Verify seat 1, 2, 3 content
      const p1 = JSON.parse(qrPayloads[0]);
      const p2 = JSON.parse(qrPayloads[1]);
      const p3 = JSON.parse(qrPayloads[2]);

      expect(p1.ticketCode).toBe(`${booking.ticketCode}-01`);
      expect(p1.seat).toBe(1);
      expect(p2.ticketCode).toBe(`${booking.ticketCode}-02`);
      expect(p2.seat).toBe(2);
      expect(p3.ticketCode).toBe(`${booking.ticketCode}-03`);
      expect(p3.seat).toBe(3);
    });

    it("menolak request PATCH dengan body kosong ({}) untuk menutup celah IDOR kebocoran data tamu", async () => {
      const booking = await createEventBooking({
        eventId: nowEventId,
        guestName: "Target IDOR Victim",
        guestEmail: "victim@example.com",
        guestPhone: "081999888777",
        ticketCount: 1,
        paymentMethod: "CASH",
      });

      const req = new NextRequest(`http://localhost:3000/api/events/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const res = await handleAdminCheckIn(req, {
        params: Promise.resolve({ id: booking.id }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.data).toBeUndefined();
      expect(data.guestEmail).toBeUndefined();
      expect(data.guestToken).toBeUndefined();
    });

    it("menghapus guestToken dan menyamarkan email/telepon untuk staf check-in non-Hub-Admin", async () => {
      const booking = await createEventBooking({
        eventId: nowEventId,
        guestName: "Budi Sanjaya",
        guestEmail: "budi.sanjaya@example.com",
        guestPhone: "081234567890",
        ticketCount: 1,
        paymentMethod: "CASH",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      const req = new NextRequest(`http://localhost:3000/api/events/bookings/${booking.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: "dagoeng_active_persona=EVENT_STAFF",
        },
        body: JSON.stringify({
          checkInStatus: "CHECKED_IN",
        }),
      });

      const res = await handleAdminCheckIn(req, {
        params: Promise.resolve({ id: booking.id }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.guestToken).toBeUndefined();
      expect(data.data.guestEmail).not.toBe("budi.sanjaya@example.com");
      expect(data.data.guestEmail).toContain("***");
      expect(data.data.guestPhone).not.toBe("081234567890");
      expect(data.data.guestPhone).toContain("••••");
    });

    it("menolak payload multi-intent (gabungan checkInStatus dan paymentProofUrl) dan menolak unauthenticated sebelum lookup 404", async () => {
      const booking = await createEventBooking({
        eventId: nowEventId,
        guestName: "Multi Intent Target",
        guestEmail: "multi@example.com",
        guestPhone: "081234567891",
        ticketCount: 1,
        paymentMethod: "CASH",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      const conflictReq = new NextRequest(`http://localhost:3000/api/events/bookings/${booking.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: "dagoeng_active_persona=EVENT_STAFF",
        },
        body: JSON.stringify({
          checkInStatus: "CHECKED_IN",
          paymentProofUrl: "https://example.com/proof.png",
        }),
      });
      const conflictRes = await handleAdminCheckIn(conflictReq, {
        params: Promise.resolve({ id: booking.id }),
      });
      expect(conflictRes.status).toBe(400);

      const oracleReq = new NextRequest("http://localhost:3000/api/events/bookings/non-existent-id-999", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE_PAYMENT" }),
      });
      const oracleRes = await handleAdminCheckIn(oracleReq, {
        params: Promise.resolve({ id: "non-existent-id-999" }),
      });
      expect(oracleRes.status).toBe(403);

      const proofOracleReq = new NextRequest("http://localhost:3000/api/events/bookings/non-existent-id-999", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-guest-token": "dummy-probe-token" },
        body: JSON.stringify({ paymentProofUrl: "https://example.com/proof.png" }),
      });
      const proofOracleRes = await handleAdminCheckIn(proofOracleReq, {
        params: Promise.resolve({ id: "non-existent-id-999" }),
      });
      expect(proofOracleRes.status).toBe(403);

      const invalidQtyReq = new NextRequest(`http://localhost:3000/api/events/bookings/${booking.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: "dagoeng_active_persona=EVENT_STAFF",
        },
        body: JSON.stringify({
          checkInStatus: "CHECKED_IN",
          incrementQty: "1",
        }),
      });
      const invalidQtyRes = await handleAdminCheckIn(invalidQtyReq, {
        params: Promise.resolve({ id: booking.id }),
      });
      expect(invalidQtyRes.status).toBe(400);
    });

    it("menghapus guestToken dari respons DELETE /api/events/bookings/[id]", async () => {
      const booking = await createEventBooking({
        eventId: futureEventId,
        guestName: "Delete Sanitize Check",
        guestEmail: "delete.sanitize@example.com",
        guestPhone: "081234567892",
        ticketCount: 1,
        paymentMethod: "MANUAL_TRANSFER",
      });

      const delReq = new NextRequest(`http://localhost:3000/api/events/bookings/${booking.id}`, {
        method: "DELETE",
        headers: { cookie: "dagoeng_active_persona=SUPER_ADMIN" },
      });
      const delRes = await handleDeleteBooking(delReq, {
        params: Promise.resolve({ id: booking.id }),
      });
      const delJson = await delRes.json();

      expect(delRes.status).toBe(200);
      expect(delJson.data.guestToken).toBeUndefined();
    });
  });
});
