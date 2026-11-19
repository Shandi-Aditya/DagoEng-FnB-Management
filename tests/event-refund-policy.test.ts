import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import {
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  validateTicketRefundEligibility,
  requestTicketRefund,
  adminProcessTicketRefund,
  getEventActiveBookedTicketCount,
  getEventActiveBookedTicketCountForTier,
  organizerCheckInAttendee,
  getAdminRefundBookings,
} from "../src/lib/events";
import { CommunityEvent, EventTicketOrder } from "../src/types/event";

const DATA_DIR = process.env.DATA_DIR_OVERRIDE || path.join(process.cwd(), "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const BOOKINGS_FILE = path.join(DATA_DIR, "event_bookings.json");

describe("Event Refund Policy & Cancellation - Task S-14", () => {
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

  describe("1. Refund Eligibility Domain Rules", () => {
    const eventDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
    const mockNoRefundEvent: CommunityEvent = {
      id: "evt-no-refund",
      title: "No Refund Conference",
      category: "CREATIVE",
      description: "Acara eksklusif.",
      startDate: eventDate.toISOString(),
      endDate: new Date(eventDate.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      location: "Amphitheater Dago",
      isPaid: true,
      price: 150000,
      posterUrl: "https://example.com/poster.jpg",
      organizerName: "Dago Creatives",
      organizerEmail: "organizer@dagohub.id",
      organizerPhone: "081122334455",
      status: "APPROVED",
      refundPolicy: {
        policyType: "NO_REFUND",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockRefundableEvent: CommunityEvent = {
      id: "evt-refundable-h3",
      title: "Singaraja Tech Summit",
      category: "WORKSHOP",
      description: "Seminar teknologi.",
      startDate: eventDate.toISOString(),
      endDate: new Date(eventDate.getTime() + 6 * 60 * 60 * 1000).toISOString(),
      location: "Hall Utama",
      isPaid: true,
      price: 200000,
      posterUrl: "https://example.com/poster.jpg",
      organizerName: "Bali Tech",
      organizerEmail: "tech@balitech.id",
      organizerPhone: "081199887766",
      status: "APPROVED",
      refundPolicy: {
        policyType: "REFUNDABLE_UNTIL_H_MINUS",
        hMinusDays: 3, // Refundable up to 3 days before start
        refundFeePercent: 10, // 10% admin fee deducted
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const validPaidBooking: EventTicketOrder = {
      id: "order-test-01",
      ticketCode: "DAGO-EVT-RF01",
      eventId: "evt-refundable-h3",
      eventTitle: "Singaraja Tech Summit",
      eventDate: eventDate.toISOString(),
      eventLocation: "Hall Utama",
      guestName: "Budi Santoso",
      guestEmail: "budi@example.com",
      guestPhone: "081234567890",
      ticketCount: 1,
      unitPrice: 200000,
      totalPrice: 200000,
      platformFeePercent: 20,
      platformFeeAmount: 40000,
      organizerRevenueAmount: 160000,
      paymentMethod: "TRANSFER",
      paymentStatus: "PAID",
      checkInStatus: "REGISTERED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it("1.1 rejects refund if event policy is NO_REFUND", () => {
      const res = validateTicketRefundEligibility(mockNoRefundEvent, validPaidBooking);
      expect(res.eligible).toBe(false);
      expect(res.error).toMatch(/kebijakan tidak dapat dibatalkan atau di-refund/i);
    });

    it("1.2 rejects refund if booking is not PAID (e.g. PENDING)", () => {
      const pendingBooking: EventTicketOrder = {
        ...validPaidBooking,
        paymentStatus: "PENDING",
      };
      const res = validateTicketRefundEligibility(mockRefundableEvent, pendingBooking);
      expect(res.eligible).toBe(false);
      expect(res.error).toMatch(/Hanya tiket berstatus LUNAS/i);
    });

    it("1.3 rejects refund for complimentary invitation or free tickets", () => {
      const invitationBooking: EventTicketOrder = {
        ...validPaidBooking,
        paymentMethod: "INVITATION",
        isInvitation: true,
        totalPrice: 0,
      };
      const res = validateTicketRefundEligibility(mockRefundableEvent, invitationBooking);
      expect(res.eligible).toBe(false);
      expect(res.error).toMatch(/Tiket gratis atau tiket undangan tidak memenuhi syarat/i);
    });

    it("1.4 rejects refund if attendee already checked in", () => {
      const checkedInBooking: EventTicketOrder = {
        ...validPaidBooking,
        checkInStatus: "CHECKED_IN",
        checkedInQty: 1,
      };
      const res = validateTicketRefundEligibility(mockRefundableEvent, checkedInBooking);
      expect(res.eligible).toBe(false);
      expect(res.error).toMatch(/sudah digunakan untuk check-in/i);
    });

    it("1.5 rejects refund if request date is after the H-x cutoff deadline", () => {
      // Event is at eventDate (Date.now() + 10 days)
      // Cutoff H-3 is at eventDate - 3 days (Date.now() + 7 days)
      // Requesting at eventDate - 1 day (Date.now() + 9 days) should be rejected
      const lateRequestDate = new Date(eventDate.getTime() - 1 * 24 * 60 * 60 * 1000);
      const res = validateTicketRefundEligibility(mockRefundableEvent, validPaidBooking, lateRequestDate);
      expect(res.eligible).toBe(false);
      expect(res.error).toMatch(/Batas waktu pengajuan refund untuk event ini telah berakhir/i);
    });

    it("1.6 accepts refund before H-x cutoff and accurately calculates net refund nominal", () => {
      // Requesting at Date.now() (10 days before event, well before H-3 deadline)
      const earlyRequestDate = new Date();
      const res = validateTicketRefundEligibility(mockRefundableEvent, validPaidBooking, earlyRequestDate);
      expect(res.eligible).toBe(true);
      expect(res.feeDeducted).toBe(20000); // 10% of 200,000
      expect(res.calculatedRefundAmount).toBe(180000); // 200,000 - 20,000
      expect(res.deadlineDate).toBeDefined();
    });
  });

  describe("2. End-to-End Refund Workflow & State Transitions", () => {
    let testEventId: string;
    let testBooking: EventTicketOrder;

    beforeAll(async () => {
      const eventStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      const createdEvent = await createEventSubmission({
        title: "Bali Culinary Festival 2026",
        category: "COMMUNITY",
        description: "Festival kuliner Bali.",
        startDate: eventStart.toISOString(),
        endDate: new Date(eventStart.getTime() + 8 * 60 * 60 * 1000).toISOString(),
        location: "Kuliner Area Dago",
        isPaid: true,
        price: 100000,
        maxCapacity: 50,
        organizerName: "Dago Kitchen",
        organizerEmail: "kitchen@dagoeng.com",
        organizerPhone: "081233445566",
        posterUrl: "https://dagoeng.com/posters/culinary.jpg",
        ticketTiers: [
          {
            id: "tier-reguler",
            name: "Reguler Pass",
            price: 100000,
            quota: 50,
            salesStartDate: new Date(Date.now() - 3600000).toISOString(),
            salesEndDate: eventStart.toISOString(),
          },
        ],
        refundPolicy: {
          policyType: "REFUNDABLE_UNTIL_H_MINUS",
          hMinusDays: 2, // H-2 cutoff
          refundFeePercent: 10, // 10% admin fee
        },
      });

      await updateEventStatus(createdEvent.id, "APPROVED");
      testEventId = createdEvent.id;

      // Create a paid booking
      testBooking = await createEventBooking({
        eventId: testEventId,
        guestName: "Dewi Lestari",
        guestEmail: "dewi.lestari@example.com",
        guestPhone: "081298765432",
        ticketTierId: "tier-reguler",
        ticketCount: 2,
        paymentMethod: "TRANSFER",
      });

      // Simulate admin payment verification to PAID
      const { updateBookingPaymentStatus } = await import("../src/lib/events");
      testBooking = await updateBookingPaymentStatus(testBooking.id, "PAID");
    });

    it("2.1 initial capacity reflects 2 booked tickets", () => {
      const bookedCount = getEventActiveBookedTicketCount(testEventId);
      const tierBookedCount = getEventActiveBookedTicketCountForTier(testEventId, "tier-reguler");
      expect(bookedCount).toBe(2);
      expect(tierBookedCount).toBe(2);
    });

    it("2.2 attendee requests refund: updates refundStatus to REQUESTED and records request payload", async () => {
      const requested = await requestTicketRefund(testBooking.id, {
        reason: "Berhalangan hadir karena urusan keluarga mendadak.",
        bankName: "BCA",
        accountNumber: "1234567890",
        accountHolder: "Dewi Lestari",
      });

      expect(requested.refundStatus).toBe("REQUESTED");
      expect(requested.refundRequest).toBeDefined();
      expect(requested.refundRequest?.status).toBe("REQUESTED");
      expect(requested.refundRequest?.bankName).toBe("BCA");
      expect(requested.refundRequest?.refundAmount).toBe(180000); // 200,000 - 10% (20,000)

      // Listed in admin pending refunds
      const pendingList = await getAdminRefundBookings({ eventId: testEventId, status: "REQUESTED" });
      expect(pendingList.some((b) => b.id === testBooking.id)).toBe(true);
    });

    it("2.3 prevents check-in while refund is in REQUESTED status", async () => {
      await expect(
        organizerCheckInAttendee("kitchen@dagoeng.com", testBooking.id, "CHECKED_IN")
      ).rejects.toThrow(/sedang dalam proses pengajuan refund/i);
    });

    it("2.4 admin can reject refund request with reason: restores status to PAID", async () => {
      const rejected = await adminProcessTicketRefund(
        testBooking.id,
        {
          decision: "REJECT",
          rejectionReason: "Pengajuan ditolak karena melewati batas kuota pembatalan harian.",
        },
        "admin@dagoeng.com"
      );

      expect(rejected.refundStatus).toBe("REJECTED");
      expect(rejected.paymentStatus).toBe("PAID");
      expect(rejected.refundRequest?.status).toBe("REJECTED");
      expect(rejected.refundRequest?.rejectionReason).toMatch(/melewati batas/i);
    });

    it("2.5 attendee re-submits refund and admin approves: sets status to REFUNDED and frees capacity", async () => {
      // Attendee submits new valid request
      await requestTicketRefund(testBooking.id, {
        reason: "Re-submission: bukti surat dokter terlampir.",
        bankName: "MANDIRI",
        accountNumber: "9876543210",
        accountHolder: "Dewi Lestari",
      });

      // Admin approves
      const approved = await adminProcessTicketRefund(
        testBooking.id,
        {
          decision: "APPROVE",
          adminNotes: "Refund disetujui. Transfer dana Rp 180.000 telah diproses ke rekening Mandiri.",
        },
        "finance@dagoeng.com"
      );

      expect(approved.refundStatus).toBe("APPROVED");
      expect(approved.paymentStatus).toBe("REFUNDED");
      expect(approved.refundRequest?.status).toBe("APPROVED");
      expect(approved.refundRequest?.processedBy).toBe("finance@dagoeng.com");

      // Verify capacity is freed (back to 0 booked)
      const bookedAfterRefund = getEventActiveBookedTicketCount(testEventId);
      const tierBookedAfterRefund = getEventActiveBookedTicketCountForTier(testEventId, "tier-reguler");
      expect(bookedAfterRefund).toBe(0);
      expect(tierBookedAfterRefund).toBe(0);
    });

    it("2.6 permanently blocks check-in for REFUNDED booking", async () => {
      await expect(
        organizerCheckInAttendee("kitchen@dagoeng.com", testBooking.id, "CHECKED_IN")
      ).rejects.toThrow(/status REFUNDED tidak dapat digunakan untuk check-in/i);
    });
  });
});
