import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "fs";
import path from "path";
import {
  calculateEventRevenueSplit,
  validateRevenueSplitPercentage,
  getEventEffectivePlatformFeePercent,
  isEventRevenueSplitLocked,
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  proposeEventRevenueSplit,
  respondToEventRevenueSplit,
  updateEventRevenuePolicy,
  getEventRevenuePolicy,
  loadEventsFromDisk,
  syncNormalizedEventsToDb,
  getPublicEventById,
} from "../src/lib/events";
import * as dataStorage from "../src/lib/data-storage";
import { getDataDirectory, getDataFilePath } from "../src/lib/data-storage";
import { NextRequest } from "next/server";
import {
  POST as postRevenueShareHandler,
  PATCH as patchRevenueShareHandler,
} from "../src/app/api/events/[id]/revenue-share/route";

const DATA_DIR = getDataDirectory();
const EVENTS_FILE = getDataFilePath("events.json");
const BOOKINGS_FILE = getDataFilePath("event_bookings.json");
const SETTINGS_FILE = getDataFilePath("event_settings.json");

describe("Per-Event Revenue Sharing & Mutation Lock", () => {
  let originalEvents: string | null = null;
  let originalBookings: string | null = null;
  let originalSettings: string | null = null;

  beforeAll(() => {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const realDataDir = path.join(process.cwd(), "data");
    for (const f of ["events.json", "event_bookings.json", "event_settings.json"]) {
      const src = path.join(realDataDir, f);
      const dest = path.join(DATA_DIR, f);
      if (!fs.existsSync(dest) && fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }

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

  describe("1. Revenue Split Calculation & Zero-Penny Rounding Integrity", () => {
    it("should ensure platform + organizer share equals gross revenue exactly for odd numbers (Rp 75.005 with 17%)", () => {
      const result = calculateEventRevenueSplit(75005, 17);
      expect(result.grossRevenue).toBe(75005);
      expect(result.platformFeePercent).toBe(17);
      expect(result.organizerSharePercent).toBe(83);

      // 75005 * 0.17 = 12750.85 -> rounded to 12751
      expect(result.platformFeeAmount).toBe(12751);
      // 75005 - 12751 = 62254
      expect(result.organizerRevenueAmount).toBe(62254);
      expect(result.platformFeeAmount + result.organizerRevenueAmount).toBe(75005);
    });

    it("should produce correct split calculations across varied ticket prices and fee percentages", () => {
      // Free ticket
      const free = calculateEventRevenueSplit(0, 20);
      expect(free.platformFeeAmount).toBe(0);
      expect(free.organizerRevenueAmount).toBe(0);
      expect(free.platformFeeAmount + free.organizerRevenueAmount).toBe(0);

      // Even round number
      const standard = calculateEventRevenueSplit(100000, 20);
      expect(standard.platformFeeAmount).toBe(20000);
      expect(standard.organizerRevenueAmount).toBe(80000);
      expect(standard.platformFeeAmount + standard.organizerRevenueAmount).toBe(100000);

      // 0% platform fee
      const zeroFee = calculateEventRevenueSplit(50000, 0);
      expect(zeroFee.platformFeeAmount).toBe(0);
      expect(zeroFee.organizerRevenueAmount).toBe(50000);
      expect(zeroFee.platformFeeAmount + zeroFee.organizerRevenueAmount).toBe(50000);

      // Max 50% platform fee
      const maxFee = calculateEventRevenueSplit(50001, 50);
      expect(maxFee.platformFeeAmount).toBe(25001);
      expect(maxFee.organizerRevenueAmount).toBe(25000);
      expect(maxFee.platformFeeAmount + maxFee.organizerRevenueAmount).toBe(50001);
    });
  });

  describe("2. Validation of Percentage Input (Integer & 0-50% Bound)", () => {
    it("should reject non-integer decimal percentages", () => {
      const res = validateRevenueSplitPercentage(17.5);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/bilangan bulat tanpa desimal/i);
    });

    it("should reject negative percentages", () => {
      const res = validateRevenueSplitPercentage(-5);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/rentang 0% hingga 50%/i);
    });

    it("should reject percentages exceeding 50%", () => {
      const res = validateRevenueSplitPercentage(51);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/rentang 0% hingga 50%/i);
    });

    it("should accept valid integer percentages between 0 and 50", () => {
      expect(validateRevenueSplitPercentage(0).valid).toBe(true);
      expect(validateRevenueSplitPercentage(15).valid).toBe(true);
      expect(validateRevenueSplitPercentage(20).valid).toBe(true);
      expect(validateRevenueSplitPercentage(50).valid).toBe(true);
    });

    it("should reject invalid percentage when proposing split in proposeEventRevenueSplit", async () => {
      const event = await createEventSubmission({
        title: "Event Test Invalid Split",
        category: "COMMUNITY",
        description: "Test description",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 90000000).toISOString(),
        location: "Dago Hub",
        organizerName: "Test Organizer",
        organizerEmail: "valid.split.test@dagoeng.com",
        organizerPhone: "08123456789",
        posterUrl: "https://example.com/poster.jpg",
        isPaid: true,
        price: 50000,
      });

      // Decimal rejection
      await expect(
        proposeEventRevenueSplit(
          event.id,
          "DAGO_ADMIN",
          82.5,
          17.5,
          "Invalid decimal",
          "admin@dagoeng.com",
          true
        )
      ).rejects.toThrow(/bilangan bulat/i);

      // Over 50% platform rejection
      await expect(
        proposeEventRevenueSplit(
          event.id,
          "DAGO_ADMIN",
          40,
          60,
          "Exceeds max platform fee",
          "admin@dagoeng.com",
          true
        )
      ).rejects.toThrow(/antara 0% hingga 50%/i);
    });
  });

  describe("3. Per-Event Split Independence & Booking Calculations", () => {
    it("should calculate booking revenue splits independently for two events with different rates", async () => {
      // Event A: 10% Platform (90% Organizer)
      const eventA = await createEventSubmission({
        title: "Event Independent A (10% Fee)",
        category: "COMMUNITY",
        description: "Event A description",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 90000000).toISOString(),
        location: "Dago Hub Room 1",
        organizerName: "Organizer A",
        organizerEmail: "organizer.a@example.com",
        organizerPhone: "08123456781",
        posterUrl: "https://example.com/posterA.jpg",
        isPaid: true,
        price: 100000,
      });
      await updateEventStatus(eventA.id, "APPROVED");

      // Set custom fee on Event A to 10%
      await proposeEventRevenueSplit(eventA.id, "ORGANIZER", 90, 10, "Special partner rate", "organizer.a@example.com", false);
      await respondToEventRevenueSplit(eventA.id, "ACCEPT", "DAGO_ADMIN", "Admin Dago", undefined, "admin@dagoeng.com", true);

      // Event B: 25% Platform (75% Organizer)
      const eventB = await createEventSubmission({
        title: "Event Independent B (25% Fee)",
        category: "COMMUNITY",
        description: "Event B description",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 90000000).toISOString(),
        location: "Dago Hub Room 2",
        organizerName: "Organizer B",
        organizerEmail: "organizer.b@example.com",
        organizerPhone: "08123456782",
        posterUrl: "https://example.com/posterB.jpg",
        isPaid: true,
        price: 100000,
      });
      await updateEventStatus(eventB.id, "APPROVED");

      // Set custom fee on Event B to 25%
      await proposeEventRevenueSplit(eventB.id, "ORGANIZER", 75, 25, "Venue heavy rate", "organizer.b@example.com", false);
      await respondToEventRevenueSplit(eventB.id, "ACCEPT", "DAGO_ADMIN", "Admin Dago", undefined, "admin@dagoeng.com", true);

      // Book 2 tickets for Event A (Total: Rp 200,000)
      const bookingA = await createEventBooking({
        eventId: eventA.id,
        guestName: "Guest A",
        guestEmail: "guestA@example.com",
        guestPhone: "08123456789",
        ticketCount: 2,
      });

      // Book 2 tickets for Event B (Total: Rp 200,000)
      const bookingB = await createEventBooking({
        eventId: eventB.id,
        guestName: "Guest B",
        guestEmail: "guestB@example.com",
        guestPhone: "08123456789",
        ticketCount: 2,
      });

      // Verify Event A Booking: 10% fee = Rp 20,000, Organizer = Rp 180,000
      expect(bookingA.platformFeePercent).toBe(10);
      expect(bookingA.platformFeeAmount).toBe(20000);
      expect(bookingA.organizerRevenueAmount).toBe(180000);

      // Verify Event B Booking: 25% fee = Rp 50,000, Organizer = Rp 150,000
      expect(bookingB.platformFeePercent).toBe(25);
      expect(bookingB.platformFeeAmount).toBe(50000);
      expect(bookingB.organizerRevenueAmount).toBe(150000);
    });
  });

  describe("4. Mutation Lock (EVENT_REVENUE_SPLIT_LOCKED Guard)", () => {
    let lockedEventId: string;
    const organizerEmail = "locked.event.org@example.com";

    beforeAll(async () => {
      const created = await createEventSubmission({
        title: "Event With Early Booking",
        category: "COMMUNITY",
        description: "Test locking on first booking",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 90000000).toISOString(),
        location: "Main Hall Dago Hub",
        organizerName: "Locked Event Org",
        organizerEmail,
        organizerPhone: "081299887766",
        posterUrl: "https://example.com/poster.jpg",
        isPaid: true,
        price: 50000,
      });
      lockedEventId = created.id;
      await updateEventStatus(lockedEventId, "APPROVED");

      // Before any booking: verification that lock check returns false
      expect(isEventRevenueSplitLocked(lockedEventId)).toBe(false);

      // Create first booking (even in PENDING state)
      await createEventBooking({
        eventId: lockedEventId,
        guestName: "First Attendee",
        guestEmail: "first.attendee@example.com",
        guestPhone: "081999888777",
        ticketCount: 1,
      });

      // After first booking: verification that lock check returns true
      expect(isEventRevenueSplitLocked(lockedEventId)).toBe(true);
    });

    it("should REJECT proposal creation with EVENT_REVENUE_SPLIT_LOCKED once a booking exists", async () => {
      await expect(
        proposeEventRevenueSplit(
          lockedEventId,
          "ORGANIZER",
          85,
          15,
          "Attempt modification after ticket sold",
          organizerEmail,
          false
        )
      ).rejects.toThrow(/EVENT_REVENUE_SPLIT_LOCKED/i);
    });

    it("should REJECT proposal response with EVENT_REVENUE_SPLIT_LOCKED once a booking exists", async () => {
      await expect(
        respondToEventRevenueSplit(
          lockedEventId,
          "ACCEPT",
          "DAGO_ADMIN",
          "Admin Dago",
          undefined,
          "admin@dagoeng.com",
          true
        )
      ).rejects.toThrow(/EVENT_REVENUE_SPLIT_LOCKED/i);
    });

    it("API route should return 400 with code EVENT_REVENUE_SPLIT_LOCKED", async () => {
      const req = new NextRequest(`http://localhost:3000/api/events/${lockedEventId}/revenue-share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: "dagoeng_active_persona=DAGO_OWNER",
        },
        body: JSON.stringify({
          proposedBy: "DAGO_ADMIN",
          organizerPercent: 85,
          platformPercent: 15,
          reason: "Testing API lock response",
        }),
      });

      const res = await postRevenueShareHandler(req, { params: Promise.resolve({ id: lockedEventId }) });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe("EVENT_REVENUE_SPLIT_LOCKED");
    });
  });

  describe("5. Historical Immutability & Global Policy Isolation", () => {
    it("should NOT alter existing ticket snapshots when global policy is updated", async () => {
      const evt = await createEventSubmission({
        title: "Historical Immutability Event",
        category: "COMMUNITY",
        description: "Checking ticket immutability",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 90000000).toISOString(),
        location: "Tech Lab",
        organizerName: "Immutability Org",
        organizerEmail: "immutability.org@example.com",
        organizerPhone: "08123456789",
        posterUrl: "https://example.com/poster.jpg",
        isPaid: true,
        price: 50000,
      });
      await updateEventStatus(evt.id, "APPROVED");

      // Book ticket when default policy is 20%
      const booking = await createEventBooking({
        eventId: evt.id,
        guestName: "Historical Guest",
        guestEmail: "hist.guest@example.com",
        guestPhone: "08123456789",
        ticketCount: 2, // Total: 100,000
      });

      expect(booking.platformFeePercent).toBe(20);
      expect(booking.platformFeeAmount).toBe(20000);
      expect(booking.organizerRevenueAmount).toBe(80000);

      // Now change global policy to 30%
      updateEventRevenuePolicy({ defaultPlatformFeePercent: 30 });
      expect(getEventRevenuePolicy().defaultPlatformFeePercent).toBe(30);

      // Re-read bookings from disk: historical booking must retain its original 20% snapshot!
      const rawBookings = JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf-8"));
      const savedBooking = rawBookings.find((b: any) => b.id === booking.id);
      expect(savedBooking.platformFeePercent).toBe(20);
      expect(savedBooking.platformFeeAmount).toBe(20000);
      expect(savedBooking.organizerRevenueAmount).toBe(80000);

      // Restore global policy
      updateEventRevenuePolicy({ defaultPlatformFeePercent: 20 });
    });

    it("should properly lazy-normalize legacy events without explicit customPlatformFeePercent", () => {
      const allEvents = loadEventsFromDisk();
      allEvents.forEach((e) => {
        expect(e.customPlatformFeePercent).toBeDefined();
        expect(typeof e.customPlatformFeePercent).toBe("number");
        expect(e.customPlatformFeePercent).toBeGreaterThanOrEqual(0);
        expect(e.customPlatformFeePercent).toBeLessThanOrEqual(50);
        expect(e.organizerFeePercent).toBe(100 - (e.customPlatformFeePercent ?? 20));
      });
    });

    it("should NOT alter existing ticket snapshots on event A when event B is created and negotiated with a different split", async () => {
      // 1. Create Event A with 20% platform fee
      const subA = await createEventSubmission({
        title: "Event A Snapshot Integrity",
        category: "COMMUNITY",
        description: "Checking isolation between different event splits",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 90000000).toISOString(),
        location: "Hall A",
        organizerName: "Snapshot Org A",
        organizerEmail: "org.a.snapshot@example.com",
        organizerPhone: "08123456781",
        posterUrl: "https://example.com/poster.jpg",
        isPaid: true,
        price: 100000,
        proposedOrganizerPercent: 80,
        proposedPlatformPercent: 20,
      });
      const eventA = await updateEventStatus(subA.id, "APPROVED");

      // 2. Book ticket on Event A
      const bookingA = await createEventBooking({
        eventId: eventA.id,
        guestName: "Guest on Event A",
        guestEmail: "guest.a@example.com",
        guestPhone: "08123456782",
        ticketCount: 1,
      });
      expect(bookingA.platformFeePercent).toBe(20);
      expect(bookingA.platformFeeAmount).toBe(20000);
      expect(bookingA.organizerRevenueAmount).toBe(80000);

      // 3. Create Event B with a completely different 10% platform fee (90% organizer)
      const subB = await createEventSubmission({
        title: "Event B Different Split",
        category: "COMMUNITY",
        description: "Event with different split",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 90000000).toISOString(),
        location: "Hall B",
        organizerName: "Snapshot Org B",
        organizerEmail: "org.b.snapshot@example.com",
        organizerPhone: "08123456783",
        posterUrl: "https://example.com/poster.jpg",
        isPaid: true,
        price: 100000,
        proposedOrganizerPercent: 90,
        proposedPlatformPercent: 10,
      });
      const eventB = await updateEventStatus(subB.id, "APPROVED");

      // Admin accepts the 90/10 proposal, establishing event B's 10% rate
      await respondToEventRevenueSplit(
        eventB.id,
        "ACCEPT",
        "DAGO_ADMIN",
        "Admin Dago",
        undefined,
        "admin@dagoeng.com",
        true
      );

      // 4. Book ticket on Event B
      const bookingB = await createEventBooking({
        eventId: eventB.id,
        guestName: "Guest on Event B",
        guestEmail: "guest.b@example.com",
        guestPhone: "08123456784",
        ticketCount: 1,
      });
      expect(bookingB.platformFeePercent).toBe(10);
      expect(bookingB.platformFeeAmount).toBe(10000);
      expect(bookingB.organizerRevenueAmount).toBe(90000);

      // 5. Verify Event A's booking snapshot in persistent disk storage is completely unchanged!
      const diskBookings = JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf-8"));
      const verifiedBookingA = diskBookings.find((b: any) => b.id === bookingA.id);
      expect(verifiedBookingA.platformFeePercent).toBe(20);
      expect(verifiedBookingA.platformFeeAmount).toBe(20000);
      expect(verifiedBookingA.organizerRevenueAmount).toBe(80000);
    });

    it("should persist normalized legacy events to database when filesystem is read-only (Vercel simulation), retaining values across cold starts and global policy updates", async () => {
      // 1. Ensure baseline global policy is 20%
      updateEventRevenuePolicy({ defaultPlatformFeePercent: 20 });

      // 2. Prepare a legacy event in storage without customPlatformFeePercent or organizerFeePercent
      const legacyId = `legacy-ro-test-${Date.now()}`;
      const currentRaw = JSON.parse(fs.readFileSync(EVENTS_FILE, "utf-8"));
      const legacyEvent = {
        id: legacyId,
        title: "Legacy Event On Read-Only Filesystem",
        category: "COMMUNITY",
        description: "Simulating Vercel read-only container with legacy event",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 90000000).toISOString(),
        location: "Amphitheater",
        price: 50000,
        isPaid: true,
        status: "APPROVED",
        organizerName: "Legacy Community RO",
        organizerEmail: "legacy.ro@example.com",
        organizerPhone: "08123456789",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // Write unnormalized event to disk first while filesystem is normal
      fs.writeFileSync(EVENTS_FILE, JSON.stringify([...currentRaw, legacyEvent], null, 2), "utf-8");

      // 3. Spy on persistStorageToDb to capture database persistence
      let persistedPayloadToDb: string | null = null;
      const persistSpy = vi.spyOn(dataStorage, "persistStorageToDb").mockImplementation(async (filename: string, content: string) => {
        if (filename === "events.json") {
          persistedPayloadToDb = content;
        }
        return true;
      });

      // 4. Simulate Vercel read-only filesystem: fs.writeFileSync throws EROFS when writing events.json
      const originalWriteFileSync = fs.writeFileSync;
      const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation((targetPath: any, data: any, options: any) => {
        if (typeof targetPath === "string" && targetPath.includes("events.json")) {
          throw new Error("EROFS: read-only file system, open '/var/task/data/events.json'");
        }
        return originalWriteFileSync(targetPath, data, options);
      });

      try {
        // 5. Trigger loadEventsFromDisk: disk write fails (EROFS), but in-memory normalization flags pending DB persist
        const events = loadEventsFromDisk();
        const found = events.find((e) => e.id === legacyId);
        expect(found?.customPlatformFeePercent).toBe(20);
        expect(found?.organizerFeePercent).toBe(80);

        // 6. Execute async DB sync (awaited in all async entry points)
        await syncNormalizedEventsToDb();

        // 7. Verify that database persistence succeeded despite read-only filesystem!
        expect(persistedPayloadToDb).not.toBeNull();
        const parsedDbPayload = JSON.parse(persistedPayloadToDb!);
        const dbLegacy = parsedDbPayload.find((e: any) => e.id === legacyId);
        expect(dbLegacy).toBeDefined();
        expect(dbLegacy.customPlatformFeePercent).toBe(20);
        expect(dbLegacy.organizerFeePercent).toBe(80);

        // 8. Update global policy to 35%
        updateEventRevenuePolicy({ defaultPlatformFeePercent: 35 });
        expect(getEventRevenuePolicy().defaultPlatformFeePercent).toBe(35);

        // 9. Simulate cold start with database sync: mock db.systemSetting.findUnique returning the persisted DB snapshot
        const { db } = await import("@/lib/db");
        const findUniqueSpy = vi.spyOn(db.systemSetting, "findUnique").mockResolvedValue({
          id: "setting-events",
          key: "STORAGE_events.json",
          value: persistedPayloadToDb!,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);

        // Verify the legacy event in the synced DB snapshot still has 20%, NOT 35%!
        expect(dbLegacy.customPlatformFeePercent).toBe(20);
        expect(dbLegacy.organizerFeePercent).toBe(80);

        findUniqueSpy.mockRestore();
      } finally {
        writeSpy.mockRestore();
        persistSpy.mockRestore();
        // Cleanup test event from disk
        const cleaned = JSON.parse(fs.readFileSync(EVENTS_FILE, "utf-8")).filter((e: any) => e.id !== legacyId);
        fs.writeFileSync(EVENTS_FILE, JSON.stringify(cleaned, null, 2), "utf-8");
        updateEventRevenuePolicy({ defaultPlatformFeePercent: 20 });
      }
    });

    it("should recover newer cloud events and normalize legacy events on Vercel cold start without overwriting database with local seed", async () => {
      // 1. Prepare database payload containing:
      //    (a) a legacy event without explicit split fields
      //    (b) a brand-new cloud event that does NOT exist in local seed or disk
      const legacyCloudId = `legacy-cloud-${Date.now()}`;
      const freshCloudId = `fresh-cloud-${Date.now()}`;

      const dbEvents = [
        {
          id: legacyCloudId,
          title: "Legacy Cloud Event Without Split",
          category: "COMMUNITY",
          description: "Legacy event stored in PostgreSQL prior to feature release",
          startDate: new Date(Date.now() + 86400000).toISOString(),
          endDate: new Date(Date.now() + 90000000).toISOString(),
          location: "Main Auditorium",
          price: 50000,
          isPaid: true,
          status: "APPROVED",
          organizerName: "Cloud Community",
          organizerEmail: "cloud.legacy@example.com",
          organizerPhone: "08123456789",
          posterUrl: "https://example.com/poster1.jpg",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Notice: customPlatformFeePercent and organizerFeePercent are omitted (legacy)
        },
        {
          id: freshCloudId,
          title: "Fresh Cloud Event Never In Local Seed",
          category: "COMMUNITY",
          description: "Newly created event in PostgreSQL absent from fresh container disk",
          startDate: new Date(Date.now() + 172800000).toISOString(),
          endDate: new Date(Date.now() + 180000000).toISOString(),
          location: "Amphitheater",
          price: 75000,
          isPaid: true,
          status: "APPROVED",
          organizerName: "Cloud Community",
          organizerEmail: "cloud.fresh@example.com",
          organizerPhone: "08123456789",
          posterUrl: "https://example.com/poster2.jpg",
          customPlatformFeePercent: 15,
          organizerFeePercent: 85,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      const dbPayload = JSON.stringify(dbEvents);

      // 2. Simulate Vercel cold start container:
      //    Write initial seed to local disk that DOES NOT contain freshCloudId
      fs.writeFileSync(EVENTS_FILE, JSON.stringify([
        {
          id: "old-local-seed-event",
          title: "Old Seed Event",
          category: "COMMUNITY",
          description: "Seed event in fresh deployment image",
          startDate: new Date(Date.now() + 86400000).toISOString(),
          endDate: new Date(Date.now() + 90000000).toISOString(),
          location: "Dago Room",
          price: 0,
          isPaid: false,
          status: "APPROVED",
          organizerName: "Seed Community",
          organizerEmail: "seed@example.com",
          organizerPhone: "08123456789",
          posterUrl: "https://example.com/seed.jpg",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ], null, 2), "utf-8");

      // Verify that before sync, freshCloudId is completely absent from local disk
      const diskBeforeSync = JSON.parse(fs.readFileSync(EVENTS_FILE, "utf-8"));
      expect(diskBeforeSync.some((e: any) => e.id === freshCloudId)).toBe(false);

      // 3. Mock PostgreSQL SystemSetting query returning latest database snapshot
      const { db } = await import("@/lib/db");
      const findUniqueSpy = vi.spyOn(db.systemSetting, "findUnique").mockResolvedValue({
        id: "setting-events",
        key: "STORAGE_events.json",
        value: dbPayload,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      let persistedBackToDb: string | null = null;
      const persistSpy = vi.spyOn(dataStorage, "persistStorageToDb").mockImplementation(async (filename: string, content: string) => {
        if (filename === "events.json") {
          persistedBackToDb = content;
        }
        return true;
      });

      // 4. Configure production environment flags to activate database synchronization
      const prevEnv = process.env.NODE_ENV;
      const prevDbUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = "postgresql://user:pass@ep-host.neon.tech/dagoeng";
      process.env.NODE_ENV = "production";

      try {
        // 5. Invoke public event getter (which triggers syncStorageFromDb -> loadEventsFromDisk -> syncNormalizedEventsToDb)
        const fetchedEvent = await getPublicEventById(freshCloudId);

        // Verification A: The newer database event was NOT lost or overwritten by local seed!
        expect(fetchedEvent).not.toBeNull();
        expect(fetchedEvent?.id).toBe(freshCloudId);
        expect(fetchedEvent?.title).toBe("Fresh Cloud Event Never In Local Seed");

        // Verification B: Local replica disk was safely updated with database contents
        const diskAfterSync = JSON.parse(fs.readFileSync(EVENTS_FILE, "utf-8"));
        expect(diskAfterSync.some((e: any) => e.id === freshCloudId)).toBe(true);

        // Verification C: Legacy event in database was properly normalized
        const normalizedLegacyInDisk = diskAfterSync.find((e: any) => e.id === legacyCloudId);
        expect(normalizedLegacyInDisk).toBeDefined();
        expect(normalizedLegacyInDisk.customPlatformFeePercent).toBe(20);
        expect(normalizedLegacyInDisk.organizerFeePercent).toBe(80);

        // Verification D: The normalized data persisted back to database contains BOTH events intact
        if (persistedBackToDb) {
          const parsedPersisted = JSON.parse(persistedBackToDb);
          expect(parsedPersisted.some((e: any) => e.id === freshCloudId)).toBe(true);
          const persistedLegacy = parsedPersisted.find((e: any) => e.id === legacyCloudId);
          expect(persistedLegacy.customPlatformFeePercent).toBe(20);
        }
      } finally {
        findUniqueSpy.mockRestore();
        persistSpy.mockRestore();
        process.env.NODE_ENV = prevEnv;
        if (prevDbUrl) process.env.DATABASE_URL = prevDbUrl;
        else delete process.env.DATABASE_URL;

        // Restore test events file
        if (originalEvents) {
          fs.writeFileSync(EVENTS_FILE, originalEvents, "utf-8");
        }
      }
    });
  });

  describe("6. Authorization & Tenant Isolation", () => {
    it("should REJECT when an organizer attempts to ACCEPT/finalize the revenue split (admin only)", async () => {
      const evt = await createEventSubmission({
        title: "Organizer Cannot Finalize Split Event",
        category: "COMMUNITY",
        description: "Checking admin finalization rule",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 90000000).toISOString(),
        location: "Amphitheater",
        organizerName: "Finalize Test Org",
        organizerEmail: "final.org@example.com",
        organizerPhone: "08123456789",
        posterUrl: "https://example.com/poster.jpg",
        isPaid: true,
        price: 50000,
      });

      // Organizer proposes a split
      await proposeEventRevenueSplit(
        evt.id,
        "ORGANIZER",
        85,
        15,
        "Organizer proposal",
        "final.org@example.com",
        false
      );

      // Organizer attempts to ACCEPT their own/organizer proposal: must be rejected (admin only)
      await expect(
        respondToEventRevenueSplit(
          evt.id,
          "ACCEPT",
          "ORGANIZER",
          "Finalize Test Org",
          undefined,
          "final.org@example.com",
          false // isAdmin: false
        )
      ).rejects.toThrow();
    });

    it("should REJECT when Organizer A attempts to modify or propose split for Organizer B's event (Cross-Tenant Isolation)", async () => {
      const evtB = await createEventSubmission({
        title: "Organizer B Event",
        category: "COMMUNITY",
        description: "Checking cross-tenant protection",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 90000000).toISOString(),
        location: "Tech Lab",
        organizerName: "Organizer B",
        organizerEmail: "organizer.b.tenant@example.com",
        organizerPhone: "08123456789",
        posterUrl: "https://example.com/poster.jpg",
        isPaid: true,
        price: 50000,
      });

      // Organizer A attempts to propose split on Organizer B's event
      await expect(
        proposeEventRevenueSplit(
          evtB.id,
          "ORGANIZER",
          85,
          15,
          "Spoofed proposal",
          "organizer.a.tenant@example.com", // Differs from evtB.organizerEmail
          false
        )
      ).rejects.toThrow(/Pelanggaran isolasi data|tidak memiliki izin/i);
    });
  });
});

