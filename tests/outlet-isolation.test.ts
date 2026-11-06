import { describe, it, expect } from "vitest";
import { assertOutletAccess } from "../src/lib/tenant";
import { AuthenticatedUser } from "../src/types/auth";

const ownerUser: AuthenticatedUser = {
  id: "user-owner",
  email: "owner@kopisenja.com",
  name: "I Wayan Pratama",
  phone: "+62 812-3456-7890",
  role: { id: "role-owner", slug: "OWNER", name: "Owner" },
  scopeLevel: "TENANT",
  allowedModules: ["FNB"],
  organization: { id: "org-ks", name: "Kopi Senja", code: "KOPI-SENJA" },
  tenant: { id: "tenant-ks", name: "Kopi Senja", code: "KOPI-SENJA", businessModule: "FNB" },
  outlet: null,
  permissions: ["dashboard:view", "dashboard:compare_outlets"],
};

const cashierSingaraja: AuthenticatedUser = {
  id: "user-cashier-sgr",
  email: "cashier.sgr@kopisenja.com",
  name: "Ni Kadek Sri",
  phone: "+62 812-3456-7891",
  role: { id: "role-cashier", slug: "CASHIER", name: "Cashier" },
  scopeLevel: "OUTLET",
  allowedModules: ["FNB"],
  organization: { id: "org-ks", name: "Kopi Senja", code: "KOPI-SENJA" },
  tenant: { id: "tenant-ks", name: "Kopi Senja", code: "KOPI-SENJA", businessModule: "FNB" },
  outlet: { id: "outlet-sgr", name: "Singaraja", code: "KS-SGR" },
  permissions: ["pos:operate", "orders:view"],
};

describe("Outlet Boundary Isolation & Context Rules", () => {
  it("allows Singaraja cashier to access Singaraja outlet context", () => {
    expect(() => assertOutletAccess(cashierSingaraja, "outlet-sgr", true)).not.toThrow();
  });

  it("strictly denies Singaraja cashier from accessing Denpasar transactions", () => {
    expect(() => assertOutletAccess(cashierSingaraja, "outlet-dps", true)).toThrowError(
      /OUTLET_ISOLATION_VIOLATION/
    );
  });

  it("rejects operational transactional mutations when context is 'ALL'", () => {
    // Attempting to run a POS transaction in 'ALL' outlets mode
    expect(() => assertOutletAccess(ownerUser, "ALL", true)).toThrowError(
      /INVALID_OPERATIONAL_CONTEXT/
    );
    expect(() => assertOutletAccess(ownerUser, null, true)).toThrowError(
      /INVALID_OPERATIONAL_CONTEXT/
    );
  });

  it("permits Owner to view 'ALL' outlets in read-only analytics mode", () => {
    expect(() => assertOutletAccess(ownerUser, "ALL", false)).not.toThrow();
    expect(() => assertOutletAccess(ownerUser, null, false)).not.toThrow();
    expect(() => assertOutletAccess(ownerUser, "outlet-sgr", false)).not.toThrow();
  });
});
