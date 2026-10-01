"use client";

import React, { useState, useEffect, useMemo } from "react";
import { OrderRecord } from "@/types/order";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  X,
  QrCode,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  Store,
  CreditCard,
  Banknote,
  Flame,
  Zap,
  Laptop,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface UnifiedPaymentItem {
  id: string;
  itemCode: string; // e.g. "ORD-20260924-001" or "BK-CWK-00195"
  title: string; // "Pesanan Kuliner F&B" or "Booking Ruang Kerja"
  subtitle: string; // "Meja T-03" or "Dedicated Desk D-01"
  customerName: string;
  total: number;
  paymentMethod: "QRIS" | "CASH" | "EDC" | string;
  type: "FNB" | "COWORKING";
  paymentStatus: "PENDING" | "PAID" | "REFUNDED" | string;
  createdAt?: string;
  itemsBreakdown?: { label: string; qty?: number; price: number }[];
  dateInfo?: string;
}

interface PaymentWaitingModalProps {
  isOpen: boolean;
  order?: OrderRecord | null;
  booking?: any | null;
  paymentItem?: UnifiedPaymentItem | null;
  onClose: () => void;
  onPaymentSuccess: (payload: { type: "FNB" | "COWORKING"; id: string }) => void;
  onCancelPayment: (payload: { type: "FNB" | "COWORKING"; id: string }) => void;
  onExpired?: (payload: { type: "FNB" | "COWORKING"; id: string }) => void;
}

