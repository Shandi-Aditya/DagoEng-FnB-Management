"use client";

import { useMemo, useState } from "react";
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
import { Clock, ShoppingBag, TrendingDown, TrendingUp, Users } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toWitaDateKey, useDateFilter } from "@/contexts/DateFilterContext";
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
  getPreviousPeriodRange,
  projectDashboardOrdersForTenant,
  scopeDashboardOrders,
  splitPromoOrders,
  type TrafficMetric,
} from "./dashboard-metrics";

type ChartView = "weekly" | "hourly" | "dayOfWeek" | "comparison" | "forecast" | "promo";

const VIEW_DESCRIPTIONS: Record<ChartView, string> = {
  weekly: "Omzet harian pada periode terpilih dibanding HPP dan diskon promo",
  hourly: "Distribusi volume transaksi dan customer per jam operasional",
  dayOfWeek: "Tren traffic dan penjualan berdasarkan hari dalam seminggu",
  comparison: "Perbandingan performa traffic dan penjualan antarperiode",
  forecast: "Estimasi proyeksi penjualan dan traffic untuk 7 hari ke depan",
  promo: "Omzet transaksi promo dibanding transaksi reguler",
};

const chartConfig = {
  revenue: { label: "Omzet", color: "var(--primary)" },
  cost: { label: "HPP (estimasi 38%)", color: "var(--muted-foreground)" },
  discount: { label: "Diskon promo", color: "var(--muted-foreground)" },
  orders: { label: "Transaksi", color: "var(--primary)" },
  customers: { label: "Customer", color: "var(--primary)" },
  currentRevenue: { label: "Omzet periode ini", color: "var(--primary)" },
  previousRevenue: { label: "Omzet periode lalu", color: "var(--muted-foreground)" },
  projectedRevenue: { label: "Proyeksi omzet", color: "var(--primary)" },
  upperBoundRevenue: { label: "Batas atas", color: "var(--muted-foreground)" },
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

  const prevRange = useMemo(
    () => getPreviousPeriodRange(startDate, endDate),
    [startDate, endDate],
  );

  const previousScopedOrders = useMemo(() => {
    const isPrevInRange = (dateStr: string) => {
      const dKey = toWitaDateKey(dateStr);
      return Boolean(dKey) && dKey >= prevRange.startDate && dKey <= prevRange.endDate;
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
  }, [allOrders, tenantId, isTenantOwner, isAllOutlets, activeOutletId, prevRange.startDate, prevRange.endDate]);

  const periodComparison = useMemo(
    () =>
      calculatePeriodComparison(
        scopedOrders,
        previousScopedOrders,
        { startDate, endDate },
        prevRange,
      ),
    [scopedOrders, previousScopedOrders, startDate, endDate, prevRange],
  );

  const comparisonChartData = useMemo(() => {
    return [
      {
        name: "Omzet (dalam ribuan)",
        currentRevenue: Math.round(periodComparison.current.revenue / 1000),
        previousRevenue: Math.round(periodComparison.previous.revenue / 1000),
      },
    ];
  }, [periodComparison]);

  const forecast = useMemo(() => calculateSalesForecast(daily, 7), [daily]);

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
      ? periodRevenue > 0
      : view === "hourly"
        ? hourly.some((slot) => slot[trafficMetric] > 0)
        : view === "dayOfWeek"
          ? dayOfWeek.some((d) => d.orders > 0)
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
  const yAxisCurrency = (
    <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={formatCompactIDR} />
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Tren penjualan dan traffic</CardTitle>
        <CardDescription>{VIEW_DESCRIPTIONS[view]}</CardDescription>
        <CardAction>
          <Tabs value={view} onValueChange={(value) => setView(value as ChartView)}>
            <TabsList className="h-8 max-w-full overflow-x-auto p-0.5">
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
        {view === "hourly" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Metrik traffic:</span>
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
                  Transaksi
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
                  Customer
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Jam paling ramai:</span>
                <span className="font-medium tabular-nums">
                  {peakAndQuiet.busiest
                    ? `${peakAndQuiet.busiest.hour} (${peakAndQuiet.busiest[trafficMetric]} ${trafficMetric === "orders" ? "transaksi" : "customer"})`
                    : "Belum ada data"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Jam paling sepi:</span>
                <span className="font-medium tabular-nums">
                  {peakAndQuiet.quietest
                    ? `${peakAndQuiet.quietest.hour} (${peakAndQuiet.quietest[trafficMetric]} ${trafficMetric === "orders" ? "transaksi" : "customer"})`
                    : "Belum ada data"}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {hasData ? (
          <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
            {view === "weekly" ? (
              <ComposedChart data={daily} margin={{ left: 0, right: 8, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                {yAxisCurrency}
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
                      formatter={(value) =>
                        `${value} ${trafficMetric === "orders" ? "transaksi" : "customer"}`
                      }
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
              <ComposedChart data={dayOfWeek} margin={{ left: 0, right: 8, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="dayName" tickLine={false} axisLine={false} tickMargin={8} />
                {yAxisCurrency}
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        if (name === "revenue") return `Omzet: ${currencyFormatter(value)}`;
                        if (name === "orders") return `Transaksi: ${value} pesanan`;
                        if (name === "customers") return `Customer: ${value} orang`;
                        return `${name}: ${value}`;
                      }}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} maxBarSize={36} />
                <Line
                  dataKey="orders"
                  type="monotone"
                  stroke="var(--color-orders)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </ComposedChart>
            ) : view === "comparison" ? (
              <BarChart data={comparisonChartData} margin={{ left: 0, right: 8, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
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
                          name === "currentRevenue" ? "Periode ini" : "Periode sebelumnya";
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
              <AreaChart data={forecast.forecastDays} margin={{ left: 0, right: 8, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="dayName" tickLine={false} axisLine={false} tickMargin={8} />
                {yAxisCurrency}
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        if (name === "projectedRevenue") {
                          return `Estimasi omzet: ${currencyFormatter(value)}`;
                        }
                        if (name === "upperBoundRevenue") {
                          return `Batas atas: ${currencyFormatter(value)}`;
                        }
                        return `${name}: ${currencyFormatter(value)}`;
                      }}
                    />
                  }
                />
                <Area
                  dataKey="upperBoundRevenue"
                  type="monotone"
                  stroke="transparent"
                  fill="var(--color-projectedRevenue)"
                  fillOpacity={0.1}
                />
                <Area
                  dataKey="projectedRevenue"
                  type="monotone"
                  stroke="var(--color-projectedRevenue)"
                  fill="var(--color-projectedRevenue)"
                  fillOpacity={0.25}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </AreaChart>
            ) : (
              <BarChart data={promo} margin={{ left: 0, right: 8, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                {yAxisCurrency}
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

        {view === "weekly" ? (
          <div className="grid grid-cols-3 gap-4 border-t pt-4">
            <Summary label="Omzet periode" value={formatCurrencyIDR(periodRevenue)} />
            <Summary label="Margin kotor (estimasi)" value={`${grossMargin}%`} />
            <Summary label="Diskon promo" value={formatCurrencyIDR(periodDiscount)} />
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
              <span className="text-xs text-muted-foreground">Pertumbuhan omzet</span>
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
              <span className="text-xs text-muted-foreground">Pertumbuhan transaksi</span>
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
              <span className="text-xs text-muted-foreground">Pertumbuhan customer</span>
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
          <div className="grid grid-cols-3 gap-4 border-t pt-4">
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
