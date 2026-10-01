"use client";

import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";

export function RoleAwareStatusPill() {
  const { user } = useAuth();
  const { isAllOutlets, activeOutlet } = useOutlet();

  if (!user) return null;

  // Dago Organization Owner
  if (user.scopeLevel === "ORGANIZATION" && user.role.slug === "OWNER") {
    return (
      <div className="flex items-center space-x-2 px-3 py-1 bg-brand-orange/10 border border-brand-orange/30 rounded-full text-xs font-semibold text-brand-orange">
        <span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse" />
        <span>Org Executive: Multi-Bisnis (F&B + Cowork + Commercial)</span>
      </div>
    );
  }

  // F&B Tenant Owner (Kopi Senja)
  if (user.scopeLevel === "TENANT" && user.role.slug === "OWNER") {
    return (
      <div className="flex items-center space-x-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-semibold text-amber-800">
        <span className="w-2 h-2 rounded-full bg-amber-600" />
        <span>F&B Tenant: {user.tenant?.name || "Kopi Senja"} ({isAllOutlets ? "Semua Outlet" : activeOutlet?.name})</span>
      </div>
    );
  }

  // Coworking Manager
  if (user.scopeLevel === "BUSINESS_UNIT" && user.allowedModules.includes("CO_WORKING")) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-semibold text-blue-700">
        <span className="w-2 h-2 rounded-full bg-blue-600" />
        <span>Co-working: 24/30 Meja Terisi (80% Okupansi)</span>
      </div>
    );
  }

  // Commercial Manager
  if (user.scopeLevel === "BUSINESS_UNIT" && user.allowedModules.includes("COMMERCIAL")) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1 bg-purple-50 border border-purple-200 rounded-full text-xs font-semibold text-purple-700">
        <span className="w-2 h-2 rounded-full bg-purple-600" />
        <span>Commercial Leases: 8 Tenant Retail Aktif</span>
      </div>
    );
  }

  switch (user.role.slug) {
    case "CASHIER":
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-semibold text-emerald-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Shift Pagi: Aktif (Drawer IDR 500k)</span>
        </div>
      );

    case "MANAGER":
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-semibold text-blue-700">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Operasional {activeOutlet?.name || "Singaraja"}: 6 Meja Aktif</span>
        </div>
      );

    case "KITCHEN_STAFF":
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-semibold text-amber-700">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <span>Station Utama: 3 Pesanan Menunggu</span>
        </div>
      );

    case "INVENTORY_STAFF":
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-purple-50 border border-purple-200 rounded-full text-xs font-semibold text-purple-700">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <span>Inventory: 2 Alert Stok Rendah</span>
        </div>
      );

    case "WAITER":
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-sky-50 border border-sky-200 rounded-full text-xs font-semibold text-sky-700">
          <span className="w-2 h-2 rounded-full bg-sky-500" />
          <span>Lantai Diners: Siap Menerima Tamu</span>
        </div>
      );

    case "SUPER_ADMIN":
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-slate-100 border border-slate-300 rounded-full text-xs font-semibold text-slate-700">
          <span className="w-2 h-2 rounded-full bg-brand-green" />
          <span>Platform DagoEng: 2 Tenant Aktif</span>
        </div>
      );

    default:
      return null;
  }
}
