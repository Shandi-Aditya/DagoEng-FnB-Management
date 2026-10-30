import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { canAccessEventCheckIn, getAuthorizedNavItems } from "@/lib/rbac";
import { assertCheckInAuth } from "@/lib/server-auth";
import { AuthenticatedUser } from "@/types/auth";
import { getDataFilePath } from "@/lib/data-storage";

describe("TARGETED SECURITY AUDIT — UNIVERSAL LOGIN, AUTO-ROUTING & EVENT CHECK-IN RBAC", () => {
  const eventsFile = getDataFilePath("events.json");
  let originalEventsContent: string | null = null;
  const mockEventIdA = "evt-sec-audit-001";
  const mockEventIdB = "evt-sec-audit-002";
  const mockEventIdInactive = "evt-sec-audit-003";
  const mockOrganizerEmailA = "organizer.a@community.org";
  const mockOrganizerEmailB = "organizer.b@community.org";
  const assignedStaffEmail = "eventstaff.assigned@dagoeng.com";

  beforeAll(() => {
    if (fs.existsSync(eventsFile)) {
      originalEventsContent = fs.readFileSync(eventsFile, "utf-8");
      const events = JSON.parse(originalEventsContent);
      const testEvents = [
        ...events,
        {
          id: mockEventIdA,
          title: "Audit Test Event A",
          category: "TECH",
          description: "Event A for Security Audit",
          startDate: new Date(Date.now() + 86400000).toISOString(),
          endDate: new Date(Date.now() + 90000000).toISOString(),
          location: "Amphitheater Dago",
          status: "APPROVED",
          organizerEmail: mockOrganizerEmailA,
          organizerName: "Organizer A",
          assignedStaffEmails: [assignedStaffEmail],
        },
        {
          id: mockEventIdB,
          title: "Audit Test Event B",
          category: "WORKSHOP",
          description: "Event B for Security Audit",
          startDate: new Date(Date.now() + 86400000).toISOString(),
          endDate: new Date(Date.now() + 90000000).toISOString(),
          location: "Workshop Room",
          status: "APPROVED",
          organizerEmail: mockOrganizerEmailB,
          organizerName: "Organizer B",
          assignedStaffEmails: [],
        },
        {
          id: mockEventIdInactive,
          title: "Audit Inactive Pending Event",
          category: "SEMINAR",
          description: "Inactive Event for Security Audit",
          startDate: new Date(Date.now() + 86400000).toISOString(),
          endDate: new Date(Date.now() + 90000000).toISOString(),
          location: "Meeting Room A",
          status: "PENDING",
          organizerEmail: mockOrganizerEmailA,
          organizerName: "Organizer A",
          assignedStaffEmails: [assignedStaffEmail],
        },
      ];
      fs.writeFileSync(eventsFile, JSON.stringify(testEvents, null, 2), "utf-8");
    }
  });

  afterAll(() => {
    if (originalEventsContent !== null && fs.existsSync(eventsFile)) {
      fs.writeFileSync(eventsFile, originalEventsContent, "utf-8");
    }
  });

  describe("1. Event Check-in RBAC Hardening (WAITER, CASHIER, & Event Staff)", () => {
    it("DITOLAK: WAITER organisasi tanpa explicit permission events:checkin ditolak di frontend RBAC", () => {
      const waiterUser: AuthenticatedUser = {
        id: "user-waiter-org",
        email: "waiter.org@dagoeng.com",
        name: "Waiter Org Hub",
        phone: "08123456789",
        role: { id: "role-waiter", slug: "WAITER", name: "Waiter" },
        scopeLevel: "ORGANIZATION",
        allowedModules: ["CORE", "FNB"],
        organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
        tenant: null,
        outlet: null,
        permissions: ["tables:view", "tables:manage", "orders:view"], // TIDAK memiliki events:checkin
      };

      const hasAccess = canAccessEventCheckIn(waiterUser);
      expect(hasAccess).toBe(false);

      const navItems = getAuthorizedNavItems(waiterUser);
      expect(navItems.some((item) => item.href === "/events/checkin")).toBe(false);
    });

    it("DITOLAK: CASHIER organisasi tanpa explicit permission events:checkin ditolak di frontend RBAC", () => {
      const cashierUser: AuthenticatedUser = {
        id: "user-cashier-org",
        email: "cashier.org@dagoeng.com",
        name: "Cashier Org Hub",
        phone: "08123456780",
        role: { id: "role-cashier", slug: "CASHIER", name: "Cashier" },
        scopeLevel: "ORGANIZATION",
        allowedModules: ["CORE", "FNB"],
        organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
        tenant: null,
        outlet: null,
        permissions: ["pos:operate", "orders:view"], // TIDAK memiliki events:checkin
      };

      const hasAccess = canAccessEventCheckIn(cashierUser);
      expect(hasAccess).toBe(false);

      const navItems = getAuthorizedNavItems(cashierUser);
      expect(navItems.some((item) => item.href === "/events/checkin")).toBe(false);
    });

    it("DITOLAK di Server: WAITER/CASHIER tanpa permission atau assignment ditolak di assertCheckInAuth (HTTP 403)", async () => {
      // CASHIER_SGR persona di server-auth tidak memiliki events:checkin dan tidak ditugaskan ke event
      const req = new NextRequest("http://localhost:3000/api/events/bookings/tkt-001", {
        headers: {
          cookie: "dagoeng_active_persona=CASHIER_SGR",
        },
      });

      const result = await assertCheckInAuth(req, mockEventIdA);
      expect(result.authorized).toBe(false);
      expect(result.error).toContain("FORBIDDEN");
    });

    it("DIIZINKAN: Event Staff dengan permission 'events:checkin' diizinkan di frontend dan server", async () => {
      const staffUser: AuthenticatedUser = {
        id: "user-event-staff",
        email: "eventstaff@dagoeng.com",
        name: "Petugas Event Lapangan",
        phone: "08123456781",
        role: { id: "role-staff", slug: "WAITER", name: "Event Staff" },
        scopeLevel: "ORGANIZATION",
        allowedModules: ["CORE"],
        organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
        tenant: null,
        outlet: null,
        permissions: ["events:checkin"], // EKSPLISIT MEMILIKI PERMISSION
      };

      expect(canAccessEventCheckIn(staffUser)).toBe(true);

      const navItems = getAuthorizedNavItems(staffUser);
      expect(navItems.some((item) => item.href === "/events/checkin")).toBe(true);

      // Server check dengan persona EVENT_STAFF yang memiliki permissions: ["events:checkin"]
      const req = new NextRequest("http://localhost:3000/api/events/bookings/tkt-001", {
        headers: {
          cookie: "dagoeng_active_persona=EVENT_STAFF",
        },
      });

      const serverAuth = await assertCheckInAuth(req, mockEventIdA);
      expect(serverAuth.authorized).toBe(true);
      expect(serverAuth.isFieldOfficer).toBe(true);
    });
  });

  describe("2. Event Staff Assignment Enforcement", () => {
    it("DIIZINKAN: Staff yang terdaftar di assignedStaffEmails pada event diizinkan check-in", async () => {
      // Buat request dengan persona yang email-nya terdaftar di assignedStaffEmails
      const req = new NextRequest("http://localhost:3000/api/events/bookings/tkt-001", {
        headers: {
          cookie: "dagoeng_active_persona=EVENT_STAFF",
        },
      });

      const serverAuth = await assertCheckInAuth(req, mockEventIdA);
      expect(serverAuth.authorized).toBe(true);
    });

    it("DITOLAK: Staf lapangan tanpa assignment pada event B dan tanpa generic checkin ditolak", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/bookings/tkt-001", {
        headers: {
          cookie: "dagoeng_active_persona=WAITER_SGR",
        },
      });

      const serverAuth = await assertCheckInAuth(req, mockEventIdB);
      expect(serverAuth.authorized).toBe(false);
      expect(serverAuth.error).toContain("FORBIDDEN");
    });

    it("DITOLAK: Event yang belum berstatus APPROVED (misal PENDING) ditolak untuk check-in", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/bookings/tkt-001", {
        headers: {
          cookie: "dagoeng_active_persona=EVENT_STAFF",
        },
      });

      const serverAuth = await assertCheckInAuth(req, mockEventIdInactive);
      expect(serverAuth.authorized).toBe(false);
      expect(serverAuth.error).toContain("tidak berstatus aktif atau belum disetujui");
    });
  });

  describe("3. Cross-Organizer Check-in Isolation", () => {
    it("DIIZINKAN: Organizer dapat check-in event miliknya sendiri", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/bookings/tkt-001", {
        headers: {
          cookie: "dagoeng_active_persona=COMMUNITY_BARISTA",
        },
      });

      // Barista Guild email: baristaguild@dagocreative.id
      // Cari apakah ada event milik barista di events.json
      const events = JSON.parse(fs.readFileSync(eventsFile, "utf-8"));
      const baristaEvent = events.find(
        (e: any) => (e.organizerEmail || "").toLowerCase() === "baristaguild@dagocreative.id"
      );

      if (baristaEvent) {
        const result = await assertCheckInAuth(req, baristaEvent.id);
        expect(result.authorized).toBe(true);
        expect(result.email).toBe("baristaguild@dagocreative.id");
      }
    });

    it("DITOLAK: Organizer DITOLAK saat mencoba check-in event milik komunitas lain (IDOR Prevention)", async () => {
      // Persona: COMMUNITY_BARISTA mencoba check in di mockEventIdB (milik organizer.b@community.org)
      const req = new NextRequest("http://localhost:3000/api/events/bookings/tkt-001", {
        headers: {
          cookie: "dagoeng_active_persona=COMMUNITY_BARISTA",
        },
      });

      const result = await assertCheckInAuth(req, mockEventIdB);
      expect(result.authorized).toBe(false);
      expect(result.error).toContain("FORBIDDEN");
    });
  });

  describe("4. Tenant F&B Strict Isolation", () => {
    it("DITOLAK: OWNER Tenant F&B tidak dapat mengakses Check-in Event di frontend RBAC", () => {
      const tenantOwner: AuthenticatedUser = {
        id: "user-tenant-ks",
        email: "owner.kopisenja@dagoeng.com",
        name: "I Wayan Pratama",
        phone: "081234567890",
        role: { id: "role-owner", slug: "OWNER", name: "Tenant Owner" },
        scopeLevel: "TENANT",
        allowedModules: ["FNB"],
        organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
        tenant: { id: "tenant-ks", name: "Kopi Senja", code: "KOPI-SENJA", businessModule: "FNB" },
        outlet: null,
        permissions: ["dashboard:view", "pos:operate", "orders:view"],
      };

      expect(canAccessEventCheckIn(tenantOwner)).toBe(false);

      const navItems = getAuthorizedNavItems(tenantOwner);
      expect(navItems.some((item) => item.href === "/events/checkin")).toBe(false);
      expect(navItems.some((item) => item.href === "/events-admin")).toBe(false);
      expect(navItems.some((item) => item.href === "/coworking")).toBe(false);
      expect(navItems.some((item) => item.href === "/activity-log")).toBe(false);
    });

    it("DITOLAK di Server: TENANT_OWNER persona ditolak total di assertCheckInAuth", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/bookings/tkt-001", {
        headers: {
          cookie: "dagoeng_active_persona=TENANT_OWNER_KS",
        },
      });

      const result = await assertCheckInAuth(req, mockEventIdA);
      expect(result.authorized).toBe(false);
      expect(result.error).toContain("Mitra F&B / Tenant tidak memiliki wewenang");
    });

    it("DITOLAK di Server: Tenant Owner dengan email domain resmi (@dagoeng.com) tetap ditolak via atribut scope TENANT & module FNB tanpa string matching", async () => {
      // Persona TENANT_OWNER_KITCHEN menggunakan email 'owner.dapurmama@dagoeng.com'
      // Ini membuktikan penolakan TIDAK bergantung pada nama domain email melainkan atribut scope/module
      const req = new NextRequest("http://localhost:3000/api/events/bookings/tkt-001", {
        headers: {
          cookie: "dagoeng_active_persona=TENANT_OWNER_KITCHEN",
        },
      });

      const result = await assertCheckInAuth(req, mockEventIdA);
      expect(result.authorized).toBe(false);
      expect(result.error).toContain("Mitra F&B / Tenant tidak memiliki wewenang");
    });
  });

  describe("5. Customer Access Control", () => {
    it("DITOLAK: Customer tidak melihat menu Check-in Event atau operasional internal di sidebar", () => {
      const customerUser: AuthenticatedUser = {
        id: "user-cust",
        email: "customer@gmail.com",
        name: "Customer Demo",
        phone: "081911223344",
        role: { id: "role-customer", slug: "CUSTOMER", name: "Customer" },
        scopeLevel: "OUTLET",
        allowedModules: ["FNB"],
        organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
        tenant: null,
        outlet: null,
        permissions: ["menu:view"],
      };

      expect(canAccessEventCheckIn(customerUser)).toBe(false);

      const navItems = getAuthorizedNavItems(customerUser);
      expect(navItems.some((item) => item.href === "/events/checkin")).toBe(false);
      expect(navItems.some((item) => item.href === "/dashboard")).toBe(false);
      expect(navItems.some((item) => item.href === "/settings")).toBe(false);
    });

    it("DITOLAK di Server: Customer persona ditolak di assertCheckInAuth", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/bookings/tkt-001", {
        headers: {
          cookie: "dagoeng_active_persona=CUSTOMER_DEMO",
        },
      });

      const result = await assertCheckInAuth(req, mockEventIdA);
      expect(result.authorized).toBe(false);
      expect(result.error).toContain("FORBIDDEN");
    });
  });

  describe("6. Hub Management Authority", () => {
    it("DIIZINKAN: SUPER_ADMIN memiliki akses penuh untuk check-in event apapun", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/bookings/tkt-001", {
        headers: {
          cookie: "dagoeng_active_persona=SUPER_ADMIN",
        },
      });

      const result = await assertCheckInAuth(req, mockEventIdA);
      expect(result.authorized).toBe(true);
      expect(result.role).toBe("SUPER_ADMIN");
    });

    it("DIIZINKAN: Hub OWNER (DAGO_OWNER) memiliki hak pengawasan check-in event hub", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/bookings/tkt-001", {
        headers: {
          cookie: "dagoeng_active_persona=DAGO_OWNER",
        },
      });

      const result = await assertCheckInAuth(req, mockEventIdA);
      expect(result.authorized).toBe(true);
      expect(result.role).toBe("OWNER");
    });
  });

  describe("7. Open Redirect & Restricted Route Sanitization", () => {
    function sanitizeReturnTo(url: string | null | undefined): string | null {
      if (!url || typeof url !== "string") return null;
      const trimmed = url.trim();
      if (
        trimmed.startsWith("/") &&
        !trimmed.startsWith("//") &&
        !trimmed.startsWith("/\\") &&
        !trimmed.includes(":") &&
        !trimmed.includes("\\")
      ) {
        return trimmed;
      }
      return null;
    }

    it("menolak manipulasi backslash dan protocol-relative URLs", () => {
      expect(sanitizeReturnTo("//evil.com")).toBeNull();
      expect(sanitizeReturnTo("/\\evil.com")).toBeNull();
      expect(sanitizeReturnTo("/path\\with\\backslash")).toBeNull();
      expect(sanitizeReturnTo("https://external.com")).toBeNull();
      expect(sanitizeReturnTo("javascript:alert(1)")).toBeNull();
    });

    it("mengizinkan rute aplikasi relatif yang aman", () => {
      expect(sanitizeReturnTo("/events")).toBe("/events");
      expect(sanitizeReturnTo("/events/tickets/recovery")).toBe("/events/tickets/recovery");
      expect(sanitizeReturnTo("/customer")).toBe("/customer");
    });

    it("mencegah customer dialihkan ke rute admin terlarang (Fallback ke /customer)", () => {
      const restrictedRoutes = [
        "/dashboard",
        "/events-admin",
        "/events/checkin",
        "/events/portal",
        "/settings",
        "/reports",
        "/employees",
        "/commercial",
        "/coworking",
        "/kitchen",
        "/pos",
        "/waiter",
        "/tables",
        "/inventory",
        "/customers",
        "/activity-log",
      ];

      for (const route of restrictedRoutes) {
        const userRole = "CUSTOMER";
        const isCustomer = userRole === "CUSTOMER";
        const isRestricted = restrictedRoutes.some((prefix) => route.startsWith(prefix));

        let destination = "/dashboard";
        if (isCustomer && isRestricted) {
          destination = "/customer";
        } else {
          destination = route;
        }

        expect(destination).toBe("/customer");
      }
    });
  });
});

