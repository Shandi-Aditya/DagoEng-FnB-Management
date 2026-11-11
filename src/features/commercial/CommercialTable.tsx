import { useState, useMemo, useEffect } from "react";
import { Search, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import type { CommercialLease } from "@/types/commercial";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { getLeaseStatusTone, getLeaseStatusLabel } from "./commercial-domain";

export interface CommercialTableProps {
  leases: CommercialLease[];
  searchTerm: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onSelectLease: (lease: CommercialLease) => void;
  onOpenPaymentModal: (lease: CommercialLease) => void;
}

const STATUS_OPTIONS = [
  { value: "ALL", label: "Semua status" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "EXPIRING_SOON", label: "Segera berakhir" },
  { value: "EXPIRED", label: "Berakhir" },
  { value: "TERMINATED", label: "Dibatalkan" },
];

export function CommercialTable({
  leases,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onSelectLease,
  onOpenPaymentModal,
}: CommercialTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [leases.length, searchTerm, statusFilter]);

  const isFiltered = searchTerm.trim() !== "" || statusFilter !== "ALL";

  const handleResetFilters = () => {
    onSearchChange("");
    onStatusFilterChange("ALL");
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(leases.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLeases = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return leases.slice(start, start + pageSize);
  }, [leases, safeCurrentPage, pageSize]);

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari penyewa, nomor kontrak, atau unit"
              className="h-8 pl-8 text-xs"
            />
          </div>

          <NativeSelect
            value={statusFilter}
            onChange={(e) => {
              onStatusFilterChange(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 text-xs font-medium"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
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
            <span>baris</span>
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

      {/* Leases Table Card */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Penyewa</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Luas</TableHead>
                <TableHead>Sewa</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLeases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <EmptyState
                      icon={<Building2 className="w-8 h-8 text-muted-foreground" />}
                      title="Kontrak tidak ditemukan"
                      description={
                        searchTerm
                          ? `Tidak ada kontrak yang cocok dengan "${searchTerm}".`
                          : "Belum ada kontrak sewa di outlet ini."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLeases.map((lease) => {
                  const tone = getLeaseStatusTone(lease.status);
                  const label = getLeaseStatusLabel(lease.status);

                  return (
                    <TableRow key={lease.id}>
                      <TableCell className="font-medium">
                        <div className="space-y-0.5">
                          <p className="text-foreground leading-snug">{lease.tenantName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {lease.tenantContact} ·{" "}
                            <span className="font-mono text-primary font-medium">
                              {lease.leaseNumber}
                            </span>
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="font-medium text-foreground text-xs">
                        {lease.unitCode}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {lease.areaSquareMeters} m²
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5 text-xs">
                          <p className="font-mono font-medium tabular-nums text-foreground">
                            {formatCurrencyIDR(lease.monthlyRent)}
                            <span className="text-[10px] font-normal text-muted-foreground">/bln</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Deposit: {formatCurrencyIDR(lease.depositAmount)}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5 text-xs">
                          <p className="text-foreground">
                            {lease.startDate} s/d {lease.endDate}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Jadwal: {lease.paymentSchedule}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <StatusBadge status={tone} className="text-xs">
                          {label}
                        </StatusBadge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onSelectLease(lease)}
                            className="h-7 px-2 text-xs font-medium"
                          >
                            Detail
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onOpenPaymentModal(lease)}
                            className="h-7 px-2 text-xs font-medium"
                          >
                            Bayar
                          </Button>
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
      {leases.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
          <div>
            Menampilkan{" "}
            <span className="font-mono font-medium text-foreground">
              {Math.min((safeCurrentPage - 1) * pageSize + 1, leases.length)}
            </span>{" "}
            sampai{" "}
            <span className="font-mono font-medium text-foreground">
              {Math.min(safeCurrentPage * pageSize, leases.length)}
            </span>{" "}
            dari{" "}
            <span className="font-mono font-medium text-foreground">
              {leases.length}
            </span>{" "}
            kontrak
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
