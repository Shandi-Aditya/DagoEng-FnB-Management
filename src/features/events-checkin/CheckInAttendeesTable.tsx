"use client";

import React, { useEffect, useState } from "react";
import { QrCode, Check, RotateCcw, Loader2, Ticket, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground font-medium">
              <tr>
                <th className="py-3 px-4">Tiket</th>
                <th className="py-3 px-4">Peserta</th>
                <th className="py-3 px-4 hidden lg:table-cell">Kontak</th>
                <th className="py-3 px-4 text-center">Jumlah</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
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
                  <tr key={ticket.id} className="hover:bg-muted/30 transition-colors">
                    {/* Tiket Code */}
                    <td className="py-3 px-4">
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
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                            Tiket undangan
                          </span>
                        )}
                        {ticket.ticketTierName && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                            {ticket.ticketTierName}
                          </span>
                        )}
                        {ticket.promoCode && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border">
                            Promo: {ticket.promoCode}
                          </span>
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
                    </td>

                    {/* Peserta */}
                    <td className="py-3 px-4">
                      <p className="font-medium text-foreground">{ticket.guestName}</p>
                      {ticket.institution && (
                        <p className="text-xs text-muted-foreground">{ticket.institution}</p>
                      )}
                      <p className="text-xs text-muted-foreground lg:hidden">
                        {ticket.guestPhone}
                      </p>
                    </td>

                    {/* Kontak */}
                    <td className="py-3 px-4 hidden lg:table-cell text-muted-foreground">
                      <p>{ticket.guestEmail}</p>
                      <p className="font-mono text-xs">{ticket.guestPhone}</p>
                    </td>

                    {/* Jumlah */}
                    <td className="py-3 px-4 text-center font-medium text-foreground">
                      <span className="tabular-nums">{ticketCount}</span> tiket
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <StatusBadge status={checkInStatus.tone}>{checkInStatus.label}</StatusBadge>
                        <StatusBadge status={paymentTone}>{paymentLabel}</StatusBadge>
                      </div>
                    </td>

                    {/* Aksi */}
                    <td className="py-3 px-4 text-right">
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
