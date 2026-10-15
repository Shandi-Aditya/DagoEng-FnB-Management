import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORM_PLANS,
  DEFAULT_TENANT_ADDONS,
  getSimulatedOrgSubscription,
  setSimulatedOrgPlan,
  getSimulatedTenantAddons,
  toggleSimulatedTenantAddon,
} from "@/lib/subscription";

describe("Subscription Management & Simulated Plans", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
  });

  it("should have valid specifications for STARTER, PROFESSIONAL, and ENTERPRISE plans", () => {
    expect(PLATFORM_PLANS.STARTER).toBeDefined();
    expect(PLATFORM_PLANS.PROFESSIONAL).toBeDefined();
    expect(PLATFORM_PLANS.ENTERPRISE).toBeDefined();

    // Starter quota limits
    expect(PLATFORM_PLANS.STARTER.maxOutlets).toBe(1);
    expect(PLATFORM_PLANS.STARTER.maxTenants).toBe(1);
    expect(PLATFORM_PLANS.STARTER.maxStaff).toBe(5);

    // Professional quota limits
    expect(PLATFORM_PLANS.PROFESSIONAL.maxOutlets).toBe(3);
    expect(PLATFORM_PLANS.PROFESSIONAL.maxTenants).toBe(5);
    expect(PLATFORM_PLANS.PROFESSIONAL.maxStaff).toBe("UNLIMITED");

    // Enterprise quota limits
    expect(PLATFORM_PLANS.ENTERPRISE.maxOutlets).toBe("UNLIMITED");
    expect(PLATFORM_PLANS.ENTERPRISE.maxTenants).toBe("UNLIMITED");
    expect(PLATFORM_PLANS.ENTERPRISE.maxStaff).toBe("UNLIMITED");
  });

  it("should return default simulated subscription as PROFESSIONAL for Dago Creative Hub", () => {
    const sub = getSimulatedOrgSubscription();
    expect(sub.organizationName).toBe("Dago Creative Hub");
    expect(sub.planTier).toBe("PROFESSIONAL");
    expect(sub.status).toBe("ACTIVE");
    expect(sub.isSimulated).toBe(false);
  });

  it("should allow changing simulated plan tier to ENTERPRISE and persist", () => {
    const updated = setSimulatedOrgPlan("ENTERPRISE");
    expect(updated.planTier).toBe("ENTERPRISE");
    expect(updated.planName).toBe(PLATFORM_PLANS.ENTERPRISE.name);

    const reRead = getSimulatedOrgSubscription();
    expect(reRead.planTier).toBe("ENTERPRISE");
  });

  it("should allow switching back to PROFESSIONAL", () => {
    setSimulatedOrgPlan("STARTER");
    expect(getSimulatedOrgSubscription().planTier).toBe("STARTER");

    setSimulatedOrgPlan("PROFESSIONAL");
    expect(getSimulatedOrgSubscription().planTier).toBe("PROFESSIONAL");
  });

  it("should provide default simulated tenant addons", () => {
    const addons = getSimulatedTenantAddons();
    expect(addons.length).toBeGreaterThanOrEqual(4);
    const kds = addons.find((a) => a.code === "KDS_MULTI_STATION");
    expect(kds).toBeDefined();
    expect(kds?.status).toBe("ACTIVE");
  });

  it("should toggle simulated tenant addon status from ACTIVE to INACTIVE and back", () => {
    const initialAddons = getSimulatedTenantAddons();
    const firstAddonId = initialAddons[0].id;

    // Toggle to INACTIVE
    const updated = toggleSimulatedTenantAddon(firstAddonId);
    const toggledItem = updated.find((a) => a.id === firstAddonId);
    expect(toggledItem?.status).toBe("INACTIVE");

    // Toggle back to ACTIVE
    const reToggled = toggleSimulatedTenantAddon(firstAddonId);
    const reToggledItem = reToggled.find((a) => a.id === firstAddonId);
    expect(reToggledItem?.status).toBe("ACTIVE");
  });

  it("should isolate addon toggles between different tenants (scope isolation)", () => {
    const tenantA = "tenant-ks";
    const tenantB = "tenant-dm";

    const addonsA = getSimulatedTenantAddons(tenantA);
    const firstAddonId = addonsA[0].id;

    // Toggle tenant A's addon to INACTIVE
    toggleSimulatedTenantAddon(firstAddonId, tenantA);

    const checkA = getSimulatedTenantAddons(tenantA).find((a) => a.id === firstAddonId);
    const checkB = getSimulatedTenantAddons(tenantB).find((a) => a.id === firstAddonId);

    // Tenant A should be INACTIVE
    expect(checkA?.status).toBe("INACTIVE");
    // Tenant B should remain untouched / ACTIVE
    expect(checkB?.status).toBe("ACTIVE");
  });
});
