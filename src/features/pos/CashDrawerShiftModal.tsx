"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  tenantName?: string;
  tenantPhone?: string;
  onConfirmClose?: (actualCash: number, notes?: string) => void;
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
  tenantName = "Kopi Senja (Mitra Utama)",
  tenantPhone = "085737654572",
  onConfirmClose,
}: CashDrawerShiftModalProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [confirmCashierName, setConfirmCashierName] = useState<string>(cashierName || user?.name || "");
  const [cashInDrawer, setCashInDrawer] = useState<number>(initialCash + totalCashSales);
  const [cashInputDisplay, setCashInputDisplay] = useState<string>(
    (initialCash + totalCashSales).toLocaleString("id-ID")
  );
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");

  useEffect(() => {
    setConfirmCashierName(cashierName || user?.name || "");
    const expected = initialCash + totalCashSales;
    setCashInDrawer(expected);
    setCashInputDisplay(expected.toLocaleString("id-ID"));
  }, [cashierName, user?.name, initialCash, totalCashSales, isOpen]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      const day = now.getDate().toString().padStart(2, "0");
      const month = months[now.getMonth()];
      const year = now.getFullYear();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const seconds = now.getSeconds().toString().padStart(2, "0");
      setCurrentTimeStr(`${day} ${month} ${year} ${hours}.${minutes}.${seconds}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen) return null;

  // 1. Calculations
  const totalGrossSales = totalCashSales + totalNonCashSales;
  const estimatedTax = isTaxEnabled
    ? Math.round(totalGrossSales * (taxRatePercent / (100 + taxRatePercent)))
    : 0;
  const totalNetSales = totalGrossSales - estimatedTax;

  const finalQrisSales = qrisSales !== undefined ? qrisSales : Math.round(totalNonCashSales * 0.85);
  const finalEdcSales = edcSales !== undefined ? edcSales : totalNonCashSales - finalQrisSales;

  // Revenue Sharing (Fixed 85% Mitra, 15% Dago Hub Platform)
  const tenantSharePercent = 85;
  const dagoSharePercent = 15;
  const tenantTotalShare = Math.round((totalNetSales * tenantSharePercent) / 100);
  const dagoTotalShare = totalNetSales - tenantTotalShare;

  const dateNow = new Date();
  const dateFormatted = dateNow.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeFormatted = dateNow.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateTimeStr = `${dateFormatted}, ${timeFormatted}`;
  const docNo = `EOD-${dateNow.getFullYear()}${(dateNow.getMonth() + 1)
    .toString()
    .padStart(2, "0")}${dateNow.getDate().toString().padStart(2, "0")}-${Math.floor(
    100 + Math.random() * 900
  )}`;

  // Generate WhatsApp Message strictly matching standard template
  const generateWhatsAppTemplate = () => {
    const formatNum = (num: number) => num.toLocaleString("id-ID");

    return `📊 *LAPORAN CLOSING SHIFT & REKAP KEUANGAN*
📍 *Outlet:* ${outletName}
📅 *Waktu:* ${dateTimeStr}
👤 *Kasir:* ${confirmCashierName || cashierName}

━━━━━━━━━━━━━━━━━━━━
💰 *RINGKASAN PENJUALAN*
• Total Transaksi: ${totalTransactionsCount} Struk
• Omset Kotor: Rp ${formatNum(totalGrossSales)}
• Pajak PB1 (${taxRatePercent}%): Rp ${formatNum(estimatedTax)}
• *Omset Bersih:* *Rp ${formatNum(totalNetSales)}*

💳 *METODE PEMBAYARAN*
• 📲 QRIS Dinamis: Rp ${formatNum(finalQrisSales)}
• 💵 Tunai (Cash): Rp ${formatNum(totalCashSales)}
• 💳 Kartu EDC: Rp ${formatNum(finalEdcSales)}

🤝 *ESTIMASI BAGI HASIL*
• *Mitra / Owner (${tenantSharePercent}%):* Rp ${formatNum(tenantTotalShare)}
• *Manajemen Dago (${dagoSharePercent}%):* Rp ${formatNum(dagoTotalShare)}
━━━━━━━━━━━━━━━━━━━━
📄 *DOKUMEN RESMI:*
• File Rekapitulasi PDF terlampir di bawah ini (Auto-Generated).
_Sent via POS DagoEng Platform_`;
  };

  const handleCashInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, "");
    const num = parseInt(rawVal, 10) || 0;
    setCashInDrawer(num);
    setCashInputDisplay(num > 0 ? num.toLocaleString("id-ID") : "");
  };

  const handleConfirmCloseSession = async () => {
    if (isClosing) return;
    setIsClosing(true);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const pdfUrl = `${origin}/api/reports/closing/pdf?outlet=${encodeURIComponent(
      outletName
    )}&cashier=${encodeURIComponent(confirmCashierName || cashierName)}&transactions=${totalTransactionsCount}&gross=${totalGrossSales}&tax=${estimatedTax}&net=${totalNetSales}&qris=${finalQrisSales}&cash=${totalCashSales}&edc=${finalEdcSales}&mitra=${tenantTotalShare}&dago=${dagoTotalShare}&docNo=${encodeURIComponent(
      docNo
    )}`;

    // 1. Trigger local Shift state & closing calculation
    if (onConfirmClose) {
      onConfirmClose(cashInDrawer, `Tutup Sesi Kasir (${docNo})`);
    }

    // 2. Lock shift via backend API
    try {
      await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CLOSE",
          cashierName: confirmCashierName || cashierName,
          outletId: outletName,
          actualCash: cashInDrawer,
          notes: "Tutup Sesi Kasir",
        }),
      });
    } catch (e) {
      console.warn("Shift lock sync:", e);
    }

    // 2. Dispatch WhatsApp Chatbot to Owner Dago & Admin Mitra (Fonnte API)
    const waMessage = generateWhatsAppTemplate();
    try {
      const waRes = await fetch("/api/notifications/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: waMessage,
          targetPhone: tenantPhone,
          url: pdfUrl,
          filename: `Laporan_Closing_${docNo}.pdf`,
        }),
      });
      const waData = await waRes.json().catch(() => null);
      if (waData?.success) {
        console.log("[WhatsApp Chatbot Sent Successfully]:", waData);
      } else {
        console.warn("[WhatsApp Chatbot Response]:", waData);
      }
    } catch (err) {
      console.error("WhatsApp dispatch error:", err);
    }

    // 3. Gracefully logout and redirect
    setTimeout(async () => {
      try {
        await logout();
      } catch (err) {
        console.error("Logout error:", err);
      } finally {
        onClose();
        router.push("/login");
      }
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
          <h3 className="font-bold text-sm text-slate-800">
            Close Cashier Session
          </h3>
          <button
            onClick={onClose}
            disabled={isClosing}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* Warning Banner */}
          <div className="p-3.5 bg-amber-50/90 border border-amber-200/80 rounded-xl text-[11px] leading-relaxed text-amber-900">
            <span>Pastikan semua transaksi sudah selesai. </span>
            <span className="text-red-600 font-semibold">
              Anda tidak akan bisa mengubah transaksi yang sudah dicatat setelah menutup cashier session.
            </span>
          </div>

          {/* Form Fields */}
          <div className="space-y-3.5 pt-1">
            {/* Cashier Name Confirmation */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-600 font-medium block">
                Tolong masukkan nama Anda (<span className="text-blue-600">kasir</span>) sebagai konfirmasi
              </label>
              <input
                type="text"
                value={confirmCashierName}
                onChange={(e) => setConfirmCashierName(e.target.value)}
                placeholder="Konfirmasi nama kasir yang menutup sesi"
                disabled={isClosing}
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-slate-900 shadow-2xs"
              />
            </div>

            {/* Cash in Drawer */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-600 font-medium block">
                (Uang Tunai di Laci)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2 text-xs text-slate-400 font-mono">Rp.</span>
                <input
                  type="text"
                  value={cashInputDisplay}
                  onChange={handleCashInputChange}
                  placeholder="0"
                  disabled={isClosing}
                  className="w-full pl-10 pr-3.5 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-slate-900 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Server Timestamp */}
          <div className="pt-2 text-center text-slate-500 text-[11px] space-y-0.5">
            <p>
              Kasir ditutup pada{" "}
              <strong className="text-slate-800 font-bold">{currentTimeStr || "Waktu Server"}</strong>
            </p>
            <p className="text-[10px] text-slate-400">Waktu Server</p>
          </div>

          {/* Confirm Button */}
          <div className="pt-2">
            <Button
              type="button"
              disabled={isClosing || !confirmCashierName.trim()}
              onClick={handleConfirmCloseSession}
              className="w-full py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all active:scale-98 flex items-center justify-center space-x-2"
            >
              {isClosing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menutup Sesi & Mengirim Chatbot...</span>
                </>
              ) : (
                <span>Confirm</span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
