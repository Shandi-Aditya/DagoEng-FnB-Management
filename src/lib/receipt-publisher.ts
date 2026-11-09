import { DEFAULT_FNB_TENANTS, getTenantName, getAllStoredTenantSettings } from "./tenant";

export interface MasterOutletInfo {
  name: string;
  address: string;
  phone: string;
}

export const MASTER_HQ_OUTLET: MasterOutletInfo = {
  name: "Singaraja (Pusat)",
  address: "Jl. Ngurah Rai No. 45, Singaraja, Bali",
  phone: "(0362) 23456",
};

export interface ReceiptPublisherInfo {
  brandName: string;
  tagline?: string;
  outletName: string;
  outletAddress: string;
  outletPhone: string;
  isMultiTenant: boolean;
  tenantId?: string;
}

/**
 * Resolves receipt publisher info dynamically for Coworking & Meeting Spaces.
 * Co-working spaces belong to Dago Creative Hub, never Kopi Senja or other F&B tenants.
 */
export function resolveCoworkingReceiptPublisher(
  outlet?: { name?: string; address?: string; phone?: string } | null
): ReceiptPublisherInfo {
  const branchName = outlet?.name || MASTER_HQ_OUTLET.name;
  const outletName = `Dago Creative Hub — ${branchName}`;
  const outletAddress = outlet?.address || MASTER_HQ_OUTLET.address;
  const outletPhone = outlet?.phone || MASTER_HQ_OUTLET.phone;

  return {
    brandName: "DAGO CREATIVE HUB",
    tagline: "Co-Working & Meeting Spaces",
    outletName,
    outletAddress,
    outletPhone,
    isMultiTenant: false,
    tenantId: "tenant-cowork",
  };
}

/**
 * Resolves receipt publisher info dynamically for POS & F&B orders based on item tenant ownership.
 */
export function resolvePosReceiptPublisher(
  items: { tenantId?: string; tenantName?: string }[] = [],
  activeOutlet?: { name?: string; address?: string; phone?: string } | null,
  fallbackTenantId?: string
): ReceiptPublisherInfo {
  const branchName = activeOutlet?.name || MASTER_HQ_OUTLET.name;
  const outletAddress = activeOutlet?.address || MASTER_HQ_OUTLET.address;
  const outletPhone = activeOutlet?.phone || MASTER_HQ_OUTLET.phone;

  // Find distinct tenants from items
  const tenantIdsInItems = Array.from(
    new Set(
      items
        .map((i) => i.tenantId || (i.tenantName ? DEFAULT_FNB_TENANTS.find((t) => t.name.toLowerCase() === i.tenantName?.toLowerCase())?.id : undefined))
        .filter(Boolean) as string[]
    )
  );

  const isMultiTenant = tenantIdsInItems.length > 1;

  if (isMultiTenant) {
    return {
      brandName: "DAGO CREATIVE HUB",
      tagline: "Ringkasan Pesanan Multi-Mitra",
      outletName: `Dago Creative Hub — ${branchName}`,
      outletAddress,
      outletPhone,
      isMultiTenant: true,
    };
  }

  // Single tenant resolution
  const primaryTenantId = tenantIdsInItems[0] || fallbackTenantId || "tenant-ks";
  const tenantMeta = DEFAULT_FNB_TENANTS.find((t) => t.id === primaryTenantId);
  const tenantName = items[0]?.tenantName || tenantMeta?.name || getTenantName(primaryTenantId) || "Kopi Senja";

  const allStoredSettings = typeof window !== "undefined" ? getAllStoredTenantSettings() : {};
  const storedTenantSettings = (allStoredSettings as any)[primaryTenantId];

  const brandName =
    storedTenantSettings?.brandName ||
    storedTenantSettings?.receiptHeader ||
    tenantName;

  const tagline =
    storedTenantSettings?.tagline ||
    tenantMeta?.tagline ||
    tenantMeta?.badge;

  return {
    brandName,
    tagline,
    outletName: `${brandName} — ${branchName}`,
    outletAddress,
    outletPhone,
    isMultiTenant: false,
    tenantId: primaryTenantId,
  };
}
