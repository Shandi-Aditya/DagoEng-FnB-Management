"use client";

import React, { useRef } from "react";
import Image from "next/image";
import {
  X,
  Printer,
  ShieldCheck,
  Building2,
  Calendar,
  User,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityLogEntry } from "@/types/audit";

interface ActivityLogPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ActivityLogEntry[];
  outletName: string;
  generatedBy: string;
  generatedRole: string;
  periodLabel: string;
}

export default function ActivityLogPDFModal({
  isOpen,
  onClose,
  logs,
  outletName,
  generatedBy,
  generatedRole,
  periodLabel,
}: ActivityLogPDFModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalCount = logs.length;
  const successCount = logs.filter((l) => l.status === "SUCCESS").length;
  const warningCount = logs.filter((l) => l.status === "WARNING").length;
  const failedCount = logs.filter((l) => l.status === "FAILED").length;
  const highSeverityCount = logs.filter(
    (l) => l.severity === "HIGH" || l.severity === "CRITICAL"
  ).length;

  return (
    <>
      {/* Global Print Style to isolate PDF sheet and hide background dashboard */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          html,
          body {
            background: #ffffff !important;
            height: auto !important;
            overflow: visible !important;
          }
          body * {
            visibility: hidden !important;
          }
          #activity-log-pdf-report,
          #activity-log-pdf-report * {
            visibility: visible !important;
          }
          #activity-log-pdf-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden,
          button,
          header,
          aside,
          nav {
            display: none !important;
          }
        }
      `}</style>

      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
        <div className="bg-white rounded-2xl max-w-5xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:border-none print:shadow-none print:max-w-none flex flex-col max-h-[90vh]">
          {/* Non-Printable Action Bar */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 print:hidden shrink-0">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-slate-800 text-sm">Pratinjau PDF Audit Trail & Activity Log</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                {logs.length} Entri Tercatat
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                onClick={handlePrint}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white space-x-1.5 shadow-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / Simpan PDF</span>
              </Button>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Document Body */}
          <div className="overflow-y-auto p-6 flex-1 bg-slate-100 flex justify-center print:p-0 print:bg-white print:overflow-visible">
            <div
              id="activity-log-pdf-report"
              className="w-full max-w-[800px] bg-white p-8 rounded-xl shadow-xs border border-slate-200 space-y-6 text-slate-800 font-sans print:shadow-none print:border-none print:p-0 print:max-w-none"
            >
              {/* Header Branding */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
                <div>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-12 relative flex-shrink-0">
                      <Image
                        src="/logo-dago.png"
                        alt="Dago Creative Hub Logo"
                        width={40}
                        height={50}
                        className="object-contain"
                      />
                    </div>
                    <div>
                      <h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-tight">
                        DAGO <span className="text-brand-orange">CREATIVE HUB</span>
                      </h1>
                      <p className="text-[11px] text-slate-500 font-semibold">
                        Integrated F&B, Co-working & Commercial Management System
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-600 space-y-0.5">
                    <p>
                      <strong>Gerai / Outlet:</strong> {outletName}
                    </p>
                    <p>
                      <strong>Periode Audit:</strong> {periodLabel}
                    </p>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-600 space-y-1">
                  <div className="inline-block px-3 py-1 bg-purple-100 text-purple-900 rounded-lg font-mono font-bold text-xs border border-purple-200">
                    LAPORAN RESMI AUDIT TRAIL
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Waktu Cetak: {new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })} WITA
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Dicetak Oleh: <strong className="text-slate-800">{generatedBy}</strong> ({generatedRole})
                  </p>
                </div>
              </div>

              {/* Executive Summary Metrics */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Total Entri Audit</span>
                  <p className="text-xl font-black text-slate-900 mt-1">{totalCount}</p>
                </div>
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Aksi Sukses</span>
                  <p className="text-xl font-black text-emerald-700 mt-1">{successCount}</p>
                </div>
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                  <span className="text-[10px] font-bold text-amber-700 uppercase">Peringatan / Selisih</span>
                  <p className="text-xl font-black text-amber-700 mt-1">{warningCount}</p>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                  <span className="text-[10px] font-bold text-purple-700 uppercase">High / Critical</span>
                  <p className="text-xl font-black text-purple-700 mt-1">{highSeverityCount}</p>
                </div>
              </div>

              {/* Detailed Audit Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Daftar Rekam Aktivitas & Transformasi Data
                </h4>
                <table className="w-full text-left text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <th className="border border-slate-300 px-2.5 py-2 w-28">Waktu (WITA)</th>
                      <th className="border border-slate-300 px-2.5 py-2 w-32">Aktor & Role</th>
                      <th className="border border-slate-300 px-2.5 py-2 w-28">Modul & Aksi</th>
                      <th className="border border-slate-300 px-2.5 py-2">Transformasi / Deskripsi</th>
                      <th className="border border-slate-300 px-2.5 py-2 w-32">Alasan Bisnis</th>
                      <th className="border border-slate-300 px-2.5 py-2 text-center w-16">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-slate-400">
                          Tidak ada entri log pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log, idx) => (
                        <tr key={log.id || idx} className="text-[11px] align-top">
                          <td className="border border-slate-300 px-2.5 py-1.5 font-mono text-[10px] text-slate-600">
                            {new Date(log.timestamp).toLocaleString("id-ID", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="border border-slate-300 px-2.5 py-1.5">
                            <div className="font-bold text-slate-900">{log.actorName}</div>
                            <div className="text-[10px] text-purple-700">{log.actorRole}</div>
                          </td>
                          <td className="border border-slate-300 px-2.5 py-1.5">
                            <span className="font-mono font-bold text-slate-800 text-[10px]">
                              [{log.module}]
                            </span>
                            <div className="font-semibold text-slate-700">{log.action}</div>
                          </td>
                          <td className="border border-slate-300 px-2.5 py-1.5">
                            <div className="text-slate-800">{log.description}</div>
                            {(log.previousValue || log.newValue) && (
                              <div className="text-[10px] text-slate-600 font-mono mt-0.5 space-y-0.5">
                                {log.previousValue && (
                                  <div className="text-red-700 line-through">
                                    <strong>Sebelum:</strong> {log.previousValue}
                                  </div>
                                )}
                                {log.newValue && (
                                  <div className="text-emerald-700 font-bold">
                                    <strong>Sesudah:</strong> {log.newValue}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="border border-slate-300 px-2.5 py-1.5 italic text-slate-600 text-[10px]">
                            {log.reason || "-"}
                          </td>
                          <td className="border border-slate-300 px-2.5 py-1.5 text-center font-bold font-mono text-[10px]">
                            <span
                              className={
                                log.status === "SUCCESS"
                                  ? "text-emerald-700"
                                  : log.status === "WARNING"
                                  ? "text-amber-700"
                                  : "text-red-700"
                              }
                            >
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Legal Non-Repudiation Footer & Signatures */}
              <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span className="text-[10px]">
                    Dokumen resmi rekam audit tersertifikasi sistem Dago Creative Hub. Tidak dapat disangkal (Non-repudiation) & Immutable.
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-slate-800">DAGO CREATIVE HUB MANAGEMENT</p>
                  <p className="text-[10px] text-slate-400">Verifikasi Sistem Otomatis</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
