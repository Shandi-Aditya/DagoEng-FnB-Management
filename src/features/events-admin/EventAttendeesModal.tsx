"use client";

import { useEffect, useState } from "react";
import {
  Download,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  Mail,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { isEventTodayWita } from "@/features/events-checkin/events-checkin-domain";
import { IssueInvitationDialog } from "@/components/events/IssueInvitationDialog";

export interface EventAttendeesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CommunityEvent | null;
  bookings: EventTicketOrder[];
  onToggleCheckIn: (booking: EventTicketOrder) => void;
  onDeleteBooking?: (booking: EventTicketOrder) => void;
  onInvitationIssued?: () => void;
  isUpdatingCheckInId: string | null;
}

export function EventAttendeesModal({
  open,
  onOpenChange,
  event,
  bookings,
  onToggleCheckIn,
  onDeleteBooking,
  onInvitationIssued,
  isUpdatingCheckInId,
}: EventAttendeesModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isIssueInviteOpen, setIsIssueInviteOpen] = useState(false);

  useEffect(() => {
    setSearchQuery("");
  }, [open, event?.id]);

  if (!event) return null;

  const eventBookings = bookings.filter((b) => b.eventId === event.id);
  const activeEventBookings = eventBookings.filter(
    (b) => b.paymentStatus !== "CANCELLED" && b.paymentStatus !== "EXPIRED"
  );

  const needle = searchQuery.trim().toLowerCase();
  const filteredBookings = eventBookings.filter((b) => {
    if (!needle) return true;
    return (
      b.ticketCode.toLowerCase().includes(needle) ||
      b.guestName.toLowerCase().includes(needle) ||
      b.guestEmail.toLowerCase().includes(needle) ||
      Boolean(b.guestPhone && b.guestPhone.toLowerCase().includes(needle))
    );
  });

  const totalPaidRevenue = eventBookings
    .filter((b) => b.paymentStatus === "PAID")
    .reduce((sum, b) => sum + b.totalPrice, 0);

  const totalTickets = activeEventBookings.reduce(
    (sum, b) => sum + (b.ticketCount || 1),
    0
  );

  const checkedInCount = activeEventBookings.reduce((sum, b) => {
    if (typeof b.checkedInQty === "number") {
      return sum + b.checkedInQty;
    }
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
    const rows = filteredBookings.map((b) => {
      const qty = b.ticketCount || 1;
      const checkedQty =
        typeof b.checkedInQty === "number"
          ? b.checkedInQty
          : b.checkInStatus === "CHECKED_IN"
          ? qty
          : 0;
      const attendanceLabel =
        b.checkInStatus === "CHECKED_IN" || checkedQty >= qty
          ? "Hadir"
          : checkedQty > 0
          ? `Hadir ${checkedQty}/${qty}`
          : "Belum Hadir";
      return [
        b.ticketCode,
        b.guestName,
        b.guestEmail,
        b.guestPhone || "—",
        qty,
        b.totalPrice,
        b.paymentStatus,
        attendanceLabel,
        b.checkInTime
          ? new Date(b.checkInTime).toLocaleString("id-ID", { timeZone: "Asia/Makassar" })
          : "—",
      ];
    });
    downloadCSV(`Peserta_${event.title.replace(/[^a-zA-Z0-9]/g, "_")}.csv`, headers, rows);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 gap-0 sm:max-w-4xl">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex flex-wrap items-center justify-between gap-4 pr-6">
            <div className="space-y-1">
              <DialogTitle className="text-lg font-semibold">Kelola peserta & tiket</DialogTitle>
              <DialogDescription className="text-xs">
                {event.title} · Penyelenggara: {event.organizerName}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="lg" onClick={() => setIsIssueInviteOpen(true)}>
                <Mail className="size-4 mr-1" />
                <span>Terbitkan tiket undangan</span>
              </Button>
              <Button variant="outline" size="lg" onClick={handleExportCSV}>
                <Download />
                <span>Ekspor CSV</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Metrik ringkas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 pb-3">
          <div className="rounded-xl border bg-card p-3.5 shadow-2xs">
            <span className="text-xs text-muted-foreground block">Total penjualan</span>
            <p className="mt-1 font-mono text-base font-semibold tabular-nums text-foreground">
              {formatCurrencyIDR(totalPaidRevenue)}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-3.5 shadow-2xs">
            <span className="text-xs text-muted-foreground block">Tiket terdaftar</span>
            <p className="mt-1 font-mono text-base font-semibold tabular-nums text-foreground">
              {totalTickets} / {event.maxCapacity || "—"}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-3.5 shadow-2xs">
            <span className="text-xs text-muted-foreground block">Peserta hadir</span>
            <p className="mt-1 font-mono text-base font-semibold tabular-nums text-success">
              {checkedInCount}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-3.5 shadow-2xs">
            <span className="text-xs text-muted-foreground block">Belum check-in</span>
            <p className="mt-1 font-mono text-base font-semibold tabular-nums text-muted-foreground">
              {Math.max(0, totalTickets - checkedInCount)}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 pb-3">
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
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="rounded-xl border bg-card overflow-hidden">
            {filteredBookings.length === 0 ? (
              <p className="py-12 text-center text-xs text-muted-foreground">
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
                    const ticketCount = b.ticketCount || 1;
                    const checkedQty =
                      typeof b.checkedInQty === "number"
                        ? b.checkedInQty
                        : b.checkInStatus === "CHECKED_IN"
                        ? ticketCount
                        : 0;
                    const isCheckedIn = b.checkInStatus === "CHECKED_IN" || checkedQty >= ticketCount;
                    const isPartial = !isCheckedIn && checkedQty > 0;
                    const isUpdating = isUpdatingCheckInId === b.id;
                    const isInvalidPayment =
                      b.paymentStatus === "CANCELLED" || b.paymentStatus === "EXPIRED";

                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-medium text-foreground">
                              {b.ticketCode}
                            </span>
                            {b.ticketTierName ? (
                              <span className="text-xs text-muted-foreground font-medium">
                                {b.ticketTierName}
                              </span>
                            ) : null}
                            {b.checkInTime ? (
                              <span className="text-xs text-muted-foreground">
                                {new Date(b.checkInTime).toLocaleTimeString("id-ID", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "Asia/Makassar",
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
                          <Badge
                            variant={
                              b.paymentStatus === "REFUNDED" ||
                              b.paymentStatus === "CANCELLED" ||
                              b.paymentStatus === "EXPIRED"
                                ? "destructive"
                                : b.refundStatus === "REQUESTED"
                                ? "secondary"
                                : b.isInvitation || b.paymentMethod === "INVITATION"
                                ? "outline"
                                : b.paymentStatus === "PAID"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {b.paymentStatus === "REFUNDED"
                              ? "Dikembalikan"
                              : b.refundStatus === "REQUESTED"
                              ? "Pengajuan refund"
                              : b.isInvitation || b.paymentMethod === "INVITATION"
                              ? "Undangan"
                              : b.paymentStatus === "PAID"
                              ? "Lunas"
                              : b.paymentStatus === "CANCELLED"
                              ? "Dibatalkan"
                              : b.paymentStatus === "EXPIRED"
                              ? "Kedaluwarsa"
                              : "Menunggu"}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <Badge variant={isCheckedIn ? "default" : isPartial ? "secondary" : "outline"}>
                            {isCheckedIn
                              ? "Hadir"
                              : isPartial
                              ? `Hadir ${checkedQty}/${ticketCount}`
                              : "Belum hadir"}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant={isCheckedIn ? "outline" : "default"}
                              size="sm"
                              onClick={() => onToggleCheckIn(b)}
                              disabled={
                                isUpdating ||
                                !isEventTodayWita(event) ||
                                b.paymentStatus !== "PAID" ||
                                b.refundStatus === "REQUESTED"
                              }
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
                            {onDeleteBooking && b.paymentStatus !== "PAID" && (b.checkedInQty || 0) === 0 ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDeleteBooking(b)}
                                disabled={isUpdating}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Hapus pesanan"
                              >
                                <Trash2 />
                                <span className="sr-only">Hapus</span>
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-muted/20 flex flex-row items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            Menampilkan {filteredBookings.length} dari {eventBookings.length} pemesanan
          </span>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>

      <IssueInvitationDialog
        open={isIssueInviteOpen}
        onOpenChange={setIsIssueInviteOpen}
        event={event}
        onInvitationIssued={() => onInvitationIssued?.()}
      />
    </Dialog>
  );
}
