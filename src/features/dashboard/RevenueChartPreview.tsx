"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import {
  Clock,
  Flame,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { useOrders } from "@/contexts/OrderContext";
import { useOutlet } from "@/contexts/OutletContext";
import { cn, formatCurrencyIDR } from "@/lib/utils";

import {
  bucketDayOfWeekTraffic,
  bucketHourly,
  bucketOrdersByDateRange,
  calculatePeriodComparison,
  calculateSalesForecast,
  extractOrderCustomerCount,
  findPeakAndQuietHours,
  formatCompactIDR,
  projectDashboardOrdersForTenant,
  resolveComparisonRange,
  scopeDashboardOrders,
  splitPromoOrders,
  type ComparisonMode,
  type ForecastMethod,
  type TrafficMetric,
} from "./dashboard-metrics";

type ChartView = "weekly" | "hourly" | "dayOfWeek" | "comparison" | "forecast" | "promo";

const VIEW_DESCRIPTIONS: Record<ChartView, string> = {
  weekly: "Tren harian omzet dan volume traffic transaksi pada periode terpilih",
  hourly: "Distribusi volume transaksi dan customer per jam operasional",
  dayOfWeek: "Combo chart traffic dan omzet berdasarkan hari dalam seminggu",
  comparison: "Perbandingan performa traffic dan penjualan antarperiode (Period-over-Period)",
  forecast: "Estimasi proyeksi statistik penjualan dan traffic untuk periode berikutnya",
  promo: "Omzet transaksi promo dibanding transaksi reguler",
};

