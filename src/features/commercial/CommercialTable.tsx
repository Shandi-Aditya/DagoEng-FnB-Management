"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";

import { DataPagination } from "@/components/app/data-pagination";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { CommercialLease } from "@/types/commercial";
import { formatCurrencyIDR } from "@/lib/utils";

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
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <InputGroup className="max-w-xs flex-1">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari penyewa, nomor kontrak, atau unit"
              aria-label="Cari kontrak"
            />
          </InputGroup>

          <NativeSelect
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            aria-label="Filter status kontrak"
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
            >
              Reset filter
            </Button>
          )}
        </div>
      </div>

      {/* Leases Table Card */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Penyewa & Kontrak</TableHead>
                <TableHead>Unit & Luas</TableHead>
                <TableHead className="text-right">Sewa & Deposit</TableHead>
                <TableHead>Periode sewa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Aksi</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLeases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <EmptyState
                      icon={<Building2 className="size-8 text-muted-foreground" />}
                      title={emptyCopy.title}
                      description={
                        searchTerm
                          ? `Tidak ada kontrak yang cocok dengan "${searchTerm}".`
                          : emptyCopy.description
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
                          <p className="font-mono text-xs font-semibold text-primary">
                            {lease.leaseNumber}
                          </p>
                          <p className="leading-snug text-foreground">{lease.tenantName}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {lease.tenantContact}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">{lease.unitCode}</p>
                          <p className="text-xs text-muted-foreground">{lease.areaSquareMeters} m²</p>
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="space-y-0.5">
                          <p className="font-mono text-xs font-medium tabular-nums text-foreground">
                            {formatCurrencyIDR(lease.monthlyRent)} / bln
                          </p>
                          <p className="font-mono text-xs tabular-nums text-muted-foreground">
                            Deposit: {formatCurrencyIDR(lease.depositAmount)}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-mono text-xs font-medium text-foreground">
                            {lease.startDate} s/d {lease.endDate}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Jadwal: {paymentScheduleLabel(lease.paymentSchedule)}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={tone}>
                          {label}
                        </StatusBadge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onSelectLease(lease)}
                          >
                            Detail
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onOpenPaymentModal(lease)}
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
      )}
    </div>
  );
}
