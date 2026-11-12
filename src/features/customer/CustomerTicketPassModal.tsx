"use client";

import { useRef, useState } from "react";
import { Calendar, CheckCircle2, Download, MapPin, QrCode, Ticket, User, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadTicketAsImage } from "@/lib/ticket-download";
import { formatCurrencyIDR } from "@/lib/utils";
import type { EventTicketOrder } from "@/types/event";

export interface CustomerTicketPassModalProps {
  ticket: EventTicketOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerTicketPassModal({
  ticket,
  open,
  onOpenChange,
}: CustomerTicketPassModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  if (!ticket) return null;

  const isPaid = ticket.paymentStatus === "PAID";
  const formattedDate = new Date(ticket.eventDate).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleDownload = async () => {
    if (!ticket) return;
    try {
      setIsDownloading(true);
      await downloadTicketAsImage({
        ticketCode: ticket.ticketCode,
        eventTitle: ticket.eventTitle,
        guestName: ticket.guestName,
        guestEmail: ticket.guestEmail,
        ticketCount: ticket.ticketCount || 1,
        totalPrice: ticket.totalPrice,
        paymentStatus: ticket.paymentStatus,
        eventLocation: ticket.eventLocation,
        eventDate: ticket.eventDate,
      });
    } catch (err) {
      console.error("Gagal mengunduh gambar tiket", err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-medium">Tiket digital masuk</DialogTitle>
            <Badge variant={isPaid ? "default" : "secondary"}>
              {isPaid ? "Lunas (Siap dipakai)" : "Menunggu verifikasi"}
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            Tunjukkan kode QR ini kepada petugas pintu masuk saat tiba di lokasi.
          </DialogDescription>
        </DialogHeader>

        {/* E-Ticket Card Layout */}
        <div
          id="customer-ticket-card-element"
          ref={ticketRef}
          className="flex flex-col rounded-xl border bg-card overflow-hidden shadow-xs text-xs"
        >
          {/* Header Tiket */}
          <div className="p-4 bg-muted/30 border-b flex flex-col gap-1">
            <span className="font-mono text-xs font-medium text-foreground">
              {ticket.ticketCode}
            </span>
            <h3 className="text-base font-medium text-foreground leading-snug">
              {ticket.eventTitle}
            </h3>
            <p className="text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Calendar className="size-3.5" />
              <span>{formattedDate}</span>
            </p>
            <p className="text-muted-foreground flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              <span>{ticket.eventLocation}</span>
            </p>
          </div>

          {/* Area QR Code */}
          <div className="flex flex-col items-center justify-center p-6 bg-white gap-2">
            {isPaid ? (
              <>
                <QRCodeSVG
                  value={ticket.guestToken || ticket.ticketCode}
                  size={160}
                  level="H"
                  includeMargin
                />
                <span className="font-mono text-xs font-semibold text-foreground">
                  {ticket.ticketCode}
                </span>
                <span className="text-xs text-muted-foreground text-center">
                  1 QR berlaku untuk {ticket.ticketCount || 1} orang peserta
                </span>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-4 text-center text-muted-foreground gap-2">
                <Ticket className="size-12 opacity-40" />
                <p className="font-medium text-foreground">Menunggu konfirmasi pembayaran</p>
                <p className="text-xs">QR code akan aktif segera setelah transfer diverifikasi kasir/admin.</p>
              </div>
            )}
          </div>

          {/* Footer Detail Peserta */}
          <div className="p-4 bg-muted/20 border-t space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nama pemesan</span>
              <span className="font-medium text-foreground">{ticket.guestName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="text-foreground">{ticket.guestEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total pembayaran</span>
              <span className="font-mono font-medium text-foreground tabular-nums">
                {formatCurrencyIDR(ticket.totalPrice)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          {isPaid ? (
            <Button type="button" onClick={handleDownload} disabled={isDownloading}>
              <Download />
              <span>{isDownloading ? "Mengunduh…" : "Simpan gambar tiket"}</span>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
