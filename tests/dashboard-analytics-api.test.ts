import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { EDGE_SESSION_COOKIE_NAME, signEdgeSessionToken } from "@/lib/edge-session";
import * as persistentStorage from "@/lib/persistent-storage";
import { GET } from "@/app/api/dashboard/analytics/route";
import type { OrderRecord } from "@/types/order";
import type { RoleSlug, ScopeLevel } from "@/types/auth";

function isValidCalendarYmd(dateStr: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    !Number.isNaN(dt.getTime()) &&
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function makeAnalyticsRequest(
  query: string = "",
  auth?: {
    role: RoleSlug | "TENANT_OWNER";
    scopeLevel: ScopeLevel;
    tenantId?: string | null;
    email?: string;
    userId?: string;
  }
): NextRequest {
  const url = `http://localhost:3000/api/dashboard/analytics${query ? `?${query}` : ""}`;
  if (!auth) {
    return new NextRequest(url, { method: "GET" });
  }
  const token = signEdgeSessionToken({
    userId: auth.userId ?? `user-${auth.role.toLowerCase()}`,
    role: auth.role as RoleSlug,
    scopeLevel: auth.scopeLevel,
    tenantId: auth.tenantId ?? null,
    email: auth.email ?? `${auth.role.toLowerCase()}@dagoeng.com`,
    maxAgeSeconds: 3600,
  });
  return new NextRequest(url, {
    method: "GET",
    headers: {
      cookie: `${EDGE_SESSION_COOKIE_NAME}=${token}`,
    },
  });
}

function makeOrder(overrides: Partial<OrderRecord> & Pick<OrderRecord, "id" | "createdAt" | "total">): OrderRecord {
  return {
    orderNumber: `ORD-${overrides.id}`,
    organizationId: "org-dago-hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja (Pusat)",
    tableNumber: "T-01",
    customerName: "Tamu Uji",
    orderType: "DINE_IN",
    status: "COMPLETED",
    items: [],
    subtotal: overrides.total,
    tax: 0,
    paymentStatus: "PAID",
    targetServiceMinutes: 15,
    statusHistory: [],
    ...overrides,
  };
}

describe("GET /api/dashboard/analytics", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "super-secret-session-key-testing-minimum-32-chars-long";
    vi.restoreAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeAnalyticsRequest("startDate=2026-11-01&endDate=2026-11-15"));
    expect(res.status).toBe(401);
  });

  it.each<RoleSlug>(["CUSTOMER", "WAITER", "KITCHEN_STAFF", "CASHIER"])(
    "returns 403 for disallowed role %s",
    async (role) => {
      const res = await GET(
        makeAnalyticsRequest("startDate=2026-11-01&endDate=2026-11-15", {
          role,
          scopeLevel: "OUTLET",
        })
      );
      expect(res.status).toBe(403);
    }
  );

  it("returns 403 when TENANT-scoped user has no valid tenantId", async () => {
    const res = await GET(
      makeAnalyticsRequest("startDate=2026-11-01&endDate=2026-11-15", {
        role: "OWNER",
        scopeLevel: "TENANT",
        tenantId: null,
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when role TENANT_OWNER has no tenantId even if scopeLevel is not TENANT", async () => {
    const res = await GET(
      makeAnalyticsRequest("startDate=2026-11-01&endDate=2026-11-15", {
        role: "TENANT_OWNER",
        scopeLevel: "ORGANIZATION",
        tenantId: null,
      })
    );
    expect(res.status).toBe(403);
  });

  it("keeps role TENANT_OWNER strictly scoped to its tenant even if scopeLevel is not TENANT", async () => {
    const orders: OrderRecord[] = [
      makeOrder({
        id: "ord-ks-only",
        outletId: "outlet-sgr",
        createdAt: "2026-11-10T04:00:00.000Z",
        subtotal: 100_000,
        total: 100_000,
        items: [
          {
            id: "it-ks",
            productId: "prod-ks",
            tenantId: "tenant-ks",
            productName: "Kopi Senja",
            quantity: 1,
            unitPrice: 100_000,
          },
        ],
      }),
      makeOrder({
        id: "ord-kitchen-only",
        outletId: "outlet-sgr",
        createdAt: "2026-11-10T05:00:00.000Z",
        subtotal: 200_000,
        total: 200_000,
        items: [
          {
            id: "it-km",
            productId: "prod-km",
            tenantId: "tenant-kitchen",
            productName: "Nasi Goreng",
            quantity: 1,
            unitPrice: 200_000,
          },
        ],
      }),
    ];

    vi.spyOn(persistentStorage, "getPersistentOrders").mockResolvedValue(orders);

    const res = await GET(
      makeAnalyticsRequest("startDate=2026-11-10&endDate=2026-11-10&tenantId=tenant-kitchen", {
        role: "TENANT_OWNER",
        scopeLevel: "ORGANIZATION",
        tenantId: "tenant-ks",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.summary.orders).toBe(1);
    expect(body.data.summary.revenue).toBe(85_000);
  });

  it("enforces strict tenant isolation and ignores spoofed tenantId query params for TENANT OWNER", async () => {
    const orders: OrderRecord[] = [
      // Mixed order: Kopi Senja (100k, 85% share = 85k) + Dapur Mama (200k)
      makeOrder({
        id: "ord-mixed",
        outletId: "outlet-sgr",
        createdAt: "2026-11-10T04:00:00.000Z", // 12:00 WITA on 2026-11-10
        subtotal: 300_000,
        total: 300_000,
        items: [
          {
            id: "it-ks",
            productId: "prod-ks",
            tenantId: "tenant-ks",
            productName: "Kopi Senja",
            quantity: 1,
            unitPrice: 100_000,
          },
          {
            id: "it-km",
            productId: "prod-km",
            tenantId: "tenant-kitchen",
            productName: "Nasi Goreng",
            quantity: 1,
            unitPrice: 200_000,
          },
        ],
      }),
      // Pure Dapur Mama order WITHOUT order-level tenantId (must NOT leak to tenant-ks)
      makeOrder({
        id: "ord-kitchen-only",
        outletId: "outlet-sgr",
        createdAt: "2026-11-10T05:00:00.000Z",
        subtotal: 150_000,
        total: 150_000,
        items: [
          {
            id: "it-km-2",
            productId: "prod-km-2",
            tenantId: "tenant-kitchen",
            productName: "Mie Ayam",
            quantity: 1,
            unitPrice: 150_000,
          },
        ],
      }),
      // Order without any tenantId at order or item level (defaults to DAGO_HUB, must NOT leak)
      makeOrder({
        id: "ord-no-tenant",
        outletId: "outlet-sgr",
        createdAt: "2026-11-10T06:00:00.000Z",
        subtotal: 90_000,
        total: 90_000,
        items: [
          {
            id: "it-cowork",
            productName: "Sewa Meja",
            itemType: "COWORKING",
            quantity: 1,
            unitPrice: 90_000,
          },
        ],
      }),
    ];

    vi.spyOn(persistentStorage, "getPersistentOrders").mockResolvedValue(orders);

    // Spoofing ?tenantId=tenant-kitchen must be ignored for TENANT-scoped owner of tenant-ks
    const res = await GET(
      makeAnalyticsRequest("startDate=2026-11-10&endDate=2026-11-10&tenantId=tenant-kitchen", {
        role: "OWNER",
        scopeLevel: "TENANT",
        tenantId: "tenant-ks",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.summary.orders).toBe(1);
    // Only Kopi Senja's 85% share of 100k = 85k is attributed
    expect(body.data.summary.revenue).toBe(85_000);
  });

  it("enforces strict outlet scoping without failing open on missing outletId", async () => {
    const orders: OrderRecord[] = [
      makeOrder({
        id: "ord-sgr",
        outletId: "outlet-sgr",
        createdAt: "2026-11-10T04:00:00.000Z",
        total: 100_000,
      }),
      makeOrder({
        id: "ord-dps",
        outletId: "outlet-dps",
        createdAt: "2026-11-10T05:00:00.000Z",
        total: 250_000,
      }),
      makeOrder({
        id: "ord-missing-outlet",
        outletId: "" as string,
        createdAt: "2026-11-10T06:00:00.000Z",
        total: 300_000,
      }),
    ];

    vi.spyOn(persistentStorage, "getPersistentOrders").mockResolvedValue(orders);

    const res = await GET(
      makeAnalyticsRequest("startDate=2026-11-10&endDate=2026-11-10&outletId=outlet-sgr", {
        role: "OWNER",
        scopeLevel: "ORGANIZATION",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.summary.orders).toBe(1);
    expect(body.data.summary.revenue).toBe(100_000);
  });

  it("uses WITA calendar day boundaries for UTC timestamps and handles malformed dates safely", async () => {
    const orders: OrderRecord[] = [
      // 2026-11-10T17:00:00.000Z === 2026-11-11 01:00 WITA
      makeOrder({
        id: "ord-wita-next-day",
        outletId: "outlet-sgr",
        createdAt: "2026-11-10T17:00:00.000Z",
        total: 120_000,
      }),
      // 2026-11-10T15:30:00.000Z === 2026-11-10 23:30 WITA
      makeOrder({
        id: "ord-wita-same-day",
        outletId: "outlet-sgr",
        createdAt: "2026-11-10T15:30:00.000Z",
        total: 80_000,
      }),
    ];

    vi.spyOn(persistentStorage, "getPersistentOrders").mockResolvedValue(orders);

    const res = await GET(
      makeAnalyticsRequest("startDate=2026-11-11&endDate=2026-11-11", {
        role: "MANAGER",
        scopeLevel: "ORGANIZATION",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.summary.orders).toBe(1);
    expect(body.data.summary.revenue).toBe(120_000);

    const badRes = await GET(
      makeAnalyticsRequest("startDate=not-a-date&endDate=2026-99-99", {
        role: "MANAGER",
        scopeLevel: "ORGANIZATION",
      })
    );
    expect(badRes.status).toBe(200);
    const badBody = await badRes.json();
    expect(badBody.data.period.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(badBody.data.period.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(badBody.data.period.startDate).not.toBe("2026-99-99");
    expect(badBody.data.period.endDate).not.toBe("2026-99-99");
    expect(isValidCalendarYmd(badBody.data.period.startDate)).toBe(true);
    expect(isValidCalendarYmd(badBody.data.period.endDate)).toBe(true);

    const febInvalidRes = await GET(
      makeAnalyticsRequest("startDate=2026-02-30&endDate=2026-02-30", {
        role: "MANAGER",
        scopeLevel: "ORGANIZATION",
      })
    );
    expect(febInvalidRes.status).toBe(200);
    const febInvalidBody = await febInvalidRes.json();
    expect(febInvalidBody.data.period.startDate).not.toBe("2026-02-30");
    expect(febInvalidBody.data.period.endDate).not.toBe("2026-02-30");
    expect(isValidCalendarYmd(febInvalidBody.data.period.startDate)).toBe(true);
    expect(isValidCalendarYmd(febInvalidBody.data.period.endDate)).toBe(true);
  });

  it("normalizes CUSTOM compareMode without custom dates to PREVIOUS_PERIOD and keeps >366d summary consistent", async () => {
    const orders: OrderRecord[] = [
      makeOrder({
        id: "ord-2025",
        outletId: "outlet-sgr",
        createdAt: "2025-01-15T04:00:00.000Z",
        total: 100_000,
      }),
      makeOrder({
        id: "ord-2026",
        outletId: "outlet-sgr",
        createdAt: "2026-11-10T04:00:00.000Z",
        total: 250_000,
      }),
    ];

    vi.spyOn(persistentStorage, "getPersistentOrders").mockResolvedValue(orders);

    const res = await GET(
      makeAnalyticsRequest("startDate=2025-01-01&endDate=2026-12-31&compareMode=CUSTOM", {
        role: "OWNER",
        scopeLevel: "ORGANIZATION",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.period.compareMode).toBe("PREVIOUS_PERIOD");
    expect(body.data.period.compareLabel).toBe("Periode sebelumnya");
    expect(body.data.summary.orders).toBe(body.data.comparison.current.orders);
    expect(body.data.summary.revenue).toBe(body.data.comparison.current.revenue);
    expect(body.data.summary.orders).toBe(2);
    expect(body.data.summary.revenue).toBe(350_000);
  });

  it("logs internal errors and returns a generic error message without leaking internals", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(persistentStorage, "getPersistentOrders").mockRejectedValue(
      new Error("SENSITIVE_DB_CONNECTION_STRING_LEAK")
    );

    const res = await GET(
      makeAnalyticsRequest("startDate=2026-11-01&endDate=2026-11-15", {
        role: "OWNER",
        scopeLevel: "ORGANIZATION",
      })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Terjadi kesalahan internal pada server analitik.");
    expect(body.error).not.toContain("SENSITIVE_DB_CONNECTION_STRING_LEAK");
    expect(consoleSpy).toHaveBeenCalled();
  });
});
