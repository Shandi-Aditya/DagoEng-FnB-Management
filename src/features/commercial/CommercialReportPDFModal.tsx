"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { formatCurrencyIDR } from "@/lib/utils";
import { CommercialLease } from "@/types/commercial";
import {
  X,
  Printer,
  ShieldCheck,
  FileText,
  Building2,
  DollarSign,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CommercialReportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  leases: CommercialLease[];
  outletName: string;
}

export function CommercialReportPDFModal({
  isOpen,
  onClose,
  leases,
  outletName,
}: CommercialReportPDFModalProps) {
  const printContentRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const totalAnnualValue = leases.reduce((sum, l) => sum + (l.monthlyRent * 12 || 0), 0);
  const activeLeases = leases.filter((l) => l.status === "ACTIVE").length;
  const totalDepositHeld = leases.reduce((sum, l) => sum + (l.depositAmount || 0), 0);
  const totalPaidRevenue = leases.reduce(
    (sum, l) => sum + l.paymentHistory.reduce((pSum, p) => pSum + (p.amount || 0), 0),
    0
  );

  const reportNumber = `COMM-REP-${new Date().getFullYear()}${(new Date().getMonth() + 1)
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
        {/* Header Control */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Dokumen PDF Laporan Kontrak Sewa Komersial & Tenant</span>
                <span className="text-[10px] bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full font-mono border border-purple-400/30">
                  CONFIDENTIAL
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Laporan resmi manajemen lot sewa komersial, revenue sewa, dan status deposit DagoEng
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold space-x-1.5 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / Simpan PDF</span>
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Canvas */}
        <div className="p-8 overflow-y-auto flex-1 bg-slate-100/60 print:p-0 print:bg-white">
          <div
            ref={printContentRef}
            className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-slate-900 print:border-0 print:shadow-none print:p-0"
          >
            {/* Letterhead */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
              <div className="flex items-center space-x-3.5">
                <Image
                  src="/icons/icon-192x192.png"
                  alt="Dago Creative Hub"
                  width={56}
                  height={56}
                  className="rounded-xl shadow-xs"
                />
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-950 uppercase">
                    DAGO CREATIVE HUB
                  </h1>
                  <p className="text-xs text-slate-600 font-medium">
                    Commercial Property & Retail Lot Management Division
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Jl. Dago No. 128, Bandung • Singaraja & Jimbaran Outlets
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-1 rounded bg-purple-100 text-purple-800 text-[10px] font-mono font-bold tracking-wider uppercase mb-1">
                  LAPORAN KOMERSIAL
                </span>
                <p className="text-xs font-mono font-semibold text-slate-700">{reportNumber}</p>
                <p className="text-[10px] text-slate-500">
                  Tanggal: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>

            {/* Metadata Summary Box */}
            <div className="my-5 p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block uppercase">Outlet Unit</span>
                <span className="font-bold text-slate-900">{outletName || "Semua Outlet"}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block uppercase">Kontrak Aktif</span>
                <span className="font-bold text-emerald-600 font-mono">{activeLeases} / {leases.length} Lot</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block uppercase">Total Nilai Sewa/Thn</span>
                <span className="font-bold text-purple-700 font-mono">{formatCurrencyIDR(totalAnnualValue)}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block uppercase">Deposit Tertahan</span>
                <span className="font-bold text-slate-800 font-mono">{formatCurrencyIDR(totalDepositHeld)}</span>
              </div>
            </div>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg text-center">
                <p className="text-[10px] font-bold text-purple-900 uppercase">Realisasi Penerimaan</p>
                <p className="text-base font-black text-purple-700 font-mono mt-0.5">
                  {formatCurrencyIDR(totalPaidRevenue)}
                </p>
              </div>
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-center">
                <p className="text-[10px] font-bold text-emerald-900 uppercase">Tingkat Okupansi Tenant</p>
                <p className="text-base font-black text-emerald-700 font-mono mt-0.5">
                  {leases.length > 0 ? Math.round((activeLeases / leases.length) * 100) : 0}%
                </p>
              </div>
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-center">
                <p className="text-[10px] font-bold text-blue-900 uppercase">Rata-rata Sewa/Bulan</p>
                <p className="text-base font-black text-blue-700 font-mono mt-0.5">
                  {leases.length > 0 ? formatCurrencyIDR(Math.round(totalAnnualValue / 12 / leases.length)) : "Rp 0"}
                </p>
              </div>
            </div>

            {/* Leases Table */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200">
                Daftar Rincian Kontrak Tenant & Komersial
              </h4>
              <table className="w-full text-[11px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold">
                    <th className="p-2">No. Kontrak</th>
                    <th className="p-2">Tenant / Brand</th>
                    <th className="p-2">Lot & Luas</th>
                    <th className="p-2">Periode Sewa</th>
                    <th className="p-2 text-right">Biaya Sewa/Bln</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {leases.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/50">
                      <td className="p-2 font-mono font-semibold text-slate-900">{l.leaseNumber}</td>
                      <td className="p-2">
                        <div className="font-bold text-slate-900">{l.tenantName}</div>
                        <div className="text-[10px] text-slate-500">{l.tenantContact}</div>
                      </td>
                      <td className="p-2">
                        <span className="font-semibold text-slate-800">{l.unitCode}</span>
                        <span className="text-[10px] text-slate-500 block">({l.areaSquareMeters} m²)</span>
                      </td>
                      <td className="p-2 text-[10px] font-mono">
                        {l.startDate} s/d {l.endDate}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">
                        {formatCurrencyIDR(l.monthlyRent)}
                      </td>
                      <td className="p-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            l.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : l.status === "EXPIRING_SOON"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {leases.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400">
                        Belum ada data kontrak komersial terdaftar
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Official Footer Certification & Digital Stamp */}
            <div className="pt-6 border-t border-slate-200 mt-6 grid grid-cols-2 gap-6 text-xs">
              <div className="p-3 rounded-lg bg-purple-50/60 border border-purple-200 text-[10px] text-purple-900 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Verifikasi Legalitas & Keabsahan Dokumen</p>
                  <p className="text-slate-600 mt-0.5">
                    Laporan ini dihasilkan secara otomatis oleh DagoEng ERP Multi-Outlet Management System. Data sewa, deposit, dan tagihan telah diverifikasi secara digital.
                  </p>
                </div>
              </div>

              <div className="text-right flex flex-col justify-end">
                <p className="text-[10px] text-slate-500">Mengetahui & Menyetujui,</p>
                <p className="text-xs font-bold text-slate-900 mt-1">Commercial & Property Director</p>
                <div className="h-10"></div>
                <p className="text-[10px] font-mono font-bold text-slate-700 underline uppercase">
                  ( Manajemen Dago Creative Hub )
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
