import { normalizeTenantId } from "@/lib/tax-breakdown";
import type { TenantProfileData, TenantStatus } from "@/lib/tenant";
import type { MasterProduct } from "@/types/product";

export interface TenantOrderGuardItem {
  productId?: string;
  tenantId?: string;
  itemType?: string;
  productName?: string;
  coworkingMeta?: unknown;
  sessionId?: string;
  deskCode?: string;
}

function hasExplicitCoworkingMetadata(item: TenantOrderGuardItem): boolean {
  if (item.coworkingMeta && typeof item.coworkingMeta === "object") {
    const meta = item.coworkingMeta as Record<string, unknown>;
    if (
      (typeof meta.spaceId === "string" && meta.spaceId.trim().length > 0) ||
      (typeof meta.sessionId === "string" && meta.sessionId.trim().length > 0) ||
      (typeof meta.deskCode === "string" && meta.deskCode.trim().length > 0)
    ) {
      return true;
    }
  }
  if (typeof item.sessionId === "string" && item.sessionId.trim().length > 0) {
    return true;
  }
  if (typeof item.deskCode === "string" && item.deskCode.trim().length > 0) {
    return true;
  }
  return false;
}

function isHubNonTenantId(tenantId?: string): boolean {
  const normalized = normalizeTenantId(tenantId);
  return !normalized || normalized === "DAGO_HUB" || normalized === "tenant-dago";
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
 * Resolves authoritative tenantId and itemType from the server product catalog
 * whenever a matching productId exists, preventing client itemType/tenantId spoofing.
 */
export function resolveCatalogOrderGuardItems(
  items: readonly TenantOrderGuardItem[],
  catalogProducts: readonly MasterProduct[]
): TenantOrderGuardItem[] {
  const productById = new Map<string, MasterProduct>();
  for (const product of catalogProducts) {
    if (product?.id) {
      productById.set(product.id, product);
    }
  }

  return items.map((item) => {
    const productId = typeof item.productId === "string" ? item.productId.trim() : "";
    const catalogProduct = productId ? productById.get(productId) : undefined;
    if (!catalogProduct) {
      if (
        item.itemType === "COWORKING" &&
        !isHubNonTenantId(item.tenantId) &&
        !hasExplicitCoworkingMetadata(item)
      ) {
        return {
          ...item,
          itemType: "FNB",
        };
      }
      return item;
    }

    const isCatalogCoworking =
      /^co-?working$/i.test((catalogProduct.category || "").trim()) ||
      normalizeTenantId(catalogProduct.tenantId) === "DAGO_HUB";

    return {
      ...item,
      tenantId: catalogProduct.tenantId || item.tenantId,
      itemType: isCatalogCoworking ? "COWORKING" : "FNB",
    };
  });
}

/**
 * Checks whether any F&B item in an order belongs to a SUSPENDED or INACTIVE partner.
 */
export function findBlockedOrderTenant(
  items: readonly TenantOrderGuardItem[],
  profiles: Record<string, Partial<TenantProfileData> | undefined>,
  fallbackTenantId?: string
): TenantOrderGuardResult {
  if (!items || items.length === 0) {
    const fallbackTid = normalizeTenantId(fallbackTenantId);
    if (fallbackTid) {
      const profile = profiles[fallbackTid];
      if (profile?.status === "SUSPENDED" || profile?.status === "INACTIVE") {
        return {
          blocked: true,
          tenantId: fallbackTid,
          status: profile.status,
          brandName: profile.brandName || fallbackTid,
          reason: profile.suspendedReason,
        };
      }
    }
    return { blocked: false };
  }

  const seen = new Set<string>();
  for (const item of items) {
    const isConfirmedCoworking =
      item.itemType === "COWORKING" &&
      (hasExplicitCoworkingMetadata(item) ||
        (item.tenantId ? isHubNonTenantId(item.tenantId) : isHubNonTenantId(fallbackTenantId)));
    if (isConfirmedCoworking) continue;
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
