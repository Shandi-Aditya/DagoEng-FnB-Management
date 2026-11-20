"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Download,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  Users,
  Check,
  Clock,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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
import type { CommunityEvent, EventTicketOrder } from "@/types/event";
import {
  EventDateRangeFilter,
  type DateRange,
} from "@/components/events/EventDateRangeFilter";
import {
  buildAttendeesExportRows,
  emptyOrganizerAttendeeMessage,
  filterOrganizerAttendees,
  formatWhatsAppUrl,
  paymentStatusLabel,
  paymentStatusTone,
} from "./events-portal-domain";
import { checkedInGuests } from "./events-portal-groups";
import { IssueInvitationDialog } from "@/components/events/IssueInvitationDialog";

interface OrganizerAttendeesTabProps {
  bookings: EventTicketOrder[];
  events: CommunityEvent[];
  selectedEventId: string;
  onSelectEventId: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateRange: DateRange | null;
  onDateRangeChange: (range: DateRange | null) => void;
  onExportCSV: (rows: EventTicketOrder[]) => void;
  onInvitationIssued?: () => void;
}

export function OrganizerAttendeesTab({
  bookings,
  events,
  selectedEventId,
  onSelectEventId,
  searchQuery,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  onExportCSV,
  onInvitationIssued,
}: OrganizerAttendeesTabProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("ALL");
  const [checkInStatusFilter, setCheckInStatusFilter] = useState("ALL");
  const [expandedBookingIds, setExpandedBookingIds] = useState<Set<string>>(new Set());
  const [isIssueInviteOpen, setIsIssueInviteOpen] = useState(false);
  const [inviteApprovedEventId, setInviteApprovedEventId] = useState<string>("");

  const approvedEvents = useMemo(
    () => events.filter((e) => e.status === "APPROVED"),
    [events]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [bookings, selectedEventId, searchQuery, dateRange, paymentStatusFilter, checkInStatusFilter, pageSize]);

  const toggleExpand = (id: string) => {
    setExpandedBookingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredAttendees = useMemo(() => {
    return filterOrganizerAttendees(
      bookings,
      selectedEventId,
      searchQuery,
      dateRange,
      paymentStatusFilter,
      checkInStatusFilter
    );
  }, [bookings, selectedEventId, searchQuery, dateRange, paymentStatusFilter, checkInStatusFilter]);

  const paginatedAttendees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAttendees.slice(start, start + pageSize);
  }, [filteredAttendees, currentPage, pageSize]);

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const targetInviteEvent = useMemo(() => {
    if (selectedEventId !== "ALL" && selectedEvent?.status === "APPROVED") {
      return selectedEvent;
    }
    return (
      approvedEvents.find((e) => e.id === (inviteApprovedEventId || approvedEvents[0]?.id)) ||
      null
    );
  }, [selectedEventId, selectedEvent, approvedEvents, inviteApprovedEventId]);
  const paidSeats = bookings
    .filter((b) => b.eventId === selectedEventId && b.paymentStatus === "PAID")
    .reduce((sum, b) => sum + (b.ticketCount || 1), 0);
  const checkedIn = checkedInGuests(selectedEventId, bookings);

  const hasActiveFilter = Boolean(
    searchQuery.trim() ||
      selectedEventId !== "ALL" ||
      dateRange ||
      paymentStatusFilter !== "ALL" ||
      checkInStatusFilter !== "ALL"
  );

  const handleResetFilters = () => {
    onSelectEventId("ALL");
    onSearchChange("");
    onDateRangeChange(null);
    setPaymentStatusFilter("ALL");
    setCheckInStatusFilter("ALL");
    setCurrentPage(1);
  };

  const emptyMsg = emptyOrganizerAttendeeMessage(hasActiveFilter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="w-full sm:w-48">
            <NativeSelect
              value={selectedEventId}
              onChange={(e) => {
                onSelectEventId(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter berdasarkan event"
            >
              <NativeSelectOption value="ALL">Semua event</NativeSelectOption>
              {events.map((e) => (
                <NativeSelectOption key={e.id} value={e.id}>
                  {e.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="w-full sm:w-40">
            <NativeSelect
              value={paymentStatusFilter}
              onChange={(e) => {
                setPaymentStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter status pembayaran"
            >
              <NativeSelectOption value="ALL">Semua bayar</NativeSelectOption>
              <NativeSelectOption value="PAID">Lunas</NativeSelectOption>
              <NativeSelectOption value="PENDING">Menunggu</NativeSelectOption>
              <NativeSelectOption value="REJECTED">Ditolak</NativeSelectOption>
              <NativeSelectOption value="CANCELLED">Dibatalkan</NativeSelectOption>
              <NativeSelectOption value="EXPIRED">Kedaluwarsa</NativeSelectOption>
            </NativeSelect>
          </div>

          <div className="w-full sm:w-44">
            <NativeSelect
              value={checkInStatusFilter}
              onChange={(e) => {
                setCheckInStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter status kehadiran"
            >
              <NativeSelectOption value="ALL">Semua kehadiran</NativeSelectOption>
              <NativeSelectOption value="CHECKED_IN">Sudah hadir</NativeSelectOption>
              <NativeSelectOption value="PARTIALLY_CHECKED_IN">Sebagian hadir</NativeSelectOption>
              <NativeSelectOption value="REGISTERED">Belum hadir</NativeSelectOption>
            </NativeSelect>
          </div>

          <div className="w-full sm:flex-1 min-w-[200px]">
            <InputGroup>
              <InputGroupAddon>
                <Search className="size-4 text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari nama, tiket, telepon..."
                aria-label="Cari tiket atau peserta"
              />
            </InputGroup>
          </div>

          <EventDateRangeFilter
            onApplyFilter={(range) => {
              onDateRangeChange(range);
              setCurrentPage(1);
            }}
            initialRange={dateRange}
            label="Periode order"
          />
        </div>

        <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
          {hasActiveFilter ? (
            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
              <RotateCcw />
              <span>Reset</span>
            </Button>
          ) : null}
          {selectedEventId === "ALL" && approvedEvents.length > 0 && (
            <div className="w-full sm:w-48">
              <NativeSelect
                value={inviteApprovedEventId || approvedEvents[0]?.id || ""}
                onChange={(e) => setInviteApprovedEventId(e.target.value)}
                aria-label="Pilih event untuk undangan"
              >
                {approvedEvents.map((e) => (
                  <NativeSelectOption key={e.id} value={e.id}>
                    {e.title}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}
          <Button
            size="sm"
            onClick={() => setIsIssueInviteOpen(true)}
            disabled={!targetInviteEvent}
          >
            <Mail className="size-4" />
            <span>Terbitkan tiket undangan</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExportCSV(filteredAttendees)} disabled={filteredAttendees.length === 0}>
            <Download />
            <span>Ekspor</span>
          </Button>
        </div>
      </div>

      {selectedEvent ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:gap-6">
          <span className="min-w-0 flex-1 truncate font-medium">{selectedEvent.title}</span>
          <span className="text-sm tabular-nums text-muted-foreground">
            {checkedIn} dari {paidSeats} peserta sudah check-in
          </span>
          <Progress
            value={paidSeats > 0 ? Math.round((checkedIn / paidSeats) * 100) : 0}
            className="sm:w-40"
            aria-label="Peserta sudah check-in"
          />
        </div>
      ) : null}

      {/* 2. Table */}
      {filteredAttendees.length === 0 ? (
        <EmptyState
          className="border"
          icon={<Users className="size-8 text-muted-foreground" />}
          title={emptyMsg.title}
          description={emptyMsg.description}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode tiket</TableHead>
                  <TableHead>Peserta & kontak</TableHead>
                  <TableHead className="hidden md:table-cell">Event</TableHead>
                  <TableHead className="hidden lg:table-cell">Jenis tiket</TableHead>
                  <TableHead className="hidden sm:table-cell text-center">Jumlah</TableHead>
                  <TableHead className="text-center">Status bayar</TableHead>
                  <TableHead className="text-center">Kehadiran</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAttendees.map((b) => {
                  const isExpanded = expandedBookingIds.has(b.id);
                  const qty = b.ticketCount || 1;
                  const checkedQty =
                    typeof b.checkedInQty === "number"
                      ? b.checkedInQty
                      : b.checkInStatus === "CHECKED_IN"
                      ? qty
                      : 0;
                  const isCheckedIn = b.checkInStatus === "CHECKED_IN" || checkedQty >= qty;
                  const isPartial = !isCheckedIn && checkedQty > 0;
                  const waUrl = formatWhatsAppUrl(b.guestPhone);

                  return (
                    <React.Fragment key={b.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => toggleExpand(b.id)}
                      >
                        <TableCell>
                          <div className="font-mono font-medium text-foreground">
                            {b.ticketCode}
                          </div>
                          {b.ticketCount > 1 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(b.id);
                              }}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-0.5 cursor-pointer"
                            >
                              <span>{isExpanded ? "Tutup rincian" : `Lihat ${b.ticketCount} tiket`}</span>
                              {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                            </button>
                          ) : null}
                        </TableCell>

                        <TableCell>
                          <div className="font-medium text-foreground">{b.guestName}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                            {b.guestPhone ? (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-success hover:underline"
                                title={`WhatsApp: ${b.guestPhone}`}
                              >
                                <Phone className="size-3" />
                                <span>{b.guestPhone}</span>
                              </a>
                            ) : null}
                            {b.guestEmail ? (
                              <a
                                href={`mailto:${b.guestEmail}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 hover:underline"
                              >
                                <Mail className="size-3" />
                                <span className="truncate max-w-[140px]">{b.guestEmail}</span>
                              </a>
                            ) : null}
                            {b.institution ? (
                              <span className="truncate max-w-[120px] text-muted-foreground">
                                &bull; {b.institution}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>

                        <TableCell className="hidden md:table-cell max-w-[180px] truncate text-muted-foreground">
                          {b.eventTitle || "—"}
                        </TableCell>

                        <TableCell className="hidden lg:table-cell">
                          <span className="text-xs font-medium text-foreground">
                            {b.ticketTierName || (b.isInvitation ? "Tiket undangan" : "Standar")}
                          </span>
                        </TableCell>

                        <TableCell className="hidden sm:table-cell text-center font-mono tabular-nums">
                          {b.ticketCount} orang
                        </TableCell>

                        <TableCell className="text-center">
                          <StatusBadge status={paymentStatusTone(b.paymentStatus)}>
                            {paymentStatusLabel(b.paymentStatus)}
                          </StatusBadge>
                        </TableCell>

                        <TableCell className="text-center">
                          {isCheckedIn ? (
                            <StatusBadge status="success">
                              <Check className="size-3 mr-1" />
                              <span>Hadir</span>
                            </StatusBadge>
                          ) : isPartial ? (
                            <StatusBadge status="info">
                              <Clock className="size-3 mr-1" />
                              <span>Hadir {checkedQty}/{qty}</span>
                            </StatusBadge>
                          ) : (
                            <StatusBadge status="neutral">
                              <Clock className="size-3 mr-1" />
                              <span>Belum hadir</span>
                            </StatusBadge>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expandable breakdown for multi-seat tickets */}
                      {isExpanded && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={7} className="p-3 text-xs">
                            <div className="rounded-md border bg-card p-3 space-y-2">
                              <div className="flex items-center justify-between font-medium">
                                <span>Rincian Tiket Pesanan ({b.ticketCount} Tiket)</span>
                                <span className="text-muted-foreground font-mono">
                                  Order ID: {b.id}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                                {Array.from({ length: b.ticketCount }).map((_, idx) => {
                                  const seatCode = `${b.ticketCode}-${String(idx + 1).padStart(2, "0")}`;
                                  const isSeatCheckedIn = idx < (b.checkedInQty || (isCheckedIn ? b.ticketCount : 0));

                                  return (
                                    <div
                                      key={seatCode}
                                      className="rounded border p-2 flex items-center justify-between gap-2"
                                    >
                                      <div>
                                        <span className="font-mono font-medium block">
                                          {seatCode}
                                        </span>
                                        <span className="text-muted-foreground text-xs block">
                                          Tiket #{idx + 1}
                                        </span>
                                      </div>
                                      <StatusBadge status={isSeatCheckedIn ? "success" : "neutral"}>
                                        {isSeatCheckedIn ? "Hadir" : "Belum"}
                                      </StatusBadge>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={filteredAttendees.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="peserta"
          />
        </div>
      )}

      <IssueInvitationDialog
        open={isIssueInviteOpen}
        onOpenChange={setIsIssueInviteOpen}
        event={targetInviteEvent}
        onInvitationIssued={() => {
          onInvitationIssued?.();
        }}
      />
    </div>
  );
}
