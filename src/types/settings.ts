export type LanguageCode = "id" | "en";
import { PromoConfig } from "../lib/promo";

export interface LoyaltyTierConfig {
  bronzeMin: number;
  bronzeMax: number;
  silverMin: number;
  silverMax: number;
  goldMin: number;
  goldMax: number;
  platinumMin: number;
}

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
  promos: [],
};
