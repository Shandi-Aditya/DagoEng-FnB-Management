import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import {
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  createEventPromoCode,
  validateAndCalculatePromoDiscount,
  createInvitationTicket,
  organizerCheckInAttendee,
  getEventTicketAvailability,
} from "../src/lib/events";
import { CommunityEvent, EventTicketOrder } from "../src/types/event";

const DATA_DIR = process.env.DATA_DIR_OVERRIDE || path.join(process.cwd(), "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const BOOKINGS_FILE = path.join(DATA_DIR, "event_bookings.json");

describe("Event Promo Code & Invitation Tickets - Task S-13", () => {
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

  describe("Promo Code Calculation & Boundary Rules", () => {
    const mockEvent: CommunityEvent = {
      id: "evt-promo-rules-test",
      title: "Singaraja Jazz Night 2026",
      category: "CREATIVE",
      description: "Malam jazz komunitas.",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 93600000).toISOString(),
      location: "Amphitheater Dago",
      isPaid: true,
      price: 100000,
      posterUrl: "https://example.com/poster.jpg",
      organizerName: "Dago Jazz Collective",
      organizerEmail: "jazz@dagohub.id",
      organizerPhone: "081199887766",
      status: "APPROVED",
      promoCodes: [
        {
          id: "p-percent",
          eventId: "evt-promo-rules-test",
          code: "DISKON20",
          discountType: "PERCENT",
          discountValue: 20,
          maxDiscountAmount: 30000,
          quota: 10,
          usedCount: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "p-nominal",
          eventId: "evt-promo-rules-test",
          code: "HEMAT25K",
          discountType: "NOMINAL",
          discountValue: 25000,
          minOrderAmount: 50000,
          quota: 5,
          usedCount: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "p-full",
          eventId: "evt-promo-rules-test",
          code: "GRATIS100",
          discountType: "PERCENT",
          discountValue: 100,
          quota: 2,
          usedCount: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "p-expired",
          eventId: "evt-promo-rules-test",
          code: "KADALUWARSA",
          discountType: "NOMINAL",
          discountValue: 10000,
          quota: 10,
          usedCount: 0,
          validUntil: new Date(Date.now() - 3600000).toISOString(),
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "p-soldout",
          eventId: "evt-promo-rules-test",
          code: "HABISKUOTA",
          discountType: "NOMINAL",
          discountValue: 10000,
          quota: 3,
          usedCount: 3,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it("calculates percentage discount capped at maxDiscountAmount", () => {
      // 20% of 200.000 is 40.000, capped at maxDiscountAmount 30.000
      const res = validateAndCalculatePromoDiscount(mockEvent, "diskon20", 200000);
      expect(res.valid).toBe(true);
      expect(res.discountAmount).toBe(30000);
      expect(res.finalPrice).toBe(170000);
    });

    it("calculates nominal discount correctly and enforces minimum order amount", () => {
      // Below minOrderAmount of 50.000
      const belowMin = validateAndCalculatePromoDiscount(mockEvent, "HEMAT25K", 40000);
      expect(belowMin.valid).toBe(false);
      expect(belowMin.error).toContain("Minimal pembelian");

      // Meets minOrderAmount
      const ok = validateAndCalculatePromoDiscount(mockEvent, "HEMAT25K", 100000);
      expect(ok.valid).toBe(true);
      expect(ok.discountAmount).toBe(25000);
      expect(ok.finalPrice).toBe(75000);
    });

    it("handles 100% discount, zeroing the final price without negative values", () => {
      const res = validateAndCalculatePromoDiscount(mockEvent, "GRATIS100", 100000);
      expect(res.valid).toBe(true);
      expect(res.discountAmount).toBe(100000);
      expect(res.finalPrice).toBe(0);
    });

    it("rejects expired promo code and exhausted quota", () => {
      const expired = validateAndCalculatePromoDiscount(mockEvent, "KADALUWARSA", 100000);
      expect(expired.valid).toBe(false);
      expect(expired.error).toContain("Masa berlaku");

      const soldOut = validateAndCalculatePromoDiscount(mockEvent, "HABISKUOTA", 100000);
      expect(soldOut.valid).toBe(false);
      expect(soldOut.error).toContain("Kuota penggunaan");
    });
  });

  describe("End-to-End Promo Code Booking Flow", () => {
    let testEventId: string;
    const organizerEmail = `promo-org-${Date.now()}@dagohub.id`;

    it("creates an event and configures promo codes", async () => {
      const created = await createEventSubmission({
        organizerName: "Dago Creative Fest",
        organizerEmail,
        organizerPhone: "081234567800",
        title: `Workshop Kopi & Roasting ${Date.now()}`,
        category: "CREATIVE",
        description: "Eksplorasi teknik roasting manual brew bersama roaster profesional.",
        startDate: new Date(Date.now() + 86400000 * 2).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 3).toISOString(),
        location: "Meeting Room Ubud (12 Pax)",
        isPaid: true,
        price: 80000,
        posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
      });

      testEventId = created.id;
      await updateEventStatus(testEventId, "APPROVED", {
        adminNotes: "Disetujui untuk uji coba promo code & invitation.",
      });

      // Tambahkan promo code melalui helper createEventPromoCode
      const promo1 = await createEventPromoCode(testEventId, {
        code: "ROASTER20K",
        discountType: "NOMINAL",
        discountValue: 20000,
        quota: 2,
        isActive: true,
      });

      const promo2 = await createEventPromoCode(testEventId, {
        code: "FREEPASS100",
        discountType: "PERCENT",
        discountValue: 100,
        quota: 1,
        isActive: true,
      });

      expect(promo1.code).toBe("ROASTER20K");
      expect(promo2.code).toBe("FREEPASS100");
    });

    it("applies promo code successfully and cuts price correctly", async () => {
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Bambang Sudiro",
        guestEmail: "bambang@testmail.com",
        guestPhone: "081234567801",
        promoCode: "roaster20k", // Case insensitive
        ticketCount: 1,
      });

      expect(booking.promoCode).toBe("ROASTER20K");
      expect(booking.unitPrice).toBe(80000);
      expect(booking.subtotalPrice).toBe(80000);
      expect(booking.discountAmount).toBe(20000);
      expect(booking.totalPrice).toBe(60000);
      expect(booking.paymentStatus).toBe("PENDING");
    });

    it("confirms ticket as PAID immediately when 100% discount zeroes total price", async () => {
      const freeBooking = await createEventBooking({
        eventId: testEventId,
        guestName: "Citra Kirana",
        guestEmail: "citra@testmail.com",
        guestPhone: "081234567802",
        promoCode: "FREEPASS100",
        ticketCount: 1,
      });

      expect(freeBooking.promoCode).toBe("FREEPASS100");
      expect(freeBooking.discountAmount).toBe(80000);
      expect(freeBooking.totalPrice).toBe(0);
      expect(freeBooking.paymentStatus).toBe("PAID");
      expect(freeBooking.paymentMethod).toBe("FREE");
    });

    it("exhausts promo code quota and rejects subsequent booking", async () => {
      // ROASTER20K quota was 2. First used by Bambang. Use second here:
      await createEventBooking({
        eventId: testEventId,
        guestName: "Doni Pratama",
        guestEmail: "doni@testmail.com",
        guestPhone: "081234567803",
        promoCode: "ROASTER20K",
        ticketCount: 1,
      });

      // 3rd attempt with ROASTER20K must fail because quota (2) is exhausted
      await expect(
        createEventBooking({
          eventId: testEventId,
          guestName: "Evelyn Wijaya",
          guestEmail: "evelyn@testmail.com",
          guestPhone: "081234567804",
          promoCode: "ROASTER20K",
          ticketCount: 1,
        })
      ).rejects.toThrow(/Kuota penggunaan kode promo "ROASTER20K" telah habis/);
    });

    it("supports unlimited quota promo code (quota === 0) without clamping or exhaustion", async () => {
      const unlimitedPromo = await createEventPromoCode(
        testEventId,
        {
          code: "UNLIMITED10",
          discountType: "PERCENT",
          discountValue: 10,
          quota: 0, // 0 = unlimited quota
          isActive: true,
        },
        { name: "Super Admin", role: "SUPER_ADMIN" }
      );

      expect(unlimitedPromo.quota).toBe(0);

      // Book with UNLIMITED10 multiple times
      const b1 = await createEventBooking({
        eventId: testEventId,
        guestName: "Unlimited User 1",
        guestEmail: "unlimited1@testmail.com",
        guestPhone: "081234567888",
        promoCode: "UNLIMITED10",
        ticketCount: 1,
      });

      const b2 = await createEventBooking({
        eventId: testEventId,
        guestName: "Unlimited User 2",
        guestEmail: "unlimited2@testmail.com",
        guestPhone: "081234567889",
        promoCode: "UNLIMITED10",
        ticketCount: 1,
      });

      expect(b1.totalPrice).toBe(72000);
      expect(b2.totalPrice).toBe(72000);

      // Re-saving promo with quota 0 preserves quota 0 rather than clamping to usedCount
      const updatedPromo = await createEventPromoCode(
        testEventId,
        {
          code: "UNLIMITED10",
          discountType: "PERCENT",
          discountValue: 15,
          quota: 0,
          isActive: true,
        },
        { name: "Organizer", role: "ORGANIZER" }
      );

      expect(updatedPromo.quota).toBe(0);
      expect(updatedPromo.discountValue).toBe(15);
    });
  });

  describe("Invitation Tickets (Tiket Undangan Gratis & Check-In Scan)", () => {
    let inviteEventId: string;
    const organizerEmail = `invite-org-${Date.now()}@dagohub.id`;
    let issuedInvitation: EventTicketOrder;

    it("issues a complimentary invitation ticket with zero price and PAID status", async () => {
      const created = await createEventSubmission({
        organizerName: "Komunitas Barista Bali",
        organizerEmail,
        organizerPhone: "081234567809",
        title: `Bali Brewers Cup 2026 ${Date.now()}`,
        category: "CREATIVE",
        description: "Kompetisi seduh kopi manual tingkat regional.",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 93600000).toISOString(),
        location: "Meeting Room Seminyak (6 Pax)",
        isPaid: true,
        price: 150000,
        posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
      });

      inviteEventId = created.id;
      await updateEventStatus(inviteEventId, "APPROVED", {
        adminNotes: "Disetujui untuk uji coba tiket undangan.",
      });

      // Issue invitation ticket
      issuedInvitation = await createInvitationTicket({
        eventId: inviteEventId,
        guestName: "Prof. Dr. I Wayan Sudarsana",
        guestEmail: "wayan.sudarsana@vip.ac.id",
        guestPhone: "081122334455",
        institution: "Juri Kehormatan Kopi Indonesia",
        invitationNote: "Tamu kehormatan & dewan juri",
      });

      expect(issuedInvitation).toBeDefined();
      expect(issuedInvitation.isInvitation).toBe(true);
      expect(issuedInvitation.paymentMethod).toBe("INVITATION");
      expect(issuedInvitation.paymentStatus).toBe("PAID");
      expect(issuedInvitation.unitPrice).toBe(0);
      expect(issuedInvitation.totalPrice).toBe(0);
      expect(issuedInvitation.ticketCode).toMatch(/^DAGO-EVT-/);
      expect(issuedInvitation.checkInStatus).toBe("REGISTERED");

      // Kuota venue berkurang
      const avail = getEventTicketAvailability(inviteEventId);
      expect(avail.ticketsReserved).toBe(1);
    });

    it("allows scanning and check-in of invitation ticket at venue door", async () => {
      // Panitia melakukan check-in via organizerCheckInAttendee
      const checkedIn = await organizerCheckInAttendee(
        organizerEmail,
        issuedInvitation.ticketCode,
        "CHECKED_IN"
      );

      expect(checkedIn.checkInStatus).toBe("CHECKED_IN");
      expect(checkedIn.checkedInQty).toBe(1);
      expect(checkedIn.checkInTime).toBeDefined();
    });

    it("rejects duplicate scan on already checked-in invitation ticket", async () => {
      await expect(
        organizerCheckInAttendee(
          organizerEmail,
          issuedInvitation.ticketCode,
          "CHECKED_IN"
        )
      ).rejects.toThrow(/sudah digunakan untuk check-in/);
    });
  });
});
