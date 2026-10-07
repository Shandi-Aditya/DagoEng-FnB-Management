import { AuthenticatedUser, BusinessModuleCode, ScopeLevel } from "@/types/auth";

/**
 * Validates that the user has access to a specific organization.
 */
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

/**
 * Validates that a requested business module is currently active in the organization.
 */
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

/**
 * Validates tenant access boundary.
 * - Dago Organization Owner (Scope: ORGANIZATION) can access all tenants.
 * - Tenant Owner (Scope: TENANT) can strictly access ONLY their assigned tenantId.
 */
export function assertTenantAccess(
  user: AuthenticatedUser | null,
  targetTenantId?: string | null
): void {
  if (!user) throw new Error("UNAUTHENTICATED");
  if (user.role.slug === "SUPER_ADMIN") return;
  if (user.scopeLevel === "ORGANIZATION") return; // Org Owner has multi-tenant scope

  // If user scope is TENANT, targetTenantId must match user's tenantId
  if (user.scopeLevel === "TENANT" || user.scopeLevel === "OUTLET") {
    if (targetTenantId && user.tenant && user.tenant.id !== targetTenantId) {
      throw new Error(
        `TENANT_ISOLATION_VIOLATION: User belongs to tenant [${user.tenant.name}], cannot access target tenant [${targetTenantId}].`
      );
    }
  }
}

/**
 * Validates outlet context for operational vs analytics actions.
 */
export function assertOutletAccess(
  user: AuthenticatedUser | null,
  targetOutletId: string | null,
  isOperationalAction: boolean = false
): void {
  if (!user) throw new Error("UNAUTHENTICATED");
  if (user.role.slug === "SUPER_ADMIN") return;

  // Operational actions (e.g. POS order, Shift opening, Kitchen dispatch) CANNOT run in "ALL OUTLETS" mode
  if (isOperationalAction && (!targetOutletId || targetOutletId === "ALL")) {
    throw new Error(
      "INVALID_OPERATIONAL_CONTEXT: Operational transactions require an explicit Single Outlet context."
    );
  }

  // Owner with Organization or Tenant scope can view "ALL" in read-only analytics mode
  if (user.role.slug === "OWNER" && !isOperationalAction) {
    return;
  }

  // Cashier, Kitchen, Waiter, Inventory staff MUST only access their assigned outlet
  if (user.outlet && targetOutletId && user.outlet.id !== targetOutletId) {
    throw new Error(
      `OUTLET_ISOLATION_VIOLATION: User is assigned to outlet [${user.outlet.name}], cannot access outlet [${targetOutletId}].`
    );
  }
}

/**
 * Generates the scoped reporting query filter according to Role + Access Scope + Module.
 */
export function getScopedDataFilter(
  user: AuthenticatedUser,
  requestedModule: BusinessModuleCode
) {
  // Base check
  if (user.scopeLevel === "ORGANIZATION") {
    return {
      organizationId: user.organization?.id,
      module: requestedModule,
      tenantId: undefined, // All tenants
      outletId: undefined, // All outlets
    };
  }

  if (user.scopeLevel === "TENANT") {
    return {
      organizationId: user.organization?.id,
      module: user.tenant?.businessModule || requestedModule,
      tenantId: user.tenant?.id, // Strictly scoped to user's tenant
      outletId: undefined,
    };
  }

  // Scope is OUTLET (e.g. Cashier, Kitchen, Manager)
  return {
    organizationId: user.organization?.id,
    module: requestedModule,
    tenantId: user.tenant?.id,
    outletId: user.outlet?.id,
  };
}

export const TENANT_STORAGE_KEY = "dagoeng_tenant_settings_v1";

export interface FnbPartnerInfo {
  id: string;
  code: string;
  name: string;
  badge: string;
  icon: string;
  tagline: string;
  desc: string;
}

