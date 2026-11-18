"use client";

import { ChevronDown, Download, FileSpreadsheet, Printer } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateRangePicker } from "@/features/dashboard/DateRangePicker";

export interface ReportsToolbarProps {
  scopeName: string;
  periodLabel: string;
  isTemplateXlsx?: boolean;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onOpenPDF: () => void;
}

export function ReportsToolbar({
  scopeName,
  periodLabel,
  isTemplateXlsx = true,
  onExportExcel,
  onExportCSV,
  onOpenPDF,
}: ReportsToolbarProps) {
  return (
    <PageHeader
      title="Laporan"
      description={`${scopeName} · ${periodLabel}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker />

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="lg" />}>
              <Download />
              Ekspor
              <ChevronDown className="text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExportExcel}>
                <FileSpreadsheet />
                {isTemplateXlsx ? "Excel (.xlsx)" : "Excel (.xls)"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportCSV}>
                <Download />
                CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="lg" onClick={onOpenPDF}>
            <Printer />
            Cetak PDF
          </Button>
        </div>
      }
    />
  );
}
