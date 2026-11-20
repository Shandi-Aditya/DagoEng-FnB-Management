"use client";

import {
  Archive,
  Calendar,
  CheckCircle2,
  Edit,
  Eye,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { DataPagination } from "@/components/app/data-pagination";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CommunityEvent } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  formatEventPriceSummary,
  isEventPaidEffective,
} from "@/features/events-catalog/events-catalog-domain";
import {
  eventCategoryLabel,
  eventStatusLabel,
  eventStatusTone,
  formatDateSafe,
  formatWhatsAppUrl,
  getEffectiveStatus,
} from "./events-admin-domain";

export interface EventsModerationTableProps {
  events: CommunityEvent[];
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onViewDetail: (event: CommunityEvent) => void;
  onEdit: (event: CommunityEvent) => void;
  onManageAttendees: (event: CommunityEvent) => void;
  onApprove: (event: CommunityEvent) => void;
  onRequestRevision: (event: CommunityEvent) => void;
  onReject: (event: CommunityEvent) => void;
  onArchive: (event: CommunityEvent) => void;
  onDelete?: (event: CommunityEvent) => void;
  searchQuery?: string;
}

export function EventsModerationTable({
  events,
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onViewDetail,
  onEdit,
  onManageAttendees,
  onApprove,
  onRequestRevision,
  onReject,
  onArchive,
  onDelete,
  searchQuery,
}: EventsModerationTableProps) {
  const startIndex = (currentPage - 1) * pageSize;
  const pagedEvents = events.slice(startIndex, startIndex + pageSize);

  if (events.length === 0) {
    return (
      <EmptyState
        className="border"
        icon={<Calendar />}
        title={searchQuery ? "Tidak ada event yang cocok" : "Belum ada pengajuan event"}
        description={
          searchQuery
            ? `Tidak ditemukan event yang sesuai dengan kata kunci "${searchQuery}". Coba ubah pencarian atau filter status.`
            : "Pengajuan event dari komunitas atau mitra akan masuk ke sini untuk dimoderasi."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Event</TableHead>
              <TableHead className="hidden md:table-cell">Kategori & Harga</TableHead>
              <TableHead className="hidden lg:table-cell">Jadwal & Lokasi</TableHead>
              <TableHead className="hidden sm:table-cell">Penyelenggara</TableHead>
              <TableHead className="hidden md:table-cell text-right">Tiket</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-0 text-right">
                <span className="sr-only">Aksi</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedEvents.map((event) => {
              const effStatus = getEffectiveStatus(event);
              const isPaid = isEventPaidEffective(event);
              const priceSummary = formatEventPriceSummary(event);
              const bookedCount = (event as any).bookedCount || 0;
              const relatedBookingsCount = (event as any).relatedBookingsCount ?? bookedCount;
              const maxCapacity = event.maxCapacity || 0;
              const waUrl = formatWhatsAppUrl(event.organizerPhone);

              const formattedDate = formatDateSafe(event.startDate);

              return (
                <TableRow key={event.id}>
                  {/* Event & Poster */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-md border bg-muted">
                        {event.posterUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={event.posterUrl}
                            alt={event.title}
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-muted-foreground">
                            <Calendar className="size-4" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-foreground line-clamp-1 whitespace-normal">
                          {event.title}
                        </span>
                        <span className="text-xs text-muted-foreground lg:hidden">
                          {formattedDate} · {event.location}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Kategori & Harga */}
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-foreground">
                        {eventCategoryLabel(event.category)}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono tabular-nums">
                        {priceSummary}
                      </span>
                    </div>
                  </TableCell>

                  {/* Jadwal & Lokasi */}
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-foreground">
                        {formattedDate}
                      </span>
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {event.location}
                      </span>
                    </div>
                  </TableCell>

                  {/* Penyelenggara */}
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-foreground line-clamp-1">
                        {event.organizerName}
                      </span>
                      {event.organizerPhone ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          {event.organizerPhone}
                        </a>
                      ) : null}
                    </div>
                  </TableCell>

                  {/* Tiket */}
                  <TableCell className="hidden md:table-cell text-right">
                    <span className="text-xs font-mono tabular-nums text-foreground">
                      {bookedCount} / {maxCapacity || "—"}
                    </span>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <StatusBadge status={eventStatusTone(effStatus)}>
                      {eventStatusLabel(effStatus)}
                    </StatusBadge>
                  </TableCell>

                  {/* Aksi */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetail(event)}
                      >
                        <Eye />
                        <span className="hidden sm:inline">Detail</span>
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label="Aksi lainnya"
                            />
                          }
                        >
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onViewDetail(event)}>
                            <Eye />
                            <span>Lihat rincian</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => onManageAttendees(event)}>
                            <UserCheck />
                            <span>Kelola peserta & tiket</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => onEdit(event)}>
                            <Edit />
                            <span>Ubah data event</span>
                          </DropdownMenuItem>

                          {(effStatus === "PENDING" || effStatus === "REVISION_REQUESTED") ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onApprove(event)}
                                className="text-success focus:text-success"
                              >
                                <CheckCircle2 />
                                <span>Setujui pengajuan</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem onClick={() => onRequestRevision(event)}>
                                <MessageSquare />
                                <span>Minta revisi</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => onReject(event)}
                                className="text-destructive focus:text-destructive"
                              >
                                <XCircle />
                                <span>Tolak pengajuan</span>
                              </DropdownMenuItem>
                            </>
                          ) : null}

                          {effStatus === "APPROVED" ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onArchive(event)}>
                                <Archive />
                                <span>Arsipkan event</span>
                              </DropdownMenuItem>
                            </>
                          ) : null}

                          {onDelete && relatedBookingsCount === 0 && (effStatus === "PENDING" || effStatus === "REVISION_REQUESTED" || effStatus === "REJECTED" || effStatus === "ARCHIVED") ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onDelete(event)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 />
                                <span>Hapus permanen</span>
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        itemLabel="event"
      />
    </div>
  );
}
