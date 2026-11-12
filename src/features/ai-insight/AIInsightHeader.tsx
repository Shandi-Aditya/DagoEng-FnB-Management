"use client";

import { PageHeader } from "@/components/app/page-header";

export interface AIInsightHeaderProps {
  outletName: string;
}

export function AIInsightHeader({ outletName }: AIInsightHeaderProps) {
  return (
    <PageHeader
      title="Asisten data"
      description={`Tanya jawab tentang data kasir, stok, dan ruang kerja di ${outletName}.`}
    />
  );
}
