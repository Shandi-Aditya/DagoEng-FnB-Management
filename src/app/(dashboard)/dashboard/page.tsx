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
import { AIInsightCard } from "@/features/dashboard/AIInsightCard";
import { DateRangePicker } from "@/features/dashboard/DateRangePicker";
import { WaitingTimeAnalytics } from "@/features/dashboard/WaitingTimeAnalytics";
import { DailyProgressSummary } from "@/features/dashboard/DailyProgressSummary";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Percent,
  Sparkles,
  Building,
  Coffee,
  Laptop,
  Briefcase,
  Layers,
  ArrowRight,
} from "lucide-react";

export default function DashboardPage() {
  const { user, activeOrgModules } = useAuth();
  const { isAllOutlets, activeOutlet } = useOutlet();
  const { formattedRangeLabel } = useDateFilter();
  const { filteredOrders } = useOrders();

  const isDagoOwner = user?.scopeLevel === "ORGANIZATION";

  // Data for F&B Tenant View (Kopi Senja)
  const fnbRevenue = filteredOrders.reduce((sum, o) => sum + o.total, 0) || 18450000;
  const fnbOrdersCount = filteredOrders.length || 186;

  // Multi-Business Breakdown for Dago Organization Owner
  const orgTotalRevenue = 125000000;
  const businessBreakdown = [
    {
      module: "FNB",
      name: "Food & Beverage (F&B)",
      revenue: 72000000,
      share: "57.6%",
      tenants: "Kopi Senja (2 Outlet), Artisan Bistro (1 Outlet)",
      status: "ACTIVE",
      icon: <Coffee className="w-4 h-4 text-brand-orange" />,
      color: "border-brand-orange",
    },
    {
      module: "CO_WORKING",
      name: "Dago Co-working Space",
      revenue: 31000000,
      share: "24.8%",
      tenants: "1 Hub (30 Desk, 4 Meeting Room)",
      status: activeOrgModules.includes("CO_WORKING") ? "ACTIVE" : "INACTIVE",
      icon: <Laptop className="w-4 h-4 text-blue-600" />,
      color: "border-blue-500",
    },
    {
      module: "COMMERCIAL",
      name: "Commercial Retail Leases",
      revenue: 22000000,
      share: "17.6%",
      tenants: "8 Retail Tenant Leases",
      status: activeOrgModules.includes("COMMERCIAL") ? "ACTIVE" : "INACTIVE",
      icon: <Briefcase className="w-4 h-4 text-purple-600" />,
      color: "border-purple-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Greeting & Global Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center space-x-2">
            <span>Selamat Pagi, {user?.name.split(" ")[0]} 👋</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-brand-orange/10 text-brand-orange border border-brand-orange/20">
              SCOPE: {user?.scopeLevel}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isDagoOwner
              ? "Ringkasan Konsolidasi Multi-Bisnis Dago Creative Hub"
              : `Ringkasan Bisnis Tenant F&B: ${user?.tenant?.name || "Kopi Senja"}`} •{" "}
            <span className="font-semibold text-slate-700">
              {isAllOutlets ? "Semua Outlet" : `Outlet ${activeOutlet?.name}`}
            </span>
          </p>
        </div>

        {/* Interactive Global Date Range Filter Picker */}
        <div className="flex items-center space-x-2">
          <DateRangePicker />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* DAGO ORGANIZATION OWNER: MULTI-BUSINESS CONSOLIDATED METRICS  */}
      {/* ------------------------------------------------------------- */}
      {isDagoOwner ? (
        <div className="space-y-6">
          {/* Top Total Business Revenue Banner */}
          <Card className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-md border-none">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-brand-orange uppercase tracking-wider">
                  TOTAL BUSINESS REVENUE (KONSOLIDASI ORGANISASI)
                </span>
                <h3 className="text-3xl font-extrabold tracking-tight mt-1 text-white">
                  {formatCurrencyIDR(orgTotalRevenue)}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Total omzet gabungan domain F&B, Co-working, dan Commercial pada periode ini
                </p>
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-right border-l border-slate-700 pl-4">
                  <p className="text-[11px] text-slate-400">Total Transaksi</p>
                  <p className="text-lg font-bold text-white">1.428 Transaksi</p>
                </div>
                <div className="text-right border-l border-slate-700 pl-4">
                  <p className="text-[11px] text-slate-400">Tenant Aktif</p>
                  <p className="text-lg font-bold text-brand-green">11 Tenant</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Breakdown per Domain Bisnis */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-brand-cyan" />
                <span>Rincian Kontribusi per Domain Bisnis:</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {activeOrgModules.filter((m) => m !== "CORE").length} Modul Aktif
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {businessBreakdown.map((b) => (
                <Card key={b.module} className={`p-4 bg-white shadow-sm border-l-4 ${b.color}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 rounded-md bg-slate-100">{b.icon}</div>
                      <span className="font-bold text-xs text-slate-900">{b.name}</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        b.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>

                  <div className="mt-3">
                    <p className="text-xl font-bold text-slate-900">{formatCurrencyIDR(b.revenue)}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                      <span>Kontribusi: <strong>{b.share}</strong></span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 truncate">{b.tenants}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ----------------------------------------------------------- */
        /* F&B TENANT OWNER: ISOLATED BRAND METRICS (Kopi Senja Only) */
        /* ----------------------------------------------------------- */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title={`Total Revenue ${user?.tenant?.name || "Kopi Senja"}`}
            value={formatCurrencyIDR(fnbRevenue)}
            changePercent={14.2}
            trendText={`pada ${formattedRangeLabel}`}
            accentColor="orange"
            icon={<DollarSign className="w-4 h-4 text-brand-orange" />}
          />
          <KPICard
            title="Volume Pesanan Tenant"
            value={`${fnbOrdersCount} Order`}
            changePercent={8.5}
            trendText="transaksi F&B terisolasi"
            accentColor="cyan"
            icon={<ShoppingBag className="w-4 h-4 text-brand-cyan" />}
          />
          <KPICard
            title="Average Order Value (AOV)"
            value="Rp 53.940"
            changePercent={5.1}
            trendText="basket size tenant"
            accentColor="green"
            icon={<TrendingUp className="w-4 h-4 text-brand-green" />}
          />
          <KPICard
            title="Gross Margin Resep F&B"
            value="61.8%"
            changePercent={-1.2}
            trendText="efisiensi COGS Kopi Senja"
            accentColor="yellow"
            icon={<Percent className="w-4 h-4 text-brand-yellow" />}
          />
        </div>
      )}

      {/* Progress Harian & Analitik Service Time (Mengikuti Scope) */}
      <DailyProgressSummary />
      <WaitingTimeAnalytics />

      {/* AI Business Insight Highlight */}
      <AIInsightCard
        insightTitle={
          isDagoOwner
            ? "Analisis Portofolio Multi-Bisnis Dago Creative Hub"
            : "Analisis Efisiensi COGS & Margin Kopi Senja"
        }
        insight={
          isDagoOwner
            ? "Domain F&B menyumbang 57.6% dari total omzet Dago Hub, disusul Co-working sebesar 24.8%. Modul Commercial saat ini dinonaktifkan."
            : "Produk 'Kopi Senja Aren' menyumbang 42% laba kotor, namun margin susu cair mengalami penurunan 2.1% di cabang Singaraja."
        }
        evidence={
          isDagoOwner
            ? "Rata-rata okupansi co-working mencapai 80% pada hari kerja, sementara trafik F&B Kopi Senja tertinggi pada sore hari (18:00-20:00 WITA)."
            : "Konsumsi susu mencapai 36 liter/hari dengan harga beli Rp 22.000/L (+10% dari baseline harga kontrak supplier)."
        }
        recommendation={
          isDagoOwner
            ? "Aktifkan paket bundling cross-selling 'Cowork Full-Day Pass + Voucher F&B Kopi Senja' untuk memaksimalkan average spend per member."
            : "Segera alihkan pesanan PO susu periode minggu depan ke supplier 'Bali Dairy Fresh' untuk mengunci harga Rp 19.800/L."
        }
        actionText={isDagoOwner ? "Lihat Analisis Multi-Bisnis" : "Buat Draft PO Susu"}
      />

      {/* Middle Section: Revenue vs COGS Trend & Outlet Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RevenueChartPreview />
        <OutletCompareCard />
      </div>

      {/* Lower Section: Inventory Risk Detection & Top Menus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InventoryRiskCard />

        {/* Top Product Movers */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isDagoOwner ? "Top Movers Seluruh Tenant F&B" : "Menu Terlaris Kopi Senja"}
              </h3>
              <p className="text-xs text-slate-500">Klasifikasi menu berdasarkan volume & margin</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Data
            </span>
          </div>
          <div className="space-y-3">
            {[
              { name: "Kopi Senja Aren (Regular)", sold: "142 cup", rev: "Rp 3.408.000", tag: "STAR", margin: "64%" },
              { name: "Artisan Peach White Tea", sold: "68 cup", rev: "Rp 1.904.000", tag: "STAR", margin: "72%" },
              { name: "Flaky French Butter Croissant", sold: "45 pcs", rev: "Rp 900.000", tag: "CASH COW", margin: "58%" },
              { name: "Signature Wagyu Beef Bowl", sold: "24 porsi", rev: "Rp 1.560.000", tag: "PUZZLE", margin: "44%" },
            ].map((prod, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                <div>
                  <p className="font-semibold text-slate-800">{prod.name}</p>
                  <p className="text-[11px] text-slate-400">{prod.sold} terjual • Margin {prod.margin}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{prod.rev}</p>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                    {prod.tag}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
