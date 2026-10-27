"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Building,
  Check,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyIDR } from "@/lib/utils";

interface TransactionDetails {
  id: string;
  ticketCode: string;
  eventId: string;
  eventTitle: string;
  guestName: string;
  guestEmail: string;
  ticketCount: number;
  unitPrice: number;
  totalPrice: number;
  paymentStatus: "PENDING" | "PAID" | "CANCELLED";
  dokuInvoiceNumber: string;
}

export default function DokuCheckoutSimulatorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = (params?.token as string) || "";
  const invoiceParam = searchParams.get("invoice") || "";

  const [transaction, setTransaction] = useState<TransactionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<"QRIS" | "BCA_VA" | "CREDIT_CARD">("QRIS");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    fetchTransaction();
  }, [token, invoiceParam]);

  const fetchTransaction = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const query = new URLSearchParams();
      if (invoiceParam) query.set("invoice", invoiceParam);
      if (token) query.set("token", token);

      const res = await fetch(`/api/webhooks/doku/simulate?${query.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Transaksi DOKU tidak ditemukan.");
      }

      setTransaction(json.data);
      if (json.data.paymentStatus === "PAID") {
        setPaymentSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || "Gagal memuat detail tagihan.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulatePayment = async (status: "SUCCESS" | "FAILED") => {
    if (!transaction) return;

    try {
      setIsProcessing(true);
      const res = await fetch("/api/webhooks/doku/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: transaction.dokuInvoiceNumber || `INV-${transaction.ticketCode}`,
          status,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memproses simulasi pembayaran.");
      }

      if (status === "SUCCESS") {
        setPaymentSuccess(true);
        setTransaction((prev) => (prev ? { ...prev, paymentStatus: "PAID" } : null));
      } else {
        setTransaction((prev) => (prev ? { ...prev, paymentStatus: "CANCELLED" } : null));
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3 text-white">
          <RefreshCw className="w-8 h-8 animate-spin text-rose-500" />
          <span className="text-xs font-semibold tracking-wide">
            Menghubungkan ke DOKU Hosted Checkout Simulator...
          </span>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center text-white space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Tagihan Tidak Ditemukan</h2>
            <p className="text-xs text-slate-400 mt-1">{error || "Token atau invoice pembayaran tidak valid."}</p>
          </div>
          <Link href="/customer?tab=profile">
            <Button className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer">
              Kembali ke E-Tiket Saya
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col justify-between py-6 px-4 sm:px-6">
      {/* Top Header */}
      <div className="max-w-xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-red-500 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-rose-900/30">
            D
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-base tracking-wider text-white">DOKU</span>
              <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                SANDBOX SIMULATOR
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Hosted Payment Gateway Simulator</p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-full">
          <Lock className="w-3 h-3" />
          <span>256-Bit SSL</span>
        </div>
      </div>

      {/* Main Payment Container */}
      <div className="max-w-xl w-full mx-auto my-6 space-y-5">
        {paymentSuccess ? (
          /* Payment Success State */
          <div className="bg-slate-900/90 border border-emerald-500/50 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-black text-white">Pembayaran Sukses!</h2>
              <p className="text-xs text-slate-400">
                Transaksi Anda telah diverifikasi oleh DOKU Payment Gateway Sandbox.
              </p>
            </div>

            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">No. Invoice:</span>
                <span className="font-mono font-bold text-white">{transaction.dokuInvoiceNumber}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Kode Tiket:</span>
                <span className="font-mono font-bold text-emerald-400">{transaction.ticketCode}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Acara:</span>
                <span className="font-semibold text-white">{transaction.eventTitle}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-400">Total Dibayar:</span>
                <span className="font-black text-emerald-400 text-sm">
                  {formatCurrencyIDR(transaction.totalPrice)}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Link href={`/events/${transaction.eventId}`} className="flex-1">
                <Button className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold py-3 rounded-xl cursor-pointer shadow-md">
                  <span>Lihat E-Tiket Resmi (QR Aktif)</span>
                </Button>
              </Link>
              <Link href="/customer?tab=profile" className="flex-1">
                <Button
                  variant="outline"
                  className="w-full border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-bold py-3 rounded-xl cursor-pointer"
                >
                  <span>Portal Peserta</span>
                </Button>
              </Link>
            </div>
          </div>
        ) : transaction.paymentStatus === "CANCELLED" ? (
          /* Payment Cancelled State */
          <div className="bg-slate-900 border border-rose-500/50 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Pembayaran Dibatalkan</h2>
              <p className="text-xs text-slate-400 mt-1">
                Pemesanan tiket ini telah dibatalkan dalam simulator DOKU.
              </p>
            </div>
            <Link href={`/events/${transaction.eventId}`}>
              <Button className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold px-6 py-2.5 rounded-xl cursor-pointer">
                Pesan Ulang Tiket
              </Button>
            </Link>
          </div>
        ) : (
          /* Checkout Payment Form */
          <div className="space-y-5">
            {/* Order Summary Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Ringkasan Tagihan
                </span>
                <span className="font-mono text-xs text-rose-400 font-bold">
                  {transaction.dokuInvoiceNumber}
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-white leading-tight">
                  {transaction.eventTitle}
                </h3>
                <p className="text-xs text-slate-400">
                  {transaction.ticketCount}x Tiket Masuk • Atas Nama: {transaction.guestName}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Total Pembayaran:</span>
                <span className="text-2xl font-black text-rose-400">
                  {formatCurrencyIDR(transaction.totalPrice)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Pilih Metode Pembayaran (Simulasi DOKU)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedMethod("QRIS")}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between space-y-2 transition-all cursor-pointer ${
                    selectedMethod === "QRIS"
                      ? "bg-rose-950/40 border-rose-500 text-white"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <QrCode className="w-5 h-5 text-rose-400" />
                    {selectedMethod === "QRIS" && <Check className="w-4 h-4 text-rose-400" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-white">QRIS Sandbox</span>
                    <span className="text-[10px] text-slate-400">Instant QR</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod("BCA_VA")}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between space-y-2 transition-all cursor-pointer ${
                    selectedMethod === "BCA_VA"
                      ? "bg-rose-950/40 border-rose-500 text-white"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <Building className="w-5 h-5 text-rose-400" />
                    {selectedMethod === "BCA_VA" && <Check className="w-4 h-4 text-rose-400" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-white">Virtual Account</span>
                    <span className="text-[10px] text-slate-400">BCA / Mandiri</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod("CREDIT_CARD")}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between space-y-2 transition-all cursor-pointer ${
                    selectedMethod === "CREDIT_CARD"
                      ? "bg-rose-950/40 border-rose-500 text-white"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <CreditCard className="w-5 h-5 text-rose-400" />
                    {selectedMethod === "CREDIT_CARD" && <Check className="w-4 h-4 text-rose-400" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-white">Kartu Kredit</span>
                    <span className="text-[10px] text-slate-400">Visa / Mastercard</span>
                  </div>
                </button>
              </div>

              {/* Simulation Notice Banner */}
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-[11px] text-amber-300 leading-relaxed space-y-1">
                <span className="font-bold block text-amber-200">Mode Simulasi Pengujian Sandbox</span>
                <p>
                  Ini adalah antarmuka simulator gateway pembayaran DOKU DagoEng. Menekan tombol di bawah
                  akan mengirimkan Webhook DOKU resmi (HMAC-SHA256) ke sistem untuk mengonfirmasi pelunasan tiket secara otomatis.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2.5">
                <Button
                  disabled={isProcessing}
                  onClick={() => handleSimulatePayment("SUCCESS")}
                  className="w-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-sm py-3.5 rounded-2xl shadow-xl shadow-rose-950/50 cursor-pointer flex items-center justify-center space-x-2 transition-all hover:scale-[1.01]"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Bayar Sekarang (Simulasikan Lunas)</span>
                </Button>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleSimulatePayment("FAILED")}
                    className="text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    Simulasikan Pembayaran Gagal
                  </button>

                  <Link
                    href={`/events/${transaction.eventId}`}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Batal & Kembali
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="max-w-xl w-full mx-auto text-center text-[10px] text-slate-500 pt-6 border-t border-slate-900">
        DagoEng Event Marketplace • DOKU Hosted Checkout Simulator (Development & QA Environment)
      </div>
    </div>
  );
}
