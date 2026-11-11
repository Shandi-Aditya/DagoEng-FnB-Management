"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

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
import { useOrders } from "@/contexts/OrderContext";
import { formatCurrencyIDR } from "@/lib/utils";

import { bucketHourly, bucketLastSevenDays, formatCompactIDR, splitPromoOrders } from "./dashboard-metrics";

type ChartView = "weekly" | "hourly" | "promo";

const VIEW_DESCRIPTIONS: Record<ChartView, string> = {
  weekly: "Omzet 7 hari terakhir dibanding HPP dan diskon promo",
  hourly: "Omzet per jam untuk melihat jam sibuk",
  promo: "Omzet transaksi promo dibanding transaksi reguler",
};

// One accent (primary) for the series that matters, neutral steps for the rest
const chartConfig = {
  revenue: { label: "Omzet", color: "var(--primary)" },
  cost: { label: "HPP (estimasi 38%)", color: "var(--muted-foreground)" },
  discount: { label: "Diskon promo", color: "var(--muted-foreground)" },
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
  const { filteredOrders } = useOrders();
  const [view, setView] = useState<ChartView>("weekly");

  const weekly = useMemo(() => bucketLastSevenDays(filteredOrders), [filteredOrders]);
  const hourly = useMemo(() => bucketHourly(filteredOrders), [filteredOrders]);
  const promo = useMemo(() => splitPromoOrders(filteredOrders), [filteredOrders]);

  const weeklyRevenue = weekly.reduce((sum, day) => sum + day.revenue, 0);
  const weeklyCost = weekly.reduce((sum, day) => sum + day.cost, 0);
  const weeklyDiscount = weekly.reduce((sum, day) => sum + day.discount, 0);
  const grossMargin = weeklyRevenue > 0 ? Math.round(((weeklyRevenue - weeklyCost) / weeklyRevenue) * 100) : 0;

  const hasData =
    view === "weekly"
      ? weeklyRevenue > 0
      : view === "hourly"
        ? hourly.some((slot) => slot.revenue > 0)
        : promo.some((bucket) => bucket.revenue > 0);

  const tooltip = <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => `${chartConfig[name as keyof typeof chartConfig]?.label ?? name}: ${currencyFormatter(value)}`} />} />;
  const yAxis = <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={formatCompactIDR} />;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Penjualan</CardTitle>
        <CardDescription>{VIEW_DESCRIPTIONS[view]}</CardDescription>
        <CardAction>
          <Tabs value={view} onValueChange={(value) => setView(value as ChartView)}>
            <TabsList>
              <TabsTrigger value="weekly">7 hari</TabsTrigger>
              <TabsTrigger value="hourly">Jam sibuk</TabsTrigger>
              <TabsTrigger value="promo">Promo</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {hasData ? (
          <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
            {view === "weekly" ? (
              <ComposedChart data={weekly} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                {yAxis}
                {tooltip}
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} maxBarSize={32} />
                <Bar dataKey="cost" fill="var(--color-cost)" fillOpacity={0.35} radius={4} maxBarSize={32} />
                <Line dataKey="discount" type="monotone" stroke="var(--color-discount)" strokeDasharray="4 4" strokeWidth={2} dot={false} />
              </ComposedChart>
            ) : view === "hourly" ? (
              <AreaChart data={hourly} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} tickMargin={8} />
                {yAxis}
                {tooltip}
                <Area dataKey="revenue" type="monotone" stroke="var(--color-revenue)" fill="var(--color-revenue)" fillOpacity={0.12} strokeWidth={2} />
              </AreaChart>
            ) : (
              <BarChart data={promo} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                {yAxis}
                {tooltip}
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} maxBarSize={56} />
                <Bar dataKey="discount" fill="var(--color-discount)" fillOpacity={0.35} radius={4} maxBarSize={56} />
              </BarChart>
            )}
          </ChartContainer>
        ) : (
          <EmptyState
            className="h-72"
            title="Belum ada transaksi di periode ini"
            description="Grafik muncul setelah ada pesanan yang tercatat"
          />
        )}

        <div className="grid grid-cols-3 gap-4 border-t pt-4">
          <Summary label="Omzet 7 hari" value={formatCurrencyIDR(weeklyRevenue)} />
          <Summary label="Margin kotor (estimasi)" value={`${grossMargin}%`} />
          <Summary label="Diskon promo" value={formatCurrencyIDR(weeklyDiscount)} />
        </div>
      </CardContent>
    </Card>
  );
}
