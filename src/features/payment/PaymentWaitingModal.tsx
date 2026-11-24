"use client";

import React, { useState, useEffect, useMemo } from "react";
import type { OrderRecord } from "@/types/order";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import {
  type UnifiedPaymentItem,
  type BookingLike,
  DEFAULT_PAYMENT_EXPIRY_SECONDS,
  formatPaymentTimer,
  calculatePaymentProgress,
  normalizePaymentItem,
  getPaymentMethodDisplay,
  calculateSecondsRemaining,
} from "./payment-waiting";

export type { UnifiedPaymentItem };

interface PaymentWaitingModalProps {
  isOpen: boolean;
  order?: OrderRecord | null;
  booking?: BookingLike | null;
  paymentItem?: UnifiedPaymentItem | null;
  onClose: () => void;
  onCancelPayment: (payload: { type: "FNB" | "COWORKING"; id: string }) => void;
  onExpired?: (payload: { type: "FNB" | "COWORKING"; id: string }) => void;
}

export function PaymentWaitingModal({
  isOpen,
  order,
  booking,
  paymentItem,
  onClose,
  onCancelPayment,
  onExpired,
}: PaymentWaitingModalProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(DEFAULT_PAYMENT_EXPIRY_SECONDS);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);

  // Normalize payment item across F&B and Co-working
  const activeItem = useMemo(() => {
    return normalizePaymentItem({ order, booking, paymentItem });
  }, [order, booking, paymentItem]);

  const activeItemId = activeItem?.id ?? null;
  const activeItemCreatedAt = activeItem?.createdAt;
  const isPaidSuccess = activeItem?.paymentStatus === "PAID";

  useEffect(() => {
    if (isOpen && activeItemId) {
      setShowCancelConfirm(false);

      const remain = calculateSecondsRemaining(activeItemCreatedAt, Date.now(), DEFAULT_PAYMENT_EXPIRY_SECONDS);
      setSecondsRemaining(remain);
    }
  }, [isOpen, activeItemId]);

  // Countdown timer loop
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

  if (!isOpen) return null;

  const timerProgress = calculatePaymentProgress(secondsRemaining, DEFAULT_PAYMENT_EXPIRY_SECONDS);

  const handleCopyReference = () => {
    if (!activeItem) return;
    navigator.clipboard?.writeText(activeItem.itemCode);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const methodDisplay = activeItem ? getPaymentMethodDisplay(activeItem.paymentMethod) : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full sm:max-w-md p-0 overflow-hidden flex flex-col max-h-[92vh] gap-0">
        {/* Modal Top Header */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-muted/30 shrink-0 pr-12">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {isPaidSuccess ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <Clock className="size-4" />
              )}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-medium text-foreground truncate">
                {isPaidSuccess ? "Pembayaran terverifikasi" : "Menunggu pembayaran"}
              </DialogTitle>
              {activeItem && (
                <DialogDescription className="text-xs text-muted-foreground truncate">
                  <span className="font-mono">{activeItem.itemCode}</span> • {activeItem.subtitle}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {!activeItem ? (
            <EmptyState
              className="border"
              icon={<AlertCircle className="size-8" />}
              title="Data pembayaran tidak ditemukan"
              description="Transaksi mungkin telah dibatalkan atau kedaluwarsa."
            />
          ) : isPaidSuccess ? (
            /* Success State */
            <div className="text-center py-4 space-y-4">
              <div className="size-16 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto border border-success/20">
                <CheckCircle2 className="size-8" />
              </div>

              <div className="space-y-1">
                <StatusBadge status="success">Lunas terverifikasi</StatusBadge>
                <h4 className="font-semibold text-base text-foreground pt-1">
                  Pembayaran berhasil diterima
                </h4>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  {activeItem.type === "COWORKING"
                    ? `Reservasi ${activeItem.subtitle} atas nama ${activeItem.customerName} telah lunas dan siap digunakan.`
                    : `Pesanan #${activeItem.itemCode} telah diteruskan ke dapur dan sedang disiapkan.`}
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-border bg-card space-y-2 text-xs text-left">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Metode pembayaran</span>
                  <span className="font-medium text-foreground">{methodDisplay?.label}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Total tagihan lunas</span>
                  <span className="font-mono tabular-nums font-semibold text-primary">
                    {formatCurrencyIDR(activeItem.total)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Pelanggan</span>
                  <span className="font-medium text-foreground">{activeItem.customerName}</span>
                </div>
              </div>

              <Button size="lg" className="w-full" onClick={onClose}>
                <span>Tutup dan lihat status</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            /* Pending Payment State */
            <>
              {/* Countdown Banner */}
              <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="size-3.5 text-primary" />
                    <span>Batas waktu pembayaran:</span>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-xs text-primary px-2 py-0.5 rounded bg-primary/10">
                    {formatPaymentTimer(secondsRemaining)}
                  </span>
                </div>
                <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${timerProgress}%` }}
                  />
                </div>
              </div>

              {/* Total Tagihan Box */}
              <div className="p-3.5 rounded-lg border border-border bg-card flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-xs text-muted-foreground block truncate">
                    Total tagihan {activeItem.type === "COWORKING" ? "sewa ruang" : "pesanan"}
                  </span>
                  <div className="text-xl font-semibold font-mono tabular-nums text-foreground">
                    {formatCurrencyIDR(activeItem.total)}
                  </div>
                </div>
                {methodDisplay && (
                  <StatusBadge status="neutral" className="shrink-0">
                    {methodDisplay.label}
                  </StatusBadge>
                )}
              </div>

              {/* Method-Specific Instruction Card */}
              {activeItem.paymentMethod === "CASH" ? (
                <div className="p-4 rounded-lg border border-border bg-card space-y-3 text-center">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <Banknote className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-medium text-foreground text-xs">Pembayaran tunai di kasir</h5>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {methodDisplay?.instruction}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-md border border-border bg-muted/40 font-mono text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>{activeItem.itemCode}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyReference}
                      className="gap-1 text-primary"
                    >
                      {copiedRef ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      <span>{copiedRef ? "Tersalin" : "Salin"}</span>
                    </Button>
                  </div>
                </div>
              ) : activeItem.paymentMethod === "EDC" ? (
                <div className="p-4 rounded-lg border border-border bg-card space-y-3 text-center">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <CreditCard className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-medium text-foreground text-xs">Pembayaran kartu debit / kredit</h5>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {methodDisplay?.instruction}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-md border border-border bg-muted/40 font-mono text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>{activeItem.itemCode}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyReference}
                      className="gap-1 text-primary"
                    >
                      {copiedRef ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      <span>{copiedRef ? "Tersalin" : "Salin"}</span>
                    </Button>
                  </div>
                </div>
              ) : (
                /* QRIS Dinamis Component */
                <div className="p-4 rounded-lg border border-border bg-card flex flex-col items-center space-y-3">
                  <div className="flex items-center justify-between w-full border-b border-border pb-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <Store className="size-3.5 text-primary" />
                      <span>Dago Creative Hub Singaraja</span>
                    </div>
                    <span className="font-mono text-xs">NMID: ID10202609240001</span>
                  </div>

                  {/* QR Box Matrix */}
                  <div className="p-3 bg-white rounded-lg border border-border flex flex-col items-center">
                    <div className="relative size-40 bg-white flex items-center justify-center p-2">
                      <svg viewBox="0 0 100 100" className="w-full h-full text-foreground" aria-label="QRIS Code Matrix">
                        <rect x="5" y="5" width="26" height="26" fill="currentColor" rx="4" />
                        <rect x="9" y="9" width="18" height="18" fill="white" rx="2" />
                        <rect x="13" y="13" width="10" height="10" fill="currentColor" rx="1" />

                        <rect x="69" y="5" width="26" height="26" fill="currentColor" rx="4" />
                        <rect x="73" y="9" width="18" height="18" fill="white" rx="2" />
                        <rect x="77" y="13" width="10" height="10" fill="currentColor" rx="1" />

                        <rect x="5" y="69" width="26" height="26" fill="currentColor" rx="4" />
                        <rect x="9" y="73" width="18" height="18" fill="white" rx="2" />
                        <rect x="13" y="77" width="10" height="10" fill="currentColor" rx="1" />

                        <rect x="36" y="14" width="4" height="4" fill="currentColor" />
                        <rect x="44" y="14" width="4" height="4" fill="currentColor" />
                        <rect x="52" y="14" width="4" height="4" fill="currentColor" />
                        <rect x="60" y="14" width="4" height="4" fill="currentColor" />

                        <rect x="14" y="36" width="4" height="4" fill="currentColor" />
                        <rect x="14" y="44" width="4" height="4" fill="currentColor" />
                        <rect x="14" y="52" width="4" height="4" fill="currentColor" />
                        <rect x="14" y="60" width="4" height="4" fill="currentColor" />

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
                        <div className="size-7 rounded bg-primary text-primary-foreground flex items-center justify-center font-semibold text-xs shadow-xs border border-white">
                          DAGO
                        </div>
                      </div>
                    </div>

                    <span className="text-xs font-mono text-muted-foreground pt-1 font-medium">
                      Ref: {activeItem.itemCode}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground text-center leading-relaxed">
                    {methodDisplay?.instruction}
                  </p>
                </div>
              )}

              {/* Order / Booking Summary */}
              {activeItem.itemsBreakdown && activeItem.itemsBreakdown.length > 0 && (
                <div className="p-3 rounded-lg border border-border bg-muted/20 text-xs space-y-1.5">
                  <span className="font-medium text-foreground block">
                    Rincian {activeItem.type === "COWORKING" ? "sewa ruang kerja" : "pesanan menu"}
                  </span>
                  <div className="space-y-1 divide-y divide-border max-h-28 overflow-y-auto">
                    {activeItem.itemsBreakdown.map((it, idx) => (
                      <div key={idx} className="pt-1 flex justify-between items-center text-muted-foreground">
                        <span className="truncate">
                          {it.qty ? `${it.qty}× ` : ""}
                          {it.label}
                        </span>
                        <span className="font-mono tabular-nums font-medium text-foreground shrink-0 pl-2">
                          {formatCurrencyIDR(it.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-1">
                <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <Clock className="size-4 shrink-0 text-primary mt-0.5" />
                  <span>Menunggu konfirmasi otomatis gateway atau verifikasi kasir.</span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={onClose}
                  className="w-full"
                >
                  Tutup
                </Button>

                {showCancelConfirm ? (
                  <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2 text-xs">
                    <p className="font-medium text-foreground">
                      Batalkan {activeItem.type === "COWORKING" ? "booking ini" : "pesanan ini"}?
                    </p>
                    <p className="text-muted-foreground">
                      {activeItem.itemCode} akan dibatalkan dan alokasi meja atau ruang kerja akan dibebaskan.
                    </p>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCancelConfirm(false)}
                      >
                        Kembali
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => onCancelPayment({ type: activeItem.type, id: activeItem.id })}
                      >
                        Ya, batalkan
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCancelConfirm(true)}
                    className="w-full text-muted-foreground hover:text-destructive"
                  >
                    Batalkan {activeItem.type === "COWORKING" ? "booking" : "pesanan"} ini
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
