"use client";

import { useMemo, useState } from "react";
import { Calendar, LogOut, Printer, Search, UserCheck } from "lucide-react";

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
import type { CoworkingBooking } from "@/types/coworking";
import { formatCurrencyIDR } from "@/lib/utils";

import {
  bookingCheckInStatusLabel,
  bookingPaymentStatusLabel,
  emptyCoworkingMessage,
  getBookingCheckInTone,
  spaceTypeLabel,
} from "./coworking-domain";

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

  const emptyCopy = emptyCoworkingMessage("BOOKINGS", isFiltered);

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
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari kode booking, tamu, atau ruang"
              aria-label="Cari booking"
            />
          </InputGroup>

          <NativeSelect
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter status sesi"
          >
            <option value="ALL">Semua status sesi</option>
            <option value="CHECKED_IN">Sedang aktif</option>
            <option value="RESERVED">Menunggu</option>
            <option value="COMPLETED">Selesai</option>
            <option value="CANCELLED">Dibatalkan</option>
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
            >
              Reset filter
            </Button>
          ) : null}
        </div>
      </div>

      {/* Bookings Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Booking & Tamu</TableHead>
                <TableHead>Ruang</TableHead>
                <TableHead>Jadwal</TableHead>
                <TableHead>Total & Bayar</TableHead>
                <TableHead>Status sesi</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Aksi</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedBookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <EmptyState
                      icon={<Calendar className="size-6 text-muted-foreground" />}
                      title={emptyCopy.title}
                      description={emptyCopy.description}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginatedBookings.map((b) => {
                  const checkInTone = getBookingCheckInTone(b.checkInStatus);

                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        <div className="space-y-0.5">
                          <p className="font-mono text-xs font-semibold text-primary">
                            {b.bookingCode || b.id}
                          </p>
                          <p className="text-foreground">
                            {b.guestName} {b.company ? `(${b.company})` : ""}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {b.guestPhone}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">{b.spaceName}</p>
                          <p className="text-xs text-muted-foreground">{spaceTypeLabel(b.spaceType)}</p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-mono text-xs font-medium text-foreground">
                            {b.endDate && b.endDate !== b.date ? `${b.date} s/d ${b.endDate}` : b.date}
                          </p>
                          <p className="text-xs text-muted-foreground">
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
                          <p className="text-xs text-muted-foreground">
                            {b.paymentMethod || "Tunai"} · <span className="font-medium text-success">{bookingPaymentStatusLabel(b.paymentStatus || "PAID")}</span>
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={checkInTone}>
                          {bookingCheckInStatusLabel(b.checkInStatus)}
                        </StatusBadge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onOpenReceipt(b)}
                          >
                            <Printer />
                            <span>Struk</span>
                          </Button>

                          {b.checkInStatus === "CHECKED_IN" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onCheckout(b.spaceId)}
                              className="text-destructive hover:text-destructive"
                            >
                              <LogOut />
                              <span>Check-out</span>
                            </Button>
                          ) : b.checkInStatus !== "COMPLETED" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onCheckIn(b.id)}
                            >
                              <UserCheck />
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
        <DataPagination
          currentPage={safeCurrentPage}
          totalItems={filteredBookings.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          itemLabel="booking"
        />
      )}
    </div>
  );
}
