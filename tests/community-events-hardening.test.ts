import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import {
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  updateBookingPaymentStatus,
  getOrganizerPortalData,
  organizerCheckInAttendee,
  getEventTicketAvailability,
  updateBookingCheckIn,
} from "../src/lib/events";
import { CommunityEvent, EventTicketOrder } from "../src/types/event";

const DATA_DIR = process.env.DATA_DIR_OVERRIDE || path.join(process.cwd(), "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const BOOKINGS_FILE = path.join(DATA_DIR, "event_bookings.json");

describe("Hardening Event Marketplace — Multi-Tenant, Partial Check-In, Ticket Availability", () => {
  const orgEmailTenantA = `tenant-a-${Date.now()}@dagocreative.id`;
  const orgEmailTenantB = `tenant-b-${Date.now()}@dagocreative.id`;

  let eventA: CommunityEvent;
  let eventB: CommunityEvent;
  let bookingQty3: EventTicketOrder;
  let bookingQty1: EventTicketOrder;
  let originalEventsBackup: string | null = null;
  let originalBookingsBackup: string | null = null;

  beforeAll(async () => {
    if (fs.existsSync(EVENTS_FILE)) originalEventsBackup = fs.readFileSync(EVENTS_FILE, "utf-8");
    if (fs.existsSync(BOOKINGS_FILE)) originalBookingsBackup = fs.readFileSync(BOOKINGS_FILE, "utf-8");

    // 1. Create Event for Tenant A (Paid Workshop, Capacity ~ 50 from Main Hall)
    const subA = await createEventSubmission({
      organizerName: "Komunitas Kreatif A",
      organizerEmail: orgEmailTenantA,
      organizerPhone: "081111111111",
      title: `Creative Masterclass A ${Date.now()}`,
      category: "WORKSHOP",
      description: "Workshop seni grafis dan desain.",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 90000000).toISOString(),
      location: "Main Hall Dago Hub",
      isPaid: true,
      price: 75000,
      posterUrl: "https://images.unsplash.com/photo-1511920170033",
    });
    eventA = await updateEventStatus(subA.id, "APPROVED");

    // 2. Create Event for Tenant B (Free Seminar)
    const subB = await createEventSubmission({
      organizerName: "Komunitas Desain B",
      organizerEmail: orgEmailTenantB,
      organizerPhone: "082222222222",
      title: `UI/UX Seminar B ${Date.now()}`,
      category: "SEMINAR",
      description: "Seminar desain pengalaman pengguna.",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 90000000).toISOString(),
      location: "Co-working Space Dago Hub",
      isPaid: false,
      price: 0,
      posterUrl: "https://images.unsplash.com/photo-1550745165",
    });
    eventB = await updateEventStatus(subB.id, "APPROVED");

    // 3. Create Bookings on Event A:
    // a. Booking with QTY 3
    bookingQty3 = await createEventBooking({
      eventId: eventA.id,
      guestName: "Grup Mahasiswa (3 Pax)",
      guestEmail: `student-group-${Date.now()}@example.com`,
      guestPhone: "081234567890",
      ticketCount: 3,
    });

    // b. Booking with QTY 1
    bookingQty1 = await createEventBooking({
      eventId: eventA.id,
      guestName: "Peserta Mandiri",
      guestEmail: `solo-attendee-${Date.now()}@example.com`,
      guestPhone: "081234567891",
      ticketCount: 1,
    });
  });

  afterAll(() => {
    // Restore backups
    if (originalEventsBackup !== null) {
      fs.writeFileSync(EVENTS_FILE, originalEventsBackup, "utf-8");
    }
    if (originalBookingsBackup !== null) {
      fs.writeFileSync(BOOKINGS_FILE, originalBookingsBackup, "utf-8");
    }
  });

  // ==========================================
  // SECTION 1: MULTI-TENANT DATA ISOLATION
  // ==========================================
  describe("1. Multi-Tenant Data Isolation", () => {
    it("Tenant A portal data should only contain events and attendees belonging to Tenant A", async () => {
      const portalA = await getOrganizerPortalData(orgEmailTenantA);
      expect(portalA.summary.organizerEmail).toBe(orgEmailTenantA);

      // Verify events isolation
      const eventIdsA = portalA.events.map((e) => e.id);
      expect(eventIdsA).toContain(eventA.id);
      expect(eventIdsA).not.toContain(eventB.id);

      // Verify attendees isolation
      const attendeeEventIds = portalA.bookings.map((a) => a.eventId);
      expect(attendeeEventIds.every((id) => id === eventA.id)).toBe(true);
      expect(attendeeEventIds).not.toContain(eventB.id);
    });

    it("Tenant B portal data should not leak Tenant A events or attendees", async () => {
      const portalB = await getOrganizerPortalData(orgEmailTenantB);
      expect(portalB.summary.organizerEmail).toBe(orgEmailTenantB);

      const eventIdsB = portalB.events.map((e) => e.id);
      expect(eventIdsB).toContain(eventB.id);
      expect(eventIdsB).not.toContain(eventA.id);

      const attendeeEventIds = portalB.bookings.map((a) => a.eventId);
      expect(attendeeEventIds).not.toContain(eventA.id);
    });

    it("Cross-tenant check-in should be rejected at backend level", async () => {
      // Tenant B tries to check-in Tenant A's booking
      await expect(
        organizerCheckInAttendee(
          orgEmailTenantB,
          bookingQty3.id,
          "CHECKED_IN"
        )
      ).rejects.toThrow(/Bukan penyelenggara resmi|hanya dapat dikelola|tidak memiliki izin/i);
    });
  });

  // ==========================================
  // SECTION 2: PARTIAL CHECK-IN BERDASARKAN QTY
  // ==========================================
  describe("2. Partial Check-In Berdasarkan QTY", () => {
    it("Paid booking with PENDING payment cannot be checked in", async () => {
      // bookingQty3 is currently PENDING
      await expect(
        organizerCheckInAttendee(
          orgEmailTenantA,
          bookingQty3.id,
          "PARTIALLY_CHECKED_IN",
          { incrementQty: 1 }
        )
      ).rejects.toThrow(/belum diverifikasi lunas|belum lunas|tidak dapat melakukan check-in/i);
    });

    it("Once PAID, booking with QTY 3 can be checked in progressively (0/3 -> 1/3 -> 2/3 -> 3/3)", async () => {
      // Mark as PAID
      await updateBookingPaymentStatus(bookingQty3.id, "PAID");

      // 1st Check-In: 1 of 3
      const checkIn1 = await organizerCheckInAttendee(
        orgEmailTenantA,
        bookingQty3.id,
        "PARTIALLY_CHECKED_IN",
        { incrementQty: 1 }
      );
      expect(checkIn1.checkedInQty).toBe(1);
      expect(checkIn1.checkInStatus).toBe("PARTIALLY_CHECKED_IN");
      expect(checkIn1.paymentStatus).toBe("PAID"); // Payment status must remain PAID

      // 2nd Check-In: 2 of 3
      const checkIn2 = await organizerCheckInAttendee(
        orgEmailTenantA,
        bookingQty3.id,
        "PARTIALLY_CHECKED_IN",
        { incrementQty: 1 }
      );
      expect(checkIn2.checkedInQty).toBe(2);
      expect(checkIn2.checkInStatus).toBe("PARTIALLY_CHECKED_IN");

      // 3rd Check-In: 3 of 3 (Full check-in reached)
      const checkIn3 = await organizerCheckInAttendee(
        orgEmailTenantA,
        bookingQty3.id,
        "CHECKED_IN",
        { incrementQty: 1 }
      );
      expect(checkIn3.checkedInQty).toBe(3);
      expect(checkIn3.checkInStatus).toBe("CHECKED_IN");
      expect(checkIn3.paymentStatus).toBe("PAID");
    });

    it("Check-in beyond QTY should be strictly rejected (cannot over-check-in)", async () => {
      // Attempt 4th check-in on a 3-ticket booking
      await expect(
        organizerCheckInAttendee(
          orgEmailTenantA,
          bookingQty3.id,
          "CHECKED_IN",
          { incrementQty: 1 }
        )
      ).rejects.toThrow(/semua tiket dalam pemesanan ini sudah selesai check-in/i);
    });

    it("Support resetting check-in for correction", async () => {
      const resetResult = await organizerCheckInAttendee(
        orgEmailTenantA,
        bookingQty3.id,
        "REGISTERED",
        { reset: true }
      );
      expect(resetResult.checkedInQty).toBe(0);
      expect(resetResult.checkInStatus).toBe("REGISTERED");
      expect(resetResult.paymentStatus).toBe("PAID");
    });

    it("Single ticket booking (QTY 1) works seamlessly", async () => {
      await updateBookingPaymentStatus(bookingQty1.id, "PAID");

      const checkInSolo = await organizerCheckInAttendee(
        orgEmailTenantA,
        bookingQty1.id,
        "CHECKED_IN"
      );
      expect(checkInSolo.checkedInQty).toBe(1);
      expect(checkInSolo.checkInStatus).toBe("CHECKED_IN");

      // Second check-in on QTY 1 should fail
      await expect(
        organizerCheckInAttendee(
          orgEmailTenantA,
          bookingQty1.id,
          "CHECKED_IN"
        )
      ).rejects.toThrow(/semua tiket dalam pemesanan ini sudah selesai check-in/i);
    });

    it("CANCELLED booking cannot be checked in", async () => {
      // Create a temporary booking and set paymentStatus to CANCELLED
      const tempBooking = await createEventBooking({
        eventId: eventB.id,
        guestName: "Peserta Batal",
        guestEmail: `cancelled-${Date.now()}@example.com`,
        guestPhone: "08999999999",
        ticketCount: 2,
      });
      await updateBookingPaymentStatus(tempBooking.id, "CANCELLED");

      await expect(
        updateBookingCheckIn(tempBooking.id, "CHECKED_IN")
      ).rejects.toThrow(/cancelled|dibatalkan/i);
    });
  });

  // ==========================================
  // SECTION 3: PUBLIC TICKET AVAILABILITY PROGRESS BAR
  // ==========================================
  describe("3. Public Ticket Availability Progress Bar", () => {
    it("Calculates ticket availability based on total tickets reserved (aggregating QTY)", () => {
      const avail = getEventTicketAvailability(eventA.id);

      expect(avail.totalCapacity).toBeGreaterThan(0);
      // Event A has bookingQty3 (3 tickets) and bookingQty1 (1 ticket) -> at least 4 tickets reserved
      expect(avail.ticketsReserved).toBeGreaterThanOrEqual(4);
      expect(avail.ticketsRemaining).toBe(avail.totalCapacity - avail.ticketsReserved);
      expect(avail.occupancyRate).toBe(
        Math.min(100, Math.round((avail.ticketsReserved / avail.totalCapacity) * 100))
      );
      expect(avail.isSoldOut).toBe(avail.ticketsRemaining <= 0);
      expect(typeof avail.isConfirmed).toBe("boolean");
      expect(typeof avail.capacityDescription).toBe("string");
    });

    it("Partial check-in does not change ticketsReserved or sellable capacity", async () => {
      const beforeCheckIn = getEventTicketAvailability(eventA.id);

      // Perform a partial check-in on bookingQty3
      await updateBookingCheckIn(bookingQty3.id, "PARTIALLY_CHECKED_IN", { incrementQty: 1 });

      const afterCheckIn = getEventTicketAvailability(eventA.id);

      // Reserved tickets and occupancy rate should remain identical
      expect(afterCheckIn.ticketsReserved).toBe(beforeCheckIn.ticketsReserved);
      expect(afterCheckIn.ticketsRemaining).toBe(beforeCheckIn.ticketsRemaining);
      expect(afterCheckIn.occupancyRate).toBe(beforeCheckIn.occupancyRate);
    });
  });
});
