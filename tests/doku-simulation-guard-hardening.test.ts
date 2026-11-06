import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  isStrictlySandboxGateway,
  DOKU_SANDBOX_HOSTNAMES,
  DOKU_LIVE_HOSTNAMES,
  DokuConfig,
  createDokuCheckoutSession,
  initiateDokuCheckout,
  DokuCheckoutError,
} from "@/lib/doku";
import {
  GET as handleSimulateLookup,
  POST as handleSimulateWebhook,
} from "@/app/api/webhooks/doku/simulate/route";
import { EventTicketOrder } from "@/types/event";

describe("PHASE 1: DOKU Simulation Security & Gateway Hardening", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DOKU_CLIENT_ID = "MCH-DAGOENG-TEST-001";
    process.env.DOKU_SECRET_KEY = "SK-DAGOENG-TEST-SECRET-12345";
    process.env.DOKU_API_URL = "https://api-sandbox.doku.com";
    process.env.DOKU_SIMULATION_MODE = "true";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("A. Gateway Hostname Allowlist & Validation (Fail-Closed)", () => {
    it("1. accepts verified sandbox hostname and test client ID", () => {
      const config: DokuConfig = {
        clientId: "MCH-TEST-VALID-01",
        secretKey: "SK-TEST-123",
        apiUrl: "https://api-sandbox.doku.com",
      };
      expect(isStrictlySandboxGateway(config)).toBe(true);
    });

    it("2. rejects official live hostnames (api.doku.com, pay.doku.com)", () => {
      const config1: DokuConfig = {
        clientId: "MCH-TEST-01",
        secretKey: "SK-TEST-123",
        apiUrl: "https://api.doku.com",
      };
      const config2: DokuConfig = {
        clientId: "MCH-TEST-01",
        secretKey: "SK-TEST-123",
        apiUrl: "https://pay.doku.com",
      };
      expect(isStrictlySandboxGateway(config1)).toBe(false);
      expect(isStrictlySandboxGateway(config2)).toBe(false);
    });

    it("3. rejects mixed configuration: Live URL with Test Client ID (closing the audit vulnerability)", () => {
      const mixedConfig: DokuConfig = {
        clientId: "MCH-TEST-CLIENT",
        secretKey: "SK-TEST-123",
        apiUrl: "https://api.doku.com",
      };
      // Must NOT fail open: Live hostname cannot be bypassed simply by naming client ID "TEST"
      expect(isStrictlySandboxGateway(mixedConfig)).toBe(false);
    });

    it("4. rejects mixed configuration: Sandbox URL with Live Client ID", () => {
      const mixedConfig: DokuConfig = {
        clientId: "MCH-LIVE-PRODUCTION-MERCHANT",
        secretKey: "SK-TEST-123",
        apiUrl: "https://api-sandbox.doku.com",
      };
      // Live merchant must not be permitted in sandbox simulator
      expect(isStrictlySandboxGateway(mixedConfig)).toBe(false);
    });

    it("5. rejects unknown or arbitrary hostname (fail-closed against SSRF/proxy bypass)", () => {
      const unknownHostConfig: DokuConfig = {
        clientId: "MCH-TEST-01",
        secretKey: "SK-TEST-123",
        apiUrl: "https://proxy-internal.dagoeng.com/api",
      };
      expect(isStrictlySandboxGateway(unknownHostConfig)).toBe(false);
    });

    it("6. rejects malformed URL gracefully without throwing unhandled exceptions", () => {
      const malformedConfig: DokuConfig = {
        clientId: "MCH-TEST-01",
        secretKey: "SK-TEST-123",
        apiUrl: "not-a-valid-url://@@#$",
      };
      expect(isStrictlySandboxGateway(malformedConfig)).toBe(false);
    });

    it("7. rejects plain HTTP protocol (must strictly be HTTPS)", () => {
      const httpConfig: DokuConfig = {
        clientId: "MCH-TEST-VALID-01",
        secretKey: "SK-TEST-123",
        apiUrl: "http://api-sandbox.doku.com",
      };
      expect(isStrictlySandboxGateway(httpConfig)).toBe(false);
    });

    it("8. rejects web portal domains (sandbox.doku.com, pay.doku.com) and accepts only official API hostname", () => {
      const portalConfig: DokuConfig = {
        clientId: "MCH-TEST-VALID-01",
        secretKey: "SK-TEST-123",
        apiUrl: "https://sandbox.doku.com",
      };
      expect(isStrictlySandboxGateway(portalConfig)).toBe(false);
    });

    it("9. rejects lookalike domain / subdomain spoofing attacks", () => {
      const spoof1: DokuConfig = {
        clientId: "MCH-TEST-VALID-01",
        secretKey: "SK-TEST-123",
        apiUrl: "https://api-sandbox.doku.com.attacker.com",
      };
      const spoof2: DokuConfig = {
        clientId: "MCH-TEST-VALID-01",
        secretKey: "SK-TEST-123",
        apiUrl: "https://fake-api-sandbox.doku.com",
      };
      expect(isStrictlySandboxGateway(spoof1)).toBe(false);
      expect(isStrictlySandboxGateway(spoof2)).toBe(false);
    });
  });

  describe("B. Absolute Production Lockdown on Simulation Endpoint", () => {
    it("10. rejects GET simulation lookup unconditionally in production (HTTP 403)", async () => {
      process.env.NODE_ENV = "production";
      process.env.DOKU_SIMULATION_MODE = "true";

      const req = new NextRequest("http://localhost:3000/api/webhooks/doku/simulate?invoice=INV-123");
      const res = await handleSimulateLookup(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/FORBIDDEN.*production/i);
    });

    it("11. rejects POST simulation dispatch unconditionally in production even if simulation mode flag is set (HTTP 403)", async () => {
      process.env.NODE_ENV = "production";
      process.env.DOKU_SIMULATION_MODE = "true";

      const req = new NextRequest("http://localhost:3000/api/webhooks/doku/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceNumber: "INV-12345", status: "SUCCESS" }),
      });
      const res = await handleSimulateWebhook(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/FORBIDDEN.*production/i);
    });

    it("12. in development, rejects simulation dispatch if gateway points to Live URL (HTTP 403)", async () => {
      process.env.NODE_ENV = "development";
      process.env.DOKU_API_URL = "https://api.doku.com";
      process.env.DOKU_CLIENT_ID = "MCH-LIVE-001";

      const req = new NextRequest("http://localhost:3000/api/webhooks/doku/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceNumber: "INV-12345", status: "SUCCESS" }),
      });
      const res = await handleSimulateWebhook(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/gateway sandbox terverifikasi/i);
    });
  });

  describe("C. Checkout Production Hardening & Fail-Fast Protection", () => {
    const mockOrder: EventTicketOrder = {
      id: "ord-test-01",
      ticketCode: "TEST-TKT-100",
      guestToken: "tok-100",
      eventId: "evt-01",
      eventTitle: "Workshop Barista",
      guestName: "Budi Test",
      guestEmail: "budi@test.com",
      guestPhone: "081234567890",
      ticketCount: 1,
      unitPrice: 50000,
      totalPrice: 50000,
      platformFeePercent: 10,
      platformFeeAmount: 5000,
      organizerRevenueAmount: 45000,
      paymentMethod: "DOKU_CHECKOUT",
      paymentStatus: "PENDING",
      checkInStatus: "REGISTERED",
      createdAt: new Date().toISOString(),
    };

    it("13. rejects checkout initiation in production when test client ID is configured", async () => {
      process.env.NODE_ENV = "production";
      process.env.DOKU_API_URL = "https://api.doku.com";
      process.env.DOKU_CLIENT_ID = "MCH-DAGOENG-TEST";
      process.env.DOKU_SECRET_KEY = "SK-DAGOENG-LIVE-PROD-KEY-XYZ";

      await expect(initiateDokuCheckout(mockOrder)).rejects.toThrowError(DokuCheckoutError);
      await expect(initiateDokuCheckout(mockOrder)).rejects.toThrow(/DOKU_CONFIGURATION_ERROR/);
    });

    it("14. rejects checkout initiation in production when default mock secret key is configured", async () => {
      process.env.NODE_ENV = "production";
      process.env.DOKU_API_URL = "https://api.doku.com";
      process.env.DOKU_CLIENT_ID = "MCH-DAGOENG-PROD-001";
      process.env.DOKU_SECRET_KEY = "SK-DAGOENG-SECRET-2026";

      await expect(createDokuCheckoutSession(mockOrder)).rejects.toThrowError(DokuCheckoutError);
      await expect(createDokuCheckoutSession(mockOrder)).rejects.toThrow(/DOKU_CONFIGURATION_ERROR/);
    });

    it("15. rejects checkout initiation in production when apiUrl points to sandbox", async () => {
      process.env.NODE_ENV = "production";
      process.env.DOKU_API_URL = "https://api-sandbox.doku.com";
      process.env.DOKU_CLIENT_ID = "MCH-DAGOENG-PROD-001";
      process.env.DOKU_SECRET_KEY = "SK-PROD-KEY-VALID-999";

      await expect(createDokuCheckoutSession(mockOrder)).rejects.toThrowError(DokuCheckoutError);
      await expect(createDokuCheckoutSession(mockOrder)).rejects.toThrow(/DOKU_CONFIGURATION_ERROR/);
    });

    it("16. generates offline simulation payment URL safely in non-production environments", async () => {
      process.env.NODE_ENV = "test";
      process.env.DOKU_CLIENT_ID = "MCH-DAGOENG-TEST";

      const res = await initiateDokuCheckout(mockOrder);
      expect(res.paymentUrl).toMatch(/^\/checkout-link-v2\//);
      expect(res.invoiceNumber).toBe(`INV-${mockOrder.ticketCode}`);
      expect(res.tokenId).toBeDefined();
    });
  });
});

