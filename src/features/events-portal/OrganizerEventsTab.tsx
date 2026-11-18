"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CalendarDays, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { DataPagination } from "@/components/app/data-pagination";
import { formatCurrencyIDR } from "@/lib/utils";
import type { CommunityEvent, EventTicketOrder } from "@/types/event";
import {
  calculateEventOccupancy,
  eventStatusLabel,
  eventStatusTone,
  formatDateSafe,
  getEffectiveStatus,
} from "./events-portal-domain";
import { pendingAction, type OrganizerEventGroups } from "./events-portal-groups";

export type SectionId = keyof OrganizerEventGroups;

const SECTIONS: readonly { id: SectionId; label: string; emptyTitle: string; empty: string }[] = [
  { id: "needsAction", label: "Perlu tindakan", emptyTitle: "Semua beres", empty: "Tidak ada event yang menunggu jawaban Anda." },
  { id: "upcoming", label: "Mendatang", emptyTitle: "Belum ada event mendatang", empty: "Event yang disetujui dan belum berlangsung tampil di sini." },
  { id: "inReview", label: "Ditinjau", emptyTitle: "Tidak ada yang ditinjau", empty: "Pengajuan yang sedang diperiksa admin tampil di sini." },
  { id: "past", label: "Selesai", emptyTitle: "Belum ada event selesai", empty: "Event yang sudah lewat, ditolak, atau diarsipkan tampil di sini." },
];

const PAGE_SIZE = 10;

interface OrganizerEventsTabProps {
  groups: OrganizerEventGroups;
  bookings: EventTicketOrder[];
  onSelectEvent: (event: CommunityEvent) => void;
  onEditRevision: (event: CommunityEvent) => void;
  onReviewSplit: (event: CommunityEvent) => void;
  onShowAttendees: (eventId: string) => void;
  /** Opens on this group instead of the first one with events, e.g. "inReview" right after submitting. */
  initialSection?: SectionId;
}

function matches(event: CommunityEvent, query: string): boolean {
  if (!query) return true;
  return event.title.toLowerCase().includes(query) || (event.location ?? "").toLowerCase().includes(query);
}

/** The organizer's events, sorted by what each one needs from them next. */
export function OrganizerEventsTab({
  groups,
  bookings,
  onSelectEvent,
  onEditRevision,
  onReviewSplit,
  onShowAttendees,
  initialSection,
}: OrganizerEventsTabProps) {
  const [section, setSection] = useState<SectionId>(
    () => initialSection ?? SECTIONS.find((s) => groups[s.id].length > 0)?.id ?? "upcoming",
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (initialSection) {
      setSection(initialSection);
    }
  }, [initialSection]);

  useEffect(() => {
    setPage(1);
  }, [groups, section, search]);

  const query = search.trim().toLowerCase();
  const visible = useMemo(() => groups[section].filter((e) => matches(e, query)), [groups, section, query]);
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-full overflow-x-auto no-scrollbar">
          <Tabs
            value={section}
            onValueChange={(value) => {
              setSection(value as SectionId);
              setPage(1);
            }}
          >
            <TabsList aria-label="Kelompok event">
              {SECTIONS.map((s) => (
                <TabsTrigger key={s.id} value={s.id}>
                  {s.label}
                  <Badge variant="secondary" className="ml-1 tabular-nums">
                    {groups[s.id].length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <InputGroup className="xl:max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari judul atau lokasi"
            aria-label="Cari event"
          />
        </InputGroup>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title={query ? "Tidak ada event yang cocok" : current.emptyTitle}
          description={query ? "Coba kata kunci lain." : current.empty}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {pageItems.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              bookings={bookings}
              onSelectEvent={onSelectEvent}
              onEditRevision={onEditRevision}
              onReviewSplit={onReviewSplit}
              onShowAttendees={onShowAttendees}
            />
          ))}
        </ul>
      )}

      {visible.length > PAGE_SIZE && (
        <DataPagination currentPage={page} totalItems={visible.length} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="event" />
      )}
    </div>
  );
}

interface EventRowProps {
  event: CommunityEvent;
  bookings: EventTicketOrder[];
  onSelectEvent: (event: CommunityEvent) => void;
  onEditRevision: (event: CommunityEvent) => void;
  onReviewSplit: (event: CommunityEvent) => void;
  onShowAttendees: (eventId: string) => void;
}

function EventRow({ event, bookings, onSelectEvent, onEditRevision, onReviewSplit, onShowAttendees }: EventRowProps) {
  const status = getEffectiveStatus(event);
  const action = pendingAction(event);
  const occupancy = calculateEventOccupancy(event, bookings);
  const isApproved = status === "APPROVED";
  const price = !event.isPaid || event.price === 0 ? "Gratis" : formatCurrencyIDR(event.price);

  return (
    <li className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={() => onSelectEvent(event)}
        className="flex min-w-0 flex-1 items-center gap-4 text-left"
        aria-label={`Detail ${event.title}`}
      >
        <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-unit-event/10 text-unit-event">
          {event.posterUrl ? (
            <Image src={event.posterUrl} alt="" fill sizes="64px" className="object-cover" unoptimized />
          ) : (
            <CalendarDays className="size-6" />
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{event.title}</span>
            <StatusBadge status={eventStatusTone(status)}>{eventStatusLabel(status)}</StatusBadge>
          </span>
          <span className="truncate text-sm text-muted-foreground">
            {formatDateSafe(event.startDate, true)} · {event.location || "Dago Creative Hub"} · {price}
          </span>
          {action === "revision" && event.revisionNotes ? (
            <span className="line-clamp-2 text-sm text-warning">{event.revisionNotes}</span>
          ) : null}
          {status === "REJECTED" && event.rejectionReason ? (
            <span className="line-clamp-2 text-sm text-muted-foreground">Alasan: {event.rejectionReason}</span>
          ) : null}
          {action === "split" && event.proposedRevenueSplit ? (
            <span className="text-sm text-warning">
              Tawaran bagi hasil {event.proposedRevenueSplit.organizerPercent}% untuk Anda menunggu jawaban.
            </span>
          ) : null}
        </span>
      </button>

      {isApproved && (
        <div className="flex flex-col gap-1.5 sm:w-40">
          <span className="text-sm tabular-nums text-muted-foreground">
            {occupancy.ticketsPaid}
            {occupancy.totalCapacity > 0 ? ` / ${occupancy.totalCapacity}` : ""} tiket
          </span>
          {occupancy.totalCapacity > 0 && <Progress value={occupancy.occupancyRate} aria-label="Tiket terjual" />}
        </div>
      )}

      <div className="flex shrink-0 gap-2">
        {action === "revision" && (
          <Button size="sm" onClick={() => onEditRevision(event)}>
            Perbaiki event
          </Button>
        )}
        {action === "split" && (
          <Button size="sm" onClick={() => onReviewSplit(event)}>
            Tinjau tawaran
          </Button>
        )}
        {isApproved && (
          <Button size="sm" variant="outline" onClick={() => onShowAttendees(event.id)}>
            Peserta
          </Button>
        )}
      </div>
    </li>
  );
}
