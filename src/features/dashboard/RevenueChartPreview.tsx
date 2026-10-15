"use client";

import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useOrders } from "@/contexts/OrderContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { BarChart3, TrendingUp, Sparkles, Tag, Clock } from "lucide-react";

type ChartViewMode = "weekly" | "hourly" | "promo_impact";

export function RevenueChartPreview() {
  const { filteredOrders } = useOrders();
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [viewMode, setViewMode] = useState<ChartViewMode>("weekly");

  const gridColor = isDark ? "#334155" : "#f1f5f9";
  const axisColor = isDark ? "#94a3b8" : "#64748b";
  const tooltipBg = isDark ? "#0f172a" : "#ffffff";
  const tooltipBorder = isDark ? "#334155" : "#e2e8f0";
  const primarySage = isDark ? "#52B788" : "#3B7A57";

  // Calculate dynamic weekly data based strictly on filteredOrders
  const weeklyData = useMemo(() => {
    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const now = new Date();
    
    interface DayBucket {
      dateStr: string;
      day: string;
      isToday: boolean;
      revenue: number;
      cogs: number;
      discount: number;
      ordersCount: number;
    }

    // Initialize 7 days ending today
    const days: DayBucket[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayIndex = d.getDay();
      const dateStr = d.toISOString().split("T")[0];
      const dayLabel = dayNames[dayIndex];
      
      days.push({
        dateStr,
        day: dayLabel,
        isToday: i === 0,
        revenue: 0,
        cogs: 0,
        discount: 0,
        ordersCount: 0,
      });
    }

    // Populate with real filteredOrders
    filteredOrders.forEach((order) => {
      const orderDateStr = order.createdAt ? order.createdAt.split("T")[0] : "";
      const matchedDay = days.find((d) => d.dateStr === orderDateStr) || days[days.length - 1];
      if (matchedDay) {
        matchedDay.revenue += order.total || 0;
        matchedDay.discount += order.discount || 0;
        matchedDay.cogs += Math.round((order.total || 0) * 0.38);
        matchedDay.ordersCount += 1;
      }
    });

    return days.map((d) => ({
      ...d,
      netProfit: d.revenue - d.cogs,
      marginPercent: d.revenue > 0 ? Math.round(((d.revenue - d.cogs) / d.revenue) * 100) : 0,
    }));
  }, [filteredOrders]);

  // Hourly Peak data from live orders
  const hourlyData = useMemo(() => {
    const hourSlots = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
    const slotMap: Record<string, { orders: number; rev: number }> = {};
    hourSlots.forEach((h) => {
      slotMap[h] = { orders: 0, rev: 0 };
    });

    filteredOrders.forEach((o) => {
      if (o.createdAt) {
        const orderHour = new Date(o.createdAt).getHours();
        let closestSlot = "08:00";
        if (orderHour >= 21) closestSlot = "22:00";
        else if (orderHour >= 19) closestSlot = "20:00";
        else if (orderHour >= 17) closestSlot = "18:00";
        else if (orderHour >= 15) closestSlot = "16:00";
        else if (orderHour >= 13) closestSlot = "14:00";
        else if (orderHour >= 11) closestSlot = "12:00";
        else if (orderHour >= 9) closestSlot = "10:00";
        slotMap[closestSlot].orders += 1;
        slotMap[closestSlot].rev += o.total || 0;
      }
    });

    return hourSlots.map((h) => ({
      hour: h,
      orders: slotMap[h].orders,
      revenue: slotMap[h].rev,
      traffic: slotMap[h].orders > 10 ? "Peak" : slotMap[h].orders > 0 ? "Normal" : "Tenang",
    }));
  }, [filteredOrders]);

  // Promo vs Regular Breakdown from live orders
  const promoData = useMemo(() => {
    const ordersWithPromo = filteredOrders.filter((o) => (o.discount && o.discount > 0) || o.promoId);
    const promoRev = ordersWithPromo.reduce((sum, o) => sum + o.total, 0);
    const promoDisc = ordersWithPromo.reduce((sum, o) => sum + (o.discount || 0), 0);
    
    const regularOrders = filteredOrders.filter((o) => !o.discount && !o.promoId);
    const regularRev = regularOrders.reduce((sum, o) => sum + o.total, 0);

    return [
      { name: "Transaksi Promo", revenue: promoRev, discount: promoDisc, orders: ordersWithPromo.length },
      { name: "Transaksi Reguler", revenue: regularRev, discount: 0, orders: regularOrders.length },
    ];
  }, [filteredOrders]);

  // Smart Adaptive Y-Axis Currency Formatter
  const formatYAxisValue = (val: number) => {
    if (!val || val === 0) return "Rp 0";
    if (val >= 1_000_000_000) {
      const v = val / 1_000_000_000;
      return `Rp ${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} M`;
    }
    if (val >= 1_000_000) {
      const v = val / 1_000_000;
      return `Rp ${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} jt`;
    }
    if (val >= 1_000) {
      const v = val / 1_000;
      return `Rp ${v % 1 === 0 ? v.toFixed(0) : v.toFixed(0)} rb`;
    }
    return `Rp ${val.toLocaleString("id-ID")}`;
  };

  // Aggregate stats
  const totalWeeklyRev = weeklyData.reduce((sum, d) => sum + d.revenue, 0);
  const totalWeeklyCogs = weeklyData.reduce((sum, d) => sum + d.cogs, 0);
  const totalWeeklyDisc = weeklyData.reduce((sum, d) => sum + d.discount, 0);
  const overallMargin = totalWeeklyRev > 0 ? Math.round(((totalWeeklyRev - totalWeeklyCogs) / totalWeeklyRev) * 100) : 0;

  return (
    <Card className="col-span-2 shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 gap-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <CardTitle className="text-sm font-bold flex items-center space-x-2 text-slate-900 dark:text-slate-100">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span>Performa Penjualan & Analisis Margin</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 dark:bg-primary/20 dark:text-primary-light dark:border-primary/30">
              Live Interactive
            </span>
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {viewMode === "weekly" && "Tren 7 Hari Terakhir (Revenue Bruto vs COGS & Diskon Promo)"}
            {viewMode === "hourly" && "Analisis Jam Sibuk Penjualan (Hourly Order Traffic & Velocity)"}
            {viewMode === "promo_impact" && "Efektivitas Campaign Promo terhadap Omzet & Diskon"}
          </CardDescription>
        </div>

        {/* View Mode Toggle Buttons */}
        <div className="flex items-center space-x-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold">
          <button
            onClick={() => setViewMode("weekly")}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 ${
              viewMode === "weekly"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <TrendingUp className="w-3 h-3 text-primary" />
            <span>7 Hari</span>
          </button>
          <button
            onClick={() => setViewMode("hourly")}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 ${
              viewMode === "hourly"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Clock className="w-3 h-3 text-sky-600 dark:text-sky-400" />
            <span>Jam Sibuk</span>
          </button>
          <button
            onClick={() => setViewMode("promo_impact")}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 ${
              viewMode === "promo_impact"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Tag className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Promo Impact</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Dynamic Chart Container */}
        <div className="h-64 w-full">
          {viewMode === "weekly" && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: axisColor }} axisLine={{ stroke: isDark ? "#334155" : "#e2e8f0" }} />
                <YAxis tick={{ fontSize: 11, fill: axisColor }} tickFormatter={formatYAxisValue} axisLine={false} />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    const num = Number(value) || 0;
                    return [formatCurrencyIDR(num), name];
                  }}
                  contentStyle={{ backgroundColor: tooltipBg, borderRadius: "10px", border: `1px solid ${tooltipBorder}`, color: isDark ? "#f8fafc" : "#0f172a", fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar dataKey="revenue" name="Omzet Bruto" fill={primarySage} radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="cogs" name="Beban HPP (COGS)" fill="#94A3B8" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Line type="monotone" dataKey="discount" name="Potongan Promo" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3, fill: "#10B981" }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {viewMode === "hourly" && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={hourlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primarySage} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={primarySage} stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: axisColor }} axisLine={{ stroke: isDark ? "#334155" : "#e2e8f0" }} />
                <YAxis tick={{ fontSize: 11, fill: axisColor }} tickFormatter={formatYAxisValue} axisLine={false} />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    const num = Number(value) || 0;
                    if (name === "Omzet per Jam") return [formatCurrencyIDR(num), name];
                    return [value, name];
                  }}
                  contentStyle={{ backgroundColor: tooltipBg, borderRadius: "10px", border: `1px solid ${tooltipBorder}`, color: isDark ? "#f8fafc" : "#0f172a", fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Area type="monotone" dataKey="revenue" name="Omzet per Jam" stroke={primarySage} fillOpacity={1} fill="url(#colorRev)" />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {viewMode === "promo_impact" && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={promoData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisColor }} axisLine={{ stroke: isDark ? "#334155" : "#e2e8f0" }} />
                <YAxis tick={{ fontSize: 11, fill: axisColor }} tickFormatter={formatYAxisValue} axisLine={false} />
                <Tooltip
                  formatter={(value: any, name: string) => [formatCurrencyIDR(Number(value) || 0), name]}
                  contentStyle={{ backgroundColor: tooltipBg, borderRadius: "10px", border: `1px solid ${tooltipBorder}`, color: isDark ? "#f8fafc" : "#0f172a", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar dataKey="revenue" name="Total Omzet" fill={primarySage} radius={[6, 6, 0, 0]} maxBarSize={60} />
                <Bar dataKey="discount" name="Total Diskon Promo" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={60} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Dynamic Metric Highlights at the Bottom of Chart */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <span className="text-slate-400 dark:text-slate-400 block text-[10px] font-semibold uppercase">Total Revenue (7 Hari)</span>
            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{formatCurrencyIDR(totalWeeklyRev)}</span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <span className="text-slate-400 dark:text-slate-400 block text-[10px] font-semibold uppercase">Gross Margin</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{overallMargin}%</span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <span className="text-slate-400 dark:text-slate-400 block text-[10px] font-semibold uppercase">Total Diskon Promo</span>
            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{formatCurrencyIDR(totalWeeklyDisc)}</span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <span className="text-slate-400 dark:text-slate-400 block text-[10px] font-semibold uppercase">Status Sinkronisasi</span>
            <span className="font-bold text-primary dark:text-primary-light text-sm flex items-center space-x-1 mt-0.5">
              <Sparkles className="w-3 h-3 animate-spin" />
              <span>Context Sync</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
