"use client";

import React from "react";
import {
  Printer,
  FileSpreadsheet,
  Download,
  Code,
  Table as TableIcon,
  GitCommit,
} from "lucide-react";
import { PageHeader } from "@/components/app";
import { Button } from "@/components/ui/button";
import { ViewMode } from "@/features/activity-log/activity-log-domain";
import { cn } from "@/lib/utils";

export interface ActivityLogToolbarProps {
  outletName: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenPDF: () => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
}

export function ActivityLogToolbar({
  outletName,
  viewMode,
  onViewModeChange,
  onOpenPDF,
  onExportExcel,
  onExportCSV,
  onExportJSON,
}: ActivityLogToolbarProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
      <PageHeader
        title="Log aktivitas"
        description={`Semua perubahan data di ${outletName}. Catatan tidak bisa diubah atau dihapus.`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={onOpenPDF}
          className="gap-1.5"
          title="Cetak PDF"
        >
          <Printer className="h-4 w-4" />
          <span>Cetak PDF</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onExportExcel}
          className="gap-1.5"
          title="Ekspor Excel"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Excel</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onExportCSV}
          className="gap-1.5"
          title="Ekspor CSV"
        >
          <Download className="h-4 w-4 text-muted-foreground" />
          <span>CSV</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onExportJSON}
          className="gap-1.5"
          title="Ekspor JSON"
        >
          <Code className="h-4 w-4 text-muted-foreground" />
          <span>JSON</span>
        </Button>

        <div className="flex items-center rounded-lg border border-border bg-muted p-0.5 ml-1">
          <button
            type="button"
            onClick={() => onViewModeChange("TABLE")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer",
              viewMode === "TABLE"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <TableIcon className="h-3.5 w-3.5" />
            <span>Tabel</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("TIMELINE")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer",
              viewMode === "TIMELINE"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <GitCommit className="h-3.5 w-3.5" />
            <span>Riwayat</span>
          </button>
        </div>
      </div>
    </div>
  );
}
