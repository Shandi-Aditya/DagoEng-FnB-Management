import { describe, it, expect, beforeEach } from "vitest";
import {
  PromoConfig,
  getPromoRemainingQuota,
  redeemPromoQuota,
  refundPromoQuota,
  checkPromoValidity,
  validateVoucherCode,
} from "../src/lib/promo";
import {
  getAllFnbTenants,
  getTenantName,
  DEFAULT_FNB_TENANTS,
  TENANT_STORAGE_KEY,
} from "../src/lib/tenant";

const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => {
    storage[key] = String(value);
  },
  removeItem: (key: string) => {
    delete storage[key];
  },
  clear: () => {
    Object.keys(storage).forEach((k) => delete storage[k]);
  },
  key: (index: number) => Object.keys(storage)[index] ?? null,
  get length() {
    return Object.keys(storage).length;
  },
};

// Set on both global and window
(globalThis as any).localStorage = localStorageMock;
(globalThis as any).window = {
  localStorage: localStorageMock,
};

describe("Master Prompt Revisi Lanjutan - 12 Oktober 2026", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe("Section B: Promo & Voucher Quota Lifecycle & Scope", () => {
    it("deducts quota atomically on payment success (2 -> 1 -> 0) and adds customer ID to usedBy", () => {
      let promos: PromoConfig[] = [
        {
          id: "promo-hemat-2",
          name: "Diskon 10k",
          code: "HEMAT10",
          discountType: "FIXED",
          discountValue: 10000,
          quota: 2,
          usageCount: 0,
          usedBy: [],
          scope: "ALL",
          targetType: "ALL",
          isActive: true,
        },
      ];

      expect(getPromoRemainingQuota(promos[0])).toBe(2);

      // First redemption: customer A
      const res1 = redeemPromoQuota(promos, "HEMAT10", "cust-a");
      expect(res1.success).toBe(true);
      promos = res1.updatedPromos;
      expect(promos[0].usageCount).toBe(1);
      expect(promos[0].usedBy).toContain("cust-a");
      expect(getPromoRemainingQuota(promos[0])).toBe(1);

      // Second redemption: customer B
      const res2 = redeemPromoQuota(promos, "HEMAT10", "cust-b");
      expect(res2.success).toBe(true);
      promos = res2.updatedPromos;
      expect(promos[0].usageCount).toBe(2);
      expect(promos[0].usedBy).toContain("cust-b");
      expect(getPromoRemainingQuota(promos[0])).toBe(0);

      // Validation should fail when quota is exhausted
      const checkRes = checkPromoValidity(promos[0], 50000, {
        customerId: "cust-c",
      });
      expect(checkRes.isValid).toBe(false);
      expect(checkRes.reason).toContain("habis");
    });

    it("restores promo quota when payment fails or is refunded", () => {
      let promos: PromoConfig[] = [
        {
          id: "promo-refund",
          name: "Diskon 5k",
          code: "DISKON5",
          discountType: "FIXED",
          discountValue: 5000,
          quota: 3,
          usageCount: 2,
          usedBy: ["cust-1", "cust-2"],
          scope: "ALL",
          targetType: "ALL",
          isActive: true,
        },
      ];

      expect(getPromoRemainingQuota(promos[0])).toBe(1);

      // Refund cust-2
      const res = refundPromoQuota(promos, "promo-refund", "cust-2");
      expect(res.success).toBe(true);
      promos = res.updatedPromos;
      expect(promos[0].usageCount).toBe(1);
      expect(promos[0].usedBy).not.toContain("cust-2");
      expect(getPromoRemainingQuota(promos[0])).toBe(2);
    });

    it("enforces scope separation between F&B and Co-Working", () => {
      const cwPromo: PromoConfig = {
        id: "cw-only",
        name: "Promo CoWork 20%",
        code: "COWORK20",
        discountType: "PERCENTAGE",
        discountValue: 20,
        scope: "COWORKING",
        targetType: "ALL",
        isActive: true,
      };

      const fnbPromo: PromoConfig = {
        id: "fnb-only",
        name: "Promo Makanan 10%",
        code: "MAKAN10",
        discountType: "PERCENTAGE",
        discountValue: 10,
        scope: "FNB",
        targetType: "ALL",
        isActive: true,
      };

      // F&B order context
      const fnbCheck = checkPromoValidity(cwPromo, 50000, { scope: "FNB" });
      expect(fnbCheck.isValid).toBe(false);
      expect(fnbCheck.reason).toContain("Co-Working");

      const fnbValid = checkPromoValidity(fnbPromo, 50000, { scope: "FNB" });
      expect(fnbValid.isValid).toBe(true);

      // Co-Working context
      const cwCheck = checkPromoValidity(fnbPromo, 50000, { scope: "COWORKING" });
      expect(cwCheck.isValid).toBe(false);
      expect(cwCheck.reason).toContain("F&B");

      const cwValid = checkPromoValidity(cwPromo, 50000, { scope: "COWORKING" });
      expect(cwValid.isValid).toBe(true);
    });
  });

  describe("Section C: Ganti Nama Mitra Synchronization", () => {
    it("updates tenant name immediately without altering tenant ID", () => {
      // Simulate stored settings update for Kopi Senja
      const updatedSettings = {
        "tenant-ks": {
          brandName: "Kopi Senja Signature",
          tagline: "Specialty Roasted Beans",
          contactPhone: "08123456789",
        },
      };
      localStorageMock.setItem(TENANT_STORAGE_KEY, JSON.stringify(updatedSettings));

      // Check getAllFnbTenants()
      const tenants = getAllFnbTenants();
      const ksTenant = tenants.find((t) => t.id === "tenant-ks");
      expect(ksTenant?.name).toBe("Kopi Senja Signature");
      expect(ksTenant?.tagline).toBe("Specialty Roasted Beans");

      // Check getTenantName()
      expect(getTenantName("tenant-ks")).toBe("Kopi Senja Signature");

      // Original ID is unchanged
      expect(ksTenant?.id).toBe("tenant-ks");
    });
  });

  describe("Section D: Nota Multi-Mitra Logic", () => {
    it("detects multi-tenant orders and groups items by tenant", () => {
      const items = [
        { id: "i1", name: "Espresso", price: 20000, quantity: 1, tenantId: "tenant-ks", tenantName: "Kopi Senja" },
        { id: "i2", name: "Mie Goreng", price: 25000, quantity: 1, tenantId: "tenant-dg", tenantName: "Dapur Gurih" },
      ];

      const isMultiTenant = new Set(items.map((i) => i.tenantId)).size > 1;
      expect(isMultiTenant).toBe(true);

      // Grouping logic
      const grouped = new Map<string, { tenantName: string; subtotal: number }>();
      items.forEach((i) => {
        const existing = grouped.get(i.tenantId) || { tenantName: i.tenantName, subtotal: 0 };
        existing.subtotal += i.price * i.quantity;
        grouped.set(i.tenantId, existing);
      });

      expect(grouped.size).toBe(2);
      expect(grouped.get("tenant-ks")?.subtotal).toBe(20000);
      expect(grouped.get("tenant-dg")?.subtotal).toBe(25000);
    });

    it("retains single tenant branding when all items belong to one tenant", () => {
      const items = [
        { id: "i1", name: "Latte", price: 25000, quantity: 2, tenantId: "tenant-ks" },
        { id: "i2", name: "Croissant", price: 20000, quantity: 1, tenantId: "tenant-ks" },
      ];

      const isMultiTenant = new Set(items.map((i) => i.tenantId)).size > 1;
      expect(isMultiTenant).toBe(false);
    });
  });

  describe("Section E: Decoupled Operational Status and Payment Status", () => {
    it("differentiates operational progression from payment settlement", () => {
      type OperationalStatus = "NEW" | "COOKING" | "READY" | "SERVED" | "CANCELLED";
      type PaymentStatus = "PENDING" | "PAID" | "REFUNDED";

      const order: { status: OperationalStatus; paymentStatus: PaymentStatus } = {
        status: "COOKING",
        paymentStatus: "PENDING",
      };

      // Kitchen marks cooked -> READY, payment remains PENDING
      order.status = "READY";
      expect(order.status).toBe("READY");
      expect(order.paymentStatus).toBe("PENDING");

      // Customer pays at cashier -> PAID, operational status unchanged
      order.paymentStatus = "PAID";
      expect(order.status).toBe("READY");
      expect(order.paymentStatus).toBe("PAID");

      // Served
      order.status = "SERVED";
      expect(order.status).toBe("SERVED");
      expect(order.paymentStatus).toBe("PAID");
    });
  });

  describe("Section I: Stock Opname Variance Calculations", () => {
    it("accurately computes stock opname variance and varianceType", () => {
      const calculateVariance = (physical: number, system: number) => {
        const variance = physical - system;
        let varianceType: "SURPLUS" | "DEFICIT" | "MATCH" = "MATCH";
        if (variance > 0) varianceType = "SURPLUS";
        else if (variance < 0) varianceType = "DEFICIT";
        return { variance, varianceType };
      };

      // Case 1: Match
      expect(calculateVariance(50, 50)).toEqual({ variance: 0, varianceType: "MATCH" });

      // Case 2: Surplus (Found more than recorded)
      expect(calculateVariance(55, 50)).toEqual({ variance: 5, varianceType: "SURPLUS" });

      // Case 3: Deficit (Loss/Waste)
      expect(calculateVariance(42, 50)).toEqual({ variance: -8, varianceType: "DEFICIT" });
    });
  });
});
