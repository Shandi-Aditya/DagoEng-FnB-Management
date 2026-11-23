"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  KeyRound,
  Lock,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PaymentTabInvoice } from "./payment/PaymentTabInvoice";
import { PaymentTabSplit } from "./payment/PaymentTabSplit";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import type { QRISVerificationDetail } from "@/lib/qris-verification";
import type { CorporateBillingType } from "@/types/order";
import { cn, formatCurrencyIDR } from "@/lib/utils";

import {
  calculateCashChange,
  calculateSplitBalance,
  formatQrisCountdown,
  generateCashSuggestions,
  generateEqualSplitGuests,
} from "./pos-payment";
import type { POSCartItem, POSPaymentMethod, SplitGuestBill } from "./types";

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
  isCorporateOrder?: boolean;
  corporateBillingType?: CorporateBillingType;
  corporateCompany?: string;
  onPaymentSuccess: (paymentData: {
    method: POSPaymentMethod;
    amountPaid: number;
    changeDue: number;
    splitDetails?: SplitGuestBill[];
    qrisVerification?: QRISVerificationDetail;
  }) => void;
}

const EDC_BANKS = ["BCA", "Mandiri", "BRI", "BNI"] as const;

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
  isCorporateOrder = false,
  corporateBillingType = "PREPAID",
  corporateCompany = "",
  onPaymentSuccess,
}: PaymentModalProps) {
  const { logActivity } = useActivityLog();
  const [activeTab, setActiveTab] = useState<POSPaymentMethod>("QRIS");

  // Cash tab state (POS-29: initialized empty to prevent auto-fill)
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [cashInputRaw, setCashInputRaw] = useState<string>("");

  // QRIS tab state
  const [qrisSecondsLeft, setQrisSecondsLeft] = useState<number>(120);
  const [isQrisProcessing, setIsQrisProcessing] = useState<boolean>(false);
  const [isGatewayVerified, setIsGatewayVerified] = useState<boolean>(false);
  const [gatewayTxId, setGatewayTxId] = useState<string>("");
  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState<boolean>(false);

  // Supervisor manual QRIS override state
  const [showSupervisorAuth, setShowSupervisorAuth] = useState<boolean>(false);
  const [supervisorPin, setSupervisorPin] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [supervisorNote, setSupervisorNote] = useState<string>("");
  const [supervisorAuthError, setSupervisorAuthError] = useState<string | null>(null);
  const [supervisorOverrideData, setSupervisorOverrideData] = useState<QRISVerificationDetail | null>(null);

  // EDC tab state
  const [selectedBank, setSelectedBank] = useState<string>("BCA");
  const [approvalCode, setApprovalCode] = useState<string>("");

  // Split bill tab state
  const [splitGuestCount, setSplitGuestCount] = useState<number>(2);
  const [splitGuests, setSplitGuests] = useState<SplitGuestBill[]>([]);
  const isSubmittingRef = useRef<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (isCorporateOrder && corporateBillingType === "INVOICE") {
        setActiveTab("INVOICE");
      } else {
        setActiveTab("QRIS");
      }
      const newTxId = `GW-DAGO-${Date.now().toString().slice(-6)}`;
      // POS-29: Leave cash input empty to prevent accidental auto-fill of exact change
      setCashGiven(0);
      setCashInputRaw("");
      setQrisSecondsLeft(120);
      setIsQrisProcessing(false);
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
      isSubmittingRef.current = false;
      setIsSubmitting(false);

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

      setSplitGuests(generateEqualSplitGuests(grandTotal, 2));
      setSplitGuestCount(2);
    } else {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [isOpen, grandTotal]);

  // QRIS countdown timer
  const hasSplitQris = useMemo(
    () => splitGuests.some((g) => g.paymentMethod === "QRIS"),
    [splitGuests]
  );

  const splitQrisAmount = useMemo(
    () =>
      splitGuests
        .filter((g) => g.paymentMethod === "QRIS")
        .reduce((sum, g) => sum + (g.assignedAmount || 0), 0),
    [splitGuests]
  );

  useEffect(() => {
    if (!isOpen || (activeTab !== "QRIS" && !(activeTab === "SPLIT" && hasSplitQris))) return;
    const timer = setInterval(() => {
      setQrisSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, activeTab, hasSplitQris]);

  const quickDenominations = useMemo(
    () => generateCashSuggestions(grandTotal),
    [grandTotal]
  );

  const { changeDue, isSufficient: isCashSufficient } = useMemo(
    () => calculateCashChange(cashGiven, grandTotal),
    [cashGiven, grandTotal]
  );

  const splitBalance = useMemo(
    () => calculateSplitBalance(splitGuests, grandTotal),
    [splitGuests, grandTotal]
  );

  const isQrisVerified = isGatewayVerified || Boolean(supervisorOverrideData);

  // Poll server-side QRIS gateway status while waiting for webhook
  useEffect(() => {
    const needsQris = activeTab === "QRIS" || (activeTab === "SPLIT" && hasSplitQris);
    if (!isOpen || !needsQris || isQrisVerified || !gatewayTxId) return;
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
              note: "Otorisasi manual QRIS statis oleh supervisor",
            });
          }
        }
      } catch {}
    }, 3000);
    return () => clearInterval(pollInterval);
  }, [isOpen, activeTab, hasSplitQris, isQrisVerified, gatewayTxId, grandTotal]);

  if (!isOpen) return null;

  const handleSplitCountChange = (count: number) => {
    setSplitGuestCount(count);
    setSplitGuests(generateEqualSplitGuests(grandTotal, count));
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
    } catch {} finally {
      setIsSimulatingWebhook(false);
    }
  };

  const handleAuthorizeSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupervisorAuthError(null);
    try {
      const res = await fetch("/api/pos/qris/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "SUPERVISOR_OVERRIDE",
          pin: supervisorPin,
          referenceNumber,
          note: supervisorNote || `QRIS statis meja ${tableNumber}`,
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
        description: `Otorisasi manual pembayaran QRIS statis Rp ${grandTotal.toLocaleString("id-ID")} untuk ${customerName || "Pelanggan"} (${orderType === "DINE_IN" ? "Meja " + tableNumber : "Takeaway"}). Ref RRN: ${referenceNumber}`,
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
    if (isSubmittingRef.current || isQrisProcessing) return;

    if (activeTab === "CASH") {
      if (!isCashSufficient) return;
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      onPaymentSuccess({
        method: "CASH",
        amountPaid: cashGiven,
        changeDue,
      });
    } else if (activeTab === "QRIS") {
      if (!isQrisVerified) return;
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setIsQrisProcessing(true);
      setTimeout(() => {
        setIsQrisProcessing(false);
        const qrisData: QRISVerificationDetail = supervisorOverrideData || {
          type: "GATEWAY_WEBHOOK",
          referenceNumber: gatewayTxId,
          invoiceNumber: gatewayTxId,
          verifiedAt: new Date().toISOString(),
          note: "Terverifikasi otomatis via gateway QRIS",
        };
        onPaymentSuccess({
          method: "QRIS",
          amountPaid: grandTotal,
          changeDue: 0,
          qrisVerification: qrisData,
        });
      }, 400);
    } else if (activeTab === "EDC") {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      onPaymentSuccess({
        method: "EDC",
        amountPaid: grandTotal,
        changeDue: 0,
      });
    } else if (activeTab === "INVOICE") {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      logActivity({
        module: "POS",
        action: "CORPORATE_INVOICE_ISSUED",
        description: `Penerbitan invoice perusahaan ${corporateCompany || customerName}: ${formatCurrencyIDR(grandTotal)} (Tempo 14 hari)`,
        recordId: corporateCompany || customerName,
        newValue: `Tagihan diterbitkan: ${formatCurrencyIDR(grandTotal)}`,
      });
      onPaymentSuccess({
        method: "INVOICE",
        amountPaid: 0,
        changeDue: 0,
      });
    } else if (activeTab === "SPLIT") {
      if (!splitBalance.isValid) return;
      if (hasSplitQris && !isQrisVerified) return;
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      const splitQrisData: QRISVerificationDetail | undefined = hasSplitQris
        ? supervisorOverrideData || {
            type: "GATEWAY_WEBHOOK",
            referenceNumber: gatewayTxId,
            invoiceNumber: gatewayTxId,
            verifiedAt: new Date().toISOString(),
            note: "Terverifikasi otomatis via gateway QRIS (Bagi tagihan)",
          }
        : undefined;
      onPaymentSuccess({
        method: "SPLIT",
        amountPaid: grandTotal,
        changeDue: 0,
        splitDetails: splitGuests,
        qrisVerification: splitQrisData,
      });
    }
  };

  const renderQrisVerificationBlock = (displayAmount: number, titleLabel?: string) => (
    <div className="flex flex-col items-center justify-center space-y-4 py-2 text-center">
      {titleLabel ? (
        <div className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-left">
          <p className="font-medium text-foreground">{titleLabel}</p>
          <p className="text-muted-foreground">
            Nominal QRIS:{" "}
            <span className="font-mono font-medium tabular-nums text-foreground">
              {formatCurrencyIDR(displayAmount)}
            </span>
          </p>
        </div>
      ) : null}

      <div className="relative rounded-2xl border-2 border-dashed border-primary/40 bg-card p-4 shadow-xs">
        <div className="relative flex size-44 flex-col items-center justify-center overflow-hidden rounded-xl border bg-white p-2 text-foreground">
          <img
            src="/images/qris/qris-dago.jpeg"
            alt="QRIS Statis Dago"
            className="size-full object-contain"
          />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-medium">
          <Clock className="size-3.5 text-primary" />
          <span>
            Masa berlaku QR:{" "}
            <strong className="font-mono text-foreground">
              {formatQrisCountdown(qrisSecondsLeft)} ({qrisSecondsLeft}s)
            </strong>
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Didukung oleh QRIS Nasional &bull; Invoice ID: {gatewayTxId}
        </p>
      </div>

      {!isQrisVerified ? (
        <div className="w-full max-w-md space-y-2 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-left">
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 shrink-0 text-warning animate-pulse" />
            <div>
              <h4 className="text-xs font-semibold text-foreground">
                Menunggu notifikasi gateway QRIS
              </h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Kasir dilarang menandai lunas manual tanpa webhook gateway atau otorisasi PIN supervisor.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 border-t border-warning/20 pt-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSimulatingWebhook}
              onClick={handleCheckGatewayStatus}
              className="w-full justify-center"
            >
              <RefreshCw className={cn("size-3.5", isSimulatingWebhook && "animate-spin")} />
              <span>{isSimulatingWebhook ? "Memeriksa..." : "Cek status gateway"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSupervisorAuth((prev) => !prev)}
              className="w-full justify-center"
            >
              <Lock className="size-3.5" />
              <span>{showSupervisorAuth ? "Tutup otorisasi" : "Otorisasi manual PIN"}</span>
            </Button>
          </div>
        </div>
      ) : isGatewayVerified ? (
        <div className="flex w-full max-w-md items-start gap-2.5 rounded-xl border border-success/40 bg-success/10 p-3.5 text-left">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          <div className="flex-1 text-xs">
            <span className="block font-semibold text-foreground">
              Pembayaran QRIS terverifikasi gateway
            </span>
            <span className="block font-mono text-xs text-muted-foreground">
              Ref: {gatewayTxId} &bull; Status: Lunas
            </span>
          </div>
        </div>
      ) : (
        <div className="flex w-full max-w-md items-start gap-2.5 rounded-xl border border-info/40 bg-info/10 p-3.5 text-left">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info" />
          <div className="flex-1 text-xs">
            <span className="block font-semibold text-foreground">
              Otorisasi QRIS statis disetujui (PIN supervisor OK)
            </span>
            <span className="block font-mono text-xs text-muted-foreground">
              Ref RRN: {supervisorOverrideData?.referenceNumber} &bull; Tercatat di audit log
            </span>
          </div>
        </div>
      )}

      {showSupervisorAuth && !isQrisVerified && (
        <form
          onSubmit={handleAuthorizeSupervisor}
          className="w-full max-w-md space-y-3 rounded-xl border bg-muted/30 p-4 text-left shadow-xs"
        >
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <KeyRound className="size-4 text-primary" />
            <h4 className="text-xs font-semibold text-foreground">
              Otorisasi QRIS statis oleh supervisor
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Gunakan bila tamu membayar via QRIS statis kasir/meja. Membutuhkan PIN supervisor dan nomor referensi struk bank.
          </p>

          {supervisorAuthError ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>{supervisorAuthError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="supervisor-pin" className="text-xs font-medium text-foreground">
                PIN supervisor
              </Label>
              <Input
                id="supervisor-pin"
                type="password"
                maxLength={6}
                required
                value={supervisorPin}
                onChange={(e) => setSupervisorPin(e.target.value)}
                placeholder="Masukkan PIN supervisor"
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="supervisor-rrn" className="text-xs font-medium text-foreground">
                Nomor referensi bank (RRN / Ref ID)
              </Label>
              <Input
                id="supervisor-rrn"
                type="text"
                required
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Contoh: RRN-20261114-001"
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="supervisor-note" className="text-xs font-medium text-foreground">
                Catatan otorisasi (opsional)
              </Label>
              <Input
                id="supervisor-note"
                type="text"
                value={supervisorNote}
                onChange={(e) => setSupervisorNote(e.target.value)}
                placeholder="Misalnya: QRIS statis meja kasir"
                className="text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSupervisorAuth(false)}
            >
              Batal
            </Button>
            <Button type="submit" size="sm">
              Verifikasi & setujui
            </Button>
          </div>
        </form>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {/* Header */}
        <DialogHeader className="border-b border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between pr-10 sm:pr-12">
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground">
                {orderType === "DINE_IN" ? `Meja ${tableNumber}` : "Takeaway"}
                {customerName ? ` · ${customerName}` : ""}
              </span>
              <DialogTitle className="text-base font-medium text-foreground">
                Pembayaran kasir
              </DialogTitle>
              <DialogDescription className="sr-only">
                Pilih metode pembayaran kasir POS
              </DialogDescription>
            </div>
            <div className="text-right">
              <span className="block text-xs text-muted-foreground">Total tagihan</span>
              <span className="font-mono text-base font-medium tabular-nums text-foreground">
                {formatCurrencyIDR(grandTotal)}
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Payment Tabs Navigation */}
        <div className="border-b border-border bg-muted/20 px-4 py-2">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as POSPaymentMethod)}
            className="w-full"
          >
            <TabsList aria-label="Metode pembayaran" className={`w-full grid ${isCorporateOrder ? "grid-cols-5" : "grid-cols-4"} h-10`}>
              <TabsTrigger value="QRIS" className="gap-1.5 text-xs">
                <QrCode />
                <span>QRIS</span>
              </TabsTrigger>
              <TabsTrigger value="CASH" className="gap-1.5 text-xs">
                <Banknote />
                <span>Tunai</span>
              </TabsTrigger>
              <TabsTrigger value="EDC" className="gap-1.5 text-xs">
                <CreditCard />
                <span>Debit / EDC</span>
              </TabsTrigger>
              <TabsTrigger value="SPLIT" className="gap-1.5 text-xs">
                <Users />
                <span>Bagi tagihan</span>
              </TabsTrigger>
              {isCorporateOrder ? (
                <TabsTrigger value="INVOICE" className="gap-1.5 text-xs">
                  <Building2 />
                  <span>Invoice</span>
                </TabsTrigger>
              ) : null}
            </TabsList>
          </Tabs>
        </div>

        {/* Tab Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6 text-xs text-foreground">
          {/* TAB 1: QRIS */}
          {activeTab === "QRIS" && renderQrisVerificationBlock(grandTotal)}

          {/* TAB 2: TUNAI */}
          {activeTab === "CASH" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cash-input" className="text-xs font-medium text-foreground">
                      Jumlah uang tunai diterima
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-medium text-muted-foreground">
                        Rp
                      </span>
                      <Input
                        id="cash-input"
                        type="text"
                        value={cashInputRaw}
                        onChange={(e) => handleCustomCashInput(e.target.value)}
                        placeholder="0"
                        className="pl-9 font-mono text-base font-semibold tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Shortcuts */}
                  <div className="space-y-1.5">
                    <span className="block text-xs font-medium text-muted-foreground">
                      Uang pas & rekomendasi:
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {quickDenominations.map((denom, i) => (
                        <Button
                          key={i}
                          type="button"
                          variant={cashGiven === denom ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleCashShortcut(denom)}
                          className="font-mono tabular-nums text-xs"
                        >
                          {denom === grandTotal ? "Uang pas" : formatCurrencyIDR(denom)}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Change Due Display */}
                <div className="flex flex-col justify-between space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                  <div>
                    <span className="block text-xs font-medium text-muted-foreground">
                      Uang kembalian
                    </span>
                    <div
                      className={cn(
                        "mt-1 font-mono text-2xl font-semibold tabular-nums",
                        isCashSufficient ? "text-primary" : "text-destructive"
                      )}
                    >
                      {isCashSufficient ? formatCurrencyIDR(changeDue) : "Uang tunai kurang"}
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-border pt-2 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Total tagihan:</span>
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {formatCurrencyIDR(grandTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Uang diterima:</span>
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {formatCurrencyIDR(cashGiven)}
                      </span>
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
                <Label className="text-xs font-medium text-foreground">
                  Pilih mesin EDC / bank kartu:
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {EDC_BANKS.map((bank) => (
                    <Button
                      key={bank}
                      type="button"
                      variant={selectedBank === bank ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedBank(bank)}
                    >
                      {bank}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edc-approval-code" className="text-xs font-medium text-foreground">
                  Nomor approval code dari struk EDC:
                </Label>
                <Input
                  id="edc-approval-code"
                  type="text"
                  value={approvalCode}
                  onChange={(e) => setApprovalCode(e.target.value)}
                  placeholder="Contoh: APP-782910"
                  className="font-mono text-xs font-medium"
                />
                <p className="text-xs text-muted-foreground">
                  Gesek kartu pelanggan di mesin EDC {selectedBank}, lalu catat kode otorisasi transaksi.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: SPLIT BILL */}
          {activeTab === "SPLIT" && (
            <PaymentTabSplit
              grandTotal={grandTotal}
              splitGuestCount={splitGuestCount}
              splitGuests={splitGuests}
              splitBalance={splitBalance}
              hasSplitQris={hasSplitQris}
              splitQrisAmount={splitQrisAmount}
              onSplitCountChange={handleSplitCountChange}
              onToggleGuestPaid={handleToggleGuestPaid}
              onGuestMethodChange={handleGuestMethodChange}
              onGuestAmountChange={handleGuestAmountChange}
              renderQrisVerificationBlock={renderQrisVerificationBlock}
            />
          )}

          {/* TAB 5: INVOICE / TAGIHAN PERUSAHAAN */}
          {activeTab === "INVOICE" && (
            <PaymentTabInvoice
              corporateCompany={corporateCompany}
              customerName={customerName}
              grandTotal={grandTotal}
            />
          )}
        </div>

        {/* Footer: Confirm Payment Button */}
        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-border bg-muted/20 p-4 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isQrisProcessing || isSubmitting}
            onClick={onClose}
            className="w-24 shrink-0 sm:w-28"
          >
            Batal
          </Button>

          <Button
            type="button"
            size="lg"
            disabled={
              (activeTab === "CASH" && !isCashSufficient) ||
              (activeTab === "SPLIT" && (!splitBalance.isValid || (hasSplitQris && !isQrisVerified))) ||
              (activeTab === "QRIS" && !isQrisVerified) ||
              isQrisProcessing ||
              isSubmitting
            }
            onClick={handleCompletePayment}
            className="flex-1 min-w-0"
          >
            {isQrisProcessing || isSubmitting ? (
              <span>Memproses transaksi...</span>
            ) : (activeTab === "QRIS" || (activeTab === "SPLIT" && hasSplitQris)) && !isQrisVerified ? (
              <span className="flex items-center justify-center gap-2 truncate">
                <Clock className="size-4 animate-spin text-warning shrink-0" />
                <span className="truncate">Menunggu pembayaran QRIS</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2 truncate">
                <CheckCircle2 className="size-4 shrink-0" />
                <span className="truncate">
                  {activeTab === "INVOICE"
                    ? "Terbitkan Invoice Perusahaan"
                    : activeTab === "QRIS"
                    ? "Selesaikan pembayaran QRIS"
                    : `Konfirmasi pembayaran (${activeTab})`}
                </span>
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
