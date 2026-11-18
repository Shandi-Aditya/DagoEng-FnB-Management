import { BusinessModuleCode } from "@/types/auth";
import {
  applySubscriptionCommand,
  mutateConfigDomain,
  normalizeSubscriptionScopeKey,
  SEED_PLATFORM_PLANS,
  SEED_TENANT_ADDONS,
  subscriptionStorageMirror,
  subscriptionSyncClient,
} from "@/lib/sync-domains/config-spec";

export type PlanTier = "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
export type SubscriptionStatus = "ACTIVE" | "TRIAL" | "GRACE_PERIOD" | "EXPIRED";

export interface PlanConfig {
  id: string;
  name: string;
  code: PlanTier;
  tagline: string;
  monthlyPriceDisplay: string;
  annualPriceDisplay: string;
  maxOutlets: number | "UNLIMITED";
  maxTenants: number | "UNLIMITED";
  maxStaff: number | "UNLIMITED";
  includedModules: BusinessModuleCode[];
  features: string[];
  recommendedFor: string;
  isPopular?: boolean;
}

export interface OrgSubscriptionState {
  organizationId: string;
  organizationName: string;
  planTier: PlanTier;
  planName: string;
  status: SubscriptionStatus;
  statusLabel: string;
  billingCycle: "BULANAN" | "TAHUNAN";
  activeSince: string;
  nextRenewalDate: string;
  isSimulated: boolean;
  notes?: string;
}

export interface TenantAddonItem {
  id: string;
  code: string;
  name: string;
  categoryTag: string;
  description: string;
  monthlyPriceDisplay: string;
  status: "ACTIVE" | "INACTIVE";
  badgeLabel: string;
  badgeVariant: "addon" | "pro" | "enterprise";
  benefits: string[];
  targetTenantId?: string;
}

export const PLATFORM_PLANS: Record<PlanTier, PlanConfig> = SEED_PLATFORM_PLANS;

export const DEFAULT_TENANT_ADDONS: TenantAddonItem[] = SEED_TENANT_ADDONS;

export function getSimulatedOrgSubscription(): OrgSubscriptionState {
  return { ...subscriptionSyncClient.getSnapshot().orgSubscription };
}

export function setSimulatedOrgPlan(tier: PlanTier): OrgSubscriptionState {
  const command = {
    op: "SET_ORG_PLAN" as const,
    planTier: tier,
  };
  const next = mutateConfigDomain(
    subscriptionSyncClient,
    subscriptionStorageMirror,
    (prev) => applySubscriptionCommand(prev, command),
    {
      id: "subscription-org-plan",
      command,
    }
  );
  return { ...next.orgSubscription };
}

export function getSimulatedTenantAddons(scopeId?: string): TenantAddonItem[] {
  const scopeKey = normalizeSubscriptionScopeKey(scopeId);
  const snapshot = subscriptionSyncClient.getSnapshot();
  const list = snapshot.addonsByScope[scopeKey] ?? DEFAULT_TENANT_ADDONS;
  return list.map((a) => ({ ...a }));
}

export function toggleSimulatedTenantAddon(
  addonIdOrCode: string,
  scopeId?: string
): TenantAddonItem[] {
  const scopeKey = normalizeSubscriptionScopeKey(scopeId);
  const command = {
    op: "TOGGLE_ADDON" as const,
    scopeId: scopeKey,
    addonIdOrCode,
  };
  const next = mutateConfigDomain(
    subscriptionSyncClient,
    subscriptionStorageMirror,
    (prev) => applySubscriptionCommand(prev, command),
    {
      id: `subscription-addon-toggle-${scopeKey}-${addonIdOrCode}-${Date.now()}`,
      command,
    }
  );

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(
        new CustomEvent("subscription_state_updated", { detail: { scopeId } })
      );
    } catch {}
  }

  const updated = next.addonsByScope[scopeKey] ?? DEFAULT_TENANT_ADDONS;
  return updated.map((a) => ({ ...a }));
}

export function isAddonActive(addonCode: string, scopeId?: string): boolean {
  const addons = getSimulatedTenantAddons(scopeId);
  return addons.some(
    (a) => (a.code === addonCode || a.id === addonCode) && a.status === "ACTIVE"
  );
}
