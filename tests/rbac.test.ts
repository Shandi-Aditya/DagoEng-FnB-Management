import { describe, it, expect } from "vitest";
import { hasPermission, hasRole, assertPermission, assertRole, getAuthorizedNavItems } from "../src/lib/rbac";
import { AuthenticatedUser } from "../src/types/auth";

const mockOwner: AuthenticatedUser = {
  id: "user-owner-1",
  email: "owner@kopisenja.com",
  name: "I Wayan Pratama",
  phone: "+62 812-3456-7890",
  role: { id: "role-owner", slug: "OWNER", name: "Owner" },
  scopeLevel: "ORGANIZATION",
  allowedModules: ["FNB", "CO_WORKING"],
  organization: { id: "org-ks", name: "Kopi Senja", code: "KOPI-SENJA" },
  tenant: null,
  outlet: null,
  permissions: ["dashboard:view", "dashboard:compare_outlets", "reports:view", "menu:manage", "inventory:view"],
};

const mockCashier: AuthenticatedUser = {
  id: "user-cashier-1",
  email: "cashier.sgr@kopisenja.com",
  name: "Ni Kadek Sri",
  phone: "+62 812-3456-7891",
  role: { id: "role-cashier", slug: "CASHIER", name: "Cashier" },
  scopeLevel: "OUTLET",
  allowedModules: ["FNB"],
  organization: { id: "org-ks", name: "Kopi Senja", code: "KOPI-SENJA" },
  tenant: null,
  outlet: { id: "outlet-sgr", name: "Singaraja", code: "KS-SGR" },
  permissions: ["pos:operate", "orders:view", "tables:view"],
};

const mockKitchen: AuthenticatedUser = {
  id: "user-kitchen-1",
  email: "kitchen.sgr@kopisenja.com",
  name: "Gede Agus",
  phone: "+62 812-3456-7892",
  role: { id: "role-kitchen", slug: "KITCHEN_STAFF", name: "Kitchen Staff" },
  scopeLevel: "OUTLET",
  allowedModules: ["FNB"],
  organization: { id: "org-ks", name: "Kopi Senja", code: "KOPI-SENJA" },
  tenant: null,
  outlet: { id: "outlet-sgr", name: "Singaraja", code: "KS-SGR" },
  permissions: ["kitchen:kds", "orders:view"],
};

describe("RBAC Matrix & Permission Guard Evaluation", () => {
  it("evaluates role authorization accurately", () => {
    expect(hasRole(mockOwner, ["OWNER", "SUPER_ADMIN"])).toBe(true);
    expect(hasRole(mockCashier, ["OWNER", "SUPER_ADMIN"])).toBe(false);
    expect(hasRole(mockCashier, ["CASHIER"])).toBe(true);
  });

  it("evaluates granular permissions accurately", () => {
    expect(hasPermission(mockOwner, "dashboard:view")).toBe(true);
    expect(hasPermission(mockOwner, "pos:operate")).toBe(false);

    expect(hasPermission(mockCashier, "pos:operate")).toBe(true);
    expect(hasPermission(mockCashier, "reports:view")).toBe(false);

    expect(hasPermission(mockKitchen, "kitchen:kds")).toBe(true);
    expect(hasPermission(mockKitchen, "pos:operate")).toBe(false);
  });

  it("asserts permissions without error on authorized user and throws on forbidden", () => {
    expect(() => assertPermission(mockOwner, "dashboard:view")).not.toThrow();
    expect(() => assertPermission(mockCashier, "reports:view")).toThrowError(/FORBIDDEN/);
  });

  it("filters dynamic navigation items strictly based on user role", () => {
    const ownerNav = getAuthorizedNavItems(mockOwner);
    const cashierNav = getAuthorizedNavItems(mockCashier);
    const kitchenNav = getAuthorizedNavItems(mockKitchen);

    const ownerNavNames = ownerNav.map((n) => n.name);
    const cashierNavNames = cashierNav.map((n) => n.name);
    const kitchenNavNames = kitchenNav.map((n) => n.name);

    expect(ownerNavNames).toContain("Dashboard");
    expect(ownerNavNames).toContain("Laporan & Finance");
    expect(ownerNavNames).not.toContain("Kitchen KDS");

    expect(cashierNavNames).toContain("POS Kasir");
    expect(cashierNavNames).not.toContain("AI Business Insight");
    expect(cashierNavNames).not.toContain("Laporan & Finance");

    expect(kitchenNavNames).toContain("Kitchen KDS");
    expect(kitchenNavNames).toContain("Pesanan");
    expect(kitchenNavNames).not.toContain("POS Kasir");
  });
});
