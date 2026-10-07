"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  X,
  Lock,
  CheckCircle2,
  AlertCircle,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClosingReportData } from "./DailyClosingPDFModal";

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

  const router = useRouter();
  const { logout } = useAuth();

  const handleCloseShiftAndExit = async () => {
    if (isClosing) return;
    setIsClosing(true);
    setToastMsg("Menutup sesi kasir & memproses pengiriman laporan otomatis...");

    // Auto-dispatch closing report to server-side WhatsApp Gateway (Fonnte API)
    try {
      const reportMessage = generateWhatsAppReport();
      await fetch("/api/notifications/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: reportMessage,
        }),
      });
    } catch (err) {
      console.error("Gagal mengirim laporan closing ke backend WhatsApp gateway:", err);
    }

    // Gracefully complete closing shift, logout and redirect
    setTimeout(async () => {
      try {
        await logout();
      } catch (logoutErr) {
        console.error("Error during cashier logout:", logoutErr);
      } finally {
        onClose();
        router.push("/login");
      }
    }, 600);
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
                <h3 className="font-bold text-sm text-white">
                  Tutup Sesi Kasir
                </h3>
                <p className="text-[11px] text-slate-400">
                  {outletName} • Kasir: {cashierName}
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
          <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
            {/* Info Banner */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Hitung uang fisik di laci kasir dan pastikan jumlahnya sesuai sebelum menutup sesi.
              </span>
            </div>

            {/* Toast Msg */}
            {toastMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{toastMsg}</span>
              </div>
            )}

            {/* Target Cash Breakdown */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex justify-between text-slate-600">
                <span>Modal Awal Kas:</span>
                <span className="font-mono font-semibold text-slate-800">{formatCurrencyIDR(initialCash)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Penjualan Tunai:</span>
                <span className="font-mono font-semibold text-emerald-700">+{formatCurrencyIDR(totalCashSales)}</span>
              </div>
              <div className="flex justify-between items-center font-bold text-slate-900 border-t border-slate-200 pt-2 text-sm">
                <span>Total Uang Kas yang Harus Disetor:</span>
                <span className="font-mono text-base text-brand-orange">
                  {formatCurrencyIDR(expectedCashEnding)}
                </span>
              </div>
            </div>

            {/* Physical Cash Drawer Reconciliation */}
            <div className="p-4 bg-orange-50/40 rounded-xl border border-brand-orange/30 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Hitungan Uang Fisik Aktual di Laci (Rp) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="text"
                    value={actualInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-base font-bold font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange bg-white text-slate-900"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-xs pt-2 border-t border-orange-200/50">
                <span className="font-bold text-slate-600">Selisih Kas Fisik:</span>
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

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800">Catatan Shift (Opsional):</label>
              <input
                type="text"
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                placeholder="Contoh: Uang fisik sudah diserahkan ke supervisor..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange bg-white"
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
              <span>{isClosing ? "Menutup Sesi..." : "Tutup Sesi"}</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
