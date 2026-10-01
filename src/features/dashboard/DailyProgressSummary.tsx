"use client";

import React from "react";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { useOrders } from "@/contexts/OrderContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { formatCurrencyIDR } from "@/lib/utils";
import { TrendingUp, TrendingDown, Clock, CheckCircle2, AlertTriangle, Calendar, Flame } from "lucide-react";

export function DailyProgressSummary() {
  const { formattedRangeLabel, previousPeriodLabel } = useDateFilter();
  const { filteredOrders } = useOrders();

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total, 0) || 18450000;
  const totalOrdersCount = filteredOrders.length || 186;
  const completedOrdersCount = filteredOrders.filter((o) => o.status === "COMPLETED" || o.status === "SERVED").length || 179;

  // Comparison metrics vs previous period
  const comparisons = [
    { label: "Pertumbuhan Revenue", change: +12.4, isUp: true, desc: `vs ${previousPeriodLabel}` },
    { label: "Volume Pesanan Selesai", change: +8.2, isUp: true, desc: `vs ${previousPeriodLabel}` },
    { label: "Rata-rata Waktu Tunggu", change: -6.5, isUp: true, desc: "lebih cepat 1m 15s" },
    { label: "Pesanan Terlambat (Delay)", change: -14.8, isUp: true, desc: "penurunan insiden delay" },
  ];

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center space-x-2 text-slate-900">
            <Calendar className="w-4 h-4 text-brand-orange" />
            <span>Progress Bisnis & Komparasi Historis ({formattedRangeLabel})</span>
          </CardTitle>
          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded">
            Komparasi: {previousPeriodLabel}
          </span>
        </div>
        <CardDescription className="text-xs">
          Evaluasi performa harian terhadap target operasional dan periode pembanding
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Progress Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-orange-50/50 border border-orange-100">
            <p className="text-[11px] font-semibold text-slate-500">Omzet Periode Ini</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{formatCurrencyIDR(totalRevenue)}</p>
            <span className="text-[10px] text-emerald-700 font-bold inline-flex items-center mt-1">
              <TrendingUp className="w-3 h-3 mr-0.5" /> +12.4%
            </span>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100">
            <p className="text-[11px] font-semibold text-slate-500">Tingkat Penyelesaian</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">
              {completedOrdersCount} / {totalOrdersCount} <span className="text-xs font-normal">Order</span>
            </p>
            <span className="text-[10px] text-emerald-700 font-bold inline-flex items-center mt-1">
              <CheckCircle2 className="w-3 h-3 mr-0.5" /> 96.2% Selesai
            </span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100">
            <p className="text-[11px] font-semibold text-slate-500">Jam Paling Ramai (Peak)</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">18:00 - 20:00</p>
            <span className="text-[10px] text-amber-800 font-bold inline-flex items-center mt-1">
              <Flame className="w-3 h-3 mr-0.5 text-brand-orange" /> 42% Total Order
            </span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
            <p className="text-[11px] font-semibold text-slate-500">Efisiensi Wait Time</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">12m 46s</p>
            <span className="text-[10px] text-emerald-700 font-bold inline-flex items-center mt-1">
              <TrendingDown className="w-3 h-3 mr-0.5" /> -6.5% vs Lalu
            </span>
          </div>
        </div>

        {/* Percentage Comparison Table */}
        <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/60">
          <div className="text-[11px] font-bold text-slate-700 mb-2">
            Perubahan Indikator Bisnis vs Periode Sebelumnya:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {comparisons.map((c, idx) => (
              <div key={idx} className="p-2 rounded-lg bg-white border border-slate-200/80 shadow-xs">
                <p className="text-[11px] text-slate-500">{c.label}</p>
                <div className="flex items-center space-x-1 mt-1 font-bold text-sm text-slate-900">
                  <span className={c.change >= 0 ? "text-emerald-700" : "text-emerald-700"}>
                    {c.change >= 0 ? `+${c.change}%` : `${c.change}%`}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
