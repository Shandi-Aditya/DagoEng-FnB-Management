"use client";

import React, { createContext, useContext, useEffect } from "react";
import { PlatformSettings, DEFAULT_PLATFORM_SETTINGS, LanguageCode } from "@/types/settings";
import { useOptionalAuth } from "./AuthContext";
import { useActivityLog } from "./ActivityLogContext";
import { redeemPromoQuota, refundPromoQuota, type PromoConfig } from "@/lib/promo";
import { useSyncedDomain } from "@/lib/use-synced-domain";
import { syncWithOutbox } from "@/lib/sync-outbox";
import type { PlatformSettingsCommand } from "@/lib/domain-sync-types";
import {
  applyPlatformSettingsCommand,
  platformSettingsSyncClient,
  subscriptionSyncClient,
  tenantsSyncClient,
  wifiSyncClient,
} from "@/lib/sync-domains/config-spec";

interface SettingsContextType {
  settings: PlatformSettings;
  updateSettings: (newSettings: Partial<PlatformSettings>, reason?: string) => void;
  savePromos: (promos: PromoConfig[], tenantScopeId?: string) => void;
  redeemPromo: (promoIdOrCode: string, customerId?: string) => boolean;
  refundPromo: (promoIdOrCode: string, customerId?: string) => boolean;
  t: (key: string) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

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

let patchSeqCounter = 1;

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const auth = useOptionalAuth();
  const authUser = auth?.user ?? null;
  const [settings, mutateSettings] = useSyncedDomain(platformSettingsSyncClient, {
    pollMs: 10000,
    rehydrateKey: authUser?.id ?? null,
  });
  const { logActivity } = useActivityLog();

