"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CreditCard, Eye } from "lucide-react";

import { DataPagination } from "@/components/app/data-pagination";
import { DataTableToolbar } from "@/components/app/data-table-toolbar";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
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
import type { CommercialLease } from "@/types/commercial";

import {
  emptyCommercialMessage,
  getLeaseStatusLabel,
  getLeaseStatusTone,
  paymentScheduleLabel,
} from "./commercial-domain";

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
  { value: "DRAFT", label: "Draf" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "EXPIRING_SOON", label: "Segera berakhir" },
  { value: "EXPIRED", label: "Berakhir" },
  { value: "TERMINATED", label: "Diakhiri" },
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

  const emptyCopy = emptyCommercialMessage(isFiltered);

  return (
    <div className="flex flex-col gap-4">
      <DataTableToolbar
        searchValue={searchTerm}
        onSearchChange={onSearchChange}
        searchPlaceholder="Cari penyewa, nomor kontrak, atau unit"
        searchAriaLabel="Cari kontrak"
        hasActiveFilters={isFiltered}
        onResetFilters={handleResetFilters}
      >
        <NativeSelect
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          aria-label="Filter status kontrak"
        >
          {STATUS_OPTIONS.map((opt) => (
            <NativeSelectOption key={opt.value} value={opt.value}>
              {opt.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </DataTableToolbar>

      {paginatedLeases.length === 0 ? (
        <EmptyState
          className="border"
          icon={<Building2 />}
          title={emptyCopy.title}
          description={
            searchTerm.trim()
              ? `Tidak ada kontrak yang cocok dengan "${searchTerm.trim()}".`
              : emptyCopy.description
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Penyewa</TableHead>
                  <TableHead className="hidden sm:table-cell">Unit</TableHead>
                  <TableHead className="text-right">Sewa</TableHead>
                  <TableHead className="hidden md:table-cell">Periode</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeases.map((lease) => {
                  const tone = getLeaseStatusTone(lease.status);
                  const label = getLeaseStatusLabel(lease.status);

                  return (
                    <TableRow key={lease.id}>
                      <TableCell className="whitespace-normal">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs font-medium text-primary">
                            {lease.leaseNumber}
                          </span>
                          <span className="font-medium text-foreground">{lease.tenantName}</span>
                          <span className="font-mono text-xs text-muted-foreground tabular-nums">
                            {lease.tenantContact}
                          </span>
                          <span className="text-xs text-muted-foreground sm:hidden">
                            {lease.unitCode} · {label}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="hidden sm:table-cell whitespace-normal">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{lease.unitCode}</span>
                          <span className="text-xs text-muted-foreground">
                            {lease.areaSquareMeters} m²
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                            {formatCurrencyIDR(lease.monthlyRent)} / bln
                          </span>
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            Deposit {formatCurrencyIDR(lease.depositAmount)}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-medium text-foreground tabular-nums">
                            {lease.startDate} s/d {lease.endDate}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Jadwal: {paymentScheduleLabel(lease.paymentSchedule)}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="hidden sm:table-cell">
                        <StatusBadge status={tone}>{label}</StatusBadge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onSelectLease(lease)}
                            aria-label={`Detail kontrak ${lease.tenantName}`}
                          >
                            <Eye className="sm:hidden" />
                            <span className="hidden sm:inline">Detail</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onOpenPaymentModal(lease)}
                            aria-label={`Catat pembayaran ${lease.tenantName}`}
                          >
                            <CreditCard className="sm:hidden" />
                            <span className="hidden sm:inline">Bayar</span>
                          </Button>
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
            totalItems={leases.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            itemLabel="kontrak"
          />
        </div>
      )}
    </div>
  );
}
