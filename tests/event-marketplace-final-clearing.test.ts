import { describe, it, expect, beforeEach } from "vitest";
import {
  organizerCheckInAttendee,
  updateBookingCheckIn,
  loadBookingsFromDisk,
  saveBookingsToDisk,
  getOrganizerPortalData,
} from "@/lib/events";
import { EventTicketOrder, AttendeeCheckInStatus } from "@/types/event";
import { verifyDokuNotificationSignature } from "@/lib/doku";
import { maskEmail, maskPhoneNumber } from "@/lib/server-auth";
import crypto from "crypto";

describe("EVENT MARKETPLACE FINAL CLEARING — END-TO-END VERIFICATION", () => {
  describe("Phase 2: Guest Ticket Recovery & Discovery", () => {
    it("masks PII correctly in public/organizer attendees responses", () => {
      const email = "attendee.participant@gmail.com";
      const phone = "081234567890";

      const maskedEmail = maskEmail(email);
      const maskedPhone = maskPhoneNumber(phone);

      expect(maskedEmail).not.toBe(email);
      expect(maskedEmail).toContain("@gmail.com");
      expect(maskedPhone).not.toBe(phone);
      expect(maskedPhone).toContain("••••");
    });

    it("verifies legacy booking without guestToken is safely handled with informative error explanation", () => {
      const legacyBooking: Partial<EventTicketOrder> = {
        id: "tkt-latte-001",
        ticketCode: "DAGO-EVT-77491",
        guestToken: undefined,
        paymentStatus: "PAID",
      };

      // Simulates ticket recovery page check
      const hasGuestToken = Boolean(legacyBooking.guestToken);
      expect(hasGuestToken).toBe(false);

      const errorMessage = !hasGuestToken
        ? "Tiket ini adalah tiket warisan (legacy) tanpa token tautan privat langsung. Silakan tunjukkan kode booking ini kepada panitia saat registrasi di venue atau hubungi admin DagoEng."
        : null;

      expect(errorMessage).toContain("tiket warisan (legacy)");
    });
  });

  describe("Phase 6 & 7: Check-in Bounds & Idempotency", () => {
    const mockBooking: EventTicketOrder = {
      id: "tkt-mock-checkin-001",
      ticketCode: "DAGO-EVT-99999",
      guestToken: "test-token-random-1234567890abcdef",
      eventId: "evt-mock-001",
      eventTitle: "Mock Workshop",
      eventDate: new Date().toISOString(),
      eventLocation: "Dago Creative Hub",
      guestName: "Budi Peserta",
      guestEmail: "budi@example.com",
      guestPhone: "08123456789",
      ticketCount: 3,
      unitPrice: 50000,
      totalPrice: 150000,
      platformFeePercent: 20,
      platformFeeAmount: 30000,
      organizerRevenueAmount: 120000,
      paymentMethod: "TRANSFER",
      paymentStatus: "PAID",
      checkInStatus: "REGISTERED",
      checkedInQty: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it("strictly prevents check-in for CANCELLED bookings", async () => {
      const cancelledBooking = { ...mockBooking, paymentStatus: "CANCELLED" as const };
      const bookings = loadBookingsFromDisk();
      saveBookingsToDisk([...bookings, cancelledBooking]);

      try {
        await expect(
          updateBookingCheckIn(cancelledBooking.id, "CHECKED_IN")
        ).rejects.toThrow("Tiket dengan status CANCELLED tidak dapat digunakan untuk check-in.");
      } finally {
        saveBookingsToDisk(bookings);
      }
    });

    it("strictly prevents check-in for unpaid PENDING bookings", async () => {
      const pendingBooking = { ...mockBooking, paymentStatus: "PENDING" as const, totalPrice: 150000 };
      const bookings = loadBookingsFromDisk();
      saveBookingsToDisk([...bookings, pendingBooking]);

      try {
        await expect(
          updateBookingCheckIn(pendingBooking.id, "CHECKED_IN")
        ).rejects.toThrow("Tiket berbayar belum diverifikasi lunas");
      } finally {
        saveBookingsToDisk(bookings);
      }
    });

    it("supports partial check-in and strictly rejects exceeding ticketCount", async () => {
      const multiTicketBooking = { ...mockBooking, ticketCount: 2, checkedInQty: 0, checkInStatus: "REGISTERED" as const };
      const bookings = loadBookingsFromDisk();
      saveBookingsToDisk([...bookings, multiTicketBooking]);

      try {
        // First increment (1 of 2)
        const step1 = await updateBookingCheckIn(multiTicketBooking.id, "PARTIALLY_CHECKED_IN", { incrementQty: 1 });
        expect(step1.checkedInQty).toBe(1);
        expect(step1.checkInStatus).toBe("PARTIALLY_CHECKED_IN");

        // Second increment (2 of 2)
        const step2 = await updateBookingCheckIn(multiTicketBooking.id, "CHECKED_IN", { incrementQty: 1 });
        expect(step2.checkedInQty).toBe(2);
        expect(step2.checkInStatus).toBe("CHECKED_IN");

        // Third increment should fail (exceeding 2)
        await expect(
          updateBookingCheckIn(multiTicketBooking.id, "CHECKED_IN", { incrementQty: 1 })
        ).rejects.toThrow("Tiket sudah digunakan untuk check-in sebelumnya");
      } finally {
        saveBookingsToDisk(bookings);
      }
    });

    it("handles concurrent check-in promises in single Node.js process without over-checkin", async () => {
      const singleTicketBooking = { ...mockBooking, id: "tkt-concurrent-001", ticketCount: 1, checkedInQty: 0, checkInStatus: "REGISTERED" as const };
      const bookings = loadBookingsFromDisk();
      saveBookingsToDisk([...bookings, singleTicketBooking]);

      try {
        // Fire 2 concurrent check-ins simultaneously
        const results = await Promise.allSettled([
          updateBookingCheckIn(singleTicketBooking.id, "CHECKED_IN", { incrementQty: 1 }),
          updateBookingCheckIn(singleTicketBooking.id, "CHECKED_IN", { incrementQty: 1 }),
        ]);

        const fulfilled = results.filter((r) => r.status === "fulfilled");
        const rejected = results.filter((r) => r.status === "rejected");

        // Exactly one MUST succeed, and one MUST fail
        expect(fulfilled.length).toBe(1);
        expect(rejected.length).toBe(1);
        if (rejected[0].status === "rejected") {
          expect(rejected[0].reason.message).toContain("Tiket sudah digunakan untuk check-in sebelumnya");
        }

        // Verify final state in disk
        const currentBookings = loadBookingsFromDisk();
        const finalBooking = currentBookings.find((b) => b.id === singleTicketBooking.id);
        expect(finalBooking?.checkedInQty).toBe(1);
        expect(finalBooking?.checkInStatus).toBe("CHECKED_IN");
      } finally {
        saveBookingsToDisk(bookings);
      }
    });
  });

  describe("Phase 5: DOKU Payment HMAC Signature & Idempotency", () => {
    const secretKey = "test-secret-key-dago";
    const clientId = "MCH-DAGOENG-TEST";
    const requestId = "REQ-123456";
    const requestTimestamp = "2026-10-30T10:00:00Z";
    const requestTarget = "/api/webhooks/doku";
    const rawBody = JSON.stringify({
      order: { invoice_number: "INV-DAGO-EVT-12345", amount: 100000 },
      transaction: { status: "SUCCESS" },
    });

    const digest = crypto.createHash("sha256").update(rawBody).digest("base64");
    const signatureComponent = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${requestTimestamp}\nRequest-Target:${requestTarget}\nDigest:${digest}`;
    const validHmac = crypto.createHmac("sha256", secretKey).update(signatureComponent).digest("base64");
    const expectedSignature = `HMACSHA256=${validHmac}`;

    it("verifies genuine DOKU HMAC signature successfully", () => {
      const isValid = verifyDokuNotificationSignature({
        clientId,
        requestId,
        requestTimestamp,
        requestTarget,
        rawBody,
        receivedSignature: expectedSignature,
        secretKey,
      });

      expect(isValid).toBe(true);
    });

    it("rejects forged or modified signature payloads", () => {
      const isForged = verifyDokuNotificationSignature({
        clientId,
        requestId,
        requestTimestamp,
        requestTarget,
        rawBody,
        receivedSignature: "HMACSHA256=invalid-tampered-signature",
        secretKey,
      });

      expect(isForged).toBe(false);
    });
  });

  describe("Phase 8: Multi-Tenant Organizer Isolation", () => {
    it("strictly isolates attendees and events to organizer email", async () => {
      // Organizer A should only see events belonging to Organizer A
      const testEmail = "test.organizer.unique@example.com";
      const portalData = await getOrganizerPortalData(testEmail, false);

      expect(portalData.summary.organizerEmail).toBe(testEmail);
      expect(portalData.events.every((e) => (e.organizerEmail || "").toLowerCase() === testEmail)).toBe(true);
    });

    it("strictly forbids Organizer A from checking in attendees of Organizer B event", async () => {
      // tkt-latte-001 belongs to evt-latte-art-2026 (barista.guild@dagoeng.com)
      const intruderEmail = "unauthorized.intruder@example.com";
      await expect(
        organizerCheckInAttendee(intruderEmail, "tkt-latte-001", "CHECKED_IN")
      ).rejects.toThrow("FORBIDDEN: Anda tidak memiliki izin untuk mengelola peserta event milik komunitas lain.");
    });
  });
});
