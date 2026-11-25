import { AuthenticatedUser, BusinessModuleCode } from "@/types/auth";
import type { TenantStatus, TenantPartnerType } from "@/lib/domain-sync-types";
import {
  applyTenantsCommand,
  buildTenantProfileWithDefaults,
  mutateConfigDomain,
  SEED_FNB_TENANTS,
  SEED_TENANT_PROFILES,
  STORAGE_KEY_TENANT_SETTINGS,
  tenantsStorageMirror,
  tenantsSyncClient,
} from "@/lib/sync-domains/config-spec";

export function assertOrganizationAccess(
  user: AuthenticatedUser | null,
  targetOrganizationId: string
): void {
  if (!user) throw new Error("UNAUTHENTICATED");
  if (user.role.slug === "SUPER_ADMIN") return;

  if (user.organization?.id !== targetOrganizationId) {
    throw new Error(
      `CROSS_TENANT_VIOLATION: User belongs to org [${user.organization?.name}], cannot access target org [${targetOrganizationId}].`
    );
  }
}

export function assertModuleActive(
  moduleCode: BusinessModuleCode,
  activeOrgModules: BusinessModuleCode[] = ["CORE", "FNB", "CO_WORKING"]
): void {
  if (moduleCode === "CORE") return;
  if (!activeOrgModules.includes(moduleCode)) {
    throw new Error(
      `MODULE_DISABLED: Business module [${moduleCode}] is currently inactive in this organization.`
    );
  }
}

export function assertTenantAccess(
  user: AuthenticatedUser | null,
  targetTenantId?: string | null
): void {
  if (!user) throw new Error("UNAUTHENTICATED");
  if (user.role.slug === "SUPER_ADMIN") return;
  if (user.scopeLevel === "ORGANIZATION") return;

  if (user.scopeLevel === "TENANT" || user.scopeLevel === "OUTLET") {
    if (targetTenantId && user.tenant && user.tenant.id !== targetTenantId) {
      throw new Error(
        `TENANT_ISOLATION_VIOLATION: User belongs to tenant [${user.tenant.name}], cannot access target tenant [${targetTenantId}].`
      );
    }
  }
}

export function assertOutletAccess(
  user: AuthenticatedUser | null,
  targetOutletId: string | null,
  isOperationalAction: boolean = false
): void {
  if (!user) throw new Error("UNAUTHENTICATED");
  if (user.role.slug === "SUPER_ADMIN") return;

  if (isOperationalAction && (!targetOutletId || targetOutletId === "ALL")) {
    throw new Error(
      "INVALID_OPERATIONAL_CONTEXT: Operational transactions require an explicit Single Outlet context."
    );
  }

  if (user.role.slug === "OWNER" && !isOperationalAction) {
    return;
  }

  if (user.outlet && targetOutletId && user.outlet.id !== targetOutletId) {
    throw new Error(
      `OUTLET_ISOLATION_VIOLATION: User is assigned to outlet [${user.outlet.name}], cannot access outlet [${targetOutletId}].`
    );
  }
}

export function getScopedDataFilter(
  user: AuthenticatedUser,
  requestedModule: BusinessModuleCode
) {
  if (user.scopeLevel === "ORGANIZATION") {
    return {
      organizationId: user.organization?.id,
      module: requestedModule,
      tenantId: undefined,
      outletId: undefined,
    };
  }

  if (user.scopeLevel === "TENANT") {
    return {
      organizationId: user.organization?.id,
      module: user.tenant?.businessModule || requestedModule,
      tenantId: user.tenant?.id,
      outletId: undefined,
    };
  }

  return {
    organizationId: user.organization?.id,
    module: requestedModule,
    tenantId: user.tenant?.id,
    outletId: user.outlet?.id,
  };
}

export const TENANT_STORAGE_KEY = STORAGE_KEY_TENANT_SETTINGS;

export interface FnbPartnerInfo {
  id: string;
  code: string;
  name: string;
  badge: string;
  icon: string;
  tagline: string;
  desc: string;
}

export const DEFAULT_FNB_TENANTS: FnbPartnerInfo[] = SEED_FNB_TENANTS;

export type { TenantStatus, TenantPartnerType } from "@/lib/domain-sync-types";

export interface TenantProfileData {
  tenantId: string;
  brandName: string;
  tagline: string;
  description: string;
  contactPhone: string;
  contactPerson?: string; // PIC
  contactEmail?: string;
  npwp?: string;
  receiptHeader: string;
  receiptFooter: string;
  lowStockThresholdPercent: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  status: TenantStatus;
  partnerType?: TenantPartnerType; // "INTERNAL" | "EXTERNAL"
  contractStartDate?: string;
  contractEndDate?: string;
  contractPksNumber?: string;
  contractPksFile?: string;
  lastSettlementDepositDate?: string;
  suspendedReason?: string;
}

export const DEFAULT_TENANT_PROFILES: Record<string, Partial<TenantProfileData>> =
  SEED_TENANT_PROFILES;

export function getTenantProfile(tenantId: string): TenantProfileData {
  const snapshot = tenantsSyncClient.getSnapshot();
  return buildTenantProfileWithDefaults(
    tenantId,
    snapshot.profiles[tenantId] ?? null,
    snapshot.customTenants
  );
}

