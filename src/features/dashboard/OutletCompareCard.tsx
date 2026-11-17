"use client";

import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { useOrders } from "@/contexts/OrderContext";
import { formatCurrencyIDR } from "@/lib/utils";

import { computeDashboardFnbRevenue, scopeDashboardOrders } from "./dashboard-metrics";

// Only physical outlets that are operating (no Denpasar/Ubud dummies)
const OUTLETS = [{ id: "outlet-sgr", name: "Singaraja (Pusat)", code: "KS-SGR" }];

/** Revenue and transactions per outlet. */
export function OutletCompareCard() {
  const { user } = useAuth();
  const { isDateInRange } = useDateFilter();
  const { orders } = useOrders();

  const isTenantOwner = user?.scopeLevel === "TENANT" && Boolean(user?.tenant?.id);
  const tenantId = user?.tenant?.id;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Outlet</CardTitle>
        <CardDescription>{OUTLETS.length} outlet terdaftar</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {OUTLETS.map((outlet) => {
            const outletOrders = scopeDashboardOrders(
              orders.filter((order) => order.outletId === outlet.id),
              { tenantId, isTenantOwner, isDateInRange, requirePaid: true }
            );
            const revenue = computeDashboardFnbRevenue(outletOrders, { isTenantOwner, tenantId });
            return (
              <li key={outlet.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {outlet.name}
                    <StatusBadge status={outletOrders.length > 0 ? "success" : "neutral"}>
                      {outletOrders.length > 0 ? "Aktif" : "Siap"}
                    </StatusBadge>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{outletOrders.length} transaksi</span>
                </div>
                <span className="text-sm font-medium tabular-nums">{formatCurrencyIDR(revenue)}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
