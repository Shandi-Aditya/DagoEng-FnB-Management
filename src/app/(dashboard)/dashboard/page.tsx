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
} from "lucide-react";

export default function DashboardPage() {
  const { user, activeOrgModules } = useAuth();
  const { isAllOutlets, activeOutlet } = useOutlet();
  const { formattedRangeLabel } = useDateFilter();
  const { filteredOrders } = useOrders();

  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const isDagoOwner = user?.scopeLevel === "ORGANIZATION";

  // Real-time calculated values from context
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total, 0);
  const totalOrdersCount = filteredOrders.length;
  const averageOrderValue =
    totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;
  const completedOrdersCount =
    filteredOrders.filter((o) => o.status === "COMPLETED" || o.status === "SERVED").length;

  // Multi-Business Breakdown for Dago Organization Owner
  const fnbRevenue = totalRevenue;
  const cwkRevenue = 0;
  const consolidatedTotal = fnbRevenue + cwkRevenue;
  const fnbShare = consolidatedTotal > 0 ? `${Math.round((fnbRevenue / consolidatedTotal) * 100)}%` : "0%";
  const cwkShare = consolidatedTotal > 0 ? `${Math.round((cwkRevenue / consolidatedTotal) * 100)}%` : "0%";

  const businessBreakdown = [
    {
      module: "FNB",
      name: "Food & Beverage (F&B)",
      revenue: fnbRevenue,
      share: fnbShare,
      tenants: "Kopi Senja, Dapur Mama, Manis Bakery, Warung Bu Narti",
      status: "AKTIF",
      icon: <Coffee className="w-4 h-4 text-brand-orange" />,
      color: "border-brand-orange",
      progressColor: "bg-brand-orange",
      progressWidth: fnbRevenue > 0 ? "w-full" : "w-0",
    },
    {
      module: "CO_WORKING",
      name: "Dago Co-working Space",
      revenue: cwkRevenue,
      share: cwkShare,
      tenants: "1 Hub (30 Desk, 4 Meeting Room)",
      status: activeOrgModules.includes("CO_WORKING") ? "AKTIF" : "NON-AKTIF",
      icon: <Laptop className="w-4 h-4 text-blue-600" />,
      color: "border-blue-500",
      progressColor: "bg-blue-500",
      progressWidth: cwkRevenue > 0 ? "w-full" : "w-0",
    },
  ];

  if (!isMounted) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
        <div className="h-16 bg-slate-100 rounded-xl w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-28 bg-slate-100 rounded-xl" />
          <div className="h-28 bg-slate-100 rounded-xl" />
          <div className="h-28 bg-slate-100 rounded-xl" />
          <div className="h-28 bg-slate-100 rounded-xl" />
        </div>
        <div className="h-64 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Eksekutif & Filter Periode Tanggal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Selamat Datang, {user?.name.split(" ")[0]}
            </h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {isDagoOwner ? "Owner Dago Hub" : `Tenant: ${user?.tenant?.name || "Kopi Senja"}`}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isDagoOwner
              ? "Ringkasan eksekutif konsolidasi seluruh domain bisnis Dago Creative Hub"
              : `Ringkasan operasional bisnis ${user?.tenant?.name || "Kopi Senja"}`} •{" "}
            <span className="font-semibold text-slate-700">
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
          value={formatCurrencyIDR(totalRevenue)}
          trendText={`Periode ${formattedRangeLabel}`}
          accentColor="orange"
          icon={<DollarSign className="w-5 h-5 text-brand-orange" />}
        />
        <KPICard
          title="Total Transaksi"
          value={`${totalOrdersCount.toLocaleString("id-ID")} Pesanan`}
          trendText={isDagoOwner ? "Semua unit bisnis" : "Transaksi pesanan tenant"}
          accentColor="cyan"
          icon={<ShoppingBag className="w-5 h-5 text-brand-cyan" />}
        />
        <KPICard
          title="Rata-rata Nilai Pesanan"
          value={formatCurrencyIDR(averageOrderValue)}
          trendText="Rata-rata per transaksi"
          accentColor="green"
          icon={<TrendingUp className="w-5 h-5 text-brand-green" />}
        />
        {isDagoOwner ? (
          <KPICard
            title="Unit Bisnis Aktif"
            value={`${activeOrgModules.filter((m) => m !== "CORE").length + 1} Unit`}
            trendText="F&B Culinary & Co-Working"
            accentColor="yellow"
            icon={<Building className="w-5 h-5 text-amber-500" />}
          />
        ) : (
          <KPICard
            title="Pesanan Selesai"
            value={`${completedOrdersCount} Pesanan`}
            trendText={`${Math.round((completedOrdersCount / (totalOrdersCount || 1)) * 100)}% tingkat selesai`}
            accentColor="yellow"
            icon={<CheckCircle2 className="w-5 h-5 text-amber-500" />}
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
            <Card className="h-full shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center space-x-2 text-slate-900">
                    <Layers className="w-4 h-4 text-brand-cyan" />
                    <span>Kontribusi Unit Bisnis</span>
                  </CardTitle>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    Konsolidasi
                  </span>
                </div>
                <CardDescription className="text-xs">
                  Porsi pendapatan antar domain operasional
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-4 space-y-4 flex-1 flex flex-col justify-around">
                {businessBreakdown.map((b) => (
                  <div
                    key={b.module}
                    className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 rounded-lg bg-white shadow-xs border border-slate-100">
                          {b.icon}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-900">{b.name}</p>
                          <p className="text-[10px] text-slate-400">{b.tenants}</p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          b.status === "AKTIF"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-bold text-slate-900">
                          {formatCurrencyIDR(b.revenue)}
                        </span>
                        <span className="font-semibold text-slate-500">
                          Porsi: <strong className="text-slate-900">{b.share}</strong>
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
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
