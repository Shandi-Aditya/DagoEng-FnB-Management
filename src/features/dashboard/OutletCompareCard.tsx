"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useOrders } from "@/contexts/OrderContext";
import { formatCurrencyIDR } from "@/lib/utils";
import { Store } from "lucide-react";

export function OutletCompareCard() {
  const { orders } = useOrders();

  const outletBases = [
    { id: "outlet-sgr", name: "Singaraja", code: "KS-SGR" },
    { id: "outlet-dps", name: "Denpasar", code: "KS-DPS" },
    { id: "outlet-ubd", name: "Ubud", code: "KS-UBD" },
  ];

  const outlets = outletBases.map((o) => {
    const oOrders = orders.filter((ord) => ord.outletId === o.id);
    const rev = oOrders.reduce((sum, ord) => sum + ord.total, 0);
    const count = oOrders.length;
    return {
      ...o,
      revenue: formatCurrencyIDR(rev),
      orders: `${count} Transaksi`,
      status: count > 0 ? "AKTIF" : "SIAP",
      statusColor:
        count > 0
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60"
          : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    };
  });

  return (
    <Card className="h-full shadow-sm flex flex-col justify-between border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center space-x-2 text-slate-900 dark:text-slate-100">
            <Store className="w-4 h-4 text-primary" />
            <span>Komparasi Antar Outlet</span>
          </CardTitle>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            3 Cabang
          </span>
        </div>
        <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
          Monitoring performa seluruh cabang outlet F&B
        </CardDescription>
      </CardHeader>

      <CardContent className="divide-y divide-slate-100 dark:divide-slate-800 pt-3 flex-1 flex flex-col justify-around">
        {outlets.map((o) => (
          <div key={o.code} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{o.name}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${o.statusColor}`}>
                  {o.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{o.orders}</p>
            </div>
            <div className="text-right">
              <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{o.revenue}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
