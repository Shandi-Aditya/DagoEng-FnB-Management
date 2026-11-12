"use client";

import { useMemo, useState } from "react";
import { Calendar, LogOut, Printer, UserCheck } from "lucide-react";

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
import type { CoworkingBooking } from "@/types/coworking";

import {
  bookingCheckInStatusLabel,
  bookingPaymentStatusLabel,
  emptyCoworkingMessage,
  filterCoworkingBookings,
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

  const filteredBookings = useMemo(
    () => filterCoworkingBookings(bookings, statusFilter, searchQuery),
    [bookings, statusFilter, searchQuery]
  );

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedBookings = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredBookings.slice(start, start + pageSize);
  }, [filteredBookings, safeCurrentPage, pageSize]);

  const emptyCopy = emptyCoworkingMessage("BOOKINGS", isFiltered);

  return (
    <div className="flex flex-col gap-4">
      <DataTableToolbar
        searchValue={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Cari kode booking, tamu, atau ruang"
        searchAriaLabel="Cari booking"
        hasActiveFilters={isFiltered}
        onResetFilters={() => {
          setSearchQuery("");
          setStatusFilter("ALL");
          setCurrentPage(1);
        }}
      >
        <NativeSelect
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          aria-label="Filter status sesi"
        >
          <NativeSelectOption value="ALL">Semua status sesi</NativeSelectOption>
          <NativeSelectOption value="CHECKED_IN">Sedang aktif</NativeSelectOption>
          <NativeSelectOption value="RESERVED">Menunggu</NativeSelectOption>
          <NativeSelectOption value="COMPLETED">Selesai</NativeSelectOption>
          <NativeSelectOption value="CANCELLED">Dibatalkan</NativeSelectOption>
        </NativeSelect>
      </DataTableToolbar>

      {filteredBookings.length === 0 ? (
        <EmptyState
          className="border"
          icon={<Calendar />}
          title={emptyCopy.title}
          description={emptyCopy.description}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead>
                  <TableHead className="hidden md:table-cell">Ruang</TableHead>
                  <TableHead className="hidden sm:table-cell">Jadwal</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedBookings.map((b) => {
                  const checkInTone = getBookingCheckInTone(b.checkInStatus);

                  return (
                    <TableRow key={b.id}>
                      <TableCell className="whitespace-normal">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs font-medium text-primary">
                            {b.bookingCode || b.id}
                          </span>
                          <span className="font-medium text-foreground">
                            {b.guestName}
                            {b.company ? ` (${b.company})` : ""}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground tabular-nums">
                            {b.guestPhone}
                          </span>
                          <span className="text-xs text-muted-foreground md:hidden">
                            {b.spaceName}
                            <span className="sm:hidden"> · {b.date}</span>
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="hidden md:table-cell whitespace-normal">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{b.spaceName}</span>
                          <span className="text-xs text-muted-foreground">
                            {spaceTypeLabel(b.spaceType)}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="hidden sm:table-cell">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-medium text-foreground tabular-nums">
                            {b.endDate && b.endDate !== b.date
                              ? `${b.date} s/d ${b.endDate}`
                              : b.date}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {b.bookingType === "HOURLY"
                              ? `${b.startTime} (${b.duration} jam)`
                              : `${b.duration} hari`}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="hidden md:table-cell text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {formatCurrencyIDR(b.totalAmount)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {b.paymentMethod || "Tunai"} ·{" "}
                            <span className="text-success">
                              {bookingPaymentStatusLabel(b.paymentStatus || "PAID")}
                            </span>
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={checkInTone}>
                          {bookingCheckInStatusLabel(b.checkInStatus)}
                        </StatusBadge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onOpenReceipt(b)}
                            aria-label={`Cetak struk ${b.bookingCode || b.guestName}`}
                          >
                            <Printer />
                            <span className="hidden sm:inline">Struk</span>
                          </Button>

                          {b.checkInStatus === "CHECKED_IN" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onCheckout(b.spaceId)}
                              aria-label={`Check-out ${b.guestName}`}
                              className="text-destructive hover:text-destructive"
                            >
                              <LogOut />
                              <span className="hidden sm:inline">Check-out</span>
                            </Button>
                          ) : b.checkInStatus !== "COMPLETED" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onCheckIn(b.id)}
                              aria-label={`Check-in ${b.guestName}`}
                            >
                              <UserCheck />
                              <span className="hidden sm:inline">Check-in</span>
                            </Button>
                          ) : null}
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
            totalItems={filteredBookings.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            itemLabel="booking"
          />
        </div>
      )}
    </div>
  );
}
