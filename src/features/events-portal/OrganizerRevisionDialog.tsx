"use client";

import React from "react";
import Image from "next/image";
import {
  AlertCircle,
  Upload,
  RefreshCw,
  ImageIcon,
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { CommunityEvent, EventCategory, EventTicketTier, EventRefundPolicy } from "@/types/event";
import { TicketTiersEditor } from "@/components/events/TicketTiersEditor";
import { EventRefundPolicyEditor } from "@/components/events/EventRefundPolicyEditor";
import { validateEventCapacity, validateEventTicketTiers } from "@/lib/event-validation";

interface OrganizerRevisionDialogProps {
  event: CommunityEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  setTitle: (v: string) => void;
  category: EventCategory;
  setCategory: (v: EventCategory) => void;
  description: string;
  setDescription: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  capacity: number;
  setCapacity: (v: number) => void;
  guidelines: string;
  setGuidelines: (v: string) => void;
  posterUrl: string;
  setPosterUrl: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  isUploadingPoster: boolean;
  uploadError: string | null;
  onUploadPoster: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmitRevision: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  ticketTiers?: EventTicketTier[];
  setTicketTiers?: (v: EventTicketTier[]) => void;
  refundPolicy?: EventRefundPolicy;
  setRefundPolicy?: (v: EventRefundPolicy) => void;
  hasPaidTickets?: boolean;
}

export function OrganizerRevisionDialog({
  event,
  open,
  onOpenChange,
  title,
  setTitle,
  category,
  setCategory,
  description,
  setDescription,
  location,
  setLocation,
  capacity,
  setCapacity,
  guidelines,
  setGuidelines,
  posterUrl,
  setPosterUrl,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isUploadingPoster,
  uploadError,
  onUploadPoster,
  onSubmitRevision,
  isSubmitting,
  ticketTiers,
  setTicketTiers,
  refundPolicy,
  setRefundPolicy,
  hasPaidTickets,
}: OrganizerRevisionDialogProps) {
  const [rawCapacity, setRawCapacity] = React.useState<string>(String(capacity ?? ""));
  const [capacityError, setCapacityError] = React.useState<string | null>(null);
  const [tiersError, setTiersError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRawCapacity(String(capacity ?? ""));
    setCapacityError(null);
    setTiersError(null);
  }, [event?.id, open]);

  const handleCapacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRawCapacity(val);
    if (val.trim() === "") {
      setCapacity(0);
      setCapacityError("Kuota kapasitas wajib diisi.");
      return;
    }
    const capCheck = validateEventCapacity(val, false);
    if (!capCheck.valid) {
      setCapacityError(capCheck.error || "Kapasitas tidak valid.");
    } else {
      setCapacityError(null);
      setCapacity(capCheck.value!);
    }
  };

  if (!event) return null;

  const handleSubmit = (e: React.FormEvent) => {
    const capCheck = validateEventCapacity(rawCapacity, false);
    const num = capCheck.value ?? Number(rawCapacity);
    if (!capCheck.valid) {
      e.preventDefault();
      setCapacityError(capCheck.error || "Kapasitas tidak valid.");
      return;
    }
    if (ticketTiers && ticketTiers.length > 0) {
      const tierCheck = validateEventTicketTiers(ticketTiers, { maxCapacity: num });
      if (!tierCheck.valid) {
        e.preventDefault();
        setTiersError(tierCheck.error || "Format tiket bertingkat tidak valid.");
        return;
      }
    }
    setCapacityError(null);
    setTiersError(null);
    onSubmitRevision(e);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">
            {event.status === "REJECTED" ? "Ajukan Ulang Event" : "Perbaiki Pengajuan Event"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Sesuaikan informasi event sesuai catatan kurator sebelum diajukan kembali ke kurasi.
          </DialogDescription>
        </DialogHeader>

        {/* Curator Feedback Quote */}
        {(event.revisionNotes || event.rejectionReason) && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-warning">
              <AlertCircle className="size-4 shrink-0" />
              <span>
                {event.status === "REJECTED" ? "Alasan penolakan kurator:" : "Catatan kurator Dago Hub:"}
              </span>
            </div>
            <p className="text-muted-foreground leading-relaxed pl-5 italic">
              &ldquo;{event.rejectionReason || event.revisionNotes}&rdquo;
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Poster Section */}
          <div className="rounded-lg border p-3.5 space-y-2 bg-muted/20">
            <label className="font-medium text-foreground block">Poster event</label>
            <div className="flex items-center gap-3">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-md border bg-muted flex items-center justify-center">
                {posterUrl ? (
                  <Image
                    src={posterUrl}
                    alt="Preview poster"
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <ImageIcon className="size-6 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 space-y-1.5">
                <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                  <Upload className="size-3.5" />
                  <span>{isUploadingPoster ? "Mengunggah..." : "Pilih gambar baru"}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={onUploadPoster}
                    disabled={isUploadingPoster}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                  placeholder="Atau masukkan URL poster..."
                  className="w-full h-8 rounded-md border bg-background px-2.5 text-xs text-muted-foreground font-mono"
                />
                {uploadError && (
                  <p className="text-xs text-destructive">{uploadError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-medium text-foreground">Judul acara</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="font-medium text-foreground">Kategori</label>
              <NativeSelect
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
              >
                <NativeSelectOption value="WORKSHOP">Workshop</NativeSelectOption>
                <NativeSelectOption value="MEETUP">Meetup</NativeSelectOption>
                <NativeSelectOption value="CREATIVE">Kreatif</NativeSelectOption>
                <NativeSelectOption value="COMMUNITY">Komunitas</NativeSelectOption>
                <NativeSelectOption value="TECH">Teknologi</NativeSelectOption>
                <NativeSelectOption value="SEMINAR">Seminar</NativeSelectOption>
                <NativeSelectOption value="OTHER">Lainnya</NativeSelectOption>
              </NativeSelect>
            </div>
          </div>

          {/* Venue & Capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-medium text-foreground">Lokasi / Ruang</label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Contoh: Amphitheater / Creative Hall"
                className="w-full h-9 rounded-md border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="font-medium text-foreground">Kapasitas</label>
              <input
                type="number"
                min={1}
                max={1000}
                step={1}
                required
                value={rawCapacity}
                onChange={handleCapacityChange}
                className="w-full h-9 rounded-md border bg-background px-3 text-xs font-mono font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              />
              {capacityError && <p className="text-xs text-destructive">{capacityError}</p>}
            </div>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-medium text-foreground">Waktu mulai (WITA)</label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="font-medium text-foreground">Waktu selesai (WITA)</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="font-medium text-foreground">Deskripsi acara</label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border bg-background p-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring resize-y"
            />
          </div>

          {/* Guidelines */}
          <div className="space-y-1">
            <label className="font-medium text-foreground">Panduan & ketentuan peserta</label>
            <textarea
              rows={2}
              value={guidelines}
              onChange={(e) => setGuidelines(e.target.value)}
              placeholder="Contoh: Membawa tumbler sendiri, berpakaian rapi..."
              className="w-full rounded-md border bg-background p-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring resize-y"
            />
          </div>

          {/* Ticket Tiers Editor */}
          {setTicketTiers && (
            <div className="border-t pt-3">
              <TicketTiersEditor
                tiers={ticketTiers || []}
                onChange={(newTiers) => {
                  setTicketTiers(newTiers);
                  const sumQuota = newTiers.reduce((acc, t) => acc + (t.quota || 0), 0);
                  if (sumQuota > 0) setCapacity(sumQuota);
                }}
              />
              {tiersError && <p className="text-xs text-destructive mt-1.5">{tiersError}</p>}
            </div>
          )}

          {/* Refund Policy Editor */}
          {setRefundPolicy && (event.isPaid || (ticketTiers && ticketTiers.some((t) => Number(t.price) > 0))) && (
            <div className="border-t pt-3">
              <EventRefundPolicyEditor
                value={refundPolicy || { policyType: "NO_REFUND" }}
                onChange={setRefundPolicy}
                hasPaidTickets={hasPaidTickets}
              />
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? <RefreshCw className="size-3.5 animate-spin" /> : null}
              <span>Kirim perbaikan</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
