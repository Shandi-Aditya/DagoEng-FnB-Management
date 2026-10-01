"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { X, Printer, Download, Building2, Calendar, User, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ReportType = "SALES" | "CLOSING" | "PRODUCTS" | "INVENTORY" | "FINANCE_AUDIT" | "SETTLEMENT";

export interface ReportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: ReportType;
  outletName: string;
  periodLabel: string;
  generatedBy: string;
  data: {
    title: string;
    subtitle: string;
    summaryCards: { label: string; value: string; sub?: string }[];
    tableHeaders: string[];
    tableRows: (string | number)[][];
    footerNotes?: string;
    reconciliationInfo?: { label: string; value: string }[];
  };
}

export default function StructuredReportPDFModal({
  isOpen,
  onClose,
  reportType,
  outletName,
  periodLabel,
  generatedBy,
  data,
}: ReportPDFModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
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
          #structured-pdf-report,
          #structured-pdf-report * {
            visibility: visible !important;
          }
          #structured-pdf-report {
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
        <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:border-none print:shadow-none print:max-w-none flex flex-col max-h-[90vh]">
          
          {/* Non-Printable Header Bar */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 print:hidden shrink-0">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-slate-800 text-sm">Preview PDF Laporan Manajemen</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                {reportType}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                onClick={handlePrint}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white space-x-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / Simpan PDF</span>
              </Button>
              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Document Body */}
          <div className="overflow-y-auto p-6 flex-1 bg-slate-100 flex justify-center print:p-0 print:bg-white print:overflow-visible">
            <div
              id="structured-pdf-report"
              ref={printRef}
              className="w-full max-w-[780px] bg-white p-8 rounded-xl shadow-xs border border-slate-200 space-y-6 text-slate-800 print:p-0 print:shadow-none print:border-none print:max-w-none"
            >
              
              {/* Company Branding & Report Header */}
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
                      <p className="text-[11px] text-slate-500 font-medium">Integrated F&B, Co-working & Commercial Management</p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-600 space-y-0.5">
                    <p><strong>Gerai / Outlet:</strong> {outletName}</p>
                    <p><strong>Periode Laporan:</strong> {periodLabel}</p>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-600 space-y-1">
                  <div className="inline-block px-3 py-1 bg-slate-100 rounded-lg font-mono font-bold text-slate-800 text-xs">
                    {data.title.toUpperCase()}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Dicetak: {new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} WITA
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Oleh: <strong className="text-slate-700">{generatedBy}</strong>
                  </p>
                </div>
              </div>

              {/* Subtitle & Document Note */}
              <div className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <p className="font-bold text-slate-800">{data.title}</p>
                  <p className="text-slate-500 text-[11px]">{data.subtitle}</p>
                </div>
                <div className="text-right font-mono text-[11px] text-slate-500">
                  Dokumen Resmi Sistem
                </div>
              </div>

              {/* KPI Summary Cards */}
              {data.summaryCards && data.summaryCards.length > 0 && (
                <div className={`grid grid-cols-2 md:grid-cols-${Math.min(data.summaryCards.length, 4)} gap-3`}>
                  {data.summaryCards.map((card, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{card.label}</p>
                      <p className="text-lg font-extrabold text-slate-900 mt-0.5">{card.value}</p>
                      {card.sub && <p className="text-[10px] text-slate-500 mt-0.5">{card.sub}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Table Data */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] border-b border-slate-200">
                    <tr>
                      {data.tableHeaders.map((th, i) => (
                        <th key={i} className="px-3 py-2.5">
                          {th}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {data.tableRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`px-3 py-2 text-slate-700 ${
                              typeof cell === "number" || (typeof cell === "string" && cell.startsWith("Rp"))
                                ? "font-mono font-semibold"
                                : ""
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Reconciliation Details if available */}
              {data.reconciliationInfo && (
                <div className="bg-purple-50/50 border border-purple-200/80 rounded-xl p-4 space-y-2 text-xs">
                  <p className="font-bold text-purple-900 text-[11px] uppercase tracking-wider">
                    Catatan Rekonsiliasi & Validasi Integritas Data
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {data.reconciliationInfo.map((item, idx) => (
                      <div key={idx}>
                        <span className="text-purple-600 block text-[10px] font-semibold">{item.label}</span>
                        <span className="font-bold text-slate-800">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Signatures Section */}
              <div className="grid grid-cols-3 gap-8 pt-8 border-t border-slate-200 text-center text-xs text-slate-600">
                <div>
                  <p className="text-slate-400 text-[11px] mb-12">Disiapkan Oleh,</p>
                  <p className="font-bold text-slate-800 border-t border-slate-300 pt-1 inline-block min-w-36">
                    {generatedBy}
                  </p>
                  <p className="text-[10px] text-slate-400">Kasir / Store Staff</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[11px] mb-12">Diperiksa Oleh,</p>
                  <p className="font-bold text-slate-800 border-t border-slate-300 pt-1 inline-block min-w-36">
                    Putu Arya
                  </p>
                  <p className="text-[10px] text-slate-400">Store Manager</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[11px] mb-12">Disetujui Oleh,</p>
                  <p className="font-bold text-slate-800 border-t border-slate-300 pt-1 inline-block min-w-36">
                    Shandi
                  </p>
                  <p className="text-[10px] text-slate-400">Owner Dago Creative Hub</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </>
  );
}
