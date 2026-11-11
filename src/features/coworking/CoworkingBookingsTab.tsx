import { useState, useMemo } from "react";
import {
  Calendar,
  Printer,
  Search,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UserCheck,
} from "lucide-react";
import type { CoworkingBooking } from "@/types/coworking";
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
import { getBookingCheckInTone } from "./coworking-domain";

export interface CoworkingBookingsTabProps {
  bookings: CoworkingBooking[];
  onOpenReceipt: (booking: CoworkingBooking) => void;
  onCheckIn: (bookingId: string) => void;
  onCheckout: (spaceId: string) => void;
}

export function CoworkingBookingsTab({
  bookings,
  onOpenReceipt,
  onCheckIn,
  onCheckout,
}: CoworkingBookingsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const isFiltered = searchQuery.trim() !== "" || statusFilter !== "ALL";

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        b.guestName.toLowerCase().includes(q) ||
        (b.bookingCode && b.bookingCode.toLowerCase().includes(q)) ||
        (b.guestPhone && b.guestPhone.includes(q)) ||
        (b.spaceName && b.spaceName.toLowerCase().includes(q));

      const matchStatus =
        statusFilter === "ALL" || b.checkInStatus === statusFilter;

      return matchQuery && matchStatus;
    });
  }, [bookings, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedBookings = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredBookings.slice(start, start + pageSize);
  }, [filteredBookings, safeCurrentPage, pageSize]);

  return (
    <div className="space-y-4">
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
              placeholder="Cari kode booking, nama tamu, atau ruang..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          <NativeSelect
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 text-xs"
          >
            <option value="ALL">Semua status sesi</option>
            <option value="CHECKED_IN">Sedang aktif</option>
            <option value="COMPLETED">Selesai</option>
            <option value="PENDING">Menunggu</option>
          </NativeSelect>

          {isFiltered ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
                setCurrentPage(1);
              }}
              className="h-8 text-xs"
            >
              Reset filter
            </Button>
          ) : null}
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

      {/* Bookings Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">No. Booking & Tamu</TableHead>
                <TableHead>Ruang / Meja</TableHead>
                <TableHead>Jadwal & Durasi</TableHead>
                <TableHead>Total Tagihan</TableHead>
                <TableHead>Status Bayar</TableHead>
                <TableHead>Status Sesi</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedBookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <EmptyState
                      icon={<Calendar className="size-6 text-muted-foreground" />}
                      title={isFiltered ? "Tidak ada booking yang cocok" : "Belum ada riwayat booking"}
                      description={
                        isFiltered
                          ? "Coba ubah kata kunci pencarian atau status sesi."
                          : "Pemesanan baru yang dibuat melalui formulir atau POS kasir akan tercatat di sini."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginatedBookings.map((b) => {
                  const checkInTone = getBookingCheckInTone(b.checkInStatus);
                  const isPaid = b.paymentStatus === "PAID";

                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        <div className="space-y-0.5">
                          <p className="font-mono text-primary font-semibold text-xs">
                            {b.bookingCode || b.id}
                          </p>
                          <p className="text-foreground">
                            {b.guestName} {b.company ? `(${b.company})` : ""}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {b.guestPhone}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">{b.spaceName}</p>
                          <p className="text-[11px] text-muted-foreground">{b.spaceType}</p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground text-xs">
                            {b.endDate && b.endDate !== b.date ? `${b.date} s/d ${b.endDate}` : b.date}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {b.bookingType === "HOURLY"
                              ? `${b.startTime} (${b.duration} jam)`
                              : `${b.duration} hari`}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-mono font-medium tabular-nums text-foreground">
                            {formatCurrencyIDR(b.totalAmount)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{b.paymentMethod || "Tunai"}</p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge
                          status={isPaid ? "success" : "warning"}
                        >
                          {b.paymentStatus || "PAID"}
                        </StatusBadge>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={checkInTone}>
                          {b.checkInStatus === "CHECKED_IN"
                            ? "Sedang aktif"
                            : b.checkInStatus === "COMPLETED"
                            ? "Selesai"
                            : b.checkInStatus}
                        </StatusBadge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onOpenReceipt(b)}
                            className="h-7 text-xs"
                          >
                            <Printer className="size-3.5" />
                            <span>Struk</span>
                          </Button>

                          {b.checkInStatus === "CHECKED_IN" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onCheckout(b.spaceId)}
                              className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                            >
                              <LogOut className="size-3.5" />
                              <span>Check-out</span>
                            </Button>
                          ) : b.checkInStatus !== "COMPLETED" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onCheckIn(b.id)}
                              className="h-7 text-xs"
                            >
                              <UserCheck className="size-3.5" />
                              <span>Check-in</span>
                            </Button>
                          ) : null}
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
      {filteredBookings.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
          <div>
            Menampilkan{" "}
            <span className="font-mono font-medium text-foreground">
              {Math.min((safeCurrentPage - 1) * pageSize + 1, filteredBookings.length)}
            </span>{" "}
            sampai{" "}
            <span className="font-mono font-medium text-foreground">
              {Math.min(safeCurrentPage * pageSize, filteredBookings.length)}
            </span>{" "}
            dari{" "}
            <span className="font-mono font-medium text-foreground">
              {filteredBookings.length}
            </span>{" "}
            booking
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