export const DEFAULT_FNB_TENANTS: FnbPartnerInfo[] = [
  {
    id: "tenant-ks",
    code: "KOPI-SENJA",
    name: "Kopi Senja",
    badge: "Official Mitra Kopi",
    icon: "☕",
    tagline: "Kopi Spesialti & Aneka Minuman",
    desc: "Sajian kopi pilihan dan aneka minuman segar untuk menemani aktivitas Anda.",
  },
  {
    id: "tenant-kitchen",
    code: "DAPUR-MAMA",
    name: "Dapur Mama",
    badge: "Official Kitchen",
    icon: "🍽️",
    tagline: "Masakan Rumahan & Hidangan Utama",
    desc: "Hidangan utama hangat, aneka olahan nasi, dan lauk lezat khas masakan rumah.",
  },
  {
    id: "tenant-bakery",
    code: "MANIS-BAKERY",
    name: "Manis Bakery",
    badge: "Fresh Baked Daily",
    icon: "🥐",
    tagline: "Roti, Kue & Pastry Segar",
    desc: "Roti segar, pastry mentega lembut, dan camilan lezat yang dipanggang setiap hari.",
  },
  {
    id: "tenant-tea",
    code: "WARUNG-BU-NARTI",
    name: "Warung Bu Narti",
    badge: "Mitra Nusantara",
    icon: "🍃",
    tagline: "Kuliner Tradisional & Minuman Nusantara",
    desc: "Aneka seduhan teh segar, minuman rempah tradisional, dan sajian khas nusantara.",
  },
];

export interface TenantProfileData {
  tenantId: string;
  brandName: string;
  tagline: string;
  description: string;
  contactPhone: string;
  receiptHeader: string;
  receiptFooter: string;
  lowStockThresholdPercent: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  status: "ACTIVE" | "INACTIVE";
}

export const DEFAULT_TENANT_PROFILES: Record<string, Partial<TenantProfileData>> = {
  "tenant-ks": {
    brandName: "Kopi Senja",
    tagline: "Specialty Coffee & Beverages",
    description: "Single origin espresso blend Kintamani, olahan susu segar & gula aren organik Bali.",
    contactPhone: "+62 812-3456-7890",
    receiptHeader: "Kopi Senja — Specialty Coffee & Beverages",
    receiptFooter: "Terima kasih telah berkunjung ke Kopi Senja!",
    lowStockThresholdPercent: 35,
    bankName: "BCA",
    bankAccountNumber: "8830192841",
    bankAccountHolder: "Kopi Senja Utama",
    status: "ACTIVE",
  },
  "tenant-kitchen": {
    brandName: "Dapur Mama",
    tagline: "Masakan Rumahan & Hidangan Utama",
    description: "Hidangan utama hangat, aneka olahan nasi, dan lauk lezat khas masakan rumah.",
    contactPhone: "+62 813-2233-4411",
    receiptHeader: "Dapur Mama — Masakan Rumahan Lezat",
    receiptFooter: "Selamat menikmati sajian khas Dapur Mama!",
    lowStockThresholdPercent: 30,
    bankName: "Mandiri",
    bankAccountNumber: "1420019283741",
    bankAccountHolder: "Dapur Mama Kuliner",
    status: "ACTIVE",
  },
  "tenant-bakery": {
    brandName: "Manis Bakery",
    tagline: "Roti, Kue & Pastry Segar",
    description: "Roti segar, pastry mentega lembut, dan camilan lezat yang dipanggang setiap hari.",
    contactPhone: "+62 812-9988-7766",
    receiptHeader: "Manis Bakery — Fresh Baked Daily",
    receiptFooter: "Terima kasih telah berbelanja di Manis Bakery!",
    lowStockThresholdPercent: 25,
    bankName: "BCA",
    bankAccountNumber: "7720194821",
    bankAccountHolder: "Manis Bakery Artisan",
    status: "ACTIVE",
  },
  "tenant-tea": {
    brandName: "Warung Bu Narti",
    tagline: "Kuliner Tradisional & Minuman Nusantara",
    description: "Aneka seduhan teh segar, minuman rempah tradisional, dan sajian khas nusantara.",
    contactPhone: "+62 817-4455-6677",
    receiptHeader: "Warung Bu Narti — Cita Rasa Nusantara",
    receiptFooter: "Matur suksma sampun mampir ring Warung Bu Narti!",
    lowStockThresholdPercent: 30,
    bankName: "BRI",
    bankAccountNumber: "002101928374501",
    bankAccountHolder: "Warung Bu Narti",
    status: "ACTIVE",
  },
};

/**
 * Returns complete tenant profile information (branding, contact, receipt header/footer, bank details)
 * with automatic fallback to default profile.
 */
