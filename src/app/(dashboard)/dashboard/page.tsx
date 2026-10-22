"use client";

import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { useOrders } from "@/contexts/OrderContext";
import { KPICard } from "@/features/dashboard/KPICard";
import { RevenueChartPreview } from "@/features/dashboard/RevenueChartPreview";
import { OutletCompareCard } from "@/features/dashboard/OutletCompareCard";
import { InventoryRiskCard } from "@/features/dashboard/InventoryRiskCard";
import { DateRangePicker } from "@/features/dashboard/DateRangePicker";
import { DailyProgressSummary } from "@/features/dashboard/DailyProgressSummary";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Percent,
  Building,
  Coffee,
  Laptop,
  Layers,
  CheckCircle2,
  Calendar,
} from "lucide-react";

export default function DashboardPage() {
  const { user, activeOrgModules } = useAuth();
  const { isAllOutlets, activeOutlet } = useOutlet();
  const { formattedRangeLabel } = useDateFilter();
  const { filteredOrders } = useOrders();

  const [isMounted, setIsMounted] = React.useState(false);
  const [eventStats, setEventStats] = React.useState<{
    totalRevenue: number;
    paidBookingsCount: number;
    platformRevenue: number;
  }>({ totalRevenue: 0, paidBookingsCount: 0, platformRevenue: 0 });

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const isDagoOwner = user?.scopeLevel === "ORGANIZATION" || user?.scopeLevel === "PLATFORM";
  const isTenantOwner = user?.scopeLevel === "TENANT" && !!user?.tenant?.id;
  const userTenantId = user?.tenant?.id;

  React.useEffect(() => {
    if (isDagoOwner) {
      fetch("/api/events/bookings?includeStats=true")
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.stats) {
            setEventStats({
              totalRevenue: json.stats.totalTicketRevenue || 0,
              paidBookingsCount: json.stats.totalTicketsSold || 0,
              platformRevenue: json.stats.platformCommissionRevenue || 0,
            });
          }
        })
        .catch(() => {});
    }
  }, [isDagoOwner]);

  // Tenant-aware order filtering
  const scopedOrders = React.useMemo(() => {
    if (!isTenantOwner || !userTenantId) return filteredOrders;
    return filteredOrders.filter((o) => o.items.some((it) => it.tenantId === userTenantId));
  }, [filteredOrders, isTenantOwner, userTenantId]);

  // Real-time calculated values from context (tenant-scoped if Tenant Owner)
  const totalRevenue = React.useMemo(() => {
    if (!isTenantOwner || !userTenantId) {
      return filteredOrders.reduce((sum, o) => sum + o.total, 0);
    }
    return scopedOrders.reduce((sum, o) => {
      const tenantGross = o.items
        .filter((it) => it.tenantId === userTenantId)
        .reduce((iSum, it) => iSum + (it.unitPrice || 0) * (it.quantity || 1), 0);
      return sum + tenantGross;
    }, 0);
  }, [filteredOrders, scopedOrders, isTenantOwner, userTenantId]);

  const totalOrdersCount = scopedOrders.length;
  const averageOrderValue =
    totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;
  const completedOrdersCount =
    scopedOrders.filter((o) => o.status === "COMPLETED" || o.status === "SERVED").length;

  // Multi-Business Breakdown for Dago Organization Owner
  const fnbRevenue = totalRevenue;
  const cwkRevenue = 0;
  const eventRevenue = isDagoOwner ? eventStats.totalRevenue : 0;
  const consolidatedTotal = fnbRevenue + cwkRevenue + eventRevenue;
  const fnbShare = consolidatedTotal > 0 ? `${Math.round((fnbRevenue / consolidatedTotal) * 100)}%` : "0%";
  const cwkShare = consolidatedTotal > 0 ? `${Math.round((cwkRevenue / consolidatedTotal) * 100)}%` : "0%";
  const eventShare = consolidatedTotal > 0 ? `${Math.round((eventRevenue / consolidatedTotal) * 100)}%` : "0%";

  const businessBreakdown = [
    {
      module: "FNB",
      name: "Food & Beverage (F&B)",
      revenue: fnbRevenue,
      share: fnbShare,
      tenants: "Kopi Senja, Dapur Mama, Manis Bakery, Warung Bu Narti",
      status: "AKTIF",
      icon: <Coffee className="w-4 h-4 text-primary" />,
      color: "border-primary",
      progressColor: "bg-primary",
      progressWidth: fnbRevenue > 0 ? "w-full" : "w-0",
    },
    {
      module: "CO_WORKING",
      name: "Dago Co-working Space",
      revenue: cwkRevenue,
      share: cwkShare,
      tenants: "1 Hub (30 Desk, 4 Meeting Room)",
      status: activeOrgModules.includes("CO_WORKING") ? "AKTIF" : "NON-AKTIF",
      icon: <Laptop className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
      color: "border-sky-500",
      progressColor: "bg-sky-500",
      progressWidth: cwkRevenue > 0 ? "w-full" : "w-0",
    },
    {
      module: "COMMUNITY_EVENTS",
      name: "Event Komunitas & Kreatif",
      revenue: eventRevenue,
      share: eventShare,
      tenants: `${eventStats.paidBookingsCount} Tiket Terjual (Platform Fee 20%)`,
      status: "AKTIF",
      icon: <Calendar className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788]" />,
      color: "border-[#3B7A57]",
      progressColor: "bg-[#3B7A57]",
      progressWidth: eventRevenue > 0 ? "w-full" : "w-0",
    },
  ];

  if (!isMounted) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
        <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        </div>
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Eksekutif & Filter Periode Tanggal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Selamat Datang, {user?.name.split(" ")[0]}
            </h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {isDagoOwner ? "Owner Dago Hub" : `Tenant: ${user?.tenant?.name || "Kopi Senja"}`}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isDagoOwner
              ? "Ringkasan eksekutif konsolidasi seluruh domain bisnis Dago Creative Hub"
              : `Ringkasan operasional bisnis ${user?.tenant?.name || "Kopi Senja"}`} •{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {isAllOutlets ? "Semua Outlet" : `Outlet ${activeOutlet?.name}`}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DateRangePicker />
        </div>
      </div>

      {/* 2. Ringkasan Statistik Utama (4 KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={isDagoOwner ? "Total Pendapatan Konsolidasi" : "Total Pendapatan"}
          value={formatCurrencyIDR(isDagoOwner ? consolidatedTotal : totalRevenue)}
          trendText={`Periode ${formattedRangeLabel}`}
          accentColor="sage"
          icon={<DollarSign className="w-5 h-5 text-primary" />}
        />
        <KPICard
          title="Total Transaksi"
          value={`${(totalOrdersCount + (isDagoOwner ? eventStats.paidBookingsCount : 0)).toLocaleString("id-ID")} Transaksi`}
          trendText={isDagoOwner ? "F&B + Tiket Event Komunitas" : "Transaksi pesanan tenant"}
          accentColor="cyan"
          icon={<ShoppingBag className="w-5 h-5 text-sky-600 dark:text-sky-400" />}
        />
        <KPICard
          title="Rata-rata Nilai Pesanan"
          value={formatCurrencyIDR(averageOrderValue)}
          trendText="Rata-rata per transaksi"
          accentColor="green"
          icon={<TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
        />
        {isDagoOwner ? (
          <KPICard
            title="Unit Bisnis Aktif"
            value={`${activeOrgModules.filter((m) => m !== "CORE").length + 1} Unit`}
            trendText="F&B Culinary & Co-Working"
            accentColor="sage"
            icon={<Building className="w-5 h-5 text-primary" />}
          />
        ) : (
          <KPICard
            title="Pesanan Selesai"
            value={`${completedOrdersCount} Pesanan`}
            trendText={`${Math.round((completedOrdersCount / (totalOrdersCount || 1)) * 100)}% tingkat selesai`}
            accentColor="sage"
            icon={<CheckCircle2 className="w-5 h-5 text-primary" />}
          />
        )}
      </div>



      {/* 3. Visual Utama & Analisis Performa (Tren Penjualan & Komparasi/Kontribusi) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChartPreview />
        </div>

        <div className="lg:col-span-1">
          {isDagoOwner ? (
            <Card className="h-full shadow-sm flex flex-col justify-between border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center space-x-2 text-slate-900 dark:text-slate-100">
                    <Layers className="w-4 h-4 text-primary" />
                    <span>Kontribusi Unit Bisnis</span>
                  </CardTitle>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    Konsolidasi
                  </span>
                </div>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Porsi pendapatan antar domain operasional
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-4 space-y-4 flex-1 flex flex-col justify-around">
                {businessBreakdown.map((b) => (
                  <div
                    key={b.module}
                    className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 shadow-xs border border-slate-100 dark:border-slate-700">
                          {b.icon}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-900 dark:text-slate-100">{b.name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">{b.tenants}</p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          b.status === "AKTIF"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60"
                            : "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrencyIDR(b.revenue)}
                        </span>
                        <span className="font-semibold text-slate-500 dark:text-slate-400">
                          Porsi: <strong className="text-slate-900 dark:text-slate-100">{b.share}</strong>
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div className={`h-full ${b.progressColor} ${b.progressWidth} rounded-full`} />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <OutletCompareCard />
          )}
        </div>
      </div>

      {/* 4. Ringkasan Operasional & Deteksi Stok (2 Kolom Seimbang) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyProgressSummary />
        <InventoryRiskCard />
      </div>
    </div>
  );
}
