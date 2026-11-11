import { FileSpreadsheet, Download, FileText, UserPlus, Clock } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";

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
      description="Data staf, hak akses, dan shift kasir."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onExportExcel}
            className="gap-1.5 text-xs"
          >
            <FileSpreadsheet className="size-3.5 text-success" />
            <span>Ekspor Excel</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onExportCSV}
            className="gap-1.5 text-xs"
          >
            <Download className="size-3.5 text-muted-foreground" />
            <span>Ekspor CSV</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onOpenPDF}
            className="gap-1.5 text-xs"
          >
            <FileText className="size-3.5 text-muted-foreground" />
            <span>Cetak PDF</span>
          </Button>

          {!hasActiveShift && (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenShiftModal}
              className="gap-1.5 text-xs text-primary"
            >
              <Clock className="size-3.5 text-primary" />
              <span>Buka shift</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={onOpenAddModal}
            className="gap-1.5 text-xs font-medium"
          >
            <UserPlus className="size-3.5" />
            <span>Tambah staf</span>
          </Button>
        </div>
      }
    />
  );
}