export function PaymentWaitingModal({
  isOpen,
  order,
  booking,
  paymentItem,
  onClose,
  onPaymentSuccess,
  onCancelPayment,
  onExpired,
}: PaymentWaitingModalProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(900); // 15 minutes
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [isPaidSuccess, setIsPaidSuccess] = useState<boolean>(false);

  // Normalize target item
  const activeItem: UnifiedPaymentItem | null = useMemo(() => {
    if (paymentItem) return paymentItem;
    if (order) {
      return {
        id: order.id,
        itemCode: order.orderNumber,
        title: "Pesanan Kuliner F&B",
        subtitle: `Meja ${order.tableNumber} (${order.outletName})`,
        customerName: order.customerName,
        total: order.total,
        paymentMethod: order.paymentMethod || "QRIS",
        type: "FNB",
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        itemsBreakdown: order.items.map((i) => ({
          label: i.productName,
          qty: i.quantity,
          price: i.quantity * i.unitPrice,
        })),
      };
    }
    if (booking) {
      return {
        id: booking.id,
        itemCode: booking.bookingCode,
        title: "Booking Ruang Kerja Co-working",
        subtitle: `${booking.spaceName} (${booking.duration} Jam)`,
        customerName: booking.guestName,
        total: booking.totalAmount,
        paymentMethod: booking.paymentMethod || "QRIS",
        type: "COWORKING",
        paymentStatus: booking.paymentStatus,
        dateInfo: `${booking.date} • ${booking.startTime}`,
        itemsBreakdown: [
          {
            label: `${booking.spaceName} (${booking.duration} Jam)`,
            qty: 1,
            price: booking.totalAmount,
          },
        ],
      };
    }
    return null;
  }, [order, booking, paymentItem]);

  // Initialize countdown on open
  useEffect(() => {
    if (isOpen && activeItem) {
      setIsPaidSuccess(activeItem.paymentStatus === "PAID");
      setShowCancelConfirm(false);
      setIsVerifying(false);

      if (activeItem.createdAt) {
        const orderTime = new Date(activeItem.createdAt).getTime();
        const now = Date.now();
        const elapsedSecs = Math.floor((now - orderTime) / 1000);
        const remain = Math.max(0, 900 - elapsedSecs);
        setSecondsRemaining(remain > 0 ? remain : 900);
      } else {
        setSecondsRemaining(900);
      }
    }
  }, [isOpen, activeItem]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || !activeItem || isPaidSuccess || secondsRemaining <= 0) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onExpired && activeItem) {
            onExpired({ type: activeItem.type, id: activeItem.id });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, activeItem, isPaidSuccess, secondsRemaining, onExpired]);

  // Format MM:SS
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const timerProgress = useMemo(() => {
    return Math.min(100, Math.max(0, (secondsRemaining / 900) * 100));
  }, [secondsRemaining]);

  if (!isOpen || !activeItem) return null;

  const handleCopyReference = () => {
    navigator.clipboard?.writeText(activeItem.itemCode);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  // Simulate payment gateway webhook callback
  const handleSimulateWebhookSuccess = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setIsPaidSuccess(true);
      onPaymentSuccess({ type: activeItem.type, id: activeItem.id });
    }, 800);
  };

  const methodLabel =
    activeItem.paymentMethod === "CASH"
      ? "Tunai di Kasir"
      : activeItem.paymentMethod === "EDC"
      ? "Kartu Debit / EDC"
      : "QRIS Dinamis";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[94vh]">
        
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-orange/20 text-brand-orange flex items-center justify-center font-bold border border-brand-orange/30">
              {isPaidSuccess ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Clock className="w-4 h-4 animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-white flex items-center gap-1.5">
                <span>{isPaidSuccess ? "Pembayaran Terverifikasi!" : "Menunggu Pembayaran"}</span>
                {activeItem.type === "COWORKING" && (
                  <Badge className="bg-blue-600/80 text-[9px] px-1.5 py-0">Co-working</Badge>
                )}
              </h3>
              <p className="text-[11px] text-slate-300 font-mono">
                {activeItem.itemCode} &bull; {activeItem.subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          
          {isPaidSuccess ? (
            /* ==================================================== */
            /* SUCCESS STATE VIEW                                  */
            /* ==================================================== */
            <div className="text-center py-6 space-y-4 animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <Badge className="bg-emerald-500 text-white font-bold text-xs px-3 py-0.5">
                  LUNAS & TERVERIFIKASI
                </Badge>
                <h4 className="font-black text-xl text-slate-900">Pembayaran Berhasil!</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {activeItem.type === "COWORKING"
                    ? `Reservasi ruang kerja ${activeItem.subtitle} atas nama ${activeItem.customerName} telah lunas dan siap digunakan!`
                    : `Pesanan #${activeItem.itemCode} telah diteruskan ke Dapur (KDS) dan sedang mulai disiapkan.`}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs text-left">
                <div className="flex justify-between text-slate-600">
                  <span>Metode Pembayaran</span>
                  <span className="font-bold text-slate-900">{methodLabel}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Tagihan Lunas</span>
                  <span className="font-black text-emerald-600">{formatCurrencyIDR(activeItem.total)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Pelanggan</span>
                  <span className="font-bold text-slate-900">{activeItem.customerName}</span>
                </div>
              </div>

              <Button
                onClick={onClose}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-2xl shadow-md"
              >
                <span>Lihat Status di Tab Pesanan & Booking</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          ) : (
            /* ==================================================== */
            /* PENDING PAYMENT STATE VIEW                          */
            /* ==================================================== */
            <>
              {/* Countdown Banner */}
              <div className="p-3.5 bg-amber-50/90 rounded-2xl border border-amber-200/90 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 text-amber-800 font-bold">
                    <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                    <span>Selesaikan Pembayaran Dalam:</span>
                  </div>
                  <span className="font-mono font-black text-amber-950 text-sm bg-amber-200/80 px-2 py-0.5 rounded-md">
                    {formatTimer(secondsRemaining)}
                  </span>
                </div>
                <div className="w-full bg-amber-200/60 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${timerProgress}%` }}
                  />
                </div>
              </div>

              {/* Tagihan Box */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Total Tagihan {activeItem.type === "COWORKING" ? "Booking Ruang" : "Pesanan F&B"}
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-white">
                    {formatCurrencyIDR(activeItem.total)}
                  </div>
                </div>
                <Badge className="bg-brand-orange text-white font-bold text-[10px] px-2.5 py-1">
                  {methodLabel}
                </Badge>
              </div>

              {/* Payment Component based on method */}
              {activeItem.paymentMethod === "CASH" ? (
                /* ---------------- CASH INSTRUCTIONS ---------------- */
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <Banknote className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm">Pembayaran Tunai di Kasir</h5>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Silakan menuju meja kasir / resepsionis dan tunjukkan kode berikut untuk menyelesaikan pembayaran tunai.
                    </p>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 font-mono text-xs font-black text-slate-800 flex items-center justify-between">
                    <span>{activeItem.itemCode}</span>
                    <button
                      onClick={handleCopyReference}
                      className="text-brand-orange hover:text-orange-600 flex items-center space-x-1 text-[11px] font-bold"
                    >
                      {copiedRef ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedRef ? "Tersalin" : "Salin"}</span>
                    </button>
                  </div>
                </div>
              ) : activeItem.paymentMethod === "EDC" ? (
                /* ---------------- EDC INSTRUCTIONS ---------------- */
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm">Pembayaran Kartu Debit / Kredit</h5>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Silakan hubungi kasir atau waiter untuk tap/gesek kartu pada mesin EDC Dago Creative Hub.
                    </p>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 font-mono text-xs font-black text-slate-800 flex items-center justify-between">
                    <span>{activeItem.itemCode}</span>
                    <button
                      onClick={handleCopyReference}
                      className="text-brand-orange hover:text-orange-600 flex items-center space-x-1 text-[11px] font-bold"
                    >
                      {copiedRef ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedRef ? "Tersalin" : "Salin"}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* ---------------- QRIS DINAMIS COMPONENT ---------------- */
                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-200/90 flex flex-col items-center space-y-3.5 shadow-2xs">
                  
                  {/* QRIS Header Branding */}
                  <div className="flex items-center justify-between w-full border-b border-slate-200 pb-2 text-[10px]">
                    <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                      <Store className="w-3.5 h-3.5 text-brand-orange" />
                      <span>Dago Creative Hub Singaraja</span>
                    </div>
                    <span className="font-mono text-slate-400 font-medium">NMID: ID10202609240001</span>
                  </div>

                  {/* QR Box with Stylized SVG Placeholder (Ready for Gateway Payload) */}
                  <div className="p-3 bg-white rounded-2xl border-2 border-slate-800 shadow-sm relative group flex flex-col items-center">
                    <div className="relative w-44 h-44 bg-white flex items-center justify-center p-2">
                      {/* Stylized QR Matrix simulation */}
                      <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900">
                        {/* Corner Position Detection Patterns */}
                        <rect x="5" y="5" width="26" height="26" fill="currentColor" rx="4" />
                        <rect x="9" y="9" width="18" height="18" fill="white" rx="2" />
                        <rect x="13" y="13" width="10" height="10" fill="currentColor" rx="1" />

                        <rect x="69" y="5" width="26" height="26" fill="currentColor" rx="4" />
                        <rect x="73" y="9" width="18" height="18" fill="white" rx="2" />
                        <rect x="77" y="13" width="10" height="10" fill="currentColor" rx="1" />

                        <rect x="5" y="69" width="26" height="26" fill="currentColor" rx="4" />
                        <rect x="9" y="73" width="18" height="18" fill="white" rx="2" />
                        <rect x="13" y="77" width="10" height="10" fill="currentColor" rx="1" />

                        {/* Alignment & Timing Patterns */}
                        <rect x="36" y="14" width="4" height="4" fill="currentColor" />
                        <rect x="44" y="14" width="4" height="4" fill="currentColor" />
                        <rect x="52" y="14" width="4" height="4" fill="currentColor" />
                        <rect x="60" y="14" width="4" height="4" fill="currentColor" />

                        <rect x="14" y="36" width="4" height="4" fill="currentColor" />
                        <rect x="14" y="44" width="4" height="4" fill="currentColor" />
                        <rect x="14" y="52" width="4" height="4" fill="currentColor" />
                        <rect x="14" y="60" width="4" height="4" fill="currentColor" />

                        {/* Dense Matrix Data Pixels */}
                        <rect x="35" y="35" width="6" height="6" fill="currentColor" />
                        <rect x="45" y="35" width="6" height="6" fill="currentColor" />
                        <rect x="55" y="35" width="6" height="6" fill="currentColor" />
                        <rect x="65" y="35" width="6" height="6" fill="currentColor" />

                        <rect x="35" y="45" width="6" height="6" fill="currentColor" />
                        <rect x="55" y="45" width="6" height="6" fill="currentColor" />
                        <rect x="75" y="45" width="6" height="6" fill="currentColor" />

                        <rect x="45" y="55" width="6" height="6" fill="currentColor" />
                        <rect x="65" y="55" width="6" height="6" fill="currentColor" />
                        <rect x="75" y="55" width="6" height="6" fill="currentColor" />

                        <rect x="35" y="65" width="6" height="6" fill="currentColor" />
                        <rect x="45" y="65" width="6" height="6" fill="currentColor" />
                        <rect x="55" y="65" width="6" height="6" fill="currentColor" />
                        <rect x="65" y="65" width="6" height="6" fill="currentColor" />

                        <rect x="35" y="75" width="6" height="6" fill="currentColor" />
                        <rect x="55" y="75" width="6" height="6" fill="currentColor" />
                        <rect x="75" y="75" width="6" height="6" fill="currentColor" />

                        <rect x="45" y="85" width="6" height="6" fill="currentColor" />
                        <rect x="65" y="85" width="6" height="6" fill="currentColor" />
                        <rect x="85" y="85" width="6" height="6" fill="currentColor" />
                      </svg>

                      {/* Center Brand Badge */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-lg bg-brand-orange text-white flex items-center justify-center font-black text-[10px] shadow-md border-2 border-white">
                          DAGO
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-slate-500 pt-1 font-bold">
                      REF: {activeItem.itemCode}
                    </span>
                  </div>

                  {/* Webhook Status Pulse Indicator */}
                  <div className="flex items-center space-x-2 text-[11px] text-slate-600 bg-white px-3 py-1.5 rounded-full border border-slate-200">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="font-medium">Menunggu notifikasi pembayaran dari jaringan perbankan...</span>
                  </div>

                  <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                    Buka aplikasi <strong>BCA, Livin&apos;, GoPay, OVO, Dana, ShopeePay</strong> atau m-Banking Anda, lalu scan QRIS di atas.
                  </p>
                </div>
              )}

              {/* Order / Booking Summary */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1.5">
                <span className="font-bold text-slate-800 block">
                  Rincian {activeItem.type === "COWORKING" ? "Booking Ruang Kerja" : "Menu Pesanan"}
                </span>
                <div className="space-y-1 divide-y divide-slate-100 max-h-28 overflow-y-auto">
                  {activeItem.itemsBreakdown?.map((it, idx) => (
                    <div key={idx} className="pt-1 flex justify-between text-slate-600">
                      <span>{it.qty ? `${it.qty}x ` : ""}{it.label}</span>
                      <span className="font-bold text-slate-900">{formatCurrencyIDR(it.price)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ACTION BUTTONS: PROMINENT QRIS SIMULATION BUTTON */}
              <div className="space-y-2 pt-2">
                {/* 1. Big Eye-catching Simulation Trigger */}
                <Button
                  onClick={handleSimulateWebhookSuccess}
                  disabled={isVerifying}
                  className="w-full h-12 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-2 transition-all hover:scale-[1.02] active:scale-98 border border-emerald-400/40"
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
                      <span>Memproses Notifikasi Webhook QRIS...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-300 fill-amber-300 animate-pulse mr-1" />
                      <span>SIMULASI BAYAR QRIS BERHASIL (KLIK DISINI)</span>
                      <CheckCircle2 className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
                <p className="text-[10px] text-slate-400 text-center">
                  *Klik tombol hijau di atas untuk mensimulasikan pembayaran lunas dari gateway/m-Banking.
                </p>

                {/* 2. Cancellation Action */}
                {showCancelConfirm ? (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-xs text-rose-900 animate-in fade-in">
                    <p className="font-bold">Konfirmasi Batalkan {activeItem.type === "COWORKING" ? "Booking Ini" : "Pesanan Ini"}?</p>
                    <p className="text-[11px] text-rose-700">
                      {activeItem.itemCode} akan dibatalkan dan alokasi meja/ruangan akan dibebaskan.
                    </p>
                    <div className="flex space-x-2 justify-end pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCancelConfirm(false)}
                        className="h-8 text-xs border-slate-300"
                      >
                        Kembali
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onCancelPayment({ type: activeItem.type, id: activeItem.id })}
                        className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
                      >
                        Ya, Batalkan
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCancelConfirm(true)}
                    className="w-full h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold rounded-xl"
                  >
                    Batalkan {activeItem.type === "COWORKING" ? "Booking" : "Pesanan"} Ini
                  </Button>
                )}
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
}
