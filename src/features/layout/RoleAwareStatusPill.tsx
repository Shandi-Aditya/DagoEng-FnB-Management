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
      <div className="flex items-center space-x-2 px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-500">
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        <span>Memuat Status...</span>
      </div>
    );
  }

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
    const activeCoworkCount = bookings.filter((b) => b.checkInStatus === "RESERVED" || b.checkInStatus === "CHECKED_IN").length;
    return (
      <div className="flex items-center space-x-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-semibold text-blue-700">
        <span className="w-2 h-2 rounded-full bg-blue-600" />
        <span>Co-working: {activeCoworkCount} Booking Aktif</span>
      </div>
    );
  }

  // Commercial Manager
  if (user.scopeLevel === "BUSINESS_UNIT" && user.allowedModules.includes("COMMERCIAL")) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1 bg-purple-50 border border-purple-200 rounded-full text-xs font-semibold text-purple-700">
        <span className="w-2 h-2 rounded-full bg-purple-600" />
        <span>Commercial Leases: Manajemen Retail Aktif</span>
      </div>
    );
  }

  switch (user.role.slug) {
    case "CASHIER": {
      const isShiftOpen = !!activeShift;
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-semibold text-emerald-700">
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
        <div className="flex items-center space-x-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-semibold text-blue-700">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Operasional {activeOutlet?.name || "Singaraja"}: {occupiedTablesCount} Meja Aktif</span>
        </div>
      );
    }

    case "KITCHEN_STAFF": {
      const pendingKitchenCount = filteredOrders.filter((o) => o.status === "NEW" || o.status === "KITCHEN_RECEIVED" || o.status === "COOKING").length;
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-semibold text-amber-700">
          <span className={`w-2 h-2 rounded-full ${pendingKitchenCount > 0 ? "bg-amber-500 animate-ping" : "bg-emerald-500"}`} />
          <span>Station Utama: {pendingKitchenCount} Pesanan Menunggu</span>
        </div>
      );
    }

    case "INVENTORY_STAFF": {
      const lowStockCount = filteredIngredients.filter((i) => i.stockNumber <= i.min).length;
      return (
        <div className="flex items-center space-x-2 px-3 py-1 bg-purple-50 border border-purple-200 rounded-full text-xs font-semibold text-purple-700">
          <span className={`w-2 h-2 rounded-full ${lowStockCount > 0 ? "bg-red-500 animate-pulse" : "bg-purple-500"}`} />
          <span>{lowStockCount > 0 ? `Inventory: ${lowStockCount} Alert Stok Rendah` : "Inventory: Stok Terkendali"}</span>
        </div>
      );
    }

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
          <span>Platform DagoEng: Multi-Outlet & Tenant</span>
        </div>
      );

    default:
      return null;
  }
}
