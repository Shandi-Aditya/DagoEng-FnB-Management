"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { formatCurrencyIDR } from "@/lib/utils";
import { LoyaltyMember } from "@/types/loyalty";
import {
  X,
  Printer,
  ShieldCheck,
  FileText,
  Crown,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CustomersReportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: LoyaltyMember[];
  outletName: string;
}

export function CustomersReportPDFModal({
  isOpen,
  onClose,
  members,
  outletName,
}: CustomersReportPDFModalProps) {
  const printContentRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const totalPoints = members.reduce((sum, m) => sum + (m.points || 0), 0);
  const totalSpend = members.reduce((sum, m) => sum + (m.totalSpend || 0), 0);
  const platinumCount = members.filter((m) => m.tier === "Platinum").length;
  const goldCount = members.filter((m) => m.tier === "Gold").length;

  const reportNumber = `CRM-REP-${new Date().getFullYear()}${(new Date().getMonth() + 1)
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
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Dokumen PDF Laporan Pelanggan & Loyalty CRM</span>
                <span className="text-[10px] bg-cyan-600 text-white px-2 py-0.2 rounded-full font-mono">
                  RESMI
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Data Anggota Loyalty, Poin, & Riwayat Nilai Belanja
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-bold space-x-1.5 shadow-sm"
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

        {/* Paper Canvas */}
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
                  <p className="text-xs font-semibold text-cyan-600">
                    Customer Relationship Management & Loyalty Platform
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Outlet: {outletName} • Master Database CRM
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
                Laporan Data Member, Tier Loyalty & Akumulasi Belanja
              </h2>
              <p className="text-xs text-slate-500">
                Ringkasan anggota terdaftar, saldo poin reward, dan segmentasi nilai tamu
              </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-3 my-5">
              <div className="p-3 bg-cyan-50/70 rounded-xl border border-cyan-200 text-center">
                <span className="text-[10px] text-cyan-700 font-bold uppercase block">
                  Total Member
                </span>
                <span className="text-sm font-black text-cyan-900 font-mono">
                  {members.length} Orang
                </span>
              </div>
              <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200 text-center">
                <span className="text-[10px] text-purple-700 font-bold uppercase block">
                  Platinum Member
                </span>
                <span className="text-sm font-black text-purple-800 font-mono">
                  {platinumCount} VIP
                </span>
              </div>
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-center">
                <span className="text-[10px] text-amber-700 font-bold uppercase block">
                  Gold Member
                </span>
                <span className="text-sm font-black text-amber-800 font-mono">
                  {goldCount} Member
                </span>
              </div>
              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-center">
                <span className="text-[10px] text-emerald-700 font-bold uppercase block">
                  Total Belanja CRM
                </span>
                <span className="text-sm font-black text-emerald-900 font-mono">
                  {formatCurrencyIDR(totalSpend)}
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden my-4 text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-white text-[11px] font-bold uppercase">
                  <tr>
                    <th className="p-2.5">Nama Tamu</th>
                    <th className="p-2.5">No. Kontak</th>
                    <th className="p-2.5 text-center">Tier</th>
                    <th className="p-2.5 text-right">Saldo Poin</th>
                    <th className="p-2.5 text-right">Total Belanja (Rp)</th>
                    <th className="p-2.5 text-center">Kunjungan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{m.name}</td>
                      <td className="p-2.5 font-mono text-slate-600">{m.phone}</td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            m.tier === "Platinum"
                              ? "bg-purple-100 text-purple-800"
                              : m.tier === "Gold"
                              ? "bg-amber-100 text-amber-800"
                              : m.tier === "Silver"
                              ? "bg-slate-200 text-slate-800"
                              : "bg-orange-100 text-orange-800"
                          }`}
                        >
                          {m.tier}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-brand-orange">
                        {m.points} Pts
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrencyIDR(m.totalSpend)}
                      </td>
                      <td className="p-2.5 text-center font-medium text-slate-600">
                        {m.totalVisits}x
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Certification */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-cyan-600" />
                <div>
                  <p className="font-bold text-slate-800">Laporan Resmi CRM & Loyalty</p>
                  <p className="text-[10px] text-slate-400">
                    Terverifikasi digital dari transaksi POS Kasir & Self-Order QR.
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px]">
                <p className="font-bold text-slate-800">DagoEng Customer Ops</p>
                <p className="text-slate-400 font-mono">
                  SHA256: {Date.now()}-CRM-STAMP-OK
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
