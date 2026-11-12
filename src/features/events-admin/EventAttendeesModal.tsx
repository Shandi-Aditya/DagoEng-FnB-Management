"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  RotateCcw,
  Search,
  Ticket,
  UserCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CommunityEvent, EventTicketOrder } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";
import { downloadCSV } from "@/lib/export-utils";

export interface EventAttendeesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CommunityEvent | null;
  bookings: EventTicketOrder[];
  onToggleCheckIn: (booking: EventTicketOrder) => void;
  isUpdatingCheckInId: string | null;
}

export function EventAttendeesModal({
  open,
  onOpenChange,
  event,
  bookings,
  onToggleCheckIn,
  isUpdatingCheckInId,
}: EventAttendeesModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (!event) return null;

  const eventBookings = bookings.filter((b) => b.eventId === event.id);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const needle = searchQuery.trim().toLowerCase();
  const filteredBookings = eventBookings.filter((b) => {
    if (!needle) return true;
    return (
      b.ticketCode.toLowerCase().includes(needle) ||
      b.guestName.toLowerCase().includes(needle) ||
      b.guestEmail.toLowerCase().includes(needle) ||
      (b.guestPhone && b.guestPhone.toLowerCase().includes(needle))
    );
  });

  // Metrics
  const totalPaidRevenue = eventBookings
    .filter((b) => b.paymentStatus === "PAID")
    .reduce((sum, b) => sum + b.totalPrice, 0);

  const totalTickets = eventBookings.reduce(
    (sum, b) => sum + (b.ticketCount || 1),
    0
  );

  const checkedInCount = eventBookings.reduce((sum, b) => {
    if (b.checkInStatus === "CHECKED_IN") {
      return sum + (b.ticketCount || 1);
    }
    return sum;
  }, 0);

  const handleExportCSV = () => {
    const headers = [
      "Kode Tiket",
      "Nama Pemesan",
      "Email",
      "WhatsApp",
      "Jumlah Tiket",
      "Total Bayar",
      "Status Bayar",
      "Status Kehadiran",
      "Waktu Check-in",
    ];
    const rows = eventBookings.map((b) => [
      b.ticketCode,
      b.guestName,
      b.guestEmail,
      b.guestPhone || "—",
      b.ticketCount || 1,
      b.totalPrice,
      b.paymentStatus,
      b.checkInStatus === "CHECKED_IN" ? "Hadir" : "Belum Hadir",
      b.checkInTime ? new Date(b.checkInTime).toLocaleString("id-ID") : "—",
    ]);
    downloadCSV(`Peserta_${event.title.replace(/[^a-zA-Z0-9]/g, "_")}.csv`, headers, rows);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-4 pr-6">
            <div>
              <DialogTitle className="text-xl">Kelola peserta & tiket</DialogTitle>
              <DialogDescription className="text-xs">
                {event.title} · Penyelenggara: {event.organizerName}
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download />
              <span>Ekspor CSV</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Metrik ringkas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2">
          <div className="rounded-lg border bg-muted/40 p-3">
            <span className="text-xs text-muted-foreground">Total penjualan</span>
            <p className="font-mono text-sm font-medium text-foreground">
              {formatCurrencyIDR(totalPaidRevenue)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-3">
            <span className="text-xs text-muted-foreground">Tiket terdaftar</span>
            <p className="font-mono text-sm font-medium text-foreground">
              {totalTickets} / {event.maxCapacity || "—"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-3">
            <span className="text-xs text-muted-foreground">Peserta hadir</span>
            <p className="font-mono text-sm font-medium text-success">
              {checkedInCount}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-3">
            <span className="text-xs text-muted-foreground">Belum check-in</span>
            <p className="font-mono text-sm font-medium text-muted-foreground">
              {totalTickets - checkedInCount}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="py-1">
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="Cari kode tiket, nama, email peserta…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Cari peserta"
            />
          </InputGroup>
        </div>

        {/* Tabel Peserta */}
        <div className="flex-1 overflow-y-auto rounded-lg border bg-card">
          {filteredBookings.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              {searchQuery ? "Tidak ada peserta yang cocok dengan pencarian." : "Belum ada tiket terdaftar untuk event ini."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Kode Tiket</TableHead>
                  <TableHead>Peserta</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Tiket</TableHead>
                  <TableHead className="hidden md:table-cell">Bayar</TableHead>
                  <TableHead>Kehadiran</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.map((b) => {
                  const isCheckedIn = b.checkInStatus === "CHECKED_IN";
                  const isUpdating = isUpdatingCheckInId === b.id;
                  const ticketCount = b.ticketCount || 1;

                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-medium text-foreground">
                            {b.ticketCode}
                          </span>
                          {b.checkInTime ? (
                            <span className="text-xs text-muted-foreground">
                              {new Date(b.checkInTime).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{b.guestName}</span>
                          <span className="text-xs text-muted-foreground">{b.guestEmail}</span>
                        </div>
                      </TableCell>

                      <TableCell className="hidden sm:table-cell text-right">
                        <span className="font-mono text-xs tabular-nums text-foreground">
                          {ticketCount}
                        </span>
                      </TableCell>

                      <TableCell className="hidden md:table-cell">
                        <Badge variant={b.paymentStatus === "PAID" ? "default" : "secondary"}>
                          {b.paymentStatus === "PAID" ? "Lunas" : "Menunggu"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge variant={isCheckedIn ? "default" : "outline"}>
                          {isCheckedIn ? "Hadir" : "Belum hadir"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant={isCheckedIn ? "outline" : "default"}
                          size="sm"
                          onClick={() => onToggleCheckIn(b)}
                          disabled={isUpdating || b.paymentStatus === "CANCELLED"}
                        >
                          {isCheckedIn ? (
                            <>
                              <RotateCcw />
                              <span className="hidden sm:inline">Batal hadir</span>
                            </>
                          ) : (
                            <>
                              <UserCheck />
                              <span className="hidden sm:inline">Tandai hadir</span>
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
