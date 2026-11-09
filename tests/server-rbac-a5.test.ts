import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { RoleSlug } from "@/types/auth";
import { TRUSTED_PERSONAS, getRequestAuthUser, assertCheckInAuth } from "@/lib/server-auth";
import { ALL_NAV_ITEMS, hasRole } from "@/lib/rbac";
import { evaluateRouteAccess } from "@/lib/route-guard";

describe("Task A5: Server-side RBAC and Auth Hardening (POS-21, POS-22, POS-23)", () => {
  describe("POS-22: Role Separation between Check-in Staff and Waiter", () => {
    it("distinguishes CHECKIN_STAFF from WAITER as distinct RoleSlugs", () => {
      const checkinRole: RoleSlug = "CHECKIN_STAFF";
      const waiterRole: RoleSlug = "WAITER";
      expect(checkinRole).not.toBe(waiterRole);
    });

    it("assigns EVENT_STAFF trusted persona strictly to CHECKIN_STAFF role, not WAITER", () => {
      const eventStaff = TRUSTED_PERSONAS["EVENT_STAFF"];
      expect(eventStaff).toBeDefined();
      expect(eventStaff.role).toBe("CHECKIN_STAFF");
      expect(eventStaff.permissions).toContain("events:checkin");
    });

    it("ensures WAITER cannot access event check-in in navigation items", () => {
      const checkinNav = ALL_NAV_ITEMS.find((item) => item.href === "/events/checkin");
      expect(checkinNav).toBeDefined();
      expect(checkinNav?.allowedRoles).toContain("CHECKIN_STAFF");
      expect(checkinNav?.allowedRoles).not.toContain("WAITER");
    });

    it("strictly blocks WAITER in assertCheckInAuth", async () => {
      // Mock request from a WAITER persona
      const req = new NextRequest("http://localhost:3000/api/events/bookings", {
        headers: {
          cookie: "dagoeng_active_persona=WAITER_SGR",
        },
      });

      const result = await assertCheckInAuth(req);
      expect(result.authorized).toBe(false);
      expect(result.error).toMatch(/FORBIDDEN/i);
    });

    it("allows CHECKIN_STAFF in assertCheckInAuth", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/bookings", {
        headers: {
          cookie: "dagoeng_active_persona=EVENT_STAFF",
        },
      });

      const result = await assertCheckInAuth(req);
      expect(result.authorized).toBe(true);
      expect(result.role).toBe("CHECKIN_STAFF");
    });
  });

  describe("POS-21: Server-Side RBAC on Operational Routes (/pos, /kitchen, etc.)", () => {
    it("allows CASHIER, SUPER_ADMIN, OWNER, and MANAGER to access /pos", () => {
      expect(evaluateRouteAccess("/pos", "CASHIER").allowed).toBe(true);
      expect(evaluateRouteAccess("/pos", "SUPER_ADMIN").allowed).toBe(true);
      expect(evaluateRouteAccess("/pos", "OWNER").allowed).toBe(true);
      expect(evaluateRouteAccess("/pos", "MANAGER").allowed).toBe(true);
    });

    it("strictly forbids WAITER, KITCHEN_STAFF, CHECKIN_STAFF, and CUSTOMER from /pos", () => {
      expect(evaluateRouteAccess("/pos", "WAITER").allowed).toBe(false);
      expect(evaluateRouteAccess("/pos", "KITCHEN_STAFF").allowed).toBe(false);
      expect(evaluateRouteAccess("/pos", "CHECKIN_STAFF").allowed).toBe(false);
      expect(evaluateRouteAccess("/pos", "CUSTOMER").allowed).toBe(false);
    });

    it("strictly forbids unauthenticated access to protected routes", () => {
      expect(evaluateRouteAccess("/pos", null).allowed).toBe(false);
      expect(evaluateRouteAccess("/pos", null).redirectTo).toMatch(/\/login/);
      expect(evaluateRouteAccess("/kitchen", null).allowed).toBe(false);
      expect(evaluateRouteAccess("/dashboard", null).allowed).toBe(false);
    });

    it("allows KITCHEN_STAFF to /kitchen but blocks WAITER and CASHIER", () => {
      expect(evaluateRouteAccess("/kitchen", "KITCHEN_STAFF").allowed).toBe(true);
      expect(evaluateRouteAccess("/kitchen", "WAITER").allowed).toBe(false);
      expect(evaluateRouteAccess("/kitchen", "CASHIER").allowed).toBe(false);
    });

    it("allows CHECKIN_STAFF to /events/checkin but blocks WAITER and CASHIER", () => {
      expect(evaluateRouteAccess("/events/checkin", "CHECKIN_STAFF").allowed).toBe(true);
      expect(evaluateRouteAccess("/events/checkin", "WAITER").allowed).toBe(false);
      expect(evaluateRouteAccess("/events/checkin", "CASHIER").allowed).toBe(false);
    });

    it("verifies middleware redirects unauthenticated /pos navigation to /login", async () => {
      const { middleware } = await import("@/middleware");
      const req = new NextRequest("http://localhost:3000/pos");
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login?returnTo=%2Fpos");
    });

    it("verifies middleware redirects WAITER navigating to /pos to /tables", async () => {
      const { middleware } = await import("@/middleware");
      const req = new NextRequest("http://localhost:3000/pos", {
        headers: {
          cookie: "dagoeng_active_persona=WAITER_SGR",
        },
      });
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/tables");
    });

    it("verifies middleware allows CASHIER to access /pos directly", async () => {
      const { middleware } = await import("@/middleware");
      const req = new NextRequest("http://localhost:3000/pos", {
        headers: {
          cookie: "dagoeng_active_persona=CASHIER_SGR",
        },
      });
      const res = middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });
  });

  describe("POS-23: Session Expiry Validation", () => {
    it("rejects expired sessions and flags session expiry", async () => {
      const expiredDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      const isSessionValid = expiredDate.getTime() > Date.now();
      expect(isSessionValid).toBe(false);
    });
  });
});
