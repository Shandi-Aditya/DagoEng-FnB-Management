"use client";

import { CalendarCheck, CheckCircle2, Phone, Search, Utensils } from "lucide-react";

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
  const hasReservations = reservations.length > 0;
  const emptyCopy = emptyReservationsMessage(statusFilter, Boolean(searchQuery));

  return (
    <div className="space-y-4">
      {/* Search and Tabs Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="max-w-sm">
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

      {/* Reservation Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tamu</TableHead>
              <TableHead>Meja</TableHead>
              <TableHead>Jadwal</TableHead>
              <TableHead>Kapasitas dan DP</TableHead>
              <TableHead className="hidden md:table-cell">Catatan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Aksi</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!hasReservations ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12">
                  <EmptyState
                    icon={<CalendarCheck className="size-6 text-muted-foreground" />}
                    title={emptyCopy.title}
                    description={emptyCopy.description}
                  />
                </TableCell>
              </TableRow>
            ) : (
              reservations.map((res) => (
                <TableRow key={res.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{res.customerName}</div>
                    <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                      <Phone className="size-3 text-muted-foreground" />
                      <span>{res.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      Meja {res.tableId}
                    </Badge>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {res.areaName}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium font-mono text-xs tabular-nums text-foreground">
                    {res.dateTime}
                  </TableCell>
                  <TableCell>
                    <div className="text-foreground">
                      <span className="font-mono tabular-nums">{res.pax}</span> orang
                    </div>
                    {res.downPayment > 0 ? (
                      <div className="font-mono text-xs tabular-nums text-success">
                        DP {formatCurrencyIDR(res.downPayment)}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Tanpa DP</div>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-[200px] truncate text-xs text-muted-foreground md:table-cell">
                    {res.notes || "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={reservationStatusTone(res.status)}>
                      {reservationStatusLabel(res.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {res.status === "CONFIRMED" ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => onSeat(res)}
                          >
                            <CheckCircle2 />
                            <span>Dudukkan</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onCancel(res.id, res.tableId)}
                            className="text-destructive hover:text-destructive"
                          >
                            Batal
                          </Button>
                        </>
                      ) : null}

                      {res.status === "SEATED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={onOpenPOS}
                        >
                          <Utensils />
                          <span>Buka di POS</span>
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
