import { describe, expect, it } from "vitest";

import { resolvePostLoginDestination } from "@/features/auth/login-redirect";

describe("resolvePostLoginDestination", () => {
  it("uses the server's destination when there is no returnTo", () => {
    expect(resolvePostLoginDestination({ returnTo: null, role: "OWNER", serverRedirect: "/dashboard" })).toBe("/dashboard");
    expect(resolvePostLoginDestination({ returnTo: null, role: "OWNER" })).toBe("/dashboard");
  });

  it("sends an organizer back to the portal they came from", () => {
    expect(
      resolvePostLoginDestination({ returnTo: "/events/portal", role: "CUSTOMER", serverRedirect: "/events/portal" }),
    ).toBe("/events/portal");
    expect(
      resolvePostLoginDestination({ returnTo: "/events/portal?tab=FINANCE", role: "CUSTOMER", serverRedirect: "/events/portal" }),
    ).toBe("/events/portal?tab=FINANCE");
  });

  it("keeps a plain customer out of staff and organizer routes", () => {
    for (const route of ["/events/portal", "/dashboard", "/pos", "/events-admin"]) {
      expect(resolvePostLoginDestination({ returnTo: route, role: "CUSTOMER", serverRedirect: "/customer" })).toBe("/customer");
    }
  });

  it("does not let an organizer grant stretch to other restricted routes", () => {
    expect(
      resolvePostLoginDestination({ returnTo: "/events/portalx", role: "CUSTOMER", serverRedirect: "/events/portal" }),
    ).toBe("/customer");
    expect(resolvePostLoginDestination({ returnTo: "/dashboard", role: "CUSTOMER", serverRedirect: "/events/portal" })).toBe(
      "/customer",
    );
  });

  it("routes staff who came from the customer app to their own destination", () => {
    expect(resolvePostLoginDestination({ returnTo: "/customer", role: "CASHIER", serverRedirect: "/pos" })).toBe("/pos");
  });

  it("follows a safe returnTo otherwise", () => {
    expect(resolvePostLoginDestination({ returnTo: "/events/evt-1", role: "CUSTOMER", serverRedirect: "/customer" })).toBe(
      "/events/evt-1",
    );
    expect(resolvePostLoginDestination({ returnTo: "/reports", role: "OWNER", serverRedirect: "/dashboard" })).toBe("/reports");
  });
});
