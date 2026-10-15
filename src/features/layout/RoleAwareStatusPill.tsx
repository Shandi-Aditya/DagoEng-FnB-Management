"use client";

import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useOrders } from "@/contexts/OrderContext";
import { useEmployeeShift } from "@/contexts/EmployeeShiftContext";
import { useTables } from "@/contexts/TableContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useCoworking } from "@/contexts/CoworkingContext";

export function RoleAwareStatusPill() {
  const { user } = useAuth();
  const { isAllOutlets, activeOutlet } = useOutlet();
  const { filteredOrders } = useOrders();
  const { activeShift } = useEmployeeShift();
  const { filteredAreas } = useTables();
  const { filteredIngredients } = useInventory();
  const { bookings } = useCoworking();

  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !user) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        <span>Memuat Status...</span>
      </div>
    );
  }

  // Dago Organization Owner
  if (user.scopeLevel === "ORGANIZATION" && user.role.slug === "OWNER") {
    return (
      <div className="flex items-center space-x-2 px-3 py-1 bg-primary/10 dark:bg-primary/20 border border-primary/25 dark:border-primary/40 rounded-full text-xs font-semibold text-primary dark:text-emerald-300">
        <span className="w-2 h-2 rounded-full bg-primary dark:bg-emerald-400 animate-pulse" />
        <span>Org Executive: Multi-Bisnis (F&B + Cowork + Commercial)</span>
      </div>
    );
  }

  // F&B Tenant Owner (Kopi Senja)
  if (user.scopeLevel === "TENANT" && user.role.slug === "OWNER") {
    return (
      <div className="flex items-center space-x-2 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-full text-xs font-semibold text-amber-800 dark:text-amber-300">
        <span className="w-2 h-2 rounded-full bg-amber-600 dark:bg-amber-400" />
        <span>F&B Tenant: {user.tenant?.name || "Kopi Senja"} ({isAllOutlets ? "Semua Outlet" : activeOutlet?.name})</span>
      </div>
    );
  }

  // Coworking Manager
  if (user.scopeLevel === "BUSINESS_UNIT" && user.allowedModules.includes("CO_WORKING")) {
    const activeCoworkCount = bookings.filter((b) => b.checkInStatus === "RESERVED" || b.checkInStatus === "CHECKED_IN").length;
    return (
      <div className="flex items-center space-x-2 px-3 py-1 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-full text-xs font-semibold text-sky-700 dark:text-sky-300">
        <span className="w-2 h-2 rounded-full bg-sky-600 dark:bg-sky-400" />
        <span>Co-working: {activeCoworkCount} Booking Aktif</span>
      </div>
    );
  }

  // Commercial Manager
  if (user.scopeLevel === "BUSINESS_UNIT" && user.allowedModules.includes("COMMERCIAL")) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-full text-xs font-semibold text-purple-700 dark:text-purple-300">
        <span className="w-2 h-2 rounded-full bg-purple-600 dark:bg-purple-400" />
        <span>Commercial Leases: Manajemen Retail Aktif</span>
      </div>
    );
  }

  switch (user.role.slug) {
    case "CASHIER": {
      const isShiftOpen = !!activeShift;
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <span className={`w-2 h-2 rounded-full ${isShiftOpen ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
          <span>
            {isShiftOpen
              ? `${activeShift.shiftName}: Aktif (Drawer Rp ${activeShift.openingCash.toLocaleString("id-ID")})`
              : "Sesi Kasir: Siap Transaksi"}
          </span>
        </div>
      );
    }

    case "MANAGER": {
      const occupiedTablesCount = filteredAreas
        ? filteredAreas.flatMap((a) => a.tables).filter((t) => t.status === "OCCUPIED" || t.status === "BILLING").length
        : 0;
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-full text-xs font-semibold text-sky-700 dark:text-sky-300">
          <span className="w-2 h-2 rounded-full bg-sky-500" />
          <span>Operasional {activeOutlet?.name || "Singaraja"}: {occupiedTablesCount} Meja Aktif</span>
        </div>
      );
    }

    case "KITCHEN_STAFF": {
      const pendingKitchenCount = filteredOrders.filter((o) => o.status === "NEW" || o.status === "KITCHEN_RECEIVED" || o.status === "COOKING").length;
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-full text-xs font-semibold text-amber-700 dark:text-amber-300">
          <span className={`w-2 h-2 rounded-full ${pendingKitchenCount > 0 ? "bg-amber-500 animate-ping" : "bg-emerald-500"}`} />
          <span>Station Utama: {pendingKitchenCount} Pesanan Menunggu</span>
        </div>
      );
    }

    case "INVENTORY_STAFF": {
      const lowStockCount = filteredIngredients.filter((i) => i.stockNumber <= i.min).length;
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-full text-xs font-semibold text-purple-700 dark:text-purple-300">
          <span className={`w-2 h-2 rounded-full ${lowStockCount > 0 ? "bg-red-500 animate-pulse" : "bg-purple-500"}`} />
          <span>{lowStockCount > 0 ? `Inventory: ${lowStockCount} Alert Stok Rendah` : "Inventory: Stok Terkendali"}</span>
        </div>
      );
    }

    case "WAITER":
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-full text-xs font-semibold text-sky-700 dark:text-sky-300">
          <span className="w-2 h-2 rounded-full bg-sky-500" />
          <span>Lantai Diners: Siap Menerima Tamu</span>
        </div>
      );

    case "SUPER_ADMIN":
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span className="w-2 h-2 rounded-full bg-primary dark:bg-emerald-400" />
          <span>Platform DagoEng: Multi-Outlet & Tenant</span>
        </div>
      );

    default:
      return null;
  }
}
