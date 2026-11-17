import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import {
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  getEventTicketAvailability,
  validateEventBooking,
} from "../src/lib/events";
import {
  validateBookingInput,
} from "../src/features/event-detail/event-detail-domain";
import { CommunityEvent, EventTicketOrder, EventTicketTier } from "../src/types/event";

const DATA_DIR = process.env.DATA_DIR_OVERRIDE || path.join(process.cwd(), "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const BOOKINGS_FILE = path.join(DATA_DIR, "event_bookings.json");

describe("Event Ticket Tiers (Jenis Tiket Bertingkat) - Task S-12", () => {
  let originalEventsBackup: string | null = null;
  let originalBookingsBackup: string | null = null;

  beforeAll(() => {
    if (fs.existsSync(EVENTS_FILE)) originalEventsBackup = fs.readFileSync(EVENTS_FILE, "utf-8");
    if (fs.existsSync(BOOKINGS_FILE)) originalBookingsBackup = fs.readFileSync(BOOKINGS_FILE, "utf-8");
  });

  afterAll(() => {
    if (originalEventsBackup !== null) fs.writeFileSync(EVENTS_FILE, originalEventsBackup, "utf-8");
    if (originalBookingsBackup !== null) fs.writeFileSync(BOOKINGS_FILE, originalBookingsBackup, "utf-8");
  });

  describe("Domain & Form Validation", () => {
    it("validates that ticket tier must be selected when event has multiple tiers", () => {
      const resWithoutTier = validateBookingInput({
        guestName: "Budi Santoso",
        guestEmail: "budi@example.com",
        guestPhone: "081234567890",
        ticketCount: 1,
        maxTickets: 5,
        hasTiers: true,
      });
      expect(resWithoutTier.isValid).toBe(false);
      expect(resWithoutTier.error).toContain("Silakan pilih jenis tiket");

      const resWithTier = validateBookingInput({
        guestName: "Budi Santoso",
        guestEmail: "budi@example.com",
        guestPhone: "081234567890",
        ticketCount: 1,
        maxTickets: 5,
        hasTiers: true,
        ticketTierId: "tier-regular",
      });
      expect(resWithTier.isValid).toBe(true);
      expect(resWithTier.error).toBeNull();
    });
  });

  describe("Tier Quota & Sales Period Availability Calculation", () => {
    const mockTiers: EventTicketTier[] = [
      {
        id: "tier-early-bird",
        name: "Early Bird",
        price: 50000,
        quota: 5,
        description: "Diskon early bird",
      },
      {
        id: "tier-regular",
        name: "Reguler",
        price: 75000,
        quota: 10,
        description: "Tiket reguler",
      },
      {
        id: "tier-vip",
        name: "VIP",
        price: 150000,
        quota: 3,
        description: "Akses VIP + merch",
      },
    ];

    const mockEvent: CommunityEvent = {
      id: "evt-tier-test-01",
      title: "Design & Tech Summit 2026",
      category: "TECH",
      description: "Konferensi teknologi tahunan.",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 93600000).toISOString(),
      location: "Main Hall Dago",
      isPaid: true,
      price: 50000,
      ticketTiers: mockTiers,
      posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
      organizerName: "Bali Tech Community",
      organizerEmail: "organizer@balitech.id",
      organizerPhone: "081122334455",
      status: "APPROVED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it("calculates per-tier remaining quota accurately against custom bookings", () => {
      const mockBookings: EventTicketOrder[] = [
        {
          id: "tkt-01",
          ticketCode: "DAGO-EVT-0001",
          eventId: mockEvent.id,
          eventTitle: mockEvent.title,
          eventDate: mockEvent.startDate,
          eventLocation: mockEvent.location,
          guestName: "Alice",
          guestEmail: "alice@test.com",
          guestPhone: "08123456781",
          ticketTierId: "tier-early-bird",
          ticketTierName: "Early Bird",
          ticketCount: 2,
          unitPrice: 50000,
          totalPrice: 100000,
          platformFeePercent: 20,
          platformFeeAmount: 20000,
          organizerRevenueAmount: 80000,
          paymentMethod: "MANUAL_TRANSFER",
          paymentStatus: "PAID",
          checkInStatus: "REGISTERED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "tkt-02",
          ticketCode: "DAGO-EVT-0002",
          eventId: mockEvent.id,
          eventTitle: mockEvent.title,
          eventDate: mockEvent.startDate,
          eventLocation: mockEvent.location,
          guestName: "Bob",
          guestEmail: "bob@test.com",
          guestPhone: "08123456782",
          ticketTierId: "tier-vip",
          ticketTierName: "VIP",
          ticketCount: 3,
          unitPrice: 150000,
          totalPrice: 450000,
          platformFeePercent: 20,
          platformFeeAmount: 90000,
          organizerRevenueAmount: 360000,
          paymentMethod: "MANUAL_TRANSFER",
          paymentStatus: "PAID",
          checkInStatus: "REGISTERED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const availability = getEventTicketAvailability(mockEvent.id, [mockEvent], mockBookings);
      expect(availability.tiers).toBeDefined();
      expect(availability.tiers).toHaveLength(3);

      const earlyBird = availability.tiers!.find((t) => t.tierId === "tier-early-bird")!;
      expect(earlyBird.booked).toBe(2);
      expect(earlyBird.remaining).toBe(3);
      expect(earlyBird.isSoldOut).toBe(false);

      const regular = availability.tiers!.find((t) => t.tierId === "tier-regular")!;
      expect(regular.booked).toBe(0);
      expect(regular.remaining).toBe(10);
      expect(regular.isSoldOut).toBe(false);

      const vip = availability.tiers!.find((t) => t.tierId === "tier-vip")!;
      expect(vip.booked).toBe(3);
      expect(vip.remaining).toBe(0);
      expect(vip.isSoldOut).toBe(true);
    });

    it("evaluates salesStatus based on salesStartDate and salesEndDate", () => {
      const now = Date.now();
      const periodEvent: CommunityEvent = {
        ...mockEvent,
        id: "evt-tier-period-test",
        ticketTiers: [
          {
            id: "tier-past",
            name: "Flash Sale Kemarin",
            price: 25000,
            quota: 10,
            salesStartDate: new Date(now - 86400000 * 2).toISOString(),
            salesEndDate: new Date(now - 86400000).toISOString(),
          },
          {
            id: "tier-current",
            name: "Sedang Dijual",
            price: 50000,
            quota: 20,
            salesStartDate: new Date(now - 3600000).toISOString(),
            salesEndDate: new Date(now + 86400000).toISOString(),
          },
          {
            id: "tier-future",
            name: "Masa Depan",
            price: 100000,
            quota: 15,
            salesStartDate: new Date(now + 86400000).toISOString(),
            salesEndDate: new Date(now + 86400000 * 3).toISOString(),
          },
        ],
      };

      const avail = getEventTicketAvailability(periodEvent.id, [periodEvent], []);
      const pastTier = avail.tiers!.find((t) => t.tierId === "tier-past")!;
      const currentTier = avail.tiers!.find((t) => t.tierId === "tier-current")!;
      const futureTier = avail.tiers!.find((t) => t.tierId === "tier-future")!;

      expect(pastTier.salesStatus).toBe("ENDED");
      expect(currentTier.salesStatus).toBe("ON_SALE");
      expect(futureTier.salesStatus).toBe("UPCOMING");
    });
  });

  describe("End-to-End Tiered Booking Flow", () => {
    let testEventId: string;
    const testOrganizerEmail = `tier-org-${Date.now()}@dagohub.id`;

    it("creates an event with multiple tiers and approves it", async () => {
      const created = await createEventSubmission({
        organizerName: "Dago Tech Collective",
        organizerEmail: testOrganizerEmail,
        organizerPhone: "081298765432",
        title: `Bali Web3 Summit ${Date.now()}`,
        category: "TECH",
        description: "Eksplorasi teknologi web modern dan arsitektur event.",
        startDate: new Date(Date.now() + 86400000 * 2).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 3).toISOString(),
        location: "Main Hall Dago",
        isPaid: true,
        price: 50000,
        ticketTiers: [
          {
            id: "tier-eb",
            name: "Early Bird",
            price: 50000,
            quota: 2,
            description: "Tiket diskon awal",
          },
          {
            id: "tier-reg",
            name: "Reguler",
            price: 80000,
            quota: 5,
            description: "Tiket harga normal",
          },
          {
            id: "tier-vip",
            name: "VIP Pass",
            price: 150000,
            quota: 2,
            description: "Akses front-row & coffee break khusus",
          },
        ],
        posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
      });

      testEventId = created.id;
      expect(created.ticketTiers).toHaveLength(3);

      const approved = await updateEventStatus(testEventId, "APPROVED", {
        adminNotes: "Disetujui untuk pengujian tiket bertingkat.",
      });
      expect(approved.status).toBe("APPROVED");
    });

    it("reduces Early Bird quota when attendee books Early Bird, without affecting Reguler or VIP", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Eko Pratama",
        guestEmail: "eko@testmail.com",
        guestPhone: "081234567891",
        ticketTierId: "tier-eb",
        ticketCount: 1,
      });

      expect(booking.ticketTierId).toBe("tier-eb");
      expect(booking.ticketTierName).toBe("Early Bird");
      expect(booking.unitPrice).toBe(50000);
      expect(booking.totalPrice).toBe(50000);

      const availability = getEventTicketAvailability(testEventId);
      const eb = availability.tiers!.find((t) => t.tierId === "tier-eb")!;
      const reg = availability.tiers!.find((t) => t.tierId === "tier-reg")!;
      const vip = availability.tiers!.find((t) => t.tierId === "tier-vip")!;

      expect(eb.booked).toBe(1);
      expect(eb.remaining).toBe(1);
      expect(eb.isSoldOut).toBe(false);

      expect(reg.booked).toBe(0);
      expect(reg.remaining).toBe(5);

      expect(vip.booked).toBe(0);
      expect(vip.remaining).toBe(2);
    });

    it("exhausts Early Bird quota and rejects subsequent Early Bird booking while allowing Reguler", async () => {
      // Book the 2nd (and last) Early Bird ticket
      const booking2 = await createEventBooking({
        eventId: testEventId,
        guestName: "Dewi Lestari",
        guestEmail: "dewi@testmail.com",
        guestPhone: "081234567892",
        ticketTierId: "tier-eb",
        ticketCount: 1,
      });
      expect(booking2.ticketTierId).toBe("tier-eb");

      // Verify Early Bird is now sold out
      const availAfter = getEventTicketAvailability(testEventId);
      const ebAfter = availAfter.tiers!.find((t) => t.tierId === "tier-eb")!;
      expect(ebAfter.booked).toBe(2);
      expect(ebAfter.remaining).toBe(0);
      expect(ebAfter.isSoldOut).toBe(true);

      // Attempting 3rd Early Bird must fail with specific quota error
      await expect(
        createEventBooking({
          eventId: testEventId,
          guestName: "Rudi Hartono",
          guestEmail: "rudi@testmail.com",
          guestPhone: "081234567893",
          ticketTierId: "tier-eb",
          ticketCount: 1,
        })
      ).rejects.toThrow(/Kuota tiket Early Bird tidak mencukupi/);

      // However, booking Reguler still succeeds!
      const regBooking = await createEventBooking({
        eventId: testEventId,
        guestName: "Rudi Hartono",
        guestEmail: "rudi-reg@testmail.com",
        guestPhone: "081234567893",
        ticketTierId: "tier-reg",
        ticketCount: 2,
      });

      expect(regBooking.ticketTierId).toBe("tier-reg");
      expect(regBooking.ticketTierName).toBe("Reguler");
      expect(regBooking.unitPrice).toBe(80000);
      expect(regBooking.totalPrice).toBe(160000);

      const availFinal = getEventTicketAvailability(testEventId);
      const regFinal = availFinal.tiers!.find((t) => t.tierId === "tier-reg")!;
      expect(regFinal.booked).toBe(2);
      expect(regFinal.remaining).toBe(3);
    });

    it("rejects booking when ticketTierId is missing for tiered event", async () => {
      await expect(
        createEventBooking({
          eventId: testEventId,
          guestName: "Faisal",
          guestEmail: "faisal@testmail.com",
          guestPhone: "081234567894",
          ticketCount: 1,
        })
      ).rejects.toThrow(/Jenis tiket wajib dipilih/);
    });

    it("rejects booking with invalid tier ID", async () => {
      await expect(
        createEventBooking({
          eventId: testEventId,
          guestName: "Faisal",
          guestEmail: "faisal@testmail.com",
          guestPhone: "081234567894",
          ticketTierId: "non-existent-tier",
          ticketCount: 1,
        })
      ).rejects.toThrow(/tidak ditemukan pada event ini/);
    });
  });
});
