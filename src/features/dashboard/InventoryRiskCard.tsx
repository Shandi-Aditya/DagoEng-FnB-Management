import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AlertTriangle, Package } from "lucide-react";

export function InventoryRiskCard() {
  const stockRisks = [
    {
      name: "Susu Fresh Milk Greenfield (1L)",
      currentStock: "4 Kotak",
      dailyUsage: "12 Kotak/hari",
      depletionTime: "0.3 Hari (Kritis)",
      isCritical: true,
    },
    {
      name: "Biji Kopi House Blend (1kg)",
      currentStock: "3.5 kg",
      dailyUsage: "2.8 kg/hari",
      depletionTime: "1.2 Hari",
      isCritical: false,
    },
    {
      name: "Gula Aren Organik Cair (5L)",
      currentStock: "2 Botol",
      dailyUsage: "1.5 Botol/hari",
      depletionTime: "1.3 Hari",
      isCritical: false,
    },
  ];

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center space-x-2 text-slate-900">
          <AlertTriangle className="w-4 h-4 text-brand-yellow" />
          <span>Deteksi Risiko Bahan & Stok</span>
        </CardTitle>
        <CardDescription>
          Peringatan otomatis bahan baku mendekati batas minimum
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {stockRisks.map((item, idx) => (
          <div
            key={idx}
            className={`p-2.5 rounded-lg border text-xs ${
              item.isCritical
                ? "bg-red-50/70 border-red-200 text-red-900"
                : "bg-amber-50/60 border-amber-200 text-amber-900"
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span>{item.name}</span>
              <span className="text-[11px] underline font-semibold">
                Sisa: {item.currentStock}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1 text-[11px] opacity-80">
              <span>Rata-rata: {item.dailyUsage}</span>
              <span>Habis dalam: {item.depletionTime}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
