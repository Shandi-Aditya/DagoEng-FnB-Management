"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  FileEdit,
  ExternalLink,
  AlertTriangle,
  ArrowRight,
  Tag,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatCurrencyIDR } from "@/lib/utils";
import type { CommunityEvent, EventTicketOrder } from "@/types/event";
import {
  formatEventPriceSummary,
  isEventPaidEffective,
} from "@/features/events-catalog/events-catalog-domain";
import {
  calculateEventOccupancy,
  calculateEventSalesSummary,
  eventCategoryLabel,
  eventStatusLabel,
  eventStatusTone,
  formatDateSafe,
  getEffectiveStatus,
} from "./events-portal-domain";
import { organizerSharePercent } from "./events-portal-groups";

export interface OrganizerEventDetailModalProps {
  event: CommunityEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookings: EventTicketOrder[];
  onEditRevision: (event: CommunityEvent) => void;
  onReviewSplit: (event: CommunityEvent) => void;
  onManagePromos?: (event: CommunityEvent) => void;
}

export function OrganizerEventDetailModal({
  event,
  open,
  onOpenChange,
  bookings,
  onEditRevision,
  onReviewSplit,
  onManagePromos,
}: OrganizerEventDetailModalProps) {
  if (!event) return null;

  const effStatus = getEffectiveStatus(event);
  const occupancy = calculateEventOccupancy(event, bookings);
  const isPaid = isEventPaidEffective(event);

  const eventBookings = bookings.filter((b) => b.eventId === event.id);
  const paidBookings = eventBookings.filter((b) => b.paymentStatus === "PAID");
  const salesSummary = calculateEventSalesSummary(event, bookings);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-6">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={eventStatusTone(effStatus)}>
              {eventStatusLabel(effStatus)}
            </StatusBadge>
            <Badge variant="outline" className="text-xs">
              {eventCategoryLabel(event.category)}
            </Badge>
          </div>
          <DialogTitle className="text-lg font-medium leading-tight">
            {event.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            ID: {event.id} &bull; Dibuat {formatDateSafe(event.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2 text-xs">
          {/* Poster Image */}
          {event.posterUrl ? (
            <div className="relative aspect-video max-h-72 w-full overflow-hidden rounded-lg border bg-muted">
              <Image
                src={event.posterUrl}
                alt={event.title}
                fill
                sizes="(max-width: 768px) 100vw, 650px"
                className="object-cover"
                unoptimized
              />
            </div>
          ) : null}

          {/* Notes if revision or rejected */}
          {event.status === "REVISION_REQUESTED" && event.revisionNotes && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-warning">
                <AlertTriangle className="size-4 shrink-0" />
                <span>Catatan kurasi tim Dago Hub:</span>
              </div>
              <p className="text-muted-foreground leading-relaxed pl-5">
                {event.revisionNotes}
              </p>
            </div>
          )}

          {event.status === "REJECTED" && event.rejectionReason && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                <span>Alasan penolakan proposal:</span>
              </div>
              <p className="text-muted-foreground leading-relaxed pl-5">
                {event.rejectionReason}
              </p>
            </div>
          )}

          {/* Operational & Financial Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-md border p-2.5 bg-muted/20">
              <span className="text-muted-foreground block text-xs">Harga tiket</span>
              <span className="font-mono font-medium block mt-0.5 text-foreground">
                {formatEventPriceSummary(event)}
              </span>
            </div>
            <div className="rounded-md border p-2.5 bg-muted/20">
              <span className="text-muted-foreground block text-xs">Kapasitas</span>
              <span className="font-mono font-medium block mt-0.5 text-foreground">
                {occupancy.totalCapacity} orang
              </span>
            </div>
            <div className="rounded-md border p-2.5 bg-muted/20">
              <span className="text-muted-foreground block text-xs">Tiket terjual</span>
              <span className="font-mono font-medium block mt-0.5 text-foreground">
                {occupancy.ticketsPaid} ({occupancy.occupancyRate}%)
              </span>
            </div>
            <div className="rounded-md border p-2.5 bg-muted/20">
              <span className="text-muted-foreground block text-xs">Hak bagi hasil</span>
              <span className="font-mono font-medium block mt-0.5 text-foreground">
                {formatCurrencyIDR(salesSummary.organizerEarnings)}
              </span>
            </div>
          </div>

          {/* Ticket Tier Breakdown */}
          {salesSummary.tierBreakdown.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground block">Penjualan per jenis tiket</span>
                <span className="text-xs text-muted-foreground">
                  Sisa total: {salesSummary.remainingCapacity} dari {salesSummary.totalCapacity} tiket
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <Table className="w-full text-xs">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-b">
                      <TableHead className="p-2 font-medium">Jenis tiket</TableHead>
                      <TableHead className="p-2 font-medium">Harga</TableHead>
                      <TableHead className="p-2 font-medium text-center">Terjual</TableHead>
                      <TableHead className="p-2 font-medium text-center">Sisa kuota</TableHead>
                      <TableHead className="p-2 font-medium text-right">Omzet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesSummary.tierBreakdown.map((t) => (
                      <TableRow key={t.tierId} className="hover:bg-muted/20">
                        <TableCell className="p-2 font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <span>{t.tierName}</span>
                            {t.isSoldOut && (
                              <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                                Habis
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="p-2 font-mono text-muted-foreground">
                          {t.price > 0 ? formatCurrencyIDR(t.price) : "Gratis"}
                        </TableCell>
                        <TableCell className="p-2 text-center font-mono tabular-nums text-foreground">
                          {t.soldCount}
                        </TableCell>
                        <TableCell className="p-2 text-center font-mono tabular-nums text-muted-foreground">
                          {t.remainingQuota}
                        </TableCell>
                        <TableCell className="p-2 text-right font-mono tabular-nums font-medium text-foreground">
                          {formatCurrencyIDR(t.revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Schedule & Location */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center gap-2 text-foreground">
              <Calendar className="size-4 text-muted-foreground shrink-0" />
              <span>
                {formatDateSafe(event.startDate, true)}
                {event.endDate ? ` — ${formatDateSafe(event.endDate, true)}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 text-foreground">
              <MapPin className="size-4 text-muted-foreground shrink-0" />
              <span>{event.location || "Amphitheater Dago Creative Hub"}</span>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="space-y-1.5 border-t pt-3">
              <span className="font-medium text-foreground block">Deskripsi acara</span>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {event.description}
              </p>
            </div>
          )}

          {/* Guidelines */}
          {event.guidelines && (
            <div className="space-y-1.5 border-t pt-3">
              <span className="font-medium text-foreground block">Panduan & ketentuan peserta</span>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {event.guidelines}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
          {(event.status === "REVISION_REQUESTED" || event.status === "REJECTED") && (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onEditRevision(event);
              }}
            >
              <FileEdit />
              <span>Perbaiki & ajukan ulang</span>
            </Button>
          )}

          {event.proposedRevenueSplit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onReviewSplit(event);
              }}
            >
              <span>Tinjau usulan bagi hasil</span>
              <ArrowRight />
            </Button>
          )}

          {event.status === "APPROVED" && (
            <>
              {onManagePromos && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onManagePromos(event);
                  }}
                >
                  <Tag className="size-3.5" />
                  <span>Kelola promo</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link
                    href={`/events/${event.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
                nativeButton={false}
              >
                <ExternalLink />
                <span>Lihat di katalog publik</span>
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
