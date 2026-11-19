"use client";

import { useMemo, useState } from "react";
import { Clock, Printer } from "lucide-react";

import { DataPagination } from "@/components/app/data-pagination";
import { DataTableToolbar } from "@/components/app/data-table-toolbar";
import { EmptyState } from "@/components/app/empty-state";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyIDR } from "@/lib/utils";
import type { ShiftRecord } from "@/types/shift";

import {
  emptyShiftMessage,
  filterShifts,
  formatShiftWitaTimestamp,
  getShiftStatusLabel,
  getShiftStatusTone,
} from "./employees-domain";

export interface EmployeesShiftsTabProps {
  shifts: ShiftRecord[];
  activeShift: ShiftRecord | null;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (val: string) => void;
  dateFilter?: string;
  onDateFilterChange?: (val: string) => void;
  onOpenCloseShiftModal: (shift: ShiftRecord) => void;
  onOpenStartShiftModal: () => void;
  onOpenClosingPDF: (shift: ShiftRecord) => void;
}

export function EmployeesShiftsTab({
  shifts,
  activeShift,
  searchQuery: controlledSearch,
  onSearchChange,
  statusFilter: controlledStatus,
  onStatusFilterChange,
  dateFilter: controlledDate,
  onDateFilterChange,
  onOpenCloseShiftModal,
  onOpenStartShiftModal,
  onOpenClosingPDF,
}: EmployeesShiftsTabProps) {
  const [localSearch, setLocalSearch] = useState("");
  const [localStatus, setLocalStatus] = useState("ALL");
  const [localDate, setLocalDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const searchQuery = controlledSearch ?? localSearch;
  const statusFilter = controlledStatus ?? localStatus;
  const dateFilter = controlledDate ?? localDate;

  const updateSearch = (val: string) => {
    if (onSearchChange) onSearchChange(val);
    else setLocalSearch(val);
    setCurrentPage(1);
  };
  const updateStatus = (val: string) => {
    if (onStatusFilterChange) onStatusFilterChange(val);
    else setLocalStatus(val);
    setCurrentPage(1);
  };
  const updateDate = (val: string) => {
    if (onDateFilterChange) onDateFilterChange(val);
    else setLocalDate(val);
    setCurrentPage(1);
  };

  const isFiltered =
    searchQuery.trim() !== "" || statusFilter !== "ALL" || dateFilter !== "";

  const handleResetFilters = () => {
    updateSearch("");
    updateStatus("ALL");
    updateDate("");
    setCurrentPage(1);
  };

  const filteredShifts = useMemo(() => {
    return filterShifts(shifts, searchQuery, statusFilter, dateFilter);
  }, [shifts, searchQuery, statusFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredShifts.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedShifts = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredShifts.slice(start, start + pageSize);
  }, [filteredShifts, safeCurrentPage, pageSize]);

  const emptyCopy = emptyShiftMessage(isFiltered);

  return (
    <div className="flex flex-col gap-4">
      {/* Active Shift Card */}
      {activeShift ? (
        <Card size="sm" className="border-info/40 bg-info/5">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Clock className="size-4 animate-pulse text-primary" aria-hidden />
                <CardTitle className="text-sm font-medium text-foreground">
                  Shift aktif: {activeShift.shiftName}
                </CardTitle>
                <StatusBadge status="info">Sedang berjalan</StatusBadge>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenCloseShiftModal(activeShift)}
                className="self-start sm:self-auto"
              >
                Tutup shift
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <span className="block text-muted-foreground">Kasir</span>
              <span className="font-medium text-foreground">
                {activeShift.assignedCashierName}
              </span>
            </div>
            <div>
              <span className="block text-muted-foreground">Dibuka</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {formatShiftWitaTimestamp(activeShift.startTime)}
              </span>
            </div>
            <div>
              <span className="block text-muted-foreground">Modal awal</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatCurrencyIDR(activeShift.openingCash)}
              </span>
            </div>
            <div>
              <span className="block text-muted-foreground">Penjualan berjalan</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatCurrencyIDR((activeShift.cashSales || 0) + (activeShift.nonCashSales || 0))}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card size="sm" className="border-dashed bg-muted/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-4" aria-hidden />
              <span>Belum ada shift kasir yang dibuka di outlet ini.</span>
            </div>
            <Button size="sm" variant="outline" onClick={onOpenStartShiftModal}>
              Buka shift kasir
            </Button>
          </CardContent>
        </Card>
      )}

      <DataTableToolbar
        searchValue={searchQuery}
        onSearchChange={updateSearch}
        searchPlaceholder="Cari shift atau kasir"
        searchAriaLabel="Cari shift"
        hasActiveFilters={isFiltered}
        onResetFilters={handleResetFilters}
      >
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => updateDate(e.target.value)}
          aria-label="Filter tanggal shift"
          className="w-38"
        />
        <NativeSelect
          value={statusFilter}
          onChange={(e) => updateStatus(e.target.value)}
          aria-label="Filter status shift"
        >
          <NativeSelectOption value="ALL">Semua status</NativeSelectOption>
          <NativeSelectOption value="ACTIVE">Sedang berjalan</NativeSelectOption>
          <NativeSelectOption value="CLOSED">Ditutup</NativeSelectOption>
          <NativeSelectOption value="NEEDS_RECONCILIATION">Selisih kas</NativeSelectOption>
        </NativeSelect>
      </DataTableToolbar>

      {paginatedShifts.length === 0 ? (
        <EmptyState
          className="border"
          icon={<Clock />}
          title={emptyCopy.title}
          description={emptyCopy.description}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shift</TableHead>
                  <TableHead className="hidden lg:table-cell">Jam operasional</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Modal awal</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Penjualan</TableHead>
                  <TableHead className="text-right">Kas fisik</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedShifts.map((s) => {
                  const tone = getShiftStatusTone(s.status);
                  const totalSales = (s.cashSales || 0) + (s.nonCashSales || 0);
                  const hasVariance = s.cashVariance !== undefined && s.cashVariance !== 0;

                  return (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-normal">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">{s.shiftName}</span>
                          <span className="text-xs text-muted-foreground">
                            {s.assignedCashierName}
                          </span>
                          <span className="text-xs text-muted-foreground sm:hidden">
                            {getShiftStatusLabel(s.status)} · {formatShiftWitaTimestamp(s.startTime)}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                            {formatShiftWitaTimestamp(s.startTime)}
                          </span>
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {s.closedAt || s.endTime
                              ? formatShiftWitaTimestamp(s.closedAt || s.endTime)
                              : "Belum ditutup"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="hidden md:table-cell text-right font-mono text-xs font-medium tabular-nums text-foreground">
                        {formatCurrencyIDR(s.openingCash || 0)}
                      </TableCell>

                      <TableCell className="hidden sm:table-cell text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                            {formatCurrencyIDR(totalSales)}
                          </span>
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            Tunai {formatCurrencyIDR(s.cashSales || 0)}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                            {s.actualCash !== undefined ? formatCurrencyIDR(s.actualCash) : "—"}
                          </span>
                          {hasVariance ? (
                            <span className="font-mono text-xs font-medium tabular-nums text-destructive">
                              Selisih {formatCurrencyIDR(s.cashVariance || 0)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sesuai</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="hidden sm:table-cell">
                        <StatusBadge status={tone}>{getShiftStatusLabel(s.status)}</StatusBadge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          {s.status === "CLOSED" || s.status === "NEEDS_RECONCILIATION" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onOpenClosingPDF(s)}
                              aria-label={`Cetak struk ${s.shiftName}`}
                            >
                              <Printer />
                              <span className="hidden sm:inline">Struk</span>
                            </Button>
                          ) : null}
                          {s.status !== "CLOSED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onOpenCloseShiftModal(s)}
                            >
                              Tutup
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            currentPage={safeCurrentPage}
            totalItems={filteredShifts.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            itemLabel="shift"
          />
        </div>
      )}
    </div>
  );
}
