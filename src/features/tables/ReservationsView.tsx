import { CalendarCheck, CheckCircle2, Phone, Search, Utensils } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

import { reservationStatusLabel, reservationStatusTone } from "./tables-domain";

interface ReservationsViewProps {
  reservations: ScheduledReservation[];
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
  statusFilter,
  searchQuery,
  onFilterChange,
  onSearchChange,
  onSeat,
  onCancel,
  onOpenPOS,
}: ReservationsViewProps) {
  const hasReservations = reservations.length > 0;

  return (
    <div className="space-y-4">
      {/* Search and Tabs Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari nama, WhatsApp, atau meja"
            className="pl-9 text-xs"
          />
        </div>

        <Tabs value={statusFilter} onValueChange={(val) => onFilterChange(val as string)}>
          <TabsList className="h-9">
            <TabsTrigger value="ALL" className="text-xs">
              Semua
            </TabsTrigger>
            <TabsTrigger value="CONFIRMED" className="text-xs">
              Menunggu
            </TabsTrigger>
            <TabsTrigger value="SEATED" className="text-xs">
              Sudah Duduk
            </TabsTrigger>
            <TabsTrigger value="CANCELLED" className="text-xs">
              Dibatalkan
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Reservation Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tamu</TableHead>
              <TableHead>Meja</TableHead>
              <TableHead>Jadwal</TableHead>
              <TableHead>Tamu dan DP</TableHead>
              <TableHead>Catatan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!hasReservations ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12">
                  <EmptyState
                    icon={<CalendarCheck className="size-6 text-muted-foreground" />}
                    title="Belum ada reservasi"
                    description="Reservasi yang dibuat akan muncul di sini."
                  />
                </TableCell>
              </TableRow>
            ) : (
              reservations.map((res) => (
                <TableRow key={res.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{res.customerName}</div>
                    <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                      <Phone className="size-3 text-muted-foreground" />
                      <span>{res.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      Meja {res.tableId}
                    </Badge>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {res.areaName}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {res.dateTime}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{res.pax} orang</div>
                    <div className="font-mono text-[11px] tabular-nums text-success">
                      DP {formatCurrencyIDR(res.downPayment)}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                    {res.notes || "-"}
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
                            className="h-8 gap-1 text-xs"
                          >
                            <CheckCircle2 className="size-3.5" />
                            <span>Dudukkan</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onCancel(res.id, res.tableId)}
                            className="h-8 text-xs text-destructive hover:text-destructive"
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
                          className="h-8 gap-1 text-xs"
                        >
                          <Utensils className="size-3.5 text-muted-foreground" />
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
