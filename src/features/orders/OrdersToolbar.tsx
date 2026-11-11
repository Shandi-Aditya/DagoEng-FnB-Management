import { Download, FileSpreadsheet, FileText } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

interface OrdersToolbarProps {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  canExportNominalReports: boolean;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onOpenPDF: () => void;
}

export function OrdersToolbar({
  pageSize,
  onPageSizeChange,
  canExportNominalReports,
  onExportExcel,
  onExportCSV,
  onOpenPDF,
}: OrdersToolbarProps) {
  return (
    <PageHeader
      title="Riwayat & Pelacakan Pesanan"
      description="Pelacakan waktu tunggu, status dapur, pembayaran, dan riwayat pesanan."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Tampilkan</span>
            <NativeSelect
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 w-20 text-xs font-mono"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </NativeSelect>
            <span>baris</span>
          </div>

          {canExportNominalReports ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onExportExcel}
                className="gap-1.5 text-xs"
              >
                <FileSpreadsheet className="size-3.5 text-success" />
                <span>Export Excel</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={onExportCSV}
                className="gap-1.5 text-xs"
              >
                <Download className="size-3.5 text-muted-foreground" />
                <span>Export CSV</span>
              </Button>

              <Button
                size="sm"
                onClick={onOpenPDF}
                className="gap-1.5 text-xs"
              >
                <FileText className="size-3.5" />
                <span>Cetak PDF</span>
              </Button>
            </>
          ) : null}
        </div>
      }
    />
  );
}
