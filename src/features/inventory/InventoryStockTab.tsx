"use client";

import { ArrowUpDown, History, Package, Search } from "lucide-react";

import { DataPagination } from "@/components/app/data-pagination";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrencyIDR } from "@/lib/utils";
import type { IngredientItem, StockAdjustmentLog } from "@/types/inventory";

import { stockStatusLabel, stockStatusTone } from "./inventory-domain";
import { adjustmentReasonLabel, ingredientCategoryLabel } from "./inventory-reorder";

const RECENT_LOG_LIMIT = 8;
const STATUS_OPTIONS = [
  { value: "ALL", label: "Semua status" },
  { value: "SAFE", label: "Aman" },
  { value: "LOW", label: "Menipis" },
  { value: "CRITICAL", label: "Kritis" },
  { value: "OUT_OF_STOCK", label: "Habis" },
] as const;

interface InventoryStockTabProps {
  ingredients: IngredientItem[];
  allIngredientsCount: number;
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
  onOpenAdjustment: (item: IngredientItem) => void;
}

/** Stock level bar: how full the item is relative to twice its minimum. */
function StockLevel({ item }: { item: IngredientItem }) {
  const ratio = item.min > 0 ? item.stockNumber / (item.min * 2) : 1;
  const percent = Math.max(4, Math.min(100, Math.round(ratio * 100)));
  return (
    <div className="flex flex-col gap-1">
      <span>
        <span className="font-mono tabular-nums">{item.stockNumber}</span>{" "}
        <span className="text-xs text-muted-foreground">{item.unit}</span>
      </span>
      <span className="h-1 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span
          className={cn("block h-full", item.stockNumber <= item.min ? "bg-warning" : "bg-muted-foreground/60", item.stockNumber <= 0 && "bg-destructive")}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="text-xs text-muted-foreground">Minimum {item.min}</span>
    </div>
  );
}

export function InventoryStockTab({
  ingredients,
  allIngredientsCount,
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
  onOpenAdjustment,
}: InventoryStockTabProps) {
  const isFiltered = statusFilter !== "ALL" || categoryFilter !== "ALL" || searchQuery.trim() !== "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari bahan atau pemasok"
            aria-label="Cari bahan"
          />
        </InputGroup>
        <NativeSelect value={categoryFilter} onChange={(e) => onCategoryFilterChange(e.target.value)} aria-label="Kategori">
          <NativeSelectOption value="ALL">Semua kategori</NativeSelectOption>
          {categories.map((category) => (
            <NativeSelectOption key={category} value={category}>
              {ingredientCategoryLabel(category)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)} aria-label="Status stok">
          {STATUS_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {isFiltered ? (
          <Button variant="ghost" size="sm" onClick={onResetFilters}>
            Hapus filter
          </Button>
        ) : null}
      </div>

      {ingredients.length === 0 ? (
        <EmptyState
          className="border"
          icon={<Package />}
          title={isFiltered ? "Bahan tidak ditemukan" : "Belum ada bahan"}
          description={isFiltered ? "Ubah kata kunci atau filter." : "Tambahkan bahan di Pengaturan untuk mulai mencatat stok."}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bahan</TableHead>
                  <TableHead>Stok</TableHead>
                  <TableHead className="hidden md:table-cell text-right">HPP</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Nilai stok</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-col">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {ingredientCategoryLabel(item.category)} · {item.supplier}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StockLevel item={item} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right font-mono tabular-nums">
                      {formatCurrencyIDR(item.costPerUnit)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right font-mono tabular-nums">
                      {formatCurrencyIDR(item.stockNumber * item.costPerUnit)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <StatusBadge status={stockStatusTone(item.status)}>{stockStatusLabel(item.status)}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => onOpenAdjustment(item)} aria-label={`Sesuaikan stok ${item.name}`}>
                        <ArrowUpDown />
                        <span className="hidden sm:inline">Sesuaikan</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DataPagination
            currentPage={currentPage}
            totalItems={allIngredientsCount}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            itemLabel="bahan"
          />
        </div>
      )}

      {logs.length > 0 ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <History className="size-4 text-muted-foreground" aria-hidden />
              Perubahan stok terakhir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y text-sm">
              {logs.slice(0, RECENT_LOG_LIMIT).map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("w-12 shrink-0 font-mono tabular-nums", log.delta > 0 ? "text-success" : "text-destructive")}>
                      {log.delta > 0 ? `+${log.delta}` : log.delta}
                    </span>
                    <span className="truncate">{log.ingredientName}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">{adjustmentReasonLabel(log.reason)}</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {new Date(log.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
