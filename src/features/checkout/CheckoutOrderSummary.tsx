"use client";

import React from "react";
import { formatCurrencyIDR } from "@/lib/utils";
import type { TransactionDetails } from "./checkout-domain";

interface CheckoutOrderSummaryProps {
  transaction: TransactionDetails;
}

export function CheckoutOrderSummary({ transaction }: CheckoutOrderSummaryProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">
          Ringkasan tagihan
        </span>
        <span className="font-mono tabular-nums text-foreground font-medium">
          {transaction.dokuInvoiceNumber}
        </span>
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground leading-snug">
          {transaction.eventTitle}
        </h3>
        <p className="text-xs text-muted-foreground">
          {transaction.ticketCount}× tiket masuk • Atas nama {transaction.guestName}
        </p>
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Total pembayaran:</span>
        <span className="font-mono tabular-nums text-xl font-semibold text-primary">
          {formatCurrencyIDR(transaction.totalPrice)}
        </span>
      </div>
    </div>
  );
}
