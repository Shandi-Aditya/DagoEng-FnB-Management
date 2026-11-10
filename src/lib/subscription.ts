"use client";

import { BusinessModuleCode } from "@/types/auth";

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
  targetTenantId?: string; // If scoped to specific tenant
}

export const PLATFORM_PLANS: Record<PlanTier, PlanConfig> = {
  STARTER: {
    id: "plan-starter",
    name: "Starter F&B Standalone",
    code: "STARTER",
    tagline: "Dirancang untuk kafe, coffee shop, atau kedai mandiri cabang tunggal",
    monthlyPriceDisplay: "Rp 299.000 / bln",
    annualPriceDisplay: "Rp 2.990.000 / thn",
    maxOutlets: 1,
    maxTenants: 1,
    maxStaff: 5,
    includedModules: ["CORE", "FNB"],
    features: [
      "1 Outlet Cabang Fisik",
      "1 Tenant / Mitra Utama",
      "Terminal POS Kasir & Transaksi Cepat",
      "KDS Standar 1 Layar Dapur Linier",
      "Smart Inventory Stok Masuk/Keluar",
      "Manajemen Meja & Status Ruangan Dasar",
      "Laporan Rekapitulasi Harian Format CSV",
    ],
    recommendedFor: "Bisnis F&B baru atau kedai kopi single outlet",
  },
  PROFESSIONAL: {
    id: "plan-pro",
    name: "Professional Hybrid Hub",
    code: "PROFESSIONAL",
    tagline: "Model lengkap untuk Creative Hub F&B multi-mitra dengan Co-working Space",
    monthlyPriceDisplay: "Rp 799.000 / bln",
    annualPriceDisplay: "Rp 7.990.000 / thn",
    maxOutlets: 3,
    maxTenants: 5,
    maxStaff: "UNLIMITED",
    includedModules: ["CORE", "FNB", "CO_WORKING"],
    features: [
      "Hingga 3 Outlet Cabang Fisik",
      "Hingga 5 Tenant Mitra F&B",
      "Seluruh fitur paket Starter",
      "Modul Co-working Space & Room Booking",
      "Payment Split Bill Kasir & Shift Closing",
      "Customer Portal Self-Order QR Meja Tamu",
      "Settlement Otomatis & Ekspor Laporan Excel (.xls)",
      "CRM Pelanggan & Loyalty Tier Poin",
      "Audit Trail & Log Aktivitas (30 Hari)",
    ],
    recommendedFor: "Creative Hub, Food Court, atau Kafe + Coworking terintegrasi",
    isPopular: true,
  },
  ENTERPRISE: {
    id: "plan-enterprise",
    name: "Enterprise Multi-Hub Chain",
    code: "ENTERPRISE",
    tagline: "Untuk operator kawasan komersial besar, jaringan waralaba, atau holding multi-unit",
    monthlyPriceDisplay: "Hubungi Sales",
    annualPriceDisplay: "Custom Billing Tahunan",
    maxOutlets: "UNLIMITED",
    maxTenants: "UNLIMITED",
    maxStaff: "UNLIMITED",
    includedModules: ["CORE", "FNB", "CO_WORKING", "COMMERCIAL"],
    features: [
      "Unlimited Outlet Cabang & Tenant Mitra",
      "Seluruh fitur paket Professional",
      "Modul Commercial Leases (Kontrak Sewa Lot Tenant)",
      "Audit Trail Forensik Tanpa Batas (Tamper-evident)",
      "Multi-Warehouse Inventory & Transfer Stok Antar Gudang",
      "Prioritas Dukungan SLA & Integrasi API Kustom",
      "Manajemen Akun Multi-Organisasi Terpusat",
    ],
    recommendedFor: "Jaringan waralaba skala nasional atau pengelola properti komersial",
  },
};

