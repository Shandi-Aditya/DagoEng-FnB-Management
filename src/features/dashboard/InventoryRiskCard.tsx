"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useInventory } from "@/contexts/InventoryContext";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function InventoryRiskCard() {
  const { filteredIngredients } = useInventory();

  const criticalItems = filteredIngredients.filter(
    (item) => item.status === "CRITICAL" || item.status === "LOW"
  );

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center space-x-2 text-slate-900">
            <AlertTriangle className="w-4 h-4 text-brand-orange" />
            <span>Deteksi Risiko Bahan & Stok</span>
          </CardTitle>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            Smart Inventory
          </span>
        </div>
        <CardDescription className="text-xs">
          Peringatan otomatis bahan baku mendekati batas minimum operasional
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-2.5">
        {criticalItems.length > 0 ? (
          criticalItems.map((item) => (
            <div
              key={item.id}
              className={`p-2.5 rounded-lg border text-xs ${
                item.status === "CRITICAL"
                  ? "bg-red-50/70 border-red-200 text-red-900"
                  : "bg-amber-50/60 border-amber-200 text-amber-900"
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span>{item.name}</span>
                <span className="text-[11px] underline font-semibold">
                  Sisa: {item.stockNumber} {item.unit}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 text-[11px] opacity-80">
                <span>Min: {item.min} {item.unit}</span>
                <span>Supplier: {item.supplier}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 text-center text-xs text-emerald-800 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Seluruh persediaan bahan baku berada pada tingkat aman ({filteredIngredients.length} item terdaftar).</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
