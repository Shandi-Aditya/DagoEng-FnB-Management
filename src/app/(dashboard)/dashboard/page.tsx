"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Bell,
  ArrowRight,
  Wallet,
  CreditCard,
  AlertTriangle,
  Clock,
  Sparkles,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { user, activeOrgModules, isLoading } = useAuth();
  const { isAllOutlets, activeOutlet } = useOutlet();
  const { formattedRangeLabel, isDateInRange } = useDateFilter();
  const { filteredOrders } = useOrders();

  const [isMounted, setIsMounted] = React.useState(false);
  const [allBookings, setAllBookings] = React.useState<any[]>([]);
  const [fallbackStats, setFallbackStats] = React.useState<{
    totalRevenue: number;
    paidBookingsCount: number;
    platformRevenue: number;
  }>({ totalRevenue: 0, paidBookingsCount: 0, platformRevenue: 0 });

  const [adminActionAlerts, setAdminActionAlerts] = React.useState<{
    pendingModerationCount: number;
    pendingPayoutCount: number;
    pendingRevenueSplitCount: number;
    pendingManualPaymentsCount: number;
  }>({
    pendingModerationCount: 0,
    pendingPayoutCount: 0,
    pendingRevenueSplitCount: 0,
    pendingManualPaymentsCount: 0,
  });

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const isDagoOwner =
    (user?.role?.slug === "OWNER" || user?.role?.slug === "SUPER_ADMIN") &&
    (user?.scopeLevel === "ORGANIZATION" || user?.scopeLevel === "PLATFORM");
  const isTenantOwner = user?.scopeLevel === "TENANT" && !!user?.tenant?.id;
  const userTenantId = user?.tenant?.id;

  // Single-session RBAC guard: Non-executive personas attempting to open executive dashboard
  // are routed to their designated working station.
  React.useEffect(() => {
    if (user && isMounted && !isLoading) {
      if (user.role?.slug === "WAITER" || user.permissions?.includes("events:checkin")) {
        router.replace("/events/checkin");
      } else if (user.role?.slug === "CUSTOMER") {
        router.replace("/customer");
      }
    }
  }, [user, isMounted, isLoading, router]);

  // Reactive date-range calculation for Event Komunitas bookings and platform fee
  const eventStats = React.useMemo(() => {
    if (!allBookings.length) {
      return fallbackStats;
    }
    const filteredPaid = allBookings.filter(
      (b: any) =>
        b.paymentStatus === "PAID" &&
        (isDateInRange ? isDateInRange(b.createdAt) : true)
    );
    const totalRevenue = filteredPaid.reduce(
      (sum: number, b: any) => sum + (b.totalPrice || 0),
      0
    );
    const paidBookingsCount = filteredPaid.reduce(
      (sum: number, b: any) => sum + (b.ticketCount || 1),
      0
    );
    const platformRevenue = filteredPaid.reduce(
      (sum: number, b: any) => sum + (b.platformFeeAmount || 0),
      0
    );
    return { totalRevenue, paidBookingsCount, platformRevenue };
  }, [allBookings, fallbackStats, isDateInRange]);

  React.useEffect(() => {
    if (isDagoOwner) {
      // 1. Fetch bookings & payment stats
      fetch("/api/events/bookings?includeStats=true&unmasked=true")
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            if (json.stats) {
              setFallbackStats({
                totalRevenue: json.stats.totalTicketRevenue || 0,
                paidBookingsCount: json.stats.totalTicketsSold || 0,
                platformRevenue: json.stats.platformCommissionRevenue || 0,
              });
            }
            if (Array.isArray(json.data)) {
              setAllBookings(json.data);
              const pendingManual = json.data.filter(
                (b: any) =>
                  b.totalPrice > 0 &&
                  b.paymentStatus === "PENDING" &&
                  (b.paymentMethod === "MANUAL_TRANSFER" || Boolean(b.paymentProofUrl))
              ).length;
              setAdminActionAlerts((prev) => ({
                ...prev,
                pendingManualPaymentsCount: pendingManual,
              }));
            }
          }
        })
        .catch(() => {});

      // 2. Fetch admin events for pending moderation, revenue split, and payout requests
      fetch("/api/events/admin")
        .then((res) => res.json())
        .then((json) => {
          if (json.success && Array.isArray(json.data)) {
            const evts = json.data;
            const pendingMod = evts.filter((e: any) => e.status === "PENDING").length;
            const pendingSplit = evts.filter((e: any) => e.proposedRevenueSplit?.status === "PENDING").length;

            let pendingPayouts = 0;
            evts.forEach((e: any) => {
              if (Array.isArray(e.payoutHistory)) {
                pendingPayouts += e.payoutHistory.filter((p: any) => p.status === "REQUESTED").length;
              }
            });

            setAdminActionAlerts((prev) => ({
              ...prev,
              pendingModerationCount: pendingMod,
              pendingRevenueSplitCount: pendingSplit,
              pendingPayoutCount: pendingPayouts,
            }));
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

  const totalPendingActions =
    adminActionAlerts.pendingModerationCount +
    adminActionAlerts.pendingPayoutCount +
    adminActionAlerts.pendingRevenueSplitCount +
    adminActionAlerts.pendingManualPaymentsCount;

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
              {isDagoOwner
                ? user?.role?.slug === "SUPER_ADMIN"
                  ? "Super Admin Platform"
                  : "Owner Dago Hub"
                : isTenantOwner
                ? `Tenant: ${user?.tenant?.name || "Kopi Senja"}`
                : user?.role?.name || "Staff Dago Hub"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isDagoOwner
              ? "Ringkasan eksekutif operasional Dago Creative Hub"
              : `Ringkasan operasional bisnis ${user?.tenant?.name || "Kopi Senja"}`} •{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Outlet {activeOutlet?.name || "Singaraja (Pusat)"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DateRangePicker />
        </div>
      </div>

      {/* 2. Pusat Pemberitahuan & Perlu Penanganan (Executive Action Center) */}
      {isDagoOwner && totalPendingActions > 0 && (
        <div className="bg-amber-500/10 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-amber-200/60 dark:border-amber-800/60">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs shrink-0 animate-pulse">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Pemberitahuan & Perlu Penanganan Segera</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                    {totalPendingActions} Tindakan
                  </span>
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Pengajuan operasional dan transaksi yang memerlukan verifikasi atau tindak lanjut admin:
                </p>
              </div>
            </div>

            <Link
              href="/events-admin"
              className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Buka Event Hub</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {adminActionAlerts.pendingModerationCount > 0 && (
              <Link
                href="/events-admin?section=MODERATION&tab=PENDING"
                className="group flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 hover:border-amber-400 dark:hover:border-amber-500 transition-all shadow-2xs cursor-pointer hover:shadow-xs"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                      Moderasi Event
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {adminActionAlerts.pendingModerationCount} event baru
                    </div>
                  </div>
                </div>
                <div className="flex items-center text-xs font-bold text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
                  <span className="hidden sm:inline mr-1 text-[11px]">Tinjau</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            )}

            {adminActionAlerts.pendingPayoutCount > 0 && (
              <Link
                href="/events-admin?section=PAYOUTS"
                className="group flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 hover:border-emerald-400 dark:hover:border-emerald-500 transition-all shadow-2xs cursor-pointer hover:shadow-xs"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                      Pencairan (Payout)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {adminActionAlerts.pendingPayoutCount} permintaan saldo
                    </div>
                  </div>
                </div>
                <div className="flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
                  <span className="hidden sm:inline mr-1 text-[11px]">Proses</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            )}

            {adminActionAlerts.pendingRevenueSplitCount > 0 && (
              <Link
                href="/events-admin?section=MODERATION&tab=REVENUE_SPLIT"
                className="group flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/60 hover:border-purple-400 dark:hover:border-purple-500 transition-all shadow-2xs cursor-pointer hover:shadow-xs"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                      Usulan Bagi Hasil
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {adminActionAlerts.pendingRevenueSplitCount} proposal komisi
                    </div>
                  </div>
                </div>
                <div className="flex items-center text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
                  <span className="hidden sm:inline mr-1 text-[11px]">Tinjau</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            )}

            {adminActionAlerts.pendingManualPaymentsCount > 0 && (
              <Link
                href="/events-admin?section=PAYMENTS"
                className="group flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 hover:border-rose-400 dark:hover:border-rose-500 transition-all shadow-2xs cursor-pointer hover:shadow-xs"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors truncate">
                      Verifikasi Tiket
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {adminActionAlerts.pendingManualPaymentsCount} bukti transfer
                    </div>
                  </div>
                </div>
                <div className="flex items-center text-xs font-bold text-rose-600 dark:text-rose-400 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
                  <span className="hidden sm:inline mr-1 text-[11px]">Cek</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Tenant Alert if active tenant orders need attention */}
      {isTenantOwner && scopedOrders.filter((o) => o.status === "COOKING" || o.status === "KITCHEN_RECEIVED").length > 0 && (
        <div className="bg-sky-500/10 border border-sky-300 dark:border-sky-800 rounded-2xl p-4 shadow-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold">
              <Coffee className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 dark:text-white">
                {scopedOrders.filter((o) => o.status === "COOKING" || o.status === "KITCHEN_RECEIVED").length} Pesanan Sedang Dipersiapkan
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Dapur sedang memproses pesanan aktif tenant Anda.
              </p>
            </div>
          </div>
          <Link href="/orders" className="text-xs font-bold text-sky-600 hover:underline flex items-center gap-1">
            <span>Lihat Pesanan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* 3. Ringkasan Statistik Utama (4 KPI Cards) */}
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
