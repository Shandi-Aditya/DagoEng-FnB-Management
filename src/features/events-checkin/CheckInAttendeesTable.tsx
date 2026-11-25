"use client";

import React, { useEffect, useState } from "react";
import { QrCode, Check, RotateCcw, Loader2, Ticket, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { DataPagination } from "@/components/app/data-pagination";
import type { EventTicketOrder } from "@/types/event";
import {
  getCheckInStatusTone,
  getPaymentStatusTone,
  formatPaymentStatusLabel,
  formatCheckInTime,
} from "./events-checkin-domain";
import { formatSeatsList } from "@/lib/event-seating";

interface CheckInAttendeesTableProps {
  tickets: readonly EventTicketOrder[];
  isProcessingId: string | null;
  onCheckIn: (ticket: EventTicketOrder) => void;
  onReset: (ticket: EventTicketOrder) => void;
  onViewQR: (ticket: EventTicketOrder) => void;
  onSwitchToCheckedTab?: () => void;
  activeTab: "UNCHECKED" | "CHECKED" | "ALL";
  totalUnfilteredCount: number;
  hasSearch?: boolean;
  selectedEventId?: string;
}

export function CheckInAttendeesTable({
  tickets,
  isProcessingId,
  onCheckIn,
  onReset,
  onViewQR,
  onSwitchToCheckedTab,
  activeTab,
  totalUnfilteredCount,
  hasSearch = false,
  selectedEventId,
}: CheckInAttendeesTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, hasSearch, selectedEventId]);

  const totalItems = tickets.length;
  const maxPage = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, maxPage);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedTickets = tickets.slice(startIndex, startIndex + pageSize);

  if (totalItems === 0) {
    if (activeTab === "UNCHECKED" && totalUnfilteredCount > 0 && !hasSearch) {
      return (
        <EmptyState
          icon={<CheckCircle2 />}
          title="Semua peserta sudah hadir"
          description="Seluruh tiket peserta yang terdaftar pada event ini telah selesai check-in."
          action={
            onSwitchToCheckedTab ? (
              <Button type="button" size="default" variant="outline" onClick={onSwitchToCheckedTab}>
                <span>Lihat peserta yang sudah hadir</span>
              </Button>
            ) : undefined
          }
          className="border"
        />
      );
    }

    return (
      <EmptyState
        icon={<Ticket />}
        title="Tiket tidak ditemukan"
        description="Tidak ada data tiket peserta yang cocok dengan filter atau pencarian."
        className="border"
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="py-3 px-4">Tiket</TableHead>
              <TableHead className="py-3 px-4">Peserta</TableHead>
              <TableHead className="py-3 px-4 hidden lg:table-cell">Kontak</TableHead>
              <TableHead className="py-3 px-4 text-center">Jumlah</TableHead>
              <TableHead className="py-3 px-4 text-center">Status</TableHead>
              <TableHead className="py-3 px-4 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTickets.map((ticket) => {
              const ticketCount = ticket.ticketCount || 1;
              const checkedQty =
                typeof ticket.checkedInQty === "number"
                  ? ticket.checkedInQty
                  : ticket.checkInStatus === "CHECKED_IN"
                  ? ticketCount
                  : 0;

              const isFullyCheckedIn = ticket.checkInStatus === "CHECKED_IN" || checkedQty >= ticketCount;
              const isPartiallyCheckedIn = !isFullyCheckedIn && checkedQty > 0;
              const isPaid =
                ticket.paymentStatus === "PAID" &&
                ticket.refundStatus !== "REQUESTED" &&
                ticket.refundStatus !== "APPROVED";
              const isProcessing = isProcessingId === ticket.id;

              const checkInStatus = getCheckInStatusTone(ticket);
              const paymentTone = getPaymentStatusTone(ticket.paymentStatus);
              const paymentLabel = formatPaymentStatusLabel(ticket.paymentStatus);

              return (
                <TableRow key={ticket.id}>
                  {/* Tiket Code */}
                  <TableCell className="py-3 px-4 whitespace-normal">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-medium text-foreground">
                        {ticket.ticketCode}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onViewQR(ticket)}
                        title="Lihat QR Code tiket"
                        aria-label="Lihat QR Code tiket"
                      >
                        <QrCode />
                      </Button>
                      {ticket.isInvitation && (
                        <Badge
                          variant="outline"
                          className="text-xs border-primary/20 bg-primary/10 text-primary"
                        >
                          Tiket undangan
                        </Badge>
                      )}
                      {ticket.ticketTierName && (
                        <Badge variant="secondary" className="text-xs">
                          {ticket.ticketTierName}
                        </Badge>
                      )}
                      {ticket.promoCode && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Promo: {ticket.promoCode}
                        </Badge>
                      )}
                      {ticket.selectedSeats && ticket.selectedSeats.length > 0 && (
                        <Badge
                          variant="outline"
                          className="text-xs font-mono border-primary/20 bg-primary/10 text-primary"
                        >
                          Kursi: {formatSeatsList(ticket.selectedSeats)}
                        </Badge>
                      )}
                    </div>
                    {ticket.invitationNote && (
                      <p className="text-xs text-muted-foreground italic truncate max-w-[220px]" title={ticket.invitationNote}>
                        {ticket.invitationNote}
                      </p>
                    )}
                    {ticket.checkInTime && (
                      <p className="text-xs text-muted-foreground">
                        {formatCheckInTime(ticket.checkInTime)}
                      </p>
                    )}
                  </TableCell>

                  {/* Peserta */}
                  <TableCell className="py-3 px-4 whitespace-normal">
                    <p className="font-medium text-foreground">{ticket.guestName}</p>
                    {ticket.institution && (
                      <p className="text-xs text-muted-foreground">{ticket.institution}</p>
                    )}
                    <p className="text-xs text-muted-foreground lg:hidden">
                      {ticket.guestPhone}
                    </p>
                  </TableCell>

                  {/* Kontak */}
                  <TableCell className="py-3 px-4 hidden lg:table-cell text-muted-foreground">
                    <p>{ticket.guestEmail}</p>
                    <p className="font-mono text-xs">{ticket.guestPhone}</p>
                  </TableCell>

                  {/* Jumlah */}
                  <TableCell className="py-3 px-4 text-center font-medium text-foreground">
                    <span className="tabular-nums">{ticketCount}</span> tiket
                  </TableCell>

                  {/* Status */}
                  <TableCell className="py-3 px-4 text-center">
                    <div className="inline-flex flex-col items-center gap-1">
                      <StatusBadge status={checkInStatus.tone}>{checkInStatus.label}</StatusBadge>
                      <StatusBadge status={paymentTone}>{paymentLabel}</StatusBadge>
                    </div>
                  </TableCell>

                  {/* Aksi */}
                  <TableCell className="py-3 px-4 text-right">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      {!isFullyCheckedIn ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            disabled={!isPaid || isProcessing}
                            onClick={() => onCheckIn(ticket)}
                          >
                            {isProcessing ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Check />
                            )}
                            <span>
                              {isProcessing
                                ? "Menyimpan..."
                                : ticketCount > 1
                                ? "Rombongan"
                                : "Check-in"}
                            </span>
                          </Button>

                          {isPartiallyCheckedIn && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isProcessing}
                              onClick={() => onReset(ticket)}
                              title="Reset kehadiran"
                              aria-label="Reset kehadiran"
                            >
                              <RotateCcw />
                            </Button>
                          )}
                        </>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isProcessing}
                          onClick={() => onReset(ticket)}
                        >
                          <RotateCcw />
                          <span>Reset</span>
                        </Button>
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
        currentPage={safePage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
        itemLabel="tiket"
      />
    </div>
  );
}
