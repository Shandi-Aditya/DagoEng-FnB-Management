import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateEventPrice,
  validateEventCapacity,
  validateEventRefundPolicy,
  normalizeDateToWitaIso,
  validateEventTicketTiers,
  isCheckInStaffRole,
  CHECKIN_STAFF_SUBMISSION_BLOCKED_MESSAGE,
  MIN_EVENT_CAPACITY,
  MAX_EVENT_CAPACITY,
} from "@/lib/event-validation";
import {
  validateEventSubmission,
  createEventSubmission,
  updateEventDetails,
  organizerResubmitEvent,
  validateEventBooking,
  loadEventsFromDisk,
  saveEventsToDisk,
  loadBookingsFromDisk,
  saveBookingsToDisk,
  getEventActiveBookedTicketCount,
  createEventBooking,
  getEventTicketAvailability,
  withEventLock,
  withBookingLock,
  syncBookingsStorageFailClosed,
} from "@/lib/events";
import {
  isEventPaidEffective,
  formatEventPriceSummary,
} from "@/features/events-catalog/events-catalog-domain";
import { POST as postEventRoute } from "@/app/api/events/route";
import { PUT as putEventRoute } from "@/app/api/events/[id]/route";
import { PUT as putPortalRoute } from "@/app/api/events/portal/route";
import * as serverAuth from "@/lib/server-auth";
import * as unifiedAccount from "@/lib/unified-account";
import * as dataStorage from "@/lib/data-storage";
import { NextRequest } from "next/server";
import { EventSubmissionPayload, CommunityEvent, EventTicketOrder } from "@/types/event";


function createMockTicketOrder(override: any): EventTicketOrder {
  return {
    ticketCode: `DAGO-EVT-${override.id}`,
    eventTitle: 'Test Validation Event',
    eventDate: '2026-12-01T10:00:00+08:00',
    eventLocation: 'Dago Creative Hub',
    guestName: override.guestName || 'Guest',
    guestEmail: override.guestEmail || 'guest@example.com',
    guestPhone: override.guestPhone || '081234567890',
    ticketCount: override.ticketCount ?? 1,
    unitPrice: override.totalPrice ? Math.round(override.totalPrice / (override.ticketCount || 1)) : 50000,
    totalPrice: override.totalPrice ?? 50000,
    platformFeePercent: override.platformFeePercent ?? 20,
    platformFeeAmount: override.platformFeeAmount ?? 10000,
    organizerRevenueAmount: override.organizerRevenueAmount ?? 40000,
    paymentMethod: override.paymentMethod || 'MANUAL_TRANSFER',
    paymentStatus: override.paymentStatus || 'PENDING',
    checkInStatus: override.checkInStatus || 'REGISTERED',
    createdAt: override.createdAt || new Date().toISOString(),
    updatedAt: override.updatedAt || new Date().toISOString(),
    ...override,
  };
}

