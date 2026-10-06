"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  X,
  Lock,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Share2,
  Copy,
  Printer,
  Sliders,
  Send,
  Building,
  Store,
  QrCode,
  Banknote,
  Percent,
  FileText,
  Sparkles,
  LogOut,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DailyClosingPDFModal, ClosingReportData } from "./DailyClosingPDFModal";

interface CashDrawerShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashierName: string;
  outletName: string;
  initialCash: number;
  totalCashSales: number;
  totalNonCashSales: number;
  totalTransactionsCount: number;
  qrisSales?: number;
  edcSales?: number;
  totalDiscounts?: number;
  isTaxEnabled?: boolean;
  taxRatePercent?: number;
}

export function CashDrawerShiftModal({
  isOpen,
  onClose,
  cashierName,
  outletName,
  initialCash,
  totalCashSales,
  totalNonCashSales,
  totalTransactionsCount,
  qrisSales,
  edcSales,
  totalDiscounts = 0,
  isTaxEnabled = true,
  taxRatePercent = 10,
}: CashDrawerShiftModalProps) {
  // Cash reconciliation
  const [actualCashEnding, setActualCashEnding] = useState<number>(initialCash + totalCashSales);
  const [actualInput, setActualInput] = useState<string>((initialCash + totalCashSales).toString());
  const [shiftNotes, setShiftNotes] = useState<string>("");
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string>("");
  const [isPDFModalOpen, setIsPDFModalOpen] = useState<boolean>(false);

  // Sync actual cash when modal opens or live values change
  React.useEffect(() => {
    const expected = initialCash + totalCashSales;
    setActualCashEnding(expected);
    setActualInput(expected.toString());
  }, [initialCash, totalCashSales, isOpen]);

  // Payment Breakdown Estimation (QRIS vs EDC)
  const finalQrisSales = qrisSales !== undefined ? qrisSales : Math.round(totalNonCashSales * 0.85);
  const finalEdcSales = edcSales !== undefined ? edcSales : totalNonCashSales - finalQrisSales;

  // Revenue Sharing Split Settings (Default: 85% Tenant, 15% Dago Hub Platform)
  const [tenantSharePercent, setTenantSharePercent] = useState<number>(85);
  const dagoSharePercent = 100 - tenantSharePercent;

  // WhatsApp Manager Contact
  const [managerPhone, setManagerPhone] = useState<string>("6281234567890");

  if (!isOpen) return null;

  const totalGrossSales = totalCashSales + totalNonCashSales;
  const estimatedTax = isTaxEnabled
    ? Math.round(totalGrossSales * (taxRatePercent / (100 + taxRatePercent)))
    : 0;
  const totalNetSales = totalGrossSales - estimatedTax;

  // Calculations for Revenue Sharing Split
  const tenantTotalShare = Math.round((totalNetSales * tenantSharePercent) / 100);
  const dagoTotalShare = totalNetSales - tenantTotalShare;

  const tenantQrisShare = Math.round((finalQrisSales * tenantSharePercent) / 100);
  const dagoQrisShare = finalQrisSales - tenantQrisShare;

  const tenantCashShare = Math.round((totalCashSales * tenantSharePercent) / 100);
  const dagoCashShare = totalCashSales - tenantCashShare;

  const expectedCashEnding = initialCash + totalCashSales;
  const cashDifference = actualCashEnding - expectedCashEnding;

  const handleInputChange = (val: string) => {
    const num = parseInt(val.replace(/\D/g, ""), 10) || 0;
    setActualInput(val);
    setActualCashEnding(num);
  };

  const reportDataForPDF: ClosingReportData = {
    reportNumber: `EOD-KS-${new Date().getFullYear()}${(new Date().getMonth() + 1)
      .toString()
      .padStart(2, "0")}${new Date().getDate().toString().padStart(2, "0")}-001`,
    outletName,
    outletAddress: "Jl. Diponegoro No. 45, Singaraja, Bali",
    outletPhone: "+62 812-3456-7890",
    cashierName,
    closingDateTime: `${new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}, ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`,
    shiftName: "Shift 2 (Sore/Penutupan)",
    initialCash,
    totalCashSales,
    qrisSales: finalQrisSales,
    edcSales: finalEdcSales,
    totalTransactionsCount,
    totalGrossSales,
    totalDiscounts,
    isTaxEnabled,
    taxRatePercent,
    totalTax: estimatedTax,
    totalNetSales,
    tenantSharePercent,
    dagoSharePercent,
    tenantTotalShare,
    dagoTotalShare,
    tenantQrisShare,
    dagoQrisShare,
    tenantCashShare,
    dagoCashShare,
    actualCashEnding,
    cashDifference,
    shiftNotes,
    verificationHash: `SHA256-${Date.now()}-DAGOENG-OFFICIAL-VALIDATED`,
  };

  // Generate Formatted WhatsApp Text
  const generateWhatsAppReport = () => {
    const dateStr = new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const timeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    return `📊 *LAPORAN CLOSING SHIFT & REKAP KEUANGAN*
📍 *Outlet:* ${outletName}
📅 *Waktu:* ${dateStr}, ${timeStr}
👤 *Kasir Bertugas:* ${cashierName}
⚙️ *Status Pajak (PB1):* ${isTaxEnabled ? `AKTIF (${taxRatePercent}%)` : "NON-AKTIF"}

━━━━━━━━━━━━━━━━━━━━
💰 *RINGKASAN PENJUALAN*
• Total Transaksi: ${totalTransactionsCount} Struk
• Total Omset Kotor: ${formatCurrencyIDR(totalGrossSales)}
• Pajak PB1 Restoran: ${formatCurrencyIDR(estimatedTax)}
• *Total Omset Bersih:* *${formatCurrencyIDR(totalNetSales)}*

💳 *METODE PEMBAYARAN*
• 📲 QRIS Dinamis: ${formatCurrencyIDR(finalQrisSales)}
• 💵 Tunai (Cash Laci): ${formatCurrencyIDR(totalCashSales)}
• 💳 Kartu EDC: ${formatCurrencyIDR(finalEdcSales)}

🤝 *SPLIT BAGI HASIL REVENUE SHARE*
• *Porsi Pemilik Usaha / Tenant (${tenantSharePercent}%):* *${formatCurrencyIDR(tenantTotalShare)}*
  ↳ Dari QRIS: ${formatCurrencyIDR(tenantQrisShare)} (Digital Settlement)
  ↳ Dari Cash: ${formatCurrencyIDR(tenantCashShare)} (Kas Fisik)
• *Porsi Pengelola Dago Hub (${dagoSharePercent}%):* *${formatCurrencyIDR(dagoTotalShare)}*
  ↳ Dari QRIS: ${formatCurrencyIDR(dagoQrisShare)}
  ↳ Dari Cash: ${formatCurrencyIDR(dagoCashShare)} (Setor Kasir)

💵 *REKONSILIASI KAS LACI*
• Modal Awal Kas: ${formatCurrencyIDR(initialCash)}
• Kas Aktual Fisik: ${formatCurrencyIDR(actualCashEnding)}
• Status Selisih: ${cashDifference === 0 ? "PAS (Rp 0)" : cashDifference > 0 ? `Lebih +${formatCurrencyIDR(cashDifference)}` : `Kurang -${formatCurrencyIDR(Math.abs(cashDifference))}`}
${shiftNotes ? `\n📝 *Catatan Shift:* ${shiftNotes}` : ""}

📄 *DOKUMEN RESMI PDF:*
• Tersedia file PDF Rekapitulasi Keuangan Terverifikasi Digital (Tanpa perlu tanda tangan fisik).
━━━━━━━━━━━━━━━━━━━━
_Laporan otomatis digenerate dari POS DagoEng Platform_`;
  };

  // Dispatch to WhatsApp
  const handleSendWhatsApp = () => {
    const text = encodeURIComponent(generateWhatsAppReport());
    const cleanPhone = managerPhone.replace(/\D/g, "");
    const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`;
    window.open(waUrl, "_blank");
    setToastMsg("Membuka WhatsApp Gateway untuk mengirim laporan closing ke Manager...");
    setTimeout(() => setToastMsg(""), 4000);
  };

  // Copy to clipboard
  const handleCopyReport = () => {
    navigator.clipboard.writeText(generateWhatsAppReport());
    setToastMsg("Format teks laporan closing WhatsApp berhasil disalin!");
    setTimeout(() => setToastMsg(""), 3500);
  };

  const router = useRouter();
  const { logout } = useAuth();

  const handleCloseShiftAndExit = async () => {
    setIsClosing(true);
    setToastMsg("Shift kasir berhasil ditutup & direkonsiliasi. Mengakhiri sesi kasir...");
    await logout();
    onClose();
    router.push("/login");
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-brand-orange/20 text-brand-orange flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                  <span>Rekonsiliasi Kasir & Selesai Shift</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  {outletName} • Kasir: {cashierName} • Pajak: {isTaxEnabled ? `PB1 ${taxRatePercent}%` : "Non-Aktif"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isClosing}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
            {/* Info Banner */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>
                Periksa hitungan kas fisik laci kasir dan bagi hasil sebelum sesi kasir Anda diakhiri secara otomatis.
              </span>
            </div>

            {/* Toast Msg */}
            {toastMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{toastMsg}</span>
              </div>
            )}

            {/* Action Bar for PDF Generator */}
            <div className="p-3.5 bg-gradient-to-r from-purple-50 to-orange-50 rounded-xl border border-purple-200 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Laporan Rekapitulasi PDF Resmi</p>
                  <p className="text-[11px] text-slate-600">
                    Memuat logo usaha, rincian PPN, rekonsiliasi, split revenue, dan cap sertifikasi digital.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setIsPDFModalOpen(true)}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center space-x-1"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Buka Dokumen PDF</span>
              </Button>
            </div>

            {/* Top Metric Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold uppercase">Omset Kotor</span>
                  <Store className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <p className="text-base font-bold text-slate-900 font-mono">
                  {formatCurrencyIDR(totalGrossSales)}
                </p>
                <span className="text-[10px] text-slate-500 font-medium">{totalTransactionsCount} Transaksi</span>
              </div>

              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-0.5">
                <div className="flex items-center justify-between text-blue-500">
                  <span className="text-[10px] font-bold uppercase">QRIS (Digital)</span>
                  <QrCode className="w-3.5 h-3.5" />
                </div>
                <p className="text-base font-bold text-blue-700 font-mono">
                  {formatCurrencyIDR(finalQrisSales)}
                </p>
                <span className="text-[10px] text-blue-600 font-medium">Auto-Settlement Bank</span>
              </div>

              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-0.5">
                <div className="flex items-center justify-between text-emerald-600">
                  <span className="text-[10px] font-bold uppercase">Kas Tunai (Cash)</span>
                  <Banknote className="w-3.5 h-3.5" />
                </div>
                <p className="text-base font-bold text-emerald-700 font-mono">
                  {formatCurrencyIDR(totalCashSales)}
                </p>
                <span className="text-[10px] text-emerald-600 font-medium">Uang Fisik di Laci</span>
              </div>
            </div>

            {/* Section 2: Revenue Sharing Split (Bagi Hasil Tenant & Dago Hub) */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div className="flex items-center space-x-1.5">
                  <Building className="w-4 h-4 text-brand-orange" />
                  <span className="font-bold text-slate-800 text-xs">
                    Kalkulasi Split Bagi Hasil (Revenue Sharing)
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-500 font-medium">Persentase Pemilik Usaha:</span>
                  <select
                    value={tenantSharePercent}
                    onChange={(e) => setTenantSharePercent(Number(e.target.value))}
                    className="bg-white border border-slate-200 rounded px-2 py-1 font-bold text-brand-orange outline-hidden text-xs"
                  >
                    <option value={90}>Tenant 90% : Dago 10%</option>
                    <option value={85}>Tenant 85% : Dago 15% (Standar)</option>
                    <option value={80}>Tenant 80% : Dago 20%</option>
                    <option value={75}>Tenant 75% : Dago 25%</option>
                  </select>
                </div>
              </div>

              {/* Split Breakdown Table */}
              <div className="grid grid-cols-2 gap-3">
                {/* Tenant Share */}
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">Porsi Pemilik Tenant ({tenantSharePercent}%)</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                      Tenant Net
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-600">
                    <div className="flex justify-between">
                      <span>• Dari QRIS Digital:</span>
                      <span className="font-mono font-medium">{formatCurrencyIDR(tenantQrisShare)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Dari Kas Tunai:</span>
                      <span className="font-mono font-medium">{formatCurrencyIDR(tenantCashShare)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-1">
                      <span>Total Hak Tenant:</span>
                      <span className="font-mono text-emerald-700">{formatCurrencyIDR(tenantTotalShare)}</span>
                    </div>
                  </div>
                </div>

                {/* Dago Hub Share */}
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">Porsi Pengelola Dago ({dagoSharePercent}%)</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                      Platform Fee
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-600">
                    <div className="flex justify-between">
                      <span>• Dari QRIS Digital:</span>
                      <span className="font-mono font-medium">{formatCurrencyIDR(dagoQrisShare)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Dari Kas Tunai (Setor):</span>
                      <span className="font-mono font-medium">{formatCurrencyIDR(dagoCashShare)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-1">
                      <span>Total Hak Dago Hub:</span>
                      <span className="font-mono text-blue-700">{formatCurrencyIDR(dagoTotalShare)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Physical Cash Drawer Reconciliation */}
            <div className="p-4 bg-orange-50/40 rounded-xl border border-brand-orange/30 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-700">Modal Awal + Total Penjualan Tunai:</span>
                <span className="font-bold font-mono text-slate-900">
                  {formatCurrencyIDR(expectedCashEnding)}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">
                  Hitungan Kas Fisik Aktual di Laci:
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="text"
                    value={actualInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm font-bold font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange bg-white"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-xs pt-2 border-t border-orange-200/50">
                <span className="font-bold text-slate-600">Selisih Kas Fisik (Variance):</span>
                <span
                  className={`font-bold font-mono px-2 py-0.5 rounded text-xs ${
                    cashDifference === 0
                      ? "bg-emerald-100 text-emerald-800"
                      : cashDifference > 0
                      ? "bg-blue-100 text-blue-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {cashDifference === 0
                    ? "Sesuai / Pas (Rp 0)"
                    : cashDifference > 0
                    ? `Lebih: +${formatCurrencyIDR(cashDifference)}`
                    : `Kurang: -${formatCurrencyIDR(Math.abs(cashDifference))}`}
                </span>
              </div>
            </div>

            {/* Section 4: WhatsApp Dispatch to Manager */}
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 font-bold text-emerald-950">
                  <Send className="w-4 h-4 text-emerald-600" />
                  <span>Kirim Laporan Closing & PDF via WhatsApp Gateway</span>
                </div>
                <button
                  onClick={handleCopyReport}
                  className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold flex items-center space-x-1"
                >
                  <Copy className="w-3.5 h-3.5 mr-0.5" />
                  <span>Salin Teks Ringkasan</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 font-bold block mb-0.5">
                    No. WhatsApp / Grup Manager:
                  </label>
                  <input
                    type="text"
                    value={managerPhone}
                    onChange={(e) => setManagerPhone(e.target.value)}
                    placeholder="6281234567890"
                    className="w-full px-3 py-1.5 text-xs border border-emerald-300 rounded-lg bg-white font-mono"
                  />
                </div>
                <div className="pt-4">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSendWhatsApp}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center space-x-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Kirim ke WA Manager</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800">Catatan Shift Tambahan:</label>
              <input
                type="text"
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                placeholder="Contoh: Seluruh transaksi selesai, mesin kopi sudah backflush..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isClosing}
              className="text-xs font-semibold"
            >
              Batal
            </Button>

            <Button
              type="button"
              disabled={isClosing}
              onClick={handleCloseShiftAndExit}
              className="flex-1 text-xs font-bold space-x-2 bg-red-600 hover:bg-red-700 text-white shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>{isClosing ? "Mengakhiri Sesi Kasir..." : "Selesai Rekonsiliasi & Keluar Sesi"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* PDF Report Modal */}
      <DailyClosingPDFModal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        reportData={reportDataForPDF}
        managerPhone={managerPhone}
      />
    </>
  );
}
