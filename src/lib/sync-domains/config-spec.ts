import type { BusinessModuleCode, RoleSlug } from "@/types/auth";
import type { ServerAuthResult } from "@/lib/server-auth";
import {
  DEFAULT_CATEGORY_TAX_CONFIG,
  DEFAULT_PLATFORM_SETTINGS,
  type OutletReceiptCombineMode,
  type PlatformSettings,
} from "@/types/settings";
import {
  redeemPromoQuota,
  refundPromoQuota,
  type PromoConfig,
} from "@/lib/promo";
import {
  DEFAULT_PRINTER_DEVICES,
  DEFAULT_PRINTING_SETTINGS,
  type POSPrintingSettings,
  type PrinterDeviceConfig,
} from "@/types/printer";
import type { FnbPartnerInfo, TenantProfileData } from "@/lib/tenant";
import { OFFICIAL_CS_DISPLAY_PHONE } from "@/lib/contact-config";
import type {
  WifiCalculationBasis,
  WifiCoworkingRule,
  WifiFnBRule,
  WifiVoucherRecord,
  WifiVoucherStatus,
} from "@/lib/wifi";
import type {
  OrgSubscriptionState,
  PlanConfig,
  PlanTier,
  TenantAddonItem,
} from "@/lib/subscription";
import {
  MAX_APPLIED_OP_IDS,
  MAX_WIFI_VOUCHERS,
  type DomainCommandMap,
  type DomainStateMap,
  type PlatformSettingsCommand,
  type PlatformSettingsDomainState,
  type PrinterConfigCommand,
  type PrinterConfigDomainState,
  type ServerDomainSpec,
  type SubscriptionCommand,
  type SubscriptionDomainState,
  type TenantsCommand,
  type TenantsDomainState,
  type WifiCommand,
  type WifiDomainState,
} from "@/lib/domain-sync-types";
import {
  createSyncedDomainClient,
  type LocalStorageMirrorAdapter,
  type OutboxCommandDescriptor,
  type SyncedDomainClient,
} from "@/lib/domain-sync";

export type ConfigSyncDomainName =
  | "platform-settings"
  | "tenants"
  | "wifi"
  | "subscription"
  | "printer-config";

export const STORAGE_KEY_PLATFORM_SETTINGS = "dagoeng_platform_settings_v1";
export const STORAGE_KEY_TENANT_SETTINGS = "dagoeng_tenant_settings_v1";
export const STORAGE_KEY_CUSTOM_TENANTS = "dago_custom_tenants";
export const STORAGE_KEY_WIFI_FNB_RULES = "dagoeng_wifi_fnb_rules_v1";
export const STORAGE_KEY_WIFI_CW_RULES = "dagoeng_wifi_cw_rules_v1";
export const STORAGE_KEY_WIFI_VOUCHERS = "dagoeng_wifi_vouchers_v1";
export const STORAGE_KEY_WIFI_CALC_BASIS = "dagoeng_wifi_calc_basis_v1";
export const STORAGE_KEY_ORG_SUBSCRIPTION = "dagoeng_simulated_org_sub_v1";
export const STORAGE_KEY_TENANT_ADDONS = "dagoeng_simulated_tenant_addons_v1";
export const STORAGE_KEY_TENANT_ADDON_SCOPES = "dagoeng_simulated_tenant_addons_v1_scopes";
export const STORAGE_KEY_PRINTER_DEVICES_MIRROR = "dagoeng_printer_devices_v1";
export const STORAGE_KEY_PRINTER_SETTINGS_MIRROR = "dagoeng_printer_settings_v1";

export const SEED_FNB_TENANTS: FnbPartnerInfo[] = [
  {
    id: "tenant-ks",
    code: "KOPI-SENJA",
    name: "Kopi Senja",
    badge: "Official Mitra Kopi",
    icon: "Coffee",
    tagline: "Kopi Spesialti & Aneka Minuman",
    desc: "Sajian kopi pilihan dan aneka minuman segar untuk menemani aktivitas Anda.",
  },
  {
    id: "tenant-kitchen",
    code: "DAPUR-MAMA",
    name: "Dapur Mama",
    badge: "Official Kitchen",
    icon: "Utensils",
    tagline: "Masakan Rumahan & Hidangan Utama",
    desc: "Hidangan utama hangat, aneka olahan nasi, dan lauk lezat khas masakan rumah.",
  },
  {
    id: "tenant-bakery",
    code: "MANIS-BAKERY",
    name: "Manis Bakery",
    badge: "Fresh Baked Daily",
    icon: "Croissant",
    tagline: "Roti, Kue & Pastry Segar",
    desc: "Roti segar, pastry mentega lembut, dan camilan lezat yang dipanggang setiap hari.",
  },
  {
    id: "tenant-tea",
    code: "WARUNG-BU-NARTI",
    name: "Warung Bu Narti",
    badge: "Mitra Nusantara",
    icon: "Leaf",
    tagline: "Kuliner Tradisional & Minuman Nusantara",
    desc: "Aneka seduhan teh segar, minuman rempah tradisional, dan sajian khas nusantara.",
  },
];

