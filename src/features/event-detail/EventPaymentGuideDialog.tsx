"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Clock, Copy, CreditCard, ExternalLink, Ticket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyIDR } from "@/lib/utils";
import type { EventTicketOrder, PublicCommunityEvent } from "@/types/event";

interface EventPaymentGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: EventTicketOrder | null;
  event: PublicCommunityEvent | null;
  onViewTicket: () => void;
}

export function EventPaymentGuideDialog({
  open,
  onOpenChange,
  ticket,
  event,
  onViewTicket,
}: EventPaymentGuideDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!ticket || !event) return null;

  const bank = ticket.destinationBankSnapshot || event.destinationBank;

  const handleCopyAccount = () => {
    if (bank?.accountNumber && typeof window !== "undefined") {
      navigator.clipboard.writeText(bank.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base font-medium">
              Panduan Pembayaran Tiket
            </DialogTitle>
            <Badge variant="secondary" className="text-xs">
              Menunggu pembayaran
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground truncate">
            {ticket.eventTitle} &bull; {ticket.ticketCount} tiket
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          {/* Total Price & Booking Code */}
          <div className="rounded-lg border bg-muted/20 p-4 text-center space-y-1">
            <span className="text-xs text-muted-foreground block">
              Total nominal yang harus ditransfer
            </span>
            <span className="font-mono text-2xl font-medium text-primary block">
              {formatCurrencyIDR(ticket.totalPrice)}
            </span>
            <div className="pt-2 text-xs text-muted-foreground">
              Kode booking: <span className="font-mono font-medium text-foreground">{ticket.ticketCode}</span>
            </div>
          </div>

          {/* Transfer Deadline Info */}
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 flex items-start gap-2.5 text-warning">
            <Clock className="size-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs">
              <span className="font-medium text-warning block">
                Batas waktu pembayaran (60 menit)
              </span>
              <p className="text-muted-foreground leading-relaxed">
                Selesaikan transfer dan unggah bukti pembayaran dalam 60 menit agar pesanan tiket tidak dibatalkan otomatis.
              </p>
            </div>
          </div>

          {/* Bank Destination Details */}
          {bank ? (
            <div className="rounded-lg border p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <CreditCard className="size-4 text-primary" />
                <span>Rekening resmi tujuan transfer:</span>
              </div>

              <div className="rounded-md border bg-muted/30 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-medium text-foreground block text-xs">
                    {bank.bankName} &bull; <span className="font-mono font-medium">{bank.accountNumber}</span>
                  </span>
                  <span className="text-xs text-muted-foreground block mt-0.5 truncate">
                    a.n. {bank.accountHolder}
                  </span>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyAccount}
                  className="shrink-0"
                >
                  {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                  <span>{copied ? "Tersalin" : "Salin"}</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              Belum ada rekening tujuan aktif. Silakan hubungi admin platform.
            </div>
          )}

          {/* Action Links */}
          <div className="space-y-2 pt-2 border-t">
            {ticket.guestToken && (
              <Button
                variant="default"
                size="sm"
                render={<Link href={`/events/tickets/${ticket.guestToken}`} />}
                nativeButton={false}
                className="w-full"
              >
                <ExternalLink />
                <span>Buka e-tiket & unggah bukti transfer</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onViewTicket}
              className="w-full"
            >
              <Ticket />
              <span>Lihat tiket pesanan</span>
            </Button>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
