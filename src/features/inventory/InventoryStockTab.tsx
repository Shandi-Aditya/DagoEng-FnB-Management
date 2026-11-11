import {
  AlertTriangle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  History,
  Package,
  Search,
} from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { IngredientItem, StockAdjustmentLog } from "@/types/inventory";

import { stockStatusLabel, stockStatusTone } from "./inventory-domain";

interface InventoryStockTabProps {
  ingredients: IngredientItem[];
  allIngredientsCount: number;
  criticalItems: IngredientItem[];
  categories: string[];
  statusFilter: string;
  categoryFilter: string;
  searchQuery: string;
  currentPage: number;
  pageSize: number;
  logs: StockAdjustmentLog[];
  onStatusFilterChange: (val: string) => void;
  onCategoryFilterChange: (val: string) => void;
  onSearchChange: (query: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onResetFilters: () => void;
  onExportCSV: () => void;
  onExportExcel: () => void;
  onOpenRestockAlert: () => void;
  onOpenAdjustment: (item: IngredientItem) => void;
}

export function InventoryStockTab({
  ingredients,
  allIngredientsCount,
  criticalItems,
  categories,
  statusFilter,
  categoryFilter,
  searchQuery,
  currentPage,
  pageSize,
  logs,
  onStatusFilterChange,
  onCategoryFilterChange,
  onSearchChange,
  onPageChange,
  onPageSizeChange,
  onResetFilters,
  onExportCSV,
  onExportExcel,
  onOpenRestockAlert,
  onOpenAdjustment,
}: InventoryStockTabProps) {
  const isFiltered = statusFilter !== "ALL" || categoryFilter !== "ALL" || searchQuery.trim() !== "";
  const totalPages = Math.max(1, Math.ceil(allIngredientsCount / pageSize));
  const hasItems = ingredients.length > 0;

  return (
    <div className="space-y-4">
      {/* Restock Alert Banner */}
      {criticalItems.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-destructive" />
            <span>
              Perhatian: Ada{" "}
              <strong className="font-semibold">{criticalItems.length} bahan baku</strong> dengan
              stok habis atau kritis.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenRestockAlert}
            className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            Lihat Rekomendasi Restock
          </Button>
        </div>
      ) : null}

      {/* Controls Bar */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari bahan atau pemasok"
              className="h-8 pl-8 text-xs"
            />
          </div>

          <NativeSelect
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="h-8 text-xs"
          >
            <option value="ALL">Semua kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>

          <NativeSelect
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="h-8 text-xs"
          >
            <option value="ALL">Semua status</option>
            <option value="SAFE">Aman</option>
            <option value="LOW">Menipis</option>
            <option value="CRITICAL">Kritis</option>
            <option value="OUT_OF_STOCK">Habis</option>
          </NativeSelect>

          {isFiltered ? (
            <Button variant="ghost" size="sm" onClick={onResetFilters} className="h-8 text-xs">
              Reset Filter
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Baris</span>
            <NativeSelect
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 w-16 text-xs font-mono"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </NativeSelect>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onExportExcel}
            className="h-8 gap-1.5 text-xs"
          >
            <FileSpreadsheet className="size-3.5 text-success" />
            <span className="hidden sm:inline">Excel</span>
          </Button>

          <Button variant="outline" size="sm" onClick={onExportCSV} className="h-8 gap-1.5 text-xs">
            <Download className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </div>

      {/* Stock Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Bahan</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Stok</TableHead>
              <TableHead>HPP</TableHead>
              <TableHead>Nilai stok</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pemasok</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!hasItems ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12">
                  <EmptyState
                    icon={<Package className="size-6 text-muted-foreground" />}
                    title="Bahan tidak ditemukan"
                    description="Ubah kata kunci atau filter."
                  />
                </TableCell>
              </TableRow>
            ) : (
              ingredients.map((item) => {
                const stockPercent = Math.min(100, Math.round((item.stockNumber / item.min) * 100));

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{item.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{item.id}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[11px]">
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-mono text-xs font-medium tabular-nums text-foreground">
                          {item.stockNumber}{" "}
                          <span className="text-[11px] text-muted-foreground">{item.unit}</span>
                        </div>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full ${
                              stockPercent <= 30
                                ? "bg-destructive"
                                : stockPercent <= 70
                                  ? "bg-warning"
                                  : "bg-success"
                            }`}
                            style={{ width: `${Math.max(5, stockPercent)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">Min {item.min}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums text-foreground">
                      {formatCurrencyIDR(item.costPerUnit)}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium tabular-nums text-foreground">
                      {formatCurrencyIDR(item.stockNumber * item.costPerUnit)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={stockStatusTone(item.status)}>
                        {stockStatusLabel(item.status)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.supplier}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenAdjustment(item)}
                        className="h-8 gap-1 text-xs"
                      >
                        <ArrowUpDown className="size-3 text-muted-foreground" />
                        <span>Sesuaikan</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Bar */}
      {hasItems ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
          <div>
            Menampilkan{" "}
            <span className="font-mono font-medium text-foreground">
              {(currentPage - 1) * pageSize + 1}
            </span>
            –
            <span className="font-mono font-medium text-foreground">
              {Math.min(currentPage * pageSize, allIngredientsCount)}
            </span>{" "}
            dari{" "}
            <span className="font-mono font-medium text-foreground">{allIngredientsCount}</span>{" "}
            bahan
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="h-8 gap-1 px-2 text-xs"
            >
              <ChevronLeft className="size-3.5" />
              <span>Sebelumnya</span>
            </Button>
            <span className="px-2 font-mono tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="h-8 gap-1 px-2 text-xs"
            >
              <span>Berikutnya</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* Real-time Movement Logs */}
      {logs.length > 0 ? (
        <Card>
          <CardHeader className="py-3 border-b bg-muted/20">
            <CardTitle className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <History className="size-3.5 text-muted-foreground" />
              <span>Perubahan stok terakhir</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {logs.slice(0, 8).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between text-xs py-1 border-b border-muted/50 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono font-medium ${
                        log.delta > 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {log.delta > 0 ? `+${log.delta}` : log.delta}
                    </span>
                    <span className="font-medium text-foreground">{log.ingredientName}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {log.reason}
                    </Badge>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