export function saveTenantProfile(profile: TenantProfileData): TenantProfileData {
  const snapshot = tenantsSyncClient.getSnapshot();
  const normalized = buildTenantProfileWithDefaults(
    profile.tenantId,
    profile,
    snapshot.customTenants
  );
  const command = {
    op: "UPSERT_PROFILE" as const,
    profile: normalized,
  };
  const next = mutateConfigDomain(
    tenantsSyncClient,
    tenantsStorageMirror,
    (prev) => applyTenantsCommand(prev, command),
    {
      id: `tenant-profile-${normalized.tenantId}`,
      command,
    }
  );
  return next.profiles[normalized.tenantId] ?? normalized;
}

export function getCustomTenants(): FnbPartnerInfo[] {
  return tenantsSyncClient.getSnapshot().customTenants.map((t) => ({ ...t }));
}

export function saveCustomTenant(tenant: FnbPartnerInfo): void {
  const command = {
    op: "UPSERT_CUSTOM_TENANT" as const,
    tenant: { ...tenant },
  };
  mutateConfigDomain(
    tenantsSyncClient,
    tenantsStorageMirror,
    (prev) => applyTenantsCommand(prev, command),
    {
      id: `tenant-custom-${tenant.id}`,
      command,
    }
  );
}

export function getAllFnbTenants(): FnbPartnerInfo[] {
  const snapshot = tenantsSyncClient.getSnapshot();
  const map = new Map<string, FnbPartnerInfo>();
  DEFAULT_FNB_TENANTS.forEach((t) => map.set(t.id, { ...t }));
  snapshot.customTenants.forEach((t) => map.set(t.id, { ...t }));

  const stored = snapshot.profiles;
  map.forEach((tenant, id) => {
    if (stored[id]?.brandName) {
      tenant.name = stored[id].brandName;
    }
    if (stored[id]?.tagline) {
      tenant.tagline = stored[id].tagline;
    }
    if (stored[id]?.description) {
      tenant.desc = stored[id].description;
    }
  });

  return Array.from(map.values());
}

export function getTenantName(tenantId?: string): string | undefined {
  if (!tenantId) return undefined;
  const stored = getAllStoredTenantSettings();
  if (stored[tenantId]?.brandName) {
    return stored[tenantId].brandName;
  }
  const all = getAllFnbTenants();
  const match = all.find((t) => t.id === tenantId);
  return match ? match.name : tenantId;
}

export function getAllStoredTenantSettings(): Record<string, TenantProfileData> {
  const profiles = tenantsSyncClient.getSnapshot().profiles;
  const copy: Record<string, TenantProfileData> = {};
  for (const [key, val] of Object.entries(profiles)) {
    copy[key] = { ...val };
  }
  return copy;
}

export function getTenantStatus(tenantId: string): TenantStatus {
  const tenantData = tenantsSyncClient.getSnapshot().profiles[tenantId];
  if (tenantData && tenantData.status) {
    if (tenantData.status === "SUSPENDED") return "SUSPENDED";
    if (tenantData.status === "INACTIVE") return "INACTIVE";
    return "ACTIVE";
  }
  return "ACTIVE";
}

export function isTenantActive(tenantId: string): boolean {
  return getTenantStatus(tenantId) === "ACTIVE";
}

export function isTenantSuspended(tenantId: string): boolean {
  return getTenantStatus(tenantId) === "SUSPENDED";
}

export function setTenantStatus(tenantId: string, status: TenantStatus, reason?: string): void {
  const command = {
    op: "SET_TENANT_STATUS" as const,
    tenantId,
    status,
    reason,
  };
  mutateConfigDomain(
    tenantsSyncClient,
    tenantsStorageMirror,
    (prev) => applyTenantsCommand(prev, command),
    {
      id: `tenant-status-${tenantId}`,
      command,
    }
  );
}

export function getWitaDateKey(referenceDate: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(referenceDate);
}

export function recordTenantSettlementDeposit(
  tenantId: string,
  depositDate: string = getWitaDateKey()
): void {
  const existing = getTenantProfile(tenantId);
  saveTenantProfile({
    ...existing,
    tenantId,
    status: "ACTIVE",
    suspendedReason: undefined,
    lastSettlementDepositDate: depositDate,
  });
}

/**
 * Checks whether a tenant must be automatically suspended due to overdue settlement deposit (> 14 days / 2 weeks).
 */
export function checkTenantAutoSuspension(
  profile: TenantProfileData,
  referenceDate: Date = new Date()
): { shouldSuspend: boolean; reason?: string } {
  if (
    profile.status === "INACTIVE" ||
    profile.status === "SUSPENDED" ||
    profile.partnerType === "INTERNAL"
  ) {
    return { shouldSuspend: false };
  }

  if (profile.lastSettlementDepositDate) {
    const rawDate = profile.lastSettlementDepositDate.trim();
    let depositKey: string | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      depositKey = rawDate;
    } else {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) {
        depositKey = getWitaDateKey(parsed);
      }
    }
    if (depositKey) {
      const todayKey = getWitaDateKey(referenceDate);
      const diffDays = Math.floor(
        (Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${depositKey}T00:00:00Z`)) /
          (1000 * 60 * 60 * 24)
      );
      if (diffDays > 14) {
        return {
          shouldSuspend: true,
          reason: `Otomatis ditangguhkan: Setoran telat lebih dari 2 minggu (${diffDays} hari).`,
        };
      }
    }
  }

  return { shouldSuspend: false };
}