export const SEED_TENANT_PROFILES: Record<string, Partial<TenantProfileData>> = {
  "tenant-ks": {
    brandName: "Kopi Senja",
    tagline: "Specialty Coffee & Beverages",
    description: "Single origin espresso blend Kintamani, olahan susu segar & gula aren organik Bali.",
    contactPhone: OFFICIAL_CS_DISPLAY_PHONE,
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

export const SEED_FNB_WIFI_RULES: WifiFnBRule[] = [
  {
    id: "rule-fnb-1",
    minTransactionAmount: 25000,
    maxTransactionAmount: 99999,
    durationMinutes: 60,
    bandwidthLimitDownMbps: 10,
    bandwidthLimitUpMbps: 5,
    label: "F&B Standar (1 Jam)",
    isActive: true,
    notes: "Akses 1 jam untuk pembelian ringan di bawah Rp 100.000 (minimal Rp 25.000)",
  },
  {
    id: "rule-fnb-2",
    minTransactionAmount: 100000,
    maxTransactionAmount: 249999,
    durationMinutes: 120,
    bandwidthLimitDownMbps: 20,
    bandwidthLimitUpMbps: 10,
    label: "F&B Santai (2 Jam)",
    isActive: true,
    notes: "Akses 2 jam untuk transaksi Rp 100.000 s/d Rp 249.999",
  },
  {
    id: "rule-fnb-3",
    minTransactionAmount: 250000,
    durationMinutes: 180,
    bandwidthLimitDownMbps: 35,
    bandwidthLimitUpMbps: 15,
    label: "F&B Produktif (3 Jam)",
    isActive: true,
    notes: "Akses 3 jam untuk transaksi kuliner besar / rombongan di atas Rp 250.000",
  },
];

export const SEED_COWORKING_WIFI_RULES: WifiCoworkingRule[] = [
  {
    id: "rule-cw-hourly",
    spaceType: "HOT_DESK",
    bookingType: "HOURLY",
    durationMode: "FOLLOW_BOOKING",
    gracePeriodMinutes: 15,
    maxConcurrentDevices: 1,
    bandwidthLimitDownMbps: 50,
    bandwidthLimitUpMbps: 25,
    label: "Hot Desk Flex (Sesuai Durasi Sewa + 15 Menit)",
    isActive: true,
  },
  {
    id: "rule-cw-daily",
    spaceType: "HOT_DESK",
    bookingType: "DAILY",
    durationMode: "FULL_DAY_UNTIL_CLOSING",
    gracePeriodMinutes: 30,
    maxConcurrentDevices: 2,
    bandwidthLimitDownMbps: 75,
    bandwidthLimitUpMbps: 35,
    label: "Daily Pass Coworking (Seharian s/d Tutup Operasional)",
    isActive: true,
  },
  {
    id: "rule-cw-meeting",
    spaceType: "MEETING_ROOM",
    bookingType: "HOURLY",
    durationMode: "FOLLOW_BOOKING",
    gracePeriodMinutes: 20,
    maxConcurrentDevices: 10,
    bandwidthLimitDownMbps: 100,
    bandwidthLimitUpMbps: 50,
    label: "Meeting Room Executive (Multi-Device hingga 10 Tamu)",
    isActive: true,
  },
  {
    id: "rule-cw-dedicated",
    spaceType: "DEDICATED_DESK",
    bookingType: "MONTHLY",
    durationMode: "FIXED_HOURS",
    fixedDurationMinutes: 30 * 24 * 60,
    gracePeriodMinutes: 60,
    maxConcurrentDevices: 3,
    bandwidthLimitDownMbps: 100,
    bandwidthLimitUpMbps: 50,
    label: "Dedicated Desk Member (Akses Penuh 30 Hari)",
    isActive: true,
  },
];

export const SEED_DEMO_WIFI_VOUCHERS: WifiVoucherRecord[] = [
  {
    id: "vcr-fnb-1",
    voucherCode: "DG-FNB-7821",
    serviceType: "FNB",
    referenceId: "ORD-2026-104",
    referenceLabel: "Struk POS #ORD-2026-104",
    customerName: "Budi Pratama",
    customerPhone: "081234567890",
    outletId: "out-sgr",
    outletName: "Dago Creative Hub Singaraja",
    tenantId: "tenant-ks",
    tenantName: "Kopi Senja",
    transactionAmount: 115000,
    durationMinutes: 120,
    durationFormatted: "2 Jam",
    issuedAt: "2026-10-14T08:30:00.000Z",
    activatedAt: "2026-10-14T08:35:10.000Z",
    expiresAt: "2026-10-14T10:35:10.000Z",
    status: "ACTIVE",
    maxDevices: 1,
    usedDevices: 1,
    isSimulated: true,
  },
  {
    id: "vcr-fnb-2",
    voucherCode: "DG-FNB-4190",
    serviceType: "FNB",
    referenceId: "ORD-2026-101",
    referenceLabel: "Struk POS #ORD-2026-101",
    customerName: "Citra Dewi",
    outletId: "out-sgr",
    outletName: "Dago Creative Hub Singaraja",
    tenantId: "tenant-dm",
    tenantName: "Dapur Mama",
    transactionAmount: 65000,
    durationMinutes: 60,
    durationFormatted: "1 Jam",
    issuedAt: "2026-10-14T07:15:00.000Z",
    activatedAt: "2026-10-14T07:18:22.000Z",
    expiresAt: "2026-10-14T08:18:22.000Z",
    status: "EXPIRED",
    maxDevices: 1,
    usedDevices: 1,
    isSimulated: true,
  },
  {
    id: "vcr-fnb-3",
    voucherCode: "DG-FNB-9342",
    serviceType: "FNB",
    referenceId: "ORD-2026-108",
    referenceLabel: "Struk POS #ORD-2026-108",
    customerName: "Komang Arya",
    outletId: "out-sgr",
    outletName: "Dago Creative Hub Singaraja",
    tenantId: "tenant-ks",
    tenantName: "Kopi Senja",
    transactionAmount: 280000,
    durationMinutes: 180,
    durationFormatted: "3 Jam",
    issuedAt: "2026-10-14T09:45:00.000Z",
    activatedAt: "2026-10-14T09:50:00.000Z",
    expiresAt: "2026-10-14T12:50:00.000Z",
    status: "ACTIVE",
    maxDevices: 1,
    usedDevices: 1,
    isSimulated: true,
  },
  {
    id: "vcr-fnb-4",
    voucherCode: "DG-FNB-2019",
    serviceType: "FNB",
    referenceId: "ORD-2026-095",
    referenceLabel: "Struk POS #ORD-2026-095 (Void)",
    customerName: "Tamu Kasir",
    outletId: "out-sgr",
    outletName: "Dago Creative Hub Singaraja",
    tenantId: "tenant-mb",
    tenantName: "Manis Bakery",
    transactionAmount: 55000,
    durationMinutes: 60,
    durationFormatted: "1 Jam",
    issuedAt: "2026-10-14T06:50:00.000Z",
    expiresAt: "2026-10-14T07:50:00.000Z",
    status: "CANCELLED",
    maxDevices: 1,
    usedDevices: 0,
    isSimulated: true,
  },
  {
    id: "vcr-cw-1",
    voucherCode: "DG-CW-8812",
    serviceType: "COWORKING",
    referenceId: "BKG-2026-001",
    referenceLabel: "Booking Hot Desk Flex (BKG-2026-001)",
    customerName: "Made Wijaya",
    customerPhone: "081987654321",
    outletId: "out-sgr",
    outletName: "Dago Creative Hub Singaraja",
    durationMinutes: 135,
    durationFormatted: "2 Jam (+15 mnt)",
    issuedAt: "2026-10-14T08:00:00.000Z",
    activatedAt: "2026-10-14T08:10:00.000Z",
    expiresAt: "2026-10-14T10:25:00.000Z",
    status: "ACTIVE",
    maxDevices: 1,
    usedDevices: 1,
    isSimulated: true,
  },
  {
    id: "vcr-cw-2",
    voucherCode: "DG-MEET-5501",
    serviceType: "COWORKING",
    referenceId: "BKG-2026-004",
    referenceLabel: "Executive Glass Meeting Room (BKG-2026-004)",
    customerName: "Startup Bali Tech",
    customerPhone: "081122334455",
    outletId: "out-sgr",
    outletName: "Dago Creative Hub Singaraja",
    durationMinutes: 200,
    durationFormatted: "3 Jam (+20 mnt)",
    issuedAt: "2026-10-14T09:00:00.000Z",
    activatedAt: "2026-10-14T09:05:00.000Z",
    expiresAt: "2026-10-14T12:25:00.000Z",
    status: "ACTIVE",
    maxDevices: 10,
    usedDevices: 6,
    isSimulated: true,
  },
];

export const SEED_PLATFORM_PLANS: Record<PlanTier, PlanConfig> = {
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

export const SEED_TENANT_ADDONS: TenantAddonItem[] = [
  {
    id: "addon-kds-multistation",
    code: "KDS_MULTI_STATION",
    name: "Multi-Station Kitchen Routing",
    categoryTag: "Operasional Dapur & SLA",
    description:
      "Memisahkan tiket pesanan dapur secara otomatis ke stasiun Barista, Kitchen Panas, dan Pastry sesuai kategori menu.",
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
    description:
      "Kalkulasi gramatur resep bahan baku otomatis, estimasi HPP per porsi, dan pemotongan stok bertingkat saat pesanan diproses di kasir.",
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
    description:
      "Kirim struk digital transaksi dan rekapitulasi shift kasir otomatis langsung ke nomor WhatsApp pelanggan dan owner via API Gateway.",
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
    description:
      "Tenant dapat membuat dan mengelola kupon diskon otonom khusus produknya dengan kuota dan batas minimum belanja mandiri.",
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

function isPlainRecord(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === "object" && !Array.isArray(val);
}

function getBrowserStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function readStorageItem(key: string): string | null {
  const storage = getBrowserStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageItem(key: string, value: string): void {
  const storage = getBrowserStorage();
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {}
}

function isSuperAdmin(auth: ServerAuthResult): boolean {
  return Boolean(auth.isAuthenticated && auth.role === "SUPER_ADMIN");
}

function isNonTenantOwner(auth: ServerAuthResult): boolean {
  return Boolean(
    auth.isAuthenticated &&
      auth.role === "OWNER" &&
      auth.scopeLevel !== "TENANT" &&
      !auth.tenantId
  );
}

function isSuperAdminOrOrgOwner(auth: ServerAuthResult): boolean {
  return isSuperAdmin(auth) || isNonTenantOwner(auth);
}

function isTenantOwner(auth: ServerAuthResult): boolean {
  return Boolean(
    auth.isAuthenticated &&
      auth.role === "OWNER" &&
      auth.scopeLevel === "TENANT" &&
      auth.tenantId
  );
}

function hasRoleIn(auth: ServerAuthResult, roles: readonly RoleSlug[]): boolean {
  return Boolean(auth.isAuthenticated && auth.role && roles.includes(auth.role));
}

function normalizeActiveOrgModules(
  modules?: readonly BusinessModuleCode[]
): BusinessModuleCode[] {
  const base =
    Array.isArray(modules) && modules.length > 0
      ? modules
      : DEFAULT_PLATFORM_SETTINGS.activeOrgModules ?? ["CORE", "FNB", "CO_WORKING"];
  const set = new Set<BusinessModuleCode>(["CORE"]);
  for (const mod of base) {
    if (
      mod === "CORE" ||
      mod === "FNB" ||
      mod === "CO_WORKING" ||
      mod === "COMMERCIAL"
    ) {
      set.add(mod);
    }
  }
  return Array.from(set);
}

function normalizeReceiptCombineMode(
  mode: unknown,
  fallback: OutletReceiptCombineMode = "COMBINED"
): OutletReceiptCombineMode {
  return mode === "SEPARATE" || mode === "COMBINED" ? mode : fallback;
}

export function defaultPlatformSettingsState(): PlatformSettingsDomainState {
  return {
    ...DEFAULT_PLATFORM_SETTINGS,
    loyaltyTiers: { ...DEFAULT_PLATFORM_SETTINGS.loyaltyTiers },
    promos: DEFAULT_PLATFORM_SETTINGS.promos.map((p) => ({ ...p })),
    coworkingHolidays: {
      ...DEFAULT_PLATFORM_SETTINGS.coworkingHolidays,
      nationalHolidays: [
        ...DEFAULT_PLATFORM_SETTINGS.coworkingHolidays.nationalHolidays,
      ],
      overrides: [...DEFAULT_PLATFORM_SETTINGS.coworkingHolidays.overrides],
    },
    operationalHours: {
      fnb: { ...DEFAULT_PLATFORM_SETTINGS.operationalHours.fnb },
      coworking: { ...DEFAULT_PLATFORM_SETTINGS.operationalHours.coworking },
    },
    tenantOperations: Object.fromEntries(
      Object.entries(DEFAULT_PLATFORM_SETTINGS.tenantOperations).map(([k, v]) => [
        k,
        { ...v },
      ])
    ),
    eventRevenueSharing: {
      ...DEFAULT_PLATFORM_SETTINGS.eventRevenueSharing,
      history: DEFAULT_PLATFORM_SETTINGS.eventRevenueSharing.history
        ? DEFAULT_PLATFORM_SETTINGS.eventRevenueSharing.history.map((h) => ({ ...h }))
        : undefined,
    },
    categoryTax: DEFAULT_PLATFORM_SETTINGS.categoryTax
      ? {
          fnb: { ...DEFAULT_PLATFORM_SETTINGS.categoryTax.fnb },
          coworking: { ...DEFAULT_PLATFORM_SETTINGS.categoryTax.coworking },
        }
      : {
          fnb: { ...DEFAULT_CATEGORY_TAX_CONFIG.fnb },
          coworking: { ...DEFAULT_CATEGORY_TAX_CONFIG.coworking },
        },
    activeOrgModules: normalizeActiveOrgModules(
      DEFAULT_PLATFORM_SETTINGS.activeOrgModules
    ),
    qrSelfOrderQrisOnly: DEFAULT_PLATFORM_SETTINGS.qrSelfOrderQrisOnly ?? true,
    receiptCombineMode: normalizeReceiptCombineMode(
      DEFAULT_PLATFORM_SETTINGS.receiptCombineMode
    ),
    appliedPromoOpIds: [],
  };
}

export function mergePlatformSettingsState(
  base: PlatformSettingsDomainState,
  patch: Partial<PlatformSettingsDomainState>
): PlatformSettingsDomainState {
  const mergedTenantOps = { ...base.tenantOperations };
  if (isPlainRecord(patch.tenantOperations)) {
    for (const [tenantId, cfg] of Object.entries(patch.tenantOperations)) {
      if (isPlainRecord(cfg)) {
        mergedTenantOps[tenantId] = {
          ...(mergedTenantOps[tenantId] || {}),
          ...cfg,
        };
      }
    }
  }

  return {
    ...base,
    ...patch,
    loyaltyTiers: patch.loyaltyTiers
      ? { ...base.loyaltyTiers, ...patch.loyaltyTiers }
      : base.loyaltyTiers,
    operationalHours: patch.operationalHours
      ? {
          ...base.operationalHours,
          ...patch.operationalHours,
          fnb: patch.operationalHours.fnb
            ? { ...base.operationalHours.fnb, ...patch.operationalHours.fnb }
            : base.operationalHours.fnb,
          coworking: patch.operationalHours.coworking
            ? {
                ...base.operationalHours.coworking,
                ...patch.operationalHours.coworking,
              }
            : base.operationalHours.coworking,
        }
      : base.operationalHours,
    coworkingHolidays: patch.coworkingHolidays
      ? {
          ...base.coworkingHolidays,
          ...patch.coworkingHolidays,
          nationalHolidays:
            patch.coworkingHolidays.nationalHolidays ??
            base.coworkingHolidays.nationalHolidays,
          overrides:
            patch.coworkingHolidays.overrides ??
            base.coworkingHolidays.overrides,
        }
      : base.coworkingHolidays,
    tenantOperations: mergedTenantOps,
    categoryTax: patch.categoryTax
      ? {
          fnb: {
            ...(base.categoryTax?.fnb ?? DEFAULT_CATEGORY_TAX_CONFIG.fnb),
            ...(patch.categoryTax.fnb ?? {}),
          },
          coworking: {
            ...(base.categoryTax?.coworking ??
              DEFAULT_CATEGORY_TAX_CONFIG.coworking),
            ...(patch.categoryTax.coworking ?? {}),
          },
        }
      : base.categoryTax,
    eventRevenueSharing: patch.eventRevenueSharing
      ? {
          ...base.eventRevenueSharing,
          ...patch.eventRevenueSharing,
          history:
            patch.eventRevenueSharing.history ??
            base.eventRevenueSharing.history,
        }
      : base.eventRevenueSharing,
    promos: Array.isArray(patch.promos)
      ? patch.promos.map((p) => ({ ...p }))
      : base.promos,
    activeOrgModules:
      patch.activeOrgModules !== undefined
        ? normalizeActiveOrgModules(patch.activeOrgModules)
        : normalizeActiveOrgModules(base.activeOrgModules),
    qrSelfOrderQrisOnly:
      typeof patch.qrSelfOrderQrisOnly === "boolean"
        ? patch.qrSelfOrderQrisOnly
        : typeof base.qrSelfOrderQrisOnly === "boolean"
          ? base.qrSelfOrderQrisOnly
          : DEFAULT_PLATFORM_SETTINGS.qrSelfOrderQrisOnly ?? true,
    receiptCombineMode: normalizeReceiptCombineMode(
      patch.receiptCombineMode,
      normalizeReceiptCombineMode(base.receiptCombineMode)
    ),
    appliedPromoOpIds: Array.isArray(patch.appliedPromoOpIds)
      ? patch.appliedPromoOpIds.slice(-MAX_APPLIED_OP_IDS)
      : base.appliedPromoOpIds ?? [],
  };
}

export function applyPlatformSettingsCommand(
  current: PlatformSettingsDomainState,
  command: PlatformSettingsCommand
): PlatformSettingsDomainState {
  switch (command.op) {
    case "PATCH_SETTINGS": {
      if (!isPlainRecord(command.patch)) return current;
      return mergePlatformSettingsState(current, command.patch);
    }
    case "TOGGLE_ORG_MODULE": {
      const currentModules = normalizeActiveOrgModules(current.activeOrgModules);
      if (command.moduleCode === "CORE") {
        return { ...current, activeOrgModules: currentModules };
      }
      if (
        command.moduleCode !== "FNB" &&
        command.moduleCode !== "CO_WORKING" &&
        command.moduleCode !== "COMMERCIAL"
      ) {
        return current;
      }
      const nextModules = currentModules.includes(command.moduleCode)
        ? currentModules.filter((m) => m !== command.moduleCode)
        : [...currentModules, command.moduleCode];
      return {
        ...current,
        activeOrgModules: normalizeActiveOrgModules(nextModules),
      };
    }
    case "SAVE_PROMOS": {
      const incoming = Array.isArray(command.promos) ? command.promos : [];
      if (command.tenantScopeId) {
        const scopeId = command.tenantScopeId;
        const preserved = (current.promos || []).filter(
          (p) => p.tenantId !== scopeId
        );
        const scopedIncoming: PromoConfig[] = incoming
          .filter((p) => !p.tenantId || p.tenantId === scopeId)
          .map((p) => ({ ...p, tenantId: scopeId }));
        return {
          ...current,
          promos: [...preserved, ...scopedIncoming],
        };
      }
      return {
        ...current,
        promos: incoming.map((p) => ({ ...p })),
      };
    }
    case "REDEEM_PROMO": {
      const applied = current.appliedPromoOpIds ?? [];
      if (command.opId && applied.includes(command.opId)) {
        return current;
      }
      const res = redeemPromoQuota(
        current.promos || [],
        command.promoIdOrCode,
        command.customerId
      );
      if (!res.success) {
        return current;
      }
      const nextApplied = command.opId
        ? [...applied, command.opId].slice(-MAX_APPLIED_OP_IDS)
        : applied;
      return {
        ...current,
        promos: res.updatedPromos,
        appliedPromoOpIds: nextApplied,
      };
    }
    case "REFUND_PROMO": {
      const applied = current.appliedPromoOpIds ?? [];
      if (command.opId && applied.includes(command.opId)) {
        return current;
      }
      const res = refundPromoQuota(
        current.promos || [],
        command.promoIdOrCode,
        command.customerId
      );
      if (!res.success) {
        return current;
      }
      const nextApplied = command.opId
        ? [...applied, command.opId].slice(-MAX_APPLIED_OP_IDS)
        : applied;
      return {
        ...current,
        promos: res.updatedPromos,
        appliedPromoOpIds: nextApplied,
      };
    }
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}

function isPatchScopedSolelyToTenantOperations(
  patch: Partial<PlatformSettingsDomainState>,
  tenantId: string
): boolean {
  const definedKeys = Object.entries(patch)
    .filter(([, val]) => val !== undefined)
    .map(([key]) => key);
  if (definedKeys.length !== 1 || definedKeys[0] !== "tenantOperations") {
    return false;
  }
  if (!isPlainRecord(patch.tenantOperations)) {
    return false;
  }
  const opTenantIds = Object.keys(patch.tenantOperations);
  return opTenantIds.length === 1 && opTenantIds[0] === tenantId;
}

export const platformSettingsDomainSpec: ServerDomainSpec<"platform-settings"> = {
  domain: "platform-settings",
  filename: "platform_settings.json",
  defaultState: defaultPlatformSettingsState,
  authorizeRead() {
    return { allowed: true };
  },
  authorizeWrite(auth, command) {
    switch (command.op) {
      case "REDEEM_PROMO":
      case "REFUND_PROMO": {
        if (
          typeof command.opId !== "string" ||
          !command.opId.trim() ||
          typeof command.promoIdOrCode !== "string" ||
          !command.promoIdOrCode.trim()
        ) {
          return {
            allowed: false,
            status: 400,
            error: "Payload transaksi promo tidak valid.",
          };
        }
        return { allowed: true };
      }
      case "SAVE_PROMOS": {
        if (!auth.isAuthenticated || !auth.role) {
          return {
            allowed: false,
            status: 401,
            error: auth.error || "UNAUTHORIZED: Autentikasi sesi diperlukan.",
          };
        }
        if (!Array.isArray(command.promos)) {
          return {
            allowed: false,
            status: 400,
            error: "Format daftar promo tidak valid.",
          };
        }
        if (isSuperAdminOrOrgOwner(auth)) {
          return { allowed: true };
        }
        if (
          isTenantOwner(auth) &&
          auth.tenantId &&
          command.tenantScopeId === auth.tenantId &&
          command.promos.every((p) => Boolean(p) && p.tenantId === auth.tenantId)
        ) {
          return { allowed: true };
        }
        return {
          allowed: false,
          status: 403,
          error: "FORBIDDEN: Anda tidak memiliki izin menyimpan daftar promo ini.",
        };
      }
      case "PATCH_SETTINGS": {
        if (!auth.isAuthenticated || !auth.role) {
          return {
            allowed: false,
            status: 401,
            error: auth.error || "UNAUTHORIZED: Autentikasi sesi diperlukan.",
          };
        }
        if (!isPlainRecord(command.patch)) {
          return {
            allowed: false,
            status: 400,
            error: "Payload pengaturan platform tidak valid.",
          };
        }
        if (isSuperAdminOrOrgOwner(auth)) {
          return { allowed: true };
        }
        if (
          isTenantOwner(auth) &&
          auth.tenantId &&
          isPatchScopedSolelyToTenantOperations(command.patch, auth.tenantId)
        ) {
          return { allowed: true };
        }
        return {
          allowed: false,
          status: 403,
          error: "FORBIDDEN: Perubahan konfigurasi global hanya diizinkan untuk Super Admin atau Owner organisasi.",
        };
      }
      case "TOGGLE_ORG_MODULE": {
        if (!auth.isAuthenticated || !auth.role) {
          return {
            allowed: false,
            status: 401,
            error: auth.error || "UNAUTHORIZED: Autentikasi sesi diperlukan.",
          };
        }
        if (isSuperAdminOrOrgOwner(auth)) {
          return { allowed: true };
        }
        return {
          allowed: false,
          status: 403,
          error: "FORBIDDEN: Hanya Super Admin atau Owner organisasi yang dapat mengubah modul.",
        };
      }
      default: {
        const _exhaustive: never = command;
        return _exhaustive;
      }
    }
  },
  applyCommand(current, command) {
    return applyPlatformSettingsCommand(current, command);
  },
};

function createPlatformSettingsMirror(): LocalStorageMirrorAdapter<PlatformSettingsDomainState> {
  let cachedRaw: string | null | undefined;
  let cachedState: PlatformSettingsDomainState | null = null;

  return {
    keys: [STORAGE_KEY_PLATFORM_SETTINGS],
    readFromStorage(fallback) {
      const raw = readStorageItem(STORAGE_KEY_PLATFORM_SETTINGS);
      if (cachedState !== null && raw === cachedRaw) {
        return cachedState;
      }
      cachedRaw = raw;
      if (!raw) {
        cachedState = fallback;
        return fallback;
      }
      try {
        const parsed = JSON.parse(raw) as Partial<PlatformSettingsDomainState>;
        if (isPlainRecord(parsed)) {
          cachedState = mergePlatformSettingsState(fallback, parsed);
          return cachedState;
        }
      } catch {}
      cachedState = fallback;
      return fallback;
    },
    writeToStorage(state) {
      const serialized = JSON.stringify(state);
      cachedRaw = serialized;
      cachedState = state;
      writeStorageItem(STORAGE_KEY_PLATFORM_SETTINGS, serialized);
    },
  };
}

export const platformSettingsStorageMirror = createPlatformSettingsMirror();

export const platformSettingsSyncClient = createSyncedDomainClient({
  domain: "platform-settings",
  defaultState: defaultPlatformSettingsState,
  storageMirror: platformSettingsStorageMirror,
  applyCommandLocally: applyPlatformSettingsCommand,
});

export function buildTenantProfileWithDefaults(
  tenantId: string,
  partial?: Partial<TenantProfileData> | null,
  customTenants: readonly FnbPartnerInfo[] = []
): TenantProfileData {
  const fnbInfo =
    SEED_FNB_TENANTS.find((t) => t.id === tenantId) ||
    customTenants.find((t) => t.id === tenantId) || {
      id: tenantId,
      code: tenantId.toUpperCase(),
      name: tenantId,
      tagline: "Mitra Resmi Dago Creative Hub",
      desc: "Mitra kuliner terdaftar di Dago Creative Hub.",
      badge: "Official Mitra",
      icon: "Utensils",
    };

  const def = SEED_TENANT_PROFILES[tenantId] || {
    brandName: fnbInfo.name,
    tagline: fnbInfo.tagline,
    description: fnbInfo.desc,
    contactPhone: OFFICIAL_CS_DISPLAY_PHONE,
    receiptHeader: `${fnbInfo.name} — ${fnbInfo.tagline}`,
    receiptFooter: `Terima kasih telah berkunjung ke ${fnbInfo.name}!`,
    lowStockThresholdPercent: 30,
    bankName: "BCA",
    bankAccountNumber: "-",
    bankAccountHolder: "-",
    status: "ACTIVE" as const,
  };

  if (partial) {
    return {
      tenantId,
      brandName: partial.brandName || def.brandName || fnbInfo.name,
      tagline: partial.tagline || def.tagline || "",
      description: partial.description || def.description || "",
      contactPhone: partial.contactPhone || def.contactPhone || "",
      receiptHeader: partial.receiptHeader || def.receiptHeader || "",
      receiptFooter: partial.receiptFooter || def.receiptFooter || "",
      lowStockThresholdPercent:
        partial.lowStockThresholdPercent !== undefined
          ? partial.lowStockThresholdPercent
          : def.lowStockThresholdPercent || 30,
      bankName: partial.bankName || def.bankName || "BCA",
      bankAccountNumber:
        partial.bankAccountNumber !== undefined && partial.bankAccountNumber !== ""
          ? partial.bankAccountNumber
          : def.bankAccountNumber || "",
      bankAccountHolder:
        partial.bankAccountHolder || def.bankAccountHolder || "",
      status: partial.status === "INACTIVE" ? "INACTIVE" : def.status || "ACTIVE",
    };
  }

  return {
    tenantId,
    brandName: def.brandName || fnbInfo.name,
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

export function defaultTenantsState(): TenantsDomainState {
  const profiles: Record<string, TenantProfileData> = {};
  for (const tenant of SEED_FNB_TENANTS) {
    profiles[tenant.id] = buildTenantProfileWithDefaults(tenant.id);
  }
  return {
    customTenants: [],
    profiles,
  };
}

export function maskTenantBankAccountNumber(raw?: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed || trimmed === "-") return "";
  if (trimmed.startsWith("••••")) return trimmed;
  const clean = trimmed.replace(/\s+/g, "");
  if (!clean || clean === "-") return "";
  const last4 = clean.slice(-4);
  return `•••• •••• ${last4}`;
}

export function applyTenantsCommand(
  current: TenantsDomainState,
  command: TenantsCommand
): TenantsDomainState {
  switch (command.op) {
    case "UPSERT_CUSTOM_TENANT": {
      const incoming = command.tenant;
      const list = [...(current.customTenants || [])];
      const existingIdx = list.findIndex((t) => t.id === incoming.id);
      if (existingIdx >= 0) {
        list[existingIdx] = { ...incoming };
      } else {
        list.push({ ...incoming });
      }
      return {
        ...current,
        customTenants: list,
      };
    }
    case "UPSERT_PROFILE": {
      const tid = command.profile.tenantId;
      const existing = current.profiles[tid];
      const preservedBankNumber =
        command.profile.bankAccountNumber?.includes("•") &&
        existing?.bankAccountNumber &&
        !existing.bankAccountNumber.includes("•")
          ? existing.bankAccountNumber
          : command.profile.bankAccountNumber;

      const merged = buildTenantProfileWithDefaults(
        tid,
        {
          ...(existing || {}),
          ...command.profile,
          bankAccountNumber: preservedBankNumber,
        },
        current.customTenants
      );
      return {
        ...current,
        profiles: {
          ...current.profiles,
          [tid]: merged,
        },
      };
    }
    case "SET_TENANT_STATUS": {
      const tid = command.tenantId;
      const existing =
        current.profiles[tid] ||
        buildTenantProfileWithDefaults(tid, null, current.customTenants);
      return {
        ...current,
        profiles: {
          ...current.profiles,
          [tid]: {
            ...existing,
            tenantId: tid,
            status: command.status,
          },
        },
      };
    }
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}

export const tenantsDomainSpec: ServerDomainSpec<"tenants"> = {
  domain: "tenants",
  filename: "tenants_directory.json",
  defaultState: defaultTenantsState,
  authorizeRead(auth) {
    return {
      allowed: true,
      transform(state) {
        if (isSuperAdminOrOrgOwner(auth)) {
          return state;
        }
        const maskedProfiles: Record<string, TenantProfileData> = {};
        for (const [tenantId, profile] of Object.entries(state.profiles || {})) {
          const canReadRawBank =
            isTenantOwner(auth) && Boolean(auth.tenantId) && auth.tenantId === tenantId;
          maskedProfiles[tenantId] = canReadRawBank
            ? { ...profile }
            : {
                ...profile,
                bankAccountNumber: maskTenantBankAccountNumber(
                  profile.bankAccountNumber
                ),
              };
        }
        return {
          customTenants: (state.customTenants || []).map((t) => ({ ...t })),
          profiles: maskedProfiles,
        };
      },
    };
  },
  authorizeWrite(auth, command) {
    if (!auth.isAuthenticated || !auth.role) {
      return {
        allowed: false,
        status: 401,
        error: auth.error || "UNAUTHORIZED: Autentikasi sesi diperlukan.",
      };
    }
    switch (command.op) {
      case "UPSERT_CUSTOM_TENANT": {
        if (!command.tenant?.id) {
          return { allowed: false, status: 400, error: "Data mitra baru tidak valid." };
        }
        if (isSuperAdminOrOrgOwner(auth)) {
          return { allowed: true };
        }
        return {
          allowed: false,
          status: 403,
          error: "FORBIDDEN: Hanya Super Admin atau Owner organisasi yang dapat mendaftarkan mitra.",
        };
      }
      case "SET_TENANT_STATUS": {
        if (!command.tenantId || (command.status !== "ACTIVE" && command.status !== "INACTIVE")) {
          return { allowed: false, status: 400, error: "Status mitra tidak valid." };
        }
        if (isSuperAdminOrOrgOwner(auth)) {
          return { allowed: true };
        }
        return {
          allowed: false,
          status: 403,
          error: "FORBIDDEN: Hanya Super Admin atau Owner organisasi yang dapat mengubah status mitra.",
        };
      }
      case "UPSERT_PROFILE": {
        if (!command.profile?.tenantId) {
          return { allowed: false, status: 400, error: "Profil mitra tidak valid." };
        }
        if (isSuperAdminOrOrgOwner(auth)) {
          return { allowed: true };
        }
        if (isTenantOwner(auth) && auth.tenantId === command.profile.tenantId) {
          return { allowed: true };
        }
        return {
          allowed: false,
          status: 403,
          error: "FORBIDDEN: Anda hanya dapat mengubah profil gerai milik sendiri.",
        };
      }
      default: {
        const _exhaustive: never = command;
        return _exhaustive;
      }
    }
  },
  applyCommand(current, command) {
    return applyTenantsCommand(current, command);
  },
};

function createTenantsMirror(): LocalStorageMirrorAdapter<TenantsDomainState> {
  let cachedSig: string | undefined;
  let cachedState: TenantsDomainState | null = null;

  return {
    keys: [STORAGE_KEY_TENANT_SETTINGS, STORAGE_KEY_CUSTOM_TENANTS],
    legacyWindowEvents: ["tenant_settings_updated"],
    readFromStorage(fallback) {
      const rawProfiles = readStorageItem(STORAGE_KEY_TENANT_SETTINGS);
      const rawCustom = readStorageItem(STORAGE_KEY_CUSTOM_TENANTS);
      const sig = `${rawProfiles ?? ""}\u0000${rawCustom ?? ""}`;
      if (cachedState !== null && sig === cachedSig) {
        return cachedState;
      }
      cachedSig = sig;

      let customTenants = fallback.customTenants;
      if (rawCustom) {
        try {
          const parsedCustom = JSON.parse(rawCustom);
          if (Array.isArray(parsedCustom)) {
            customTenants = parsedCustom as FnbPartnerInfo[];
          }
        } catch {}
      }

      const profiles: Record<string, TenantProfileData> = { ...fallback.profiles };
      if (rawProfiles) {
        try {
          const parsed = JSON.parse(rawProfiles);
          if (isPlainRecord(parsed)) {
            const normalizedMap: Record<string, Partial<TenantProfileData>> =
              typeof parsed.tenantId === "string"
                ? { [parsed.tenantId]: parsed as Partial<TenantProfileData> }
                : (parsed as Record<string, Partial<TenantProfileData>>);
            for (const [tid, entry] of Object.entries(normalizedMap)) {
              if (isPlainRecord(entry)) {
                profiles[tid] = buildTenantProfileWithDefaults(
                  tid,
                  entry as Partial<TenantProfileData>,
                  customTenants
                );
              }
            }
          }
        } catch {}
      }

      cachedState = { customTenants, profiles };
      return cachedState;
    },
    writeToStorage(state) {
      const profilesJson = JSON.stringify(state.profiles);
      const customJson = JSON.stringify(state.customTenants);
      cachedSig = `${profilesJson}\u0000${customJson}`;
      cachedState = state;
      writeStorageItem(STORAGE_KEY_TENANT_SETTINGS, profilesJson);
      writeStorageItem(STORAGE_KEY_CUSTOM_TENANTS, customJson);
    },
  };
}

export const tenantsStorageMirror = createTenantsMirror();

export const tenantsSyncClient = createSyncedDomainClient({
  domain: "tenants",
  defaultState: defaultTenantsState,
  storageMirror: tenantsStorageMirror,
  applyCommandLocally: applyTenantsCommand,
});

export function defaultWifiState(): WifiDomainState {
  return {
    calcBasis: "GRAND_TOTAL",
    fnbRules: SEED_FNB_WIFI_RULES.map((r) => ({ ...r })),
    cwRules: SEED_COWORKING_WIFI_RULES.map((r) => ({ ...r })),
    vouchers: SEED_DEMO_WIFI_VOUCHERS.map((v) => ({ ...v })),
  };
}

export function capWifiVouchersList(
  vouchers: readonly WifiVoucherRecord[],
  maxCount = MAX_WIFI_VOUCHERS
): WifiVoucherRecord[] {
  if (vouchers.length <= maxCount) {
    return [...vouchers];
  }
  let toDrop = vouchers.length - maxCount;
  const droppedIndices = new Set<number>();
  for (let i = vouchers.length - 1; i >= 0 && toDrop > 0; i -= 1) {
    if (vouchers[i].status !== "ACTIVE") {
      droppedIndices.add(i);
      toDrop -= 1;
    }
  }
  return vouchers.filter((_, idx) => !droppedIndices.has(idx));
}

export function applyWifiCommand(
  current: WifiDomainState,
  command: WifiCommand
): WifiDomainState {
  switch (command.op) {
    case "SET_CALC_BASIS": {
      if (command.calcBasis !== "GRAND_TOTAL" && command.calcBasis !== "NET_SALES") {
        return current;
      }
      return {
        ...current,
        calcBasis: command.calcBasis,
      };
    }
    case "SAVE_FNB_RULES": {
      return {
        ...current,
        fnbRules: (command.rules || []).map((r) => ({ ...r })),
      };
    }
    case "SAVE_CW_RULES": {
      return {
        ...current,
        cwRules: (command.rules || []).map((r) => ({ ...r })),
      };
    }
    case "ISSUE_VOUCHER": {
      const incoming = command.voucher;
      if (!incoming) return current;
      const refId = (incoming.referenceId || "").trim();
      if (refId) {
        const existing = current.vouchers.find((v) => v.referenceId === refId);
        if (existing) {
          return current;
        }
      }
      const existingById = current.vouchers.find((v) => v.id === incoming.id);
      if (existingById) {
        return current;
      }
      return {
        ...current,
        vouchers: capWifiVouchersList([
          { ...incoming },
          ...current.vouchers,
        ]),
      };
    }
    case "REVOKE_VOUCHER": {
      const target = (command.voucherIdOrRef || "").trim();
      if (!target) return current;
      let changed = false;
      const updated = current.vouchers.map((v) => {
        if ((v.id === target || v.referenceId === target) && v.status !== "CANCELLED") {
          changed = true;
          return { ...v, status: "CANCELLED" as WifiVoucherStatus };
        }
        return v;
      });
      return changed ? { ...current, vouchers: updated } : current;
    }
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}

export const wifiDomainSpec: ServerDomainSpec<"wifi"> = {
  domain: "wifi",
  filename: "wifi_state.json",
  defaultState: defaultWifiState,
  authorizeRead() {
    return { allowed: true };
  },
  authorizeWrite(auth, command) {
    if (!auth.isAuthenticated || !auth.role) {
      return {
        allowed: false,
        status: 401,
        error: auth.error || "UNAUTHORIZED: Autentikasi sesi diperlukan.",
      };
    }
    switch (command.op) {
      case "ISSUE_VOUCHER": {
        if (!command.voucher?.voucherCode) {
          return { allowed: false, status: 400, error: "Data voucher Wi-Fi tidak valid." };
        }
        if (
          hasRoleIn(auth, ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER", "CUSTOMER"])
        ) {
          return { allowed: true };
        }
        return {
          allowed: false,
          status: 403,
          error: "FORBIDDEN: Role tidak diizinkan menerbitkan voucher Wi-Fi.",
        };
      }
      case "REVOKE_VOUCHER": {
        if (!command.voucherIdOrRef) {
          return { allowed: false, status: 400, error: "ID referensi voucher wajib diisi." };
        }
        if (hasRoleIn(auth, ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"])) {
          return { allowed: true };
        }
        return {
          allowed: false,
          status: 403,
          error: "FORBIDDEN: Hanya staf operasional yang dapat mencabut voucher Wi-Fi.",
        };
      }
      case "SET_CALC_BASIS":
      case "SAVE_FNB_RULES":
      case "SAVE_CW_RULES": {
        if (isSuperAdminOrOrgOwner(auth) || auth.role === "MANAGER") {
          return { allowed: true };
        }
        return {
          allowed: false,
          status: 403,
          error: "FORBIDDEN: Pengaturan aturan Wi-Fi hanya diizinkan untuk Super Admin, Owner organisasi, atau Manager.",
        };
      }
      default: {
        const _exhaustive: never = command;
        return _exhaustive;
      }
    }
  },
  applyCommand(current, command) {
    return applyWifiCommand(current, command);
  },
};

function createWifiMirror(): LocalStorageMirrorAdapter<WifiDomainState> {
  let cachedSig: string | undefined;
  let cachedState: WifiDomainState | null = null;

  return {
    keys: [
      STORAGE_KEY_WIFI_FNB_RULES,
      STORAGE_KEY_WIFI_CW_RULES,
      STORAGE_KEY_WIFI_VOUCHERS,
      STORAGE_KEY_WIFI_CALC_BASIS,
    ],
    legacyWindowEvents: [
      "wifi_calc_basis_updated",
      "wifi_rules_updated",
      "wifi_vouchers_updated",
    ],
    readFromStorage(fallback) {
      const rawBasis = readStorageItem(STORAGE_KEY_WIFI_CALC_BASIS);
      const rawFnb = readStorageItem(STORAGE_KEY_WIFI_FNB_RULES);
      const rawCw = readStorageItem(STORAGE_KEY_WIFI_CW_RULES);
      const rawVouchers = readStorageItem(STORAGE_KEY_WIFI_VOUCHERS);
      const sig = `${rawBasis ?? ""}\u0000${rawFnb ?? ""}\u0000${rawCw ?? ""}\u0000${rawVouchers ?? ""}`;
      if (cachedState !== null && sig === cachedSig) {
        return cachedState;
      }
      cachedSig = sig;

      const calcBasis: WifiCalculationBasis =
        rawBasis === "GRAND_TOTAL" || rawBasis === "NET_SALES"
          ? rawBasis
          : fallback.calcBasis;

      let fnbRules = fallback.fnbRules;
      if (rawFnb) {
        try {
          const parsed = JSON.parse(rawFnb);
          if (Array.isArray(parsed) && parsed.length > 0) {
            fnbRules = parsed as WifiFnBRule[];
          }
        } catch {}
      }

      let cwRules = fallback.cwRules;
      if (rawCw) {
        try {
          const parsed = JSON.parse(rawCw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            cwRules = parsed as WifiCoworkingRule[];
          }
        } catch {}
      }

      let vouchers = fallback.vouchers;
      if (rawVouchers) {
        try {
          const parsed = JSON.parse(rawVouchers);
          if (Array.isArray(parsed) && parsed.length > 0) {
            vouchers = parsed as WifiVoucherRecord[];
          }
        } catch {}
      }

      cachedState = { calcBasis, fnbRules, cwRules, vouchers };
      return cachedState;
    },
    writeToStorage(state) {
      const basisStr = state.calcBasis;
      const fnbJson = JSON.stringify(state.fnbRules);
      const cwJson = JSON.stringify(state.cwRules);
      const vouchersJson = JSON.stringify(state.vouchers);
      cachedSig = `${basisStr}\u0000${fnbJson}\u0000${cwJson}\u0000${vouchersJson}`;
      cachedState = state;
      writeStorageItem(STORAGE_KEY_WIFI_CALC_BASIS, basisStr);
      writeStorageItem(STORAGE_KEY_WIFI_FNB_RULES, fnbJson);
      writeStorageItem(STORAGE_KEY_WIFI_CW_RULES, cwJson);
      writeStorageItem(STORAGE_KEY_WIFI_VOUCHERS, vouchersJson);
    },
  };
}

export const wifiStorageMirror = createWifiMirror();

export const wifiSyncClient = createSyncedDomainClient({
  domain: "wifi",
  defaultState: defaultWifiState,
  storageMirror: wifiStorageMirror,
  applyCommandLocally: applyWifiCommand,
});

export function normalizeSubscriptionScopeKey(scopeId?: string | null): string {
  const clean = (scopeId || "").trim();
  if (!clean || clean === "default" || clean === "org-dago-hub") {
    return "org-dago-hub";
  }
  return clean;
}

export function defaultOrgSubscriptionState(): OrgSubscriptionState {
  return {
    organizationId: "org-dago-hub",
    organizationName: "Dago Creative Hub",
    planTier: "PROFESSIONAL",
    planName: SEED_PLATFORM_PLANS.PROFESSIONAL.name,
    status: "ACTIVE",
    statusLabel: "Aktif",
    billingCycle: "TAHUNAN",
    activeSince: "14 Januari 2026",
    nextRenewalDate: "14 Oktober 2027",
    isSimulated: false,
    notes:
      "Paket tier saat ini dikonfigurasi sebagai Professional Hybrid Hub untuk mengoperasikan unit bisnis F&B multi-mitra dan Co-working Space.",
  };
}

export function defaultSubscriptionState(): SubscriptionDomainState {
  return {
    orgSubscription: defaultOrgSubscriptionState(),
    addonsByScope: {
      "org-dago-hub": SEED_TENANT_ADDONS.map((a) => ({ ...a })),
    },
  };
}

export function applySubscriptionCommand(
  current: SubscriptionDomainState,
  command: SubscriptionCommand
): SubscriptionDomainState {
  switch (command.op) {
    case "SET_ORG_PLAN": {
      const plan = SEED_PLATFORM_PLANS[command.planTier];
      if (!plan) return current;
      return {
        ...current,
        orgSubscription: {
          ...current.orgSubscription,
          planTier: command.planTier,
          planName: plan.name,
          status: "ACTIVE",
          statusLabel: "Aktif",
          isSimulated: false,
        },
      };
    }
    case "TOGGLE_ADDON": {
      const scopeKey = normalizeSubscriptionScopeKey(command.scopeId);
      const existingList =
        current.addonsByScope[scopeKey] ??
        SEED_TENANT_ADDONS.map((a) => ({ ...a }));
      const nextList = existingList.map((item) => {
        if (
          item.id === command.addonIdOrCode ||
          item.code === command.addonIdOrCode
        ) {
          const nextStatus: "ACTIVE" | "INACTIVE" =
            item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
          return { ...item, status: nextStatus };
        }
        return item;
      });
      return {
        ...current,
        addonsByScope: {
          ...current.addonsByScope,
          [scopeKey]: nextList,
        },
      };
    }
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}

export const subscriptionDomainSpec: ServerDomainSpec<"subscription"> = {
  domain: "subscription",
  filename: "subscription_state.json",
  defaultState: defaultSubscriptionState,
  authorizeRead() {
    return { allowed: true };
  },
  authorizeWrite(auth, command) {
    if (!auth.isAuthenticated || !auth.role) {
      return {
        allowed: false,
        status: 401,
        error: auth.error || "UNAUTHORIZED: Autentikasi sesi diperlukan.",
      };
    }
    switch (command.op) {
      case "SET_ORG_PLAN": {
        if (!SEED_PLATFORM_PLANS[command.planTier]) {
          return { allowed: false, status: 400, error: "Paket langganan tidak dikenali." };
        }
        if (isSuperAdminOrOrgOwner(auth)) {
          return { allowed: true };
        }
        return {
          allowed: false,
          status: 403,
          error: "FORBIDDEN: Hanya Super Admin atau Owner organisasi yang dapat mengubah paket langganan.",
        };
      }
      case "TOGGLE_ADDON": {
        if (!command.addonIdOrCode || !command.addonIdOrCode.trim()) {
          return { allowed: false, status: 400, error: "ID add-on tidak valid." };
        }
        if (isSuperAdminOrOrgOwner(auth)) {
          return { allowed: true };
        }
        if (isTenantOwner(auth) && auth.tenantId && command.scopeId === auth.tenantId) {
          return { allowed: true };
        }
        return {
          allowed: false,
          status: 403,
          error: "FORBIDDEN: Anda hanya dapat mengubah status add-on untuk cakupan gerai sendiri.",
        };
      }
      default: {
        const _exhaustive: never = command;
        return _exhaustive;
      }
    }
  },
  applyCommand(current, command) {
    return applySubscriptionCommand(current, command);
  },
};

function discoverAddonScopesInStorage(): string[] {
  const scopes = new Set<string>(["org-dago-hub"]);
  const rawScopes = readStorageItem(STORAGE_KEY_TENANT_ADDON_SCOPES);
  if (rawScopes) {
    try {
      const parsed = JSON.parse(rawScopes);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === "string" && item.trim()) {
            scopes.add(normalizeSubscriptionScopeKey(item));
          }
        }
      }
    } catch {}
  }

  const storage = getBrowserStorage();
  if (storage && typeof storage.length === "number" && typeof storage.key === "function") {
    const prefix = `${STORAGE_KEY_TENANT_ADDONS}_`;
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i);
      if (k && k.startsWith(prefix) && k !== STORAGE_KEY_TENANT_ADDON_SCOPES) {
        const suffix = k.slice(prefix.length);
        if (suffix) {
          scopes.add(normalizeSubscriptionScopeKey(suffix));
        }
      }
    }
  }
  return Array.from(scopes);
}

function createSubscriptionMirror(): LocalStorageMirrorAdapter<SubscriptionDomainState> {
  let cachedSig: string | undefined;
  let cachedState: SubscriptionDomainState | null = null;

  return {
    keys: [
      STORAGE_KEY_ORG_SUBSCRIPTION,
      STORAGE_KEY_TENANT_ADDONS,
      STORAGE_KEY_TENANT_ADDON_SCOPES,
    ],
    legacyWindowEvents: ["subscription_state_updated"],
    readFromStorage(fallback) {
      const rawOrg = readStorageItem(STORAGE_KEY_ORG_SUBSCRIPTION);
      const rawDefaultAddons = readStorageItem(STORAGE_KEY_TENANT_ADDONS);
      const scopeKeys = discoverAddonScopesInStorage();
      const scopePayloads: Array<[string, string | null]> = scopeKeys.map((sk) => [
        sk,
        readStorageItem(`${STORAGE_KEY_TENANT_ADDONS}_${sk}`),
      ]);
      const sig = [
        rawOrg ?? "",
        rawDefaultAddons ?? "",
        ...scopePayloads.map(([sk, raw]) => `${sk}=${raw ?? ""}`),
      ].join("\u0000");

      if (cachedState !== null && sig === cachedSig) {
        return cachedState;
      }
      cachedSig = sig;

      let orgSubscription = fallback.orgSubscription;
      if (rawOrg) {
        try {
          const parsed = JSON.parse(rawOrg) as Partial<OrgSubscriptionState>;
          if (
            isPlainRecord(parsed) &&
            typeof parsed.planTier === "string" &&
            SEED_PLATFORM_PLANS[parsed.planTier as PlanTier]
          ) {
            const tier = parsed.planTier as PlanTier;
            orgSubscription = {
              ...fallback.orgSubscription,
              ...parsed,
              planTier: tier,
              planName: SEED_PLATFORM_PLANS[tier].name,
            };
          }
        } catch {}
      }

      const addonsByScope: Record<string, TenantAddonItem[]> = {
        ...fallback.addonsByScope,
      };
      if (rawDefaultAddons) {
        try {
          const parsed = JSON.parse(rawDefaultAddons);
          if (Array.isArray(parsed) && parsed.length > 0) {
            addonsByScope["org-dago-hub"] = parsed as TenantAddonItem[];
          }
        } catch {}
      }
      for (const [scopeKey, rawVal] of scopePayloads) {
        if (!rawVal) continue;
        try {
          const parsed = JSON.parse(rawVal);
          if (Array.isArray(parsed) && parsed.length > 0) {
            addonsByScope[scopeKey] = parsed as TenantAddonItem[];
          }
        } catch {}
      }

      cachedState = { orgSubscription, addonsByScope };
      return cachedState;
    },
    writeToStorage(state) {
      const orgJson = JSON.stringify(state.orgSubscription);
      writeStorageItem(STORAGE_KEY_ORG_SUBSCRIPTION, orgJson);

      const scopeKeys = Array.from(
        new Set<string>(["org-dago-hub", ...Object.keys(state.addonsByScope)])
      );
      writeStorageItem(STORAGE_KEY_TENANT_ADDON_SCOPES, JSON.stringify(scopeKeys));

      const orgAddons =
        state.addonsByScope["org-dago-hub"] ??
        SEED_TENANT_ADDONS.map((a) => ({ ...a }));
      const orgAddonsJson = JSON.stringify(orgAddons);
      writeStorageItem(STORAGE_KEY_TENANT_ADDONS, orgAddonsJson);

      const scopePayloads: string[] = [];
      for (const sk of scopeKeys) {
        const list =
          state.addonsByScope[sk] ?? SEED_TENANT_ADDONS.map((a) => ({ ...a }));
        const json = JSON.stringify(list);
        writeStorageItem(`${STORAGE_KEY_TENANT_ADDONS}_${sk}`, json);
        scopePayloads.push(`${sk}=${json}`);
      }

      cachedSig = [orgJson, orgAddonsJson, ...scopePayloads].join("\u0000");
      cachedState = state;
    },
  };
}

export const subscriptionStorageMirror = createSubscriptionMirror();

export const subscriptionSyncClient = createSyncedDomainClient({
  domain: "subscription",
  defaultState: defaultSubscriptionState,
  storageMirror: subscriptionStorageMirror,
  applyCommandLocally: applySubscriptionCommand,
});

export function defaultPrinterConfigState(): PrinterConfigDomainState {
  return {
    devices: DEFAULT_PRINTER_DEVICES.map((d) => ({ ...d })),
    settings: {
      ...DEFAULT_PRINTING_SETTINGS,
      cashierReceiptRoles: [
        ...(DEFAULT_PRINTING_SETTINGS.cashierReceiptRoles ?? []),
      ],
      kitchenReceiptRoles: [
        ...(DEFAULT_PRINTING_SETTINGS.kitchenReceiptRoles ?? []),
      ],
    },
  };
}

export function applyPrinterConfigCommand(
  current: PrinterConfigDomainState,
  command: PrinterConfigCommand
): PrinterConfigDomainState {
  switch (command.op) {
    case "UPSERT_DEVICE": {
      const incoming = command.device;
      if (!incoming?.id) return current;
      let nextDevices = current.devices.map((d) => ({ ...d }));
      if (incoming.isDefaultKitchen) {
        nextDevices = nextDevices.map((d) =>
          d.outletId === incoming.outletId && d.id !== incoming.id
            ? { ...d, isDefaultKitchen: false }
            : d
        );
      }
      if (incoming.isDefaultCustomer) {
        nextDevices = nextDevices.map((d) =>
          d.outletId === incoming.outletId && d.id !== incoming.id
            ? { ...d, isDefaultCustomer: false }
            : d
        );
      }
      const existingIdx = nextDevices.findIndex((d) => d.id === incoming.id);
      if (existingIdx >= 0) {
        nextDevices[existingIdx] = { ...incoming };
      } else {
        nextDevices.push({ ...incoming });
      }
      return {
        ...current,
        devices: nextDevices,
      };
    }
    case "DELETE_DEVICE": {
      return {
        ...current,
        devices: current.devices.filter((d) => d.id !== command.deviceId),
      };
    }
    case "PATCH_SETTINGS": {
      if (!isPlainRecord(command.updates)) return current;
      const nextSettings: POSPrintingSettings = {
        ...current.settings,
        ...command.updates,
      };
      return {
        ...current,
        settings: nextSettings,
      };
    }
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}

export const printerConfigDomainSpec: ServerDomainSpec<"printer-config"> = {
  domain: "printer-config",
  filename: "printer_config.json",
  defaultState: defaultPrinterConfigState,
  authorizeRead() {
    return { allowed: true };
  },
  authorizeWrite(auth, command) {
    if (!auth.isAuthenticated || !auth.role) {
      return {
        allowed: false,
        status: 401,
        error: auth.error || "UNAUTHORIZED: Autentikasi sesi diperlukan.",
      };
    }
    if (!hasRoleIn(auth, ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"])) {
      return {
        allowed: false,
        status: 403,
        error: "FORBIDDEN: Anda tidak memiliki izin mengubah konfigurasi perangkat cetak.",
      };
    }
    switch (command.op) {
      case "UPSERT_DEVICE": {
        if (!command.device?.id || !command.device?.name) {
          return { allowed: false, status: 400, error: "Data perangkat printer tidak valid." };
        }
        return { allowed: true };
      }
      case "DELETE_DEVICE": {
        if (!command.deviceId) {
          return { allowed: false, status: 400, error: "ID printer wajib diisi." };
        }
        return { allowed: true };
      }
      case "PATCH_SETTINGS": {
        if (!isPlainRecord(command.updates)) {
          return { allowed: false, status: 400, error: "Pengaturan cetak tidak valid." };
        }
        return { allowed: true };
      }
      default: {
        const _exhaustive: never = command;
        return _exhaustive;
      }
    }
  },
  applyCommand(current, command) {
    return applyPrinterConfigCommand(current, command);
  },
};

function createPrinterConfigMirror(): LocalStorageMirrorAdapter<PrinterConfigDomainState> {
  let cachedSig: string | undefined;
  let cachedState: PrinterConfigDomainState | null = null;

  return {
    keys: [STORAGE_KEY_PRINTER_DEVICES_MIRROR, STORAGE_KEY_PRINTER_SETTINGS_MIRROR],
    readFromStorage(fallback) {
      const rawDevices = readStorageItem(STORAGE_KEY_PRINTER_DEVICES_MIRROR);
      const rawSettings = readStorageItem(STORAGE_KEY_PRINTER_SETTINGS_MIRROR);
      const sig = `${rawDevices ?? ""}\u0000${rawSettings ?? ""}`;
      if (cachedState !== null && sig === cachedSig) {
        return cachedState;
      }
      cachedSig = sig;

      let devices = fallback.devices;
      if (rawDevices) {
        try {
          const parsed = JSON.parse(rawDevices);
          if (Array.isArray(parsed) && parsed.length > 0) {
            devices = parsed as PrinterDeviceConfig[];
          }
        } catch {}
      }

      let settings: POSPrintingSettings = fallback.settings;
      if (rawSettings) {
        try {
          const parsed = JSON.parse(rawSettings);
          if (isPlainRecord(parsed)) {
            settings = {
              ...fallback.settings,
              ...(parsed as Partial<POSPrintingSettings>),
            };
          }
        } catch {}
      }

      cachedState = { devices, settings };
      return cachedState;
    },
    writeToStorage(state) {
      const devicesJson = JSON.stringify(state.devices);
      const settingsJson = JSON.stringify(state.settings);
      cachedSig = `${devicesJson}\u0000${settingsJson}`;
      cachedState = state;
      writeStorageItem(STORAGE_KEY_PRINTER_DEVICES_MIRROR, devicesJson);
      writeStorageItem(STORAGE_KEY_PRINTER_SETTINGS_MIRROR, settingsJson);
    },
  };
}

export const printerConfigStorageMirror = createPrinterConfigMirror();

export const printerConfigSyncClient = createSyncedDomainClient({
  domain: "printer-config",
  defaultState: defaultPrinterConfigState,
  storageMirror: printerConfigStorageMirror,
  applyCommandLocally: applyPrinterConfigCommand,
});

export function mutateConfigDomain<D extends ConfigSyncDomainName>(
  client: SyncedDomainClient<D>,
  storageMirror: LocalStorageMirrorAdapter<DomainStateMap[D]>,
  optimisticUpdater: (prev: DomainStateMap[D]) => DomainStateMap[D],
  descriptor: OutboxCommandDescriptor<D> | null
): DomainStateMap[D] {
  if (typeof window !== "undefined" && typeof window.addEventListener !== "function") {
    const prev = client.getSnapshot();
    const next = optimisticUpdater(prev);
    storageMirror.writeToStorage(next);
    if (typeof window.dispatchEvent === "function" && storageMirror.legacyWindowEvents) {
      for (const evtName of storageMirror.legacyWindowEvents) {
        try {
          window.dispatchEvent(new Event(evtName));
        } catch {}
      }
    }
    return next;
  }
  if (typeof window !== "undefined" && process.env.NODE_ENV === "test") {
    client.reloadFromStorage();
  }
  let computed: DomainStateMap[D] | null = null;
  client.mutate((prev) => {
    const next = optimisticUpdater(prev);
    computed = next;
    return next;
  }, descriptor);
  return computed ?? client.getSnapshot();
}

export const CONFIG_DOMAIN_SPECS: {
  [K in ConfigSyncDomainName]: ServerDomainSpec<K>;
} = {
  "platform-settings": platformSettingsDomainSpec,
  tenants: tenantsDomainSpec,
  wifi: wifiDomainSpec,
  subscription: subscriptionDomainSpec,
  "printer-config": printerConfigDomainSpec,
};
