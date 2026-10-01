import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Store, ArrowUpRight } from "lucide-react";

export function OutletCompareCard() {
  const outlets = [
    {
      name: "Singaraja",
      code: "KS-SGR",
      revenue: "Rp 64.200.000",
      orders: "1.240",
      margin: "63.2%",
      status: "TOP REVENUE",
      statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      name: "Denpasar",
      code: "KS-DPS",
      revenue: "Rp 72.850.000",
      orders: "1.580",
      margin: "59.8%",
      status: "HIGHEST VOLUME",
      statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      name: "Ubud",
      code: "KS-UBD",
      revenue: "Rp 37.540.000",
      orders: "690",
      margin: "66.4%",
      status: "HIGHEST MARGIN",
      statusColor: "bg-amber-50 text-amber-700 border-amber-200",
    },
  ];

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center space-x-2 text-slate-900">
          <Store className="w-4 h-4 text-brand-cyan" />
          <span>Komparasi Antar Outlet (Bulan Ini)</span>
        </CardTitle>
        <CardDescription>
          Perbandingan performa penjualan 3 cabang Kopi Senja
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-slate-100">
        {outlets.map((o) => (
          <div key={o.code} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xs text-slate-900">{o.name}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${o.statusColor}`}>
                  {o.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{o.orders} transaksi | Margin: {o.margin}</p>
            </div>
            <div className="text-right">
              <span className="font-bold text-xs text-slate-900">{o.revenue}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
