"use client";

import React from "react";
import { PageHeader } from "@/components/app";

export interface AIInsightHeaderProps {
  outletName: string;
}

export function AIInsightHeader({ outletName }: AIInsightHeaderProps) {
  return (
    <div className="flex flex-col gap-3 pb-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
      <PageHeader
        title="AI Business Intelligence & Strategic Advisory"
        description={`Konsultasi interaktif berbasis data operasional gerai: ${outletName}.`}
      />
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border bg-muted text-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Data Tersinkronisasi</span>
        </span>
      </div>
    </div>
  );
}
