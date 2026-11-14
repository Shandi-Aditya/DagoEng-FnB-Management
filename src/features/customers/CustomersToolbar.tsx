"use client";

import { ChevronDown, Download, FileSpreadsheet, FileText, Plus } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface CustomersToolbarProps {
  outletName: string;
  totalMembers: number;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onOpenPDF: () => void;
  onOpenAddModal: () => void;
}

export function CustomersToolbar({
  outletName,
  totalMembers,
  onExportExcel,
  onExportCSV,
  onOpenPDF,
  onOpenAddModal,
}: CustomersToolbarProps) {
  return (
    <PageHeader
      title="Pelanggan"
      description={`${totalMembers} member terdaftar di ${outletName}.`}
      actions={
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="lg" />}>
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
              <DropdownMenuItem onClick={onOpenPDF}>
                <FileText />
                Laporan PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="lg" onClick={onOpenAddModal}>
            <Plus />
            Tambah member
          </Button>
        </div>
      }
    />
  );
}
