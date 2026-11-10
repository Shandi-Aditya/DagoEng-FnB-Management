import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "fs";
import path from "path";
import {
  getMissingPayoutFields,
  maskAccountNumber,
} from "../src/lib/payout";
import {
  ensureOrganizerActive,
  updateOrganizerBankDetails,
  INITIAL_ORGANIZERS,
  getAllOrganizers,
  clearOrganizersCache,
  getOrganizerByEmail,
} from "../src/lib/organizers";
import {
  getOrganizerServerBankAccount,
  requestOrganizerPayout,
  processOrganizerPayout,
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  updateBookingPaymentStatus,
} from "../src/lib/events";
import { getDataDirectory, getDataFilePath, syncStorageFromDb } from "../src/lib/data-storage";
import { NextRequest } from "next/server";
import { POST as postPayoutHandler, PATCH as patchPayoutHandler } from "../src/app/api/events/[id]/payout/route";
import { POST as postBankSettingsHandler } from "../src/app/api/events/admin/settings/banks/route";

const DATA_DIR = getDataDirectory();
const EVENTS_FILE = getDataFilePath("events.json");
const ORGANIZERS_FILE = getDataFilePath("organizers.json");
const SETTINGS_FILE = getDataFilePath("event_settings.json");
const BOOKINGS_FILE = getDataFilePath("event_bookings.json");

