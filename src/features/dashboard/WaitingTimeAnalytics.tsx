"use client";

import React from "react";
import { useOrders } from "@/contexts/OrderContext";
import { analyzeOperationalBottlenecks, formatMinutesToHuman } from "@/lib/order-analytics";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Timer, AlertTriangle, CheckCircle2, Clock, Activity, Zap } from "lucide-react";

export function WaitingTimeAnalytics() {
  const { filteredOrders } = useOrders();
  const analysis = analyzeOperationalBottlenecks(filteredOrders, 10);

  const isOverallDelayed = analysis.avgTotalWaitingMinutes > analysis.targetServiceMinutes;

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center space-x-2 text-slate-900">
            <div className="p-1 rounded-md bg-brand-cyan/10 text-brand-cyan">
              <Timer className="w-4 h-4" />
            </div>
            <span>Customer Waiting Time & Bottleneck Analysis</span>
          </CardTitle>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isOverallDelayed
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            Target SLA: {analysis.targetServiceMinutes} Menit
          </span>
        </div>
        <CardDescription className="text-xs">
          Pemantauan waktu tunggu pelanggan, durasi per segmen, dan deteksi keterlambatan dapur
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Top 3 KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Average Waiting Time */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
              <span>Avg Waiting Time</span>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-xl font-bold text-slate-900 mt-1" suppressHydrationWarning>
              {formatMinutesToHuman(analysis.avgTotalWaitingMinutes)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Target {analysis.targetServiceMinutes}m ({isOverallDelayed ? "di atas target" : "sesuai target"})
            </p>
          </div>

          {/* Delayed Orders Count */}
          <div className="p-3 bg-red-50/50 rounded-xl border border-red-100">
            <div className="flex items-center justify-between text-red-600 text-[11px] font-semibold">
              <span>Order Terlambat (&gt;10m)</span>
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            </div>
            <p className="text-xl font-bold text-red-700 mt-1">
              {analysis.delayedOrdersCount} <span className="text-xs font-normal">({analysis.delayedPercentage}%)</span>
            </p>
            <p className="text-[10px] text-red-500 mt-0.5">
              Dari total {analysis.totalOrders} pesanan
            </p>
          </div>

          {/* Average Cooking Time */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
              <span>Avg Cooking Time</span>
              <Activity className="w-3.5 h-3.5 text-brand-orange" />
            </div>
            <p className="text-xl font-bold text-slate-900 mt-1" suppressHydrationWarning>
              {formatMinutesToHuman(analysis.avgCookingMinutes)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Durasi dapur memasak
            </p>
          </div>
        </div>

        {/* Breakdown of Segments: Kitchen Queue vs Cooking vs Serving */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Breakdown Durasi Per Segmen Operasional:</span>
            <span className="text-[11px] text-slate-400 font-normal" suppressHydrationWarning>
              Total: {formatMinutesToHuman(analysis.avgTotalWaitingMinutes)}
            </span>
          </div>

          {/* Visual Progress Multi-bar */}
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div
              className="bg-brand-cyan h-full transition-all"
              style={{
                width: `${Math.max(5, (analysis.avgKitchenQueueMinutes / (analysis.avgTotalWaitingMinutes || 1)) * 100)}%`,
              }}
              title="Kitchen Queue"
            />
            <div
              className="bg-brand-orange h-full transition-all"
              style={{
                width: `${Math.max(5, (analysis.avgCookingMinutes / (analysis.avgTotalWaitingMinutes || 1)) * 100)}%`,
              }}
              title="Cooking Time"
            />
            <div
              className="bg-brand-green h-full transition-all"
              style={{
                width: `${Math.max(5, (analysis.avgServingMinutes / (analysis.avgTotalWaitingMinutes || 1)) * 100)}%`,
              }}
              title="Serving Time"
            />
          </div>

          {/* Segment Details */}
          <div className="grid grid-cols-3 gap-2 text-xs pt-1">
            <div className="p-2 rounded-lg bg-cyan-50/60 border border-cyan-100">
              <span className="text-[10px] font-bold text-cyan-800 uppercase flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-brand-cyan inline-block" />
                <span>1. Kitchen Queue</span>
              </span>
              <p className="text-xs font-bold text-cyan-950 mt-0.5" suppressHydrationWarning>
                {formatMinutesToHuman(analysis.avgKitchenQueueMinutes)}
              </p>
              <p className="text-[10px] text-cyan-700">Order → Dapur Terima</p>
            </div>

            <div className="p-2 rounded-lg bg-orange-50/60 border border-orange-100">
              <span className="text-[10px] font-bold text-orange-800 uppercase flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-brand-orange inline-block" />
                <span>2. Cooking Time</span>
              </span>
              <p className="text-xs font-bold text-orange-950 mt-0.5" suppressHydrationWarning>
                {formatMinutesToHuman(analysis.avgCookingMinutes)}
              </p>
              <p className="text-[10px] text-orange-700">Masak → Makanan Siap</p>
            </div>

            <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
              <span className="text-[10px] font-bold text-emerald-800 uppercase flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-brand-green inline-block" />
                <span>3. Serving Time</span>
              </span>
              <p className="text-xs font-bold text-emerald-950 mt-0.5" suppressHydrationWarning>
                {formatMinutesToHuman(analysis.avgServingMinutes)}
              </p>
              <p className="text-[10px] text-emerald-700">Siap → Diantar Waiter</p>
            </div>
          </div>
        </div>

        {/* Bottleneck Diagnosis Statement */}
        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start space-x-2 text-xs">
          <Zap className="w-4 h-4 text-brand-yellow flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-900 uppercase text-[10px] tracking-wide">
              Operational Bottleneck Diagnosis:
            </span>
            <p className="text-amber-800 font-semibold mt-0.5 leading-relaxed">
              {analysis.diagnosisStatement}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
