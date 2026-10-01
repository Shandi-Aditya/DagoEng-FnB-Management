"use client";

import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useOrders } from "@/contexts/OrderContext";
import { useAuth } from "@/contexts/AuthContext";
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
  const [viewMode, setViewMode] = useState<ChartViewMode>("weekly");

  // Calculate dynamic weekly data based on filteredOrders and baseline trend
  const weeklyData = useMemo(() => {
    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const now = new Date();
    
    // Initialize 7 days ending today
    const days = [];
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

    // Baselines for realistic demo curves
    const baselines: Record<string, { rev: number; cogs: number; disc: number }> = {
      Sen: { rev: 18500000, cogs: 7200000, disc: 950000 },
      Sel: { rev: 16200000, cogs: 6800000, disc: 800000 },
      Rab: { rev: 21000000, cogs: 8100000, disc: 1200000 },
      Kam: { rev: 23400000, cogs: 8900000, disc: 1400000 },
      Jum: { rev: 29800000, cogs: 11200000, disc: 2100000 },
      Sab: { rev: 34500000, cogs: 13100000, disc: 2800000 },
      Min: { rev: 31200000, cogs: 12000000, disc: 2500000 },
    };

    days.forEach((dayObj) => {
      const base = baselines[dayObj.day] || { rev: 15000000, cogs: 6000000, disc: 500000 };
      dayObj.revenue = base.rev;
      dayObj.cogs = base.cogs;
      dayObj.discount = base.disc;
      dayObj.ordersCount = Math.round(base.rev / 55000);
    });

    // Add actual context filteredOrders into today's bucket
    const todayObj = days[days.length - 1];
    if (todayObj && filteredOrders.length > 0) {
      const liveRev = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const liveDisc = filteredOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
      const liveCogs = Math.round(liveRev * 0.38); // estimated COGS 38%
      
      todayObj.revenue = liveRev > 0 ? liveRev : todayObj.revenue;
      todayObj.discount = liveDisc > 0 ? liveDisc : todayObj.discount;
      todayObj.cogs = liveRev > 0 ? liveCogs : todayObj.cogs;
      todayObj.ordersCount = filteredOrders.length > 0 ? filteredOrders.length : todayObj.ordersCount;
    }

    return days.map((d) => ({
      ...d,
      netProfit: d.revenue - d.cogs,
      marginPercent: d.revenue > 0 ? Math.round(((d.revenue - d.cogs) / d.revenue) * 100) : 0,
      revJuta: +(d.revenue / 1000000).toFixed(1),
      cogsJuta: +(d.cogs / 1000000).toFixed(1),
      discJuta: +(d.discount / 1000000).toFixed(1),
    }));
  }, [filteredOrders]);

  // Hourly Peak data for demo (08:00 - 22:00)
  const hourlyData = useMemo(() => {
    const hours = [
      { hour: "08:00", orders: 12, rev: 640000, traffic: "Rendah" },
      { hour: "10:00", orders: 28, rev: 1520000, traffic: "Sedang" },
      { hour: "12:00", orders: 54, rev: 3240000, traffic: "Peak Siang" },
      { hour: "14:00", orders: 36, rev: 1980000, traffic: "Sedang" },
      { hour: "16:00", orders: 42, rev: 2350000, traffic: "Sedang" },
      { hour: "18:00", orders: 78, rev: 4680000, traffic: "Peak Malam" },
      { hour: "20:00", orders: 65, rev: 3900000, traffic: "Peak Malam" },
      { hour: "22:00", orders: 22, rev: 1100000, traffic: "Closing" },
    ];
    return hours.map((h) => ({
      ...h,
      revJuta: +(h.rev / 1000000).toFixed(2),
    }));
  }, []);

  // Promo vs Regular Breakdown
  const promoData = useMemo(() => {
    const ordersWithPromo = filteredOrders.filter((o) => (o.discount && o.discount > 0) || o.promoId);
    const promoRev = ordersWithPromo.reduce((sum, o) => sum + o.total, 0) || 5400000;
    const promoDisc = ordersWithPromo.reduce((sum, o) => sum + (o.discount || 0), 0) || 680000;
    
    const regularOrders = filteredOrders.filter((o) => !o.discount && !o.promoId);
    const regularRev = regularOrders.reduce((sum, o) => sum + o.total, 0) || 12800000;

    return [
      { name: "Transaksi Promo (Diskon)", revenue: promoRev, discount: promoDisc, orders: ordersWithPromo.length || 38 },
      { name: "Transaksi Reguler", revenue: regularRev, discount: 0, orders: regularOrders.length || 94 },
    ];
  }, [filteredOrders]);

  // Aggregate stats
  const totalWeeklyRev = weeklyData.reduce((sum, d) => sum + d.revenue, 0);
  const totalWeeklyCogs = weeklyData.reduce((sum, d) => sum + d.cogs, 0);
  const totalWeeklyDisc = weeklyData.reduce((sum, d) => sum + d.discount, 0);
  const overallMargin = Math.round(((totalWeeklyRev - totalWeeklyCogs) / totalWeeklyRev) * 100);

  return (
    <Card className="col-span-2 shadow-sm border border-slate-200">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 gap-3 border-b border-slate-100">
        <div>
          <CardTitle className="text-sm font-bold flex items-center space-x-2 text-slate-900">
            <BarChart3 className="w-4 h-4 text-brand-orange" />
            <span>Performa Penjualan & Analisis Margin</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-brand-orange border border-orange-200">
              Live Interactive
            </span>
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 mt-0.5">
            {viewMode === "weekly" && "Tren 7 Hari Terakhir (Revenue Bruto vs COGS & Diskon Promo)"}
            {viewMode === "hourly" && "Analisis Jam Sibuk Penjualan (Hourly Order Traffic & Velocity)"}
            {viewMode === "promo_impact" && "Efektivitas Campaign Promo terhadap Omzet & Diskon"}
          </CardDescription>
        </div>

        {/* View Mode Toggle Buttons */}
        <div className="flex items-center space-x-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setViewMode("weekly")}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 ${
              viewMode === "weekly"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="w-3 h-3 text-brand-orange" />
            <span>7 Hari</span>
          </button>
          <button
            onClick={() => setViewMode("hourly")}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 ${
              viewMode === "hourly"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock className="w-3 h-3 text-blue-600" />
            <span>Jam Sibuk</span>
          </button>
          <button
            onClick={() => setViewMode("promo_impact")}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 ${
              viewMode === "promo_impact"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Tag className="w-3 h-3 text-emerald-600" />
            <span>Promo Impact</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Dynamic Chart Container */}
        <div className="h-64 w-full">
          {viewMode === "weekly" && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(val) => `Rp${val}jt`} axisLine={false} />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    const num = Number(value) || 0;
                    if (name === "Revenue (Rp)") return [formatCurrencyIDR(num * 1000000), "Omzet Bruto"];
                    if (name === "COGS HPP (Rp)") return [formatCurrencyIDR(num * 1000000), "Beban COGS"];
                    if (name === "Promo Diskon (Rp)") return [formatCurrencyIDR(num * 1000000), "Potongan Promo"];
                    return [value, name];
                  }}
                  contentStyle={{ backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar dataKey="revJuta" name="Revenue (Rp)" fill="#F97316" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="cogsJuta" name="COGS HPP (Rp)" fill="#94A3B8" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Line type="monotone" dataKey="discJuta" name="Promo Diskon (Rp)" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3, fill: "#10B981" }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {viewMode === "hourly" && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={hourlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(val) => `Rp${val}jt`} axisLine={false} />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    const num = Number(value) || 0;
                    if (name === "Omzet per Jam") return [formatCurrencyIDR(num * 1000000), "Omzet"];
                    return [value, name];
                  }}
                  contentStyle={{ backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Area type="monotone" dataKey="revJuta" name="Omzet per Jam" stroke="#2563EB" fillOpacity={1} fill="url(#colorRev)" />
                <Line type="monotone" dataKey="orders" name="Volume Pesanan" stroke="#F97316" strokeWidth={2} yAxisId={0} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {viewMode === "promo_impact" && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={promoData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(val) => `Rp${+(val / 1000000).toFixed(0)}jt`} axisLine={false} />
                <Tooltip
                  formatter={(value: any) => [formatCurrencyIDR(Number(value) || 0), "Total"]}
                  contentStyle={{ backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar dataKey="revenue" name="Total Omzet (Rp)" fill="#F97316" radius={[6, 6, 0, 0]} maxBarSize={60} />
                <Bar dataKey="discount" name="Total Diskon Promo (Rp)" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={60} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Dynamic Metric Highlights at the Bottom of Chart */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">Total Revenue (7 Hari)</span>
            <span className="font-bold text-slate-800 text-sm">{formatCurrencyIDR(totalWeeklyRev)}</span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">Gross Margin</span>
            <span className="font-bold text-emerald-600 text-sm">{overallMargin}%</span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">Total Diskon Promo</span>
            <span className="font-bold text-brand-orange text-sm">{formatCurrencyIDR(totalWeeklyDisc)}</span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">Status Sinkronisasi</span>
            <span className="font-bold text-brand-cyan text-sm flex items-center space-x-1 mt-0.5">
              <Sparkles className="w-3 h-3 animate-spin" />
              <span>Context Sync</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
