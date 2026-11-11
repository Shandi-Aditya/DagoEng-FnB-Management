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
  AlertTriangle,
  RotateCcw,
  Lock,
  KeyRound,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  QRISVerificationDetail,
} from "@/lib/qris-verification";
import { useActivityLog } from "@/contexts/ActivityLogContext";

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
    qrisVerification?: QRISVerificationDetail;
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
  const { logActivity } = useActivityLog();
  const [activeTab, setActiveTab] = useState<POSPaymentMethod>("QRIS");

  // Cash Tab States (POS-29: initialized empty to prevent auto-fill)
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [cashInputRaw, setCashInputRaw] = useState<string>("");

  // QRIS Tab States
  const [qrisSecondsLeft, setQrisSecondsLeft] = useState<number>(120);
  const [isQrisProcessing, setIsQrisProcessing] = useState<boolean>(false);
  const [isGatewayVerified, setIsGatewayVerified] = useState<boolean>(false);
  const [gatewayTxId, setGatewayTxId] = useState<string>("");
  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState<boolean>(false);

  // Supervisor Manual QRIS Override States
  const [showSupervisorAuth, setShowSupervisorAuth] = useState<boolean>(false);
  const [supervisorPin, setSupervisorPin] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [supervisorNote, setSupervisorNote] = useState<string>("");
  const [supervisorAuthError, setSupervisorAuthError] = useState<string | null>(null);
  const [supervisorOverrideData, setSupervisorOverrideData] = useState<QRISVerificationDetail | null>(null);

  // EDC Tab States
  const [selectedBank, setSelectedBank] = useState<string>("BCA");
  const [approvalCode, setApprovalCode] = useState<string>("");

  // Split Bill Tab States
  const [splitGuestCount, setSplitGuestCount] = useState<number>(2);
  const [splitGuests, setSplitGuests] = useState<SplitGuestBill[]>([]);

  useEffect(() => {
    if (isOpen) {
      const newTxId = `GW-DAGO-${Date.now().toString().slice(-6)}`;
      // POS-29: Leave cash input empty to prevent accidental auto-fill of exact change
      setCashGiven(0);
      setCashInputRaw("");
      setQrisSecondsLeft(120);
      setIsGatewayVerified(false);
      setGatewayTxId(newTxId);
      setIsSimulatingWebhook(false);
      setShowSupervisorAuth(false);
      setSupervisorPin("");
      setReferenceNumber("");
      setSupervisorNote("");
      setSupervisorAuthError(null);
      setSupervisorOverrideData(null);
      setApprovalCode(`APP-${Math.floor(100000 + Math.random() * 900000)}`);

      if (grandTotal > 0) {
        fetch("/api/pos/qris/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "INIT",
            invoiceNumber: newTxId,
            expectedAmount: grandTotal,
          }),
        }).catch(() => {});
      }

      // Initialize Equal Split for 2 guests
      const perGuest = Math.floor(grandTotal / 2);
      setSplitGuests([
        { id: "g-1", guestLabel: "Tamu 1 (Guest A)", assignedAmount: perGuest, paymentMethod: "QRIS", isPaid: true },
        { id: "g-2", guestLabel: "Tamu 2 (Guest B)", assignedAmount: grandTotal - perGuest, paymentMethod: "CASH", isPaid: true },
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

  // Handle Split guest count change (Equal Split)
  const handleSplitCountChange = (count: number) => {
    setSplitGuestCount(count);
    const perGuest = Math.floor(grandTotal / count);
    const remainder = grandTotal - perGuest * count;

    const defaultMethods: ("QRIS" | "CASH" | "EDC")[] = ["QRIS", "CASH", "EDC", "QRIS", "CASH"];
    const newGuests: SplitGuestBill[] = Array.from({ length: count }, (_, idx) => ({
      id: `g-${idx + 1}`,
      guestLabel: `Tamu ${idx + 1} (Guest ${String.fromCharCode(65 + idx)})`,
      assignedAmount: idx === 0 ? perGuest + remainder : perGuest,
      paymentMethod: defaultMethods[idx % defaultMethods.length],
      isPaid: true,
    }));
    setSplitGuests(newGuests);
  };

  const handleToggleGuestPaid = (guestId: string) => {
    setSplitGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, isPaid: !g.isPaid } : g))
    );
  };

  const handleGuestAmountChange = (guestId: string, amount: number) => {
    setSplitGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, assignedAmount: Math.max(0, amount) } : g))
    );
  };

  const handleGuestMethodChange = (guestId: string, method: "QRIS" | "CASH" | "EDC") => {
    setSplitGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, paymentMethod: method } : g))
    );
  };

  // Split calculation helpers
  const splitTotalAssigned = splitGuests.reduce((sum, g) => sum + g.assignedAmount, 0);
  const splitRemaining = grandTotal - splitTotalAssigned;
  const isSplitBalanced = splitTotalAssigned === grandTotal;
  const isAllGuestsPaid = splitGuests.every((g) => g.isPaid);
  const isSplitValid = isSplitBalanced && isAllGuestsPaid;

  // Cash Change Calculation
  const changeDue = Math.max(0, cashGiven - grandTotal);
  const isCashSufficient = cashGiven >= grandTotal;

  // QRIS Verification status
  const isQrisVerified = isGatewayVerified || Boolean(supervisorOverrideData);

  // Poll server-side QRIS gateway status while waiting for webhook
  useEffect(() => {
    if (!isOpen || activeTab !== "QRIS" || isQrisVerified || !gatewayTxId) return;
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/pos/qris/verify?invoiceNumber=${encodeURIComponent(gatewayTxId)}&expectedAmount=${Math.round(grandTotal)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data?.verified && data.session) {
          if (data.session.status === "VERIFIED_WEBHOOK") {
            setIsGatewayVerified(true);
          } else if (data.session.status === "VERIFIED_SUPERVISOR") {
            setSupervisorOverrideData({
              type: "SUPERVISOR_MANUAL",
              referenceNumber: data.session.rrn || data.session.invoiceNumber,
              invoiceNumber: data.session.invoiceNumber,
              supervisorPinVerified: true,
              verifiedAt: data.session.verifiedAt || data.session.updatedAt,
              note: "Otorisasi Manual QRIS Statis oleh Supervisor",
            });
          }
        }
      } catch {}
    }, 3000);
    return () => clearInterval(pollInterval);
  }, [isOpen, activeTab, isQrisVerified, gatewayTxId]);

  const handleCheckGatewayStatus = async () => {
    if (!gatewayTxId) return;
    setIsSimulatingWebhook(true);
    try {
      const res = await fetch(
        `/api/pos/qris/verify?invoiceNumber=${encodeURIComponent(gatewayTxId)}&expectedAmount=${Math.round(grandTotal)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.verified) {
          setIsGatewayVerified(true);
          setSupervisorOverrideData(null);
        }
      }
    } catch {
      // Ignore network poll errors
    } finally {
      setIsSimulatingWebhook(false);
    }
  };

  const handleAuthorizeSupervisor = async () => {
    setSupervisorAuthError(null);
    try {
      const res = await fetch("/api/pos/qris/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "SUPERVISOR_OVERRIDE",
          pin: supervisorPin,
          referenceNumber,
          note: supervisorNote || `QRIS Statis Meja ${tableNumber}`,
          invoiceNumber: gatewayTxId,
          expectedAmount: grandTotal,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.allowed || !data.verification) {
        setSupervisorAuthError(data.error || "Otorisasi supervisor ditolak oleh server.");
        return;
      }

      setSupervisorOverrideData({ ...data.verification, invoiceNumber: data.verification.invoiceNumber || gatewayTxId });
      setShowSupervisorAuth(false);

      logActivity({
        module: "POS",
        action: "QRIS_SUPERVISOR_MANUAL_OVERRIDE",
        description: `Otorisasi manual pembayaran QRIS Statis Rp ${grandTotal.toLocaleString("id-ID")} untuk ${customerName || "Pelanggan"} (${orderType === "DINE_IN" ? "Meja " + tableNumber : "Takeaway"}). Ref RRN: ${referenceNumber}`,
        category: "TRANSACTION",
        severity: "HIGH",
        metadata: {
          grandTotal,
          referenceNumber,
          tableNumber,
          note: supervisorNote,
          timestamp: data.verification.verifiedAt,
        },
      });
    } catch {
      setSupervisorAuthError("Gagal menghubungi server verifikasi QRIS.");
    }
  };

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
      if (!isQrisVerified) return;
      setIsQrisProcessing(true);
      setTimeout(() => {
        setIsQrisProcessing(false);
        const qrisData: QRISVerificationDetail = supervisorOverrideData || {
          type: "GATEWAY_WEBHOOK",
          referenceNumber: gatewayTxId,
          invoiceNumber: gatewayTxId,
          verifiedAt: new Date().toISOString(),
          note: "Auto-verified via DagoPay / DOKU QRIS Webhook",
        };
        onPaymentSuccess({
          method: "QRIS",
          amountPaid: grandTotal,
          changeDue: 0,
          qrisVerification: qrisData,
        });
      }, 400);
    } else if (activeTab === "EDC") {
      onPaymentSuccess({
        method: "EDC",
        amountPaid: grandTotal,
        changeDue: 0,
      });
    } else if (activeTab === "SPLIT") {
      if (!isSplitValid) return;
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-900 text-white">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-primary dark:text-primary-light uppercase tracking-wider">
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
        <div className="grid grid-cols-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("QRIS")}
            className={`py-3 px-2 flex items-center justify-center space-x-1.5 border-b-2 transition-all ${
              activeTab === "QRIS"
                ? "border-primary bg-white dark:bg-slate-900 text-primary dark:text-primary-light shadow-xs"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
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
                ? "border-primary bg-white dark:bg-slate-900 text-primary dark:text-primary-light shadow-xs"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
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
                ? "border-primary bg-white dark:bg-slate-900 text-primary dark:text-primary-light shadow-xs"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
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
                ? "border-primary bg-white dark:bg-slate-900 text-primary dark:text-primary-light shadow-xs"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Split Bill</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
          {/* TAB 1: QRIS DINAMIS & STATIS DENGAN VERIFIKASI */}
          {activeTab === "QRIS" && (
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-2">
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border-2 border-dashed border-primary/40 shadow-md relative">
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
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-lg">
                      <QrCode className="w-8 h-8 text-primary" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-center space-x-1.5 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>
                    Masa berlaku QR: <strong className="font-mono text-slate-900 dark:text-slate-100">{qrisSecondsLeft}s</strong>
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Didukung oleh QRIS Nasional • DagoPay Gateway (NMID: ID1020260914)
                </p>
              </div>

              {/* Status Box */}
              {!isQrisVerified ? (
                <div className="w-full max-w-md p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60 text-left space-y-2">
                  <div className="flex items-start space-x-2">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        Menunggu Notifikasi Gateway QRIS
                      </h4>
                      <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                        Kasir dilarang menandai lunas manual tanpa webhook gateway atau PIN supervisor (POS-25).
                      </p>
                    </div>
                  </div>

                  {/* Server status check & Supervisor override actions */}
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-amber-200/80 dark:border-amber-800/60">
                    <button
                      type="button"
                      disabled={isSimulatingWebhook}
                      onClick={handleCheckGatewayStatus}
                      className="px-2.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center space-x-1.5 shadow-xs transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSimulatingWebhook ? "animate-spin text-amber-600" : ""}`} />
                      <span>{isSimulatingWebhook ? "Memeriksa Status Server..." : "Cek Status Gateway DagoPay"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowSupervisorAuth((prev) => !prev)}
                      className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold flex items-center space-x-1.5 shadow-xs transition-colors ml-auto"
                    >
                      <Lock className="w-3 h-3" />
                      <span>{showSupervisorAuth ? "Tutup Form PIN" : "Otorisasi Manual QRIS Statis"}</span>
                    </button>
                  </div>
                </div>
              ) : isGatewayVerified ? (
                <div className="w-full max-w-md p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 text-left flex items-start space-x-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <span className="font-bold text-emerald-900 dark:text-emerald-200 block">
                      Pembayaran QRIS Terverifikasi Gateway!
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block font-mono">
                      Ref DagoPay: {gatewayTxId} • Status: SETTLED
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-md p-3.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-300 dark:border-blue-800 text-left flex items-start space-x-2.5">
                  <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <span className="font-bold text-blue-900 dark:text-blue-200 block">
                      Otorisasi QRIS Statis Disetujui (PIN Supervisor OK)
                    </span>
                    <span className="text-[11px] text-blue-700 dark:text-blue-300 block font-mono">
                      RRN / Ref: {supervisorOverrideData?.referenceNumber} • Diaudit Sesuai SOP
                    </span>
                  </div>
                </div>
              )}

              {/* Form Input Otorisasi Supervisor */}
              {showSupervisorAuth && !isQrisVerified && (
                <div className="w-full max-w-md p-4 bg-slate-50 dark:bg-slate-800/90 rounded-2xl border-2 border-primary/30 text-left space-y-3 animate-in fade-in zoom-in-95 duration-150 shadow-lg">
                  <div className="flex items-center space-x-2 pb-1 border-b border-slate-200 dark:border-slate-700">
                    <KeyRound className="w-4 h-4 text-primary" />
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Otorisasi QRIS Statis oleh Supervisor
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Gunakan bila tamu membayar via QRIS statis meja/kasir. Membutuhkan PIN supervisor & nomor referensi struk bank.
                  </p>

                  {supervisorAuthError && (
                    <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] flex items-center space-x-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{supervisorAuthError}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        PIN Supervisor:
                      </label>
                      <input
                        type="password"
                        maxLength={6}
                        value={supervisorPin}
                        onChange={(e) => setSupervisorPin(e.target.value)}
                        placeholder="Masukkan PIN Supervisor Resmi"
                        className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Nomor Referensi Bank (RRN / Ref ID):
                      </label>
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="Contoh: RRN-20261109-001 (Lihat struk m-banking)"
                        className="w-full px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Catatan Manual (Opsional):
                      </label>
                      <input
                        type="text"
                        value={supervisorNote}
                        onChange={(e) => setSupervisorNote(e.target.value)}
                        placeholder="Contoh: QRIS Statis Meja 4 / Mandiri Livin"
                        className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowSupervisorAuth(false)}
                      className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Batal
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAuthorizeSupervisor}
                      className="text-xs bg-primary hover:bg-primary/90 text-white font-bold h-8 px-3"
                    >
                      Verifikasi & Setujui
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TUNAI (CASH) */}
          {activeTab === "CASH" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cash Input */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
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
                      className="w-full pl-9 pr-3 py-2.5 text-base font-bold font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="0"
                    />
                  </div>

                  {/* Shortcuts */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Uang Pas & Rekomendasi:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {quickDenominations.map((denom, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleCashShortcut(denom)}
                          className={`p-2 rounded-lg border text-xs font-mono font-bold transition-all ${
                            cashGiven === denom
                              ? "bg-primary text-white border-primary shadow-xs"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {denom === grandTotal ? "Uang Pas" : formatCurrencyIDR(denom)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Change Due Display */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Uang Kembalian (Change Due):
                    </span>
                    <div className={`text-2xl font-black font-mono mt-1 ${isCashSufficient ? "text-primary dark:text-primary-light" : "text-rose-500"}`}>
                      {isCashSufficient ? formatCurrencyIDR(changeDue) : "Uang Kurang"}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs border-t border-slate-200 dark:border-slate-700 pt-2 text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>Total Tagihan:</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatCurrencyIDR(grandTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Uang Diterima:</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatCurrencyIDR(cashGiven)}</span>
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
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Pilih Mesin EDC / Bank Kartu:</label>
                <div className="grid grid-cols-4 gap-2">
                  {["BCA", "Mandiri", "BRI", "BNI"].map((bank) => (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => setSelectedBank(bank)}
                      className={`p-2.5 rounded-xl border font-bold text-xs transition-all ${
                        selectedBank === bank
                          ? "bg-primary text-white border-primary shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {bank}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Nomor Approval Code dari Struk EDC:
                </label>
                <input
                  type="text"
                  value={approvalCode}
                  onChange={(e) => setApprovalCode(e.target.value)}
                  placeholder="Contoh: APP-782910"
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[11px] text-slate-400">
                  Gesek kartu pelanggan di mesin EDC {selectedBank}, lalu masukkan 6 digit kode otorisasi transaksi.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: SPLIT BILL (Enhanced with Custom Allocation & Multi-Methods) */}
          {activeTab === "SPLIT" && (
            <div className="space-y-4">
              {/* Header: Equal Split Presets */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Bagi Tagihan & Metode Pembayaran</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Atur nominal dan metode bayar untuk masing-masing tamu</p>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-[11px] text-slate-400 font-semibold">Bagi Rata:</span>
                  <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700">
                    {[2, 3, 4, 5].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => handleSplitCountChange(cnt)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold font-mono transition-all ${
                          splitGuestCount === cnt
                            ? "bg-primary text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Real-time Allocation Summary Card */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Tagihan</span>
                  <span className="font-mono font-black text-slate-900 dark:text-slate-100">{formatCurrencyIDR(grandTotal)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Dialokasikan</span>
                  <span className={`font-mono font-black ${isSplitBalanced ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {formatCurrencyIDR(splitTotalAssigned)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Sisa Alokasi</span>
                  <span className={`font-mono font-black ${splitRemaining === 0 ? "text-emerald-600 dark:text-emerald-400" : splitRemaining < 0 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {formatCurrencyIDR(splitRemaining)}
                  </span>
                </div>
              </div>

              {/* Warning Alert if allocation does not match grand total */}
              {!isSplitBalanced && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 flex items-center space-x-2 text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    {splitRemaining > 0
                      ? `Alokasi pembayaran masih kurang ${formatCurrencyIDR(splitRemaining)}.`
                      : `Alokasi pembayaran melebihi total tagihan sebesar ${formatCurrencyIDR(Math.abs(splitRemaining))}.`}
                  </span>
                </div>
              )}

              {/* Guest Rows */}
              <div className="space-y-2.5">
                {splitGuests.map((guest) => (
                  <div
                    key={guest.id}
                    className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
                      guest.isPaid
                        ? "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <button
                          type="button"
                          onClick={() => handleToggleGuestPaid(guest.id)}
                          className={`w-5 h-5 rounded-md flex items-center justify-center border text-xs transition-colors ${
                            guest.isPaid
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "border-slate-300 dark:border-slate-600 hover:border-slate-400 bg-white dark:bg-slate-700"
                          }`}
                        >
                          {guest.isPaid && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{guest.guestLabel}</span>
                      </div>

                      {/* Payment Method Selector */}
                      <div className="flex items-center space-x-1">
                        {(["QRIS", "CASH", "EDC"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleGuestMethodChange(guest.id, m)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                              guest.paymentMethod === m
                                ? "bg-primary text-white"
                                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Assigned Amount Input */}
                    <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100/80 dark:border-slate-700/80">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Nominal Pembayaran:</span>
                      <div className="relative w-40">
                        <span className="absolute left-2.5 top-1.5 text-[11px] font-bold text-slate-400">Rp</span>
                        <input
                          type="number"
                          value={guest.assignedAmount}
                          onChange={(e) => handleGuestAmountChange(guest.id, Number(e.target.value))}
                          className="w-full pl-8 pr-2 py-1 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-right focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer: Confirm Payment Button */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs font-semibold dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Batal
          </Button>

          <Button
            type="button"
            disabled={
              (activeTab === "CASH" && !isCashSufficient) ||
              (activeTab === "SPLIT" && !isSplitValid) ||
              (activeTab === "QRIS" && !isQrisVerified) ||
              isQrisProcessing
            }
            onClick={handleCompletePayment}
            className={`flex-1 text-xs font-bold h-11 space-x-2 shadow-md ${
              (activeTab === "SPLIT" && !isSplitValid) || (activeTab === "QRIS" && !isQrisVerified)
                ? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                : "bg-primary hover:bg-primary/90 text-white"
            }`}
          >
            {isQrisProcessing ? (
              <span>Memproses Transaksi...</span>
            ) : activeTab === "QRIS" && !isQrisVerified ? (
              <span className="flex items-center space-x-2">
                <Clock className="w-4 h-4 animate-spin text-amber-500" />
                <span>Menunggu Pembayaran Tamu (QRIS) — {formatCurrencyIDR(grandTotal)}</span>
              </span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {activeTab === "QRIS"
                    ? `Selesaikan QRIS (${supervisorOverrideData ? "Otorisasi Supervisor" : "Terverifikasi Gateway"}) — ${formatCurrencyIDR(grandTotal)}`
                    : `Konfirmasi Pembayaran (${activeTab}) — ${formatCurrencyIDR(grandTotal)}`}
                </span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
