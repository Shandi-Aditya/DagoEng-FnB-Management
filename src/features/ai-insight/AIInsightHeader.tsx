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
        title="Asisten data"
        description={`Tanya jawab tentang data kasir, stok, dan ruang kerja di ${outletName}.`}
      />
    </div>
  );
}
