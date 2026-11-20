"use client";

import { CheckCircle2, CreditCard, Eye, Search, Trash2, XCircle } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { DataPagination } from "@/components/app/data-pagination";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EventTicketOrder } from "@/types/event";
import { EventDateRangeFilter, type DateRange } from "@/components/events/EventDateRangeFilter";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  formatDateSafe,
  paymentStatusLabel,
  paymentStatusTone,
} from "./events-admin-domain";

export interface EventsPaymentsTableProps {
  bookings: EventTicketOrder[];
  filterStatus: string;
  onFilterStatusChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateRange?: DateRange | null;
  onDateRangeChange?: (range: DateRange | null) => void;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onApprove: (booking: EventTicketOrder) => void;
  onReject: (booking: EventTicketOrder) => void;
  onPreviewProof: (booking: EventTicketOrder) => void;
  onDeleteBooking?: (booking: EventTicketOrder) => void;
  isProcessing?: boolean;
}

export function EventsPaymentsTable({
  bookings,
  filterStatus,
  onFilterStatusChange,
  searchQuery,
  onSearchChange,
  dateRange = null,
  onDateRangeChange,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onApprove,
  onReject,
  onPreviewProof,
  onDeleteBooking,
  isProcessing,
}: EventsPaymentsTableProps) {
  const startIndex = (currentPage - 1) * pageSize;
  const pagedBookings = bookings.slice(startIndex, startIndex + pageSize);
  const hasFilter = Boolean(searchQuery.trim() || dateRange || filterStatus !== "PENDING_PROOF");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={filterStatus} onValueChange={onFilterStatusChange}>
          <TabsList className="overflow-x-auto no-scrollbar">
            <TabsTrigger value="PENDING_PROOF">Menunggu verifikasi</TabsTrigger>
            <TabsTrigger value="ALL">Semua</TabsTrigger>
            <TabsTrigger value="PAID">Lunas</TabsTrigger>
            <TabsTrigger value="REJECTED">Ditolak</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2.5 flex-1 lg:justify-end">
          <div className="min-w-[200px] flex-1 sm:max-w-xs">
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                placeholder="Cari kode tiket, nama, email…"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                aria-label="Cari pembayaran tiket"
              />
            </InputGroup>
          </div>

          {onDateRangeChange ? (
            <EventDateRangeFilter
              initialRange={dateRange}
              onApplyFilter={onDateRangeChange}
              label="Periode bayar"
              align="right"
            />
          ) : null}
        </div>
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          className="border"
          icon={<CreditCard />}
          title={hasFilter ? "Tidak ada pembayaran yang cocok" : "Tidak ada antrean pembayaran"}
          description={
            searchQuery
              ? `Tidak ditemukan pembayaran dengan kata kunci "${searchQuery}".`
              : dateRange
              ? "Tidak ada data pembayaran tiket pada rentang tanggal yang dipilih."
              : "Semua pembayaran tiket manual saat ini sudah diverifikasi."
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Tiket & Waktu</TableHead>
                  <TableHead>Peserta</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Nominal</TableHead>
                  <TableHead className="hidden sm:table-cell">Bukti Transfer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-0 text-right">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedBookings.map((b) => {
                  const formattedDate = formatDateSafe(b.createdAt, true);
                  const hasRejectedProof = Boolean(b.paymentRejectionReason);
                  const isPending = b.paymentStatus === "PENDING" && !hasRejectedProof;
                  const effectiveStatus =
                    b.paymentStatus === "PENDING" && hasRejectedProof ? "REJECTED" : b.paymentStatus;

                  return (
                    <TableRow key={b.id}>
                      {/* Tiket & Waktu */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs font-medium text-foreground">
                            {b.ticketCode}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formattedDate}
                          </span>
                        </div>
                      </TableCell>

                      {/* Peserta */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-foreground">
                            {b.guestName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {b.guestPhone || b.guestEmail}
                          </span>
                        </div>
                      </TableCell>

                      {/* Nominal */}
                      <TableCell className="hidden md:table-cell text-right">
                        <span className="font-mono text-xs tabular-nums font-medium text-foreground">
                          {formatCurrencyIDR(b.totalPrice)}
                        </span>
                      </TableCell>

                      {/* Bukti Transfer */}
                      <TableCell className="hidden sm:table-cell">
                        {b.paymentProofUrl ? (
                          <button
                            type="button"
                            onClick={() => onPreviewProof(b)}
                            className="group flex items-center gap-2 rounded-md border p-1 hover:bg-muted text-left transition-colors"
                          >
                            <div className="relative size-8 shrink-0 overflow-hidden rounded bg-muted">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={b.paymentProofUrl}
                                alt="Bukti transfer"
                                className="size-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <span className="text-xs text-muted-foreground group-hover:text-foreground">
                              Lihat struk
                            </span>
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Belum ada bukti
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={paymentStatusTone(effectiveStatus)}>
                          {paymentStatusLabel(effectiveStatus)}
                        </StatusBadge>
                      </TableCell>

                      {/* Aksi */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isPending && b.paymentProofUrl ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => onApprove(b)}
                                disabled={isProcessing}
                              >
                                <CheckCircle2 />
                                <span className="hidden sm:inline">Setujui</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onReject(b)}
                                disabled={isProcessing}
                              >
                                <XCircle />
                                <span className="hidden sm:inline">Tolak</span>
                              </Button>
                            </>
                          ) : (
                            <>
                              {b.paymentProofUrl ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onPreviewProof(b)}
                                >
                                  <Eye />
                                  <span>Bukti</span>
                                </Button>
                              ) : null}

                              {onDeleteBooking &&
                              b.paymentStatus !== "PAID" &&
                              b.paymentStatus !== "REFUNDED" &&
                              b.refundStatus !== "REQUESTED" &&
                              !(isPending && b.paymentProofUrl && !b.paymentRejectionReason) &&
                              (b.checkedInQty || 0) === 0 ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onDeleteBooking(b)}
                                  disabled={isProcessing}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title="Hapus pesanan tiket"
                                >
                                  <Trash2 />
                                  <span className="sr-only sm:not-sr-only sm:inline">Hapus</span>
                                </Button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            currentPage={currentPage}
            totalItems={bookings.length}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            itemLabel="pembayaran"
          />
        </>
      )}
    </div>
  );
}
