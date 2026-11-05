import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isDemoLoginAllowed } from "@/lib/server-auth";
import {
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  updateBookingPaymentStatus,
  organizerCheckInAttendee,
  parseToWITAISO,
} from "@/lib/events";

describe("Release Verification & Security Regression Audit", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalEnableDemo = process.env.ENABLE_DEMO_LOGIN;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalVercelEnv !== undefined) {
      process.env.VERCEL_ENV = originalVercelEnv;
    } else {
      delete process.env.VERCEL_ENV;
    }
    if (originalEnableDemo !== undefined) {
      process.env.ENABLE_DEMO_LOGIN = originalEnableDemo;
    } else {
      delete process.env.ENABLE_DEMO_LOGIN;
    }
  });

  describe("1. Security: Demo Login Protection", () => {
    it("Strictly blocks demo login in production when ENABLE_DEMO_LOGIN is not true", () => {
      process.env.NODE_ENV = "production";
      delete process.env.ENABLE_DEMO_LOGIN;
      delete process.env.ALLOW_DEMO_LOGIN;
      delete process.env.ENABLE_ROLE_SIMULATOR;

      const result = isDemoLoginAllowed("CUSTOMER_DEMO");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("FORBIDDEN");
    });

    it("Strictly blocks privileged administrative personas (SUPER_ADMIN, DAGO_OWNER) in production even if demo flag is enabled", () => {
      process.env.NODE_ENV = "production";
      process.env.ENABLE_DEMO_LOGIN = "true";

      const ownerCheck = isDemoLoginAllowed("DAGO_OWNER");
      expect(ownerCheck.allowed).toBe(false);
      expect(ownerCheck.reason).toContain("Akses administratif");

      const adminCheck = isDemoLoginAllowed("SUPER_ADMIN");
      expect(adminCheck.allowed).toBe(false);
      expect(adminCheck.reason).toContain("Akses administratif");

      const managerCheck = isDemoLoginAllowed("COMMERCIAL_MANAGER");
      expect(managerCheck.allowed).toBe(false);
      expect(managerCheck.reason).toContain("Akses administratif");
    });
  });

  describe("2. Check-In Security & Multi-Ticket Isolation", () => {
    it("Enforces sub-ticket uniqueness, duplicate rejection, and cross-event isolation", async () => {
      const orgEmail = `audit-org-${Date.now()}@dagocreative.id`;

      // 1. Create Event 1
      const event1 = await createEventSubmission({
        organizerName: "Komunitas Audit A",
        organizerEmail: orgEmail,
        organizerPhone: "081234567890",
        title: "Workshop Audit Keamanan 2026",
        category: "TECH",
        description: "Audit rilis final MVP 1.",
        startDate: "2026-11-20T09:00:00+08:00",
        endDate: "2026-11-20T17:00:00+08:00",
        location: "Amphitheater Dago",
        isPaid: true,
        price: 50000,
        posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
      });
      await updateEventStatus(event1.id, "APPROVED");

      // 2. Create Event 2 (same organizer)
      const event2 = await createEventSubmission({
        organizerName: "Komunitas Audit A",
        organizerEmail: orgEmail,
        organizerPhone: "081234567890",
        title: "Seminar Terpisah",
        category: "TECH",
        description: "Seminar event kedua.",
        startDate: "2026-11-21T09:00:00+08:00",
        endDate: "2026-11-21T17:00:00+08:00",
        location: "Coworking Dago",
        isPaid: false,
        price: 0,
        posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
      });
      await updateEventStatus(event2.id, "APPROVED");

      // 3. Create a booking for 3 tickets on Event 1
      const booking = await createEventBooking({
        eventId: event1.id,
        guestName: "Peserta Rombongan",
        guestEmail: "rombongan.audit@example.com",
        guestPhone: "085712345678",
        ticketCount: 3,
        paymentMethod: "MANUAL_TRANSFER",
      });

      // Verification: Unpaid booking CANNOT be checked in
      await expect(
        organizerCheckInAttendee(orgEmail, `${booking.ticketCode}-01`, "CHECKED_IN")
      ).rejects.toThrow(/belum diverifikasi lunas/i);

      // Mark payment as PAID
      await updateBookingPaymentStatus(booking.id, "PAID");

      // Check-in Seat #1 -> Must succeed
      const check1 = await organizerCheckInAttendee(
        orgEmail,
        `${booking.ticketCode}-01`,
        "PARTIALLY_CHECKED_IN"
      );
      expect(check1.checkedInQty).toBe(1);
      expect(check1.checkedInSeats).toContain(1);

      // Duplicate Check-in on Seat #1 -> Must be REJECTED
      await expect(
        organizerCheckInAttendee(orgEmail, `${booking.ticketCode}-01`, "PARTIALLY_CHECKED_IN")
      ).rejects.toThrow(/sudah digunakan untuk check-in sebelumnya/i);

      // Check-in Seat #2 -> Must succeed
      const check2 = await organizerCheckInAttendee(
        orgEmail,
        `${booking.ticketCode}-02`,
        "PARTIALLY_CHECKED_IN"
      );
      expect(check2.checkedInQty).toBe(2);
      expect(check2.checkedInSeats).toContain(1);
      expect(check2.checkedInSeats).toContain(2);

      // Invalid Seat #5 (only 3 tickets bought) -> Must be REJECTED
      await expect(
        organizerCheckInAttendee(orgEmail, `${booking.ticketCode}-05`, "PARTIALLY_CHECKED_IN")
      ).rejects.toThrow(/Nomor tiket #5 tidak valid/i);

      // Cross-event isolation: scanning this booking code at Event 2's gate -> Must be REJECTED
      await expect(
        organizerCheckInAttendee(orgEmail, `${booking.ticketCode}-03`, "CHECKED_IN", {
          expectedEventId: event2.id,
        })
      ).rejects.toThrow(/terdaftar pada event lain/i);

      // Check-in Seat #3 at correct event -> Must complete booking check-in
      const check3 = await organizerCheckInAttendee(
        orgEmail,
        `${booking.ticketCode}-03`,
        "CHECKED_IN",
        { expectedEventId: event1.id }
      );
      expect(check3.checkedInQty).toBe(3);
      expect(check3.checkInStatus).toBe("CHECKED_IN");
      expect(check3.checkedInSeats).toEqual([1, 2, 3]);
    });

    it("Guarantees strict concurrency isolation: exactly one of two simultaneous check-ins for the same sub-ticket succeeds", async () => {
      const orgEmail = `race-org-${Date.now()}@dagocreative.id`;
      const event = await createEventSubmission({
        organizerName: "Race Condition Test",
        organizerEmail: orgEmail,
        organizerPhone: "081234567890",
        title: "Race Test Event",
        category: "TECH",
        description: "Testing concurrent check-ins.",
        startDate: "2026-11-20T09:00:00+08:00",
        endDate: "2026-11-20T17:00:00+08:00",
        location: "Amphitheater Dago",
        isPaid: true,
        price: 50000,
        posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
      });
      await updateEventStatus(event.id, "APPROVED");

      const booking = await createEventBooking({
        eventId: event.id,
        guestName: "Simultaneous Scan User",
        guestEmail: "simul@example.com",
        guestPhone: "085712345678",
        ticketCount: 3,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      // Fire two simultaneous check-in requests for Seat #1
      const [attempt1, attempt2] = await Promise.allSettled([
        organizerCheckInAttendee(orgEmail, `${booking.ticketCode}-01`, "PARTIALLY_CHECKED_IN"),
        organizerCheckInAttendee(orgEmail, `${booking.ticketCode}-01`, "PARTIALLY_CHECKED_IN"),
      ]);

      const successes = [attempt1, attempt2].filter((r) => r.status === "fulfilled");
      const failures = [attempt1, attempt2].filter((r) => r.status === "rejected");

      // Exactly one must succeed, exactly one must fail!
      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);
      if (failures[0].status === "rejected") {
        expect(failures[0].reason.message).toContain("sudah digunakan untuk check-in sebelumnya");
      }
    });
  });

  describe("3. Timezone WITA Parsing Consistency", () => {
    it("Ensures datetime-local input is anchored to WITA (+08:00)", () => {
      const parsed = parseToWITAISO("2026-11-10T10:00");
      expect(parsed).toBeDefined();

      const date = new Date(parsed);
      const witaHour = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Makassar",
        hour: "numeric",
        hour12: false,
      }).format(date);

      expect(witaHour).toBe("10");
    });
  });

  describe("4. Revenue Split Platform Integrity", () => {
    it("Ensures proposal does not override active platform default fee (80:20) on pending submissions", async () => {
      const sub = await createEventSubmission({
        organizerName: "Komunitas Kreatif Buleleng",
        organizerEmail: `komunitas-${Date.now()}@buleleng.id`,
        organizerPhone: "081234567800",
        title: "Pameran Seni Rupa Buleleng",
        category: "CREATIVE",
        description: "Pameran lukisan pelukis muda Bali Utara.",
        startDate: "2026-12-01T10:00:00+08:00",
        endDate: "2026-12-01T20:00:00+08:00",
        location: "Art Gallery Dago",
        isPaid: true,
        price: 30000,
        posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
        proposedOrganizerPercent: 90,
        proposedPlatformPercent: 10,
        revenueSplitReason: "Penyelenggara menanggung seluruh perlengkapan pameran",
      });

      expect(sub.status).toBe("PENDING");
      expect(sub.organizerFeePercent).toBe(80);
      expect(sub.customPlatformFeePercent).toBe(20);
      expect(sub.proposedRevenueSplit?.organizerPercent).toBe(90);
      expect(sub.proposedRevenueSplit?.platformPercent).toBe(10);
    });
  });
});