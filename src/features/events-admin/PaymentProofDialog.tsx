"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EventTicketOrder } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";

export interface PaymentProofDialogProps {
  booking: EventTicketOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (booking: EventTicketOrder) => void;
  onReject: (booking: EventTicketOrder) => void;
  isProcessing?: boolean;
}

export function PaymentProofDialog({
  booking,
  open,
  onOpenChange,
  onApprove,
  onReject,
  isProcessing,
}: PaymentProofDialogProps) {
  if (!booking) return null;

  const isPending = booking.paymentStatus === "PENDING";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bukti pembayaran tiket</DialogTitle>
          <DialogDescription>
            Tiket {booking.ticketCode} · {booking.guestName} ({formatCurrencyIDR(booking.totalPrice)})
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
            {booking.paymentProofUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={booking.paymentProofUrl}
                alt={`Bukti transfer ${booking.ticketCode}`}
                className="max-h-full max-w-full object-contain"
                loading="lazy"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                Tidak ada file bukti transfer
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nomor pemesan:</span>
              <span className="font-medium text-foreground">{booking.guestPhone || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium text-foreground">{booking.guestEmail || "—"}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-3">
          {isPending ? (
            <>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  onOpenChange(false);
                  onReject(booking);
                }}
                disabled={isProcessing}
              >
                <XCircle />
                <span>Tolak bukti</span>
              </Button>
              <Button
                size="lg"
                onClick={() => {
                  onOpenChange(false);
                  onApprove(booking);
                }}
                disabled={isProcessing}
              >
                <CheckCircle2 />
                <span>Setujui pembayaran</span>
              </Button>
            </>
          ) : (
            <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
              Tutup
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
