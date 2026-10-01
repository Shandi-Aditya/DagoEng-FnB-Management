"use client";

import React, { useState, useEffect } from "react";
import { POSCartItem, POSPaymentMethod, SplitGuestBill } from "./types";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  X,
  QrCode,
  Banknote,
  CreditCard,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: POSCartItem[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  discount: number;
  grandTotal: number;
  tableNumber: string;
  customerName: string;
  orderType: "DINE_IN" | "TAKEAWAY";
  onPaymentSuccess: (paymentData: {
    method: POSPaymentMethod;
    amountPaid: number;
    changeDue: number;
    splitDetails?: SplitGuestBill[];
  }) => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  cartItems,
  subtotal,
  tax,
  serviceCharge,
  discount,
  grandTotal,
  tableNumber,
  customerName,
  orderType,
  onPaymentSuccess,
}: PaymentModalProps) {
  const [activeTab, setActiveTab] = useState<POSPaymentMethod>("QRIS");

  // Cash Tab States
  const [cashGiven, setCashGiven] = useState<number>(grandTotal);
  const [cashInputRaw, setCashInputRaw] = useState<string>(grandTotal.toString());

  // QRIS Tab States
  const [qrisSecondsLeft, setQrisSecondsLeft] = useState<number>(120);
  const [isQrisProcessing, setIsQrisProcessing] = useState<boolean>(false);

  // EDC Tab States
  const [selectedBank, setSelectedBank] = useState<string>("BCA");
  const [approvalCode, setApprovalCode] = useState<string>("");

  // Split Bill Tab States
  const [splitGuestCount, setSplitGuestCount] = useState<number>(2);
  const [splitGuests, setSplitGuests] = useState<SplitGuestBill[]>([]);

  useEffect(() => {
    if (isOpen) {
      setCashGiven(grandTotal);
      setCashInputRaw(grandTotal.toString());
      setQrisSecondsLeft(120);
      setApprovalCode(`APP-${Math.floor(100000 + Math.random() * 900000)}`);

      // Initialize Equal Split for 2 guests
      const perGuest = Math.ceil(grandTotal / 2);
      setSplitGuests([
        { id: "g-1", guestLabel: "Tamu 1 (Guest A)", assignedAmount: perGuest, paymentMethod: "QRIS", isPaid: false },
        { id: "g-2", guestLabel: "Tamu 2 (Guest B)", assignedAmount: grandTotal - perGuest, paymentMethod: "CASH", isPaid: false },
      ]);
    }
  }, [isOpen, grandTotal]);

  // QRIS Countdown Timer
  useEffect(() => {
    if (!isOpen || activeTab !== "QRIS") return;
    const timer = setInterval(() => {
      setQrisSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // Handle Split guest count change
  const handleSplitCountChange = (count: number) => {
    setSplitGuestCount(count);
    const perGuest = Math.floor(grandTotal / count);
    const remainder = grandTotal - perGuest * count;

    const newGuests: SplitGuestBill[] = Array.from({ length: count }, (_, idx) => ({
      id: `g-${idx + 1}`,
      guestLabel: `Tamu ${idx + 1} (Guest ${String.fromCharCode(65 + idx)})`,
      assignedAmount: idx === 0 ? perGuest + remainder : perGuest,
      paymentMethod: "QRIS",
      isPaid: false,
    }));
    setSplitGuests(newGuests);
  };

  const handleToggleGuestPaid = (guestId: string) => {
    setSplitGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, isPaid: !g.isPaid } : g))
    );
  };

  // Cash Change Calculation
  const changeDue = Math.max(0, cashGiven - grandTotal);
  const isCashSufficient = cashGiven >= grandTotal;

  const handleCashShortcut = (amount: number) => {
    setCashGiven(amount);
    setCashInputRaw(amount.toString());
  };

  const handleCustomCashInput = (val: string) => {
    const num = parseInt(val.replace(/\D/g, ""), 10) || 0;
    setCashInputRaw(val);
    setCashGiven(num);
  };

  const handleCompletePayment = () => {
    if (activeTab === "CASH") {
      if (!isCashSufficient) return;
      onPaymentSuccess({
        method: "CASH",
        amountPaid: cashGiven,
        changeDue,
      });
    } else if (activeTab === "QRIS") {
      setIsQrisProcessing(true);
      setTimeout(() => {
        setIsQrisProcessing(false);
        onPaymentSuccess({
          method: "QRIS",
          amountPaid: grandTotal,
          changeDue: 0,
        });
      }, 500);
    } else if (activeTab === "EDC") {
      onPaymentSuccess({
        method: "EDC",
        amountPaid: grandTotal,
        changeDue: 0,
      });
    } else if (activeTab === "SPLIT") {
      onPaymentSuccess({
        method: "SPLIT",
        amountPaid: grandTotal,
        changeDue: 0,
        splitDetails: splitGuests,
      });
    }
  };

  // Recommended Quick Cash Denominations
  const quickDenominations = [
    grandTotal, // Uang Pas
    Math.ceil(grandTotal / 50000) * 50000,
    Math.ceil(grandTotal / 100000) * 100000,
    (Math.ceil(grandTotal / 100000) + 1) * 100000,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= grandTotal);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-brand-orange uppercase tracking-wider">
                Pembayaran Kasir POS
              </span>
              <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                {orderType === "DINE_IN" ? `Meja ${tableNumber}` : "Takeaway"}
              </span>
            </div>
            <h3 className="font-extrabold text-xl text-white mt-0.5">
              Total Tagihan: {formatCurrencyIDR(grandTotal)}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Payment Tabs Navigation */}
        <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("QRIS")}
            className={`py-3 px-2 flex items-center justify-center space-x-1.5 border-b-2 transition-all ${
              activeTab === "QRIS"
                ? "border-brand-orange bg-white text-brand-orange shadow-sm"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>QRIS Dinamis</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("CASH")}
            className={`py-3 px-2 flex items-center justify-center space-x-1.5 border-b-2 transition-all ${
              activeTab === "CASH"
                ? "border-brand-orange bg-white text-brand-orange shadow-sm"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>Tunai (Cash)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("EDC")}
            className={`py-3 px-2 flex items-center justify-center space-x-1.5 border-b-2 transition-all ${
              activeTab === "EDC"
                ? "border-brand-orange bg-white text-brand-orange shadow-sm"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Debit / EDC</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("SPLIT")}
            className={`py-3 px-2 flex items-center justify-center space-x-1.5 border-b-2 transition-all ${
              activeTab === "SPLIT"
                ? "border-brand-orange bg-white text-brand-orange shadow-sm"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Split Bill</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: QRIS DINAMIS */}
          {activeTab === "QRIS" && (
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-2">
              <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-brand-orange shadow-md relative">
                {/* Simulated dynamic QR code pattern */}
                <div className="w-44 h-44 bg-slate-900 rounded-xl p-2 flex flex-col items-center justify-center text-white relative overflow-hidden">
                  <div className="grid grid-cols-6 gap-1 w-full h-full p-1 opacity-90">
                    {Array.from({ length: 36 }).map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-sm ${
                          (i % 2 === 0 || i % 7 === 0 || i < 6) ? "bg-white" : "bg-slate-800"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="p-2 bg-white rounded-lg shadow-lg">
                      <QrCode className="w-8 h-8 text-brand-orange" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-center space-x-1.5 text-xs text-slate-600 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    Masa berlaku QR: <strong className="font-mono text-slate-900">{qrisSecondsLeft}s</strong>
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Didukung oleh QRIS Nasional • DagoPay Gateway (NMID: ID1020260914)
                </p>
              </div>

              <div className="w-full max-w-sm p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-left flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800">
                  Pembayaran akan terdeteksi otomatis. Klik tombol di bawah untuk simulasi konfirmasi instan webhook QRIS.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: TUNAI (CASH) */}
          {activeTab === "CASH" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cash Input */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800">
                    Jumlah Uang Tunai Diterima:
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="text"
                      value={cashInputRaw}
                      onChange={(e) => handleCustomCashInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-base font-bold font-mono border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange"
                      placeholder="0"
                    />
                  </div>

                  {/* Shortcuts */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">Uang Pas & Rekomendasi:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {quickDenominations.map((denom, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleCashShortcut(denom)}
                          className={`p-2 rounded-lg border text-xs font-mono font-bold transition-all ${
                            cashGiven === denom
                              ? "bg-brand-orange text-white border-brand-orange shadow-sm"
                              : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                          }`}
                        >
                          {denom === grandTotal ? "Uang Pas" : formatCurrencyIDR(denom)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Change Due Display */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Uang Kembalian (Change Due):
                    </span>
                    <div className={`text-2xl font-black font-mono mt-1 ${isCashSufficient ? "text-brand-green" : "text-rose-500"}`}>
                      {isCashSufficient ? formatCurrencyIDR(changeDue) : "Uang Kurang"}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs border-t border-slate-200 pt-2 text-slate-600">
                    <div className="flex justify-between">
                      <span>Total Tagihan:</span>
                      <span className="font-mono font-semibold">{formatCurrencyIDR(grandTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Uang Diterima:</span>
                      <span className="font-mono font-semibold">{formatCurrencyIDR(cashGiven)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DEBIT / EDC */}
          {activeTab === "EDC" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800">Pilih Mesin EDC / Bank Kartu:</label>
                <div className="grid grid-cols-4 gap-2">
                  {["BCA", "Mandiri", "BRI", "BNI"].map((bank) => (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => setSelectedBank(bank)}
                      className={`p-2.5 rounded-xl border font-bold text-xs transition-all ${
                        selectedBank === bank
                          ? "bg-brand-cyan text-white border-brand-cyan shadow-sm"
                          : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                      }`}
                    >
                      {bank}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800">
                  Nomor Approval Code dari Struk EDC:
                </label>
                <input
                  type="text"
                  value={approvalCode}
                  onChange={(e) => setApprovalCode(e.target.value)}
                  placeholder="Contoh: APP-782910"
                  className="w-full px-3 py-2 text-xs font-mono font-bold border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan"
                />
                <p className="text-[11px] text-slate-400">
                  Gesek kartu pelanggan di mesin EDC {selectedBank}, lalu masukkan 6 digit kode otorisasi transaksi.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: SPLIT BILL */}
          {activeTab === "SPLIT" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Bagi Tagihan Rata (Equal Split)</h4>
                  <p className="text-[11px] text-slate-500">Bagi total tagihan sama rata ke sejumlah tamu</p>
                </div>
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
                  {[2, 3, 4, 5].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleSplitCountChange(cnt)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold font-mono transition-all ${
                        splitGuestCount === cnt
                          ? "bg-brand-orange text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {splitGuests.map((guest) => (
                  <div
                    key={guest.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      guest.isPaid
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <button
                        type="button"
                        onClick={() => handleToggleGuestPaid(guest.id)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center border text-xs ${
                          guest.isPaid
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-slate-300 hover:border-slate-400 bg-white"
                        }`}
                      >
                        {guest.isPaid && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                      <div>
                        <p className="text-xs font-bold">{guest.guestLabel}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {formatCurrencyIDR(guest.assignedAmount)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          guest.isPaid
                            ? "bg-emerald-200 text-emerald-900"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {guest.isPaid ? "SUDAH DIBAYAR" : "BELUM LUNAS"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer: Confirm Payment Button */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs font-semibold"
          >
            Batal
          </Button>

          <Button
            type="button"
            disabled={
              (activeTab === "CASH" && !isCashSufficient) ||
              isQrisProcessing
            }
            onClick={handleCompletePayment}
            className="flex-1 text-xs font-bold h-11 space-x-2 shadow-md bg-brand-orange hover:bg-orange-600 text-white"
          >
            {isQrisProcessing ? (
              <span>Memverifikasi QRIS...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Konfirmasi Pembayaran ({activeTab}) — {formatCurrencyIDR(grandTotal)}
                </span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
