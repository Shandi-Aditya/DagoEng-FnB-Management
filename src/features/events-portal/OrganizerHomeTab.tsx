"use client";

import React, { useMemo } from "react";
import { ArrowRight, CalendarDays, MapPin, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { BrandRings } from "@/features/landing/home/BrandRings";
import { formatCurrencyIDR } from "@/lib/utils";
import type { CommunityEvent, EventTicketOrder } from "@/types/event";
import {
  calculateEventOccupancy,
  formatDateSafe,
  paymentStatusLabel,
  paymentStatusTone,
} from "./events-portal-domain";
import {
  checkedInGuests,
  pendingAction,
  type EventBalanceTotals,
  type OrganizerEventGroups,
} from "./events-portal-groups";

interface OrganizerHomeTabProps {
  groups: OrganizerEventGroups;
  bookings: EventTicketOrder[];
  totals: EventBalanceTotals;
  onSelectEvent: (event: CommunityEvent) => void;
  onEditRevision: (event: CommunityEvent) => void;
  onReviewSplit: (event: CommunityEvent) => void;
  onOpenCheckIn: () => void;
  onGoToEvents: () => void;
  onGoToAttendees: () => void;
  onGoToFinance: () => void;
  onSubmitEvent: () => void;
}

const RECENT_TICKETS = 5;

/** Answers "what needs me, and how is my next event doing" before anything else. */
export function OrganizerHomeTab({
  groups,
  bookings,
  totals,
  onSelectEvent,
  onEditRevision,
  onReviewSplit,
  onOpenCheckIn,
  onGoToEvents,
  onGoToAttendees,
  onGoToFinance,
  onSubmitEvent,
}: OrganizerHomeTabProps) {
  const nextEvent = groups.upcoming[0];
  const hasEvents = Object.values(groups).some((list) => list.length > 0);

  const ticketsSold = useMemo(
    () => bookings.filter((b) => b.paymentStatus === "PAID").reduce((sum, b) => sum + (b.ticketCount || 1), 0),
    [bookings],
  );

  const recentBookings = useMemo(
    () => [...bookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, RECENT_TICKETS),
    [bookings],
  );

  return (
    <div className="flex flex-col gap-6">
      {groups.needsAction.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle>Perlu tindakan Anda</CardTitle>
            <CardDescription>Event ini menunggu jawaban Anda sebelum bisa lanjut.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {groups.needsAction.map((event) => {
                const action = pendingAction(event);
                return (
                  <li key={event.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{event.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {action === "revision"
                          ? event.revisionNotes || "Admin meminta perbaikan data event."
                          : `Admin menawarkan bagi hasil ${event.proposedRevenueSplit?.organizerPercent}% untuk Anda.`}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      className="self-start sm:self-auto"
                      onClick={() => (action === "revision" ? onEditRevision(event) : onReviewSplit(event))}
                    >
                      {action === "revision" ? "Perbaiki event" : "Tinjau tawaran"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {nextEvent ? (
        <NextEventCard event={nextEvent} bookings={bookings} onOpenCheckIn={onOpenCheckIn} onSelectEvent={onSelectEvent} />
      ) : (
        <EmptyState
          icon={<CalendarDays />}
          title="Belum ada event mendatang"
          description={
            groups.inReview.length > 0
              ? `${groups.inReview.length} event sedang ditinjau admin. Event tampil di sini setelah disetujui.`
              : hasEvents
                ? "Ajukan event berikutnya. Setelah disetujui, tiket bisa langsung dijual."
                : "Ajukan event pertama Anda. Setelah disetujui, tiket bisa langsung dijual."
          }
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={onSubmitEvent}>Ajukan event</Button>
              {hasEvents ? (
                <Button variant="outline" onClick={onGoToEvents}>
                  Lihat semua event
                </Button>
              ) : null}
            </div>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Tiket terjual" value={String(ticketsSold)} hint="Dari pesanan yang sudah lunas" />
        <StatCard label="Bagian Anda" value={formatCurrencyIDR(totals.earnings)} hint={`Dari omzet ${formatCurrencyIDR(totals.gross)}`} />
        <StatCard
          label="Siap dicairkan"
          value={formatCurrencyIDR(totals.available)}
          hint={
            <button type="button" onClick={onGoToFinance} className="inline-flex items-center gap-1 hover:text-foreground">
              Buka keuangan <ArrowRight className="size-3" />
            </button>
          }
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tiket terbaru</CardTitle>
          <Button variant="ghost" size="sm" onClick={onGoToAttendees}>
            Semua peserta
            <ArrowRight />
          </Button>
        </CardHeader>
        <CardContent>
          {recentBookings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada tiket yang dipesan.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {recentBookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{b.guestName}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {b.ticketCount} tiket · {b.eventTitle}
                    </span>
                  </span>
                  <StatusBadge status={paymentStatusTone(b.paymentStatus)}>{paymentStatusLabel(b.paymentStatus)}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface NextEventCardProps {
  event: CommunityEvent;
  bookings: EventTicketOrder[];
  onOpenCheckIn: () => void;
  onSelectEvent: (event: CommunityEvent) => void;
}

/** The closest approved event in the event unit's green, with seats sold and guests already in. */
function NextEventCard({ event, bookings, onOpenCheckIn, onSelectEvent }: NextEventCardProps) {
  const occupancy = calculateEventOccupancy(event, bookings);
  const checkedIn = checkedInGuests(event.id, bookings);

  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-unit-event/10 p-4 sm:p-6">
      <BrandRings className="absolute -top-24 -right-16 -z-10 h-[160%] opacity-20" />
      <div className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm sm:max-w-xl">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-unit-event">Event berikutnya</p>
          <h2 className="text-xl font-medium text-balance">{event.title}</h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              {formatDateSafe(event.startDate, true)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" />
              {event.location || "Dago Creative Hub"}
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Tiket terjual</span>
            <span className="font-medium tabular-nums">
              {occupancy.ticketsPaid}
              {occupancy.totalCapacity > 0 ? ` dari ${occupancy.totalCapacity}` : ""}
            </span>
          </div>
          {occupancy.totalCapacity > 0 && <Progress value={occupancy.occupancyRate} aria-label="Tiket terjual" />}
          <p className="text-sm text-muted-foreground">
            {checkedIn > 0 ? `${checkedIn} peserta sudah check-in.` : "Belum ada peserta yang check-in."}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={onOpenCheckIn}>
            <ScanLine />
            Mulai check-in
          </Button>
          <Button variant="outline" onClick={() => onSelectEvent(event)}>
            Lihat detail
          </Button>
        </div>
      </div>
    </section>
  );
}
