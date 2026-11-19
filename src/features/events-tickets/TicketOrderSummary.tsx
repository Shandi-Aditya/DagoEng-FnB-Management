"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrencyIDR } from "@/lib/utils";
import { notify } from "@/components/app/notify";

interface TicketOrderSummaryProps {
  ticketCode: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  institution?: string | null;
  ticketCount: number;
  totalPrice: number;
  ticketTierName?: string | null;
  isInvitation?: boolean;
  invitationNote?: string | null;
  discountAmount?: number;
  subtotalPrice?: number;
  promoCode?: string | null;
}

export function TicketOrderSummary({
  ticketCode,
  guestName,
  guestEmail,
  guestPhone,
  institution,
  ticketCount,
  totalPrice,
  ticketTierName,
  isInvitation,
  invitationNote,
  discountAmount,
  subtotalPrice,
  promoCode,
}: TicketOrderSummaryProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyCode = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(ticketCode);
    setIsCopied(true);
    notify.success("Kode disalin", `Kode booking ${ticketCode} telah disalin.`);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      {/* Booking Code Card */}
      <div className="p-3.5 bg-muted/40 rounded-xl border border-border flex items-center justify-between">
        <div>
          <span className="text-xs text-muted-foreground font-medium block">
            Kode booking manual
          </span>
          <span className="font-mono font-semibold text-base text-foreground">
            {ticketCode}
          </span>
        </div>
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={handleCopyCode}
        >
          {isCopied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          <span>{isCopied ? "Disalin" : "Salin"}</span>
        </Button>
      </div>

      {/* Rincian Pesanan Box */}
      <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2 text-xs">
        <span className="text-xs font-semibold text-foreground block border-b border-border pb-1.5">
          Rincian pesanan
        </span>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Nama pemesan:</span>
          <span className="font-medium text-foreground">{guestName}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Email:</span>
          <span className="font-medium text-foreground">{guestEmail}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Nomor telepon:</span>
          <span className="font-mono text-foreground">{guestPhone}</span>
        </div>
        {institution && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Institusi / komunitas:</span>
            <span className="font-medium text-foreground">{institution}</span>
          </div>
        )}
        {ticketTierName && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Jenis tiket:</span>
            <span className="font-medium text-foreground">{ticketTierName}</span>
          </div>
        )}
        {isInvitation && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Status tiket:</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              Tiket undangan
            </span>
          </div>
        )}
        {isInvitation && invitationNote && (
          <div className="flex justify-between items-start gap-2">
            <span className="text-muted-foreground shrink-0">Keterangan:</span>
            <span className="font-medium text-foreground text-right">{invitationNote}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Jumlah tiket:</span>
          <span className="font-medium text-foreground tabular-nums">{ticketCount} tiket</span>
        </div>
        {typeof subtotalPrice === "number" && typeof discountAmount === "number" && discountAmount > 0 && (
          <>
            <div className="flex justify-between items-center pt-1 border-t border-border/50">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium text-foreground font-mono tabular-nums">
                {formatCurrencyIDR(subtotalPrice)}
              </span>
            </div>
            <div className="flex justify-between items-center text-success">
              <span className="font-medium">Potongan promo {promoCode ? `(${promoCode})` : ""}:</span>
              <span className="font-semibold font-mono tabular-nums">
                -{formatCurrencyIDR(discountAmount)}
              </span>
            </div>
          </>
        )}
        <div className="flex justify-between items-center pt-2 border-t border-border">
          <span className="font-medium text-foreground">Total tagihan:</span>
          <span className="font-semibold text-sm text-foreground font-mono tabular-nums">
            {totalPrice > 0 ? formatCurrencyIDR(totalPrice) : isInvitation ? "Gratis (Tiket Undangan)" : "Gratis (RSVP)"}
          </span>
        </div>
      </div>
    </div>
  );
}
