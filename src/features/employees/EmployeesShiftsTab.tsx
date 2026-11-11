"use client";

import { useMemo, useState } from "react";
import { Clock, Printer, Search } from "lucide-react";

import { DataPagination } from "@/components/app/data-pagination";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ShiftRecord } from "@/types/shift";
import { formatCurrencyIDR } from "@/lib/utils";

import {
  emptyShiftMessage,
  filterShifts,
  getShiftStatusLabel,
  getShiftStatusTone,
} from "./employees-domain";

export interface EmployeesShiftsTabProps {
  shifts: ShiftRecord[];
  activeShift: ShiftRecord | null;
  onOpenCloseShiftModal: () => void;
  onOpenStartShiftModal: () => void;
  onOpenClosingPDF: (shift: ShiftRecord) => void;
}

export function EmployeesShiftsTab({
  shifts,
  activeShift,
  onOpenCloseShiftModal,
  onOpenStartShiftModal,
  onOpenClosingPDF,
}: EmployeesShiftsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const isFiltered = searchQuery.trim() !== "" || statusFilter !== "ALL";

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setCurrentPage(1);
  };

  const filteredShifts = useMemo(() => {
    return filterShifts(shifts, searchQuery, statusFilter);
  }, [shifts, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredShifts.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedShifts = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredShifts.slice(start, start + pageSize);
  }, [filteredShifts, safeCurrentPage, pageSize]);

  const emptyCopy = emptyShiftMessage(isFiltered);

  return (
    <div className="space-y-4">
      {/* Active Shift Card */}
      {activeShift ? (
        <Card className="border-info/40 bg-info/5">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Clock className="size-4 animate-pulse text-primary" />
                <CardTitle className="text-sm font-medium text-foreground">
                  Shift aktif: {activeShift.shiftName}
                </CardTitle>
                <StatusBadge status="info" className="text-xs">
                  Sedang berjalan
                </StatusBadge>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={onOpenCloseShiftModal}
                className="self-start sm:self-auto"
              >
                Tutup shift
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 pt-2 text-xs sm:grid-cols-4">
            <div>
              <span className="block text-xs text-muted-foreground">Kasir</span>
              <span className="font-medium text-foreground">
                {activeShift.assignedCashierName}
              </span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Dibuka</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {activeShift.startTime}
              </span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Modal awal</span>
              <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                {formatCurrencyIDR(activeShift.openingCash)}
              </span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Penjualan berjalan</span>
              <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                {formatCurrencyIDR((activeShift.cashSales || 0) + (activeShift.nonCashSales || 0))}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-4" />
              <span>Belum ada shift kasir yang dibuka di outlet ini.</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenStartShiftModal}
            >
              Buka shift kasir
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Controls Bar */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <InputGroup className="max-w-xs flex-1">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari shift atau kasir"
              aria-label="Cari shift"
            />
          </InputGroup>

          <NativeSelect
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter status shift"
          >
            <option value="ALL">Semua status</option>
            <option value="ACTIVE">Sedang berjalan</option>
            <option value="CLOSED">Ditutup</option>
            <option value="NEEDS_RECONCILIATION">Selisih kas</option>
          </NativeSelect>

          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
            >
              Reset filter
            </Button>
          )}
        </div>
      </div>

      {/* Shifts History Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Shift & Kasir</TableHead>
                <TableHead>Jam operasional</TableHead>
                <TableHead className="text-right">Modal awal</TableHead>
                <TableHead className="text-right">Penjualan</TableHead>
                <TableHead className="text-right">Kas fisik & Selisih</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Aksi</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedShifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <EmptyState
                      icon={<Clock className="size-8 text-muted-foreground" />}
                      title={emptyCopy.title}
                      description={emptyCopy.description}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginatedShifts.map((s) => {
                  const tone = getShiftStatusTone(s.status);
                  const totalSales = (s.cashSales || 0) + (s.nonCashSales || 0);
                  const hasVariance = s.cashVariance !== undefined && s.cashVariance !== 0;

                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <div className="space-y-0.5">
                          <p className="leading-snug text-foreground">{s.shiftName}</p>
                          <p className="text-xs text-muted-foreground">{s.assignedCashierName}</p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-mono text-xs font-medium tabular-nums text-foreground">
                            {s.startTime}
                          </p>
                          <p className="font-mono text-xs tabular-nums text-muted-foreground">
                            {s.closedAt || s.endTime || "Belum ditutup"}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-mono text-xs font-medium tabular-nums text-foreground">
                        {formatCurrencyIDR(s.openingCash || 0)}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="space-y-0.5">
                          <p className="font-mono text-xs font-medium tabular-nums text-foreground">
                            {formatCurrencyIDR(totalSales)}
                          </p>
                          <p className="font-mono text-xs tabular-nums text-muted-foreground">
                            Tunai: {formatCurrencyIDR(s.cashSales || 0)}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="space-y-0.5">
                          <p className="font-mono text-xs font-medium tabular-nums text-foreground">
                            {s.actualCash !== undefined ? formatCurrencyIDR(s.actualCash) : "—"}
                          </p>
                          {hasVariance ? (
                            <p className="font-mono text-xs font-medium tabular-nums text-destructive">
                              Selisih: {formatCurrencyIDR(s.cashVariance || 0)}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Sesuai</p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={tone}>
                          {getShiftStatusLabel(s.status)}
                        </StatusBadge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {s.status === "CLOSED" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onOpenClosingPDF(s)}
                            >
                              <Printer />
                              <span>Struk</span>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={onOpenCloseShiftModal}
                            >
                              Tutup shift
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Bar */}
      {filteredShifts.length > 0 && (
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
      )}
    </div>
  );
}
