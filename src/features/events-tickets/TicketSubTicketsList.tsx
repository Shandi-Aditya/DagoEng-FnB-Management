"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Download, Ticket } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { getSubTicketDetails } from "./ticket-pass-domain";

interface TicketSubTicketsListProps {
  ticket: {
    ticketCode: string;
    guestName: string;
    ticketCount: number;
    eventId: string;
    checkedInSeats?: number[];
    checkedInQty?: number;
    checkInStatus?: string;
    selectedSeats?: string[];
  };
  isPaid: boolean;
  selectedTicketIndex: number;
  onSelectTicketIndex: (index: number) => void;
  onDownloadSubTicket: (index: number) => void;
  isDownloading: boolean;
}

export function TicketSubTicketsList({
  ticket,
  isPaid,
  selectedTicketIndex,
  onSelectTicketIndex,
  onDownloadSubTicket,
  isDownloading,
}: TicketSubTicketsListProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (ticket.ticketCount <= 1) return null;

  return (
    <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3 text-xs">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between font-medium text-foreground cursor-pointer"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-1.5">
          <Ticket className="size-4 text-primary" />
          <span>
            Daftar {ticket.ticketCount} tiket rombongan ({ticket.checkedInQty || 0}/{ticket.ticketCount} hadir)
          </span>
        </span>
        {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      {isOpen && (
        <div className="pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: ticket.ticketCount }).map((_, idx) => {
            const ticketIndex = idx + 1;
            const subInfo = getSubTicketDetails(ticket, ticketIndex);
            const isCurrentlySelected = selectedTicketIndex === ticketIndex;

            return (
              <div
                key={subInfo.subTicketCode}
                className={`p-3 rounded-xl border transition-colors space-y-2.5 ${
                  isCurrentlySelected
                    ? "bg-card border-primary shadow-2xs"
                    : "bg-card border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        Tiket #{ticketIndex}
                      </span>
                      {ticket.selectedSeats?.[idx] && (
                        <span className="font-mono text-xs font-semibold text-primary">
                          · Kursi {ticket.selectedSeats[idx]}
                        </span>
                      )}
                      <StatusBadge status={subInfo.isCheckedIn ? "success" : "neutral"}>
                        {subInfo.isCheckedIn ? "Hadir" : "Belum hadir"}
                      </StatusBadge>
                    </div>

                    <div className="font-mono text-xs font-semibold text-foreground truncate">
                      {subInfo.subTicketCode}
                    </div>

                    <span className="text-xs text-muted-foreground block truncate">
                      {subInfo.guestLabel}
                    </span>
                  </div>

                  {/* Mini QR code */}
                  {isPaid && (
                    <div
                      id={`sub-qr-svg-${ticketIndex}`}
                      className="p-1 bg-white rounded border border-border shrink-0 shadow-2xs"
                      title={`QR Tiket #${ticketIndex}`}
                    >
                      <QRCodeSVG
                        value={subInfo.subPayload}
                        size={56}
                        level="M"
                      />
                    </div>
                  )}
                </div>

                {/* Sub-ticket actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    size="sm"
                    variant={isCurrentlySelected ? "default" : "outline"}
                    onClick={() => onSelectTicketIndex(ticketIndex)}
                    className="flex-1 text-xs"
                  >
                    <span>{isCurrentlySelected ? "Sedang tampil" : "Tampilkan QR"}</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onDownloadSubTicket(ticketIndex)}
                    disabled={isDownloading}
                    className="text-xs"
                    title="Unduh e-tiket PNG untuk tiket ini"
                  >
                    <Download className="size-3" />
                    <span>Unduh</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
