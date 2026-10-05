import { describe, it, expect } from "vitest";
import { hasModuleAccess, getAuthorizedNavItems } from "../src/lib/rbac";
import {
  assertOrganizationAccess,
  assertTenantAccess,
  assertOutletAccess,
  assertModuleActive,
  getScopedDataFilter,
} from "../src/lib/tenant";
import { AuthenticatedUser, BusinessModuleCode } from "../src/types/auth";

// 1. Dago Organization Owner Persona
const dagoOwner: AuthenticatedUser = {
  id: "user-dago-owner",
  email: "owner.dago@dagoeng.com",
  name: "Hendra Wijaya",
  phone: "+62 811-2233-4455",
  role: { id: "role-owner", slug: "OWNER", name: "Owner" },
  scopeLevel: "ORGANIZATION",
  allowedModules: ["FNB", "CO_WORKING", "COMMERCIAL"],
  organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
  tenant: null,
  outlet: null,
  permissions: ["dashboard:view", "reports:view"],
};

// 2. F&B Tenant Owner Persona (Kopi Senja)
const kopiSenjaOwner: AuthenticatedUser = {
  id: "user-owner-ks",
  email: "owner.kopisenja@dagoeng.com",
  name: "I Wayan Pratama",
  phone: "+62 812-3456-7890",
  role: { id: "role-owner", slug: "OWNER", name: "Owner" },
  scopeLevel: "TENANT",
  allowedModules: ["FNB"],
  organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
  tenant: { id: "tenant-ks", name: "Kopi Senja", code: "KOPI-SENJA", businessModule: "FNB" },
  outlet: null,
  permissions: ["dashboard:view", "reports:view"],
};

// 3. F&B Cashier Singaraja Persona
const cashierSingaraja: AuthenticatedUser = {
  id: "user-cashier-sgr",
  email: "cashier.sgr@kopisenja.com",
  name: "Ni Kadek Sri",
  phone: "+62 812-3456-7892",
  role: { id: "role-cashier", slug: "CASHIER", name: "Cashier" },
  scopeLevel: "OUTLET",
  allowedModules: ["FNB"],
  organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
  tenant: { id: "tenant-ks", name: "Kopi Senja", code: "KOPI-SENJA", businessModule: "FNB" },
  outlet: { id: "outlet-sgr", name: "Singaraja", code: "KS-SGR" },
  permissions: ["pos:operate", "orders:view"],
};

describe("Multi-Business & 3-Dimensional Authorization (Role + Scope + Module)", () => {
  const activeModules: BusinessModuleCode[] = ["CORE", "FNB", "CO_WORKING"]; // Commercial is INACTIVE

  it("permits Dago Org Owner access to all active business modules", () => {
    expect(hasModuleAccess(dagoOwner, "FNB", activeModules)).toBe(true);
    expect(hasModuleAccess(dagoOwner, "CO_WORKING", activeModules)).toBe(true);
    // Commercial is inactive in activeModules
    expect(hasModuleAccess(dagoOwner, "COMMERCIAL", activeModules)).toBe(false);
  });

  it("strictly restricts F&B Tenant Owner to FNB module only", () => {
    expect(hasModuleAccess(kopiSenjaOwner, "FNB", activeModules)).toBe(true);
    expect(hasModuleAccess(kopiSenjaOwner, "CO_WORKING", activeModules)).toBe(false);
    expect(hasModuleAccess(kopiSenjaOwner, "COMMERCIAL", activeModules)).toBe(false);
  });

  it("enforces tenant boundary isolation for Tenant Owner", () => {
    // Kopi Senja owner accessing own tenant
    expect(() => assertTenantAccess(kopiSenjaOwner, "tenant-ks")).not.toThrow();

    // Kopi Senja owner attempting to access Artisan Bistro tenant
    expect(() => assertTenantAccess(kopiSenjaOwner, "tenant-artisan-bistro")).toThrowError(
      /TENANT_ISOLATION_VIOLATION/
    );

    // Dago Org Owner can access any tenant under the organization
    expect(() => assertTenantAccess(dagoOwner, "tenant-ks")).not.toThrow();
    expect(() => assertTenantAccess(dagoOwner, "tenant-artisan-bistro")).not.toThrow();
  });

  it("blocks route & API access when a business module is INACTIVE", () => {
    // FNB is active
    expect(() => assertModuleActive("FNB", activeModules)).not.toThrow();

    // COMMERCIAL is inactive
    expect(() => assertModuleActive("COMMERCIAL", activeModules)).toThrowError(
      /MODULE_DISABLED/
    );

    // When COMMERCIAL is enabled in activeModules
    const withCommercial: BusinessModuleCode[] = ["CORE", "FNB", "CO_WORKING", "COMMERCIAL"];
    expect(() => assertModuleActive("COMMERCIAL", withCommercial)).not.toThrow();
  });

  it("generates correct scoped reporting database filters", () => {
    // 1. Dago Org Owner filter
    const dagoFilter = getScopedDataFilter(dagoOwner, "FNB");
    expect(dagoFilter.organizationId).toBe("org-dago-hub");
    expect(dagoFilter.tenantId).toBeUndefined(); // Consolidated across all tenants

    // 2. Kopi Senja Tenant Owner filter
    const tenantFilter = getScopedDataFilter(kopiSenjaOwner, "FNB");
    expect(tenantFilter.organizationId).toBe("org-dago-hub");
    expect(tenantFilter.tenantId).toBe("tenant-ks"); // Strictly isolated to Kopi Senja

    // 3. Singaraja Cashier filter
    const cashierFilter = getScopedDataFilter(cashierSingaraja, "FNB");
    expect(cashierFilter.outletId).toBe("outlet-sgr");
  });

  it("filters dynamic navigation items according to user Role, Scope, and active modules", () => {
    const dagoNav = getAuthorizedNavItems(dagoOwner, activeModules);
    const tenantNav = getAuthorizedNavItems(kopiSenjaOwner, activeModules);

    const dagoNavNames = dagoNav.map((n) => n.name);
    const tenantNavNames = tenantNav.map((n) => n.name);

    // Dago Owner sees both F&B, Co-working, and Organization-level Settings
    expect(dagoNavNames).toContain("Dashboard");
    expect(dagoNavNames).toContain("POS Kasir");
    expect(dagoNavNames).toContain("Co-working Space");
    expect(dagoNavNames).toContain("Pengaturan Platform");
    expect(dagoNavNames).not.toContain("Commercial Leases"); // Commercial is inactive

    // Tenant Owner sees F&B items only, sees Tenant Settings (Pengaturan Mitra), and CANNOT see Organization-level Settings (Pengaturan Platform)
    expect(tenantNavNames).toContain("POS Kasir");
    expect(tenantNavNames).toContain("Smart Inventory");
    expect(tenantNavNames).toContain("Pengaturan Mitra");
    expect(tenantNavNames).not.toContain("Co-working Space");
    expect(tenantNavNames).not.toContain("Commercial Leases");
    expect(tenantNavNames).not.toContain("Pengaturan Platform");
  });
});
