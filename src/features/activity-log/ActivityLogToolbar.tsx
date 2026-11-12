"use client";

import { ChevronDown, Code, Download, FileSpreadsheet, Printer } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ActivityLogToolbarProps {
  outletName: string;
  onOpenPDF: () => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
}

export function ActivityLogToolbar({
  outletName,
  onOpenPDF,
  onExportExcel,
  onExportCSV,
  onExportJSON,
}: ActivityLogToolbarProps) {
  return (
    <PageHeader
      title="Log aktivitas"
      description={`Catatan perubahan data di ${outletName}. Tidak bisa diubah atau dihapus.`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              <Download />
              Ekspor
              <ChevronDown className="text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExportExcel}>
                <FileSpreadsheet />
                Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportCSV}>
                <Download />
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportJSON}>
                <Code />
                JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={onOpenPDF}>
            <Printer />
            Cetak PDF
          </Button>
        </div>
      }
    />
  );
}