export function getTenantProfile(tenantId: string): TenantProfileData {
  const map = getAllStoredTenantSettings();
  const stored = map[tenantId];
  const defInfo = DEFAULT_FNB_TENANTS.find((t) => t.id === tenantId) || {
    id: tenantId,
    code: tenantId.toUpperCase(),
    name: tenantId,
    tagline: "Mitra Resmi Dago Creative Hub",
    desc: "Mitra kuliner terdaftar di Dago Creative Hub.",
    badge: "Official Mitra",
    icon: "🍽️",
  };

  const def = DEFAULT_TENANT_PROFILES[tenantId] || {
    brandName: defInfo.name,
    tagline: defInfo.tagline,
    description: defInfo.desc,
    contactPhone: "+62 812-0000-0000",
    receiptHeader: `${defInfo.name} — ${defInfo.tagline}`,
    receiptFooter: `Terima kasih telah berkunjung ke ${defInfo.name}!`,
    lowStockThresholdPercent: 30,
    bankName: "BCA",
    bankAccountNumber: "-",
    bankAccountHolder: "-",
    status: "ACTIVE",
  };

  if (stored) {
    return {
      tenantId,
      brandName: stored.brandName || def.brandName || defInfo.name,
      tagline: stored.tagline || def.tagline || "",
      description: stored.description || def.description || "",
      contactPhone: stored.contactPhone || def.contactPhone || "",
      receiptHeader: stored.receiptHeader || def.receiptHeader || "",
      receiptFooter: stored.receiptFooter || def.receiptFooter || "",
      lowStockThresholdPercent:
        stored.lowStockThresholdPercent !== undefined
          ? stored.lowStockThresholdPercent
          : (def.lowStockThresholdPercent || 30),
      bankName: stored.bankName || def.bankName || "BCA",
      bankAccountNumber: stored.bankAccountNumber || def.bankAccountNumber || "",
      bankAccountHolder: stored.bankAccountHolder || def.bankAccountHolder || "",
      status: stored.status === "INACTIVE" ? "INACTIVE" : (def.status || "ACTIVE"),
    };
  }

  return {
    tenantId,
    brandName: def.brandName || defInfo.name,
    tagline: def.tagline || "",
    description: def.description || "",
    contactPhone: def.contactPhone || "",
    receiptHeader: def.receiptHeader || "",
    receiptFooter: def.receiptFooter || "",
    lowStockThresholdPercent: def.lowStockThresholdPercent || 30,
    bankName: def.bankName || "BCA",
    bankAccountNumber: def.bankAccountNumber || "",
    bankAccountHolder: def.bankAccountHolder || "",
    status: def.status || "ACTIVE",
  };
}

/**
 * Helper to get readable tenant name by tenantId
 */
export function getTenantName(tenantId?: string): string | undefined {
  const match = DEFAULT_FNB_TENANTS.find((t) => t.id === tenantId);
  return match ? match.name : tenantId;
}

/**
 * Reads all stored tenant settings from localStorage.
 */
export function getAllStoredTenantSettings(): Record<string, any> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TENANT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (parsed.tenantId && typeof parsed.tenantId === "string") {
        return { [parsed.tenantId]: parsed };
      }
      return parsed;
    }
  } catch (e) {
    console.error("Failed to read tenant settings from localStorage", e);
  }
  return {};
}

/**
 * Returns the status for a given tenant ("ACTIVE" | "INACTIVE").
 * Defaults to "ACTIVE" in accordance with Prisma schema default: Tenant.status @default("ACTIVE").
 */
export function getTenantStatus(tenantId: string): "ACTIVE" | "INACTIVE" {
  if (typeof window === "undefined") return "ACTIVE";
  const map = getAllStoredTenantSettings();
  const tenantData = map[tenantId];
  if (tenantData && tenantData.status) {
    return tenantData.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  }
  return "ACTIVE";
}

/**
 * Returns true if tenant is currently ACTIVE.
 */
export function isTenantActive(tenantId: string): boolean {
  return getTenantStatus(tenantId) === "ACTIVE";
}

/**
 * Updates the operational status of a tenant in localStorage.
 */
export function setTenantStatus(tenantId: string, status: "ACTIVE" | "INACTIVE"): void {
  if (typeof window === "undefined") return;
  try {
    const map = getAllStoredTenantSettings();
    const existing = map[tenantId] || { tenantId };
    map[tenantId] = {
      ...existing,
      tenantId,
      status,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(map));
    // Trigger custom event so other components on same window can react
    window.dispatchEvent(new Event("tenant_settings_updated"));
  } catch (e) {
    console.error("Failed to set tenant status in localStorage", e);
  }
}
