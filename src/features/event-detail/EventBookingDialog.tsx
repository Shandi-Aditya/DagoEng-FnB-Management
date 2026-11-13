"use client";

import React from "react";
import { AlertCircle, Ticket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrencyIDR } from "@/lib/utils";
import type { PublicCommunityEvent } from "@/types/event";

export interface BookingFormData {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  institution: string;
  ticketCount: number;
}

interface EventBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: PublicCommunityEvent | null;
  form: BookingFormData;
  setForm: React.Dispatch<React.SetStateAction<BookingFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  error: string | null;
}

export function EventBookingDialog({
  open,
  onOpenChange,
  event,
  form,
  setForm,
  onSubmit,
  isSubmitting,
  error,
}: EventBookingDialogProps) {
  if (!event) return null;

  const maxAllowedPerTx = event.maxTicketsPerBooking || 5;
  const remainingTickets = event.availability?.ticketsRemaining ?? maxAllowedPerTx;
  const effectiveMaxTickets = Math.min(maxAllowedPerTx, Math.max(1, remainingTickets));
  const totalPrice = event.isPaid ? event.price * form.ticketCount : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Ticket className="size-5 text-primary" />
            <DialogTitle className="text-base font-medium">
              Pendaftaran Tiket Acara
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground truncate">
            {event.title}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 text-xs">
          {/* Guest Name */}
          <div className="space-y-1.5">
            <label className="font-medium text-foreground">
              Nama lengkap <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={form.guestName}
              onChange={(e) => setForm((prev) => ({ ...prev, guestName: e.target.value }))}
              placeholder="Contoh: Rian Pratama"
              className="w-full h-9 rounded-md border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-medium text-foreground">
                Alamat email <span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                required
                value={form.guestEmail}
                onChange={(e) => setForm((prev) => ({ ...prev, guestEmail: e.target.value }))}
                placeholder="nama@email.com"
                className="w-full h-9 rounded-md border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-foreground">
                No. WhatsApp <span className="text-destructive">*</span>
              </label>
              <input
                type="tel"
                required
                value={form.guestPhone}
                onChange={(e) => setForm((prev) => ({ ...prev, guestPhone: e.target.value }))}
                placeholder="08123456789"
                className="w-full h-9 rounded-md border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Institution */}
          <div className="space-y-1.5">
            <label className="font-medium text-foreground">
              Institusi / Komunitas (opsional)
            </label>
            <input
              type="text"
              value={form.institution}
              onChange={(e) => setForm((prev) => ({ ...prev, institution: e.target.value }))}
              placeholder="Contoh: Komunitas Barista / Mahasiswa / Umum"
              className="w-full h-9 rounded-md border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Ticket Count Stepper */}
          <div className="rounded-lg border bg-muted/20 p-3.5 flex items-center justify-between gap-3">
            <div>
              <span className="font-medium text-foreground block">Jumlah tiket</span>
              <span className="text-xs text-muted-foreground block mt-0.5">
                {event.isPaid ? `${formatCurrencyIDR(event.price)} / tiket` : "Tiket gratis"}{" "}
                (maks. {effectiveMaxTickets} tiket)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setForm((prev) => ({ ...prev, ticketCount: Math.max(1, prev.ticketCount - 1) }))}
                disabled={form.ticketCount <= 1}
                aria-label="Kurangi tiket"
              >
                -
              </Button>
              <span className="w-8 text-center font-mono font-medium text-xs">
                {form.ticketCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setForm((prev) => ({ ...prev, ticketCount: Math.min(effectiveMaxTickets, prev.ticketCount + 1) }))}
                disabled={form.ticketCount >= effectiveMaxTickets}
                aria-label="Tambah tiket"
              >
                +
              </Button>
            </div>
          </div>

          {/* Total Price */}
          <div className="pt-2 border-t flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground block">Total biaya tiket</span>
              <span className="font-mono tabular-nums font-medium text-base text-foreground">
                {event.isPaid ? formatCurrencyIDR(totalPrice) : "Gratis"}
              </span>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting
                  ? "Memproses..."
                  : event.isPaid
                  ? "Lanjut ke pembayaran"
                  : "Dapatkan tiket"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
