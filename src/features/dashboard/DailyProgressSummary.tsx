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

  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const totalRevenue = isMounted ? filteredOrders.reduce((sum, o) => sum + o.total, 0) : 0;
  const totalOrdersCount = isMounted ? filteredOrders.length : 0;
  const completedOrdersCount = isMounted ? filteredOrders.filter((o) => o.status === "COMPLETED" || o.status === "SERVED").length : 0;
  const completionRate = totalOrdersCount > 0 ? ((completedOrdersCount / totalOrdersCount) * 100).toFixed(1) : "0";

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center space-x-2 text-slate-900">
            <Calendar className="w-4 h-4 text-brand-orange" />
            <span>Progress Operasional & Ringkasan Harian</span>
          </CardTitle>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded">
            Periode: {formattedRangeLabel}
          </span>
        </div>
        <CardDescription className="text-xs">
          Monitoring performa pemrosesan pesanan dan penyelesaian transaksi
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Progress Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-orange-50/50 border border-orange-100">
            <p className="text-[11px] font-semibold text-slate-500">Omzet Periode Ini</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{formatCurrencyIDR(totalRevenue)}</p>
            <span className="text-[10px] text-slate-500 font-medium inline-flex items-center mt-1">
              Live Realtime
            </span>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100">
            <p className="text-[11px] font-semibold text-slate-500">Tingkat Penyelesaian</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">
              {completedOrdersCount} / {totalOrdersCount} <span className="text-xs font-normal">Order</span>
            </p>
            <span className="text-[10px] text-emerald-700 font-bold inline-flex items-center mt-1">
              <CheckCircle2 className="w-3 h-3 mr-0.5" /> {completionRate}% Selesai
            </span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100">
            <p className="text-[11px] font-semibold text-slate-500">Antrean Aktif</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">
              {totalOrdersCount - completedOrdersCount} <span className="text-xs font-normal">Pesanan</span>
            </p>
            <span className="text-[10px] text-slate-500 font-medium inline-flex items-center mt-1">
              Dapur & Bar
            </span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
            <p className="text-[11px] font-semibold text-slate-500">Status Sistem</p>
            <p className="text-lg font-bold text-emerald-700 mt-0.5">Siap Operasi</p>
            <span className="text-[10px] text-emerald-700 font-bold inline-flex items-center mt-1">
              Semua Modul Aktif
            </span>
          </div>
        </div>

        {totalOrdersCount === 0 && (
          <div className="p-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center text-xs text-slate-400">
            Belum ada data transaksi pada periode ini. Sistem siap menerima pesanan baru.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
