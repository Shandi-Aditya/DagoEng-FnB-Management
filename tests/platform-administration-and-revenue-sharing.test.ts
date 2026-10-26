import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  getAllOrganizers,
  createOrganizer,
  updateOrganizerStatus,
  updateOrganizerDetails,
  isOrganizerActive,
  CommunityOrganizerProfile,
} from "@/lib/organizers";
import {
  getEventRevenuePolicy,
  updateEventRevenuePolicy,
  createEventBooking,
  setEventCommissionOverride,
  getAdminEvents,
  createEventSubmission,
  updateEventStatus,
} from "@/lib/events";
import { assertOrganizerAuth, assertEventAdmin } from "@/lib/server-auth";
import { NextRequest } from "next/server";
import { getTenantRevenueSplit, setTenantRevenueSplit } from "@/lib/settlement";

const DATA_DIR = process.env.DATA_DIR_OVERRIDE || path.join(process.cwd(), "data");
const ORGANIZERS_FILE = path.join(DATA_DIR, "organizers.json");
const EVENT_SETTINGS_FILE = path.join(DATA_DIR, "event_settings.json");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const BOOKINGS_FILE = path.join(DATA_DIR, "event_bookings.json");

describe("Platform Administration & Event Marketplace Revenue Sharing", () => {
  let originalOrganizersBackup: string | null = null;
  let originalSettingsBackup: string | null = null;
  let originalEventsBackup: string | null = null;
  let originalBookingsBackup: string | null = null;

  beforeEach(() => {
    if (fs.existsSync(ORGANIZERS_FILE)) {
      originalOrganizersBackup = fs.readFileSync(ORGANIZERS_FILE, "utf-8");
    }
    if (fs.existsSync(EVENT_SETTINGS_FILE)) {
      originalSettingsBackup = fs.readFileSync(EVENT_SETTINGS_FILE, "utf-8");
    }
    if (fs.existsSync(EVENTS_FILE)) {
      originalEventsBackup = fs.readFileSync(EVENTS_FILE, "utf-8");
    }
    if (fs.existsSync(BOOKINGS_FILE)) {
      originalBookingsBackup = fs.readFileSync(BOOKINGS_FILE, "utf-8");
    }
  });

  afterEach(() => {
    if (originalOrganizersBackup !== null) {
      fs.writeFileSync(ORGANIZERS_FILE, originalOrganizersBackup, "utf-8");
    }
    if (originalSettingsBackup !== null) {
      fs.writeFileSync(EVENT_SETTINGS_FILE, originalSettingsBackup, "utf-8");
    }
    if (originalEventsBackup !== null) {
      fs.writeFileSync(EVENTS_FILE, originalEventsBackup, "utf-8");
    }
    if (originalBookingsBackup !== null) {
      fs.writeFileSync(BOOKINGS_FILE, originalBookingsBackup, "utf-8");
    }
  });

  // ---------------------------------------------------------------------------
  // 1. ACCOUNT MANAGEMENT: ORGANIZERS & PARTNERS
  // ---------------------------------------------------------------------------
  describe("1. Community Organizer Account Management", () => {
    it("should list initial seed community organizers", () => {
      const list = getAllOrganizers();
      expect(list.length).toBeGreaterThanOrEqual(4);
      const barista = list.find((o) => o.email === "baristaguild@dagocreative.id");
      expect(barista).toBeDefined();
      expect(barista?.name).toContain("Dago");
      expect(barista?.status).toBe("ACTIVE");
      expect(barista?.serviceModule).toBe("CO_WORKING");
      expect(barista?.scopeLevel).toBe("TENANT");
    });

    it("should successfully register a new community organizer", () => {
      const testEmail = `neworg_${Date.now()}@dagocreative.id`;
      const created = createOrganizer({
        name: "Bandung Creative Hackers",
        category: "Komunitas Teknologi & AI",
        contactPerson: "Dimas Anggara",
        phone: "+62 812-9988-1122",
        email: testEmail,
        notes: "Mitra hackathon dan tech workshop.",
        initialStatus: "ACTIVE",
      });

      expect(created.id).toBeDefined();
      expect(created.email).toBe(testEmail);
      expect(created.status).toBe("ACTIVE");
      expect(created.roleName).toBe("Penyelenggara Event");

      // Verify persistence
      const fetched = getAllOrganizers().find((o) => o.email === testEmail);
      expect(fetched).toBeDefined();
      expect(fetched?.name).toBe("Bandung Creative Hackers");
    });

    it("should reject registering duplicate organizer email", () => {
      const testEmail = `dup_${Date.now()}@dagocreative.id`;
      createOrganizer({
        name: "First Community",
        category: "Seni",
        contactPerson: "Person A",
        phone: "+62 812-1111-2222",
        email: testEmail,
      });

      expect(() => {
        createOrganizer({
          name: "Second Community",
          category: "Seni",
          contactPerson: "Person B",
          phone: "+62 812-3333-4444",
          email: testEmail,
        });
      }).toThrow(/sudah terdaftar/);
    });

    it("should toggle organizer status between ACTIVE and INACTIVE", () => {
      const testEmail = `toggle_${Date.now()}@dagocreative.id`;
      const created = createOrganizer({
        name: "Toggle Community",
        category: "Musik",
        contactPerson: "Person T",
        phone: "+62 812-5555-6666",
        email: testEmail,
        initialStatus: "ACTIVE",
      });

      expect(isOrganizerActive(testEmail)).toBe(true);

      // Deactivate
      const deactivated = updateOrganizerStatus(created.id, "INACTIVE");
      expect(deactivated.status).toBe("INACTIVE");
      expect(isOrganizerActive(testEmail)).toBe(false);

      // Reactivate
      const reactivated = updateOrganizerStatus(created.id, "ACTIVE");
      expect(reactivated.status).toBe("ACTIVE");
      expect(isOrganizerActive(testEmail)).toBe(true);
    });

    it("should update organizer contact and detail information", () => {
      const testEmail = `update_${Date.now()}@dagocreative.id`;
      const created = createOrganizer({
        name: "Original Name",
        category: "Seni",
        contactPerson: "Old PIC",
        phone: "+62 811-0000-1111",
        email: testEmail,
      });

      const updated = updateOrganizerDetails(created.id, {
        name: "Updated Community Name",
        contactPerson: "New PIC",
        phone: "+62 811-9999-8888",
        notes: "Kerjasama diperpanjang 2027",
      });

      expect(updated.name).toBe("Updated Community Name");
      expect(updated.contactPerson).toBe("New PIC");
      expect(updated.phone).toBe("+62 811-9999-8888");
      expect(updated.notes).toBe("Kerjasama diperpanjang 2027");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. RBAC & DATA ISOLATION ENFORCEMENT
  // ---------------------------------------------------------------------------
  describe("2. RBAC & Deactivated Account Enforcement", () => {
    it("should allow active organizer to access their portal data", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/portal", {
        headers: {
          cookie: "dagoeng_active_persona=COMMUNITY_BARISTA",
        },
      });

      const auth = await assertOrganizerAuth(req, "baristaguild@dagocreative.id");
      expect(auth.authorized).toBe(true);
      expect(auth.email).toBe("baristaguild@dagocreative.id");
      expect(auth.isAdmin).toBe(false);
    });

    it("should strictly reject deactivated organizer account", async () => {
      const list = getAllOrganizers();
      const barista = list.find((o) => o.email === "baristaguild@dagocreative.id");
      expect(barista).toBeDefined();

      // Deactivate Barista Guild
      updateOrganizerStatus(barista!.id, "INACTIVE");

      const req = new NextRequest("http://localhost:3000/api/events/portal", {
        headers: {
          cookie: "dagoeng_active_persona=COMMUNITY_BARISTA",
        },
      });

      const auth = await assertOrganizerAuth(req, "baristaguild@dagocreative.id");
      expect(auth.authorized).toBe(false);
      expect(auth.error).toContain("dinonaktifkan oleh Administrator Platform");

      // Restore
      updateOrganizerStatus(barista!.id, "ACTIVE");
    });

    it("should reject cross-community access attempt", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/portal", {
        headers: {
          cookie: "dagoeng_active_persona=COMMUNITY_BARISTA",
        },
      });

      // Barista tries to access BandungDev data
      const auth = await assertOrganizerAuth(req, "halo@bandungdev.org");
      expect(auth.authorized).toBe(false);
      expect(auth.error).toContain("Pelanggaran isolasi data");
    });

    it("should allow Hub Admin oversight access to any community data", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/portal", {
        headers: {
          cookie: "dagoeng_active_persona=DAGO_OWNER",
        },
      });

      const auth = await assertOrganizerAuth(req, "baristaguild@dagocreative.id");
      expect(auth.authorized).toBe(true);
      expect(auth.isAdmin).toBe(true);
    });

    it("should reject regular organizers or tenant owners from accessing event admin settings", async () => {
      // 1. Organizer
      const orgReq = new NextRequest("http://localhost:3000/api/events/admin/settings", {
        headers: {
          cookie: "dagoeng_active_persona=COMMUNITY_BARISTA",
        },
      });
      const orgAuth = await assertEventAdmin(orgReq);
      expect(orgAuth.authorized).toBe(false);
      expect(orgAuth.error).toContain("FORBIDDEN");

      // 2. F&B Tenant Owner (Kopi Senja)
      const tenantReq = new NextRequest("http://localhost:3000/api/events/admin/settings", {
        headers: {
          cookie: "dagoeng_active_persona=TENANT_OWNER_KS",
        },
      });
      const tenantAuth = await assertEventAdmin(tenantReq);
      expect(tenantAuth.authorized).toBe(false);
      expect(tenantAuth.error).toContain("cakupan [TENANT] tidak berhak memoderasi event");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. EVENT MARKETPLACE REVENUE SHARING POLICY & OVERRIDES
  // ---------------------------------------------------------------------------
  describe("3. Revenue Sharing Configuration & Immutability", () => {
    it("should have 20% Platform / 80% Organizer as initial default policy", () => {
      const policy = getEventRevenuePolicy();
      expect(policy.defaultPlatformFeePercent).toBe(20);
      expect(policy.defaultOrganizerSharePercent).toBe(80);
      expect(policy.defaultPlatformFeePercent + policy.defaultOrganizerSharePercent).toBe(100);
    });

    it("should update platform default commission fee and record history log", () => {
      const updated = updateEventRevenuePolicy(
        {
          defaultPlatformFeePercent: 25,
          policyNotes: "Penyesuaian komisi platform Q4 2026",
          effectiveDate: "2026-11-01T00:00:00.000Z",
        },
        "Hendra Wijaya (Owner Dago)"
      );

      expect(updated.defaultPlatformFeePercent).toBe(25);
      expect(updated.defaultOrganizerSharePercent).toBe(75);
      expect(updated.history?.length).toBeGreaterThanOrEqual(2);
      expect(updated.history?.[0].newPlatformFeePercent).toBe(25);
      expect(updated.history?.[0].changedBy).toBe("Hendra Wijaya (Owner Dago)");

      // Re-fetch from disk
      const fetched = getEventRevenuePolicy();
      expect(fetched.defaultPlatformFeePercent).toBe(25);
      expect(fetched.defaultOrganizerSharePercent).toBe(75);
    });

    it("should reject invalid platform fee percentages", () => {
      expect(() => {
        updateEventRevenuePolicy({ defaultPlatformFeePercent: -5 });
      }).toThrow(/antara 0% hingga 100%/);

      expect(() => {
        updateEventRevenuePolicy({ defaultPlatformFeePercent: 120 });
      }).toThrow(/antara 0% hingga 100%/);
    });

    async function getOrCreateValidPaidEventFixture() {
      const timestamp = Date.now();
      const submission = await createEventSubmission({
        organizerName: "Dago Specialty Coffee Society",
        organizerEmail: `revenue_fixture_${timestamp}@dagocreative.id`,
        organizerPhone: "+62 812-9876-5432",
        title: `Latte Art Sensory Workshop Fixture ${timestamp}`,
        category: "WORKSHOP",
        description: "Workshop kalibrasi rasa dan kompetisi persahabatan latte art.",
        startDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
        endDate: new Date(Date.now() + 3 * 24 * 3600 * 1000 + 4 * 3600 * 1000).toISOString(),
        location: "Amphitheater Dago Creative Hub",
        maxCapacity: 80,
        isPaid: true,
        price: 35000,
        posterUrl: "https://images.unsplash.com/photo-1511920170033-f8396924c348",
      });
      return await updateEventStatus(submission.id, "APPROVED");
    }

    it("should calculate ticket booking with custom per-event override", async () => {
      const paidEvent = await getOrCreateValidPaidEventFixture();
      expect(paidEvent).toBeDefined();

      // Set custom override 10%
      await setEventCommissionOverride(paidEvent.id, 10);

      const booking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Doni Pratama",
        guestEmail: `doni_${Date.now()}@gmail.com`,
        guestPhone: "+62 812-4455-6677",
        ticketCount: 1,
        paymentMethod: "QRIS",
      });

      expect(booking.platformFeePercent).toBe(10);
      const expectedPlatformFee = Math.round((booking.totalPrice * 10) / 100);
      expect(booking.platformFeeAmount).toBe(expectedPlatformFee);
      expect(booking.organizerRevenueAmount).toBe(booking.totalPrice - expectedPlatformFee);

      // Clean up override: reset to null (default)
      await setEventCommissionOverride(paidEvent.id, null);
    });

    it("should fallback to platform default commission when event override is null", async () => {
      const paidEvent = await getOrCreateValidPaidEventFixture();
      expect(paidEvent).toBeDefined();

      // Ensure no override
      await setEventCommissionOverride(paidEvent.id, null);

      // Set policy to 20%
      updateEventRevenuePolicy({ defaultPlatformFeePercent: 20 });

      const booking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Rani Widuri",
        guestEmail: `rani_${Date.now()}@gmail.com`,
        guestPhone: "+62 813-7788-9900",
        ticketCount: 2,
        paymentMethod: "QRIS",
      });

      expect(booking.platformFeePercent).toBe(20);
      const expectedFee = Math.round((booking.totalPrice * 20) / 100);
      expect(booking.platformFeeAmount).toBe(expectedFee);
      expect(booking.organizerRevenueAmount).toBe(booking.totalPrice - expectedFee);
    });

    it("should not affect F&B revenue sharing calculations", () => {
      // Event marketplace policy changes must NEVER alter F&B tenant splits
      const ksSplit = getTenantRevenueSplit("tenant-ks");
      expect(ksSplit.tenantSharePercent).toBe(85);
      expect(ksSplit.dagoSharePercent).toBe(15);
      expect(ksSplit.tenantSharePercent + ksSplit.dagoSharePercent).toBe(100);
    });
  });
});
