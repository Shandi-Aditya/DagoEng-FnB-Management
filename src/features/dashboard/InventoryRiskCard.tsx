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
    <Card className="shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center space-x-2 text-slate-900 dark:text-slate-100">
            <AlertTriangle className="w-4 h-4 text-primary" />
            <span>Deteksi Risiko Bahan & Stok</span>
          </CardTitle>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            Smart Inventory
          </span>
        </div>
        <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
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
                  ? "bg-red-50/70 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200"
                  : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
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
          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 text-center text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Seluruh persediaan bahan baku berada pada tingkat aman ({filteredIngredients.length} item terdaftar).</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
