"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { formatCurrencyIDR } from "@/lib/utils";
import { Employee, ShiftRecord } from "@/types/shift";
import {
  X,
  Printer,
  ShieldCheck,
  FileText,
  UserCheck,
  Clock,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmployeesReportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  shifts: ShiftRecord[];
  outletName: string;
}

export function EmployeesReportPDFModal({
  isOpen,
  onClose,
  employees,
  shifts,
  outletName,
}: EmployeesReportPDFModalProps) {
  const printContentRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const activeEmployees = employees.filter((e) => e.status === "AKTIF");
  const completedShifts = shifts.filter((s) => s.status === "CLOSED");
  const totalShiftSales = shifts.reduce((sum, s) => sum + (s.cashSales + s.nonCashSales), 0);

  const reportNumber = `HR-SHIFT-${new Date().getFullYear()}${(new Date().getMonth() + 1)
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
                <span>Dokumen PDF Laporan Karyawan & Shift Operasional</span>
                <span className="text-[10px] bg-blue-600 text-white px-2 py-0.2 rounded-full font-mono">
                  RESMI
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Data Staf, Penugasan Shift, & Rekapitulasi Kas Laci Kasir
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
                    Human Resources, Shift Management & Cashier Audit
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Outlet: {outletName} • HR & Shift Roster
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
                Rekapitulasi Karyawan, Penjadwalan & Audit Shift
              </h2>
              <p className="text-xs text-slate-500">
                Daftar absensi shift kasir/staf, total transaksi shift, dan catatan rekonsiliasi
              </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-3 my-5">
              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-center">
                <span className="text-[10px] text-blue-700 font-bold uppercase block">
                  Total Karyawan Aktif
                </span>
                <span className="text-sm font-black text-blue-900 font-mono">
                  {activeEmployees.length} Staf
                </span>
              </div>
              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-center">
                <span className="text-[10px] text-emerald-700 font-bold uppercase block">
                  Shift Selesai (Closed)
                </span>
                <span className="text-sm font-black text-emerald-800 font-mono">
                  {completedShifts.length} Sesi
                </span>
              </div>
              <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200 text-center">
                <span className="text-[10px] text-purple-700 font-bold uppercase block">
                  Total Omzet Sesi Shift
                </span>
                <span className="text-sm font-black text-purple-900 font-mono">
                  {formatCurrencyIDR(totalShiftSales)}
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden my-4 text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-white text-[11px] font-bold uppercase">
                  <tr>
                    <th className="p-2.5">ID Staf</th>
                    <th className="p-2.5">Nama Karyawan</th>
                    <th className="p-2.5">Posisi / Role</th>
                    <th className="p-2.5">Departemen</th>
                    <th className="p-2.5">Penugasan Shift</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {employees.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold font-mono text-slate-900">{e.employeeNumber}</td>
                      <td className="p-2.5 font-medium">{e.name}</td>
                      <td className="p-2.5 text-slate-700">{e.role}</td>
                      <td className="p-2.5 text-slate-500">{e.department}</td>
                      <td className="p-2.5 text-[11px] text-slate-600">{e.assignedShift}</td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            e.status === "AKTIF"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {e.status}
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
                  <p className="font-bold text-slate-800">Laporan Resmi SDM & Shift</p>
                  <p className="text-[10px] text-slate-400">
                    Otorisasi terintegrasi modul Employee Shift & RBAC DagoEng.
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px]">
                <p className="font-bold text-slate-800">Dago Creative Hub HR Dept.</p>
                <p className="text-slate-400 font-mono">
                  SHA256: {Date.now()}-HR-STAMP-OK
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
