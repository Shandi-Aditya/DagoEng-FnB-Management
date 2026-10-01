import { describe, it, expect } from "vitest";
import { assertOrganizationAccess } from "../src/lib/tenant";
import { AuthenticatedUser } from "../src/types/auth";

const userKopiSenja: AuthenticatedUser = {
  id: "user-ks-1",
  email: "owner@kopisenja.com",
  name: "I Wayan Pratama",
  phone: "+62 812-3456-7890",
  role: { id: "role-owner", slug: "OWNER", name: "Owner" },
  scopeLevel: "TENANT",
  allowedModules: ["FNB"],
  organization: { id: "org-kopi-senja", name: "Kopi Senja", code: "KOPI-SENJA" },
  tenant: { id: "tenant-ks", name: "Kopi Senja", code: "KOPI-SENJA", businessModule: "FNB" },
  outlet: null,
  permissions: ["dashboard:view"],
};

const userBaliBrew: AuthenticatedUser = {
  id: "user-bb-1",
  email: "manager@balibrew.com",
  name: "Nyoman Oka",
  phone: "+62 813-9876-5432",
  role: { id: "role-manager", slug: "MANAGER", name: "Manager" },
  scopeLevel: "OUTLET",
  allowedModules: ["FNB"],
  organization: { id: "org-bali-brew", name: "Bali Brew Demo", code: "BALI-BREW" },
  tenant: { id: "tenant-bb", name: "Bali Brew Demo", code: "BALI-BREW", businessModule: "FNB" },
  outlet: { id: "outlet-renon", name: "Renon", code: "BB-RNN" },
  permissions: ["dashboard:view", "pos:operate"],
};

const superAdmin: AuthenticatedUser = {
  id: "user-admin",
  email: "admin@dagoeng.com",
  name: "Platform Super Admin",
  phone: null,
  role: { id: "role-admin", slug: "SUPER_ADMIN", name: "Super Admin" },
  scopeLevel: "PLATFORM",
  allowedModules: ["CORE", "FNB", "CO_WORKING", "COMMERCIAL"],
  organization: null,
  tenant: null,
  outlet: null,
  permissions: ["*"],
};

describe("Multi-Tenant Organization Boundary Isolation", () => {
  it("allows user to access their own organization resources", () => {
    expect(() => assertOrganizationAccess(userKopiSenja, "org-kopi-senja")).not.toThrow();
    expect(() => assertOrganizationAccess(userBaliBrew, "org-bali-brew")).not.toThrow();
  });

  it("strictly prevents cross-tenant access between Kopi Senja and Bali Brew", () => {
    // User from Kopi Senja attempting to access Bali Brew
    expect(() => assertOrganizationAccess(userKopiSenja, "org-bali-brew")).toThrowError(
      /CROSS_TENANT_VIOLATION/
    );

    // User from Bali Brew attempting to access Kopi Senja
    expect(() => assertOrganizationAccess(userBaliBrew, "org-kopi-senja")).toThrowError(
      /CROSS_TENANT_VIOLATION/
    );
  });

  it("permits Super Admin global tenant traversal", () => {
    expect(() => assertOrganizationAccess(superAdmin, "org-kopi-senja")).not.toThrow();
    expect(() => assertOrganizationAccess(superAdmin, "org-bali-brew")).not.toThrow();
  });
});
