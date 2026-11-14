"use client";

import React from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import type { TransactionDetails } from "./checkout-domain";

interface CheckoutCancelledViewProps {
  transaction: TransactionDetails;
}

export function CheckoutCancelledView({ transaction }: CheckoutCancelledViewProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 sm:p-8 text-center space-y-4">
      <div className="size-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto border border-destructive/20">
        <AlertCircle className="size-7" />
      </div>

      <div className="space-y-1">
        <StatusBadge status="destructive">Dibatalkan</StatusBadge>
        <h2 className="text-lg font-semibold text-foreground pt-1">
          Pembayaran dibatalkan
        </h2>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Pemesanan tiket ini telah dibatalkan dalam simulator DOKU.
        </p>
      </div>

      <div className="pt-2">
        <Button size="lg" render={<Link href={`/events/${transaction.eventId}`} />}>
          Pesan ulang tiket
        </Button>
      </div>
    </div>
  );
}
