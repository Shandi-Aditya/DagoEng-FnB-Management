"use client";

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
import { Label } from "@/components/ui/label";
import type { EventTicketOrder } from "@/types/event";

export interface RejectPaymentDialogProps {
  booking: EventTicketOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  cancelBooking: boolean;
  onCancelBookingChange: (cancel: boolean) => void;
  onConfirmReject: () => void;
  isProcessing?: boolean;
}

export function RejectPaymentDialog({
  booking,
  open,
  onOpenChange,
  reason,
  onReasonChange,
  cancelBooking,
  onCancelBookingChange,
  onConfirmReject,
  isProcessing,
}: RejectPaymentDialogProps) {
  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tolak bukti pembayaran</DialogTitle>
          <DialogDescription>
            Masukkan alasan penolakan untuk tiket {booking.ticketCode} ({booking.guestName}). Alasan ini akan dikirimkan ke pemesan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rejectionReason">Alasan penolakan</Label>
            <Input
              id="rejectionReason"
              type="text"
              placeholder="Contoh: Bukti buram, nominal tidak sesuai…"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              required
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={cancelBooking}
              onChange={(e) => onCancelBookingChange(e.target.checked)}
              className="mt-0.5 rounded border"
            />
            <span>
              Batalkan pesanan tiket ini dan kembalikan kuota ke event (pemesan harus memesan ulang jika ingin tiket baru).
            </span>
          </label>
        </div>

        <DialogFooter className="border-t pt-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Batal
          </Button>
          <Button
            size="lg"
            variant="destructive"
            onClick={onConfirmReject}
            disabled={!reason.trim() || isProcessing}
          >
            {isProcessing ? "Menolak…" : "Tolak pembayaran"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
