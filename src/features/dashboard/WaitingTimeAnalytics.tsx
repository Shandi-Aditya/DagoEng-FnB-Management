"use client";

import React from "react";
import { useOrders } from "@/contexts/OrderContext";
import { analyzeOperationalBottlenecks, formatMinutesToHuman } from "@/lib/order-analytics";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Timer, AlertTriangle, Clock, Activity, Zap } from "lucide-react";

export function WaitingTimeAnalytics() {
  const { filteredOrders } = useOrders();
  const analysis = analyzeOperationalBottlenecks(filteredOrders, 10);

  const isOverallDelayed = analysis.avgTotalWaitingMinutes > analysis.targetServiceMinutes;

  return (
    <Card className="shadow-xs">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <div className="p-1 rounded-md bg-info/10 text-info">
              <Timer className="size-4" />
            </div>
            <span>Waktu tunggu pelanggan dan analisis hambatan</span>
          </CardTitle>
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
              isOverallDelayed
                ? "bg-destructive/10 text-destructive border-destructive/20"
                : "bg-success/10 text-success border-success/20"
            }`}
          >
            Target SLA {analysis.targetServiceMinutes} menit
          </span>
        </div>
        <CardDescription className="text-xs text-muted-foreground mt-1">
          Pemantauan durasi tunggu pesanan, performa per segmen, dan deteksi keterlambatan dapur
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Top 3 KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Average Waiting Time */}
          <div className="p-3 bg-muted/40 rounded-xl border">
            <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
              <span>Rata-rata waktu tunggu</span>
              <Clock className="size-3.5 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold text-foreground mt-1" suppressHydrationWarning>
              {formatMinutesToHuman(analysis.avgTotalWaitingMinutes)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Target {analysis.targetServiceMinutes}m ({isOverallDelayed ? "di atas target" : "sesuai target"})
            </p>
          </div>

          {/* Delayed Orders Count */}
          <div className="p-3 bg-destructive/5 rounded-xl border border-destructive/20">
            <div className="flex items-center justify-between text-destructive text-[11px] font-medium">
              <span>Pesanan terlambat (&gt;10m)</span>
              <AlertTriangle className="size-3.5 text-destructive" />
            </div>
            <p className="text-xl font-semibold text-destructive mt-1">
              {analysis.delayedOrdersCount} <span className="text-xs font-normal">({analysis.delayedPercentage}%)</span>
            </p>
            <p className="text-[10px] text-destructive/80 mt-0.5">
              Dari total {analysis.totalOrders} pesanan
            </p>
          </div>

          {/* Average Cooking Time */}
          <div className="p-3 bg-muted/40 rounded-xl border">
            <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
              <span>Rata-rata waktu masak</span>
              <Activity className="size-3.5 text-primary" />
            </div>
            <p className="text-xl font-semibold text-foreground mt-1" suppressHydrationWarning>
              {formatMinutesToHuman(analysis.avgCookingMinutes)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Durasi dapur memasak
            </p>
          </div>
        </div>

        {/* Breakdown of Segments: Kitchen Queue vs Cooking vs Serving */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-foreground">
            <span>Rincian durasi per tahapan operasional</span>
            <span className="text-[11px] text-muted-foreground font-normal font-mono" suppressHydrationWarning>
              Total {formatMinutesToHuman(analysis.avgTotalWaitingMinutes)}
            </span>
          </div>

          {/* Visual Progress Multi-bar */}
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
            <div
              className="bg-info h-full transition-all"
              style={{
                width: `${Math.max(5, (analysis.avgKitchenQueueMinutes / (analysis.avgTotalWaitingMinutes || 1)) * 100)}%`,
              }}
              title="Antrean Dapur"
            />
            <div
              className="bg-warning h-full transition-all"
              style={{
                width: `${Math.max(5, (analysis.avgCookingMinutes / (analysis.avgTotalWaitingMinutes || 1)) * 100)}%`,
              }}
              title="Waktu Masak"
            />
            <div
              className="bg-success h-full transition-all"
              style={{
                width: `${Math.max(5, (analysis.avgServingMinutes / (analysis.avgTotalWaitingMinutes || 1)) * 100)}%`,
              }}
              title="Waktu Saji"
            />
          </div>

          {/* Segment Details */}
          <div className="grid grid-cols-3 gap-2 text-xs pt-1">
            <div className="p-2 rounded-lg bg-info/10 border border-info/20">
              <span className="text-[10px] font-medium text-info uppercase flex items-center gap-1">
                <span className="size-2 rounded-full bg-info inline-block" />
                <span>1. Antrean dapur</span>
              </span>
              <p className="text-xs font-semibold text-foreground mt-0.5" suppressHydrationWarning>
                {formatMinutesToHuman(analysis.avgKitchenQueueMinutes)}
              </p>
              <p className="text-[10px] text-muted-foreground">Order ke terima dapur</p>
            </div>

            <div className="p-2 rounded-lg bg-warning/10 border border-warning/20">
              <span className="text-[10px] font-medium text-warning uppercase flex items-center gap-1">
                <span className="size-2 rounded-full bg-warning inline-block" />
                <span>2. Waktu masak</span>
              </span>
              <p className="text-xs font-semibold text-foreground mt-0.5" suppressHydrationWarning>
                {formatMinutesToHuman(analysis.avgCookingMinutes)}
              </p>
              <p className="text-[10px] text-muted-foreground">Masak ke makanan siap</p>
            </div>

            <div className="p-2 rounded-lg bg-success/10 border border-success/20">
              <span className="text-[10px] font-medium text-success uppercase flex items-center gap-1">
                <span className="size-2 rounded-full bg-success inline-block" />
                <span>3. Waktu saji</span>
              </span>
              <p className="text-xs font-semibold text-foreground mt-0.5" suppressHydrationWarning>
                {formatMinutesToHuman(analysis.avgServingMinutes)}
              </p>
              <p className="text-[10px] text-muted-foreground">Siap ke diantar waiter</p>
            </div>
          </div>
        </div>

        {/* Bottleneck Diagnosis Statement */}
        <div className="p-3 bg-warning/10 border border-warning/20 rounded-xl flex items-start gap-2 text-xs">
          <Zap className="size-4 text-warning shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-foreground text-[10px]">
              Diagnosa hambatan operasional
            </span>
            <p className="text-muted-foreground font-medium mt-0.5 leading-relaxed">
              {analysis.diagnosisStatement}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
