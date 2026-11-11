"use client";

import React from "react";
import { BarChart3, FileSpreadsheet, Download, Printer } from "lucide-react";
import { PageHeader } from "@/components/app";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/features/dashboard/DateRangePicker";
import { ProFeatureBadge } from "@/components/premium";

export interface ReportsToolbarProps {
  scopeName: string;
  periodLabel: string;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onOpenPDF: () => void;
}

export function ReportsToolbar({
  scopeName,
  periodLabel,
  onExportExcel,
  onExportCSV,
  onOpenPDF,
}: ReportsToolbarProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
      <PageHeader
        title="Laporan"
        description={`${scopeName} · ${periodLabel}`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker />

        <Button
          size="sm"
          variant="outline"
          onClick={onExportExcel}
        >
          <FileSpreadsheet className="text-muted-foreground" />
          <span>Ekspor Excel</span>
          <ProFeatureBadge label="PRO" variant="pro" size="xs" />
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onExportCSV}
        >
          <Download className="text-muted-foreground" />
          <span>Ekspor CSV</span>
        </Button>

        <Button
          size="sm"
          onClick={onOpenPDF}
        >
          <Printer />
          <span>Cetak PDF</span>
        </Button>
      </div>
    </div>
  );
}
