import { FileSpreadsheet, Download, FileText, Plus, PowerOff } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";

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
      title={`Kontrak Komersial & Retail · ${outletName}`}
      description="Manajemen kontrak tenant retail, unit lot komersial, dan penagihan berkala."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onExportExcel}
            className="gap-1.5 text-xs"
          >
            <FileSpreadsheet className="size-3.5 text-success" />
            <span>Export Excel</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onExportCSV}
            className="gap-1.5 text-xs"
          >
            <Download className="size-3.5 text-muted-foreground" />
            <span>Export CSV</span>
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

          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleModule}
            className="gap-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            <PowerOff className="size-3.5" />
            <span>Nonaktifkan</span>
          </Button>

          <Button
            size="sm"
            onClick={onOpenCreateModal}
            className="gap-1.5 text-xs font-medium"
          >
            <Plus className="size-3.5" />
            <span>Tambah Kontrak</span>
          </Button>
        </div>
      }
    />
  );
}
