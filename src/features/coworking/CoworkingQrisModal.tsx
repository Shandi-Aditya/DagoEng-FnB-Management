"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusBadge } from "@/components/app/status-badge";
import {
  QrCode,
  ShieldCheck,
  KeyRound,
  AlertTriangle,
  Loader2,
  Clock,
  Laptop,
} from "lucide-react";
import { CoworkingBooking } from "@/types/coworking";
import { useCoworking } from "@/contexts/CoworkingContext";
import { formatCurrencyIDR } from "@/lib/utils";

interface CoworkingQrisModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: CoworkingBooking | null;
  onSuccess?: (booking: CoworkingBooking) => void;
}

export function CoworkingQrisModal({
  isOpen,
  onClose,
  booking,
  onSuccess,
}: CoworkingQrisModalProps) {
  const { confirmBookingPayment } = useCoworking();

  const [pin, setPin] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setReferenceNumber("");
      setNote("");
      setErrorMessage(null);
      setIsSubmitting(false);

      // Inisialisasi sesi QRIS di server bila booking ada
      if (booking?.bookingCode && booking.totalAmount > 0) {
        fetch("/api/pos/qris/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "INIT",
            invoiceNumber: booking.bookingCode,
            expectedAmount: booking.totalAmount,
          }),
        }).catch(() => {});
      }
    }
  }, [isOpen, booking]);

  if (!booking) return null;

  const handleSubmitSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPin = pin.trim();
    const cleanRef = referenceNumber.trim();

    if (!cleanPin) {
      setErrorMessage("PIN supervisor wajib diisi.");
      return;
    }

    if (cleanRef.length < 4) {
      setErrorMessage("Nomor referensi / RRN struk bank minimal 4 karakter.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/pos/qris/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "SUPERVISOR_OVERRIDE",
          invoiceNumber: booking.bookingCode,
          expectedAmount: booking.totalAmount,
          pin: cleanPin,
          referenceNumber: cleanRef,
          note: note || `QRIS Co-Working ${booking.spaceName} (${booking.guestName})`,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.allowed || !data.verification) {
        setErrorMessage(data.error || "Otorisasi supervisor ditolak.");
        return;
      }

      // Konfirmasi pembayaran booking dan update status
      confirmBookingPayment(booking.id, "QRIS", data.verification);
      if (onSuccess) {
        onSuccess({
          ...booking,
          paymentStatus: "PAID",
          paymentMethod: "QRIS",
          paymentRef: data.verification.referenceNumber,
          qrisVerification: data.verification,
        });
      }
      onClose();
    } catch {
      setErrorMessage("Gagal menghubungi server verifikasi QRIS.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <QrCode className="size-4 text-primary" />
            <span>Pembayaran QRIS Co-working</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Tamu melakukan scan QRIS statis Dago. Memerlukan konfirmasi PIN supervisor untuk menandai lunas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-1 pr-1 text-xs">
          {/* Rincian Singkat Booking */}
          <div className="space-y-1.5 rounded-lg border bg-muted/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <span className="font-mono text-xs font-semibold text-primary">
                  {booking.bookingCode}
                </span>
                <p className="font-medium text-foreground">
                  {booking.spaceName} &bull; {booking.guestName}
                </p>
                <p className="text-muted-foreground">
                  Durasi: {booking.duration} jam &bull; {booking.date} {booking.startTime}
                </p>
              </div>

              <div className="text-right">
                <span className="block text-muted-foreground">Total tagihan</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrencyIDR(booking.totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Tampilan QRIS Statis */}
          <div className="flex flex-col items-center justify-center space-y-2 rounded-xl border border-dashed border-primary/30 bg-card p-4 text-center">
            <div className="overflow-hidden rounded-xl border bg-white p-2 shadow-xs">
              <img
                src="/images/qris/qris-dago.jpeg"
                alt="QRIS Statis Dago Creative Hub"
                className="size-48 object-contain"
              />
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              QRIS Statis Dago Creative Hub &bull; Invoice: {booking.bookingCode}
            </p>
          </div>

          {/* Status Box */}
          <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 p-3">
            <Clock className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-foreground">Status pembayaran</h4>
                <StatusBadge status="warning">Menunggu konfirmasi</StatusBadge>
              </div>
              <p className="text-muted-foreground">
                Sebelum payment gateway otomatis aktif, pembayaran QRIS statis wajib diverifikasi oleh supervisor dengan memasukkan PIN dan nomor referensi struk bank.
              </p>
            </div>
          </div>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Form Otorisasi Supervisor */}
          <form onSubmit={handleSubmitSupervisor} className="space-y-3 rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <KeyRound className="size-4 text-primary" />
              <h4 className="font-semibold text-foreground">
                Otorisasi supervisor (Wajib)
              </h4>
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="cw-sup-pin" className="text-xs font-medium text-foreground">
                  PIN supervisor
                </Label>
                <Input
                  id="cw-sup-pin"
                  type="password"
                  maxLength={6}
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Masukkan 6-digit PIN supervisor"
                  className="font-mono text-xs"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="cw-sup-rrn" className="text-xs font-medium text-foreground">
                  Nomor referensi bank (RRN / Ref ID struk)
                </Label>
                <Input
                  id="cw-sup-rrn"
                  type="text"
                  required
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Contoh: RRN-20261116-001"
                  className="font-mono text-xs"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="cw-sup-note" className="text-xs font-medium text-foreground">
                  Catatan otorisasi (opsional)
                </Label>
                <Input
                  id="cw-sup-note"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Misalnya: QRIS statis kasir co-working"
                  className="text-xs"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Tutup / Nanti
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-3.5" />
                    <span>Verifikasi & setujui</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
