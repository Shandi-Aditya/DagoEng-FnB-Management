import { useState, useMemo } from "react";
import {
  Clock,
  Printer,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ShiftRecord } from "@/types/shift";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { filterShifts, getShiftStatusTone } from "./employees-domain";

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

  return (
    <div className="space-y-4">
      {/* Active Shift Card */}
      {activeShift ? (
        <Card className="border-info/40 bg-info/5">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary animate-pulse" />
                <CardTitle className="text-sm font-medium text-foreground">
                  Shift Aktif: {activeShift.shiftName}
                </CardTitle>
                <StatusBadge status="info" className="text-xs">
                  Sedang berjalan
                </StatusBadge>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={onOpenCloseShiftModal}
                className="text-xs h-7 self-start sm:self-auto"
              >
                Tutup Shift & Rekonsiliasi
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
            <div>
              <span className="text-muted-foreground block text-[10px]">Kasir</span>
              <span className="font-medium text-foreground">
                {activeShift.assignedCashierName}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Dibuka</span>
              <span className="font-mono text-muted-foreground">{activeShift.startTime}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Modal awal</span>
              <span className="font-mono font-medium text-foreground">
                {formatCurrencyIDR(activeShift.openingCash)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Penjualan sejauh ini</span>
              <span className="font-mono font-medium text-foreground">
                {formatCurrencyIDR((activeShift.cashSales || 0) + (activeShift.nonCashSales || 0))}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Belum ada shift kasir yang dibuka di outlet ini.</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenStartShiftModal}
              className="text-xs h-7"
            >
              Buka Shift Kasir
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Controls Bar */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari shift atau kasir"
              className="h-8 pl-8 text-xs"
            />
          </div>

          <NativeSelect
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 text-xs font-medium"
          >
            <option value="ALL">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="CLOSED">Ditutup</option>
            <option value="NEEDS_RECONCILIATION">Selisih kas</option>
          </NativeSelect>

          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset filter
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Baris</span>
            <NativeSelect
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-8 w-16 text-xs font-mono"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </NativeSelect>
          </div>
        </div>
      </div>

      {/* Shifts History Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Shift</TableHead>
                <TableHead>Kasir</TableHead>
                <TableHead>Jam operasional</TableHead>
                <TableHead className="text-right">Modal awal</TableHead>
                <TableHead className="text-right">Penjualan</TableHead>
                <TableHead className="text-right">Kas fisik</TableHead>
                <TableHead className="text-right">Selisih kas</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedShifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center">
                    <EmptyState
                      icon={<Clock className="w-8 h-8 text-muted-foreground" />}
                      title="Belum ada shift"
                      description={
                        isFiltered
                          ? "Tidak ada shift kasir yang cocok dengan filter pencarian."
                          : "Shift kasir yang telah dibuka atau ditutup akan tercatat secara otomatis di sini."
                      }
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
                          <p className="text-foreground leading-snug">{s.shiftName}</p>
                          <p className="font-mono text-primary text-[11px]">{s.id}</p>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs font-medium text-foreground">
                        {s.assignedCashierName}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        <p>{s.startTime}</p>
                        <p className="text-[10px]">
                          s/d {s.closedAt || s.endTime || "sekarang"}
                        </p>
                      </TableCell>

                      <TableCell className="text-right font-mono font-medium tabular-nums text-xs text-foreground">
                        {formatCurrencyIDR(s.openingCash)}
                      </TableCell>

                      <TableCell className="text-right font-mono font-medium tabular-nums text-xs text-foreground">
                        {formatCurrencyIDR(totalSales)}
                      </TableCell>

                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {s.actualCash !== undefined ? formatCurrencyIDR(s.actualCash) : "-"}
                      </TableCell>

                      <TableCell
                        className={`text-right font-mono text-xs tabular-nums ${
                          hasVariance
                            ? s.cashVariance! < 0
                              ? "text-destructive font-medium"
                              : "text-emerald-600 font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {s.cashVariance !== undefined ? formatCurrencyIDR(s.cashVariance) : "-"}
                      </TableCell>

                      <TableCell className="text-center">
                        <StatusBadge status={tone} className="text-xs">
                          {s.status === "ACTIVE" || s.status === "OPEN"
                            ? "Aktif"
                            : s.status === "CLOSED"
                            ? "Selesai"
                            : s.status === "NEEDS_RECONCILIATION"
                            ? "Selisih"
                            : s.status}
                        </StatusBadge>
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenClosingPDF(s)}
                          className="h-7 px-2 text-xs font-medium gap-1"
                        >
                          <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>PDF</span>
                        </Button>
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
          <div>
            Menampilkan{" "}
            <span className="font-mono font-medium text-foreground">
              {Math.min((safeCurrentPage - 1) * pageSize + 1, filteredShifts.length)}
            </span>{" "}
            sampai{" "}
            <span className="font-mono font-medium text-foreground">
              {Math.min(safeCurrentPage * pageSize, filteredShifts.length)}
            </span>{" "}
            dari{" "}
            <span className="font-mono font-medium text-foreground">
              {filteredShifts.length}
            </span>{" "}
            shift
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="size-8"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="px-2 font-mono text-xs">
              {safeCurrentPage} / {totalPages}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="size-8"
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
