import {
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Scale,
  Search,
} from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyIDR } from "@/lib/utils";
import type { StockOpnameRecord } from "@/types/inventory";

import { opnameReasonLabel } from "./inventory-domain";

interface InventoryOpnameTabProps {
  opnames: StockOpnameRecord[];
  totalSessions: number;
  totalVarianceUnits: number;
  totalVarianceValue: number;
  reasonFilter: string;
  searchQuery: string;
  onReasonFilterChange: (val: string) => void;
  onSearchChange: (query: string) => void;
  onExportCSV: () => void;
  onExportExcel: () => void;
  onOpenOpnameModal: () => void;
  onOpenOpnamePDFModal: () => void;
}

export function InventoryOpnameTab({
  opnames,
  totalSessions,
  totalVarianceUnits,
  totalVarianceValue,
  reasonFilter,
  searchQuery,
  onReasonFilterChange,
  onSearchChange,
  onExportCSV,
  onExportExcel,
  onOpenOpnameModal,
  onOpenOpnamePDFModal,
}: InventoryOpnameTabProps) {
  const hasRecords = opnames.length > 0;

  return (
    <div className="space-y-4">
      {/* Opname Metric Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total Sesi Audit Opname"
          value={`${totalSessions} Kali`}
          hint="Riwayat audit fisik gudang tercatat"
        />
        <StatCard
          label="Total Selisih Fisik"
          value={`${totalVarianceUnits > 0 ? `+${totalVarianceUnits}` : totalVarianceUnits} Satuan`}
          hint={
            totalVarianceUnits < 0
              ? "Akumulasi defisit stok barang"
              : totalVarianceUnits > 0
                ? "Akumulasi surplus barang"
                : "Stok fisik cocok dengan sistem"
          }
        />
        <StatCard
          label="Nilai Variansi / Kerugian"
          value={formatCurrencyIDR(Math.abs(totalVarianceValue))}
          hint={
            totalVarianceValue < 0 ? "Estimasi nilai kerugian bahan" : "Estimasi nilai selisih stok"
          }
        />
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari no. opname, bahan, atau auditor..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          <NativeSelect
            value={reasonFilter}
            onChange={(e) => onReasonFilterChange(e.target.value)}
            className="h-8 text-xs"
          >
            <option value="ALL">Semua Alasan Selisih</option>
            <option value="RECORDING_ERROR">Kesalahan Catat</option>
            <option value="WASTE">Waste Operasional</option>
            <option value="LOSS">Kehilangan / Hilang</option>
            <option value="DAMAGED">Kerusakan Fisik</option>
            <option value="EXPIRATION">Kadaluwarsa</option>
            <option value="SAMPLE_PROMO">Sample Promo</option>
            <option value="OTHER">Lainnya</option>
          </NativeSelect>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onExportExcel}
            className="h-8 gap-1.5 text-xs"
          >
            <FileSpreadsheet className="size-3.5 text-success" />
            <span>Excel</span>
          </Button>

          <Button variant="outline" size="sm" onClick={onExportCSV} className="h-8 gap-1.5 text-xs">
            <Download className="size-3.5 text-muted-foreground" />
            <span>CSV</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenOpnamePDFModal}
            className="h-8 gap-1.5 text-xs"
          >
            <FileText className="size-3.5 text-muted-foreground" />
            <span>Berita Acara PDF</span>
          </Button>

          <Button size="sm" onClick={onOpenOpnameModal} className="h-8 gap-1.5 text-xs">
            <Scale className="size-3.5" />
            <span>Audit Opname Baru</span>
          </Button>
        </div>
      </div>

      {/* Opname Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">No. Opname</TableHead>
              <TableHead>Tanggal Audit</TableHead>
              <TableHead>Bahan Baku</TableHead>
              <TableHead className="text-right">Stok Sistem</TableHead>
              <TableHead className="text-right">Stok Fisik</TableHead>
              <TableHead className="text-center">Selisih</TableHead>
              <TableHead>Alasan Selisih</TableHead>
              <TableHead>Catatan</TableHead>
              <TableHead>Auditor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!hasRecords ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12">
                  <EmptyState
                    icon={<ClipboardCheck className="size-6 text-muted-foreground" />}
                    title="Belum ada riwayat Stock Opname"
                    description="Lakukan audit fisik barang untuk menyelaraskan stok sistem dengan hitungan riil di gudang."
                  />
                </TableCell>
              </TableRow>
            ) : (
              opnames.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs font-medium tabular-nums text-foreground">
                    {o.opnameNumber}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{o.date}</TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{o.ingredientName}</div>
                    <span className="text-[10px] text-muted-foreground">{o.category}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right tabular-nums text-muted-foreground">
                    {o.systemStock} {o.unit}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right font-medium tabular-nums text-foreground">
                    {o.physicalStock} {o.unit}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={`font-mono text-[11px] tabular-nums ${
                        o.variance > 0
                          ? "border-success/30 bg-success/10 text-success"
                          : o.variance < 0
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-muted"
                      }`}
                    >
                      {o.variance > 0 ? `+${o.variance}` : o.variance} {o.unit}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{opnameReasonLabel(o.reason)}</TableCell>
                  <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                    {o.reasonNotes || "-"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{o.performedBy}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
