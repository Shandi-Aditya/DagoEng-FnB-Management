"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { PlatformSettings, DEFAULT_PLATFORM_SETTINGS, LanguageCode } from "@/types/settings";
import { useAuth } from "./AuthContext";
import { useActivityLog } from "./ActivityLogContext";
import { redeemPromoQuota, refundPromoQuota } from "@/lib/promo";

interface SettingsContextType {
  settings: PlatformSettings;
  updateSettings: (newSettings: Partial<PlatformSettings>, reason?: string) => void;
  redeemPromo: (promoIdOrCode: string, customerId?: string) => boolean;
  refundPromo: (promoIdOrCode: string, customerId?: string) => boolean;
  t: (key: string) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);
const STORAGE_KEY_SETTINGS = "dagoeng_platform_settings_v1";

// Bilingual dictionary for system-wide translation
const DICTIONARY: Record<LanguageCode, Record<string, string>> = {
  id: {
    "nav.dashboard": "Dashboard Utama",
    "nav.pos": "POS Kasir & Transaksi",
    "nav.tables": "Meja & Reservasi",
    "nav.kitchen": "Kitchen Display (KDS)",
    "nav.orders": "Daftar Pesanan & Status",
    "nav.menu": "Katalog Menu & Resep",
    "nav.inventory": "Smart Inventory & BOM",
    "nav.coworking": "Co-working Space",
    "nav.commercial": "Commercial Leases",
    "nav.customers": "Pelanggan & Loyalty",
    "nav.employees": "Karyawan & Shift",
    "nav.reports": "Laporan & Finansial",
    "nav.ai_insight": "AI Business Insight",
    "nav.activity_log": "Audit Trail & Log Aktivitas",
    "nav.settings": "Pengaturan Sistem",
    "common.outlet": "Outlet",
    "common.save": "Simpan Perubahan",
    "common.cancel": "Batal",
    "common.active": "AKTIF",
    "common.inactive": "NON-AKTIF",
    "common.available": "TERSEDIA",
    "common.occupied": "TERISI",
    "common.reserved": "RESERVED",
    "pos.out_of_stock": "HABIS",
    "pos.critical_stock": "STOK MENIPIS",
    "pos.table_selection": "Pilih Meja",
    "pos.new_transaction": "Transaksi Baru",
  },
  en: {
    "nav.dashboard": "Main Dashboard",
    "nav.pos": "Cashier POS & Billing",
    "nav.tables": "Tables & Reservations",
    "nav.kitchen": "Kitchen Display (KDS)",
    "nav.orders": "Order Tracker & Status",
    "nav.menu": "Menu Catalog & Recipes",
    "nav.inventory": "Smart Inventory & BOM",
    "nav.coworking": "Co-working Space",
    "nav.commercial": "Commercial Leases",
    "nav.customers": "Customers & Loyalty",
    "nav.employees": "Employees & Shift",
    "nav.reports": "Reports & Finance",
    "nav.ai_insight": "AI Business Advisory",
    "nav.activity_log": "Audit Trail & Activity Log",
    "nav.settings": "System Settings",
    "common.outlet": "Outlet",
    "common.save": "Save Changes",
    "common.cancel": "Cancel",
    "common.active": "ACTIVE",
    "common.inactive": "INACTIVE",
    "common.available": "AVAILABLE",
    "common.occupied": "OCCUPIED",
    "common.reserved": "RESERVED",
    "pos.out_of_stock": "OUT OF STOCK",
    "pos.critical_stock": "LOW STOCK",
    "pos.table_selection": "Select Table",
    "pos.new_transaction": "New Transaction",
  },
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [isInitialized, setIsInitialized] = useState(false);
  const { logActivity } = useActivityLog();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({
          ...DEFAULT_PLATFORM_SETTINGS,
          ...parsed,
          coworkingHolidays: {
            ...DEFAULT_PLATFORM_SETTINGS.coworkingHolidays,
            ...(parsed.coworkingHolidays || {}),
            nationalHolidays: parsed.coworkingHolidays?.nationalHolidays || DEFAULT_PLATFORM_SETTINGS.coworkingHolidays.nationalHolidays,
            overrides: parsed.coworkingHolidays?.overrides || DEFAULT_PLATFORM_SETTINGS.coworkingHolidays.overrides,
          },
          operationalHours: {
            ...DEFAULT_PLATFORM_SETTINGS.operationalHours,
            ...(parsed.operationalHours || {}),
          },
          tenantOperations: {
            ...DEFAULT_PLATFORM_SETTINGS.tenantOperations,
            ...(parsed.tenantOperations || {}),
          },
          eventRevenueSharing: {
            ...DEFAULT_PLATFORM_SETTINGS.eventRevenueSharing,
            ...(parsed.eventRevenueSharing || {}),
            history: parsed.eventRevenueSharing?.history || DEFAULT_PLATFORM_SETTINGS.eventRevenueSharing.history,
          },
        });
      }
    } catch (e) {
      console.error("Failed to load settings", e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error("Failed to save settings", e);
    }
  }, [settings, isInitialized]);

  const updateSettings = (newSettings: Partial<PlatformSettings>, reason?: string) => {
    const prevDesc = `PB1: ${settings.taxRatePercent}%, Service: ${settings.serviceChargePercent}%, Lang: ${settings.language}, Curr: ${settings.currency}`;
    const nextTax = newSettings.taxRatePercent !== undefined ? newSettings.taxRatePercent : settings.taxRatePercent;
    const nextService = newSettings.serviceChargePercent !== undefined ? newSettings.serviceChargePercent : settings.serviceChargePercent;
    const nextLang = newSettings.language || settings.language;
    const nextCurr = newSettings.currency || settings.currency;
    const newDesc = `PB1: ${nextTax}%, Service: ${nextService}%, Lang: ${nextLang}, Curr: ${nextCurr}`;

    setSettings((prev) => ({ ...prev, ...newSettings }));

    // Log the configuration changes
    logActivity({
      module: "SETTINGS",
      action: "PLATFORM_SETTINGS_UPDATED",
      recordId: "cfg-platform",
      previousValue: prevDesc,
      newValue: newDesc,
      description: "Pembaruan konfigurasi global platform (pajak, bahasa, mata uang, loyalty tier).",
      reason: reason || "Penyesuaian konfigurasi sistem oleh administrator",
      status: "SUCCESS",
      severity: "LOW",
      category: "CONFIGURATION",
      metadata: newSettings,
    });
  };

  const redeemPromo = (promoIdOrCode: string, customerId?: string): boolean => {
    const res = redeemPromoQuota(settings.promos || [], promoIdOrCode, customerId);
    if (!res.success) return false;
    setSettings((prev) => ({ ...prev, promos: res.updatedPromos }));
    return true;
  };

  const refundPromo = (promoIdOrCode: string, customerId?: string): boolean => {
    const res = refundPromoQuota(settings.promos || [], promoIdOrCode, customerId);
    if (!res.success) return false;
    setSettings((prev) => ({ ...prev, promos: res.updatedPromos }));
    return true;
  };

  const t = (key: string): string => {
    const lang = settings.language || "id";
    return DICTIONARY[lang]?.[key] || key;
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        redeemPromo,
        refundPromo,
        t,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    return {
      settings: DEFAULT_PLATFORM_SETTINGS,
      updateSettings: () => {},
      redeemPromo: () => false,
      refundPromo: () => false,
      t: (key: string) => key,
    };
  }
  return context;
}

