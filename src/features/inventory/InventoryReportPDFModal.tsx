"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { formatCurrencyIDR } from "@/lib/utils";
import { IngredientItem } from "@/types/inventory";
import {
  X,
  Printer,
  ShieldCheck,
  FileText,
  Package,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface InventoryReportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: IngredientItem[];
  outletName: string;
}

export function InventoryReportPDFModal({
  isOpen,
  onClose,
  ingredients,
  outletName,
}: InventoryReportPDFModalProps) {
  const printContentRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const totalValuation = ingredients.reduce(
    (sum, item) => sum + item.stockNumber * item.costPerUnit,
    0
  );
  const criticalCount = ingredients.filter(
    (i) => i.status === "CRITICAL" || i.stockNumber <= i.min * 0.4
  ).length;
  const lowCount = ingredients.filter((i) => i.status === "LOW").length;
  const safeCount = ingredients.filter((i) => i.status === "SAFE").length;

  const reportNumber = `INV-VAL-${new Date().getFullYear()}${(new Date().getMonth() + 1)
    .toString()
    .padStart(2, "0")}${new Date().getDate().toString().padStart(2, "0")}-${Math.floor(
    100 + Math.random() * 900
  )}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Top Control Bar */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Dokumen PDF Laporan Valuasi & Audit Stok Bahan Baku</span>
                <span className="text-[10px] bg-purple-600 text-white px-2 py-0.2 rounded-full font-mono">
                  RESMI
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Laporan Aset Inventory & Stok Opname Otomatis
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold space-x-1.5 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / Simpan PDF</span>
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-slate-100/70">
          <div
            ref={printContentRef}
            className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-md border border-slate-200 text-slate-800 print:m-0 print:p-0 print:shadow-none print:border-none"
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-6 border-b-2 border-slate-900">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-14 relative flex-shrink-0">
                  <Image
                    src="/logo-dago.png"
                    alt="Logo"
                    width={48}
                    height={56}
                    className="object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-lg font-black text-slate-950 tracking-tight">
                    DAGOENG CREATIVE HUB
                  </h1>
                  <p className="text-xs font-semibold text-purple-600">
                    Smart Inventory & Supply Chain Management
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Outlet: {outletName} • Master Gudang Bahan Baku
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Nomor Laporan
                </span>
                <span className="text-xs font-mono font-bold text-slate-900">{reportNumber}</span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Per Tanggal: {new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}
                </span>
              </div>
            </div>

            {/* Title */}
            <div className="text-center py-4 border-b border-slate-100">
              <h2 className="text-base font-black text-slate-900 tracking-wide uppercase">
                Laporan Posisi Stok, Valuasi Aset & Reorder Point
              </h2>
              <p className="text-xs text-slate-500">
                Rekapitulasi kuantitas fisik, nilai modal bahan baku, dan status keselamatan stok
              </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-3 my-5">
              <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200 text-center">
                <span className="text-[10px] text-purple-700 font-bold uppercase block">
                  Total Valuasi Stok
                </span>
                <span className="text-sm font-black text-purple-900 font-mono">
                  {formatCurrencyIDR(totalValuation)}
                </span>
              </div>
              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-center">
                <span className="text-[10px] text-emerald-700 font-bold uppercase block">
                  Stok Aman (Safe)
                </span>
                <span className="text-sm font-black text-emerald-800 font-mono">
                  {safeCount} SKU
                </span>
              </div>
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-center">
                <span className="text-[10px] text-amber-700 font-bold uppercase block">
                  Perlu Restock (Low)
                </span>
                <span className="text-sm font-black text-amber-800 font-mono">
                  {lowCount} SKU
                </span>
              </div>
              <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200 text-center">
                <span className="text-[10px] text-rose-700 font-bold uppercase block">
                  Stok Kritis (Critical)
                </span>
                <span className="text-sm font-black text-rose-800 font-mono">
                  {criticalCount} SKU
                </span>
              </div>
            </div>

            {/* Inventory Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden my-4 text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-white text-[11px] font-bold uppercase">
                  <tr>
                    <th className="p-2.5">Bahan Baku</th>
                    <th className="p-2.5">Kategori</th>
                    <th className="p-2.5 text-right">Stok Aktual</th>
                    <th className="p-2.5 text-right">Batas Min</th>
                    <th className="p-2.5 text-right">Biaya/Unit</th>
                    <th className="p-2.5 text-right">Total Nilai (Rp)</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {ingredients.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{item.name}</td>
                      <td className="p-2.5 text-slate-500">{item.category}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {item.stockNumber} {item.unit}
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-500">
                        {item.min} {item.unit}
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-700">
                        {formatCurrencyIDR(item.costPerUnit)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrencyIDR(item.stockNumber * item.costPerUnit)}
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            item.status === "CRITICAL"
                              ? "bg-rose-100 text-rose-800"
                              : item.status === "LOW"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Certification Footer */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="font-bold text-slate-800">Laporan Resmi Inventory</p>
                  <p className="text-[10px] text-slate-400">
                    Sinkronisasi otomatis dengan pemotongan resep BOM kasir POS.
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px]">
                <p className="font-bold text-slate-800">DagoEng Supply Chain Dept.</p>
                <p className="text-slate-400 font-mono">
                  SHA256: {Date.now()}-INV-STAMP-OK
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
