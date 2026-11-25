"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import type { EventTicketOrder } from "@/types/event";
import { getCheckInStatusTone } from "./events-checkin-domain";
import { formatSeatsList } from "@/lib/event-seating";

interface EventCheckInQRDialogProps {
  booking: EventTicketOrder | null;
  onClose: () => void;
  onSimulateCheckIn: (booking: EventTicketOrder) => void;
}

export function EventCheckInQRDialog({
  booking,
  onClose,
  onSimulateCheckIn,
}: EventCheckInQRDialogProps) {
  if (!booking) return null;

  const ticketCount = booking.ticketCount || 1;
  const isFullyCheckedIn =
    booking.checkInStatus === "CHECKED_IN" ||
    (typeof booking.checkedInQty === "number" && booking.checkedInQty >= ticketCount);
  const statusInfo = getCheckInStatusTone(booking);

  return (
    <Dialog open={Boolean(booking)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <DialogTitle>QR code e-tiket peserta</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {booking.ticketCode}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {/* QR Code Presentation Box */}
          <div className="bg-white p-4 rounded-xl border border-border flex items-center justify-center mx-auto w-fit shadow-xs">
            <QRCodeSVG
              value={booking.ticketCode}
              size={180}
              level="M"
              includeMargin={true}
            />
          </div>

          {/* Attendee Summary Details */}
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Nama peserta:</span>
              <span className="font-medium text-foreground">{booking.guestName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Jumlah tiket:</span>
              <span className="font-medium text-foreground">{ticketCount} tiket</span>
            </div>
            {booking.selectedSeats && booking.selectedSeats.length > 0 && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Nomor kursi:</span>
                <span className="font-mono font-medium text-primary text-right">
                  {formatSeatsList(booking.selectedSeats)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status kehadiran:</span>
              <StatusBadge status={statusInfo.tone}>{statusInfo.label}</StatusBadge>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 px-6 border-t shrink-0 flex-col sm:flex-row gap-2">
          <Button
            type="button"
            size="lg"
            variant="default"
            disabled={isFullyCheckedIn}
            onClick={() => onSimulateCheckIn(booking)}
            className="w-full sm:flex-1"
          >
            <CheckCircle2 />
            <span>
              {isFullyCheckedIn
                ? "Tiket sudah dipakai"
                : ticketCount > 1
                ? "Check-in rombongan ini"
                : "Simulasikan scan tiket"}
            </span>
          </Button>
          <Button
            type="button"
            size="default"
            variant="outline"
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
