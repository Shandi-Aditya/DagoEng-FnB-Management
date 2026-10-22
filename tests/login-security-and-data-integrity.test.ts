import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { POST as handleLogin } from "@/app/api/auth/login/route";
import {
  assertOrganizerAuth,
  assertEventAdmin,
  getRequestAuthUser,
} from "@/lib/server-auth";
import {
  getAllOrganizers,
  createOrganizer,
  updateOrganizerStatus,
} from "@/lib/organizers";

const DATA_DIR = path.join(process.cwd(), "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const BOOKINGS_FILE = path.join(DATA_DIR, "event_bookings.json");
const SETTINGS_FILE = path.join(DATA_DIR, "event_settings.json");
const ORGANIZERS_FILE = path.join(DATA_DIR, "organizers.json");

describe("Login Security & Data Integrity Audit Fix (DAGO Creative Hub)", () => {
  let originalOrganizersBackup: string | null = null;
  let originalSettingsBackup: string | null = null;
  let originalEventsBackup: string | null = null;
  let originalBookingsBackup: string | null = null;

  beforeEach(() => {
    if (fs.existsSync(ORGANIZERS_FILE)) {
      originalOrganizersBackup = fs.readFileSync(ORGANIZERS_FILE, "utf-8");
    }
    if (fs.existsSync(SETTINGS_FILE)) {
      originalSettingsBackup = fs.readFileSync(SETTINGS_FILE, "utf-8");
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
      fs.writeFileSync(SETTINGS_FILE, originalSettingsBackup, "utf-8");
    }
    if (originalEventsBackup !== null) {
      fs.writeFileSync(EVENTS_FILE, originalEventsBackup, "utf-8");
    }
    if (originalBookingsBackup !== null) {
      fs.writeFileSync(BOOKINGS_FILE, originalBookingsBackup, "utf-8");
    }
  });

  // ---------------------------------------------------------------------------
  // 1. PREVENTION OF PRIVILEGE ESCALATION & UNKNOWN EMAIL REJECTION
  // ---------------------------------------------------------------------------
  describe("1. Prevention of Fallback Escalation & Substring Impersonation", () => {
    it("should reject completely unknown email with 401 and NEVER grant DAGO_OWNER", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "stranger.unknown@gmail.com",
          password: "AnyPassword123!",
        }),
      });

      const res = await handleLogin(req);
      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("tidak terdaftar");
      expect(data.personaKey).toBeUndefined();

      // Ensure no authenticated session cookie was set
      const cookieHeader = res.headers.get("set-cookie") || "";
      expect(cookieHeader).not.toContain("dagoeng_active_persona=DAGO_OWNER");
    });

    it("should reject emails containing 'admin' or 'owner' keywords without granting elevated roles", async () => {
      const maliciousEmails = [
        "hacker.admin@external-domain.com",
        "superadmin@competitor.id",
        "fake.owner@gmail.com",
        "dago.owner.fake@yahoo.com",
      ];

      for (const email of maliciousEmails) {
        const req = new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: "Password123!" }),
        });

        const res = await handleLogin(req);
        expect(res.status).toBe(401);

        const data = await res.json();
        expect(data.success).toBe(false);
        expect(data.personaKey).toBeUndefined();

        const cookieHeader = res.headers.get("set-cookie") || "";
        expect(cookieHeader).not.toContain("DAGO_OWNER");
        expect(cookieHeader).not.toContain("SUPER_ADMIN");
      }
    });

    it("should reject emails containing 'barista' or 'organizer' keywords without granting COMMUNITY_BARISTA", async () => {
      const impersonationAttempts = [
        "random.barista@kopishop.com",
        "festival.organizer@events.id",
        "penyelenggara.baru@bandung.org",
      ];

      for (const email of impersonationAttempts) {
        const req = new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: "Password123!" }),
        });

        const res = await handleLogin(req);
        expect(res.status).toBe(401);

        const data = await res.json();
        expect(data.success).toBe(false);
        expect(data.personaKey).toBeUndefined();

        const cookieHeader = res.headers.get("set-cookie") || "";
        expect(cookieHeader).not.toContain("COMMUNITY_BARISTA");
      }
    });

    it("should reject empty or missing email/password with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "", password: "" }),
      });

      const res = await handleLogin(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. VALID DEMO PERSONAS AUTHENTICATION
  // ---------------------------------------------------------------------------
  describe("2. Explicit Demo Accounts Authentication", () => {
    it("should allow valid Super Admin demo account to login", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@dagoeng.com",
          password: "Password123!",
        }),
      });

      const res = await handleLogin(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.personaKey).toBe("SUPER_ADMIN");
      expect(data.user.role).toBe("SUPER_ADMIN");

      const cookieHeader = res.headers.get("set-cookie") || "";
      expect(cookieHeader).toContain("dagoeng_active_persona=SUPER_ADMIN");
    });

    it("should allow valid Dago Owner demo account to login", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "owner.dago@dagoeng.com",
          password: "Password123!",
        }),
      });

      const res = await handleLogin(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.personaKey).toBe("DAGO_OWNER");
    });

    it("should allow valid Community Barista demo account to login and route to /events/portal", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "baristaguild@dagocreative.id",
          password: "Password123!",
        }),
      });

      const res = await handleLogin(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.personaKey).toBe("COMMUNITY_BARISTA");
      expect(data.redirectUrl).toBe("/events/portal");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. REGISTERED ORGANIZERS BOUNDARY & DEACTIVATION
  // ---------------------------------------------------------------------------
  describe("3. Registered Community Organizers & Deactivation Rules", () => {
    it("should reject registered organizer profile without dynamic credentials (boundary check)", async () => {
      // Dago Hijau is registered in organizers.json but has no configured dynamic credential
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "kontak@dagohijau.id",
          password: "Password123!",
        }),
      });

      const res = await handleLogin(req);
      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("kredensial login mandiri belum diaktivasi");

      // Verify no session cookie was created
      const cookieHeader = res.headers.get("set-cookie") || "";
      expect(cookieHeader).not.toContain("dagoeng_active_persona");
    });

    it("should reject newly registered organizer created by admin from logging in without credential setup", async () => {
      const uniqueEmail = `newcommunity_${Date.now()}@dagocreative.id`;
      createOrganizer({
        name: "Teater Priangan",
        category: "Seni Pertunjukan",
        contactPerson: "Rangga",
        phone: "+62 812-4455-6677",
        email: uniqueEmail,
        initialStatus: "ACTIVE",
      });

      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: uniqueEmail,
          password: "Password123!",
        }),
      });

      const res = await handleLogin(req);
      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("kredensial login mandiri belum diaktivasi");
    });

    it("should strictly reject deactivated organizer at login endpoint", async () => {
      const list = getAllOrganizers();
      const barista = list.find((o) => o.email === "baristaguild@dagocreative.id");
      expect(barista).toBeDefined();

      // Deactivate Barista Guild
      updateOrganizerStatus(barista!.id, "INACTIVE");

      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "baristaguild@dagocreative.id",
          password: "Password123!",
        }),
      });

      const res = await handleLogin(req);
      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("dinonaktifkan oleh Administrator Platform");

      // Restore
      updateOrganizerStatus(barista!.id, "ACTIVE");
    });

    it("should strictly reject deactivated organizer on server portal API even if session cookie exists", async () => {
      const list = getAllOrganizers();
      const barista = list.find((o) => o.email === "baristaguild@dagocreative.id");
      expect(barista).toBeDefined();

      // Deactivate Barista Guild
      updateOrganizerStatus(barista!.id, "INACTIVE");

      // Simulate active cookie in request
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
  });

  // ---------------------------------------------------------------------------
  // 4. RBAC & DATA ISOLATION INTEGRITY
  // ---------------------------------------------------------------------------
  describe("4. RBAC & Cross-Community Tenant Isolation", () => {
    it("should prevent community organizer from accessing other organizers' data", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/portal", {
        headers: {
          cookie: "dagoeng_active_persona=COMMUNITY_BARISTA",
        },
      });

      // Barista tries to access Bandung Dev data
      const auth = await assertOrganizerAuth(req, "halo@bandungdev.org");
      expect(auth.authorized).toBe(false);
      expect(auth.error).toContain("Pelanggaran isolasi data");
    });

    it("should prevent community organizer from accessing Platform Admin moderation endpoints", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/admin/settings", {
        headers: {
          cookie: "dagoeng_active_persona=COMMUNITY_BARISTA",
        },
      });

      const adminAuth = await assertEventAdmin(req);
      expect(adminAuth.authorized).toBe(false);
      expect(adminAuth.error).toContain("FORBIDDEN");
    });

    it("should prevent F&B Tenant Owners from accessing Event Admin settings", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/admin/settings", {
        headers: {
          cookie: "dagoeng_active_persona=TENANT_OWNER_KS",
        },
      });

      const adminAuth = await assertEventAdmin(req);
      expect(adminAuth.authorized).toBe(false);
      expect(adminAuth.error).toContain("cakupan [TENANT] tidak berhak memoderasi event");
    });
  });

  // ---------------------------------------------------------------------------
  // 5. DATA FILE INTEGRITY (ZERO TEST POLLUTION)
  // ---------------------------------------------------------------------------
  describe("5. File Integrity & Clean Teardown", () => {
    it("should leave events.json and event_bookings.json completely unmodified after test", () => {
      const eventsAfter = fs.readFileSync(EVENTS_FILE, "utf-8");
      const bookingsAfter = fs.readFileSync(BOOKINGS_FILE, "utf-8");

      expect(eventsAfter).toBe(originalEventsBackup);
      expect(bookingsAfter).toBe(originalBookingsBackup);
    });
  });
});
