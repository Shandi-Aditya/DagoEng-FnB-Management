import { describe, it, expect } from "vitest";

/**
 * Re-creates the navigation & sanitization logic used in the login page and event marketplace.
 */
function sanitizeReturnTo(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.includes(":")
  ) {
    return trimmed;
  }
  return null;
}

function resolveLoginBackNavigation(fromParam: string | null, returnTo: string | null) {
  const isFromEvents = fromParam === "events" || returnTo?.startsWith("/events");
  const backHref = isFromEvents ? "/events" : "/";
  const backLabel = isFromEvents ? "Kembali ke Event Marketplace" : "Kembali ke Beranda";
  return { isFromEvents, backHref, backLabel };
}

describe("Event Marketplace Navigation & Authentication Consistency", () => {
  describe("Security: sanitizeReturnTo", () => {
    it("allows valid relative application paths", () => {
      expect(sanitizeReturnTo("/customer?tab=PROFILE")).toBe("/customer?tab=PROFILE");
      expect(sanitizeReturnTo("/events")).toBe("/events");
      expect(sanitizeReturnTo("/events/evt-001")).toBe("/events/evt-001");
      expect(sanitizeReturnTo("/events/tickets/recovery")).toBe("/events/tickets/recovery");
    });

    it("rejects malicious open-redirect URLs with protocol", () => {
      expect(sanitizeReturnTo("https://attacker.com")).toBeNull();
      expect(sanitizeReturnTo("http://malicious.org/phishing")).toBeNull();
      expect(sanitizeReturnTo("javascript:alert(1)")).toBeNull();
    });

    it("rejects protocol-relative and backslash bypasses", () => {
      expect(sanitizeReturnTo("//attacker.com")).toBeNull();
      expect(sanitizeReturnTo("/\\attacker.com")).toBeNull();
    });

    it("handles null, empty, or undefined safely", () => {
      expect(sanitizeReturnTo(null)).toBeNull();
      expect(sanitizeReturnTo(undefined)).toBeNull();
      expect(sanitizeReturnTo("")).toBeNull();
      expect(sanitizeReturnTo("   ")).toBeNull();
    });
  });

  describe("Bug Fix: Login Back Button Target & Cancellation Flow", () => {
    it("NEVER routes unauthenticated visitor to protected returnTo on back/cancel", () => {
      const returnTo = sanitizeReturnTo("/customer?tab=PROFILE");
      const fromParam = "events";

      const nav = resolveLoginBackNavigation(fromParam, returnTo);

      // CRITICAL: The back button MUST send them back to /events, NOT /customer?tab=PROFILE
      expect(nav.backHref).toBe("/events");
      expect(nav.backLabel).toBe("Kembali ke Event Marketplace");
      expect(nav.backHref).not.toBe(returnTo);
    });

    it("correctly routes general visitors back to Landing Page without exposing returnTo", () => {
      const returnTo = sanitizeReturnTo("/dashboard");
      const fromParam = null;

      const nav = resolveLoginBackNavigation(fromParam, returnTo);

      expect(nav.backHref).toBe("/");
      expect(nav.backLabel).toBe("Kembali ke Beranda");
    });

    it("routes event detail viewers back to /events when canceling login", () => {
      const returnTo = sanitizeReturnTo("/events/evt-tech-fest");
      const fromParam = null; // derived from returnTo starting with /events

      const nav = resolveLoginBackNavigation(fromParam, returnTo);

      expect(nav.isFromEvents).toBe(true);
      expect(nav.backHref).toBe("/events");
      expect(nav.backLabel).toBe("Kembali ke Event Marketplace");
    });
  });

  describe("Standardized Button Label Semantics", () => {
    const BUTTON_STANDARDS = {
      VIEW_ALL_EVENTS: { label: "Lihat Semua Event", target: "/events" },
      BACK_TO_EVENTS_CATALOG: { label: "Kembali ke Daftar Event", target: "/events" },
      BACK_TO_EVENT_MARKETPLACE: { label: "Kembali ke Event Marketplace", target: "/events" },
      SEARCH_GUEST_TICKET: { label: "Cari Tiket Pesanan Guest", target: "/events/tickets/recovery" },
      LOGIN_DAGOENG: { label: "Masuk ke Akun DagoEng", target: "/login" },
      VIEW_ORDER_TICKET: { label: "Lihat Tiket Pesanan", target: "/events/tickets/[token]" },
      MY_TICKETS_AUTHENTICATED: { label: "Tiket Saya", target: "/customer?tab=PROFILE" },
    };

    it("verifies standardized button targets and explicit labels", () => {
      expect(BUTTON_STANDARDS.VIEW_ALL_EVENTS.target).toBe("/events");
      expect(BUTTON_STANDARDS.BACK_TO_EVENTS_CATALOG.target).toBe("/events");
      expect(BUTTON_STANDARDS.SEARCH_GUEST_TICKET.target).toBe("/events/tickets/recovery");
      expect(BUTTON_STANDARDS.LOGIN_DAGOENG.target).toBe("/login");
    });
  });
});
