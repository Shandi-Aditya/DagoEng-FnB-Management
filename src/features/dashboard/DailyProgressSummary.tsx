"use client";

import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { useOrders } from "@/contexts/OrderContext";
import { formatCurrencyIDR } from "@/lib/utils";

import { computeDashboardFnbRevenue, scopeDashboardOrders } from "./dashboard-metrics";

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-medium tabular-nums">{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/** Order processing progress for the selected period. */
export function DailyProgressSummary() {
  const { user } = useAuth();
  const { isDateInRange } = useDateFilter();
  const { filteredOrders } = useOrders();

  const isTenantOwner = user?.scopeLevel === "TENANT" && Boolean(user?.tenant?.id);
  const tenantId = user?.tenant?.id;

  const scopedOrders = scopeDashboardOrders(filteredOrders, {
    tenantId,
    isTenantOwner,
    isDateInRange,
    requirePaid: true,
  });

  const revenue = computeDashboardFnbRevenue(scopedOrders, { isTenantOwner, tenantId });
  const total = scopedOrders.length;
  const completed = scopedOrders.filter((order) => order.status === "COMPLETED" || order.status === "SERVED").length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Progres operasional</CardTitle>
        <CardDescription>Penyelesaian pesanan pada periode terpilih</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState title="Belum ada pesanan" description="Pesanan di periode ini akan muncul di sini" />
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-4">
              <Metric label="Omzet" value={formatCurrencyIDR(revenue)} />
              <Metric label="Selesai" value={`${completed} dari ${total}`} />
              <Metric label="Antrean aktif" value={`${total - completed}`} hint="Dapur dan bar" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Tingkat penyelesaian</span>
                <span className="tabular-nums">{completionRate}%</span>
              </div>
              <Progress value={completionRate} aria-label="Tingkat penyelesaian pesanan" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
