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
import { StatusBadge } from "@/components/app/status-badge";
import { formatCurrencyIDR } from "@/lib/utils";
import type { CommunityEvent, EventTicketOrder } from "@/types/event";
import {
  calculateEventOccupancy,
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
}

export function OrganizerEventDetailModal({
  event,
  open,
  onOpenChange,
  bookings,
  onEditRevision,
  onReviewSplit,
}: OrganizerEventDetailModalProps) {
  if (!event) return null;

  const effStatus = getEffectiveStatus(event);
  const occupancy = calculateEventOccupancy(event, bookings);
  const isFree = !event.isPaid || event.price === 0;

  const eventBookings = bookings.filter((b) => b.eventId === event.id);
  const paidBookings = eventBookings.filter((b) => b.paymentStatus === "PAID");
  const grossSales = paidBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  const sharePercent = organizerSharePercent(event);
  const organizerShare = Math.round(grossSales * (sharePercent / 100));

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
                {isFree ? "Gratis" : formatCurrencyIDR(event.price)}
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
                {formatCurrencyIDR(organizerShare)}
              </span>
            </div>
          </div>

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
