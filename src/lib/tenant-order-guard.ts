import { normalizeTenantId } from "@/lib/tax-breakdown";
import type { TenantProfileData, TenantStatus } from "@/lib/tenant";

export interface TenantOrderGuardItem {
  tenantId?: string;
  itemType?: string;
  productName?: string;
}

export type TenantOrderGuardResult =
  | { blocked: false }
  | {
      blocked: true;
      tenantId: string;
      status: Extract<TenantStatus, "SUSPENDED" | "INACTIVE">;
      brandName: string;
      reason?: string;
    };

/**
 * Checks whether any F&B item in an order belongs to a SUSPENDED or INACTIVE partner.
 */
export function findBlockedOrderTenant(
  items: readonly TenantOrderGuardItem[],
  profiles: Record<string, Partial<TenantProfileData> | undefined>,
  fallbackTenantId?: string
): TenantOrderGuardResult {
  const seen = new Set<string>();
  for (const item of items) {
    if (item.itemType === "COWORKING") continue;
    const tid = normalizeTenantId(item.tenantId || fallbackTenantId || "tenant-ks") || "tenant-ks";
    if (seen.has(tid)) continue;
    seen.add(tid);

    const profile = profiles[tid];
    if (profile?.status === "SUSPENDED" || profile?.status === "INACTIVE") {
      return {
        blocked: true,
        tenantId: tid,
        status: profile.status,
        brandName: profile.brandName || tid,
        reason: profile.suspendedReason,
      };
    }
  }
  return { blocked: false };
}

export function formatBlockedTenantError(
  blocked: Extract<TenantOrderGuardResult, { blocked: true }>
): string {
  if (blocked.status === "SUSPENDED") {
    const reasonSuffix = blocked.reason ? ` (${blocked.reason})` : "";
    return `FORBIDDEN: TENANT_SUSPENDED: Transaksi untuk mitra [${blocked.brandName}] ditolak karena status mitra sedang DITANGGUHKAN${reasonSuffix}.`;
  }
  return `FORBIDDEN: TENANT_INACTIVE: Transaksi untuk mitra [${blocked.brandName}] ditolak karena status mitra sedang NONAKTIF.`;
}
