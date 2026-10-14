"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { formatCurrencyIDR } from "@/lib/utils";
import { StockOpnameRecord } from "@/types/inventory";
import {
  X,
  Printer,
  ShieldCheck,
  ClipboardCheck,
  Scale,
  TrendingDown,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface StockOpnameReportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  opnames: StockOpnameRecord[];
  outletName: string;
}

export function StockOpnameReportPDFModal({
  isOpen,
  onClose,
  opnames,
  outletName,
}: StockOpnameReportPDFModalProps) {
  const printContentRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const surplusCount = opnames.filter((o) => o.varianceType === "SURPLUS").length;
  const deficitCount = opnames.filter((o) => o.varianceType === "DEFICIT").length;
  const matchCount = opnames.filter((o) => o.varianceType === "MATCH").length;

  const totalVarianceValue = opnames.reduce((sum, o) => {
    return sum + (o.varianceValue ? Math.abs(o.varianceValue) : 0);
  }, 0);

  const reportDocNo = `BA-OPNAME-${new Date().getFullYear()}${(new Date().getMonth() + 1)
    .toString()
    .padStart(2, "0")}${new Date().getDate().toString().padStart(2, "0")}-${Math.floor(
    100 + Math.random() * 900
  )}`;

  const handlePrint = () => {
    window.print();
  };

  const getReasonBadgeLabel = (reason: string) => {
    switch (reason) {
      case "RECORDING_ERROR":
        return "Selisih Hitung / Catat";
      case "WASTE":
        return "Waste Operasional";
      case "LOSS":
        return "Kehilangan (Loss)";
      case "DAMAGED":
        return "Kerusakan Fisik";
      case "EXPIRATION":
        return "Kedaluwarsa";
      case "SAMPLE_PROMO":
        return "Sample Promo";
      default:
        return "Lainnya";
    }
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-stock-opname-report,
          #printable-stock-opname-report * {
            visibility: visible !important;
          }
          #printable-stock-opname-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 24px !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
          {/* Header Action Bar */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center space-x-2">
              <ClipboardCheck className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Pratinjau Berita Acara Resmi Stock Opname
                </h3>
                <p className="text-[10px] text-slate-500">
                  Dokumen fisik siap cetak & ekspor PDF resmi operasional gudang.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                onClick={handlePrint}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                <span>Cetak / Simpan PDF</span>
              </Button>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Report Sheet */}
          <div className="p-8 overflow-y-auto flex-1 bg-slate-100/50 flex justify-center">
            <div
              id="printable-stock-opname-report"
              ref={printContentRef}
              className="w-full max-w-3xl bg-white p-8 rounded-xl shadow-xs border border-slate-200 font-sans text-slate-900 text-xs space-y-6"
            >
              {/* Official Letterhead */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 relative flex-shrink-0">
                    <Image
                      src="/logo-dago.png"
                      alt="Dago Creative Hub"
                      width={48}
                      height={48}
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <h1 className="font-black text-lg tracking-tight text-slate-900">
                      DAGO CREATIVE HUB
                    </h1>
                    <p className="text-[11px] text-slate-600 font-medium">
                      Divisi Logistik, Pergudangan & Manajemen Inventori
                    </p>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Jl. Veteran No. 18, Singaraja, Bali 81118 &bull; Telp: (0362) 23456
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-900 border border-indigo-200">
                    BERITA ACARA AUDIT FISIK
                  </span>
                  <p className="font-mono text-[11px] font-bold text-slate-700 mt-1">
                    No: {reportDocNo}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Tanggal: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
              </div>

              {/* Document Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Outlet / Lokasi</span>
                  <span className="font-bold text-slate-800">{outletName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Item Diaudit</span>
                  <span className="font-mono font-bold text-slate-800">{opnames.length} Bahan Baku</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Status Selisih</span>
                  <span className="font-bold text-slate-800">
                    +{surplusCount} Surplus / -{deficitCount} Defisit
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Estimasi Nilai Selisih</span>
                  <span className="font-mono font-black text-rose-600">
                    {formatCurrencyIDR(totalVarianceValue)}
                  </span>
                </div>
              </div>

              {/* Detail Audit Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden my-4 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-white text-[10px] font-bold uppercase">
                    <tr>
                      <th className="p-2">No. Opname</th>
                      <th className="p-2">Bahan Baku</th>
                      <th className="p-2 text-right">Stok Sistem</th>
                      <th className="p-2 text-right">Stok Fisik</th>
                      <th className="p-2 text-center">Selisih (Variance)</th>
                      <th className="p-2">Kategori Alasan</th>
                      <th className="p-2">Catatan</th>
                      <th className="p-2 text-center">Auditor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    {opnames.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-400 text-xs">
                          Belum ada data audit stock opname untuk dicetak.
                        </td>
                      </tr>
                    ) : (
                      opnames.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50">
                          <td className="p-2 font-mono font-bold text-slate-900">{o.opnameNumber}</td>
                          <td className="p-2 font-semibold">
                            <span>{o.ingredientName}</span>
                            <span className="block text-[10px] text-slate-400 font-normal">
                              {o.category}
                            </span>
                          </td>
                          <td className="p-2 text-right font-mono font-medium">
                            {o.systemStock} {o.unit}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900">
                            {o.physicalStock} {o.unit}
                          </td>
                          <td className="p-2 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                o.variance > 0
                                  ? "bg-emerald-100 text-emerald-800"
                                  : o.variance < 0
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {o.variance > 0 ? `+${o.variance}` : o.variance} {o.unit}
                            </span>
                          </td>
                          <td className="p-2 font-medium text-slate-800 text-[11px]">
                            {getReasonBadgeLabel(o.reason)}
                          </td>
                          <td className="p-2 text-[10px] text-slate-500 italic">
                            {o.reasonNotes || "-"}
                          </td>
                          <td className="p-2 text-center font-medium text-[11px] text-slate-700">
                            {o.performedBy}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Statement of Integrity */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] text-slate-600 leading-relaxed">
                <p>
                  <strong>Pernyataan Berita Acara:</strong> Seluruh data stok fisik di atas telah dihitung, diperiksa, dan diverifikasi langsung di gudang penyimpanan. Penyesuaian stok sistem telah disinkronkan sesuai hasil audit aktual.
                </p>
              </div>

              {/* Three-Column Official Signature Section */}
              <div className="pt-6 grid grid-cols-3 gap-6 text-center text-xs">
                <div className="space-y-12">
                  <p className="font-bold text-slate-700">Petugas Opname / Auditor,</p>
                  <div>
                    <div className="border-b border-slate-400 w-36 mx-auto mb-1"></div>
                    <p className="font-bold text-slate-800">
                      {opnames[0]?.performedBy || "Staff Logistik"}
                    </p>
                    <p className="text-[10px] text-slate-400">Inventory Specialist</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="font-bold text-slate-700">Supervisor / Head Kitchen,</p>
                  <div>
                    <div className="border-b border-slate-400 w-36 mx-auto mb-1"></div>
                    <p className="font-bold text-slate-800">( ........................................ )</p>
                    <p className="text-[10px] text-slate-400">Operational Supervisor</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="font-bold text-slate-700">Store Manager / Owner,</p>
                  <div>
                    <div className="border-b border-slate-400 w-36 mx-auto mb-1"></div>
                    <p className="font-bold text-slate-800">( ........................................ )</p>
                    <p className="text-[10px] text-slate-400">Pimpinan Mitra / Hub</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
