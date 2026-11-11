"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CookingPot } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { useOutlet } from "@/contexts/OutletContext";
import { ActionCenter } from "@/features/dashboard/ActionCenter";
import { DailyProgressSummary } from "@/features/dashboard/DailyProgressSummary";
import { DateRangePicker } from "@/features/dashboard/DateRangePicker";
import { InventoryRiskCard } from "@/features/dashboard/InventoryRiskCard";
import { OutletCompareCard } from "@/features/dashboard/OutletCompareCard";
import { RevenueChartPreview } from "@/features/dashboard/RevenueChartPreview";
import { UnitContributionCard } from "@/features/dashboard/UnitContributionCard";
import { useDashboardMetrics } from "@/features/dashboard/use-dashboard-metrics";
import { formatCurrencyIDR } from "@/lib/utils";

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-12 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { activeOutlet } = useOutlet();
  const { formattedRangeLabel } = useDateFilter();
  const metrics = useDashboardMetrics();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Non-executive personas are routed to their own working station
  useEffect(() => {
    if (!user || !isMounted || isLoading) return;
    if (user.role?.slug === "WAITER" || user.permissions?.includes("events:checkin")) {
      router.replace("/events/checkin");
    } else if (user.role?.slug === "CUSTOMER") {
      router.replace("/customer");
    }
  }, [user, isMounted, isLoading, router]);

  if (!isMounted) return <DashboardSkeleton />;

  const scopeLabel = metrics.isDagoOwner ? "Dago Creative Hub" : (user?.tenant?.name ?? "Kopi Senja");
  const outletLabel = `Outlet ${activeOutlet?.name ?? "Singaraja (Pusat)"}`;
  const completionRate = metrics.totalOrders > 0 ? Math.round((metrics.completedOrders / metrics.totalOrders) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ringkasan"
        description={`${scopeLabel} · ${outletLabel} · ${formattedRangeLabel}`}
        actions={<DateRangePicker />}
      />

      {metrics.isDagoOwner ? <ActionCenter actions={metrics.pendingActions} /> : null}

      {metrics.isTenantOwner && metrics.preparingOrders > 0 ? (
        <Alert>
          <CookingPot />
          <AlertTitle>{metrics.preparingOrders} pesanan sedang disiapkan</AlertTitle>
          <AlertDescription>
            Dapur sedang memproses pesanan tenant Anda.{" "}
            <Link href="/orders" className="underline underline-offset-4">
              Lihat pesanan
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={metrics.isDagoOwner ? "Pendapatan konsolidasi" : "Pendapatan"}
          value={formatCurrencyIDR(metrics.revenue)}
          hint={formattedRangeLabel}
        />
        <StatCard
          label="Transaksi"
          value={metrics.transactions.toLocaleString("id-ID")}
          hint={metrics.isDagoOwner ? "F&B, co-working dan tiket event" : "Pesanan tenant"}
        />
        <StatCard label="Rata-rata per transaksi" value={formatCurrencyIDR(metrics.averageOrderValue)} />
        {metrics.isDagoOwner ? (
          <StatCard label="Unit bisnis aktif" value={`${metrics.activeUnits}`} hint="F&B, co-working dan event" />
        ) : (
          <StatCard
            label="Pesanan selesai"
            value={`${metrics.completedOrders}`}
            hint={`${completionRate}% dari ${metrics.totalOrders} pesanan`}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChartPreview />
        </div>
        {metrics.isDagoOwner ? <UnitContributionCard units={metrics.unitBreakdown} /> : <OutletCompareCard />}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DailyProgressSummary />
        <InventoryRiskCard />
      </div>
    </div>
  );
}
