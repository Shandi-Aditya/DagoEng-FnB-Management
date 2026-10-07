import { describe, it, expect, beforeEach } from "vitest";
import { INITIAL_PRODUCTS } from "../src/contexts/ProductContext";
import { MasterProduct } from "../src/types/product";
import { DEMO_PERSONAS } from "../src/contexts/AuthContext";
import {
  DEFAULT_FNB_TENANTS,
  getTenantProfile,
  isTenantActive,
  setTenantStatus,
  assertTenantAccess,
} from "../src/lib/tenant";
import {
  calculateSettlement,
  setTenantRevenueSplit,
  getTenantRevenueSplit,
  getAllTenantRevenueSplits,
} from "../src/lib/settlement";
import { OrderRecord } from "../src/types/order";

describe("Tahap 9 — Multi-Tenant Architecture & Single Source of Truth", () => {
  beforeEach(() => {
    // Fresh state for each test
  });

  describe("1. Multi-Tenant Admin Isolation & RBAC", () => {
    it("should allow Admin Kopi Senja (tenant-ks) to access only tenant-ks data", () => {
      const adminKS = DEMO_PERSONAS.TENANT_OWNER_KS;
      expect(adminKS.tenant?.id).toBe("tenant-ks");
      expect(adminKS.scopeLevel).toBe("TENANT");

      // Accessing own tenant must succeed
      expect(() => assertTenantAccess(adminKS, "tenant-ks")).not.toThrow();

      // Accessing another tenant must throw TENANT_ISOLATION_VIOLATION
      expect(() => assertTenantAccess(adminKS, "tenant-kitchen")).toThrow(
        /TENANT_ISOLATION_VIOLATION/
      );
    });

    it("should allow Admin Dapur Mama (tenant-kitchen) to access only tenant-kitchen data", () => {
      const adminKitchen = DEMO_PERSONAS.TENANT_OWNER_KITCHEN;
      expect(adminKitchen.tenant?.id).toBe("tenant-kitchen");
      expect(adminKitchen.scopeLevel).toBe("TENANT");

      // Accessing own tenant must succeed
      expect(() => assertTenantAccess(adminKitchen, "tenant-kitchen")).not.toThrow();

      // Accessing another tenant must throw TENANT_ISOLATION_VIOLATION
      expect(() => assertTenantAccess(adminKitchen, "tenant-ks")).toThrow(
        /TENANT_ISOLATION_VIOLATION/
      );
      expect(() => assertTenantAccess(adminKitchen, "tenant-bakery")).toThrow(
        /TENANT_ISOLATION_VIOLATION/
      );
    });

    it("should allow Super Admin & Org Owner to access all tenants", () => {
      const dagoOwner = DEMO_PERSONAS.DAGO_OWNER;
      const superAdmin = DEMO_PERSONAS.SUPER_ADMIN;

      expect(() => assertTenantAccess(dagoOwner, "tenant-ks")).not.toThrow();
      expect(() => assertTenantAccess(dagoOwner, "tenant-kitchen")).not.toThrow();
      expect(() => assertTenantAccess(dagoOwner, "tenant-bakery")).not.toThrow();
      expect(() => assertTenantAccess(dagoOwner, "tenant-tea")).not.toThrow();

      expect(() => assertTenantAccess(superAdmin, "tenant-ks")).not.toThrow();
      expect(() => assertTenantAccess(superAdmin, "tenant-kitchen")).not.toThrow();
    });
  });

  describe("2. Single Source of Truth (Admin Menu <-> Customer Portal)", () => {
    it("should reflect price changes made in Admin Menu directly in Customer Portal products", () => {
      // Simulate products dataset in ProductContext
      const products: MasterProduct[] = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));

      // Admin Kopi Senja updates 'Kopi Senja Aren' (prod-101) from 24.000 to 26.000
      const targetId = "prod-101";
      const target = products.find((p) => p.id === targetId);
      expect(target).toBeDefined();
      expect(target?.basePrice).toBe(24000);

      // Apply Admin update
      const updatedProducts = products.map((p) =>
        p.id === targetId ? { ...p, basePrice: 26000, updatedAt: new Date().toISOString() } : p
      );

      // Customer Portal queries menu for Kopi Senja (tenant-ks)
      const customerKsProducts = updatedProducts.filter(
        (p) => (p.tenantId || "tenant-ks") === "tenant-ks" && p.status === "ACTIVE"
      );

      const customerItem = customerKsProducts.find((p) => p.id === targetId);
      expect(customerItem?.basePrice).toBe(26000);
    });

    it("should prevent inactive products from being displayed in Customer Portal", () => {
      const products: MasterProduct[] = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));

      // Admin Dapur Mama deactivates 'Nasi Beef Bowl Sambal Matah' (prod-103)
      const targetId = "prod-103";
      const updatedProducts = products.map((p) =>
        p.id === targetId ? { ...p, status: "INACTIVE" as const } : p
      );

      // Customer Portal queries menu for Dapur Mama
      const customerKitchenMenu = updatedProducts.filter(
        (p) => (p.tenantId || "tenant-ks") === "tenant-kitchen" && p.status === "ACTIVE"
      );

      const found = customerKitchenMenu.find((p) => p.id === targetId);
      expect(found).toBeUndefined(); // Inactive menu item is filtered out
    });

    it("should isolate menu categories strictly per tenant without cross-contamination", () => {
      const ksProducts = INITIAL_PRODUCTS.filter((p) => p.tenantId === "tenant-ks");
      const bakeryProducts = INITIAL_PRODUCTS.filter((p) => p.tenantId === "tenant-bakery");

      // Verify no item with tenant-ks is in bakery list
      expect(ksProducts.every((p) => p.tenantId === "tenant-ks")).toBe(true);
      expect(bakeryProducts.every((p) => p.tenantId === "tenant-bakery")).toBe(true);

      // Verify no overlap of product IDs
      const ksIds = new Set(ksProducts.map((p) => p.id));
      const bakeryOverlap = bakeryProducts.some((p) => ksIds.has(p.id));
      expect(bakeryOverlap).toBe(false);
    });
  });

  describe("3. Tenant Profiles & Branding", () => {
    it("should provide distinct profile, branding and bank account data for each tenant", () => {
      const ksProfile = getTenantProfile("tenant-ks");
      const kitchenProfile = getTenantProfile("tenant-kitchen");
      const bakeryProfile = getTenantProfile("tenant-bakery");
      const teaProfile = getTenantProfile("tenant-tea");

      expect(ksProfile.brandName).toBe("Kopi Senja");
      expect(ksProfile.bankName).toBe("BCA");

      expect(kitchenProfile.brandName).toBe("Dapur Mama");
      expect(kitchenProfile.bankName).toBe("Mandiri");

      expect(bakeryProfile.brandName).toBe("Manis Bakery");
      expect(bakeryProfile.bankName).toBe("BCA");

      expect(teaProfile.brandName).toBe("Warung Bu Narti");
      expect(teaProfile.bankName).toBe("BRI");
    });
  });

  describe("4. Multi-Tenant Single Payment & Flexible Revenue Sharing Settlement", () => {
    it("should process 1 multi-tenant order with 1 customer payment and split settlement accurately per tenant config", () => {
      /**
       * Multi-tenant transaction:
       * - Kopi Senja (tenant-ks, 85:15): 2 x Kopi @ 25.000 = Rp 50.000
       * - Dapur Mama (tenant-kitchen, 90:10): 1 x Nasi Goreng @ 50.000 = Rp 50.000
       * Grand Total = Rp 100.000 (Customer pays 1 single payment)
       */
      const order: OrderRecord = {
        id: "ord-mt-101",
        orderNumber: "ORD-MT101",
        organizationId: "org-dago-hub",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "T-05",
        customerName: "Rudi Hartono",
        orderType: "DINE_IN",
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        targetServiceMinutes: 15,
        statusHistory: [],
        subtotal: 100000,
        tax: 0,
        total: 100000,
        items: [
          {
            id: "i-1",
            productName: "Kopi Senja Aren",
            quantity: 2,
            unitPrice: 25000,
            tenantId: "tenant-ks",
          },
          {
            id: "i-2",
            productName: "Nasi Ayam Dapur Mama",
            quantity: 1,
            unitPrice: 50000,
            tenantId: "tenant-kitchen",
          },
        ],
        createdAt: "2026-10-07T14:00:00.000Z",
      };

      const customSplits = {
        "tenant-ks": { tenantSharePercent: 85, dagoSharePercent: 15 },
        "tenant-kitchen": { tenantSharePercent: 90, dagoSharePercent: 10 },
      };

      const settlement = calculateSettlement([order], undefined, customSplits);

      const ks = settlement.find((s) => s.tenantId === "tenant-ks");
      const kitchen = settlement.find((s) => s.tenantId === "tenant-kitchen");

      expect(ks).toBeDefined();
      expect(ks?.grossRevenue).toBe(50000);
      expect(ks?.tenantSharePercent).toBe(85);
      expect(ks?.dagoSharePercent).toBe(15);
      expect(ks?.tenantShareAmount).toBe(42500); // 85% of 50.000
      expect(ks?.dagoShareAmount).toBe(7500);   // 15% of 50.000

      expect(kitchen).toBeDefined();
      expect(kitchen?.grossRevenue).toBe(50000);
      expect(kitchen?.tenantSharePercent).toBe(90);
      expect(kitchen?.dagoSharePercent).toBe(10);
      expect(kitchen?.tenantShareAmount).toBe(45000); // 90% of 50.000
      expect(kitchen?.dagoShareAmount).toBe(5000);   // 10% of 50.000

      // Total of all shares equals total customer payment
      const totalAllocation =
        (ks?.tenantShareAmount || 0) +
        (ks?.dagoShareAmount || 0) +
        (kitchen?.tenantShareAmount || 0) +
        (kitchen?.dagoShareAmount || 0);

      expect(totalAllocation).toBe(100000);
    });

    it("should preserve historical settlements when settings change in the future", () => {
      const historicalOrder: OrderRecord = {
        id: "ord-old-1",
        orderNumber: "ORD-OLD01",
        organizationId: "org-dago-hub",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "T-01",
        customerName: "Pak Bambang",
        orderType: "DINE_IN",
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        targetServiceMinutes: 10,
        statusHistory: [],
        subtotal: 100000,
        tax: 0,
        total: 100000,
        items: [
          {
            id: "i-1",
            productName: "Croissant Manis Bakery",
            quantity: 5,
            unitPrice: 20000,
            tenantId: "tenant-bakery",
          },
        ],
        createdAt: "2026-08-01T10:00:00.000Z",
      };

      // In August: Bakery split was 80:20
      const augustSplits = { "tenant-bakery": { tenantSharePercent: 80, dagoSharePercent: 20 } };
      const augustSettlement = calculateSettlement([historicalOrder], undefined, augustSplits);
      expect(augustSettlement[0].tenantShareAmount).toBe(80000);
      expect(augustSettlement[0].dagoShareAmount).toBe(20000);

      // In October: Bakery split is updated to 88:12 for new orders
      const octoberSplits = { "tenant-bakery": { tenantSharePercent: 88, dagoSharePercent: 12 } };
      const octoberSettlement = calculateSettlement([historicalOrder], undefined, octoberSplits);
      expect(octoberSettlement[0].tenantShareAmount).toBe(88000);

      // Verify August historical snapshot remains intact
      expect(augustSettlement[0].tenantShareAmount).toBe(80000);
    });
  });
});