describe("Payout Bank Guard & Empty Bank for New Organizers", () => {
  let originalEvents: string | null = null;
  let originalOrganizers: string | null = null;
  let originalSettings: string | null = null;
  let originalBookings: string | null = null;

  beforeAll(() => {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const realDataDir = path.join(process.cwd(), "data");
    for (const f of ["events.json", "organizers.json", "event_settings.json", "event_bookings.json"]) {
      const src = path.join(realDataDir, f);
      const dest = path.join(DATA_DIR, f);
      if (!fs.existsSync(dest) && fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }

    if (fs.existsSync(EVENTS_FILE)) {
      originalEvents = fs.readFileSync(EVENTS_FILE, "utf-8");
    }
    if (fs.existsSync(ORGANIZERS_FILE)) {
      originalOrganizers = fs.readFileSync(ORGANIZERS_FILE, "utf-8");
    }
    if (fs.existsSync(SETTINGS_FILE)) {
      originalSettings = fs.readFileSync(SETTINGS_FILE, "utf-8");
    }
    if (fs.existsSync(BOOKINGS_FILE)) {
      originalBookings = fs.readFileSync(BOOKINGS_FILE, "utf-8");
    }
  });

  afterAll(() => {
    if (originalEvents !== null) {
      fs.writeFileSync(EVENTS_FILE, originalEvents, "utf-8");
    }
    if (originalOrganizers !== null) {
      fs.writeFileSync(ORGANIZERS_FILE, originalOrganizers, "utf-8");
    }
    if (originalSettings !== null) {
      fs.writeFileSync(SETTINGS_FILE, originalSettings, "utf-8");
    }
    if (originalBookings !== null) {
      fs.writeFileSync(BOOKINGS_FILE, originalBookings, "utf-8");
    }
  });

  describe("1. Helper getMissingPayoutFields & maskAccountNumber", () => {
    it("should report all fields missing when organizer object is null/undefined", () => {
      const res = getMissingPayoutFields(null);
      expect(res.isValid).toBe(false);
      expect(res.missingFields).toEqual(["bankName", "accountNumber", "accountHolder"]);
      expect(res.errors).toHaveLength(3);
    });

    it("should report all fields missing when bank fields are empty strings or whitespace", () => {
      const res = getMissingPayoutFields({
        bankName: "   ",
        accountNumber: "",
        accountHolder: "  ",
      });
      expect(res.isValid).toBe(false);
      expect(res.missingFields).toContain("bankName");
      expect(res.missingFields).toContain("accountNumber");
      expect(res.missingFields).toContain("accountHolder");
    });

    it("should validate accountNumber: only digits between 8 and 20 characters", () => {
      // With alphabets or dashes
      const invalidChars = getMissingPayoutFields({
        bankName: "BCA",
        accountNumber: "1234-5678",
        accountHolder: "Budi Santoso",
      });
      expect(invalidChars.isValid).toBe(false);
      expect(invalidChars.missingFields).toContain("accountNumber");
      expect(invalidChars.errors.find((e) => e.field === "accountNumber")?.message).toMatch(/angka/i);

      // Too short (< 8 digits)
      const tooShort = getMissingPayoutFields({
        bankName: "BCA",
        accountNumber: "1234567",
        accountHolder: "Budi Santoso",
      });
      expect(tooShort.isValid).toBe(false);
      expect(tooShort.missingFields).toContain("accountNumber");

      // Too long (> 20 digits)
      const tooLong = getMissingPayoutFields({
        bankName: "BCA",
        accountNumber: "123456789012345678901",
        accountHolder: "Budi Santoso",
      });
      expect(tooLong.isValid).toBe(false);
      expect(tooLong.missingFields).toContain("accountNumber");

      // Valid 10-digit account
      const valid = getMissingPayoutFields({
        bankName: "BCA",
        accountNumber: "8420192831",
        accountHolder: "Budi Santoso",
      });
      expect(valid.isValid).toBe(true);
      expect(valid.missingFields).toHaveLength(0);
      expect(valid.errors).toHaveLength(0);
    });

    it("should validate accountHolder: minimum 3 non-whitespace characters", () => {
      const tooShortHolder = getMissingPayoutFields({
        bankName: "BCA",
        accountNumber: "8420192831",
        accountHolder: "AB",
      });
      expect(tooShortHolder.isValid).toBe(false);
      expect(tooShortHolder.missingFields).toContain("accountHolder");
      expect(tooShortHolder.errors.find((e) => e.field === "accountHolder")?.message).toMatch(/3 karakter/i);

      const validHolder = getMissingPayoutFields({
        bankName: "Mandiri",
        accountNumber: "1370019283921",
        accountHolder: "Komunitas Musik Singaraja",
      });
      expect(validHolder.isValid).toBe(true);
    });

    it("should safely mask account numbers to ****XXXX", () => {
      expect(maskAccountNumber("8420192831")).toBe("****2831");
      expect(maskAccountNumber("12345678")).toBe("****5678");
      expect(maskAccountNumber("123")).toBe("****123");
      expect(maskAccountNumber(null)).toBe("-");
      expect(maskAccountNumber(undefined)).toBe("-");
    });
  });

  describe("2. New Organizer Creation & Demo Accounts", () => {
    it("should preserve demo organizer bank accounts in INITIAL_ORGANIZERS", () => {
      expect(INITIAL_ORGANIZERS.length).toBeGreaterThan(0);
      INITIAL_ORGANIZERS.forEach((demo) => {
        expect(demo.bankName).toBeTruthy();
        expect(demo.accountNumber).toBeTruthy();
        expect(demo.accountHolder).toBeTruthy();
        const check = getMissingPayoutFields(demo);
        expect(check.isValid).toBe(true);
      });
    });

    it("should create new organizers with strictly null bank credentials", () => {
      const newEmail = `organizer.baru.${Date.now()}@singaraja.community`;
      const newProfile = ensureOrganizerActive(newEmail, "Komunitas Baru Singaraja");

      expect(newProfile.bankName).toBeNull();
      expect(newProfile.accountNumber).toBeNull();
      expect(newProfile.accountHolder).toBeNull();
      expect(newProfile.branch).toBeNull();

      // Guard check must fail for this new organizer
      const missingCheck = getMissingPayoutFields(newProfile);
      expect(missingCheck.isValid).toBe(false);
      expect(missingCheck.missingFields).toEqual(["bankName", "accountNumber", "accountHolder"]);

      // Server storage getter must return null
      const serverBank = getOrganizerServerBankAccount(newEmail);
      expect(serverBank).toBeNull();
    });

    it("should allow updating bank details and persist to server storage", () => {
      const testEmail = `org.update.${Date.now()}@singaraja.community`;
      ensureOrganizerActive(testEmail, "Komunitas Seni Rupa");

      const updated = updateOrganizerBankDetails(testEmail, {
        bankName: "BCA",
        accountNumber: "8420999999",
        accountHolder: "Komunitas Seni Rupa Singaraja",
        branch: "KCU Singaraja",
      });

      expect(updated.bankName).toBe("BCA");
      expect(updated.accountNumber).toBe("8420999999");
      expect(updated.accountHolder).toBe("Komunitas Seni Rupa Singaraja");

      const serverBank = getOrganizerServerBankAccount(testEmail);
      expect(serverBank).not.toBeNull();
      expect(serverBank?.accountNumber).toBe("8420999999");

      const check = getMissingPayoutFields(serverBank);
      expect(check.isValid).toBe(true);
    });
  });

  describe("3. Payout Server-Side Guards (requestOrganizerPayout & processOrganizerPayout)", () => {
    let testEventId: string;
    const testOrganizerEmail = `organizer.guard.${Date.now()}@dagoeng.id`;

    beforeAll(async () => {
      ensureOrganizerActive(testOrganizerEmail, "Komunitas Uji Guard");

      const created = await createEventSubmission({
        organizerName: "Komunitas Uji Guard",
        organizerEmail: testOrganizerEmail,
        organizerPhone: "081234567890",
        title: "Event Uji Coba Guard Rekening Payout",
        category: "WORKSHOP",
        description: "Uji coba integritas validasi rekening bank pada sisi server.",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 90000000).toISOString(),
        location: "Tech Lab Dago Hub",
        isPaid: true,
        price: 50000,
        posterUrl: "https://images.unsplash.com/photo-1511920170033",
      });
      testEventId = created.id;
      await updateEventStatus(testEventId, "APPROVED");

      // Generate revenue: book 4 tickets @ 50,000 = Rp 200,000 gross (80% organizer = Rp 160,000)
      const booking = await createEventBooking({
        eventId: testEventId,
        guestName: "Peserta Uji Payout",
        guestEmail: "peserta.payout@example.com",
        guestPhone: "081298765432",
        ticketCount: 4,
      });
      await updateBookingPaymentStatus(booking.id, "PAID");
    });

    it("should REJECT requestOrganizerPayout when server bank credentials are missing", async () => {
      await expect(
        requestOrganizerPayout(testOrganizerEmail, testEventId, 100000)
      ).rejects.toThrow(/PAYOUT_BANK_INCOMPLETE/i);
    });

    it("should ACCEPT requestOrganizerPayout once organizer bank is complete in server storage", async () => {
      updateOrganizerBankDetails(testOrganizerEmail, {
        bankName: "Mandiri",
        accountNumber: "1370018273645",
        accountHolder: "Komunitas Uji Guard",
        branch: "KCP Singaraja",
      });

      const result = await requestOrganizerPayout(
        testOrganizerEmail,
        testEventId,
        150000,
        undefined,
        "Mohon segera diproses",
        true
      );

      const updatedEvent = result.event;
      expect(updatedEvent.payoutHistory).toBeDefined();
      expect(updatedEvent.payoutHistory!.length).toBeGreaterThan(0);
      const record = updatedEvent.payoutHistory![0];
      expect(record.status).toBe("REQUESTED");
      expect(record.amount).toBe(150000);
      expect(record.bankName).toBe("Mandiri");
      expect(record.accountNumber).toBe("1370018273645");

      // Verify account masking function protects the account number
      expect(maskAccountNumber(record.accountNumber)).toBe("****3645");
    });

    it("should REJECT processOrganizerPayout when payout record has incomplete bank details", async () => {
      // Intentionally craft an invalid payout record in the event to test processOrganizerPayout guard
      const rawEvents = JSON.parse(fs.readFileSync(EVENTS_FILE, "utf-8"));
      const idx = rawEvents.findIndex((e: any) => e.id === testEventId);
      rawEvents[idx].payoutHistory.push({
        id: "payout-invalid-bank",
        amount: 10000,
        requestedAt: new Date().toISOString(),
        status: "REQUESTED",
        bankName: "",
        accountNumber: "",
        accountHolder: "",
      });
      fs.writeFileSync(EVENTS_FILE, JSON.stringify(rawEvents, null, 2), "utf-8");

      await expect(
        processOrganizerPayout(testEventId, "payout-invalid-bank", "PAID", "TRF-REF-12345")
      ).rejects.toThrow(/PAYOUT_BANK_INCOMPLETE/i);
    });
  });

  describe("4. API Route Guards (/api/events/[id]/payout)", () => {
    let apiTestEventId: string;
    const apiOrganizerEmail = `api.org.${Date.now()}@dagoeng.id`;

    beforeAll(async () => {
      ensureOrganizerActive(apiOrganizerEmail, "Komunitas API Test");
      const created = await createEventSubmission({
        organizerName: "Komunitas API Test",
        organizerEmail: apiOrganizerEmail,
        organizerPhone: "081234567890",
        title: "API Payout Guard Verification",
        category: "COMMUNITY",
        description: "Test API guard responses",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 90000000).toISOString(),
        location: "Amphitheater Dago Creative Hub",
        isPaid: true,
        price: 25000,
        posterUrl: "https://images.unsplash.com/photo-1511920170033",
      });
      apiTestEventId = created.id;
      await updateEventStatus(apiTestEventId, "APPROVED");

      // Generate revenue: 4 tickets @ 25,000 = Rp 100,000 (80% organizer = Rp 80,000)
      const booking = await createEventBooking({
        eventId: apiTestEventId,
        guestName: "Peserta API Test",
        guestEmail: "peserta.api@example.com",
        guestPhone: "081298765432",
        ticketCount: 4,
      });
      await updateBookingPaymentStatus(booking.id, "PAID");
    });

    it("POST: should return 400 with PAYOUT_BANK_INCOMPLETE and missingFields for new organizer", async () => {
      const req = new NextRequest(`http://localhost:3000/api/events/${apiTestEventId}/payout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: "dagoeng_active_persona=DAGO_OWNER",
        },
        body: JSON.stringify({
          amount: 50000,
          email: apiOrganizerEmail,
        }),
      });

      const res = await postPayoutHandler(req, { params: { id: apiTestEventId } });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe("PAYOUT_BANK_INCOMPLETE");
      expect(json.missingFields).toEqual(["bankName", "accountNumber", "accountHolder"]);
      expect(Array.isArray(json.errors)).toBe(true);
      expect(json.errors.length).toBe(3);
    });

    it("POST: should return 200 once bank is configured on server", async () => {
      updateOrganizerBankDetails(apiOrganizerEmail, {
        bankName: "BCA",
        accountNumber: "8420112233",
        accountHolder: "Komunitas API Test",
        branch: "KCU Singaraja",
      });

      const req = new NextRequest(`http://localhost:3000/api/events/${apiTestEventId}/payout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: "dagoeng_active_persona=DAGO_OWNER",
        },
        body: JSON.stringify({
          amount: 50000,
          email: apiOrganizerEmail,
        }),
      });

      const res = await postPayoutHandler(req, { params: { id: apiTestEventId } });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toContain("Permintaan pencairan dana berhasil diajukan");
      expect(json.message).toContain("****2233");
    });

    it("PATCH: admin should receive 400 with PAYOUT_BANK_INCOMPLETE if payout has invalid bank", async () => {
      // Add an invalid payout record to the event
      const rawEvents = JSON.parse(fs.readFileSync(EVENTS_FILE, "utf-8"));
      const idx = rawEvents.findIndex((e: any) => e.id === apiTestEventId);
      rawEvents[idx].payoutHistory.push({
        id: "payout-patch-invalid",
        amount: 10000,
        requestedAt: new Date().toISOString(),
        status: "REQUESTED",
        bankName: "",
        accountNumber: "",
        accountHolder: "",
      });
      fs.writeFileSync(EVENTS_FILE, JSON.stringify(rawEvents, null, 2), "utf-8");

      const req = new NextRequest(`http://localhost:3000/api/events/${apiTestEventId}/payout`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: "dagoeng_active_persona=DAGO_OWNER",
        },
        body: JSON.stringify({
          payoutId: "payout-patch-invalid",
          newStatus: "PAID",
          referenceNo: "TRF-TEST-9999",
        }),
      });

      const res = await patchPayoutHandler(req, { params: { id: apiTestEventId } });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe("PAYOUT_BANK_INCOMPLETE");
      expect(json.missingFields).toContain("bankName");
      expect(json.missingFields).toContain("accountNumber");
      expect(json.missingFields).toContain("accountHolder");
    });
  });

  describe("5. Security Audit: Bank Settings Route (/api/events/admin/settings/banks)", () => {
    it("should REJECT when Organizer A attempts to modify bank account of Organizer B (Cross-Tenant Isolation)", async () => {
      // Session belongs to Barista Community (COMMUNITY_BARISTA: baristaguild@dagocreative.id)
      // Attempt to send payload with organizerEmail = "halo@bandungdev.org" (Community B)
      const spoofReq = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: "dagoeng_active_persona=COMMUNITY_BARISTA",
        },
        body: JSON.stringify({
          label: "Rekening Palsu",
          bankName: "BCA",
          accountNumber: "8888777766",
          accountHolder: "Hacker Penyelenggara",
          accountType: "ORGANIZER",
          organizerEmail: "halo@bandungdev.org", // Differs from authenticated server session!
        }),
      });

      const res = await postBankSettingsHandler(spoofReq);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Pelanggaran isolasi data|tidak memiliki izin/i);
    });

    it("should REJECT when an organizer attempts to modify/create DAGO_HUB platform bank account", async () => {
      const hackReq = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: "dagoeng_active_persona=COMMUNITY_BARISTA",
        },
        body: JSON.stringify({
          label: "Rekening Utama Dago Bajakan",
          bankName: "BCA",
          accountNumber: "9999000011",
          accountHolder: "Penyerang",
          accountType: "DAGO_HUB", // Organizers are forbidden from setting platform account
        }),
      });

      const res = await postBankSettingsHandler(hackReq);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Penyelenggara hanya berhak mengatur rekening penampung payout/i);
    });

    it("should ACCEPT when Organizer A updates their own bank account and strictly mask account number in log & response", async () => {
      const validReq = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: "dagoeng_active_persona=COMMUNITY_BARISTA",
        },
        body: JSON.stringify({
          label: "Rekening Resmi Barista",
          bankName: "BCA",
          accountNumber: "8420199999",
          accountHolder: "Dago Specialty Coffee Society",
          branch: "KCU Singaraja",
        }),
      });

      const res = await postBankSettingsHandler(validReq);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      // Response message must mask account number
      expect(json.message).toContain("****9999");
      expect(json.data.organizerEmail).toBe("baristaguild@dagocreative.id");
      expect(json.data.accountType).toBe("ORGANIZER");

      // Verify audit history log in event_settings.json masks the account number
      const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      expect(settings.bankHistory).toBeDefined();
      const lastEntry = settings.bankHistory[0];
      expect(lastEntry.details).toContain("****9999");
      expect(lastEntry.details).not.toContain("8420199999"); // Full account number must never be unmasked in history log!
    });
  });

  describe("6. Database Synchronization & Cold-Start Resilience (STORAGE_organizers.json)", () => {
    it("should recover and read saved bank details after local storage is reset (cold start simulation)", async () => {
      const coldEmail = `cold.start.${Date.now()}@singaraja.community`;
      ensureOrganizerActive(coldEmail, "Komunitas Cold Start");

      const savedOrg = updateOrganizerBankDetails(coldEmail, {
        bankName: "BSI",
        accountNumber: "7123456789",
        accountHolder: "Komunitas Cold Start Singaraja",
        branch: "KC Singaraja",
      });

      expect(savedOrg.bankName).toBe("BSI");
      expect(savedOrg.accountNumber).toBe("7123456789");

      // Serialize snapshot of all organizers containing this newly saved bank
      const allOrganizersSnapshot = getAllOrganizers();
      const dbPayload = JSON.stringify(allOrganizersSnapshot);

      // COLD START SIMULATION ON SERVERLESS VERCEL:
      // 1. Reset memory cache
      clearOrganizersCache();

      // 2. Mock database query: PostgreSQL SystemSetting contains latest snapshot (STORAGE_organizers.json)
      const { db } = await import("@/lib/db");
      const findUniqueSpy = vi.spyOn(db.systemSetting, "findUnique").mockResolvedValue({
        id: "setting-orgs",
        key: "STORAGE_organizers.json",
        value: dbPayload,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // 3. Reset local disk to initial seed state (simulating fresh container)
      const orgFile = getDataFilePath("organizers.json");
      if (fs.existsSync(orgFile)) {
        fs.writeFileSync(orgFile, JSON.stringify(INITIAL_ORGANIZERS, null, 2), "utf-8");
      }

      // Verify before sync: cold start organizer is absent from local disk
      clearOrganizersCache();
      const localBeforeSync = getOrganizerByEmail(coldEmail);
      expect(localBeforeSync).toBeNull();

      // 4. Run database synchronization (syncStorageFromDb / syncOrganizersFromDb)
      const prevEnv = process.env.NODE_ENV;
      const prevDbUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = "postgresql://user:pass@ep-host.neon.tech/dagoeng";
      process.env.NODE_ENV = "production";

      try {
        const synced = await syncStorageFromDb("organizers.json");
        expect(synced).toBe(true);

        // Invalidate in-memory cache
        clearOrganizersCache();

        // 5. Verify that bank details are successfully recovered from DB to local storage
        const recoveredBank = getOrganizerServerBankAccount(coldEmail);
        expect(recoveredBank).not.toBeNull();
        expect(recoveredBank?.bankName).toBe("BSI");
        expect(recoveredBank?.accountNumber).toBe("7123456789");
        expect(recoveredBank?.accountHolder).toBe("Komunitas Cold Start Singaraja");

        // Payout validation guard must pass for recovered account
        const check = getMissingPayoutFields(recoveredBank);
        expect(check.isValid).toBe(true);
      } finally {
        findUniqueSpy.mockRestore();
        process.env.NODE_ENV = prevEnv;
        if (prevDbUrl) process.env.DATABASE_URL = prevDbUrl;
        else delete process.env.DATABASE_URL;
      }
    });
  });
});
