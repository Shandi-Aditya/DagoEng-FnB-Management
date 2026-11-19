"use client";

import {
  Archive,
  Calendar,
  CheckCircle2,
  DollarSign,
  Edit,
  ExternalLink,
  MapPin,
  MessageSquare,
  Phone,
  Ticket,
  Trash2,
  UserCheck,
  XCircle,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/app/status-badge";
import type { CommunityEvent } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";
import { organizerSharePercent } from "@/features/events-portal/events-portal-groups";
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

export interface EventDetailSheetProps {
  event: CommunityEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (event: CommunityEvent) => void;
  onRequestRevision: (event: CommunityEvent) => void;
  onReject: (event: CommunityEvent) => void;
  onArchive: (event: CommunityEvent) => void;
  onEdit: (event: CommunityEvent) => void;
  onManageAttendees: (event: CommunityEvent) => void;
  onManagePromos?: (event: CommunityEvent) => void;
  onDelete?: (event: CommunityEvent) => void;
  isProcessing?: boolean;
}

export function EventDetailSheet({
  event,
  open,
  onOpenChange,
  onApprove,
  onRequestRevision,
  onReject,
  onArchive,
  onEdit,
  onManageAttendees,
  onManagePromos,
  onDelete,
  isProcessing,
}: EventDetailSheetProps) {
  if (!event) return null;

  const effStatus = getEffectiveStatus(event);
  const waUrl = formatWhatsAppUrl(event.organizerPhone);
  const isPaid = isEventPaidEffective(event);
  const priceDisplay = formatEventPriceSummary(event);

  const formattedDate = formatDateSafe(event.startDate);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-6 overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <StatusBadge status={eventStatusTone(effStatus)}>
              {eventStatusLabel(effStatus)}
            </StatusBadge>
            <span className="text-xs text-muted-foreground">
              {eventCategoryLabel(event.category)}
            </span>
          </div>
          <SheetTitle className="text-xl font-medium text-foreground">
            {event.title}
          </SheetTitle>
          <SheetDescription className="text-xs">
            Diajukan oleh {event.organizerName}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 py-4">
          {/* Poster Preview */}
          {event.posterUrl ? (
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.posterUrl}
                alt={event.title}
                className="size-full object-cover"
                loading="lazy"
              />
            </div>
          ) : null}

          {/* Key Facts */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border bg-muted/40 p-3 flex flex-col gap-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3.5" />
                <span>Jadwal</span>
              </span>
              <span className="font-medium text-foreground">{formattedDate}</span>
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 flex flex-col gap-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <Ticket className="size-3.5" />
                <span>Tiket & Kuota</span>
              </span>
              <span className="font-medium text-foreground font-mono tabular-nums">
                {priceDisplay} ({event.maxCapacity || "—"} kuota)
              </span>
            </div>

            <div className="col-span-2 rounded-lg border bg-muted/40 p-3 flex flex-col gap-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <MapPin className="size-3.5" />
                <span>Lokasi / Venue</span>
              </span>
              <span className="font-medium text-foreground">{event.location}</span>
            </div>
          </div>

          {/* Rincian Tier Bertingkat */}
          {event.ticketTiers && event.ticketTiers.length > 0 && (
            <div className="rounded-lg border p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b pb-1.5">
                <span className="font-medium text-foreground">Rincian jenis tiket ({event.ticketTiers.length})</span>
                <Badge variant="outline" className="text-xs font-mono">
                  Total kuota: {event.ticketTiers.reduce((acc, t) => acc + (t.quota || 0), 0)} tiket
                </Badge>
              </div>
              <div className="space-y-1.5">
                {event.ticketTiers.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
                    <div>
                      <span className="font-medium text-foreground block">{t.name}</span>
                      <span className="text-xs text-muted-foreground block">
                        Kuota {t.quota} tiket
                        {t.description ? ` · ${t.description}` : ""}
                      </span>
                    </div>
                    <span className="font-mono font-medium text-foreground">
                      {t.price > 0 ? formatCurrencyIDR(t.price) : "Gratis"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Penyelenggara */}
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Kontak penyelenggara</h3>
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-foreground">{event.organizerName}</span>
              {event.organizerEmail ? (
                <span className="text-muted-foreground">{event.organizerEmail}</span>
              ) : null}
              {event.organizerPhone ? (
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Phone className="size-3.5" />
                    <span>WhatsApp: {event.organizerPhone}</span>
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          {/* Deskripsi */}
          {event.description ? (
            <div className="space-y-1.5">
              <h3 className="text-xs font-medium text-muted-foreground">Deskripsi event</h3>
              <p className="text-xs leading-relaxed text-foreground whitespace-pre-line">
                {event.description}
              </p>
            </div>
          ) : null}

          {/* Aturan / Guidelines */}
          {event.guidelines && event.guidelines.length > 0 ? (
            <div className="space-y-1.5">
              <h3 className="text-xs font-medium text-muted-foreground">Panduan & ketentuan peserta</h3>
              <ul className="text-xs text-foreground space-y-1 list-disc list-inside">
                {event.guidelines.map((g, idx) => (
                  <li key={idx}>{g}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Catatan Penolakan / Revisi Terakhir */}
          {event.rejectionReason ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 space-y-1 text-xs">
              <p className="font-medium text-destructive">Catatan penolakan / revisi:</p>
              <p className="text-muted-foreground">{event.rejectionReason}</p>
            </div>
          ) : null}

          {/* Informasi Bagi Hasil */}
          {isEventPaidEffective(event) ? (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Kesepakatan bagi hasil</span>
                <Badge variant="outline">
                  Platform {100 - organizerSharePercent(event)}% : Mitra {organizerSharePercent(event)}%
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Setiap tiket berbayar yang lunas otomatis dibagi sesuai persentase yang disepakati.
              </p>
            </div>
          ) : null}
        </div>

        {/* Action Buttons Footer */}
        <SheetFooter className="mt-auto pt-4 border-t gap-2 flex-col sm:flex-row">
          {(effStatus === "PENDING" || effStatus === "REVISION_REQUESTED") ? (
            <div className="flex flex-col gap-2 w-full">
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <Button
                  variant="default"
                  size="lg"
                  className="flex-1"
                  onClick={() => {
                    onOpenChange(false);
                    onApprove(event);
                  }}
                  disabled={isProcessing}
                >
                  <CheckCircle2 />
                  <span>Setujui</span>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    onOpenChange(false);
                    onRequestRevision(event);
                  }}
                  disabled={isProcessing}
                >
                  <MessageSquare />
                  <span>Revisi</span>
                </Button>
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={() => {
                    onOpenChange(false);
                    onReject(event);
                  }}
                  disabled={isProcessing}
                >
                  <XCircle />
                  <span>Tolak</span>
                </Button>
              </div>
              {onDelete ? (
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={() => {
                    onOpenChange(false);
                    onDelete(event);
                  }}
                  disabled={isProcessing}
                >
                  <Trash2 />
                  <span>Hapus permanen</span>
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 w-full justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    onOpenChange(false);
                    onManageAttendees(event);
                  }}
                >
                  <UserCheck />
                  <span>Peserta</span>
                </Button>
                {onManagePromos && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      onOpenChange(false);
                      onManagePromos(event);
                    }}
                  >
                    <Tag className="size-4" />
                    <span>Kelola promo</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit(event);
                  }}
                >
                  <Edit />
                  <span>Edit</span>
                </Button>
              </div>

              <div className="flex gap-2">
                {effStatus === "APPROVED" ? (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      onOpenChange(false);
                      onArchive(event);
                    }}
                    disabled={isProcessing}
                  >
                    <Archive />
                    <span>Arsipkan</span>
                  </Button>
                ) : null}

                {onDelete ? (
                  <Button
                    variant="outline"
                    size="lg"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                    onClick={() => {
                      onOpenChange(false);
                      onDelete(event);
                    }}
                    disabled={isProcessing}
                  >
                    <Trash2 />
                    <span>Hapus</span>
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
