import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import {
  validateEventSubmission,
  checkRateLimit,
  createEventSubmission,
  getApprovedEvents,
  getPublicEventById,
  updateEventStatus,
  updateEventDetails,
  toPublicEvent,
  isSafePublicUrl,
  sanitizeHtmlText,
} from "../src/lib/events";
import { assertEventAdmin } from "../src/lib/server-auth";
import { getAuthorizedNavItems } from "../src/lib/rbac";
import { CommunityEvent, EventSubmissionPayload } from "../src/types/event";
import { AuthenticatedUser } from "../src/types/auth";
import { NextRequest } from "next/server";

const DATA_DIR = process.env.DATA_DIR_OVERRIDE || path.join(process.cwd(), "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");

describe("Community Events Module — Unit & Integration Tests", () => {
  let originalEventsBackup: string | null = null;

  beforeAll(() => {
    if (fs.existsSync(EVENTS_FILE)) {
      originalEventsBackup = fs.readFileSync(EVENTS_FILE, "utf-8");
    }
  });

  afterAll(() => {
    if (originalEventsBackup !== null) {
      fs.writeFileSync(EVENTS_FILE, originalEventsBackup, "utf-8");
    }
  });

  describe("1. Submission Validation", () => {
    const validPayload: EventSubmissionPayload = {
      organizerName: "Bandung Creative Labs",
      organizerEmail: "hello@creativelabs.id",
      organizerPhone: "081234567890",
      title: "Risograph Art Workshop 2026",
      category: "CREATIVE",
      description: "Belajar teknik cetak risograph 2 warna bersama pengajar berpengalaman.",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 90000000).toISOString(),
      location: "Maker Space Dago Hub Lt. 1",
      isPaid: true,
      price: 50000,
      posterUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5",
      externalRegistrationUrl: "https://loket.com/event/riso-art",
    };

    it("should accept a complete and valid event submission", () => {
      const res = validateEventSubmission(validPayload);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("should catch honeypot bot trap submission", () => {
      const spamPayload = { ...validPayload, honeypot: "I am a bot" };
      const res = validateEventSubmission(spamPayload);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain("spam");
    });

    it("should reject invalid organizer name, email, or phone", () => {
      const invalid = {
        ...validPayload,
        organizerName: "A", // too short
        organizerEmail: "not-an-email",
        organizerPhone: "123", // too short
      };
      const res = validateEventSubmission(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("Nama penyelenggara"))).toBe(true);
      expect(res.errors.some((e) => e.includes("email"))).toBe(true);
      expect(res.errors.some((e) => e.includes("WhatsApp"))).toBe(true);
    });

    it("should reject if end date is earlier than start date", () => {
      const invalidDates = {
        ...validPayload,
        startDate: "2026-10-20T14:00:00Z",
        endDate: "2026-10-20T10:00:00Z",
      };
      const res = validateEventSubmission(invalidDates);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("mendahului"))).toBe(true);
    });

    it("should require positive price if event is paid", () => {
      const invalidPrice = {
        ...validPayload,
        isPaid: true,
        price: 0,
      };
      const res = validateEventSubmission(invalidPrice);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("Nominal harga"))).toBe(true);
    });

    it("should reject invalid poster URL format", () => {
      const invalidUrl = {
        ...validPayload,
        posterUrl: "ftp://invalid-url.com/image.png",
      };
      const res = validateEventSubmission(invalidUrl);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("poster"))).toBe(true);
    });

    it("should reject invalid external registration URL format", () => {
      const invalidUrl = {
        ...validPayload,
        externalRegistrationUrl: "not-a-valid-url",
      };
      const res = validateEventSubmission(invalidUrl);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("eksternal"))).toBe(true);
    });

    it("should reject negative, zero, fraction, and invalid maxCapacity (T-4)", () => {
      const negativeCap = { ...validPayload, maxCapacity: -10 };
      const resNeg = validateEventSubmission(negativeCap);
      expect(resNeg.valid).toBe(false);
      expect(resNeg.errors.some((e) => e.includes("Kapasitas maksimal"))).toBe(true);

      const zeroCap = { ...validPayload, maxCapacity: 0 };
      const resZero = validateEventSubmission(zeroCap);
      expect(resZero.valid).toBe(false);
      expect(resZero.errors.some((e) => e.includes("Kapasitas maksimal"))).toBe(true);

      const fractionCap = { ...validPayload, maxCapacity: 12.5 };
      const resFraction = validateEventSubmission(fractionCap);
      expect(resFraction.valid).toBe(false);
      expect(resFraction.errors.some((e) => e.includes("Kapasitas maksimal"))).toBe(true);

      const nanCap = { ...validPayload, maxCapacity: NaN };
      const resNan = validateEventSubmission(nanCap);
      expect(resNan.valid).toBe(false);
      expect(resNan.errors.some((e) => e.includes("Kapasitas maksimal"))).toBe(true);

      const stringCap = { ...validPayload, maxCapacity: "invalid" as any };
      const resString = validateEventSubmission(stringCap);
      expect(resString.valid).toBe(false);
      expect(resString.errors.some((e) => e.includes("Kapasitas maksimal"))).toBe(true);
    });

    it("should accept valid integer maxCapacity and omitted optional maxCapacity (T-4)", () => {
      const validCap = { ...validPayload, maxCapacity: 100 };
      const resValid = validateEventSubmission(validCap);
      expect(resValid.valid).toBe(true);

      const omittedCap = { ...validPayload, maxCapacity: undefined };
      const resOmitted = validateEventSubmission(omittedCap);
      expect(resOmitted.valid).toBe(true);
    });
  });

  describe("2. Rate Limiting", () => {
    it("should enforce rate limiting on repetitive submissions from same IP", () => {
      const testIp = "192.168.1.100";
      // 5 allowed
      for (let i = 0; i < 5; i++) {
        expect(checkRateLimit(testIp, 5, 60000)).toBe(true);
      }
      // 6th blocked
      expect(checkRateLimit(testIp, 5, 60000)).toBe(false);
    });
  });

  describe("3. Lifecycle & Public Isolation (PENDING Hidden)", () => {
    let createdPendingEvent: CommunityEvent;

    it("should create an event with forced status PENDING", async () => {
      const payload: EventSubmissionPayload = {
        organizerName: "Komunitas Indie Dev",
        organizerEmail: "indie@bandung.dev",
        organizerPhone: "081987654321",
        title: `Dago Indie Jam Playtest ${Date.now()}`,
        category: "TECH",
        description: "Sesi playtest game indie buatan anak muda Bandung.",
        startDate: new Date(Date.now() + 100000000).toISOString(),
        endDate: new Date(Date.now() + 110000000).toISOString(),
        location: "Tech Lab Lt. 2",
        isPaid: false,
        price: 0,
        posterUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f",
      };

      createdPendingEvent = await createEventSubmission(payload);
      expect(createdPendingEvent.id).toBeDefined();
      expect(createdPendingEvent.status).toBe("PENDING");
    });

    it("should NOT return PENDING event in public approved events query", async () => {
      const approved = await getApprovedEvents();
      const found = approved.find((e) => e.id === createdPendingEvent.id);
      expect(found).toBeUndefined();
    });

    it("should return null when querying PENDING event via public getPublicEventById", async () => {
      const publicEvent = await getPublicEventById(createdPendingEvent.id);
      expect(publicEvent).toBeNull();
    });

    it("should strip private organizer email and phone from public sanitized event", () => {
      const sanitized = toPublicEvent(createdPendingEvent);
      const raw = sanitized as unknown as Record<string, unknown>;
      expect(raw.organizerEmail).toBeUndefined();
      expect(raw.organizerPhone).toBeUndefined();
      expect(raw.rejectionReason).toBeUndefined();
      expect(sanitized.title).toBe(createdPendingEvent.title);
      expect(sanitized.organizerName).toBe(createdPendingEvent.organizerName);
    });
  });

  describe("4. Admin Moderation & Status Operations", () => {
    let eventToModerate: CommunityEvent;

    it("should initialize or fetch an event for moderation", async () => {
      eventToModerate = await createEventSubmission({
        organizerName: "Dago Photo Society",
        organizerEmail: "photo@dagoeng.com",
        organizerPhone: "081233445566",
        title: "Street Photography Hunt",
        category: "CREATIVE",
        description: "Hunting foto jalanan bertema arsitektur heritage Bandung.",
        startDate: new Date(Date.now() + 50000000).toISOString(),
        endDate: new Date(Date.now() + 60000000).toISOString(),
        location: "Dago Courtyard",
        isPaid: false,
        price: 0,
        posterUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5",
      });
      expect(eventToModerate.status).toBe("PENDING");
    });

    it("should allow requesting revision with revision notes", async () => {
      const updated = await updateEventStatus(eventToModerate.id, "REVISION_REQUESTED", {
        revisionNotes: "Mohon cantumkan rute hunting foto secara lebih detail.",
      });
      expect(updated.status).toBe("REVISION_REQUESTED");
      expect(updated.revisionNotes).toBe("Mohon cantumkan rute hunting foto secara lebih detail.");
    });

    it("should allow approving the event and making it publicly visible", async () => {
      const approved = await updateEventStatus(eventToModerate.id, "APPROVED");
      expect(approved.status).toBe("APPROVED");

      // Verify it is now visible publicly
      const publicEvent = await getPublicEventById(eventToModerate.id);
      expect(publicEvent).not.toBeNull();
      expect(publicEvent?.id).toBe(eventToModerate.id);
      expect(publicEvent?.status).toBe("APPROVED");
    });

    it("should allow editing event details", async () => {
      const edited = await updateEventDetails(eventToModerate.id, {
        title: "Street Photography & Night Portrait Hunt",
        location: "Amphitheater Dago Hub",
      });
      expect(edited.title).toBe("Street Photography & Night Portrait Hunt");
      expect(edited.location).toBe("Amphitheater Dago Hub");
    });

    it("should allow archiving the event", async () => {
      const archived = await updateEventStatus(eventToModerate.id, "ARCHIVED");
      expect(archived.status).toBe("ARCHIVED");

      // Once archived, it must not be visible on public detail
      const publicArchived = await getPublicEventById(eventToModerate.id);
      expect(publicArchived).toBeNull();
    });

    it("should throw error when updating non-existent event", async () => {
      await expect(
        updateEventStatus("evt-non-existent-9999", "APPROVED")
      ).rejects.toThrow("tidak ditemukan");
    });
  });

  describe("5. Server-side Role & Scope Assertion & Anti-Spoofing", () => {
    it("should allow SUPER_ADMIN (PLATFORM) and Hub OWNER/MANAGER (ORGANIZATION) via verified server cookies", async () => {
      const reqSuperAdmin = new NextRequest("http://localhost:3000/api/events/admin", {
        headers: { Cookie: "dagoeng_active_persona=SUPER_ADMIN" },
      });
      const auth1 = await assertEventAdmin(reqSuperAdmin);
      expect(auth1.authorized).toBe(true);
      expect(auth1.role).toBe("SUPER_ADMIN");
      expect(auth1.scopeLevel).toBe("PLATFORM");

      const reqHubOwner = new NextRequest("http://localhost:3000/api/events/admin", {
        headers: { Cookie: "dagoeng_active_persona=HUB_OWNER" },
      });
      const auth2 = await assertEventAdmin(reqHubOwner);
      expect(auth2.authorized).toBe(true);
      expect(auth2.role).toBe("OWNER");
      expect(auth2.scopeLevel).toBe("ORGANIZATION");

      const reqManager = new NextRequest("http://localhost:3000/api/events/admin", {
        headers: { Cookie: "dagoeng_active_persona=HUB_MANAGER" },
      });
      const auth3 = await assertEventAdmin(reqManager);
      expect(auth3.authorized).toBe(true);
      expect(auth3.role).toBe("MANAGER");
      expect(auth3.scopeLevel).toBe("ORGANIZATION");
    });

    it("should strictly REJECT client header spoofing attempts (x-user-role without valid server cookie)", async () => {
      // Attacker attempts to spoof admin access by sending raw headers
      const spoofedReq = new NextRequest("http://localhost:3000/api/events/admin", {
        headers: {
          "x-user-role": "SUPER_ADMIN",
          "x-user-id": "attacker-id",
          "x-user-scope": "PLATFORM",
        },
      });
      const authSpoofed = await assertEventAdmin(spoofedReq);
      expect(authSpoofed.authorized).toBe(false);
      expect(authSpoofed.error).toContain("UNAUTHORIZED");
    });

    it("should strictly BLOCK Tenant Owners with TENANT scope from moderating hub-wide events", async () => {
      // Tenant stall owner (e.g. Kopi Senja Owner) has role OWNER, but scope TENANT
      const reqTenantOwner = new NextRequest("http://localhost:3000/api/events/admin", {
        headers: { Cookie: "dagoeng_active_persona=TENANT_OWNER" },
      });
      const authTenant = await assertEventAdmin(reqTenantOwner);
      expect(authTenant.authorized).toBe(false);
      expect(authTenant.error).toContain("FORBIDDEN");
      expect(authTenant.error).toContain("TENANT");
    });

    it("should block unauthenticated requests and unauthorized staff roles (CASHIER, KITCHEN_STAFF, CUSTOMER)", async () => {
      const reqNoAuth = new NextRequest("http://localhost:3000/api/events/admin");
      const authNoAuth = await assertEventAdmin(reqNoAuth);
      expect(authNoAuth.authorized).toBe(false);

      const reqCashier = new NextRequest("http://localhost:3000/api/events/admin", {
        headers: { Cookie: "dagoeng_active_persona=CASHIER" },
      });
      const authCashier = await assertEventAdmin(reqCashier);
      expect(authCashier.authorized).toBe(false);
      expect(authCashier.error).toContain("FORBIDDEN");

      const reqCustomer = new NextRequest("http://localhost:3000/api/events/admin", {
        headers: { Cookie: "dagoeng_active_persona=CUSTOMER" },
      });
      const authCust = await assertEventAdmin(reqCustomer);
      expect(authCust.authorized).toBe(false);
    });
  });

  describe("6. RBAC Navigation Scope Isolation", () => {
    const hubOwnerUser: AuthenticatedUser = {
      id: "u-owner-dago",
      email: "owner@dagoeng.com",
      name: "Dago Hub Owner",
      phone: "+62812345678",
      role: { id: "r-owner", slug: "OWNER", name: "Owner" },
      scopeLevel: "ORGANIZATION",
      allowedModules: ["FNB", "CO_WORKING"],
      organization: { id: "org-1", name: "Dago Creative Hub", code: "DAGO" },
      tenant: null,
      outlet: null,
      permissions: ["*"],
    };

    const tenantOwnerUser: AuthenticatedUser = {
      id: "u-owner-tenant",
      email: "owner.ks@dagoeng.com",
      name: "Tenant Owner Kopi Senja",
      phone: "+62812345671",
      role: { id: "r-owner", slug: "OWNER", name: "Owner" },
      scopeLevel: "TENANT",
      allowedModules: ["FNB"],
      organization: { id: "org-1", name: "Dago Creative Hub", code: "DAGO" },
      tenant: { id: "tenant-ks", name: "Kopi Senja", code: "KS", businessModule: "FNB" },
      outlet: null,
      permissions: ["fnb:operate"],
    };

    const cashierUser: AuthenticatedUser = {
      id: "u-cashier",
      email: "cashier@dagoeng.com",
      name: "Kasir",
      phone: "+62812345679",
      role: { id: "r-cashier", slug: "CASHIER", name: "Cashier" },
      scopeLevel: "OUTLET",
      allowedModules: ["FNB"],
      organization: { id: "org-1", name: "Dago Creative Hub", code: "DAGO" },
      tenant: null,
      outlet: { id: "out-1", name: "Singaraja", code: "SGR" },
      permissions: ["pos:operate"],
    };

    it("should include Event Komunitas for Hub OWNER (ORGANIZATION scope)", () => {
      const nav = getAuthorizedNavItems(hubOwnerUser);
      const eventNav = nav.find((item) => item.href === "/events-admin");
      expect(eventNav).toBeDefined();
      expect(eventNav?.name).toBe("Event Komunitas");
    });

    it("should NOT include Event Komunitas for Tenant OWNER (TENANT scope)", () => {
      const nav = getAuthorizedNavItems(tenantOwnerUser);
      const eventNav = nav.find((item) => item.href === "/events-admin");
      expect(eventNav).toBeUndefined();
    });

    it("should NOT include Event Komunitas for CASHIER", () => {
      const nav = getAuthorizedNavItems(cashierUser);
      const eventNav = nav.find((item) => item.href === "/events-admin");
      expect(eventNav).toBeUndefined();
    });
  });

  describe("7. SSRF & Dangerous URL Scheme Protection", () => {
    it("should block loopback hosts (localhost, 127.0.0.1, ::1)", () => {
      expect(isSafePublicUrl("http://localhost:3000/internal-api").safe).toBe(false);
      expect(isSafePublicUrl("http://127.0.0.1:8080/secret").safe).toBe(false);
      expect(isSafePublicUrl("http://[::1]/debug").safe).toBe(false);
    });

    it("should block cloud metadata services (169.254.169.254, metadata.google.internal)", () => {
      expect(isSafePublicUrl("http://169.254.169.254/latest/meta-data").safe).toBe(false);
      expect(isSafePublicUrl("http://metadata.google.internal/computeMetadata").safe).toBe(false);
    });

    it("should block private RFC 1918 network addresses (10.x, 172.16-31.x, 192.168.x)", () => {
      expect(isSafePublicUrl("http://10.0.0.1/admin").safe).toBe(false);
      expect(isSafePublicUrl("http://172.16.0.5/router").safe).toBe(false);
      expect(isSafePublicUrl("http://172.31.255.254/intranet").safe).toBe(false);
      expect(isSafePublicUrl("http://192.168.1.1/gateway").safe).toBe(false);
    });

    it("should block embedded credentials in URLs", () => {
      expect(isSafePublicUrl("https://admin:supersecret@myhost.com/image.png").safe).toBe(false);
    });

    it("should accept valid and safe public URLs", () => {
      expect(isSafePublicUrl("https://images.unsplash.com/photo-1509198397868").safe).toBe(true);
      expect(isSafePublicUrl("https://loket.com/event/creative-jam").safe).toBe(true);
      expect(isSafePublicUrl("http://dagoeng.com/poster.jpg").safe).toBe(true);
    });
  });

  describe("8. Input Sanitization & Stored XSS Prevention", () => {
    it("should strip dangerous script and iframe tags from text", () => {
      const malicious = "Workshop Kopi <script>alert('XSS')</script> Seru";
      const cleaned = sanitizeHtmlText(malicious);
      expect(cleaned).toBe("Workshop Kopi  Seru");
      expect(cleaned).not.toContain("<script>");

      const iframeAttack = "Acara <iframe src='http://evil.com'></iframe> Keren";
      expect(sanitizeHtmlText(iframeAttack)).not.toContain("<iframe");
    });
  });

  describe("9. Duplicate Submission Prevention", () => {
    it("should reject rapid duplicate submission with identical email and title within 5 minutes", async () => {
      const uniqueTitle = `Unique Workshop Test ${Date.now()}`;
      const payload: EventSubmissionPayload = {
        organizerName: "Dago Test Org",
        organizerEmail: "antiduplicate@dagoeng.com",
        organizerPhone: "081299887766",
        title: uniqueTitle,
        category: "WORKSHOP",
        description: "Pengujian pencegahan submit ganda secara otomatis.",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 90000000).toISOString(),
        location: "Dago Hub Main Hall",
        isPaid: false,
        price: 0,
        posterUrl: "https://images.unsplash.com/photo-1511920170033",
      };

      // 1st submission: succeeds
      const first = await createEventSubmission(payload);
      expect(first.id).toBeDefined();

      // 2nd identical submission: must be rejected
      await expect(createEventSubmission(payload)).rejects.toThrow("baru saja dikirimkan");
    });
  });

  describe("10. Mass Assignment & Status Immutability in PUT", () => {
    it("should NOT alter event status when updateEventDetails is called with status payload", async () => {
      const event = await createEventSubmission({
        organizerName: "Security Test Org",
        organizerEmail: "sec@dagoeng.com",
        organizerPhone: "081233221100",
        title: `Security Status Check ${Date.now()}`,
        category: "TECH",
        description: "Memastikan PUT tidak dapat mengubah status event secara ilegal.",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 90000000).toISOString(),
        location: "Tech Lab Dago Hub",
        isPaid: false,
        price: 0,
        posterUrl: "https://images.unsplash.com/photo-1550745165",
      });

      expect(event.status).toBe("PENDING");

      // Attempting to bypass status moderation by injecting status: APPROVED into updateEventDetails
      const tampered = await updateEventDetails(event.id, {
        title: "Updated Title Safely",
        status: "APPROVED",
      } as any);

      expect(tampered.title).toBe("Updated Title Safely");
      expect(tampered.status).toBe("PENDING"); // Must remain PENDING!
    });
  });
});
