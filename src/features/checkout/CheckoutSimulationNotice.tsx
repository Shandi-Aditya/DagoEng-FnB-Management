"use client";

import React from "react";
import { Info } from "lucide-react";

export function CheckoutSimulationNotice() {
  return (
    <div className="p-3.5 rounded-lg border border-warning/30 bg-warning/5 text-xs text-muted-foreground leading-relaxed space-y-1">
      <div className="flex items-center gap-1.5 font-medium text-foreground">
        <Info className="size-3.5 text-warning shrink-0" />
        <span>Mode simulasi sandbox</span>
      </div>
      <p>
        Ini adalah antarmuka simulator gateway pembayaran DOKU DagoEng. Menekan tombol bayar
        akan mengirimkan webhook DOKU resmi (HMAC-SHA256) ke sistem untuk mengonfirmasi pelunasan tiket secara otomatis.
      </p>
    </div>
  );
}
