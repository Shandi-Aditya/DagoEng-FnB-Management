"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import type { WaiterFloorSummary } from "./waiter-domain";

interface WaiterSummaryBarProps {
  summary: WaiterFloorSummary;
}

export function WaiterSummaryBar({ summary }: WaiterSummaryBarProps) {
  return (
    <div className="border-b bg-muted/20">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs sm:px-6">
        <span className="font-medium text-muted-foreground">
          Denah meja outlet
        </span>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1 font-normal">
            <span className="size-1.5 rounded-full bg-destructive" />
            <span>Terisi</span>
            <span className="font-mono font-medium">{summary.occupied}</span>
          </Badge>

          {summary.billing > 0 && (
            <Badge variant="outline" className="gap-1 font-normal">
              <span className="size-1.5 rounded-full bg-warning" />
              <span>Tagihan</span>
              <span className="font-mono font-medium">{summary.billing}</span>
            </Badge>
          )}

          {summary.cleaning > 0 && (
            <Badge variant="outline" className="gap-1 font-normal">
              <span className="size-1.5 rounded-full bg-info" />
              <span>Pembersihan</span>
              <span className="font-mono font-medium">{summary.cleaning}</span>
            </Badge>
          )}

          <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
            <span>Tersedia</span>
            <span className="font-mono font-medium">{summary.available}</span>
          </Badge>
        </div>
      </div>
    </div>
  );
}