export const DEFAULT_TENANT_ADDONS: TenantAddonItem[] = [
  {
    id: "addon-kds-multistation",
    code: "KDS_MULTI_STATION",
    name: "Multi-Station Kitchen Routing",
    categoryTag: "Operasional Dapur & SLA",
    description: "Memisahkan tiket pesanan dapur secara otomatis ke stasiun Barista, Kitchen Panas, dan Pastry sesuai kategori menu.",
    monthlyPriceDisplay: "Rp 149.000 / bln",
    status: "ACTIVE",
    badgeLabel: "ADD-ON",
    badgeVariant: "addon",
    benefits: [
      "Routing tiket pesanan dapur terpisah secara instan",
      "Mengurangi antrean botol di stasiun barista dan koki",
      "SLA timer mandiri untuk setiap stasiun penyajian",
      "Notifikasi bunyi chime khusus per stasiun persiapan",
    ],
  },
  {
    id: "addon-bom-cogs",
    code: "ADVANCED_BOM_COGS",
    name: "Advanced Recipe & Real-time COGS",
    categoryTag: "Smart Inventory & Keuangan",
    description: "Kalkulasi gramatur resep bahan baku otomatis, estimasi HPP per porsi, dan pemotongan stok bertingkat saat pesanan diproses di kasir.",
    monthlyPriceDisplay: "Rp 199.000 / bln",
    status: "ACTIVE",
    badgeLabel: "ADD-ON",
    badgeVariant: "addon",
    benefits: [
      "Auto-deduction gramatur bahan baku per resep menu presisi",
      "Kalkulasi margin laba kotor & HPP real-time per transaksi",
      "Kalkulasi AI formula takaran bahan baku otomatis",
      "Pencegahan kebocoran stok bahan baku mahal",
    ],
  },
  {
    id: "addon-wa-closing",
    code: "WHATSAPP_AUTO_DISPATCH",
    name: "WhatsApp Auto-Receipt & E-Closing",
    categoryTag: "Notifikasi Otomatis & CRM",
    description: "Kirim struk digital transaksi dan rekapitulasi shift kasir otomatis langsung ke nomor WhatsApp pelanggan dan owner via API Gateway.",
    monthlyPriceDisplay: "Rp 99.000 / bln",
    status: "ACTIVE",
    badgeLabel: "ADD-ON",
    badgeVariant: "addon",
    benefits: [
      "E-Receipt digital ramah lingkungan tanpa kertas thermal",
      "Rekapitulasi shift kasir harian terkirim ke WhatsApp owner",
      "Integrasi Gateway Fonnte dengan format pesan rapi",
      "Meningkatkan engagement dan nomor kontak database pelanggan",
    ],
  },
  {
    id: "addon-tenant-promo",
    code: "TENANT_AUTONOMOUS_PROMO",
    name: "Voucher Promo Otonom Tenant",
    categoryTag: "Pemasaran & Diskon Otonom",
    description: "Tenant dapat membuat dan mengelola kupon diskon otonom khusus produknya dengan kuota dan batas minimum belanja mandiri.",
    monthlyPriceDisplay: "Rp 79.000 / bln",
    status: "ACTIVE",
    badgeLabel: "ADD-ON",
    badgeVariant: "addon",
    benefits: [
      "Kode promo khusus menu mitra (contoh: KOPISENJA10)",
      "Alokasi diskon prorata otomatis pada settlement bagi hasil",
      "Dapat digabung atau dipisahkan dari promo platform DAGO",
      "Pelacakan efektivitas kampanye promosi langsung di POS",
    ],
  },
];

const STORAGE_KEY_ORG_SUB = "dagoeng_simulated_org_sub_v1";
const STORAGE_KEY_TENANT_ADDONS = "dagoeng_simulated_tenant_addons_v1";

let memoryOrgSub: OrgSubscriptionState | null = null;
let memoryTenantAddons: TenantAddonItem[] | null = null;

/**
 * Returns current simulated organization subscription state.
 * Default is PROFESSIONAL for Dago Creative Hub.
 */
