import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import * as dataStorage from "@/lib/data-storage";
import {
  deleteEvent,
  deleteEventBooking,
  loadEventsFromDisk,
  loadBookingsFromDisk,
  saveEventsToDisk,
  saveBookingsToDisk,
  updateBookingPaymentStatus,
  getEventTicketAvailability,
  getAdminEventById,
  getBookingById,
} from "@/lib/events";
import { DELETE as deleteEventRoute } from "@/app/api/events/[id]/route";
import { DELETE as deleteBookingRoute } from "@/app/api/events/bookings/[id]/route";
import { CommunityEvent, EventTicketOrder } from "@/types/event";

describe("TASK S-02 — Event & Booking DELETE Mechanisms and Quota Integrity Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dataStorage.resetStorageSyncStatus();
    dataStorage.setStorageSyncStatus("events.json", "SYNCED");
    dataStorage.setStorageSyncStatus("event_bookings.json", "SYNCED");
  });

  // ===========================================================================
  // 1. DELETE EVENT SERVICE TESTS
  // ===========================================================================
  describe("1. deleteEvent Service Guard & Validation", () => {
    it("1.1 should reject deleteEvent if event ID is not found", async () => {
      await expect(deleteEvent("evt-non-existent-9999")).rejects.toThrow(
        /Event dengan ID evt-non-existent-9999 tidak ditemukan/
      );
    });

    it("1.2 should strictly reject hard delete if event has associated bookings", async () => {
      // Mock an event and a booking
      const mockEvent: CommunityEvent = {
        id: "evt-with-booking-001",
        title: "Event With Booking",
        category: "COMMUNITY",
        description: "Test description",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 172800000).toISOString(),
        location: "Dago Lab",
        isPaid: false,
        price: 0,
        status: "APPROVED",
        organizerName: "Test Org",
        organizerContact: "test@dago.com",
        createdAt: new Date().toISOString(),
      };

      const mockBooking: EventTicketOrder = {
        id: "tkt-test-rel-001",
        ticketCode: "DAGO-EVT-00001",
        guestToken: "tok-1",
        eventId: "evt-with-booking-001",
        eventTitle: "Event With Booking",
        eventDate: mockEvent.startDate,
        eventLocation: mockEvent.location,
        guestName: "Test User",
        guestEmail: "user@test.com",
        guestPhone: "08123456789",
        ticketCount: 1,
        unitPrice: 0,
        totalPrice: 0,
        platformFeePercent: 20,
        platformFeeAmount: 0,
        organizerRevenueAmount: 0,
        paymentMethod: "FREE",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        checkedInQty: 0,
        createdAt: new Date().toISOString(),
      };

      const originalEvents = loadEventsFromDisk();
      const originalBookings = loadBookingsFromDisk();

      try {
        await saveEventsToDisk([mockEvent, ...originalEvents]);
        await saveBookingsToDisk([mockBooking, ...originalBookings]);

        await expect(deleteEvent("evt-with-booking-001")).rejects.toThrow(
          /FORBIDDEN_DELETE: Event \[Event With Booking\] .* memiliki 1 data pemesanan\/tiket terkait/
        );
      } finally {
        await saveEventsToDisk(originalEvents);
        await saveBookingsToDisk(originalBookings);
      }
    });

    it("1.3 should successfully delete an event that has 0 bookings and persist changes", async () => {
      const mockEvent: CommunityEvent = {
        id: "evt-zero-booking-999",
        title: "Clean Disposable Event",
        category: "CREATIVE",
        description: "Test description",
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        location: "Dago Amphitheater",
        isPaid: false,
        price: 0,
        status: "APPROVED",
        organizerName: "Fixing Bug",
        organizerContact: "clean@dago.com",
        createdAt: new Date().toISOString(),
      };

      const originalEvents = loadEventsFromDisk();

      try {
        await saveEventsToDisk([mockEvent, ...originalEvents]);
        expect(loadEventsFromDisk().some((e) => e.id === "evt-zero-booking-999")).toBe(true);

        const result = await deleteEvent("evt-zero-booking-999", {
          actorName: "Super Admin",
          actorRole: "SUPER_ADMIN",
        });

        expect(result.success).toBe(true);
        expect(result.event.id).toBe("evt-zero-booking-999");
        expect(loadEventsFromDisk().some((e) => e.id === "evt-zero-booking-999")).toBe(false);
      } finally {
        await saveEventsToDisk(originalEvents);
      }
    });

    it("1.4 should reject deleteEvent if expectedUpdatedAt does not match (CAS optimistic locking)", async () => {
      const mockEvent: CommunityEvent = {
        id: "evt-cas-test-001",
        title: "CAS Guarded Event",
        category: "CREATIVE",
        description: "Test description",
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        location: "Dago Lab",
        isPaid: false,
        price: 0,
        status: "APPROVED",
        organizerName: "Fixing Bug",
        organizerContact: "cas@dago.com",
        createdAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-01T12:00:00.000Z",
      };

      const originalEvents = loadEventsFromDisk();

      try {
        await saveEventsToDisk([mockEvent, ...originalEvents]);

        // Mismatched expectedUpdatedAt
        await expect(
          deleteEvent("evt-cas-test-001", {
            expectedUpdatedAt: "2026-04-01T10:00:00.000Z",
          })
        ).rejects.toThrow(/CONCURRENT_MODIFICATION_ERROR/);

        // Matching expectedUpdatedAt succeeds
        const res = await deleteEvent("evt-cas-test-001", {
          expectedUpdatedAt: "2026-04-01T12:00:00.000Z",
        });
        expect(res.success).toBe(true);
        expect(loadEventsFromDisk().some((e) => e.id === "evt-cas-test-001")).toBe(false);
      } finally {
        await saveEventsToDisk(originalEvents);
      }
    });

    it("1.5 should prevent lost update when concurrent mutation changes updatedAt before delete", async () => {
      const mockEvent: CommunityEvent = {
        id: "evt-concurrent-cas-002",
        title: "Concurrent Target Event",
        category: "CREATIVE",
        description: "Test description",
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        location: "Dago Lab",
        isPaid: false,
        price: 0,
        status: "APPROVED",
        organizerName: "Fixing Bug",
        organizerContact: "cas@dago.com",
        createdAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-01T10:00:00.000Z",
      };

      const originalEvents = loadEventsFromDisk();

      try {
        await saveEventsToDisk([mockEvent, ...originalEvents]);

        // Client reads event at T1
        const initial = loadEventsFromDisk().find((e) => e.id === "evt-concurrent-cas-002")!;
        const clientExpectedTimestamp = initial.updatedAt;

        // Concurrent process mutates the event to T2
        const currentEvents = loadEventsFromDisk();
        const targetIndex = currentEvents.findIndex((e) => e.id === "evt-concurrent-cas-002");
        currentEvents[targetIndex] = {
          ...currentEvents[targetIndex],
          title: "Concurrent Target Event (Updated by process A)",
          updatedAt: "2026-04-01T11:00:00.000Z",
        };
        await saveEventsToDisk(currentEvents);

        // Process B attempts delete with stale T1
        await expect(
          deleteEvent("evt-concurrent-cas-002", {
            expectedUpdatedAt: clientExpectedTimestamp,
          })
        ).rejects.toThrow(/CONCURRENT_MODIFICATION_ERROR/);

        // Event remains safely intact in persistent storage
        expect(loadEventsFromDisk().some((e) => e.id === "evt-concurrent-cas-002")).toBe(true);
      } finally {
        await saveEventsToDisk(originalEvents);
      }
    });

    it("1.6 should fail-closed and abort deleteEvent when cloud database sync fails", async () => {
      const mockEvent: CommunityEvent = {
        id: "evt-db-fail-closed-001",
        title: "DB Fail-Closed Event",
        category: "COMMUNITY",
        description: "Test description",
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        location: "Dago Lab",
        isPaid: false,
        price: 0,
        status: "APPROVED",
        organizerName: "Admin Tester",
        organizerContact: "admin@dago.com",
        createdAt: new Date().toISOString(),
      };

      const originalEvents = loadEventsFromDisk();
      const prevEnv = process.env.DATABASE_URL;
      let syncSpy: any = null;

      try {
        await saveEventsToDisk([mockEvent, ...originalEvents]);
        process.env.DATABASE_URL = "postgresql://mock_user:mock_pass@mock_host:5432/mock_db";

        // Spy syncStorageFromDbWithSnapshot to simulate network failure to Neon DB
        syncSpy = vi.spyOn(dataStorage, "syncStorageFromDbWithSnapshot").mockRejectedValue(
          new dataStorage.DatabasePersistenceError("Koneksi database PostgreSQL terputus.", "events.json", true)
        );

        await expect(deleteEvent("evt-db-fail-closed-001")).rejects.toThrow(/Koneksi database PostgreSQL terputus/);

        // Fail-closed verification: local event was NOT deleted!
        expect(loadEventsFromDisk().some((e) => e.id === "evt-db-fail-closed-001")).toBe(true);
      } finally {
        if (syncSpy) syncSpy.mockRestore();
        process.env.DATABASE_URL = prevEnv;
        await saveEventsToDisk(originalEvents);
      }
    });
  });

  // ===========================================================================
  // 2. DELETE EVENT BOOKING SERVICE TESTS
  // ===========================================================================
  describe("2. deleteEventBooking Service Guard & Validation", () => {
    it("2.1 should reject deleteEventBooking if booking ID is not found", async () => {
      await expect(deleteEventBooking("tkt-not-found-000")).rejects.toThrow(
        /Pemesanan tiket dengan ID tkt-not-found-000 tidak ditemukan/
      );
    });

    it("2.2 should strictly reject deleteEventBooking if booking status is PAID", async () => {
      const mockBooking: EventTicketOrder = {
        id: "tkt-paid-guard-001",
        ticketCode: "DAGO-EVT-PAID01",
        guestToken: "tok-paid",
        eventId: "evt-latte-art-2026",
        eventTitle: "Latte Art",
        eventDate: new Date().toISOString(),
        eventLocation: "Dago Lab",
        guestName: "Paid User",
        guestEmail: "paid@test.com",
        guestPhone: "08123456789",
        ticketCount: 1,
        unitPrice: 50000,
        totalPrice: 50000,
        platformFeePercent: 20,
        platformFeeAmount: 10000,
        organizerRevenueAmount: 40000,
        paymentMethod: "TRANSFER",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        checkedInQty: 0,
        createdAt: new Date().toISOString(),
      };

      const originalBookings = loadBookingsFromDisk();

      try {
        await saveBookingsToDisk([mockBooking, ...originalBookings]);

        await expect(deleteEventBooking("tkt-paid-guard-001")).rejects.toThrow(
          /FORBIDDEN_DELETE: Pemesanan tiket \[DAGO-EVT-PAID01\] berstatus PAID dan tidak dapat dihapus permanen/
        );
      } finally {
        await saveBookingsToDisk(originalBookings);
      }
    });

    it("2.3 should strictly reject deleteEventBooking if attendee has checked in", async () => {
      const mockBooking: EventTicketOrder = {
        id: "tkt-checked-in-001",
        ticketCode: "DAGO-EVT-CHK01",
        guestToken: "tok-chk",
        eventId: "evt-latte-art-2026",
        eventTitle: "Latte Art",
        eventDate: new Date().toISOString(),
        eventLocation: "Dago Lab",
        guestName: "Checked In User",
        guestEmail: "chk@test.com",
        guestPhone: "08123456789",
        ticketCount: 2,
        unitPrice: 0,
        totalPrice: 0,
        platformFeePercent: 20,
        platformFeeAmount: 0,
        organizerRevenueAmount: 0,
        paymentMethod: "FREE",
        paymentStatus: "CANCELLED", // even if cancelled, checked-in records cannot be deleted
        checkInStatus: "CHECKED_IN",
        checkedInQty: 2,
        createdAt: new Date().toISOString(),
      };

      const originalBookings = loadBookingsFromDisk();

      try {
        await saveBookingsToDisk([mockBooking, ...originalBookings]);

        await expect(deleteEventBooking("tkt-checked-in-001")).rejects.toThrow(
          /FORBIDDEN_DELETE: Pemesanan tiket \[DAGO-EVT-CHK01\] memiliki riwayat check-in/
        );
      } finally {
        await saveBookingsToDisk(originalBookings);
      }
    });

    it("2.4 should successfully delete an EXPIRED booking without payment proof, keeping parent event intact", async () => {
      const mockBooking: EventTicketOrder = {
        id: "tkt-expired-disposable-001",
        ticketCode: "DAGO-EVT-EXP01",
        guestToken: "tok-exp",
        eventId: "evt-latte-art-2026",
        eventTitle: "Latte Art",
        eventDate: new Date().toISOString(),
        eventLocation: "Dago Lab",
        guestName: "Expired User",
        guestEmail: "exp@test.com",
        guestPhone: "08123456789",
        ticketCount: 1,
        unitPrice: 35000,
        totalPrice: 35000,
        platformFeePercent: 20,
        platformFeeAmount: 7000,
        organizerRevenueAmount: 28000,
        paymentMethod: "MANUAL_TRANSFER",
        paymentStatus: "EXPIRED",
        checkInStatus: "REGISTERED",
        checkedInQty: 0,
        paymentProofUrl: null,
        createdAt: new Date().toISOString(),
      };

      const originalEvents = loadEventsFromDisk();
      const originalBookings = loadBookingsFromDisk();

      try {
        await saveBookingsToDisk([mockBooking, ...originalBookings]);
        expect(loadBookingsFromDisk().some((b) => b.id === "tkt-expired-disposable-001")).toBe(true);

        const result = await deleteEventBooking("tkt-expired-disposable-001");
        expect(result.success).toBe(true);
        expect(result.booking.id).toBe("tkt-expired-disposable-001");

        // Verify booking is removed
        expect(loadBookingsFromDisk().some((b) => b.id === "tkt-expired-disposable-001")).toBe(false);

        // Verify parent event is completely intact and unmodified!
        const parentEvent = loadEventsFromDisk().find((e) => e.id === "evt-latte-art-2026");
        expect(parentEvent).toBeDefined();
        expect(parentEvent?.title).toBe("Dago Barista Guild: Latte Art Throwdown & Sensory Workshop");
      } finally {
        await saveEventsToDisk(originalEvents);
        await saveBookingsToDisk(originalBookings);
      }
    });

    it("2.5 should strictly reject deleteEventBooking if checkedInSeats has records even with REGISTERED status", async () => {
      const mockBooking: EventTicketOrder = {
        id: "tkt-desync-seats-001",
        ticketCode: "DAGO-EVT-DSYNC01",
        guestToken: "tok-dsync",
        eventId: "evt-latte-art-2026",
        eventTitle: "Latte Art",
        eventDate: new Date().toISOString(),
        eventLocation: "Dago Lab",
        guestName: "Desync Seats User",
        guestEmail: "desync@test.com",
        guestPhone: "08123456789",
        ticketCount: 2,
        unitPrice: 0,
        totalPrice: 0,
        platformFeePercent: 20,
        platformFeeAmount: 0,
        organizerRevenueAmount: 0,
        paymentMethod: "FREE",
        paymentStatus: "CANCELLED",
        checkInStatus: "REGISTERED",
        checkedInQty: 0,
        checkedInSeats: [1], // Desynced seat check-in record
        createdAt: new Date().toISOString(),
      };

      const originalBookings = loadBookingsFromDisk();

      try {
        await saveBookingsToDisk([mockBooking, ...originalBookings]);

        await expect(deleteEventBooking("tkt-desync-seats-001")).rejects.toThrow(
          /FORBIDDEN_DELETE: Pemesanan tiket \[DAGO-EVT-DSYNC01\] memiliki riwayat check-in/
        );
      } finally {
        await saveBookingsToDisk(originalBookings);
      }
    });

    it("2.6 should strictly reject deleteEventBooking if checkInStatus is PARTIALLY_CHECKED_IN", async () => {
      const mockBooking: EventTicketOrder = {
        id: "tkt-partial-checkin-001",
        ticketCode: "DAGO-EVT-PART01",
        guestToken: "tok-part",
        eventId: "evt-latte-art-2026",
        eventTitle: "Latte Art",
        eventDate: new Date().toISOString(),
        eventLocation: "Dago Lab",
        guestName: "Partial Checkin User",
        guestEmail: "partial@test.com",
        guestPhone: "08123456789",
        ticketCount: 3,
        unitPrice: 0,
        totalPrice: 0,
        platformFeePercent: 20,
        platformFeeAmount: 0,
        organizerRevenueAmount: 0,
        paymentMethod: "FREE",
        paymentStatus: "CANCELLED",
        checkInStatus: "PARTIALLY_CHECKED_IN",
        checkedInQty: 1,
        createdAt: new Date().toISOString(),
      };

      const originalBookings = loadBookingsFromDisk();

      try {
        await saveBookingsToDisk([mockBooking, ...originalBookings]);

        await expect(deleteEventBooking("tkt-partial-checkin-001")).rejects.toThrow(
          /FORBIDDEN_DELETE: Pemesanan tiket \[DAGO-EVT-PART01\] memiliki riwayat check-in/
        );
      } finally {
        await saveBookingsToDisk(originalBookings);
      }
    });

    it("2.7 should fail-closed and abort deleteEventBooking when database sync fails", async () => {
      const mockBooking: EventTicketOrder = {
        id: "tkt-fail-sync-001",
        ticketCode: "DAGO-EVT-FAIL01",
        guestToken: "tok-fail",
        eventId: "evt-latte-art-2026",
        eventTitle: "Latte Art",
        eventDate: new Date().toISOString(),
        eventLocation: "Dago Lab",
        guestName: "Fail Sync User",
        guestEmail: "fail@test.com",
        guestPhone: "08123456789",
        ticketCount: 1,
        unitPrice: 0,
        totalPrice: 0,
        platformFeePercent: 20,
        platformFeeAmount: 0,
        organizerRevenueAmount: 0,
        paymentMethod: "FREE",
        paymentStatus: "CANCELLED",
        checkInStatus: "REGISTERED",
        checkedInQty: 0,
        createdAt: new Date().toISOString(),
      };

      const originalBookings = loadBookingsFromDisk();
      const prevEnv = process.env.DATABASE_URL;

      try {
        await saveBookingsToDisk([mockBooking, ...originalBookings]);
        process.env.DATABASE_URL = "postgresql://mock_user:mock_pass@mock_host:5432/mock_db";

        const syncSpy = vi.spyOn(dataStorage, "syncStorageFromDbWithSnapshot").mockRejectedValue(
          new dataStorage.DatabasePersistenceError("Database PostgreSQL unreachable.", "event_bookings.json", true)
        );

        await expect(deleteEventBooking("tkt-fail-sync-001")).rejects.toThrow(/Database PostgreSQL unreachable/);

        // Fail-closed verification: booking was NOT deleted!
        expect(loadBookingsFromDisk().some((b) => b.id === "tkt-fail-sync-001")).toBe(true);
        syncSpy.mockRestore();
      } finally {
        process.env.DATABASE_URL = prevEnv;
        await saveBookingsToDisk(originalBookings);
      }
    });
  });

  // ===========================================================================
  // 3. QUOTA INTEGRITY & CANCELLATION RELEASE VERIFICATION
  // ===========================================================================
  describe("3. Ticket Quota Release on Cancellation", () => {
    it("3.1 should immediately release ticket quota when PAID voucher booking is CANCELLED", async () => {
      const mockEvent: CommunityEvent = {
        id: "evt-quota-test-001",
        title: "Quota Verification Event",
        category: "COMMUNITY",
        description: "Test description",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 172800000).toISOString(),
        location: "Panji Sakti Fitcamp, Singaraja",
        maxCapacity: 10,
        isPaid: false,
        price: 0,
        status: "APPROVED",
        organizerName: "Panji Sakti",
        organizerContact: "panji@dago.com",
        createdAt: new Date().toISOString(),
      };

      const mockBooking: EventTicketOrder = {
        id: "tkt-quota-booking-001",
        ticketCode: "DAGO-EVT-QTA01",
        guestToken: "tok-qta",
        eventId: "evt-quota-test-001",
        eventTitle: "Quota Verification Event",
        eventDate: mockEvent.startDate,
        eventLocation: mockEvent.location,
        guestName: "Quota Guest",
        guestEmail: "guest@test.com",
        guestPhone: "08123456789",
        ticketCount: 3,
        unitPrice: 0,
        totalPrice: 0,
        platformFeePercent: 20,
        platformFeeAmount: 0,
        organizerRevenueAmount: 0,
        paymentMethod: "FREE",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        checkedInQty: 0,
        createdAt: new Date().toISOString(),
      };

      const originalEvents = loadEventsFromDisk();
      const originalBookings = loadBookingsFromDisk();

      try {
        await saveEventsToDisk([mockEvent, ...originalEvents]);
        await saveBookingsToDisk([mockBooking, ...originalBookings]);

        // When PAID: reserved count is 3, remaining is 10 - 3 = 7
        const availBefore = getEventTicketAvailability("evt-quota-test-001");
        expect(availBefore.ticketsReserved).toBe(3);
        expect(availBefore.ticketsRemaining).toBe(7);

        // Cancel booking officially
        const updated = await updateBookingPaymentStatus("tkt-quota-booking-001", "CANCELLED", {
          reason: "Cancellation test for quota release",
          actorName: "Admin Dago",
        });
        expect(updated.paymentStatus).toBe("CANCELLED");

        // When CANCELLED: reserved count drops back to 0, remaining restores to 10!
        const availAfter = getEventTicketAvailability("evt-quota-test-001");
        expect(availAfter.ticketsReserved).toBe(0);
        expect(availAfter.ticketsRemaining).toBe(10);
      } finally {
        await saveEventsToDisk(originalEvents);
        await saveBookingsToDisk(originalBookings);
      }
    });
  });

  // ===========================================================================
  // 4. ROUTE LEVEL RBAC & PERMISSIONS
  // ===========================================================================
  describe("4. Route Handler RBAC Protection", () => {
    it("4.1 should return HTTP 403 on DELETE /api/events/[id] if caller is unauthenticated", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/evt-dummy-id", {
        method: "DELETE",
      });
      const res = await deleteEventRoute(req, {
        params: Promise.resolve({ id: "evt-dummy-id" }),
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/UNAUTHORIZED|FORBIDDEN/);
    });

    it("4.2 should return HTTP 403 on DELETE /api/events/bookings/[id] if caller is unauthenticated", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/bookings/tkt-dummy-id", {
        method: "DELETE",
      });
      const res = await deleteBookingRoute(req, {
        params: Promise.resolve({ id: "tkt-dummy-id" }),
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/UNAUTHORIZED|FORBIDDEN/);
    });

    it("4.3 should return HTTP 200 on DELETE /api/events/[id] when called by Super Admin for 0-booking event", async () => {
      const mockEvent: CommunityEvent = {
        id: "evt-admin-delete-test",
        title: "Admin Delete Test",
        category: "CREATIVE",
        description: "Test description",
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        location: "Dago Lab",
        isPaid: false,
        price: 0,
        status: "APPROVED",
        organizerName: "Admin Tester",
        organizerContact: "admin@dago.com",
        createdAt: new Date().toISOString(),
      };

      const originalEvents = loadEventsFromDisk();

      try {
        await saveEventsToDisk([mockEvent, ...originalEvents]);

        const req = new NextRequest("http://localhost:3000/api/events/evt-admin-delete-test", {
          method: "DELETE",
          headers: {
            cookie: "dagoeng_active_persona=SUPER_ADMIN",
          },
        });

        const res = await deleteEventRoute(req, {
          params: Promise.resolve({ id: "evt-admin-delete-test" }),
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.message).toContain("berhasil dihapus secara permanen");
        expect(loadEventsFromDisk().some((e) => e.id === "evt-admin-delete-test")).toBe(false);
      } finally {
        await saveEventsToDisk(originalEvents);
      }
    });

    it("4.4 should support CAS via If-Match header and return HTTP 409 on timestamp mismatch", async () => {
      const mockEvent: CommunityEvent = {
        id: "evt-cas-route-001",
        title: "Route CAS Test Event",
        category: "CREATIVE",
        description: "Test description",
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        location: "Dago Lab",
        isPaid: false,
        price: 0,
        status: "APPROVED",
        organizerName: "Admin Tester",
        organizerContact: "admin@dago.com",
        createdAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-01T12:00:00.000Z",
      };

      const originalEvents = loadEventsFromDisk();

      try {
        await saveEventsToDisk([mockEvent, ...originalEvents]);

        // 1. Mismatch If-Match -> 409 Conflict
        const mismatchReq = new NextRequest("http://localhost:3000/api/events/evt-cas-route-001", {
          method: "DELETE",
          headers: {
            cookie: "dagoeng_active_persona=SUPER_ADMIN",
            "if-match": '"2026-04-01T11:00:00.000Z"',
          },
        });
        const mismatchRes = await deleteEventRoute(mismatchReq, {
          params: Promise.resolve({ id: "evt-cas-route-001" }),
        });
        expect(mismatchRes.status).toBe(409);
        const mismatchJson = await mismatchRes.json();
        expect(mismatchJson.success).toBe(false);
        expect(mismatchJson.code).toBe("CONCURRENT_MODIFICATION_ERROR");
        expect(loadEventsFromDisk().some((e) => e.id === "evt-cas-route-001")).toBe(true);

        // 2. Matching If-Match -> 200 OK
        const matchReq = new NextRequest("http://localhost:3000/api/events/evt-cas-route-001", {
          method: "DELETE",
          headers: {
            cookie: "dagoeng_active_persona=SUPER_ADMIN",
            "if-match": '"2026-04-01T12:00:00.000Z"',
          },
        });
        const matchRes = await deleteEventRoute(matchReq, {
          params: Promise.resolve({ id: "evt-cas-route-001" }),
        });
        expect(matchRes.status).toBe(200);
        expect(loadEventsFromDisk().some((e) => e.id === "evt-cas-route-001")).toBe(false);
      } finally {
        await saveEventsToDisk(originalEvents);
      }
    });

    it("4.5 should support CAS via expectedUpdatedAt query param and return HTTP 409 on mismatch", async () => {
      const mockEvent: CommunityEvent = {
        id: "evt-cas-query-002",
        title: "Query CAS Test Event",
        category: "CREATIVE",
        description: "Test description",
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        location: "Dago Lab",
        isPaid: false,
        price: 0,
        status: "APPROVED",
        organizerName: "Admin Tester",
        organizerContact: "admin@dago.com",
        createdAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-01T15:00:00.000Z",
      };

      const originalEvents = loadEventsFromDisk();

      try {
        await saveEventsToDisk([mockEvent, ...originalEvents]);

        // Mismatched query parameter -> 409 Conflict
        const mismatchReq = new NextRequest(
          "http://localhost:3000/api/events/evt-cas-query-002?expectedUpdatedAt=2026-04-01T10:00:00.000Z",
          {
            method: "DELETE",
            headers: {
              cookie: "dagoeng_active_persona=SUPER_ADMIN",
            },
          }
        );
        const mismatchRes = await deleteEventRoute(mismatchReq, {
          params: Promise.resolve({ id: "evt-cas-query-002" }),
        });
        expect(mismatchRes.status).toBe(409);
        const mismatchJson = await mismatchRes.json();
        expect(mismatchJson.code).toBe("CONCURRENT_MODIFICATION_ERROR");

        // Matched query parameter -> 200 OK
        const matchReq = new NextRequest(
          "http://localhost:3000/api/events/evt-cas-query-002?expectedUpdatedAt=2026-04-01T15:00:00.000Z",
          {
            method: "DELETE",
            headers: {
              cookie: "dagoeng_active_persona=SUPER_ADMIN",
            },
          }
        );
        const matchRes = await deleteEventRoute(matchReq, {
          params: Promise.resolve({ id: "evt-cas-query-002" }),
        });
        expect(matchRes.status).toBe(200);
        expect(loadEventsFromDisk().some((e) => e.id === "evt-cas-query-002")).toBe(false);
      } finally {
        await saveEventsToDisk(originalEvents);
      }
    });

    it("4.6 should return HTTP 400 when If-Match and query param conflict or format is invalid", async () => {
      // Conflicting parameters
      const conflictReq = new NextRequest(
        "http://localhost:3000/api/events/evt-dummy?expectedUpdatedAt=2026-04-01T10:00:00.000Z",
        {
          method: "DELETE",
          headers: {
            cookie: "dagoeng_active_persona=SUPER_ADMIN",
            "if-match": "2026-04-01T12:00:00.000Z",
          },
        }
      );
      const conflictRes = await deleteEventRoute(conflictReq, {
        params: Promise.resolve({ id: "evt-dummy" }),
      });
      expect(conflictRes.status).toBe(400);
      const conflictJson = await conflictRes.json();
      expect(conflictJson.error).toContain("Konflik parameter");

      // Invalid timestamp format
      const invalidReq = new NextRequest(
        "http://localhost:3000/api/events/evt-dummy?expectedUpdatedAt=not-a-valid-date",
        {
          method: "DELETE",
          headers: {
            cookie: "dagoeng_active_persona=SUPER_ADMIN",
          },
        }
      );
      const invalidRes = await deleteEventRoute(invalidReq, {
        params: Promise.resolve({ id: "evt-dummy" }),
      });
      expect(invalidRes.status).toBe(400);
      const invalidJson = await invalidRes.json();
      expect(invalidJson.error).toContain("Format timestamp");
    });

    it("4.7 should reject with 409 Conflict when expectedUpdatedAt is supplied but target event.updatedAt is undefined", async () => {
      const mockEventWithoutUpdated: CommunityEvent = {
        id: "evt-no-updated-at-001",
        title: "Legacy Event Without UpdatedAt",
        category: "COMMUNITY",
        description: "Test description",
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        location: "Dago Lab",
        isPaid: false,
        price: 0,
        status: "APPROVED",
        organizerName: "Admin Tester",
        organizerContact: "admin@dago.com",
        createdAt: "2026-04-01T10:00:00.000Z",
        // updatedAt deliberately undefined
      };

      const originalEvents = loadEventsFromDisk();

      try {
        await saveEventsToDisk([mockEventWithoutUpdated, ...originalEvents]);

        const req = new NextRequest(
          "http://localhost:3000/api/events/evt-no-updated-at-001?expectedUpdatedAt=2026-04-01T10:00:00.000Z",
          {
            method: "DELETE",
            headers: {
              cookie: "dagoeng_active_persona=SUPER_ADMIN",
            },
          }
        );
        const res = await deleteEventRoute(req, {
          params: Promise.resolve({ id: "evt-no-updated-at-001" }),
        });
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.code).toBe("CONCURRENT_MODIFICATION_ERROR");
        expect(loadEventsFromDisk().some((e) => e.id === "evt-no-updated-at-001")).toBe(true);
      } finally {
        await saveEventsToDisk(originalEvents);
      }
    });

    it("4.8 should return HTTP 404 on DELETE /api/events/[id] if event does not exist", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/evt-non-existent-9999", {
        method: "DELETE",
        headers: {
          cookie: "dagoeng_active_persona=SUPER_ADMIN",
        },
      });
      const res = await deleteEventRoute(req, {
        params: Promise.resolve({ id: "evt-non-existent-9999" }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain("tidak ditemukan");
    });
  });
});
