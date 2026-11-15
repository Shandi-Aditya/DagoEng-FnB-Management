"use client";

import React from "react";
import { Lock } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";

export function CheckoutHeader() {
  return (
    <header className="max-w-xl w-full mx-auto flex items-center justify-between pb-5 border-b border-border">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-base shadow-xs">
          D
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-foreground">DOKU</span>
            <StatusBadge status="warning">
              Simulator sandbox
            </StatusBadge>
          </div>
          <p className="text-xs text-muted-foreground">Simulator gateway pembayaran</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 border border-border px-2.5 py-1 rounded-full">
        <Lock className="size-3.5 text-primary" />
        <span>SSL 256-bit</span>
      </div>
    </header>
  );
}
