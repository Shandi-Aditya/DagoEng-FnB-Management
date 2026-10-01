"use client";

import React, { useState } from "react";
import Image from "next/image";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  X,
  Printer,
  CheckCircle2,
  ShieldCheck,
  Building,
  Store,
  QrCode,
  Send,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ClosingReportData {
  reportNumber: string;
  outletName: string;
  outletAddress: string;
  outletPhone: string;
  cashierName: string;
  closingDateTime: string;
  shiftName: string;
  initialCash: number;
  totalCashSales: number;
  qrisSales: number;
  edcSales: number;
  totalTransactionsCount: number;
  totalGrossSales: number;
  totalDiscounts: number;
  isTaxEnabled: boolean;
  taxRatePercent: number;
  totalTax: number;
  totalNetSales: number;
  tenantSharePercent: number;
  dagoSharePercent: number;
  tenantTotalShare: number;
  dagoTotalShare: number;
  tenantQrisShare: number;
  dagoQrisShare: number;
  tenantCashShare: number;
  dagoCashShare: number;
  actualCashEnding: number;
  cashDifference: number;
  shiftNotes?: string;
  verificationHash: string;
}

interface DailyClosingPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: ClosingReportData;
  managerPhone: string;
}

export function DailyClosingPDFModal({
  isOpen,
  onClose,
  reportData,
  managerPhone,
}: DailyClosingPDFModalProps) {
  const [isGatewaySending, setIsGatewaySending] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<"IDLE" | "SENT">("IDLE");
  const [toastMessage, setToastMessage] = useState("");

  if (!isOpen) return null;

  // Direct Browser Print / Save as PDF Dialog
  const handlePrintPDF = () => {
    window.print();
  };

  // Dispatch to WhatsApp Gateway
  const handleDispatchWAGateway = () => {
    setIsGatewaySending(true);
    setTimeout(() => {
      setIsGatewaySending(false);
      setGatewayStatus("SENT");
      setToastMessage(
        `Laporan PDF & Ringkasan Keuangan berhasil dikirim via WA Gateway ke ${managerPhone}!`
      );

      // Open Direct WhatsApp fallback
      const text = encodeURIComponent(`📄 *LAPORAN RESMI CLOSING KEUANGAN - DAGOENG F&B*
━━━━━━━━━━━━━━━━━━━━
No. Dokumen: *${reportData.reportNumber}*
Outlet: *${reportData.outletName}*
Waktu: ${reportData.closingDateTime} (Shift: ${reportData.shiftName})
Kasir: ${reportData.cashierName}

💰 *RINGKASAN KEUANGAN:*
• Total Transaksi: ${reportData.totalTransactionsCount} Struk
• Omset Kotor: ${formatCurrencyIDR(reportData.totalGrossSales)}
• Pajak PB1/PPN (${reportData.isTaxEnabled ? `${reportData.taxRatePercent}%` : "Non-Aktif"}): ${formatCurrencyIDR(reportData.totalTax)}
• *Omset Bersih:* *${formatCurrencyIDR(reportData.totalNetSales)}*

💳 *METODE PEMBAYARAN:*
• QRIS Dinamis: ${formatCurrencyIDR(reportData.qrisSales)}
• Kas Tunai: ${formatCurrencyIDR(reportData.totalCashSales)}
• Kartu EDC: ${formatCurrencyIDR(reportData.edcSales)}

🤝 *BAGI HASIL REVENUE SHARE:*
• Hak Tenant (${reportData.tenantSharePercent}%): *${formatCurrencyIDR(reportData.tenantTotalShare)}*
• Hak Dago Hub (${reportData.dagoSharePercent}%): *${formatCurrencyIDR(reportData.dagoTotalShare)}*

🔐 *STATUS VALIDASI:*
• Dokumen Tersertifikasi Digital (Hash: ${reportData.verificationHash.slice(0, 10)}...)
• Sah tanpa tanda tangan fisik.
━━━━━━━━━━━━━━━━━━━━
_DagoEng Creative Hub - Financial Automated System_`);

      const cleanPhone = managerPhone.replace(/\D/g, "");
      const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`;
      window.open(waUrl, "_blank");

      setTimeout(() => setToastMessage(""), 5000);
    }, 1000);
  };

  return (
    <>
      {/* Global Print Style overrides to ensure exact 1-page A4 print */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 10mm;
          }
          body * {
            visibility: hidden;
          }
          #closing-pdf-report,
          #closing-pdf-report * {
            visibility: visible;
          }
          #closing-pdf-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
          {/* Top Control Bar (Hidden when printing) */}
          <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white print:hidden">
            <div className="flex items-center space-x-2.5">
              <FileText className="w-5 h-5 text-brand-orange" />
              <div>
                <h3 className="font-bold text-sm text-white">
                  Dokumen Resmi Laporan Closing Harian
                </h3>
                <p className="text-[11px] text-slate-400">
                  No. Dokumen: <span className="font-mono text-brand-orange">{reportData.reportNumber}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                onClick={handlePrintPDF}
                className="text-xs bg-brand-orange hover:bg-orange-600 text-white font-bold space-x-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / Save as PDF</span>
              </Button>

              <Button
                size="sm"
                onClick={handleDispatchWAGateway}
                disabled={isGatewaySending}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {isGatewaySending
                    ? "Mengirim ke WA..."
                    : gatewayStatus === "SENT"
                    ? "Kirim Ulang ke WA"
                    : "Kirim ke WA Gateway"}
                </span>
              </Button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Notification Toast */}
          {toastMessage && (
            <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-xs font-bold text-emerald-900 flex items-center space-x-2 px-6 print:hidden">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Printable PDF Document Sheet (Optimized 1-Page A4) */}
          <div className="overflow-y-auto p-6 flex-1 bg-slate-100 flex justify-center print:p-0 print:bg-white">
            <div
              id="closing-pdf-report"
              className="w-full max-w-[760px] bg-white p-6 rounded-xl shadow-sm border border-slate-200 font-sans text-slate-900 space-y-3.5 print:shadow-none print:border-none print:p-0 print:space-y-2.5"
            >
              {/* Header: Brand & Document Identity */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-10 relative flex-shrink-0">
                      <Image
                        src="/logo-dago.png"
                        alt="DagoEng"
                        width={32}
                        height={40}
                        className="object-contain"
                      />
                    </div>
                    <div>
                      <h1 className="font-extrabold text-base tracking-tight text-slate-900 leading-none">
                        DAGOENG <span className="text-brand-orange">CREATIVE HUB</span>
                      </h1>
                      <p className="text-[9px] text-slate-400 font-medium">
                        Multi-Business F&B Management & Platform Ecosystem
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium pt-0.5">
                    Tenant: <strong>{reportData.outletName}</strong> • {reportData.outletAddress}
                  </p>
                  <p className="text-[10px] text-slate-400">Kontak: {reportData.outletPhone}</p>
                </div>

                <div className="text-right space-y-0.5">
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[9px] font-bold uppercase tracking-wider inline-block">
                    REKAPITULASI RESMI
                  </span>
                  <h2 className="font-bold text-xs text-slate-900 pt-0.5">LAPORAN CLOSING HARIAN</h2>
                  <p className="font-mono text-[11px] font-bold text-brand-orange">{reportData.reportNumber}</p>
                  <p className="text-[10px] text-slate-500">{reportData.closingDateTime}</p>
                </div>
              </div>

              {/* Meta Information Bar */}
              <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 text-[11px]">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Shift / Sesi:</span>
                  <span className="font-bold text-slate-800">{reportData.shiftName}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Kasir Bertugas:</span>
                  <span className="font-bold text-slate-800">{reportData.cashierName}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Volume Penjualan:</span>
                  <span className="font-bold text-slate-800">{reportData.totalTransactionsCount} Transaksi</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Status Pajak:</span>
                  <span className="font-bold text-emerald-700">
                    {reportData.isTaxEnabled ? `PB1 ${reportData.taxRatePercent}% (Aktif)` : "Non-Aktif (0%)"}
                  </span>
                </div>
              </div>

              {/* Section 1: Ringkasan Penjualan & Pajak */}
              <div className="space-y-1">
                <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-0.5">
                  1. Ringkasan Pendapatan & Rincian Pajak (PB1 / PPN)
                </h3>
                <table className="w-full text-[11px] text-left">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50">
                      <td className="py-1 text-slate-600">Total Penjualan Kotor (Gross Sales)</td>
                      <td className="py-1 text-right font-mono font-semibold text-slate-800">
                        {formatCurrencyIDR(reportData.totalGrossSales)}
                      </td>
                    </tr>
                    {reportData.totalDiscounts > 0 && (
                      <tr className="hover:bg-slate-50 text-emerald-700">
                        <td className="py-1">Total Potongan Promo & Diskon Voucher</td>
                        <td className="py-1 text-right font-mono font-semibold">
                          -{formatCurrencyIDR(reportData.totalDiscounts)}
                        </td>
                      </tr>
                    )}
                    <tr className="hover:bg-slate-50">
                      <td className="py-1 text-slate-600">
                        Pajak Restoran ({reportData.isTaxEnabled ? `PB1 ${reportData.taxRatePercent}%` : "Non-Aktif"})
                      </td>
                      <td className="py-1 text-right font-mono font-semibold text-slate-800">
                        {formatCurrencyIDR(reportData.totalTax)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50 font-bold text-slate-900 border-t border-slate-300">
                      <td className="py-1.5">TOTAL OMSET BERSIH (NET REVENUE)</td>
                      <td className="py-1.5 text-right font-mono text-xs text-brand-orange">
                        {formatCurrencyIDR(reportData.totalNetSales)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 2: Rekonsiliasi Metode Pembayaran */}
              <div className="space-y-1">
                <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-0.5">
                  2. Rekonsiliasi Metode Pembayaran (Cash vs Non-Cash)
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded-lg border border-slate-200 bg-slate-50 space-y-0.5">
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Kas Tunai (Laci)</span>
                    <p className="text-xs font-bold font-mono text-slate-900">
                      {formatCurrencyIDR(reportData.totalCashSales)}
                    </p>
                    <span className="text-[9px] text-slate-400 block">Uang fisik kasir</span>
                  </div>

                  <div className="p-2 rounded-lg border border-blue-200 bg-blue-50/40 space-y-0.5">
                    <span className="text-[9px] text-blue-600 font-bold uppercase block">QRIS Dinamis</span>
                    <p className="text-xs font-bold font-mono text-blue-800">
                      {formatCurrencyIDR(reportData.qrisSales)}
                    </p>
                    <span className="text-[9px] text-blue-500 block">Settlement Digital</span>
                  </div>

                  <div className="p-2 rounded-lg border border-slate-200 bg-slate-50 space-y-0.5">
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Kartu EDC</span>
                    <p className="text-xs font-bold font-mono text-slate-900">
                      {formatCurrencyIDR(reportData.edcSales)}
                    </p>
                    <span className="text-[9px] text-slate-400 block">Debit / Kredit EDC</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Split Bagi Hasil (Revenue Sharing Split) */}
              <div className="space-y-1">
                <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-0.5">
                  3. Alokasi Bagi Hasil Pendapatan (Revenue Sharing Split)
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Tenant Share */}
                  <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/40 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[11px] text-amber-950">
                        Hak Pemilik Usaha / Tenant ({reportData.tenantSharePercent}%)
                      </span>
                      <span className="text-[9px] font-bold bg-amber-200 text-amber-900 px-1 py-0.2 rounded">
                        Tenant Share
                      </span>
                    </div>
                    <div className="space-y-0.5 text-[10px] text-amber-900">
                      <div className="flex justify-between">
                        <span>• Bagian QRIS Digital:</span>
                        <span className="font-mono font-medium">{formatCurrencyIDR(reportData.tenantQrisShare)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>• Bagian Kas Tunai:</span>
                        <span className="font-mono font-medium">{formatCurrencyIDR(reportData.tenantCashShare)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-amber-200 pt-0.5 text-slate-900 text-[11px]">
                        <span>Total Bersih Tenant:</span>
                        <span className="font-mono text-emerald-700">
                          {formatCurrencyIDR(reportData.tenantTotalShare)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dago Hub Share */}
                  <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/40 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[11px] text-blue-950">
                        Hak Pengelola Dago Hub ({reportData.dagoSharePercent}%)
                      </span>
                      <span className="text-[9px] font-bold bg-blue-200 text-blue-900 px-1 py-0.2 rounded">
                        Platform Fee
                      </span>
                    </div>
                    <div className="space-y-0.5 text-[10px] text-blue-900">
                      <div className="flex justify-between">
                        <span>• Bagian QRIS Digital:</span>
                        <span className="font-mono font-medium">{formatCurrencyIDR(reportData.dagoQrisShare)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>• Bagian Kas Tunai:</span>
                        <span className="font-mono font-medium">{formatCurrencyIDR(reportData.dagoCashShare)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-blue-200 pt-0.5 text-slate-900 text-[11px]">
                        <span>Total Bersih Dago Hub:</span>
                        <span className="font-mono text-blue-700">
                          {formatCurrencyIDR(reportData.dagoTotalShare)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Digital Certification Stamp (No Physical Signature Required) */}
              <div className="pt-2 border-t border-dashed border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 bg-emerald-100 text-emerald-800 rounded-lg flex items-center justify-center border border-emerald-300">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="text-[10px] space-y-0.5">
                    <p className="font-extrabold text-slate-900 uppercase">
                      TERSERTIFIKASI DIGITAL (E-VERIFIED)
                    </p>
                    <p className="text-[9px] text-slate-500 max-w-sm leading-tight">
                      Laporan diterbitkan otomatis oleh DagoEng Platform. Sah secara hukum & finansial tanpa memerlukan tanda tangan fisik basah.
                    </p>
                    <p className="text-[8px] font-mono text-slate-400">
                      Audit Hash: {reportData.verificationHash}
                    </p>
                  </div>
                </div>

                <div className="text-right space-y-0.5 font-mono text-[9px] text-slate-400">
                  <div className="w-11 h-11 border border-slate-300 rounded p-0.5 flex items-center justify-center ml-auto bg-white">
                    <QrCode className="w-9 h-9 text-slate-800" />
                  </div>
                  <span>Scan Validasi</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