export function getSimulatedOrgSubscription(): OrgSubscriptionState {
  const defaultState: OrgSubscriptionState = {
    organizationId: "org-dago-hub",
    organizationName: "Dago Creative Hub",
    planTier: "PROFESSIONAL",
    planName: PLATFORM_PLANS.PROFESSIONAL.name,
    status: "ACTIVE",
    statusLabel: "Aktif",
    billingCycle: "TAHUNAN",
    activeSince: "14 Januari 2026",
    nextRenewalDate: "14 Oktober 2027",
    isSimulated: false,
    notes: "Paket tier saat ini dikonfigurasi sebagai Professional Hybrid Hub untuk mengoperasikan unit bisnis F&B multi-mitra dan Co-working Space.",
  };

  if (typeof window === "undefined") {
    return memoryOrgSub || defaultState;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_ORG_SUB);
    if (!raw) return memoryOrgSub || defaultState;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.planTier && PLATFORM_PLANS[parsed.planTier as PlanTier]) {
      return {
        ...defaultState,
        ...parsed,
        planName: PLATFORM_PLANS[parsed.planTier as PlanTier].name,
      };
    }
  } catch (e) {
    console.error("Failed to read simulated org subscription", e);
  }

  return memoryOrgSub || defaultState;
}

/**
 * Updates the simulated plan tier for the organization (e.g. testing upgrade/downgrade).
 */
export function setSimulatedOrgPlan(tier: PlanTier): OrgSubscriptionState {
  const current = getSimulatedOrgSubscription();
  const plan = PLATFORM_PLANS[tier];

  const updated: OrgSubscriptionState = {
    ...current,
    planTier: tier,
    planName: plan.name,
    status: "ACTIVE",
    statusLabel: "Aktif",
    isSimulated: false,
  };

  memoryOrgSub = updated;

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_ORG_SUB, JSON.stringify(updated));
      window.dispatchEvent(new Event("subscription_state_updated"));
    } catch (e) {
      console.error("Failed to save simulated org subscription", e);
    }
  }

  return updated;
}

let memoryTenantAddonsMap: Record<string, TenantAddonItem[]> = {};

const getAddonStorageKey = (scopeId?: string) => {
  return scopeId ? `${STORAGE_KEY_TENANT_ADDONS}_${scopeId}` : STORAGE_KEY_TENANT_ADDONS;
};

/**
 * Returns simulated tenant addons scoped by tenant ID or hub level.
 */
export function getSimulatedTenantAddons(scopeId?: string): TenantAddonItem[] {
  const scopeKey = scopeId || "default";

  if (typeof window === "undefined") {
    if (memoryTenantAddonsMap[scopeKey]) {
      return memoryTenantAddonsMap[scopeKey];
    }
    if (!scopeId && memoryTenantAddons) {
      return memoryTenantAddons;
    }
    return DEFAULT_TENANT_ADDONS.map((a) => ({ ...a }));
  }

  try {
    // 1. Try scope-specific key first
    const specificKey = getAddonStorageKey(scopeId);
    let raw = localStorage.getItem(specificKey);

    // 2. Fallback to generic legacy key only if no scopeId was provided
    if (!raw && !scopeId) {
      raw = localStorage.getItem(STORAGE_KEY_TENANT_ADDONS);
    }

    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to read simulated tenant addons", e);
  }

  if (memoryTenantAddonsMap[scopeKey]) {
    return memoryTenantAddonsMap[scopeKey];
  }
  return DEFAULT_TENANT_ADDONS.map((a) => ({ ...a }));
}

/**
 * Toggles a simulated tenant addon status (ACTIVE <-> INACTIVE) scoped by tenant/hub.
 */
export function toggleSimulatedTenantAddon(addonId: string, scopeId?: string): TenantAddonItem[] {
  const scopeKey = scopeId || "default";
  const list = getSimulatedTenantAddons(scopeId);
  const updated = list.map((item) => {
    if (item.id === addonId) {
      const nextStatus: "ACTIVE" | "INACTIVE" = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      return { ...item, status: nextStatus };
    }
    return item;
  });

  memoryTenantAddonsMap[scopeKey] = updated;
  if (!scopeId) {
    memoryTenantAddons = updated;
  }

  if (typeof window !== "undefined") {
    try {
      const specificKey = getAddonStorageKey(scopeId);
      localStorage.setItem(specificKey, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("subscription_state_updated", { detail: { scopeId } }));
    } catch (e) {
      console.error("Failed to save simulated tenant addons", e);
    }
  }

  return updated;
}

/**
 * Checks if a specific add-on is active in the workspace or given scope.
 */
export function isAddonActive(addonCode: string, scopeId?: string): boolean {
  const addons = getSimulatedTenantAddons(scopeId);
  return addons.some((a) => a.code === addonCode && a.status === "ACTIVE");
}
