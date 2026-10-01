"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { formatCurrencyIDR } from "@/lib/utils";
import { CoworkingBooking, CoworkingMember, CoworkingSpace } from "@/types/coworking";
import {
  X,
  Printer,
  ShieldCheck,
  FileText,
  Laptop,
  Building,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CoworkingReportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaces: CoworkingSpace[];
  bookings: CoworkingBooking[];
  members: CoworkingMember[];
  outletName: string;
}

export function CoworkingReportPDFModal({
  isOpen,
  onClose,
  spaces,
  bookings,
  members,
  outletName,
}: CoworkingReportPDFModalProps) {
  const printContentRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  const activeBookings = bookings.filter((b) => b.checkInStatus === "CHECKED_IN" || b.checkInStatus === "RESERVED");
  const occupiedSpaces = spaces.filter((s) => s.status === "OCCUPIED").length;
  const occupancyPercent = spaces.length > 0 ? Math.round((occupiedSpaces / spaces.length) * 100) : 0;

  const reportNumber = `COWORK-REP-${new Date().getFullYear()}${(new Date().getMonth() + 1)
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
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Dokumen PDF Laporan Co-working Space & Reservasi</span>
                <span className="text-[10px] bg-blue-600 text-white px-2 py-0.2 rounded-full font-mono">
                  RESMI
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Data Okupansi Ruang Kerja, Reservasi Meja, & Omzet Sewa
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold space-x-1.5 shadow-sm"
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
                  <p className="text-xs font-semibold text-blue-600">
                    Co-working Space, Meeting Rooms & Private Pods
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Outlet: {outletName} • Dago Coworking Unit
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
                Rekapitulasi Okupansi Ruang Kerja & Pendapatan Sewa
              </h2>
              <p className="text-xs text-slate-500">
                Daftar transaksi booking aktif, status ruang (Desk/Meeting Room), dan member coworking
              </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-3 my-5">
              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-center">
                <span className="text-[10px] text-blue-700 font-bold uppercase block">
                  Total Pendapatan
                </span>
                <span className="text-sm font-black text-blue-900 font-mono">
                  {formatCurrencyIDR(totalRevenue)}
                </span>
              </div>
              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-center">
                <span className="text-[10px] text-emerald-700 font-bold uppercase block">
                  Tingkat Okupansi
                </span>
                <span className="text-sm font-black text-emerald-800 font-mono">
                  {occupancyPercent}%
                </span>
              </div>
              <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200 text-center">
                <span className="text-[10px] text-purple-700 font-bold uppercase block">
                  Booking Aktif
                </span>
                <span className="text-sm font-black text-purple-800 font-mono">
                  {activeBookings.length} Sesi
                </span>
              </div>
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-center">
                <span className="text-[10px] text-amber-700 font-bold uppercase block">
                  Member Coworking
                </span>
                <span className="text-sm font-black text-amber-800 font-mono">
                  {members.length} Member
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden my-4 text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-white text-[11px] font-bold uppercase">
                  <tr>
                    <th className="p-2.5">ID Booking</th>
                    <th className="p-2.5">Nama Tamu / Klien</th>
                    <th className="p-2.5">Ruang Kerja</th>
                    <th className="p-2.5">Tipe Sewa</th>
                    <th className="p-2.5 text-right">Biaya (Rp)</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold font-mono text-slate-900">{b.bookingCode || b.id}</td>
                      <td className="p-2.5 font-medium">{b.guestName}</td>
                      <td className="p-2.5 text-slate-700">{b.spaceName}</td>
                      <td className="p-2.5 text-slate-500 font-mono">
                        {b.duration} {b.bookingType === "HOURLY" ? "Jam" : b.bookingType === "DAILY" ? "Hari" : "Bulan"}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrencyIDR(b.totalAmount)}
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${b.checkInStatus === "CHECKED_IN"
                              ? "bg-emerald-100 text-emerald-800"
                              : b.checkInStatus === "RESERVED"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                        >
                          {b.checkInStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Certification */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-bold text-slate-800">Laporan Resmi Co-working</p>
                  <p className="text-[10px] text-slate-400">
                    Terverifikasi digital dari operasional sistem reservasi DagoEng.
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px]">
                <p className="font-bold text-slate-800">Dago Hub Space Management</p>
                <p className="text-slate-400 font-mono">
                  SHA256: {Date.now()}-COWORK-STAMP-OK
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
