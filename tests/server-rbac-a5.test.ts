import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { RoleSlug } from "@/types/auth";
import { TRUSTED_PERSONAS, getRequestAuthUser, assertCheckInAuth } from "@/lib/server-auth";
import { ALL_NAV_ITEMS } from "@/lib/rbac";
import { evaluateRouteAccess } from "@/lib/route-guard";
import {
  EDGE_SESSION_COOKIE_NAME,
  signEdgeSessionToken,
  verifyEdgeSessionToken,
  clearRevocationRegistryForTests,
  clearInMemoryRevocationCacheForTests,
} from "@/lib/edge-session";
import { middleware, config as middlewareConfig } from "@/middleware";
import {
  registerUnifiedUser,
  updateUnifiedUserCredentialsOrRole,
} from "@/lib/unified-account";
import { GET as getShifts, POST as postShifts } from "@/app/api/shifts/route";
import { GET as getAuditLogsRoute } from "@/app/api/audit-logs/route";
import {
  GET as getCoworkingBookingsRoute,
  POST as postCoworkingBookingsRoute,
} from "@/app/api/coworking/bookings/route";

describe("Task A5: Server-side RBAC and Auth Hardening (POS-21, POS-22, POS-23)", () => {
  beforeEach(() => {
    clearRevocationRegistryForTests();
    delete process.env.DISABLE_DEMO_LOGIN;
  });

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

  describe("POS-21: Server-Side RBAC & Cookie Spoofing Protection", () => {
    it("allows CASHIER, SUPER_ADMIN, OWNER, and MANAGER to access /pos", () => {
      expect(evaluateRouteAccess("/pos", "CASHIER").allowed).toBe(true);
      expect(evaluateRouteAccess("/pos", "SUPER_ADMIN").allowed).toBe(true);
      expect(evaluateRouteAccess("/pos", "OWNER").allowed).toBe(true);
      expect(evaluateRouteAccess("/pos", "MANAGER").allowed).toBe(true);
    });

    it("strictly forbids WAITER, KITCHEN_STAFF, CHECKIN_STAFF, and CUSTOMER from /pos (TC-I01, TC-I02, TC-I03)", () => {
      expect(evaluateRouteAccess("/pos", "WAITER").allowed).toBe(false);
      expect(evaluateRouteAccess("/pos", "KITCHEN_STAFF").allowed).toBe(false);
      expect(evaluateRouteAccess("/pos", "CHECKIN_STAFF").allowed).toBe(false);
      expect(evaluateRouteAccess("/pos", "CUSTOMER").allowed).toBe(false);
    });

    it("includes /orders/:path* in middleware matcher configuration (A5-5)", () => {
      expect(middlewareConfig.matcher).toContain("/orders/:path*");
    });

    it("rejects spoofed unsigned dagoeng_session_role=OWNER cookie without valid signed token (A5-1)", () => {
      const req = new NextRequest("http://localhost:3000/reports", {
        headers: {
          cookie: "dagoeng_session_role=OWNER",
        },
      });
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login?returnTo=%2Freports");
    });

    it("rejects tampered edge token signature in middleware (A5-1)", () => {
      const validToken = signEdgeSessionToken({
        userId: "usr-1",
        role: "OWNER",
        scopeLevel: "ORGANIZATION",
      });
      const tamperedToken = validToken.slice(0, -4) + "ffff";

      const req = new NextRequest("http://localhost:3000/reports", {
        headers: {
          cookie: `${EDGE_SESSION_COOKIE_NAME}=${tamperedToken}`,
        },
      });
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login?returnTo=%2Freports");
    });

    it("rejects dagoeng_active_persona=SUPER_ADMIN when demo login is disabled (A5-1)", () => {
      process.env.DISABLE_DEMO_LOGIN = "true";
      const req = new NextRequest("http://localhost:3000/dashboard", {
        headers: {
          cookie: "dagoeng_active_persona=SUPER_ADMIN",
        },
      });
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login?returnTo=%2Fdashboard");
    });

    it("allows access to /reports with a valid signed OWNER edge session token", () => {
      const validToken = signEdgeSessionToken({
        userId: "usr-owner-1",
        role: "OWNER",
        scopeLevel: "ORGANIZATION",
      });

      const req = new NextRequest("http://localhost:3000/reports", {
        headers: {
          cookie: `${EDGE_SESSION_COOKIE_NAME}=${validToken}`,
        },
      });
      const res = middleware(req);
      expect(res.status).toBe(200);
    });

    it("redirects WAITER navigating to /pos to /tables and CUSTOMER navigating to /orders to /customer", () => {
      const waiterReq = new NextRequest("http://localhost:3000/pos", {
        headers: {
          cookie: "dagoeng_active_persona=WAITER_SGR",
        },
      });
      const waiterRes = middleware(waiterReq);
      expect(waiterRes.status).toBe(307);
      expect(waiterRes.headers.get("location")).toContain("/tables");

      const customerReq = new NextRequest("http://localhost:3000/orders", {
        headers: {
          cookie: "dagoeng_active_persona=CUSTOMER_DEMO",
        },
      });
      const customerRes = middleware(customerReq);
      expect(customerRes.status).toBe(307);
      expect(customerRes.headers.get("location")).toContain("/customer");
    });

    it("R6: fails closed in production when SESSION_SECRET is unset or shorter than 32 chars", () => {
      const validToken = signEdgeSessionToken({
        userId: "usr-owner-prod",
        role: "OWNER",
        scopeLevel: "ORGANIZATION",
      });

      const prevNodeEnv = process.env.NODE_ENV;
      const prevSecret = process.env.SESSION_SECRET;
      try {
        (process.env as any).NODE_ENV = "production";
        delete process.env.SESSION_SECRET;

        const checkUnset = verifyEdgeSessionToken(validToken);
        expect(checkUnset.valid).toBe(false);

        const req = new NextRequest("http://localhost:3000/reports", {
          headers: {
            cookie: `${EDGE_SESSION_COOKIE_NAME}=${validToken}`,
          },
        });
        const res = middleware(req);
        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toContain("/login");

        // Also test short secret (< 32 chars)
        process.env.SESSION_SECRET = "too-short-secret";
        expect(verifyEdgeSessionToken(validToken).valid).toBe(false);
      } finally {
        (process.env as any).NODE_ENV = prevNodeEnv;
        if (prevSecret !== undefined) {
          process.env.SESSION_SECRET = prevSecret;
        }
      }
    });
  });

  describe("POS-23 & TC-I05: Session Expiry and Role/Password Change Revocation", () => {
    it("redirects expired edge session token to /login?reason=expired (A5-3)", () => {
      const pastIat = Date.now() - 20 * 60 * 60 * 1000;
      const pastExp = Date.now() - 4 * 60 * 60 * 1000;
      const expiredToken = signEdgeSessionToken({
        userId: "usr-cashier-1",
        role: "CASHIER",
        iat: pastIat,
        exp: pastExp,
      });

      const req = new NextRequest("http://localhost:3000/pos", {
        headers: {
          cookie: `${EDGE_SESSION_COOKIE_NAME}=${expiredToken}`,
        },
      });
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login?reason=expired&returnTo=%2Fpos");
    });

    it("R7: immediately invalidates old sessions when user password or role is updated and survives in-memory cache reset across restarts (TC-I05 / A5-4)", async () => {
      const email = `staff-revocation-${Date.now()}@dagoeng.com`;
      const reg = await registerUnifiedUser({
        name: "Staf Uji Revokasi",
        email,
        phone: "081234567890",
        password: "Password123!",
        role: "STAFF",
      });

      const issuedBeforeChange = Date.now() - 5000;
      const tokenBeforeChange = signEdgeSessionToken({
        userId: reg.user.id,
        email: reg.user.email,
        role: "CASHIER",
        iat: issuedBeforeChange,
      });

      // Verify token is valid before role/password change
      expect(verifyEdgeSessionToken(tokenBeforeChange).valid).toBe(true);

      // Update role & password
      const updateRes = await updateUnifiedUserCredentialsOrRole(email, {
        newRole: "CUSTOMER",
        newPassword: "NewSecurePassword99!",
      });
      expect(updateRes.success).toBe(true);

      // R7: Clear in-memory revocation Map to simulate a cold serverless isolate / process restart
      clearInMemoryRevocationCacheForTests();

      // Old token issued before the change must still be rejected from persistent revocation store
      const verifyAfterRestart = verifyEdgeSessionToken(tokenBeforeChange);
      expect(verifyAfterRestart.valid).toBe(false);
      expect(verifyAfterRestart.revoked).toBe(true);

      // Server auth also rejects the revoked token with 401 SESSION_REVOKED
      const apiReq = new NextRequest("http://localhost:3000/api/shifts", {
        headers: {
          cookie: `${EDGE_SESSION_COOKIE_NAME}=${tokenBeforeChange}`,
        },
      });
      const authRes = await getRequestAuthUser(apiReq);
      expect(authRes.isAuthenticated).toBe(false);
      expect(authRes.error).toBe("SESSION_REVOKED");

      const shiftRes = await getShifts(apiReq);
      expect(shiftRes.status).toBe(401);
    });
  });

  describe("A5-6 & R11: Server-Side Auth Guards on Operational API Routes & Coworking Isolation", () => {
    it("rejects unauthenticated requests to /api/shifts, /api/audit-logs, and /api/coworking/bookings with 401", async () => {
      const shiftRes = await getShifts(new NextRequest("http://localhost:3000/api/shifts"));
      expect(shiftRes.status).toBe(401);

      const auditRes = await getAuditLogsRoute(new NextRequest("http://localhost:3000/api/audit-logs"));
      expect(auditRes.status).toBe(401);

      const cwRes = await getCoworkingBookingsRoute(
        new NextRequest("http://localhost:3000/api/coworking/bookings")
      );
      expect(cwRes.status).toBe(401);
    });

    it("rejects WAITER role attempting to POST /api/shifts or GET /api/audit-logs with 403", async () => {
      const waiterShiftReq = new NextRequest("http://localhost:3000/api/shifts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "dagoeng_active_persona=WAITER_SGR",
        },
        body: JSON.stringify({ action: "OPEN", openingCash: 200000 }),
      });
      const shiftRes = await postShifts(waiterShiftReq);
      expect(shiftRes.status).toBe(403);

      const waiterAuditReq = new NextRequest("http://localhost:3000/api/audit-logs", {
        headers: {
          cookie: "dagoeng_active_persona=WAITER_SGR",
        },
      });
      const auditRes = await getAuditLogsRoute(waiterAuditReq);
      expect(auditRes.status).toBe(403);
    });

    it("R11: rejects CUSTOMER B attempting to overwrite CUSTOMER A's coworking booking with 403", async () => {
      const sharedBookingId = `cwb-owner-a-${Date.now()}`;
      const sharedBookingCode = `CW-A-${Date.now().toString().slice(-4)}`;

      // Customer A (CUSTOMER_DEMO) creates their booking
      const createAReq = new NextRequest("http://localhost:3000/api/coworking/bookings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "dagoeng_active_persona=CUSTOMER_DEMO",
        },
        body: JSON.stringify({
          id: sharedBookingId,
          bookingCode: sharedBookingCode,
          spaceId: "sp-hot-1",
          guestName: "Customer A Original",
          date: "2026-11-12",
          duration: 2,
          totalAmount: 30000,
        }),
      });
      const createARes = await postCoworkingBookingsRoute(createAReq);
      expect(createARes.status).toBe(200);

      // Customer B (COMMUNITY_BARISTA, also role CUSTOMER) attempts to overwrite Customer A's booking
      const overwriteBReq = new NextRequest("http://localhost:3000/api/coworking/bookings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "dagoeng_active_persona=COMMUNITY_BARISTA",
        },
        body: JSON.stringify({
          id: sharedBookingId,
          bookingCode: sharedBookingCode,
          spaceId: "sp-hot-1",
          guestName: "Hijacked by Customer B",
          date: "2026-11-12",
          duration: 8,
          totalAmount: 0,
        }),
      });
      const overwriteBRes = await postCoworkingBookingsRoute(overwriteBReq);
      expect(overwriteBRes.status).toBe(403);
    });
  });
});
