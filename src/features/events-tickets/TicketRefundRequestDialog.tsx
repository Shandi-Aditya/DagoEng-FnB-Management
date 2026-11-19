"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/app/notify";
import { formatCurrencyIDR } from "@/lib/utils";

interface TicketRefundRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  guestToken: string;
  calculatedRefundAmount: number;
  feeDeducted: number;
  totalPrice: number;
  onSuccess: () => void;
}

export function TicketRefundRequestDialog({
  open,
  onOpenChange,
  bookingId,
  guestToken,
  calculatedRefundAmount,
  feeDeducted,
  totalPrice,
  onSuccess,
}: TicketRefundRequestDialogProps) {
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim() || !reason.trim()) {
      notify.error("Data belum lengkap", "Harap lengkapi semua data rekening dan alasan pembatalan.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/events/bookings/${bookingId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestToken,
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountHolder: accountHolder.trim(),
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengajukan pengembalian dana tiket.");
      }

      notify.success("Pengajuan berhasil", "Pengajuan refund Anda telah dikirim dan menunggu verifikasi admin.");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      notify.error("Gagal mengajukan refund", err.message || "Terjadi kesalahan pada sistem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Formulir pengajuan refund tiket</DialogTitle>
          <DialogDescription>
            Isi rincian rekening tujuan transfer pengembalian dana tiket Anda.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Financial Breakdown Preview */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Harga tiket dibayarkan:</span>
              <span className="font-medium text-foreground font-mono tabular-nums">
                {formatCurrencyIDR(totalPrice)}
              </span>
            </div>
            {feeDeducted > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Potongan biaya admin:</span>
                <span className="font-mono tabular-nums">-{formatCurrencyIDR(feeDeducted)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1.5 border-t border-border font-semibold text-foreground">
              <span>Estimasi dana kembali:</span>
              <span className="text-primary font-mono tabular-nums">
                {formatCurrencyIDR(calculatedRefundAmount)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="refund-bank-name" className="text-xs">
                Nama bank / e-wallet <span className="text-destructive">*</span>
              </Label>
              <Input
                id="refund-bank-name"
                required
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Contoh: BCA / Mandiri / GoPay"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="refund-account-num" className="text-xs">
                Nomor rekening / nomor akun <span className="text-destructive">*</span>
              </Label>
              <Input
                id="refund-account-num"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Contoh: 1234567890"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="refund-holder" className="text-xs">
                Nama pemilik rekening <span className="text-destructive">*</span>
              </Label>
              <Input
                id="refund-holder"
                required
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                placeholder="Sesuai buku tabungan"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="refund-reason" className="text-xs">
                Alasan pembatalan <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="refund-reason"
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Tuliskan alasan pembatalan tiket Anda"
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t gap-2">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="default"
              disabled={isSubmitting || !bankName.trim() || !accountNumber.trim() || !accountHolder.trim() || !reason.trim()}
            >
              {isSubmitting ? "Mengirim..." : "Kirim pengajuan refund"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
