"use client";

import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  PowerOff,
} from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface CommercialToolbarProps {
  outletName: string;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onOpenPDF: () => void;
  onToggleModule: () => void;
  onOpenCreateModal: () => void;
}

export function CommercialToolbar({
  outletName,
  onExportExcel,
  onExportCSV,
  onOpenPDF,
  onToggleModule,
  onOpenCreateModal,
}: CommercialToolbarProps) {
  return (
    <PageHeader
      title="Komersial"
      description={`Kontrak sewa unit retail dan tagihannya di ${outletName}.`}
      actions={
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="lg" />}>
              Lainnya
              <ChevronDown className="text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem onClick={onExportExcel}>
                <FileSpreadsheet />
                Ekspor Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportCSV}>
                <Download />
                Ekspor CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenPDF}>
                <FileText />
                Laporan PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onToggleModule}
                className="text-destructive focus:text-destructive"
              >
                <PowerOff />
                Nonaktifkan modul
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="lg" onClick={onOpenCreateModal}>
            <Plus />
            Tambah kontrak
          </Button>
        </div>
      }
    />
  );
}