describe("TASK S-03 — Event Validation Hardening & Role Restriction Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. PENGUJIAN VALIDASI HARGA TIKET (PRICE VALIDATION)
  // =========================================================================
  describe("1. Validasi Harga Tiket (Event Pricing Hardening)", () => {
    it("1.1 Menerima harga berbayar bilangan bulat positif yang valid", () => {
      const result1 = validateEventPrice(true, 50000);
      expect(result1.valid).toBe(true);
      expect(result1.value).toBe(50000);

      const result2 = validateEventPrice(true, 150000);
      expect(result2.valid).toBe(true);
      expect(result2.value).toBe(150000);

      const result3 = validateEventPrice(true, "25000");
      expect(result3.valid).toBe(true);
      expect(result3.value).toBe(25000);
    });

    it("1.2 Menolak harga desimal 0.9", () => {
      const resNum = validateEventPrice(true, 0.9);
      expect(resNum.valid).toBe(false);
      expect(resNum.error).toContain("pecahan desimal");

      const resStr = validateEventPrice(true, "0.9");
      expect(resStr.valid).toBe(false);
      expect(resStr.error).toContain("pecahan desimal");
    });

    it("1.3 Menolak harga desimal 1000.5 dan 15000.75", () => {
      const res1 = validateEventPrice(true, 1000.5);
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain("pecahan desimal");

      const res2 = validateEventPrice(true, "1000.5");
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain("pecahan desimal");

      const res3 = validateEventPrice(true, 15000.75);
      expect(res3.valid).toBe(false);
      expect(res3.error).toContain("pecahan desimal");
    });

    it("1.4 Menolak harga negatif (-100, -50000)", () => {
      const resNum = validateEventPrice(true, -50000);
      expect(resNum.valid).toBe(false);
      expect(resNum.error).toContain("negatif");

      const resStr = validateEventPrice(true, "-50000");
      expect(resStr.valid).toBe(false);
      expect(resStr.error).toBeDefined();
    });

    it("1.5 Menolak nilai NaN, Infinity, dan -Infinity", () => {
      expect(validateEventPrice(true, NaN).valid).toBe(false);
      expect(validateEventPrice(true, Infinity).valid).toBe(false);
      expect(validateEventPrice(true, -Infinity).valid).toBe(false);
      expect(validateEventPrice(true, "NaN").valid).toBe(false);
      expect(validateEventPrice(true, "Infinity").valid).toBe(false);
    });

    it("1.6 Menolak nilai di luar batas safe integer (termasuk 1e58 dan > Number.MAX_SAFE_INTEGER)", () => {
      const resExp = validateEventPrice(true, 1e58);
      expect(resExp.valid).toBe(false);
      expect(resExp.error).toContain("safe integer");

      const resExpStr = validateEventPrice(true, "1e58");
      expect(resExpStr.valid).toBe(false);
      expect(resExpStr.error).toContain("pecahan desimal");

      const resOverflow = validateEventPrice(true, Number.MAX_SAFE_INTEGER + 100);
      expect(resOverflow.valid).toBe(false);
    });

    it("1.7 Menerima harga 0 untuk event gratis (isPaid === false)", () => {
      const resZero = validateEventPrice(false, 0);
      expect(resZero.valid).toBe(true);
      expect(resZero.value).toBe(0);

      const resZeroStr = validateEventPrice(false, "0");
      expect(resZeroStr.valid).toBe(true);
      expect(resZeroStr.value).toBe(0);

      const resUndef = validateEventPrice(false, undefined);
      expect(resUndef.valid).toBe(true);
      expect(resUndef.value).toBe(0);

      const resEmpty = validateEventPrice(false, "");
      expect(resEmpty.valid).toBe(true);
      expect(resEmpty.value).toBe(0);
    });

    it("1.8 Menolak harga 0 untuk event berbayar (isPaid === true)", () => {
      const resZero = validateEventPrice(true, 0);
      expect(resZero.valid).toBe(false);
      expect(resZero.error).toContain("lebih dari Rp 0");

      const resZeroStr = validateEventPrice(true, "0");
      expect(resZeroStr.valid).toBe(false);
      expect(resZeroStr.error).toContain("lebih dari Rp 0");
    });

    it("1.9 Menolak harga > 0 jika event berstatus gratis (isPaid === false)", () => {
      const res = validateEventPrice(false, 50000);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Event gratis harus menggunakan nominal harga Rp 0");
    });
  });

  // =========================================================================
  // 2. PENGUJIAN VALIDASI KUOTA TIKET (CAPACITY VALIDATION)
  // =========================================================================
  describe("2. Validasi Kuota Tiket (Event Quota Hardening)", () => {
    it("2.1 Menerima kuota minimum 1 peserta", () => {
      const res = validateEventCapacity(1, false);
      expect(res.valid).toBe(true);
      expect(res.value).toBe(1);

      const resStr = validateEventCapacity("1", false);
      expect(resStr.valid).toBe(true);
      expect(resStr.value).toBe(1);
    });

    it("2.2 Menerima kuota maksimum 1.000 peserta", () => {
      const res = validateEventCapacity(1000, false);
      expect(res.valid).toBe(true);
      expect(res.value).toBe(1000);

      const resStr = validateEventCapacity("1000", false);
      expect(resStr.valid).toBe(true);
      expect(resStr.value).toBe(1000);
    });

    it("2.3 Menolak kuota 1001 (melebihi batas maksimal 1.000)", () => {
      const res = validateEventCapacity(1001, false);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("tidak boleh melebihi 1.000");

      const resStr = validateEventCapacity("1001", false);
      expect(resStr.valid).toBe(false);
      expect(resStr.error).toContain("tidak boleh melebihi 1.000");
    });

    it("2.4 Menolak kuota 0 dan kuota negatif", () => {
      const resZero = validateEventCapacity(0, false);
      expect(resZero.valid).toBe(false);
      expect(resZero.error).toContain("minimal 1 peserta");

      const resNeg = validateEventCapacity(-10, false);
      expect(resNeg.valid).toBe(false);
      expect(resNeg.error).toBeDefined();
    });

    it("2.5 Menolak kuota desimal (10.5, 50.25)", () => {
      const res1 = validateEventCapacity(10.5, false);
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain("pecahan desimal");

      const res2 = validateEventCapacity("10.5", false);
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain("pecahan desimal");
    });

    it("2.6 Menolak angka ekstrem astronomis 1e58", () => {
      const resNum = validateEventCapacity(1e58, false);
      expect(resNum.valid).toBe(false);
      expect(resNum.error).toBeDefined();

      const resStr = validateEventCapacity("1e58", false);
      expect(resStr.valid).toBe(false);
      expect(resStr.error).toBeDefined();
    });

    it("2.7 Menolak nilai NaN dan Infinity", () => {
      expect(validateEventCapacity(NaN, false).valid).toBe(false);
      expect(validateEventCapacity(Infinity, false).valid).toBe(false);
      expect(validateEventCapacity(-Infinity, false).valid).toBe(false);
      expect(validateEventCapacity("abc", false).valid).toBe(false);
    });

    it("2.8 Menerima nilai kosong jika opsional (default ke undefined)", () => {
      const resUndef = validateEventCapacity(undefined, true);
      expect(resUndef.valid).toBe(true);
      expect(resUndef.value).toBeUndefined();

      const resNull = validateEventCapacity(null, true);
      expect(resNull.valid).toBe(true);
      expect(resNull.value).toBeUndefined();

      const resEmpty = validateEventCapacity("", true);
      expect(resEmpty.valid).toBe(true);
      expect(resEmpty.value).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. PENGUJIAN RESTRIKSI ROLE PENGAJU EVENT (CHECKIN_STAFF)
  // =========================================================================
  describe("3. Restriksi Role Pengaju Event (CHECKIN_STAFF Restriction)", () => {
    it("3.1 isCheckInStaffRole mendeteksi role CHECKIN_STAFF secara akurat", () => {
      expect(isCheckInStaffRole("CHECKIN_STAFF")).toBe(true);
      expect(isCheckInStaffRole("checkin_staff")).toBe(true);
      expect(isCheckInStaffRole({ slug: "CHECKIN_STAFF" })).toBe(true);
      expect(isCheckInStaffRole({ id: "role-checkin-staff", slug: "CHECKIN_STAFF" })).toBe(true);

      // Role lain
      expect(isCheckInStaffRole("SUPER_ADMIN")).toBe(false);
      expect(isCheckInStaffRole("OWNER")).toBe(false);
      expect(isCheckInStaffRole("MANAGER")).toBe(false);
      expect(isCheckInStaffRole("CUSTOMER")).toBe(false);
      expect(isCheckInStaffRole(null)).toBe(false);
      expect(isCheckInStaffRole(undefined)).toBe(false);
    });

    it("3.2 POST /api/events menolak CHECKIN_STAFF terautentikasi dengan HTTP 403", async () => {
      // Mock session user as CHECKIN_STAFF
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        role: "CHECKIN_STAFF" as any,
        userId: "user-staff-1",
        email: "staff@dagoeng.com",
        name: "Staff Check In",
        scopeLevel: "ORGANIZATION",
        permissions: [],
        tenantId: null,
        businessModule: "CORE",
      });

      const payload: EventSubmissionPayload = {
        title: "Event Ditolak",
        category: "TECH",
        description: "Deskripsi event valid minimal sepuluh karakter.",
        startDate: "2026-12-01T10:00:00+08:00",
        endDate: "2026-12-01T15:00:00+08:00",
        location: "Amphitheater Dago Creative Hub",
        organizerName: "Staff Organizer",
        organizerEmail: "staff@dagoeng.com",
        organizerPhone: "081234567890",
        posterUrl: "https://example.com/poster.jpg",
        isPaid: false,
        price: 0,
        maxCapacity: 50,
      };

      const req = new NextRequest("http://localhost:3000/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const response = await postEventRoute(req);
      expect(response.status).toBe(403);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe(CHECKIN_STAFF_SUBMISSION_BLOCKED_MESSAGE);
    });

    it("3.3 POST /api/events menolak pengajuan tamu jika email terdaftar sebagai CHECKIN_STAFF", async () => {
      // Guest is unauthenticated
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: false,
        role: null,
        userId: null,
        email: null,
        scopeLevel: null,
        permissions: [],
        tenantId: null,
        businessModule: null,
      });

      // Email belongs to a CHECKIN_STAFF account
      vi.spyOn(unifiedAccount, "findUnifiedUserByEmail").mockReturnValue({
        id: "user-checkin-staff",
        email: "checkin@dagoeng.com",
        name: "Petugas Lapangan",
        role: "CHECKIN_STAFF" as any,
        phone: "081234567890",
        updatedAt: "2026-01-01T00:00:00.000Z",
        passwordHash: "hash",
        status: "ACTIVE",
        createdAt: "2026-01-01T00:00:00.000Z",
      } as any);

      const payload: EventSubmissionPayload = {
        title: "Event dari Email Checkin Staff",
        category: "TECH",
        description: "Deskripsi event valid minimal sepuluh karakter.",
        startDate: "2026-12-01T10:00:00+08:00",
        endDate: "2026-12-01T15:00:00+08:00",
        location: "Amphitheater Dago Creative Hub",
        organizerName: "Staff Lapangan",
        organizerEmail: "checkin@dagoeng.com",
        organizerPhone: "081234567890",
        posterUrl: "https://example.com/poster.jpg",
        isPaid: false,
        price: 0,
        maxCapacity: 50,
      };

      const req = new NextRequest("http://localhost:3000/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const response = await postEventRoute(req);
      expect(response.status).toBe(403);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe(CHECKIN_STAFF_SUBMISSION_BLOCKED_MESSAGE);
    });

    it("3.4 Guest publik yang sah tetap dapat mengajukan event tanpa terblokir", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: false,
        role: null,
        userId: null,
        email: null,
        scopeLevel: null,
        permissions: [],
        tenantId: null,
        businessModule: null,
      });

      vi.spyOn(unifiedAccount, "findUnifiedUserByEmail").mockReturnValue(null);

      const testPayload: EventSubmissionPayload = {
        title: "Valid Guest Event Proposal",
        category: "WORKSHOP",
        description: "Deskripsi workshop valid lebih dari sepuluh karakter.",
        startDate: "2026-12-10T09:00:00+08:00",
        endDate: "2026-12-10T12:00:00+08:00",
        location: "Amphitheater Dago Creative Hub",
        organizerName: "Komunitas Kreatif Bandung",
        organizerEmail: `komunitas-tamu-${Date.now()}@example.com`,
        organizerPhone: "081234567890",
        posterUrl: "https://example.com/poster-guest.jpg",
        isPaid: true,
        price: 75000,
        maxCapacity: 60,
      };

      const validation = validateEventSubmission(testPayload);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  // =========================================================================
  // 4. PENGUJIAN DOMAIN SUBMISSION & DETAIL UPDATE
  // =========================================================================
  describe("4. Pengujian Domain Submission, Detail Update, & Revision", () => {
    it("4.1 validateEventSubmission menolak harga desimal 0.9 dan kuota 1e58", () => {
      const invalidPayload: EventSubmissionPayload = {
        title: "Invalid Price and Quota Event",
        category: "TECH",
        description: "Deskripsi workshop valid lebih dari sepuluh karakter.",
        startDate: "2026-12-10T09:00:00+08:00",
        endDate: "2026-12-10T12:00:00+08:00",
        location: "Amphitheater Dago Creative Hub",
        organizerName: "Komunitas Tech",
        organizerEmail: "tech@example.com",
        organizerPhone: "081234567890",
        posterUrl: "https://example.com/poster.jpg",
        isPaid: true,
        price: 0.9,
        maxCapacity: 1e58,
      };

      const validation = validateEventSubmission(invalidPayload);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("pecahan desimal"))).toBe(true);
      expect(validation.errors.some((e) => e.includes("1.000") || e.includes("aman") || e.includes("bilangan bulat"))).toBe(true);
    });

    it("4.2 updateEventDetails menolak pembaruan dengan harga desimal", async () => {
      const mockEvent: CommunityEvent = {
        id: "evt-test-update-hardening",
        title: "Existing Event",
        category: "CREATIVE",
        description: "Deskripsi event sebelumnya yang sudah valid.",
        startDate: "2026-12-01T10:00:00.000Z",
        endDate: "2026-12-01T15:00:00.000Z",
        location: "Main Hall",
        isPaid: false,
        price: 0,
        maxCapacity: 100,
        posterUrl: "https://example.com/poster.jpg",
        organizerName: "Organizer",
        organizerEmail: "organizer@example.com",
        organizerPhone: "08123456789",
        status: "APPROVED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const existingEvents = loadEventsFromDisk();
      await saveEventsToDisk([mockEvent, ...existingEvents.filter((e) => e.id !== mockEvent.id)]);

      try {
        await expect(
          updateEventDetails("evt-test-update-hardening", {
            isPaid: true,
            price: 1000.5,
          })
        ).rejects.toThrow(/pecahan desimal/);
      } finally {
        await saveEventsToDisk(existingEvents);
      }
    });

    it("4.3 updateEventDetails menolak pembaruan kuota melebihi 1.000", async () => {
      const mockEvent: CommunityEvent = {
        id: "evt-test-capacity-update",
        title: "Capacity Test Event",
        category: "CREATIVE",
        description: "Deskripsi event sebelumnya yang sudah valid.",
        startDate: "2026-12-01T10:00:00.000Z",
        endDate: "2026-12-01T15:00:00.000Z",
        location: "Main Hall",
        isPaid: false,
        price: 0,
        maxCapacity: 100,
        posterUrl: "https://example.com/poster.jpg",
        organizerName: "Organizer",
        organizerEmail: "organizer@example.com",
        organizerPhone: "08123456789",
        status: "APPROVED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const existingEvents = loadEventsFromDisk();
      await saveEventsToDisk([mockEvent, ...existingEvents.filter((e) => e.id !== mockEvent.id)]);

      try {
        await expect(
          updateEventDetails("evt-test-capacity-update", {
            maxCapacity: 1001,
          })
        ).rejects.toThrow(/tidak boleh melebihi 1.000/);

        await expect(
          updateEventDetails("evt-test-capacity-update", {
            maxCapacity: 1e58,
          })
        ).rejects.toThrow();
      } finally {
        await saveEventsToDisk(existingEvents);
      }
    });

    it("4.4 organizerResubmitEvent menolak kuota tidak valid saat revisi", async () => {
      const mockEvent: CommunityEvent = {
        id: "evt-test-organizer-resubmit",
        title: "Revision Requested Event",
        category: "TECH",
        description: "Deskripsi event valid minimal sepuluh karakter.",
        startDate: "2026-12-01T10:00:00.000Z",
        endDate: "2026-12-01T15:00:00.000Z",
        location: "Tech Lab",
        isPaid: false,
        price: 0,
        maxCapacity: 50,
        posterUrl: "https://example.com/poster.jpg",
        organizerName: "Tech Community",
        organizerEmail: "tech@community.com",
        organizerPhone: "08123456789",
        status: "REVISION_REQUESTED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const existingEvents = loadEventsFromDisk();
      await saveEventsToDisk([mockEvent, ...existingEvents.filter((e) => e.id !== mockEvent.id)]);

      try {
        await expect(
          organizerResubmitEvent("tech@community.com", "evt-test-organizer-resubmit", {
            maxCapacity: 1500,
          })
        ).rejects.toThrow(/tidak boleh melebihi 1.000/);

        await expect(
          organizerResubmitEvent("tech@community.com", "evt-test-organizer-resubmit", {
            maxCapacity: 25.5,
          })
        ).rejects.toThrow(/pecahan desimal/);
      } finally {
        await saveEventsToDisk(existingEvents);
      }
    });
  });

  // =========================================================================
  // 5. PENGUJIAN REGRESI & BOOKING TICKET INTEGRATION
  // =========================================================================
  describe("5. Pengujian Regresi Booking, Kapasitas, & Multi-Role", () => {
    it("5.1 Booking validasi tiket tetap berfungsi normal", () => {
      const approvedEvent: CommunityEvent = {
        id: "evt-booking-regression-test",
        title: "Approved Community Event",
        category: "WORKSHOP",
        description: "Deskripsi workshop valid minimal sepuluh karakter.",
        startDate: "2026-12-10T10:00:00.000Z",
        endDate: "2026-12-10T15:00:00.000Z",
        location: "Main Hall Dago Creative Hub",
        isPaid: true,
        price: 50000,
        maxCapacity: 100,
        posterUrl: "https://example.com/poster.jpg",
        organizerName: "Dago Organizer",
        organizerEmail: "dago@example.com",
        organizerPhone: "08123456789",
        status: "APPROVED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const validBooking = {
        eventId: approvedEvent.id,
        guestName: "Budi Santoso",
        guestEmail: "budi@example.com",
        guestPhone: "081234567890",
        ticketCount: 2,
        paymentMethod: "MANUAL_TRANSFER" as const,
      };

      const check = validateEventBooking(validBooking, approvedEvent);
      expect(check.valid).toBe(true);
      expect(check.errors).toHaveLength(0);

      // Ticket count invalid
      const invalidBooking = {
        ...validBooking,
        ticketCount: 0,
      };
      const checkInvalid = validateEventBooking(invalidBooking, approvedEvent);
      expect(checkInvalid.valid).toBe(false);
      expect(checkInvalid.errors.some((e) => e.includes("antara 1 sampai"))).toBe(true);
    });

    it("5.2 SUPER_ADMIN dan OWNER tetap dapat memperbarui detail event melalui PUT /api/events/[id]", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue({
        authorized: true,
        userId: "admin-super",
        name: "Super Admin",
        role: "SUPER_ADMIN",
      });

      const mockEvent: CommunityEvent = {
        id: "evt-put-api-test",
        title: "Event Sebelum Update",
        category: "COMMUNITY",
        description: "Deskripsi awal yang valid lebih dari sepuluh karakter.",
        startDate: "2026-12-05T10:00:00.000Z",
        endDate: "2026-12-05T15:00:00.000Z",
        location: "Amphitheater Dago Creative Hub",
        isPaid: false,
        price: 0,
        maxCapacity: 80,
        posterUrl: "https://example.com/poster.jpg",
        organizerName: "Community",
        organizerEmail: "comm@example.com",
        organizerPhone: "08123456789",
        status: "APPROVED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const existingEvents = loadEventsFromDisk();
      await saveEventsToDisk([mockEvent, ...existingEvents.filter((e) => e.id !== mockEvent.id)]);

      try {
        const req = new NextRequest(`http://localhost:3000/api/events/${mockEvent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Event Sesudah Update Valid",
            isPaid: true,
            price: 60000,
            maxCapacity: 90,
          }),
        });

        const res = await putEventRoute(req, { params: Promise.resolve({ id: mockEvent.id }) });
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.data.title).toBe("Event Sesudah Update Valid");
        expect(json.data.price).toBe(60000);
        expect(json.data.maxCapacity).toBe(90);
      } finally {
        await saveEventsToDisk(existingEvents);
      }
    });

    it("5.3 PUT /api/events/[id] mengembalikan HTTP 400 ketika admin mengirimkan harga desimal", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue({
        authorized: true,
        userId: "admin-super",
        name: "Super Admin",
        role: "SUPER_ADMIN",
      });

      const mockEvent: CommunityEvent = {
        id: "evt-put-api-invalid-price",
        title: "Event Admin Put",
        category: "COMMUNITY",
        description: "Deskripsi awal yang valid lebih dari sepuluh karakter.",
        startDate: "2026-12-05T10:00:00.000Z",
        endDate: "2026-12-05T15:00:00.000Z",
        location: "Amphitheater Dago Creative Hub",
        isPaid: false,
        price: 0,
        maxCapacity: 80,
        posterUrl: "https://example.com/poster.jpg",
        organizerName: "Community",
        organizerEmail: "comm@example.com",
        organizerPhone: "08123456789",
        status: "APPROVED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const existingEvents = loadEventsFromDisk();
      await saveEventsToDisk([mockEvent, ...existingEvents.filter((e) => e.id !== mockEvent.id)]);

      try {
        const req = new NextRequest(`http://localhost:3000/api/events/${mockEvent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isPaid: true,
            price: 15000.75,
          }),
        });

        const res = await putEventRoute(req, { params: Promise.resolve({ id: mockEvent.id }) });
        expect(res.status).toBe(400);

        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toContain("pecahan desimal");
      } finally {
        await saveEventsToDisk(existingEvents);
      }
    });
  });

  // =========================================================================
  // 6. ADV-01 — PROTEKSI PENURUNAN KUOTA EVENT TERHADAP TIKET AKTIF
  // =========================================================================
  describe("6. ADV-01 — Proteksi Penurunan Kuota Event Terhadap Tiket Aktif", () => {
    const testEventId = "evt-adv01-capacity-guard";

    const baseEvent: CommunityEvent = {
      id: testEventId,
      title: "ADV-01 Quota Hardening Event",
      category: "TECH",
      description: "Deskripsi event untuk pengujian proteksi kuota tiket aktif.",
      startDate: "2026-12-15T10:00:00.000Z",
      endDate: "2026-12-15T15:00:00.000Z",
      location: "Main Hall Dago Creative Hub",
      isPaid: true,
      price: 50000,
      maxCapacity: 50,
      posterUrl: "https://example.com/poster.jpg",
      organizerName: "Tech Hub",
      organizerEmail: "organizer@techhub.com",
      organizerPhone: "08123456789",
      status: "APPROVED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let originalEvents: CommunityEvent[] = [];
    let originalBookings: EventTicketOrder[] = [];

    beforeEach(() => {
      originalEvents = loadEventsFromDisk();
      originalBookings = loadBookingsFromDisk();
    });

    afterEach(async () => {
      await saveEventsToDisk(originalEvents);
      await saveBookingsToDisk(originalBookings);
    });

    it("6.1 getEventActiveBookedTicketCount menghitung tiket aktif dengan tepat dan mengecualikan cancelled/expired", () => {
      const mockBookings: EventTicketOrder[] = ([
        // 1. Paid booking dengan 2 tiket
        {
          id: "bk-1",
          eventId: testEventId,
          guestName: "User 1",
          guestEmail: "u1@example.com",
          guestPhone: "08111",
          ticketCount: 2,
          totalPrice: 100000,
          paymentStatus: "PAID",
          paymentMethod: "MANUAL_TRANSFER",
          platformFeePercent: 20,
          platformFeeAmount: 20000,
          organizerRevenueAmount: 80000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        // 2. Paid booking dengan 3 tiket dan sudah CHECKED_IN
        {
          id: "bk-2",
          eventId: testEventId,
          guestName: "User 2",
          guestEmail: "u2@example.com",
          guestPhone: "08222",
          ticketCount: 3,
          totalPrice: 150000,
          paymentStatus: "PAID",
          paymentMethod: "QRIS",
          checkInStatus: "CHECKED_IN",
          platformFeePercent: 20,
          platformFeeAmount: 30000,
          organizerRevenueAmount: 120000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        // 3. Active pending booking dengan 1 tiket (baru dibuat, belum expired)
        {
          id: "bk-3",
          eventId: testEventId,
          guestName: "User 3",
          guestEmail: "u3@example.com",
          guestPhone: "08333",
          ticketCount: 1,
          totalPrice: 50000,
          paymentStatus: "PENDING",
          paymentMethod: "MANUAL_TRANSFER",
          platformFeePercent: 20,
          platformFeeAmount: 10000,
          organizerRevenueAmount: 40000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        // 4. Cancelled booking (tidak boleh dihitung)
        {
          id: "bk-4",
          eventId: testEventId,
          guestName: "User 4",
          guestEmail: "u4@example.com",
          guestPhone: "08444",
          ticketCount: 5,
          totalPrice: 250000,
          paymentStatus: "CANCELLED",
          paymentMethod: "MANUAL_TRANSFER",
          platformFeePercent: 20,
          platformFeeAmount: 50000,
          organizerRevenueAmount: 200000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        // 5. Expired booking (tidak boleh dihitung)
        {
          id: "bk-5",
          eventId: testEventId,
          guestName: "User 5",
          guestEmail: "u5@example.com",
          guestPhone: "08555",
          ticketCount: 4,
          totalPrice: 200000,
          paymentStatus: "EXPIRED",
          paymentMethod: "MANUAL_TRANSFER",
          platformFeePercent: 20,
          platformFeeAmount: 40000,
          organizerRevenueAmount: 160000,
          createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as any[]).map(createMockTicketOrder);

      // Total aktif = 2 (PAID) + 3 (PAID + CHECKED_IN) + 1 (PENDING) = 6 tiket
      const count = getEventActiveBookedTicketCount(testEventId, mockBookings);
      expect(count).toBe(6);
    });

    it("6.2 Kuota baru lebih kecil daripada tiket aktif: ditolak dengan pesan yang sesuai", async () => {
      await saveEventsToDisk([baseEvent, ...originalEvents.filter((e) => e.id !== baseEvent.id)]);

      // 10 tiket aktif (2 transaksi @ 6 dan 4 tiket)
      const mockBookings: EventTicketOrder[] = ([
        {
          id: `bk-active-1-${Date.now()}`,
          eventId: testEventId,
          guestName: "Peserta Satu",
          guestEmail: "p1@example.com",
          guestPhone: "08111111111",
          ticketCount: 6,
          totalPrice: 300000,
          paymentStatus: "PAID",
          paymentMethod: "MANUAL_TRANSFER",
          platformFeePercent: 20,
          platformFeeAmount: 60000,
          organizerRevenueAmount: 240000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: `bk-active-2-${Date.now()}`,
          eventId: testEventId,
          guestName: "Peserta Dua",
          guestEmail: "p2@example.com",
          guestPhone: "08222222222",
          ticketCount: 4,
          totalPrice: 200000,
          paymentStatus: "PAID",
          paymentMethod: "QRIS",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as any[]).map(createMockTicketOrder);
      await saveBookingsToDisk([...mockBookings, ...originalBookings.filter((b) => b.eventId !== testEventId)]);

      // Coba turunkan kuota ke 9 (padahal sudah ada 10 tiket aktif)
      await expect(
        updateEventDetails(testEventId, { maxCapacity: 9 })
      ).rejects.toThrow(
        "Kapasitas baru (9) tidak boleh lebih kecil dari jumlah tiket yang sudah dipesan atau terjual (10 tiket)."
      );
    });

    it("6.3 Kuota baru sama dengan tiket aktif: diterima", async () => {
      await saveEventsToDisk([baseEvent, ...originalEvents.filter((e) => e.id !== baseEvent.id)]);

      const mockBookings: EventTicketOrder[] = ([
        {
          id: `bk-exact-${Date.now()}`,
          eventId: testEventId,
          guestName: "Peserta Exact",
          guestEmail: "pe@example.com",
          guestPhone: "0812345678",
          ticketCount: 15,
          totalPrice: 750000,
          paymentStatus: "PAID",
          paymentMethod: "MANUAL_TRANSFER",
          platformFeePercent: 20,
          platformFeeAmount: 150000,
          organizerRevenueAmount: 600000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as any[]).map(createMockTicketOrder);
      await saveBookingsToDisk([...mockBookings, ...originalBookings.filter((b) => b.eventId !== testEventId)]);

      // Update kuota persis ke 15 (sama dengan 15 tiket aktif)
      const updated = await updateEventDetails(testEventId, { maxCapacity: 15 });
      expect(updated.maxCapacity).toBe(15);
    });

    it("6.4 Kuota baru lebih besar daripada tiket aktif: diterima", async () => {
      await saveEventsToDisk([baseEvent, ...originalEvents.filter((e) => e.id !== baseEvent.id)]);

      const mockBookings: EventTicketOrder[] = ([
        {
          id: `bk-greater-${Date.now()}`,
          eventId: testEventId,
          guestName: "Peserta Greater",
          guestEmail: "pg@example.com",
          guestPhone: "0812345678",
          ticketCount: 10,
          totalPrice: 500000,
          paymentStatus: "PAID",
          paymentMethod: "MANUAL_TRANSFER",
          platformFeePercent: 20,
          platformFeeAmount: 100000,
          organizerRevenueAmount: 400000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as any[]).map(createMockTicketOrder);
      await saveBookingsToDisk([...mockBookings, ...originalBookings.filter((b) => b.eventId !== testEventId)]);

      // Update kuota ke 25 (lebih besar dari 10 tiket aktif)
      const updated = await updateEventDetails(testEventId, { maxCapacity: 25 });
      expect(updated.maxCapacity).toBe(25);
    });

    it("6.5 Booking expired dan cancelled tidak menghalangi penurunan kuota", async () => {
      await saveEventsToDisk([baseEvent, ...originalEvents.filter((e) => e.id !== baseEvent.id)]);

      const mockBookings: EventTicketOrder[] = ([
        // Hanya 3 tiket PAID yang aktif
        {
          id: `bk-paid-${Date.now()}`,
          eventId: testEventId,
          guestName: "Paid User",
          guestEmail: "paid@example.com",
          guestPhone: "0812345678",
          ticketCount: 3,
          totalPrice: 150000,
          paymentStatus: "PAID",
          paymentMethod: "MANUAL_TRANSFER",
          platformFeePercent: 20,
          platformFeeAmount: 30000,
          organizerRevenueAmount: 120000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        // 20 tiket CANCELLED (kuota telah dikembalikan)
        {
          id: `bk-cancelled-${Date.now()}`,
          eventId: testEventId,
          guestName: "Cancelled User",
          guestEmail: "canc@example.com",
          guestPhone: "0812345678",
          ticketCount: 20,
          totalPrice: 1000000,
          paymentStatus: "CANCELLED",
          paymentMethod: "MANUAL_TRANSFER",
          platformFeePercent: 20,
          platformFeeAmount: 200000,
          organizerRevenueAmount: 800000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        // 15 tiket EXPIRED (kuota telah dikembalikan)
        {
          id: `bk-expired-${Date.now()}`,
          eventId: testEventId,
          guestName: "Expired User",
          guestEmail: "exp@example.com",
          guestPhone: "0812345678",
          ticketCount: 15,
          totalPrice: 750000,
          paymentStatus: "EXPIRED",
          paymentMethod: "MANUAL_TRANSFER",
          platformFeePercent: 20,
          platformFeeAmount: 150000,
          organizerRevenueAmount: 600000,
          createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as any[]).map(createMockTicketOrder);
      await saveBookingsToDisk([...mockBookings, ...originalBookings.filter((b) => b.eventId !== testEventId)]);

      // Turunkan kuota ke 5 (hanya 3 tiket aktif, 35 tiket lain sudah cancelled/expired) -> harus BERHASIL
      const updated = await updateEventDetails(testEventId, { maxCapacity: 5 });
      expect(updated.maxCapacity).toBe(5);
    });

    it("6.6 Tiket berstatus CHECKED_IN tetap dihitung sebagai kapasitas aktif", async () => {
      await saveEventsToDisk([baseEvent, ...originalEvents.filter((e) => e.id !== baseEvent.id)]);

      const mockBookings: EventTicketOrder[] = ([
        {
          id: `bk-checked-in-${Date.now()}`,
          eventId: testEventId,
          guestName: "Checked In User",
          guestEmail: "checkin@example.com",
          guestPhone: "0812345678",
          ticketCount: 8,
          totalPrice: 400000,
          paymentStatus: "PAID",
          paymentMethod: "QRIS",
          checkInStatus: "CHECKED_IN",
          platformFeePercent: 20,
          platformFeeAmount: 80000,
          organizerRevenueAmount: 320000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as any[]).map(createMockTicketOrder);
      await saveBookingsToDisk([...mockBookings, ...originalBookings.filter((b) => b.eventId !== testEventId)]);

      // Kuota tidak boleh diturunkan di bawah 8
      await expect(
        updateEventDetails(testEventId, { maxCapacity: 7 })
      ).rejects.toThrow(
        "Kapasitas baru (7) tidak boleh lebih kecil dari jumlah tiket yang sudah dipesan atau terjual (8 tiket)."
      );
    });

    it("6.7 Satu booking dengan multiple tickets dihitung berdasarkan total tiket, bukan baris booking", async () => {
      await saveEventsToDisk([baseEvent, ...originalEvents.filter((e) => e.id !== baseEvent.id)]);

      // 1 baris booking tetapi berisi 10 tiket
      const mockBookings: EventTicketOrder[] = ([
        {
          id: `bk-multi-ticket-${Date.now()}`,
          eventId: testEventId,
          guestName: "Group Buyer",
          guestEmail: "group@example.com",
          guestPhone: "0812345678",
          ticketCount: 10,
          totalPrice: 500000,
          paymentStatus: "PAID",
          paymentMethod: "MANUAL_TRANSFER",
          platformFeePercent: 20,
          platformFeeAmount: 100000,
          organizerRevenueAmount: 400000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as any[]).map(createMockTicketOrder);
      await saveBookingsToDisk([...mockBookings, ...originalBookings.filter((b) => b.eventId !== testEventId)]);

      // Coba ubah kuota menjadi 9 (meskipun hanya 1 booking baris, tiket berjumlah 10) -> harus ditolak
      await expect(
        updateEventDetails(testEventId, { maxCapacity: 9 })
      ).rejects.toThrow(
        "Kapasitas baru (9) tidak boleh lebih kecil dari jumlah tiket yang sudah dipesan atau terjual (10 tiket)."
      );
    });

    it("6.8 Payload parsial tanpa maxCapacity tidak mengubah kapasitas event", async () => {
      await saveEventsToDisk([baseEvent, ...originalEvents.filter((e) => e.id !== baseEvent.id)]);

      const updated = await updateEventDetails(testEventId, {
        title: "Judul Baru Saja",
      });

      expect(updated.title).toBe("Judul Baru Saja");
      expect(updated.maxCapacity).toBe(50); // tetap 50
    });

    it("6.9 Penolakan update kapasitas tidak mengubah data booking maupun kuota yang ada", async () => {
      await saveEventsToDisk([baseEvent, ...originalEvents.filter((e) => e.id !== baseEvent.id)]);

      const mockBookings: EventTicketOrder[] = ([
        {
          id: `bk-preserve-${Date.now()}`,
          eventId: testEventId,
          guestName: "Preserve Buyer",
          guestEmail: "preserve@example.com",
          guestPhone: "0812345678",
          ticketCount: 12,
          totalPrice: 600000,
          paymentStatus: "PAID",
          paymentMethod: "MANUAL_TRANSFER",
          platformFeePercent: 20,
          platformFeeAmount: 120000,
          organizerRevenueAmount: 480000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as any[]).map(createMockTicketOrder);
      await saveBookingsToDisk([...mockBookings, ...originalBookings.filter((b) => b.eventId !== testEventId)]);

      try {
        await updateEventDetails(testEventId, { maxCapacity: 5 });
      } catch (err) {
        // Expected to fail
      }

      // Pastikan kuota event tetap 50
      const currentEvents = loadEventsFromDisk();
      const currentEvt = currentEvents.find((e) => e.id === testEventId);
      expect(currentEvt?.maxCapacity).toBe(50);

      // Pastikan booking tetap utuh
      const currentBookings = loadBookingsFromDisk();
      const bFound = currentBookings.find((b) => b.eventId === testEventId);
      expect(bFound?.ticketCount).toBe(12);
    });

    it("6.10 PUT /api/events/[id] mengembalikan HTTP 400 ketika admin mencoba menurunkan kuota di bawah tiket aktif", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue({
        authorized: true,
        userId: "admin-super",
        name: "Super Admin",
        role: "SUPER_ADMIN",
      });

      await saveEventsToDisk([baseEvent, ...originalEvents.filter((e) => e.id !== baseEvent.id)]);

      const mockBookings: EventTicketOrder[] = ([
        {
          id: `bk-api-guard-${Date.now()}`,
          eventId: testEventId,
          guestName: "API Guard User",
          guestEmail: "apiguard@example.com",
          guestPhone: "0812345678",
          ticketCount: 20,
          totalPrice: 1000000,
          paymentStatus: "PAID",
          paymentMethod: "QRIS",
          platformFeePercent: 20,
          platformFeeAmount: 200000,
          organizerRevenueAmount: 800000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as any[]).map(createMockTicketOrder);
      await saveBookingsToDisk([...mockBookings, ...originalBookings.filter((b) => b.eventId !== testEventId)]);

      const req = new NextRequest(`http://localhost:3000/api/events/${testEventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxCapacity: 15,
        }),
      });

      const res = await putEventRoute(req, { params: Promise.resolve({ id: testEventId }) });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Kapasitas baru (15) tidak boleh lebih kecil dari jumlah tiket yang sudah dipesan atau terjual (20 tiket).");
    });
  });

  // =========================================================================
  // 7. RC-01 — RACE CONDITION & SERIALISASI LOCK (CAPACITY VS BOOKING)
  // =========================================================================
  describe("7. RC-01 — Race Condition & Serialisasi Lock (Capacity vs Booking)", () => {
    const rcEventId = "evt-rc01-concurrency-test";
    const rcBaseEvent: CommunityEvent = {
      id: rcEventId,
      title: "RC-01 Concurrency Hardened Event",
      category: "WORKSHOP",
      description: "Deskripsi event valid sepuluh karakter.",
      startDate: "2026-12-25T10:00:00.000Z",
      endDate: "2026-12-25T18:00:00.000Z",
      location: "Room A Dago Creative Hub",
      isPaid: true,
      price: 50000,
      maxCapacity: 10,
      posterUrl: "https://example.com/poster.jpg",
      organizerName: "Dago Tech",
      organizerEmail: "dagotech@example.com",
      organizerPhone: "0812345678",
      status: "APPROVED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let existingEvents: CommunityEvent[] = [];
    let existingBookings: EventTicketOrder[] = [];

    beforeEach(async () => {
      existingEvents = loadEventsFromDisk();
      existingBookings = loadBookingsFromDisk();
      await saveEventsToDisk([rcBaseEvent, ...existingEvents.filter((e) => e.id !== rcEventId)]);
    });

    afterEach(async () => {
      await saveEventsToDisk(existingEvents);
      await saveBookingsToDisk(existingBookings);
    });

    it("7.1 Serialisasi: Update kapasitas duluan menolak booking konkuren yang melebihi kapasitas baru", async () => {
      // Kondisi awal: 5 tiket terjual (sisa 5 tiket dari kapasitas 10)
      const initialBooking: EventTicketOrder = createMockTicketOrder({
        id: `bk-rc-init-${Date.now()}`,
        eventId: rcEventId,
        guestName: "Initial User",
        guestEmail: "user1@example.com",
        guestPhone: "0812345678",
        ticketCount: 5,
        totalPrice: 250000,
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        platformFeePercent: 20,
        platformFeeAmount: 50000,
        organizerRevenueAmount: 200000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await saveBookingsToDisk([initialBooking, ...existingBookings.filter((b) => b.eventId !== rcEventId)]);

      // Eksekusi konkuren: Admin menurunkan kapasitas ke 6 (sisa 1), user secara konkuren mencoba memesan 3 tiket
      const updateCapacityPromise = updateEventDetails(rcEventId, { maxCapacity: 6 });
      const bookingPromise = createEventBooking({
        eventId: rcEventId,
        guestName: "Concurrent Booker",
        guestEmail: "booker2@example.com",
        guestPhone: "0812345679",
        ticketCount: 3,
        paymentMethod: "QRIS",
      }, "127.0.0.10");

      const [updateResult, bookingResult] = await Promise.allSettled([
        updateCapacityPromise,
        bookingPromise,
      ]);

      // Update kapasitas berhasil
      expect(updateResult.status).toBe("fulfilled");
      if (updateResult.status === "fulfilled") {
        expect(updateResult.value.maxCapacity).toBe(6);
      }

      // Booking ditolak karena kapasitas baru (6 - 5 = 1 tiket sisa) tidak mencukupi untuk 3 tiket
      expect(bookingResult.status).toBe("rejected");
      if (bookingResult.status === "rejected") {
        expect(bookingResult.reason.message).toContain("Kapasitas venue atau kuota tiket telah penuh");
      }

      // Verifikasi konsistensi disk: total tiket aktif (5) <= kapasitas (6), TIDAK PERNAH OVERBOOKING
      const currentBooked = getEventActiveBookedTicketCount(rcEventId);
      expect(currentBooked).toBe(5);
    });

    it("7.2 Serialisasi: Booking duluan menolak penurunan kapasitas konkuren yang menabrak kuota", async () => {
      // Kondisi awal: 5 tiket terjual dari kapasitas 10
      const initialBooking: EventTicketOrder = createMockTicketOrder({
        id: `bk-rc-init2-${Date.now()}`,
        eventId: rcEventId,
        guestName: "Initial User 2",
        guestEmail: "user2@example.com",
        guestPhone: "0812345678",
        ticketCount: 5,
        totalPrice: 250000,
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        platformFeePercent: 20,
        platformFeeAmount: 50000,
        organizerRevenueAmount: 200000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await saveBookingsToDisk([initialBooking, ...existingBookings.filter((b) => b.eventId !== rcEventId)]);

      // Eksekusi booking 3 tiket terlebih dahulu (total booked menjadi 8)
      const bookingPromise = createEventBooking({
        eventId: rcEventId,
        guestName: "Concurrent Booker Ahead",
        guestEmail: "ahead@example.com",
        guestPhone: "0812345679",
        ticketCount: 3,
        paymentMethod: "QRIS",
      }, "127.0.0.11");

      // Admin secara konkuren mengirim penurunan kapasitas ke 6
      const updateCapacityPromise = updateEventDetails(rcEventId, { maxCapacity: 6 });

      const [bookingResult, updateResult] = await Promise.allSettled([
        bookingPromise,
        updateCapacityPromise,
      ]);

      // Booking berhasil diproses
      expect(bookingResult.status).toBe("fulfilled");

      // Update kapasitas ditolak karena tiket aktif sudah 8 tiket
      expect(updateResult.status).toBe("rejected");
      if (updateResult.status === "rejected") {
        expect(updateResult.reason.message).toContain("tidak boleh lebih kecil dari jumlah tiket yang sudah dipesan");
      }

      // Verifikasi: kapasitas tetap 10, total booked 8 (konsisten)
      const currentEvents = loadEventsFromDisk();
      const eventNow = currentEvents.find((e) => e.id === rcEventId);
      expect(eventNow?.maxCapacity).toBe(10);
      expect(getEventActiveBookedTicketCount(rcEventId)).toBe(8);
    });

    it("7.3 Pelepasan lock saat error (Lock Release on Error): antrean booking tidak deadlock jika update kapasitas melempar error", async () => {
      // Admin mencoba update dengan kuota tidak valid (melempar error)
      await expect(
        updateEventDetails(rcEventId, { maxCapacity: -5 })
      ).rejects.toThrow();

      // Booking berikutnya harus tetap bisa dieksekusi dengan normal tanpa hang / deadlock
      const booking = await createEventBooking({
        eventId: rcEventId,
        guestName: "Post Error Booker",
        guestEmail: "posterror@example.com",
        guestPhone: "0812345679",
        ticketCount: 1,
        paymentMethod: "QRIS",
      }, "127.0.0.12");

      expect(booking).toBeDefined();
      expect(booking.ticketCount).toBe(1);
    });

    it("7.4 Deadlock-Free: Hierarchical lock acquisition (withEventLock -> withBookingLock) menyelesaikan promise secara normal", async () => {
      let executed = false;
      await withEventLock(async () => {
        await withBookingLock(async () => {
          executed = true;
        });
      });
      expect(executed).toBe(true);
    });
  });

  // =========================================================================
  // 8. SYNC-01 — FAIL-CLOSED STORAGE SYNC FAILURE
  // =========================================================================
  describe("8. SYNC-01 — Fail-Closed Storage Sync Failure", () => {
    const syncEventId = "evt-sync01-test";
    const syncBaseEvent: CommunityEvent = {
      id: syncEventId,
      title: "Sync Fail-Closed Hardened Event",
      category: "WORKSHOP",
      description: "Deskripsi event valid sepuluh karakter.",
      startDate: "2026-12-25T10:00:00.000Z",
      endDate: "2026-12-25T18:00:00.000Z",
      location: "Room B Dago Creative Hub",
      isPaid: true,
      price: 50000,
      maxCapacity: 50,
      posterUrl: "https://example.com/poster.jpg",
      organizerName: "Dago Tech",
      organizerEmail: "dagotech@example.com",
      organizerPhone: "0812345678",
      status: "APPROVED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let existingEvents: CommunityEvent[] = [];
    let originalEnvUrl: string | undefined;

    beforeEach(async () => {
      originalEnvUrl = process.env.DATABASE_URL;
      existingEvents = loadEventsFromDisk();
      await saveEventsToDisk([syncBaseEvent, ...existingEvents.filter((e) => e.id !== syncEventId)]);
    });

    afterEach(async () => {
      process.env.DATABASE_URL = originalEnvUrl;
      await saveEventsToDisk(existingEvents);
      vi.restoreAllMocks();
    });

    it("8.1 PUT /api/events/[id] mengembalikan HTTP 503 jika sinkronisasi storage event_bookings.json gagal saat DATABASE_URL aktif", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue({
        authorized: true,
        userId: "admin-super",
        name: "Super Admin",
        role: "SUPER_ADMIN",
      });

      process.env.DATABASE_URL = "postgresql://mock@neon.tech/test";

      // Simulasikan database cloud down / UNAVAILABLE
      vi.spyOn(dataStorage, "syncStorageFromDbWithSnapshot").mockResolvedValue({
        success: false,
        status: "UNAVAILABLE",
        recordFound: false,
      });

      const req = new NextRequest(`http://localhost:3000/api/events/${syncEventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxCapacity: 30,
        }),
      });

      const res = await putEventRoute(req, { params: Promise.resolve({ id: syncEventId }) });
      expect(res.status).toBe(503);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Layanan database cloud sedang mengalami gangguan");
    });

    it("8.2 PUT /api/events/[id] mengembalikan HTTP 503 jika sinkronisasi storage melempar exception saat DATABASE_URL aktif", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue({
        authorized: true,
        userId: "admin-super",
        name: "Super Admin",
        role: "SUPER_ADMIN",
      });

      process.env.DATABASE_URL = "postgresql://mock@neon.tech/test";

      // Simulasikan network drop / timeout exception
      vi.spyOn(dataStorage, "syncStorageFromDbWithSnapshot").mockRejectedValue(
        new Error("Connection to PostgreSQL terminated unexpectedly")
      );

      const req = new NextRequest(`http://localhost:3000/api/events/${syncEventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxCapacity: 25,
        }),
      });

      const res = await putEventRoute(req, { params: Promise.resolve({ id: syncEventId }) });
      expect(res.status).toBe(503);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Layanan database cloud sedang mengalami gangguan");
    });

    it("8.3 PUT /api/events/portal mengembalikan HTTP 503 jika organizer resubmit kapasitas baru saat DB down", async () => {
      vi.spyOn(serverAuth, "assertOrganizerAuth").mockResolvedValue({
        authorized: true,
        email: "dagotech@example.com",
        isAdmin: false,
      });

      process.env.DATABASE_URL = "postgresql://mock@neon.tech/test";

      vi.spyOn(dataStorage, "syncStorageFromDbWithSnapshot").mockResolvedValue({
        success: false,
        status: "TIMEOUT",
        recordFound: false,
      });

      const req = new NextRequest("http://localhost:3000/api/events/portal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "dagotech@example.com",
          eventId: syncEventId,
          updates: {
            maxCapacity: 40,
          },
        }),
      });

      const res = await putPortalRoute(req);
      expect(res.status).toBe(503);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Layanan database cloud sedang mengalami gangguan");
    });

    it("8.4 Local development tanpa DATABASE_URL mengizinkan update kapasitas tanpa melempar HTTP 503", async () => {
      delete process.env.DATABASE_URL;
      const originalNodeEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = "test";

      vi.spyOn(dataStorage, "syncStorageFromDbWithSnapshot").mockResolvedValue({
        success: false,
        status: "UNAVAILABLE",
        recordFound: false,
      });

      // Update kapasitas pada local dev harus tetap berhasil menggunakan data disk lokal
      const updated = await updateEventDetails(syncEventId, { maxCapacity: 45 });
      expect(updated.maxCapacity).toBe(45);

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  // =========================================================================
  // 9. TAHAP C — MULTI-TIER, RESUBMIT & VALIDATION HARDENING (S-03, S-12)
  // =========================================================================
  describe("9. Tahap C — Multi-Tier, Resubmit & Validation Hardening (S-03, S-12)", () => {
    const tahapCEventId = "evt-tahap-c-test-01";

    beforeEach(() => {
      const allEvents = loadEventsFromDisk();
      const testEvt: CommunityEvent = {
        id: tahapCEventId,
        title: "Tahap C Verification Event",
        category: "TECH",
        description: "Test event for Tahap C multi-tier and validation checks.",
        startDate: "2026-12-10T10:00:00+08:00",
        endDate: "2026-12-10T16:00:00+08:00",
        location: "Dago Creative Hub",
        isPaid: false,
        price: 0,
        maxCapacity: 45,
        status: "APPROVED",
        organizerName: "Dago Tech",
        organizerPhone: "081234567890",
        organizerEmail: "dagotech@example.com",
        posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveEventsToDisk([...allEvents.filter((e) => e.id !== tahapCEventId), testEvt]);
    });

    it("9.1 normalizeDateToWitaIso melempar error validasi tanggal cacat dan bukan RangeError", () => {
      expect(() => normalizeDateToWitaIso("not-a-valid-date")).toThrow(
        /Format tanggal tidak valid/
      );
    });

    it("9.2 updateEventDetails dan organizerResubmitEvent menolak startDate > endDate", async () => {
      await expect(
        updateEventDetails(tahapCEventId, {
          startDate: "2026-12-10T16:00:00+08:00",
          endDate: "2026-12-10T10:00:00+08:00",
        })
      ).rejects.toThrow(/Tanggal dan waktu selesai tidak boleh mendahului tanggal mulai/);

      await expect(
        organizerResubmitEvent("dagotech@example.com", tahapCEventId, {
          startDate: "2026-12-10T16:00:00+08:00",
          endDate: "2026-12-10T10:00:00+08:00",
        })
      ).rejects.toThrow(/Tanggal dan waktu selesai tidak boleh mendahului tanggal mulai/);
    });

    it("9.3 updateEventDetails berhasil ketika hanya mengirim ticketTiers tanpa maxCapacity", async () => {
      const updated = await updateEventDetails(tahapCEventId, {
        ticketTiers: [
          {
            id: "tier-c-1",
            name: "Reguler",
            price: 50000,
            quota: 20,
            isActive: true,
          },
        ],
      });
      expect(updated.ticketTiers).toHaveLength(1);
      expect(updated.ticketTiers?.[0].name).toBe("Reguler");
      expect(updated.maxCapacity).toBe(45);
    });

    it("9.4 validateEventRefundPolicy menolak tipe selain number atau numeric string", () => {
      const resBool = validateEventRefundPolicy({
        policyType: "REFUNDABLE_UNTIL_H_MINUS",
        hMinusDays: true as any,
      });
      expect(resBool.valid).toBe(false);

      const resArray = validateEventRefundPolicy({
        policyType: "REFUNDABLE_UNTIL_H_MINUS",
        hMinusDays: 3,
        refundFeePercent: [10] as any,
      });
      expect(resArray.valid).toBe(false);

      const resValid = validateEventRefundPolicy({
        policyType: "REFUNDABLE_UNTIL_H_MINUS",
        hMinusDays: 3,
        refundFeePercent: 10,
      });
      expect(resValid.valid).toBe(true);
    });

    it("9.5 validateEventSubmission menghilangkan deadlock multi-tier berbayar saat price=0", () => {
      const payload: EventSubmissionPayload = {
        title: "Bali Multi-Tier Conference",
        category: "TECH",
        description: "Konferensi dengan berbagai tier tiket.",
        startDate: "2026-12-15T09:00:00+08:00",
        endDate: "2026-12-15T17:00:00+08:00",
        location: "Dago Hall",
        isPaid: false, // Organizer forms may leave isPaid false or price 0 when configuring tiers
        price: 0,
        maxCapacity: 100,
        posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
        organizerName: "Tech Org",
        organizerEmail: "organizer@tech.org",
        organizerPhone: "081234567890",
        ticketTiers: [
          {
            id: "tier-free",
            name: "Community",
            price: 0,
            quota: 50,
            isActive: true,
          },
          {
            id: "tier-vip",
            name: "VIP",
            price: 150000,
            quota: 50,
            isActive: true,
          },
        ],
      };

      const result = validateEventSubmission(payload);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("9.6 formatEventPriceSummary menampilkan 'Gratis & Berbayar' tanpa 'Mulai dari Rp 0'", () => {
      const summary = formatEventPriceSummary({
        isPaid: false,
        price: 0,
        ticketTiers: [
          { price: 0, isActive: true },
          { price: 50000, isActive: true },
          { price: 100000, isActive: true },
        ],
      });
      expect(summary).toBe("Gratis & Berbayar (Mulai Rp 50.000)");
      expect(summary).not.toContain("Rp 0");
    });

    it("9.7 isEventPaidEffective menghasilkan true saat tier berbayar aktif ada", () => {
      const eventWithPaidTiers = {
        isPaid: false,
        price: 0,
        ticketTiers: [
          { price: 0, isActive: true },
          { price: 75000, isActive: true },
        ],
      };
      expect(isEventPaidEffective(eventWithPaidTiers)).toBe(true);
    });

    it("9.8 getEventTicketAvailability tidak menandai event isSoldOut saat semua tier UPCOMING atau ENDED dengan kuota tersisa", () => {
      const allEvents = loadEventsFromDisk();
      const testEvt: CommunityEvent = {
        id: "evt-tier-upcoming-ended-test",
        title: "Upcoming Tiers Showcase",
        category: "TECH",
        description: "Testing availability status.",
        startDate: "2026-12-20T09:00:00+08:00",
        endDate: "2026-12-20T17:00:00+08:00",
        location: "Dago Hall",
        isPaid: true,
        price: 100000,
        maxCapacity: 50,
        status: "APPROVED",
        posterUrl: "https://example.com/poster.jpg",
        organizerName: "Dago Tech",
        organizerPhone: "081234567890",
        organizerEmail: "dagotech@example.com",
        updatedAt: new Date().toISOString(),
        ticketTiers: [
          {
            id: "tier-up-1",
            name: "Tier Mendatang",
            price: 100000,
            quota: 50,
            isActive: true,
            salesStartDate: "2026-12-01T00:00:00+08:00",
            salesEndDate: "2026-12-10T00:00:00+08:00",
          },
        ],
        createdAt: new Date().toISOString(),
      };
      saveEventsToDisk([...allEvents.filter((e) => e.id !== testEvt.id), testEvt]);

      const avail = getEventTicketAvailability(testEvt.id);
      expect(avail.ticketsRemaining).toBe(50);
      expect(avail.isSoldOut).toBe(false);
      expect(avail.tiers?.[0].salesStatus).toBe("UPCOMING");
    });
  });
});
