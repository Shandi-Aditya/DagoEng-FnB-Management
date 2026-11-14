"use client";

import React from "react";
import { Check, CheckCircle2, RotateCcw, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { EventTicketOrder } from "@/types/event";

interface EventGroupCheckInDialogProps {
  booking: EventTicketOrder | null;
  onClose: () => void;
  isProcessing: boolean;
  onCheckInPartial: (booking: EventTicketOrder) => void;
  onCheckInAll: (booking: EventTicketOrder) => void;
  onReset: (booking: EventTicketOrder) => void;
}

export function EventGroupCheckInDialog({
  booking,
  onClose,
  isProcessing,
  onCheckInPartial,
  onCheckInAll,
  onReset,
}: EventGroupCheckInDialogProps) {
  if (!booking) return null;

  const count = booking.ticketCount || 1;
  const checked =
    typeof booking.checkedInQty === "number"
      ? booking.checkedInQty
      : booking.checkInStatus === "CHECKED_IN"
      ? count
      : 0;
  const remaining = Math.max(0, count - checked);
  const percentage = Math.min(100, Math.round((checked / count) * 100));

  return (
    <Dialog open={Boolean(booking)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Check-In Tiket Rombongan</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {booking.ticketCode} &bull; {booking.guestName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Attendance Progress Box */}
          <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total tiket:</span>
              <span className="font-medium text-foreground">{count} tiket</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Kehadiran:</span>
              <span className="font-medium text-foreground">
                {checked} hadir &bull; {remaining} belum hadir
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-[width] duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-xs text-muted-foreground font-medium text-center">
              Pilih opsi pencatatan:
            </p>

            {/* Option 1: Partial (+1 Pax) */}
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={remaining <= 0 || isProcessing}
              onClick={() => onCheckInPartial(booking)}
              className="w-full flex-col h-auto py-2.5 items-center justify-center text-center"
            >
              <span className="font-medium text-xs flex items-center gap-1.5">
                {isProcessing ? <Loader2 className="animate-spin" /> : <Check />}
                <span>Masuk 1 orang (+1 tiket)</span>
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                Anggota rombongan lain datang menyusul
              </span>
            </Button>

            {/* Option 2: All remaining */}
            <Button
              type="button"
              size="lg"
              variant="default"
              disabled={remaining <= 0 || isProcessing}
              onClick={() => onCheckInAll(booking)}
              className="w-full flex-col h-auto py-2.5 items-center justify-center text-center"
            >
              <span className="font-medium text-xs flex items-center gap-1.5">
                {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                <span>Hadir semua sekaligus ({remaining} tiket)</span>
              </span>
              <span className="text-xs text-primary-foreground/80 font-normal">
                Seluruh anggota rombongan telah tiba lengkap
              </span>
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {checked > 0 && (
            <Button
              type="button"
              size="default"
              variant="outline"
              disabled={isProcessing}
              onClick={() => onReset(booking)}
              className="text-destructive hover:text-destructive w-full sm:w-auto"
            >
              <RotateCcw />
              <span>Reset kehadiran (0/{count})</span>
            </Button>
          )}

          <Button
            type="button"
            size="default"
            variant="ghost"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            <span>Tutup</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
