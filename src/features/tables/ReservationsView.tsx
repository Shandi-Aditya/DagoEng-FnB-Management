"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CheckCircle2, Phone, Search, Utensils, X } from "lucide-react";

import { DataPagination } from "@/components/app/data-pagination";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScheduledReservation } from "@/contexts/TableContext";
import { formatCurrencyIDR } from "@/lib/utils";

import {
  emptyReservationsMessage,
  RESERVATION_QUEUES,
  type ReservationQueueId,
  reservationStatusLabel,
  reservationStatusTone,
} from "./tables-domain";

interface ReservationsViewProps {
  reservations: ScheduledReservation[];
  counts: Record<ReservationQueueId, number>;
  statusFilter: string;
  searchQuery: string;
  onFilterChange: (filter: string) => void;
  onSearchChange: (query: string) => void;
  onSeat: (res: ScheduledReservation) => void;
  onCancel: (resId: string, tableId: string) => void;
  onOpenPOS: () => void;
}

export function ReservationsView({
  reservations,
  counts,
  statusFilter,
  searchQuery,
  onFilterChange,
  onSearchChange,
  onSeat,
  onCancel,
  onOpenPOS,
}: ReservationsViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [reservations.length, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(reservations.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedReservations = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return reservations.slice(start, start + pageSize);
  }, [reservations, safeCurrentPage, pageSize]);

  const emptyCopy = emptyReservationsMessage(statusFilter, Boolean(searchQuery));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="sm:max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari nama, WhatsApp, atau meja"
            aria-label="Cari reservasi"
          />
        </InputGroup>

        <div className="max-w-full overflow-x-auto no-scrollbar">
          <Tabs value={statusFilter} onValueChange={(val) => onFilterChange(val as string)}>
            <TabsList aria-label="Filter status reservasi">
              {RESERVATION_QUEUES.map((queue) => (
                <TabsTrigger key={queue.id} value={queue.id}>
                  {queue.label}
                  <Badge variant="secondary" className="ml-1 tabular-nums">
                    {counts[queue.id]}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {reservations.length === 0 ? (
        <EmptyState
          className="border"
          icon={<CalendarCheck />}
          title={emptyCopy.title}
          description={emptyCopy.description}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tamu</TableHead>
                  <TableHead className="hidden sm:table-cell">Meja</TableHead>
                  <TableHead className="hidden sm:table-cell">Jadwal</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Tamu dan DP</TableHead>
                  <TableHead className="hidden lg:table-cell">Catatan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedReservations.map((res) => (
                  <TableRow key={res.id}>
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{res.customerName}</span>
                        <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground tabular-nums">
                          <Phone className="size-3" aria-hidden />
                          {res.phone}
                        </span>
                        <span className="text-xs text-muted-foreground sm:hidden">
                          Meja <span className="font-mono">{res.tableId}</span> · {res.dateTime}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex flex-col">
                        <span className="font-mono text-foreground">{res.tableId}</span>
                        <span className="text-xs text-muted-foreground">{res.areaName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs tabular-nums text-foreground">
                      {res.dateTime}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-foreground">
                          <span className="font-mono tabular-nums">{res.pax}</span> orang
                        </span>
                        {res.downPayment > 0 ? (
                          <span className="font-mono text-xs tabular-nums text-success">
                            DP {formatCurrencyIDR(res.downPayment)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Tanpa DP</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-48 whitespace-normal text-xs text-muted-foreground lg:table-cell">
                      {res.notes || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={reservationStatusTone(res.status)}>
                        {reservationStatusLabel(res.status)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        {res.status === "CONFIRMED" ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => onSeat(res)}
                              aria-label={`Dudukkan ${res.customerName}`}
                            >
                              <CheckCircle2 />
                              <span className="hidden sm:inline">Dudukkan</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onCancel(res.id, res.tableId)}
                              aria-label={`Batalkan reservasi ${res.customerName}`}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="sm:hidden" />
                              <span className="hidden sm:inline">Batal</span>
                            </Button>
                          </>
                        ) : null}

                        {res.status === "SEATED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={onOpenPOS}
                            aria-label={`Buka meja ${res.tableId} di POS`}
                          >
                            <Utensils />
                            <span className="hidden sm:inline">Buka di POS</span>
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            currentPage={safeCurrentPage}
            totalItems={reservations.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            itemLabel="reservasi"
          />
        </div>
      )}
    </div>
  );
}