const chartConfig = {
  revenue: { label: "Omzet", color: "var(--chart-1)" },
  orders: { label: "Traffic Transaksi", color: "var(--chart-2)" },
  cost: { label: "HPP (estimasi 38%)", color: "var(--muted-foreground)" },
  discount: { label: "Diskon promo", color: "var(--destructive)" },
  customers: { label: "Customer", color: "var(--chart-3)" },
  currentRevenue: { label: "Omzet periode ini", color: "var(--chart-1)" },
  previousRevenue: { label: "Omzet periode lalu", color: "var(--muted-foreground)" },
  currentOrders: { label: "Transaksi periode ini", color: "var(--chart-2)" },
  previousOrders: { label: "Transaksi periode lalu", color: "var(--muted)" },
  projectedRevenue: { label: "Proyeksi omzet", color: "var(--chart-1)" },
  upperBoundRevenue: { label: "Batas atas proyeksi", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

const currencyFormatter = (value: unknown) => formatCurrencyIDR(Number(value) || 0);

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function RevenueChartPreview() {
  const { user } = useAuth();
  const { startDate, endDate, isDateInRange } = useDateFilter();
  const { orders: allOrders, filteredOrders } = useOrders();
  const { activeOutletId, isAllOutlets } = useOutlet();

  const [view, setView] = useState<ChartView>("weekly");
  const [trafficMetric, setTrafficMetric] = useState<TrafficMetric>("orders");
  const [compareMode, setCompareMode] = useState<ComparisonMode>("PREVIOUS_PERIOD");
  const [forecastMethod, setForecastMethod] = useState<ForecastMethod>("WEIGHTED_MOVING_AVERAGE");
  const [weeklyComboMode, setWeeklyComboMode] = useState<"combo" | "financial">("combo");

  const isTenantOwner = user?.scopeLevel === "TENANT" && Boolean(user?.tenant?.id);
  const tenantId = user?.tenant?.id;

  const scopedOrders = useMemo(() => {
    const paid = scopeDashboardOrders(filteredOrders, {
      tenantId,
      isTenantOwner,
      isDateInRange,
      requirePaid: true,
    });
    return isTenantOwner && tenantId ? projectDashboardOrdersForTenant(paid, tenantId) : paid;
  }, [filteredOrders, tenantId, isTenantOwner, isDateInRange]);

  const daily = useMemo(
    () => bucketOrdersByDateRange(scopedOrders, startDate, endDate),
    [scopedOrders, startDate, endDate],
  );
  const hourly = useMemo(() => bucketHourly(scopedOrders), [scopedOrders]);
  const dayOfWeek = useMemo(() => bucketDayOfWeekTraffic(scopedOrders), [scopedOrders]);
  const promo = useMemo(() => splitPromoOrders(scopedOrders), [scopedOrders]);

  const peakAndQuiet = useMemo(
    () => findPeakAndQuietHours(hourly, trafficMetric),
    [hourly, trafficMetric],
  );

  const compareRange = useMemo(
    () => resolveComparisonRange(startDate, endDate, compareMode),
    [startDate, endDate, compareMode],
  );

  const previousScopedOrders = useMemo(() => {
    const isPrevInRange = (dateStr: string) => {
      if (!dateStr) return false;
      const key = dateStr.slice(0, 10);
      return key >= compareRange.startDate && key <= compareRange.endDate;
    };
    const outletOrders = isAllOutlets
      ? allOrders
      : allOrders.filter((o) => !o.outletId || o.outletId === activeOutletId);

    const paid = scopeDashboardOrders(outletOrders, {
      tenantId,
      isTenantOwner,
      isDateInRange: isPrevInRange,
      requirePaid: true,
    });
    return isTenantOwner && tenantId ? projectDashboardOrdersForTenant(paid, tenantId) : paid;
  }, [allOrders, tenantId, isTenantOwner, isAllOutlets, activeOutletId, compareRange.startDate, compareRange.endDate]);

  const periodComparison = useMemo(
    () =>
      calculatePeriodComparison(
        scopedOrders,
        previousScopedOrders,
        { startDate, endDate },
        compareRange,
      ),
    [scopedOrders, previousScopedOrders, startDate, endDate, compareRange],
  );

  const comparisonChartData = useMemo(() => {
    return [
      {
        category: "Omzet (ribuan Rp)",
        currentRevenue: Math.round(periodComparison.current.revenue / 1000),
        previousRevenue: Math.round(periodComparison.previous.revenue / 1000),
      },
    ];
  }, [periodComparison]);

  const forecast = useMemo(
    () => calculateSalesForecast(daily, 7, forecastMethod),
    [daily, forecastMethod],
  );

  // Transition historical daily data into projected days for seamless visualization
  const forecastCombinedChartData = useMemo(() => {
    const recentHistorical = daily.slice(-7).map((d) => ({
      label: d.day,
      fullDate: d.date,
      historicalRevenue: d.revenue,
      projectedRevenue: undefined as number | undefined,
      upperBound: undefined as number | undefined,
      orders: d.orders,
      isForecast: false,
    }));

    if (recentHistorical.length > 0 && forecast.forecastDays.length > 0) {
      // Anchor projection at the last known historical point
      const lastHist = recentHistorical[recentHistorical.length - 1];
      lastHist.projectedRevenue = lastHist.historicalRevenue;
      lastHist.upperBound = lastHist.historicalRevenue;
    }

    const projectedPoints = forecast.forecastDays.map((f) => ({
      label: `${f.day}*`,
      fullDate: f.date,
      historicalRevenue: undefined as number | undefined,
      projectedRevenue: f.projectedRevenue,
      upperBound: f.upperBoundRevenue,
      orders: f.projectedOrders,
      isForecast: true,
    }));

    return [...recentHistorical, ...projectedPoints];
  }, [daily, forecast]);

  const periodRevenue = daily.reduce((sum, day) => sum + day.revenue, 0);
  const periodCost = daily.reduce((sum, day) => sum + day.cost, 0);
  const periodDiscount = daily.reduce((sum, day) => sum + day.discount, 0);
  const periodOrders = daily.reduce((sum, day) => sum + day.orders, 0);
  const periodCustomers = scopedOrders.reduce(
    (sum, order) => sum + extractOrderCustomerCount(order),
    0,
  );
  const grossMargin =
    periodRevenue > 0
      ? Math.round(((periodRevenue - periodCost) / periodRevenue) * 100)
      : 0;

  const busiestDay = useMemo(() => {
    const active = dayOfWeek.filter((d) => d.orders > 0);
    if (active.length === 0) return null;
    return active.reduce((max, d) => (d.revenue > max.revenue ? d : max), active[0]);
  }, [dayOfWeek]);

  const quietestDay = useMemo(() => {
    const active = dayOfWeek.filter((d) => d.orders > 0);
    if (active.length === 0) return null;
    return active.reduce((min, d) => (d.revenue < min.revenue ? d : min), active[0]);
  }, [dayOfWeek]);

  const hasData =
    view === "weekly"
      ? periodRevenue > 0 || periodOrders > 0
      : view === "hourly"
        ? hourly.some((slot) => slot[trafficMetric] > 0)
        : view === "dayOfWeek"
          ? dayOfWeek.some((d) => d.orders > 0 || d.revenue > 0)
          : view === "comparison"
            ? periodComparison.current.orders > 0 || periodComparison.previous.orders > 0
            : view === "forecast"
              ? forecast.hasSufficientData
              : promo.some((bucket) => bucket.revenue > 0);

  const currencyTooltip = (
    <ChartTooltip
      content={
        <ChartTooltipContent
          formatter={(value, name) =>
            `${chartConfig[name as keyof typeof chartConfig]?.label ?? name}: ${currencyFormatter(value)}`
          }
        />
      }
    />
  );

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <CardTitle className="text-sm font-medium">Tren penjualan dan traffic</CardTitle>
          <CardDescription>{VIEW_DESCRIPTIONS[view]}</CardDescription>
        </div>
        <CardAction className="w-full sm:w-auto overflow-x-auto">
          <Tabs value={view} onValueChange={(value) => setView(value as ChartView)}>
            <TabsList className="h-8 w-full sm:w-auto overflow-x-auto p-0.5 justify-start">
              <TabsTrigger value="weekly">Harian</TabsTrigger>
              <TabsTrigger value="hourly">Jam sibuk</TabsTrigger>
              <TabsTrigger value="dayOfWeek">Pola hari</TabsTrigger>
              <TabsTrigger value="comparison">Perbandingan</TabsTrigger>
              <TabsTrigger value="forecast">Prediksi</TabsTrigger>
              <TabsTrigger value="promo">Promo</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Kontrol dan kartu ringkasan Jam Sibuk */}
        {view === "hourly" ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Metrik traffic sumbu Y:</span>
                <div className="inline-flex rounded-md border bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => setTrafficMetric("orders")}
                    className={cn(
                      "flex items-center gap-1 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                      trafficMetric === "orders"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <ShoppingBag className="size-3.5" />
                    Jumlah transaksi
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrafficMetric("customers")}
                    className={cn(
                      "flex items-center gap-1 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                      trafficMetric === "customers"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Users className="size-3.5" />
                    Jumlah customer
                  </button>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                Sumbu Y dihitung dari kuantitas ({trafficMetric === "orders" ? "transaksi" : "customer"}), bukan nominal harga
              </span>
            </div>

            {/* Highlight cards: Jam Paling Ramai & Jam Paling Sepi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-xs">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Flame className="size-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-muted-foreground font-medium">Jam Paling Ramai</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-semibold tabular-nums">
                      {peakAndQuiet.busiest ? peakAndQuiet.busiest.hour : "-"}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {peakAndQuiet.busiest
                        ? `${peakAndQuiet.busiest[trafficMetric]} ${trafficMetric === "orders" ? "transaksi" : "customer"} (${formatCompactIDR(peakAndQuiet.busiest.revenue)})`
                        : "Belum ada transaksi"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-xs">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Clock className="size-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-muted-foreground font-medium">Jam Paling Sepi</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-semibold tabular-nums">
                      {peakAndQuiet.quietest ? peakAndQuiet.quietest.hour : "-"}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {peakAndQuiet.quietest
                        ? `${peakAndQuiet.quietest[trafficMetric]} ${trafficMetric === "orders" ? "transaksi" : "customer"} (${formatCompactIDR(peakAndQuiet.quietest.revenue)})`
                        : "Belum ada transaksi"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Kontrol tren harian: Combo vs Finansial */}
        {view === "weekly" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2.5">
            <span className="text-xs text-muted-foreground">Tampilan visual:</span>
            <div className="inline-flex rounded-md border bg-background p-0.5">
              <button
                type="button"
                onClick={() => setWeeklyComboMode("combo")}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                  weeklyComboMode === "combo"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Combo (Bar Transaksi + Line Omzet)
              </button>
              <button
                type="button"
                onClick={() => setWeeklyComboMode("financial")}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                  weeklyComboMode === "financial"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Rincian Biaya & Diskon
              </button>
            </div>
          </div>
        ) : null}

        {/* Kontrol filter Perbandingan Antarperiode */}
        {view === "comparison" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Periode pembanding:</span>
              <div className="inline-flex rounded-md border bg-background p-0.5">
                <button
                  type="button"
                  onClick={() => setCompareMode("PREVIOUS_PERIOD")}
                  className={cn(
                    "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                    compareMode === "PREVIOUS_PERIOD"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Periode sebelumnya
                </button>
                <button
                  type="button"
                  onClick={() => setCompareMode("LAST_WEEK")}
                  className={cn(
                    "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                    compareMode === "LAST_WEEK"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Minggu lalu
                </button>
                <button
                  type="button"
                  onClick={() => setCompareMode("LAST_MONTH")}
                  className={cn(
                    "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                    compareMode === "LAST_MONTH"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Bulan lalu
                </button>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              Membandingkan rentang <span className="font-medium text-foreground">{startDate} s.d. {endDate}</span> dengan{" "}
              <span className="font-medium text-foreground">{compareRange.label}</span> ({compareRange.startDate} s.d. {compareRange.endDate})
            </span>
          </div>
        ) : null}

        {/* Kontrol metode Forecasting */}
        {view === "forecast" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Metode prediksi statistik:</span>
              <div className="inline-flex rounded-md border bg-background p-0.5">
                <button
                  type="button"
                  onClick={() => setForecastMethod("WEIGHTED_MOVING_AVERAGE")}
                  className={cn(
                    "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                    forecastMethod === "WEIGHTED_MOVING_AVERAGE"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Weighted Moving Average
                </button>
                <button
                  type="button"
                  onClick={() => setForecastMethod("LINEAR_REGRESSION")}
                  className={cn(
                    "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                    forecastMethod === "LINEAR_REGRESSION"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Linear Regression
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              <span>Garis putus-putus (*): Proyeksi 7 hari ke depan</span>
            </div>
          </div>
        ) : null}

        {hasData ? (
          <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
            {view === "weekly" ? (
              weeklyComboMode === "combo" ? (
                <ComposedChart data={daily} margin={{ left: 0, right: 16, top: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tickFormatter={formatCompactIDR}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    allowDecimals={false}
                    tickFormatter={(v) => `${v} trx`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => {
                          if (name === "revenue") return `Omzet: ${currencyFormatter(value)}`;
                          if (name === "orders") return `Transaksi: ${value} pesanan`;
                          return `${name}: ${value}`;
                        }}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar
                    yAxisId="right"
                    dataKey="orders"
                    fill="var(--color-orders)"
                    radius={4}
                    maxBarSize={32}
                  />
                  <Line
                    yAxisId="left"
                    dataKey="revenue"
                    type="monotone"
                    stroke="var(--color-revenue)"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              ) : (
                <ComposedChart data={daily} margin={{ left: 0, right: 8, top: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={formatCompactIDR} />
                  {currencyTooltip}
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} maxBarSize={32} />
                  <Bar
                    dataKey="cost"
                    fill="var(--color-cost)"
                    fillOpacity={0.35}
                    radius={4}
                    maxBarSize={32}
                  />
                  <Line
                    dataKey="discount"
                    type="monotone"
                    stroke="var(--color-discount)"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              )
            ) : view === "hourly" ? (
              <BarChart data={hourly} margin={{ left: 0, right: 8, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  allowDecimals={false}
                  tickFormatter={(val) => `${val}`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, item) => {
                        const payload = item.payload as { revenue?: number };
                        const countLabel = `${value} ${trafficMetric === "orders" ? "transaksi" : "customer"}`;
                        const revLabel = payload.revenue ? ` (${currencyFormatter(payload.revenue)})` : "";
                        return `${countLabel}${revLabel}`;
                      }}
                    />
                  }
                />
                <Bar
                  dataKey={trafficMetric}
                  fill="var(--color-orders)"
                  radius={4}
                  maxBarSize={40}
                />
              </BarChart>
            ) : view === "dayOfWeek" ? (
              // Combo chart: Bar for Traffic (orders) and Line for Revenue
              <ComposedChart data={dayOfWeek} margin={{ left: 0, right: 16, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="dayName" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={formatCompactIDR}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  allowDecimals={false}
                  tickFormatter={(v) => `${v} trx`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        if (name === "revenue") return `Omzet: ${currencyFormatter(value)}`;
                        if (name === "orders") return `Traffic transaksi: ${value} pesanan`;
                        if (name === "customers") return `Customer: ${value} orang`;
                        return `${name}: ${value}`;
                      }}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  yAxisId="right"
                  dataKey="orders"
                  fill="var(--color-orders)"
                  radius={4}
                  maxBarSize={36}
                />
                <Line
                  yAxisId="left"
                  dataKey="revenue"
                  type="monotone"
                  stroke="var(--color-revenue)"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              </ComposedChart>
            ) : view === "comparison" ? (
              <BarChart data={comparisonChartData} margin={{ left: 0, right: 8, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="category" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(v) => `Rp ${v} rb`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        const nominal = Number(value) * 1000;
                        const label =
                          name === "currentRevenue" ? "Periode ini" : "Periode pembanding";
                        return `${label}: ${currencyFormatter(nominal)}`;
                      }}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="currentRevenue"
                  fill="var(--color-currentRevenue)"
                  radius={4}
                  maxBarSize={64}
                />
                <Bar
                  dataKey="previousRevenue"
                  fill="var(--color-previousRevenue)"
                  fillOpacity={0.5}
                  radius={4}
                  maxBarSize={64}
                />
              </BarChart>
            ) : view === "forecast" ? (
              <ComposedChart data={forecastCombinedChartData} margin={{ left: 0, right: 8, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={formatCompactIDR} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, item) => {
                        const payload = item.payload as { isForecast?: boolean; fullDate?: string; orders?: number };
                        if (name === "historicalRevenue") {
                          return `Omzet historis: ${currencyFormatter(value)} (${payload.orders ?? 0} trx)`;
                        }
                        if (name === "projectedRevenue") {
                          return `Estimasi proyeksi*: ${currencyFormatter(value)} (${payload.orders ?? 0} trx)`;
                        }
                        if (name === "upperBound") {
                          return `Batas atas estimasi: ${currencyFormatter(value)}`;
                        }
                        return `${name}: ${currencyFormatter(value)}`;
                      }}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                {/* Confidence interval band for projections */}
                <Area
                  dataKey="upperBound"
                  type="monotone"
                  stroke="transparent"
                  fill="var(--color-projectedRevenue)"
                  fillOpacity={0.12}
                />
                {/* Historical solid line */}
                <Line
                  dataKey="historicalRevenue"
                  type="monotone"
                  stroke="var(--color-revenue)"
                  strokeWidth={2.5}
                  dot={{ r: 3.5 }}
                />
                {/* Projected dashed line */}
                <Line
                  dataKey="projectedRevenue"
                  type="monotone"
                  stroke="var(--color-projectedRevenue)"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  dot={{ r: 4, strokeDasharray: "" }}
                />
              </ComposedChart>
            ) : (
              <BarChart data={promo} margin={{ left: 0, right: 8, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={formatCompactIDR} />
                {currencyTooltip}
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} maxBarSize={56} />
                <Bar
                  dataKey="discount"
                  fill="var(--color-discount)"
                  fillOpacity={0.35}
                  radius={4}
                  maxBarSize={56}
                />
              </BarChart>
            )}
          </ChartContainer>
        ) : (
          <EmptyState
            className="h-72"
            title="Belum ada data untuk ditampilkan"
            description="Grafik dan analisis muncul setelah ada transaksi yang tercatat pada rentang waktu ini"
          />
        )}

        {/* Ringkasan metrik di bagian bawah kartu */}
        {view === "weekly" ? (
          <div className="grid grid-cols-3 gap-4 border-t pt-4">
            <Summary label="Omzet periode" value={formatCurrencyIDR(periodRevenue)} />
            <Summary label="Margin kotor (estimasi)" value={`${grossMargin}%`} />
            <Summary label="Total transaksi" value={`${periodOrders} transaksi`} />
          </div>
        ) : view === "hourly" ? (
          <div className="grid grid-cols-3 gap-4 border-t pt-4">
            <Summary label="Total transaksi" value={`${periodOrders} transaksi`} />
            <Summary label="Total customer" value={`${periodCustomers} customer`} />
            <Summary
              label="Jam tersibuk"
              value={
                peakAndQuiet.busiest
                  ? `${peakAndQuiet.busiest.hour} (${peakAndQuiet.busiest[trafficMetric]} ${trafficMetric === "orders" ? "transaksi" : "customer"})`
                  : "-"
              }
            />
          </div>
        ) : view === "dayOfWeek" ? (
          <div className="grid grid-cols-3 gap-4 border-t pt-4">
            <Summary
              label="Hari omzet tertinggi"
              value={
                busiestDay
                  ? `${busiestDay.dayName} (${formatCompactIDR(busiestDay.revenue)})`
                  : "-"
              }
            />
            <Summary
              label="Hari paling tenang"
              value={
                quietestDay
                  ? `${quietestDay.dayName} (${formatCompactIDR(quietestDay.revenue)})`
                  : "-"
              }
            />
            <Summary
              label="Rata-rata transaksi harian"
              value={
                periodOrders > 0
                  ? `${Math.round(periodOrders / Math.max(1, daily.length))} transaksi`
                  : "-"
              }
            />
          </div>
        ) : view === "comparison" ? (
          <div className="grid grid-cols-3 gap-4 border-t pt-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Delta penjualan (omzet)</span>
              <div className="flex items-center gap-1.5 font-medium tabular-nums">
                {periodComparison.deltas.revenuePercent >= 0 ? (
                  <TrendingUp className="size-4 text-success" />
                ) : (
                  <TrendingDown className="size-4 text-destructive" />
                )}
                <span className="text-sm">
                  {periodComparison.deltas.revenuePercent >= 0 ? "+" : ""}
                  {periodComparison.deltas.revenuePercent}%
                </span>
                <span className="text-xs text-muted-foreground">
                  ({formatCompactIDR(periodComparison.deltas.revenueAmount)})
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Delta traffic (transaksi)</span>
              <div className="flex items-center gap-1.5 font-medium tabular-nums">
                {periodComparison.deltas.ordersPercent >= 0 ? (
                  <TrendingUp className="size-4 text-success" />
                ) : (
                  <TrendingDown className="size-4 text-destructive" />
                )}
                <span className="text-sm">
                  {periodComparison.deltas.ordersPercent >= 0 ? "+" : ""}
                  {periodComparison.deltas.ordersPercent}%
                </span>
                <span className="text-xs text-muted-foreground">
                  ({periodComparison.deltas.ordersCount >= 0 ? "+" : ""}
                  {periodComparison.deltas.ordersCount} pesanan)
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Delta customer</span>
              <div className="flex items-center gap-1.5 font-medium tabular-nums">
                {periodComparison.deltas.customersPercent >= 0 ? (
                  <TrendingUp className="size-4 text-success" />
                ) : (
                  <TrendingDown className="size-4 text-destructive" />
                )}
                <span className="text-sm">
                  {periodComparison.deltas.customersPercent >= 0 ? "+" : ""}
                  {periodComparison.deltas.customersPercent}%
                </span>
                <span className="text-xs text-muted-foreground">
                  ({periodComparison.deltas.customersCount >= 0 ? "+" : ""}
                  {periodComparison.deltas.customersCount} orang)
                </span>
              </div>
            </div>
          </div>
        ) : view === "forecast" ? (
          <div className="flex flex-col gap-3 border-t pt-4">
            <div className="grid grid-cols-3 gap-4">
              <Summary
                label="Proyeksi 7 hari ke depan"
                value={formatCurrencyIDR(forecast.totalProjectedRevenue)}
              />
              <Summary
                label="Rata-rata proyeksi / hari"
                value={formatCurrencyIDR(forecast.dailyAverageProjectedRevenue)}
              />
              <Summary
                label="Estimasi total transaksi"
                value={`${forecast.totalProjectedOrders} transaksi`}
              />
            </div>
            <div className="rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Catatan proyeksi:</span> Angka bersifat estimasi statistik ({forecast.methodology}) berdasarkan tren data harian dan faktor musiman hari operasional.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 border-t pt-4">
            <Summary
              label="Omzet reguler"
              value={formatCurrencyIDR(
                promo.find((p) => p.name === "Reguler")?.revenue ?? 0,
              )}
            />
            <Summary
              label="Omzet promo"
              value={formatCurrencyIDR(
                promo.find((p) => p.name === "Promo")?.revenue ?? 0,
              )}
            />
            <Summary label="Diskon promo" value={formatCurrencyIDR(periodDiscount)} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