  useEffect(() => {
    if (typeof window === "undefined" || process.env.NODE_ENV === "test") return;

    void tenantsSyncClient.hydrate();
    void wifiSyncClient.hydrate();
    void subscriptionSyncClient.hydrate();

    fetch("/api/tenant/operations")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.tenantOperations) {
          mutateSettings(
            (prev) => ({
              ...prev,
              tenantOperations: {
                ...prev.tenantOperations,
                ...data.tenantOperations,
              },
            }),
            null
          );
        }
      })
      .catch(() => {});
  }, [authUser?.id, mutateSettings]);

  const updateSettings = (newSettings: Partial<PlatformSettings>, reason?: string) => {
    const prevDesc = `PB1: ${settings.taxRatePercent}%, Service: ${settings.serviceChargePercent}%, Lang: ${settings.language}, Curr: ${settings.currency}`;
    const nextTax =
      newSettings.taxRatePercent !== undefined
        ? newSettings.taxRatePercent
        : settings.taxRatePercent;
    const nextService =
      newSettings.serviceChargePercent !== undefined
        ? newSettings.serviceChargePercent
        : settings.serviceChargePercent;
    const nextLang = newSettings.language || settings.language;
    const nextCurr = newSettings.currency || settings.currency;
    const newDesc = `PB1: ${nextTax}%, Service: ${nextService}%, Lang: ${nextLang}, Curr: ${nextCurr}`;

    const isTenantScopedOwner =
      authUser?.role?.slug === "OWNER" &&
      authUser?.scopeLevel === "TENANT" &&
      Boolean(authUser?.tenant?.id);

    const definedPatchKeys = Object.entries(newSettings)
      .filter(([, val]) => val !== undefined)
      .map(([key]) => key);

    let patchForSync: Partial<PlatformSettings> = newSettings;
    if (
      isTenantScopedOwner &&
      authUser?.tenant?.id &&
      definedPatchKeys.length === 1 &&
      definedPatchKeys[0] === "tenantOperations" &&
      newSettings.tenantOperations
    ) {
      const ownOp = newSettings.tenantOperations[authUser.tenant.id];
      if (ownOp) {
        patchForSync = {
          tenantOperations: {
            [authUser.tenant.id]: ownOp,
          },
        };
      }
    }

    const seq = patchSeqCounter++;
    const cmd: PlatformSettingsCommand = {
      op: "PATCH_SETTINGS",
      patch: patchForSync,
      reason,
    };

    mutateSettings(
      (prev) => applyPlatformSettingsCommand(prev, { op: "PATCH_SETTINGS", patch: newSettings, reason }),
      {
        id: `platform-settings-patch-${Date.now()}-${seq}`,
        command: cmd,
      }
    );

    if (
      newSettings.tenantOperations &&
      typeof window !== "undefined" &&
      process.env.NODE_ENV !== "test"
    ) {
      void syncWithOutbox({
        id: "tenant-operations-sync",
        endpoint: "/api/tenant/operations",
        method: "POST",
        payload: {
          tenantOperations: patchForSync.tenantOperations ?? newSettings.tenantOperations,
        },
      });
    }

    logActivity({
      module: "SETTINGS",
      action: "PLATFORM_SETTINGS_UPDATED",
      recordId: "cfg-platform",
      previousValue: prevDesc,
      newValue: newDesc,
      description:
        "Pembaruan konfigurasi global platform (pajak, bahasa, mata uang, loyalty tier).",
      reason: reason || "Penyesuaian konfigurasi sistem oleh administrator",
      status: "SUCCESS",
      severity: "LOW",
      category: "CONFIGURATION",
      metadata: newSettings,
    });
  };

  const savePromos = (promos: PromoConfig[], tenantScopeId?: string) => {
    const currentPromos = settings.promos || [];
    const normalizedPromos = tenantScopeId
      ? promos
          .filter((p) => {
            if (p.tenantId === tenantScopeId) return true;
            if (!p.tenantId) {
              const isExistingOrgPromo = currentPromos.some(
                (cur) => cur.id === p.id && !cur.tenantId
              );
              return !isExistingOrgPromo;
            }
            return false;
          })
          .map((p) => ({ ...p, tenantId: tenantScopeId }))
      : promos.map((p) => ({ ...p }));

    const cmd: PlatformSettingsCommand = {
      op: "SAVE_PROMOS",
      promos: normalizedPromos,
      ...(tenantScopeId ? { tenantScopeId } : {}),
    };

    mutateSettings(
      (prev) => applyPlatformSettingsCommand(prev, cmd),
      {
        id: tenantScopeId ? `platform-promos-${tenantScopeId}` : "platform-promos-all",
        command: cmd,
      }
    );
  };

  const redeemPromo = (promoIdOrCode: string, customerId?: string): boolean => {
    const latest = platformSettingsSyncClient.getSnapshot();
    const res = redeemPromoQuota(latest.promos || [], promoIdOrCode, customerId);
    if (!res.success) return false;
    const opId = `promo-redeem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const cmd: PlatformSettingsCommand = {
      op: "REDEEM_PROMO",
      opId,
      promoIdOrCode,
      customerId,
    };
    mutateSettings(
      (prev) => applyPlatformSettingsCommand(prev, cmd),
      {
        id: opId,
        command: cmd,
      }
    );
    return true;
  };

  const refundPromo = (promoIdOrCode: string, customerId?: string): boolean => {
    const latest = platformSettingsSyncClient.getSnapshot();
    const res = refundPromoQuota(latest.promos || [], promoIdOrCode, customerId);
    if (!res.success) return false;
    const opId = `promo-refund-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const cmd: PlatformSettingsCommand = {
      op: "REFUND_PROMO",
      opId,
      promoIdOrCode,
      customerId,
    };
    mutateSettings(
      (prev) => applyPlatformSettingsCommand(prev, cmd),
      {
        id: opId,
        command: cmd,
      }
    );
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
        savePromos,
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
      savePromos: () => {},
      redeemPromo: () => false,
      refundPromo: () => false,
      t: (key: string) => key,
    };
  }
  return context;
}
