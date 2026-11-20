"use client";

import React from "react";
import { QrCode, Check, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import type { EventTicketOrder } from "@/types/event";
import {
  getCheckInStatusTone,
  getPaymentStatusTone,
  formatPaymentStatusLabel,
  formatCheckInTime,
} from "./events-checkin-domain";

interface CheckInAttendeeCardProps {
  ticket: EventTicketOrder;
  isProcessing: boolean;
  onCheckIn: (ticket: EventTicketOrder) => void;
  onReset: (ticket: EventTicketOrder) => void;
  onViewQR: (ticket: EventTicketOrder) => void;
}

export function CheckInAttendeeCard({
  ticket,
  isProcessing,
  onCheckIn,
  onReset,
  onViewQR,
}: CheckInAttendeeCardProps) {
  const ticketCount = ticket.ticketCount || 1;
  const checkedQty =
    typeof ticket.checkedInQty === "number"
      ? ticket.checkedInQty
      : ticket.checkInStatus === "CHECKED_IN"
      ? ticketCount
      : 0;

  const isFullyCheckedIn = ticket.checkInStatus === "CHECKED_IN" || checkedQty >= ticketCount;
  const isPartiallyCheckedIn = !isFullyCheckedIn && checkedQty > 0;
  const isPaid =
    ticket.paymentStatus === "PAID" &&
    ticket.refundStatus !== "REQUESTED" &&
    ticket.refundStatus !== "APPROVED";

  const checkInStatus = getCheckInStatusTone(ticket);
  const paymentTone = getPaymentStatusTone(ticket.paymentStatus);
  const paymentLabel = formatPaymentStatusLabel(ticket.paymentStatus);

  return (
    <Card className="p-3.5 space-y-3">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono font-semibold text-xs text-foreground truncate">
            {ticket.ticketCode}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onViewQR(ticket)}
            title="Lihat QR Code tiket"
            aria-label="Lihat QR Code tiket"
          >
            <QrCode />
          </Button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge status={paymentTone}>{paymentLabel}</StatusBadge>
          <StatusBadge status={checkInStatus.tone}>{checkInStatus.label}</StatusBadge>
        </div>
      </div>

      {/* Guest Details */}
      <div className="space-y-1">
        <p className="font-semibold text-sm text-foreground leading-tight">
          {ticket.guestName}
        </p>
        {ticket.institution && (
          <p className="text-xs text-muted-foreground">{ticket.institution}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {ticket.isInvitation && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              Tiket undangan
            </span>
          )}
          {ticket.ticketTierName && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
              {ticket.ticketTierName}
            </span>
          )}
          {ticket.promoCode && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border">
              Promo: {ticket.promoCode}
            </span>
          )}
        </div>
        {ticket.isInvitation && ticket.invitationNote && (
          <p className="text-xs text-muted-foreground italic">
            Keterangan: {ticket.invitationNote}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground pt-0.5">
          <span className="truncate">{ticket.guestEmail}</span>
          <span>•</span>
          <span className="font-mono">{ticket.guestPhone}</span>
          {ticket.checkInTime && (
            <>
              <span>•</span>
              <span>{formatCheckInTime(ticket.checkInTime)}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        {!isFullyCheckedIn ? (
          <>
            <Button
              type="button"
              size="lg"
              variant="default"
              disabled={!isPaid || isProcessing}
              onClick={() => onCheckIn(ticket)}
              className="flex-1"
            >
              {isProcessing ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Check />
              )}
              <span>
                {isProcessing
                  ? "Menyimpan..."
                  : ticketCount > 1
                  ? "Check-in rombongan"
                  : "Check-in"}
              </span>
            </Button>

            {isPartiallyCheckedIn && (
              <Button
                type="button"
                size="lg"
                variant="outline"
                disabled={isProcessing}
                onClick={() => onReset(ticket)}
                title="Reset kehadiran"
                aria-label="Reset kehadiran"
              >
                <RotateCcw />
              </Button>
            )}
          </>
        ) : (
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={isProcessing}
            onClick={() => onReset(ticket)}
            className="w-full"
          >
            <RotateCcw />
            <span>Reset kehadiran</span>
          </Button>
        )}
      </div>
    </Card>
  );
}
