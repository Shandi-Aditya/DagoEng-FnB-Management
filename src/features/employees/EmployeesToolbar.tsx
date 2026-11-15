"use client";

import {
  ChevronDown,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
} from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface EmployeesToolbarProps {
  outletName: string;
  totalEmployees: number;
  activeShiftsCount: number;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onOpenPDF: () => void;
  onOpenAddModal: () => void;
  onOpenShiftModal: () => void;
  hasActiveShift: boolean;
}

export function EmployeesToolbar({
  outletName,
  totalEmployees,
  activeShiftsCount,
  onExportExcel,
  onExportCSV,
  onOpenPDF,
  onOpenAddModal,
  onOpenShiftModal,
  hasActiveShift,
}: EmployeesToolbarProps) {
  return (
    <PageHeader
      title="Karyawan"
      description={`Data staf, hak akses, dan shift kasir di ${outletName}.`}
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
            </DropdownMenuContent>
          </DropdownMenu>

          {!hasActiveShift && (
            <Button
              variant="outline"
              size="lg"
              onClick={onOpenShiftModal}
            >
              <Clock />
              <span>Buka shift</span>
            </Button>
          )}

          <Button size="lg" onClick={onOpenAddModal}>
            <Plus />
            Tambah staf
          </Button>
        </div>
      }
    />
  );
}
