"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useCoworking } from "@/contexts/CoworkingContext";
import { useEmployeeShift } from "@/contexts/EmployeeShiftContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useOrders } from "@/contexts/OrderContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useTables } from "@/contexts/TableContext";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "destructive";

const DOT_CLASS: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

/** One-line operational status for the signed-in role, shown in the site header. */
export function RoleAwareStatusPill() {
  const { user } = useAuth();
  const { isAllOutlets, activeOutlet } = useOutlet();
  const { filteredOrders } = useOrders();
  const { activeShift } = useEmployeeShift();
  const { filteredAreas } = useTables();
  const { filteredIngredients } = useInventory();
  const { bookings } = useCoworking();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !user) return null;

  let label: string | null = null;
  let tone: Tone = "neutral";

  if (user.scopeLevel === "ORGANIZATION" && user.role.slug === "OWNER") {
    label = "Owner organisasi · F&B, co-working dan komersial";
  } else if (user.scopeLevel === "TENANT" && user.role.slug === "OWNER") {
    label = `Tenant ${user.tenant?.name ?? "Kopi Senja"} · ${isAllOutlets ? "Semua outlet" : activeOutlet?.name}`;
  } else if (user.scopeLevel === "BUSINESS_UNIT" && user.allowedModules.includes("CO_WORKING")) {
    const active = bookings.filter((b) => b.checkInStatus === "RESERVED" || b.checkInStatus === "CHECKED_IN").length;
    label = `Co-working · ${active} booking aktif`;
  } else if (user.scopeLevel === "BUSINESS_UNIT" && user.allowedModules.includes("COMMERCIAL")) {
    label = "Komersial · sewa retail aktif";
  } else {
    switch (user.role.slug) {
      case "CASHIER":
        tone = activeShift ? "success" : "neutral";
        label = activeShift
          ? `${activeShift.shiftName} aktif · laci Rp ${activeShift.openingCash.toLocaleString("id-ID")}`
          : "Kasir siap transaksi";
        break;
      case "MANAGER": {
        const occupied = filteredAreas
          ? filteredAreas.flatMap((a) => a.tables).filter((t) => t.status === "OCCUPIED" || t.status === "BILLING").length
          : 0;
        label = `${activeOutlet?.name ?? "Singaraja"} · ${occupied} meja terisi`;
        break;
      }
      case "KITCHEN_STAFF": {
        const waiting = filteredOrders.filter((o) => o.status === "NEW" || o.status === "KITCHEN_RECEIVED" || o.status === "COOKING").length;
        tone = waiting > 0 ? "warning" : "success";
        label = `Dapur · ${waiting} pesanan menunggu`;
        break;
      }
      case "INVENTORY_STAFF": {
        const low = filteredIngredients.filter((i) => i.stockNumber <= i.min).length;
        tone = low > 0 ? "destructive" : "success";
        label = low > 0 ? `Inventori · ${low} stok rendah` : "Inventori · stok aman";
        break;
      }
      case "WAITER":
        label = "Lantai siap menerima tamu";
        break;
      case "SUPER_ADMIN":
        label = "Platform · multi-outlet dan tenant";
        break;
      default:
        label = null;
    }
  }

  if (!label) return null;

  return (
    <Badge variant="outline" className="h-6 gap-1.5 px-2 text-xs">
      <span className={cn("size-1.5 rounded-full", DOT_CLASS[tone])} aria-hidden />
      {label}
    </Badge>
  );
}
