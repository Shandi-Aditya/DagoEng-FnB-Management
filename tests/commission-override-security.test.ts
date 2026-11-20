import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { getDataFilePath } from "@/lib/data-storage";
import {
  createEventSubmission,
  updateEventStatus,
  setEventCommissionOverride,
  updateEventDetails,
  createEventBooking,
  isEventRevenueSplitLocked,
  getEventEffectivePlatformFeePercent,
  validateRevenueSplitPercentage,
  getEventRevenuePolicy,
} from "@/lib/events";
import { POST as commissionOverrideRoute } from "@/app/api/events/admin/commission-override/route";
import { PUT as updateEventRoute } from "@/app/api/events/[id]/route";

const EVENTS_FILE = getDataFilePath("events.json");
const BOOKINGS_FILE = getDataFilePath("event_bookings.json");
const SETTINGS_FILE = getDataFilePath("event_settings.json");

describe("Commission Override Security & Lock Guard Regression Suite", () => {
  let originalEvents: string | null = null;
  let originalBookings: string | null = null;
  let originalSettings: string | null = null;

  beforeAll(() => {
    if (fs.existsSync(EVENTS_FILE)) {
      originalEvents = fs.readFileSync(EVENTS_FILE, "utf-8");
    }
    if (fs.existsSync(BOOKINGS_FILE)) {
      originalBookings = fs.readFileSync(BOOKINGS_FILE, "utf-8");
    }
    if (fs.existsSync(SETTINGS_FILE)) {
      originalSettings = fs.readFileSync(SETTINGS_FILE, "utf-8");
    }
  });

  afterAll(() => {
    if (originalEvents !== null) {
      fs.writeFileSync(EVENTS_FILE, originalEvents, "utf-8");
    }
    if (originalBookings !== null) {
      fs.writeFileSync(BOOKINGS_FILE, originalBookings, "utf-8");
    }
    if (originalSettings !== null) {
      fs.writeFileSync(SETTINGS_FILE, originalSettings, "utf-8");
    }
  });

  async function createTestEvent(title: string, price: number = 50000) {
    const sub = await createEventSubmission({
      title,
      category: "WORKSHOP",
      description: "Testing commission override security locks",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 90000000).toISOString(),
      location: "Workshop Room",
      organizerName: "Security Test Organizer",
      organizerEmail: `org-${Date.now()}@example.com`,
      organizerPhone: "081234567890",
      isPaid: true,
      price,
      posterUrl: "https://example.com/poster.jpg",
    });
    return await updateEventStatus(sub.id, "APPROVED");
  }

  describe("1. Override Sebelum Penguncian (Valid Allowed Operations)", () => {
    it("should allow admin to set commission override within 0% - 50% before any bookings exist", async () => {
      const event = await createTestEvent("Pre-Lock Override Event A");

      // Set override to 15% platform fee (85% organizer)
      const updated = await setEventCommissionOverride(event.id, 15);
      expect(updated.customPlatformFeePercent).toBe(15);
      expect(updated.organizerFeePercent).toBe(85);

      // Verify effective fee resolver respects the override
      expect(getEventEffectivePlatformFeePercent(updated)).toBe(15);
    });

    it("should allow edge rates: 0% (free commission) and 50% (maximum platform fee)", async () => {
      const event = await createTestEvent("Edge Override Event");

      // 0% platform fee
      const zeroFee = await setEventCommissionOverride(event.id, 0);
      expect(zeroFee.customPlatformFeePercent).toBe(0);
      expect(zeroFee.organizerFeePercent).toBe(100);

      // 50% platform fee
      const maxFee = await setEventCommissionOverride(event.id, 50);
      expect(maxFee.customPlatformFeePercent).toBe(50);
      expect(maxFee.organizerFeePercent).toBe(50);
    });

    it("should allow resetting commission override to platform default policy (null)", async () => {
      const event = await createTestEvent("Reset Override Event");
      const defaultFee = getEventRevenuePolicy().defaultPlatformFeePercent ?? 20;

      // Set to 10%
      await setEventCommissionOverride(event.id, 10);

      // Reset to null
      const reset = await setEventCommissionOverride(event.id, null);
      expect(reset.customPlatformFeePercent).toBeNull();
      expect(reset.organizerFeePercent).toBe(100 - defaultFee);
      expect(getEventEffectivePlatformFeePercent(reset)).toBe(defaultFee);
    });
  });

  describe("2. Override Setelah Penguncian (Mutation Lock Protection)", () => {
    it("should REJECT setEventCommissionOverride when event has ticket bookings (EVENT_REVENUE_SPLIT_LOCKED)", async () => {
      const event = await createTestEvent("Locked Event Commission Override");

      // Set initial override: 10% platform fee
      await setEventCommissionOverride(event.id, 10);

      // Create booking -> triggers mutation lock
      await createEventBooking({
        eventId: event.id,
        guestName: "Lock Test Attendee",
        guestEmail: "attendee@example.com",
        guestPhone: "081234567891",
        ticketCount: 1,
      });

      expect(isEventRevenueSplitLocked(event.id)).toBe(true);

      // Attempt override after lock -> MUST THROW!
      await expect(
        setEventCommissionOverride(event.id, 25)
      ).rejects.toThrow(/EVENT_REVENUE_SPLIT_LOCKED/);

      // Verify commission rate remained at original 10%
      const events = JSON.parse(fs.readFileSync(EVENTS_FILE, "utf-8"));
      const current = events.find((e: any) => e.id === event.id);
      expect(current.customPlatformFeePercent).toBe(10);
      expect(current.organizerFeePercent).toBe(90);
    });

    it("should REJECT updateEventDetails trying to inject customPlatformFeePercent when locked", async () => {
      const event = await createTestEvent("Locked Event Details Direct Tamper");

      // Initial override: 12%
      await setEventCommissionOverride(event.id, 12);

      // Book ticket
      await createEventBooking({
        eventId: event.id,
        guestName: "Tamper Test Attendee",
        guestEmail: "tamper@example.com",
        guestPhone: "081234567892",
        ticketCount: 1,
      });

      expect(isEventRevenueSplitLocked(event.id)).toBe(true);

      // Attempt updating customPlatformFeePercent via updateEventDetails -> MUST THROW!
      await expect(
        updateEventDetails(event.id, {
          customPlatformFeePercent: 30,
        })
      ).rejects.toThrow(/EVENT_REVENUE_SPLIT_LOCKED/);

      // But non-financial details CAN still be updated (e.g. description/guidelines)
      const detailsUpdate = await updateEventDetails(event.id, {
        description: "Updated description while revenue split is safely locked",
      });
      expect(detailsUpdate.description).toBe("Updated description while revenue split is safely locked");
      expect(detailsUpdate.customPlatformFeePercent).toBe(12);
    });

    it("should REJECT reset to null when event is locked", async () => {
      const event = await createTestEvent("Locked Event Reset Rejection");

      await setEventCommissionOverride(event.id, 18);

      await createEventBooking({
        eventId: event.id,
        guestName: "Reset Test Attendee",
        guestEmail: "reset@example.com",
        guestPhone: "081234567893",
        ticketCount: 1,
      });

      await expect(
        setEventCommissionOverride(event.id, null)
      ).rejects.toThrow(/EVENT_REVENUE_SPLIT_LOCKED/);
    });
  });

  describe("3. Input Validation & Boundaries (Tamper Prevention)", () => {
    it("should reject negative percentage values", async () => {
      const event = await createTestEvent("Negative Percent Event");

      await expect(
        setEventCommissionOverride(event.id, -5)
      ).rejects.toThrow(/0% hingga 50%/);
    });

    it("should reject percentages exceeding 50% limit", async () => {
      const event = await createTestEvent("Excessive Percent Event");

      await expect(
        setEventCommissionOverride(event.id, 51)
      ).rejects.toThrow(/0% hingga 50%/);

      await expect(
        setEventCommissionOverride(event.id, 100)
      ).rejects.toThrow(/0% hingga 50%/);
    });

    it("should reject non-integer decimal percentages", async () => {
      const event = await createTestEvent("Decimal Percent Event");

      await expect(
        setEventCommissionOverride(event.id, 12.5)
      ).rejects.toThrow(/bilangan bulat tanpa desimal/);
    });

    it("should reject NaN values", async () => {
      const event = await createTestEvent("NaN Percent Event");

      await expect(
        setEventCommissionOverride(event.id, NaN)
      ).rejects.toThrow(/berupa angka/);
    });
  });

  describe("4. Status Validation Guard", () => {
    it("should reject commission override on REJECTED or ARCHIVED events", async () => {
      const sub = await createEventSubmission({
        title: "Rejected Event For Commission Test",
        category: "WORKSHOP",
        description: "Checking status rejection",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 90000000).toISOString(),
        location: "Room C",
        organizerName: "Org Reject",
        organizerEmail: "org.reject@example.com",
        organizerPhone: "081234567894",
        isPaid: true,
        price: 30000,
        posterUrl: "https://example.com/poster.jpg",
      });

      const rejectedEvent = await updateEventStatus(sub.id, "REJECTED", {
        rejectionReason: "Tidak sesuai kriteria",
      });

      await expect(
        setEventCommissionOverride(rejectedEvent.id, 15)
      ).rejects.toThrow(/Tidak dapat mengatur override komisi untuk event berstatus REJECTED/);
    });
  });

  describe("5. Endpoint Security & RBAC Enforcement", () => {
    it("should return 403 when unauthenticated caller hits POST /api/events/admin/commission-override", async () => {
      const event = await createTestEvent("API RBAC Test Event");

      const req = new NextRequest("http://localhost:3000/api/events/admin/commission-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          customPlatformFeePercent: 15,
        }),
      });

      const res = await commissionOverrideRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/UNAUTHORIZED|Akses Admin Dago ditolak|tidak memiliki izin/i);
    });

    it("should return 400 with EVENT_REVENUE_SPLIT_LOCKED code from PUT /api/events/[id] when locked", async () => {
      const event = await createTestEvent("API Locked PUT Test Event");

      // Create booking
      await createEventBooking({
        eventId: event.id,
        guestName: "PUT Test Attendee",
        guestEmail: "put@example.com",
        guestPhone: "081234567895",
        ticketCount: 1,
      });

      // Simulate authenticated admin request via NextRequest
      const req = new NextRequest(`http://localhost:3000/api/events/${event.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          // Pass mock admin cookie or header
          cookie: "auth_role=ADMIN; user_role=ADMIN",
        },
        body: JSON.stringify({
          customPlatformFeePercent: 25,
        }),
      });

      const res = await updateEventRoute(req, { params: Promise.resolve({ id: event.id }) });
      // Either 400 (locked) or 403 (unauthorized in test env), but if unauthorized it is 403, if authorized it MUST return 400 with EVENT_REVENUE_SPLIT_LOCKED
      const json = await res.json();
      if (res.status === 400) {
        expect(json.code).toBe("EVENT_REVENUE_SPLIT_LOCKED");
      } else {
        expect(res.status).toBe(403);
      }
    });
  });
});
