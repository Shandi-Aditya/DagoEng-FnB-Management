export type LanguageCode = "id" | "en";
import { PromoConfig } from "../lib/promo";
import {
  CoworkingHolidayConfig,
  ServiceOperationalHours,
  TenantOperationConfig,
  DEFAULT_COWORKING_HOLIDAY_CONFIG,
  DEFAULT_OPERATIONAL_HOURS,
  DEFAULT_TENANT_OPERATIONS,
} from "../lib/operating-hours";

export interface LoyaltyTierConfig {
  bronzeMin: number;
  bronzeMax: number;
  silverMin: number;
  silverMax: number;
  goldMin: number;
  goldMax: number;
  platinumMin: number;
}

export interface EventMarketplaceRevenuePolicy {
  defaultPlatformFeePercent: number; // e.g. 20 (20% DAGO Hub)
  defaultOrganizerSharePercent: number; // e.g. 80 (80% Organizer)
  minPlatformFeePercent: number; // 0
  maxPlatformFeePercent: number; // 100
  effectiveDate: string; // ISO date
  policyNotes?: string;
  history?: Array<{
    id: string;
    changedAt: string;
    changedBy: string;
    previousPlatformFeePercent: number;
    newPlatformFeePercent: number;
    reason: string;
  }>;
}

export const DEFAULT_EVENT_REVENUE_POLICY: EventMarketplaceRevenuePolicy = {
  defaultPlatformFeePercent: 20,
  defaultOrganizerSharePercent: 80,
  minPlatformFeePercent: 0,
  maxPlatformFeePercent: 100,
  effectiveDate: "2026-01-01T00:00:00.000Z",
  policyNotes: "Kebijakan komisi standar platform DAGO Creative Hub (20% Platform / 80% Penyelenggara Komunitas).",
  history: [
    {
      id: "hist-init-2026",
      changedAt: "2026-01-01T00:00:00.000Z",
      changedBy: "Platform Super Admin",
      previousPlatformFeePercent: 20,
      newPlatformFeePercent: 20,
      reason: "Inisialisasi kebijakan bagi hasil awal Dago Creative Hub.",
    },
  ],
};

export interface PlatformSettings {
  language: LanguageCode;
  timezone: string;
  currency: string;
  dateFormat: string;
  taxRatePercent: number;
  isTaxEnabled: boolean;
  serviceChargePercent: number;
  lowStockThresholdPercent: number;
  loyaltyTiers: LoyaltyTierConfig;
  receiptHeader: string;
  receiptFooter: string;
  autoDeductInventory: boolean;
  promos: PromoConfig[];
  coworkingHolidays: CoworkingHolidayConfig;
  operationalHours: ServiceOperationalHours;
  tenantOperations: Record<string, TenantOperationConfig>;
  eventRevenueSharing: EventMarketplaceRevenuePolicy;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  language: "id",
  timezone: "Asia/Makassar", // WITA
  currency: "IDR",
  dateFormat: "DD/MM/YYYY",
  taxRatePercent: 10,
  isTaxEnabled: true,
  serviceChargePercent: 5,
  lowStockThresholdPercent: 40,
  coworkingHolidays: DEFAULT_COWORKING_HOLIDAY_CONFIG,
  operationalHours: DEFAULT_OPERATIONAL_HOURS,
  tenantOperations: DEFAULT_TENANT_OPERATIONS,
  eventRevenueSharing: DEFAULT_EVENT_REVENUE_POLICY,
  loyaltyTiers: {
    bronzeMin: 0,
    bronzeMax: 499,
    silverMin: 500,
    silverMax: 1499,
    goldMin: 1500,
    goldMax: 2999,
    platinumMin: 3000,
  },
  receiptHeader: "Dago Creative Hub — F&B & Co-working",
  receiptFooter: "Terima kasih atas kunjungan Anda!",
  autoDeductInventory: true,
  promos: [
    {
      id: "promo-dago20",
      code: "DAGO20",
      name: "Promo Dago Grand Opening",
      description: "Diskon 20% untuk semua transaksi F&B & Co-Working (Min. Rp 50.000).",
      discountType: "PERCENTAGE",
      discountValue: 20,
      maxDiscount: 30000,
      minimumAmount: 50000,
      targetType: "ALL",
      scope: "ALL",
      quota: 100,
      usageCount: 0,
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2026-12-31T23:59:59.000Z",
      isActive: true,
    },
    {
      id: "promo-kopi10",
      code: "KOPIHEMAT",
      name: "Promo Kopi & Cemilan F&B",
      description: "Potongan Rp 10.000 untuk pesanan menu kuliner F&B (Min. Rp 30.000).",
      discountType: "FIXED",
      discountValue: 10000,
      minimumAmount: 30000,
      targetType: "ALL",
      scope: "FNB",
      quota: 50,
      usageCount: 0,
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2026-12-31T23:59:59.000Z",
      isActive: true,
    },
    {
      id: "promo-cowork50",
      code: "COWORK50",
      name: "Promo Ruang Kerja Co-Working",
      description: "Potongan Rp 50.000 untuk sewa workspace & meeting room (Min. Rp 100.000).",
      discountType: "FIXED",
      discountValue: 50000,
      minimumAmount: 100000,
      targetType: "ALL",
      scope: "COWORKING",
      quota: 30,
      usageCount: 0,
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2026-12-31T23:59:59.000Z",
      isActive: true,
    },
  ],
};
