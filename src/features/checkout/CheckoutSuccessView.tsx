"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { formatCurrencyIDR } from "@/lib/utils";
import type { TransactionDetails } from "./checkout-domain";

interface CheckoutSuccessViewProps {
  transaction: TransactionDetails;
}

export function CheckoutSuccessView({ transaction }: CheckoutSuccessViewProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 sm:p-8 text-center space-y-5">
      <div className="size-14 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto border border-success/20">
        <CheckCircle2 className="size-7" />
      </div>

      <div className="space-y-1">
        <StatusBadge status="success">Lunas terverifikasi</StatusBadge>
        <h2 className="text-lg font-semibold text-foreground pt-1">
          Pembayaran berhasil diterima
        </h2>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Transaksi telah diverifikasi oleh gateway pembayaran DOKU sandbox.
        </p>
      </div>

      <div className="p-3.5 rounded-lg border border-border bg-muted/20 text-left space-y-2 text-xs">
        <div className="flex justify-between items-center border-b border-border pb-2 text-muted-foreground">
          <span>No. invoice</span>
          <span className="font-mono tabular-nums font-medium text-foreground">
            {transaction.dokuInvoiceNumber}
          </span>
        </div>
        <div className="flex justify-between items-center border-b border-border pb-2 text-muted-foreground">
          <span>Kode tiket</span>
          <span className="font-mono tabular-nums font-semibold text-primary">
            {transaction.ticketCode}
          </span>
        </div>
        <div className="flex justify-between items-center border-b border-border pb-2 text-muted-foreground">
          <span>Acara</span>
          <span className="font-medium text-foreground">{transaction.eventTitle}</span>
        </div>
        <div className="flex justify-between items-center pt-1 text-muted-foreground">
          <span>Total dibayar</span>
          <span className="font-mono tabular-nums font-semibold text-sm text-primary">
            {formatCurrencyIDR(transaction.totalPrice)}
          </span>
        </div>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
        <Button size="lg" className="flex-1" render={<Link href={`/events/${transaction.eventId}`} />}>
          Lihat e-tiket resmi
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          render={<Link href="/customer?tab=profile" />}
        >
          Portal peserta
        </Button>
      </div>
    </div>
  );
}
