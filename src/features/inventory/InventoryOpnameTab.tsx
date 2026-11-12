import {
  ChevronDown,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
} from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatCurrencyIDR } from "@/lib/utils";
import type { StockOpnameRecord } from "@/types/inventory";

import { OPNAME_REASONS, opnameReasonLabel } from "./inventory-domain";
import { ingredientCategoryLabel } from "./inventory-reorder";

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

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function varianceHint(units: number): string {
  if (units < 0) return "satuan, fisik lebih sedikit";
  if (units > 0) return "satuan, fisik lebih banyak";
  return "fisik cocok dengan sistem";
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
  const isFiltered = reasonFilter !== "ALL" || searchQuery.trim() !== "";

  return (
    <div className="flex flex-col gap-4">
      {totalSessions > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Opname"
            value={String(totalSessions)}
            hint="kali dicatat"
          />
          <StatCard
            label="Selisih fisik"
            value={signed(totalVarianceUnits)}
            hint={varianceHint(totalVarianceUnits)}
          />
          <StatCard
            label="Nilai selisih"
            value={formatCurrencyIDR(Math.abs(totalVarianceValue))}
            hint={
              totalVarianceValue < 0
                ? "perkiraan kerugian"
                : "perkiraan nilai selisih"
            }
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari nomor, bahan, atau petugas"
            aria-label="Cari opname"
          />
        </InputGroup>
        <NativeSelect
          value={reasonFilter}
          onChange={(e) => onReasonFilterChange(e.target.value)}
          aria-label="Alasan"
        >
          <NativeSelectOption value="ALL">Semua alasan</NativeSelectOption>
          {OPNAME_REASONS.map((reason) => (
            <NativeSelectOption key={reason} value={reason}>
              {opnameReasonLabel(reason)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <div className="flex items-center gap-2 sm:ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              Ekspor
              <ChevronDown className="text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem onClick={onOpenOpnamePDFModal}>
                <FileText />
                Berita acara PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onExportExcel}>
                <FileSpreadsheet />
                Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportCSV}>
                <Download />
                CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={onOpenOpnameModal}>Catat opname</Button>
        </div>
      </div>

      {opnames.length === 0 ? (
        <EmptyState
          className="border"
          icon={<ClipboardCheck />}
          title={isFiltered ? "Opname tidak ditemukan" : "Belum ada opname"}
          description={
            isFiltered
              ? "Ubah kata kunci atau alasan."
              : "Hitung stok fisik untuk mencocokkan angka di sistem dengan isi gudang."
          }
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bahan</TableHead>
                <TableHead className="hidden md:table-cell text-right">
                  Sistem
                </TableHead>
                <TableHead className="text-right">Fisik</TableHead>
                <TableHead className="text-right">Selisih</TableHead>
                <TableHead className="hidden sm:table-cell">Alasan</TableHead>
                <TableHead className="hidden lg:table-cell">Petugas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opnames.map((opname) => (
                <TableRow key={opname.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {opname.ingredientName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        <span className="font-mono tabular-nums">
                          {opname.opnameNumber}
                        </span>{" "}
                        · {opname.date} ·{" "}
                        {ingredientCategoryLabel(opname.category)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right font-mono text-muted-foreground tabular-nums">
                    {opname.systemStock} {opname.unit}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {opname.physicalStock} {opname.unit}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono tabular-nums",
                      opname.variance > 0 && "text-success",
                      opname.variance < 0 && "text-destructive",
                    )}
                  >
                    {signed(opname.variance)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex flex-col">
                      <span>{opnameReasonLabel(opname.reason)}</span>
                      {opname.reasonNotes ? (
                        <span className="max-w-48 truncate text-xs text-muted-foreground">
                          {opname.reasonNotes}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {opname.performedBy}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
