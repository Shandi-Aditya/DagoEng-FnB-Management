import { FileSpreadsheet, Download, FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";

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
      description={`${totalMembers} member, poin, dan tier loyalty`}
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

          <Button
            size="sm"
            onClick={onOpenAddModal}
            className="gap-1.5 text-xs font-medium"
          >
            <Plus className="size-3.5" />
            <span>Tambah member</span>
          </Button>
        </div>
      }
    />
  );
}
