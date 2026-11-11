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
        title="Laporan Manajemen & Ekspor Terstruktur"
        description={`Laporan operasional resmi Dago Creative Hub. Scope ${scopeName}, Periode ${periodLabel}.`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker />

        <Button
          size="sm"
          variant="outline"
          onClick={onExportExcel}
          className="gap-1.5"
          title="Download Spreadsheet Excel (.xls)"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Excel (.xls)</span>
          <ProFeatureBadge label="PRO" variant="pro" size="xs" />
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onExportCSV}
          className="gap-1.5"
          title="Download Data CSV"
        >
          <Download className="h-4 w-4 text-muted-foreground" />
          <span>Export CSV</span>
        </Button>

        <Button
          size="sm"
          onClick={onOpenPDF}
          className="gap-1.5"
          title="Buka Dokumen PDF & Cetak Berkas Resmi"
        >
          <Printer className="h-4 w-4" />
          <span>Cetak PDF Resmi</span>
        </Button>
      </div>
    </div>
  );
}
