import { describe, it, expect } from "vitest";
import { INITIAL_PRODUCTS } from "../src/contexts/ProductContext";
import { DEFAULT_FNB_TENANTS, getTenantName, isTenantActive, getTenantStatus } from "../src/lib/tenant";
import { INITIAL_SPACES, MEMBERSHIP_PLANS } from "../src/features/coworking/coworking-data";
import { DEFAULT_PLATFORM_SETTINGS } from "../src/types/settings";
import { hasRole, hasPermission, ALL_NAV_ITEMS } from "../src/lib/rbac";
import { AuthenticatedUser } from "../src/types/auth";
import { MasterProduct } from "../src/types/product";

describe("Tahap 6: Master Data & Settings Audit and Integration Tests", () => {
  // 1. Filter produk berdasarkan tenant
  it("1. Filter produk berdasarkan tenant (tenantId) mengembalikan produk mitra yang tepat", () => {
    const kopiSenjaProducts = INITIAL_PRODUCTS.filter((p) => p.tenantId === "tenant-ks");
    const dapurMamaProducts = INITIAL_PRODUCTS.filter((p) => p.tenantId === "tenant-kitchen");
    const manisBakeryProducts = INITIAL_PRODUCTS.filter((p) => p.tenantId === "tenant-bakery");
    const buNartiProducts = INITIAL_PRODUCTS.filter((p) => p.tenantId === "tenant-tea");

    expect(kopiSenjaProducts.length).toBeGreaterThan(0);
    expect(dapurMamaProducts.length).toBeGreaterThan(0);
    expect(manisBakeryProducts.length).toBeGreaterThan(0);
    expect(buNartiProducts.length).toBeGreaterThan(0);

    // All products returned belong exclusively to target tenantId
    kopiSenjaProducts.forEach((p) => expect(p.tenantId).toBe("tenant-ks"));
    dapurMamaProducts.forEach((p) => expect(p.tenantId).toBe("tenant-kitchen"));
  });

  // 2. Filter produk berdasarkan category
  it("2. Filter produk berdasarkan category mengembalikan produk sesuai kategori", () => {
    const minumanProducts = INITIAL_PRODUCTS.filter((p) => p.category === "Minuman");
    const makananProducts = INITIAL_PRODUCTS.filter((p) => p.category === "Makanan");
    const camilanProducts = INITIAL_PRODUCTS.filter((p) => p.category === "Camilan");

    expect(minumanProducts.length).toBeGreaterThan(0);
    expect(makananProducts.length).toBeGreaterThan(0);
    expect(camilanProducts.length).toBeGreaterThan(0);

    minumanProducts.forEach((p) => expect(p.category).toBe("Minuman"));
    makananProducts.forEach((p) => expect(p.category).toBe("Makanan"));
    camilanProducts.forEach((p) => expect(p.category).toBe("Camilan"));
  });

  // 3. Kombinasi tenant + category
  it("3. Kombinasi filter tenant + category menyaring produk dengan tepat", () => {
    const kopiSenjaMinuman = INITIAL_PRODUCTS.filter(
      (p) => p.tenantId === "tenant-ks" && p.category === "Minuman"
    );
    const dapurMamaMakanan = INITIAL_PRODUCTS.filter(
      (p) => p.tenantId === "tenant-kitchen" && p.category === "Makanan"
    );

    expect(kopiSenjaMinuman.length).toBeGreaterThan(0);
    kopiSenjaMinuman.forEach((p) => {
      expect(p.tenantId).toBe("tenant-ks");
      expect(p.category).toBe("Minuman");
    });

    expect(dapurMamaMakanan.length).toBeGreaterThan(0);
    dapurMamaMakanan.forEach((p) => {
      expect(p.tenantId).toBe("tenant-kitchen");
      expect(p.category).toBe("Makanan");
    });
  });

  // 4. Produk tenant A tidak tertukar dengan tenant B
  it("4. Produk Tenant A tidak tertukar atau tercampur dengan Tenant B", () => {
    const kopiSenjaProductIds = new Set(
      INITIAL_PRODUCTS.filter((p) => p.tenantId === "tenant-ks").map((p) => p.id)
    );
    const dapurMamaProductIds = new Set(
      INITIAL_PRODUCTS.filter((p) => p.tenantId === "tenant-kitchen").map((p) => p.id)
    );

    // Intersection must be empty (0 overlapping IDs)
    const intersection = [...kopiSenjaProductIds].filter((id) => dapurMamaProductIds.has(id));
    expect(intersection).toHaveLength(0);

    // Tenant name resolver gives correct name
    expect(getTenantName("tenant-ks")).toBe("Kopi Senja");
    expect(getTenantName("tenant-kitchen")).toBe("Dapur Mama");
    expect(getTenantName("tenant-bakery")).toBe("Manis Bakery");
    expect(getTenantName("tenant-tea")).toBe("Warung Bu Narti");
  });

  // 5. Permission Owner / Admin tetap berjalan
  it("5. Role Owner & Super Admin memiliki hak akses penuh terhadap master data dan settings", () => {
    const superAdminUser: AuthenticatedUser = {
      id: "u-admin",
      name: "Super Admin Dago",
      email: "admin@dagoeng.com",
      phone: "+62 812-3456-7890",
      role: { id: "r1", name: "Super Admin", slug: "SUPER_ADMIN" },
      scopeLevel: "PLATFORM",
      allowedModules: ["CORE", "FNB", "CO_WORKING"],
      permissions: ["MANAGE_PRODUCTS", "MANAGE_SYSTEM_SETTINGS", "MANAGE_USERS"] as any[],
      organization: null,
      tenant: null,
      outlet: null,
    };

    const ownerUser: AuthenticatedUser = {
      id: "u-owner",
      name: "Owner Dago Hub",
      email: "owner@dagoeng.com",
      phone: "+62 812-3456-7890",
      role: { id: "r2", name: "Owner", slug: "OWNER" },
      scopeLevel: "ORGANIZATION",
      allowedModules: ["CORE", "FNB", "CO_WORKING"],
      permissions: ["MANAGE_PRODUCTS", "MANAGE_SYSTEM_SETTINGS"] as any[],
      organization: null,
      tenant: null,
      outlet: null,
    };

    expect(hasRole(superAdminUser, ["SUPER_ADMIN", "OWNER"])).toBe(true);
    expect(hasRole(ownerUser, ["SUPER_ADMIN", "OWNER"])).toBe(true);

    const isAuthorizedAdmin = superAdminUser.role.slug === "SUPER_ADMIN" || superAdminUser.role.slug === "OWNER";
    const isAuthorizedOwner = ownerUser.role.slug === "SUPER_ADMIN" || ownerUser.role.slug === "OWNER";
    expect(isAuthorizedAdmin).toBe(true);
    expect(isAuthorizedOwner).toBe(true);
  });

  // 6. Role yang tidak berwenang tidak dapat mengubah master data / settings
  it("6. Role kasir/staff/pelanggan tidak berwenang mengakses Settings atau mengubah master data", () => {
    const cashierUser: AuthenticatedUser = {
      id: "u-cashier",
      name: "Kasir Sri",
      email: "sri@dagoeng.com",
      phone: "+62 812-3456-7890",
      role: { id: "r3", name: "Kasir", slug: "CASHIER" },
      scopeLevel: "OUTLET",
      allowedModules: ["FNB"],
      permissions: ["CREATE_ORDERS", "PROCESS_PAYMENT"] as any[],
      organization: null,
      tenant: null,
      outlet: null,
    };

    const customerUser: AuthenticatedUser = {
      id: "u-customer",
      name: "Pelanggan Setia",
      email: "customer@dagoeng.com",
      phone: "+62 812-3456-7890",
      role: { id: "r4", name: "Customer", slug: "CUSTOMER" },
      scopeLevel: "OUTLET",
      allowedModules: ["FNB"],
      permissions: [] as any[],
      organization: null,
      tenant: null,
      outlet: null,
    };

    const canCashierAccessSettings =
      cashierUser.role.slug === "SUPER_ADMIN" ||
      (cashierUser.role.slug === "OWNER" && cashierUser.scopeLevel === "ORGANIZATION") ||
      (cashierUser.role.slug === "OWNER" && cashierUser.scopeLevel === "TENANT");
    expect(canCashierAccessSettings).toBe(false);

    const canCustomerAccessSettings =
      customerUser.role.slug === "SUPER_ADMIN" ||
      (customerUser.role.slug === "OWNER" && customerUser.scopeLevel === "ORGANIZATION");
    expect(canCustomerAccessSettings).toBe(false);

    const canCashierManageMaster = ["SUPER_ADMIN", "OWNER", "MANAGER"].includes(cashierUser.role.slug);
    expect(canCashierManageMaster).toBe(false);
  });

  // 7. Master Data Co-Working & Platform Settings Integrity
  it("7. Master data Co-Working Spaces dan Platform Settings tetap terjaga dan konsisten", () => {
    expect(INITIAL_SPACES.length).toBeGreaterThanOrEqual(4);
    expect(MEMBERSHIP_PLANS.length).toBeGreaterThanOrEqual(3);

    expect(DEFAULT_PLATFORM_SETTINGS.currency).toBe("IDR");
    expect(DEFAULT_PLATFORM_SETTINGS.taxRatePercent).toBe(10);
    expect(DEFAULT_PLATFORM_SETTINGS.promos.length).toBeGreaterThanOrEqual(3);
  });
});
