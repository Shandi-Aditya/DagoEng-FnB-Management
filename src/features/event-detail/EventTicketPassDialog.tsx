"use client";

import React, { useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Download, ExternalLink, Lock, QrCode } from "lucide-react";
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
import { formatCurrencyIDR } from "@/lib/utils";
import { downloadTicketAsImage } from "@/lib/ticket-download";
import type { EventTicketOrder } from "@/types/event";

interface EventTicketPassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: EventTicketOrder | null;
  onDone: () => void;
}

export function EventTicketPassDialog({
  open,
  onOpenChange,
  ticket,
  onDone,
}: EventTicketPassDialogProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!ticket) return null;

  const isPaid = ticket.paymentStatus === "PAID";

  const handleCopyCode = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(ticket.ticketCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const qrElement = document.querySelector("#event-detail-ticket-qr svg") as SVGElement | null;
      await downloadTicketAsImage(
        {
          ticketCode: ticket.ticketCode,
          eventTitle: ticket.eventTitle,
          guestName: ticket.guestName,
          guestEmail: ticket.guestEmail,
          ticketCount: ticket.ticketCount,
          totalPrice: ticket.totalPrice,
          paymentMethod: ticket.paymentMethod,
          paymentStatus: ticket.paymentStatus,
          eventLocation: ticket.eventLocation,
        },
        qrElement
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-unit="event" className="max-w-md max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base font-medium">
              E-Tiket Acara Komunitas
            </DialogTitle>
            <Badge
              variant={
                ticket.paymentStatus === "REFUNDED"
                  ? "destructive"
                  : ticket.refundStatus === "REQUESTED"
                  ? "secondary"
                  : ticket.isInvitation || ticket.paymentMethod === "INVITATION"
                  ? "outline"
                  : isPaid
                  ? "default"
                  : "secondary"
              }
              className="text-xs"
            >
              {ticket.paymentStatus === "REFUNDED"
                ? "Di-refund"
                : ticket.refundStatus === "REQUESTED"
                ? "Pengajuan Refund"
                : ticket.isInvitation || ticket.paymentMethod === "INVITATION"
                ? "Tiket Undangan"
                : isPaid
                ? "Lunas"
                : (ticket.paymentProofUrl ? "Menunggu verifikasi" : "Menunggu bayar")}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground truncate">
            {ticket.eventTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          {/* Booking Code */}
          <div className="rounded-lg border bg-muted/20 p-4 text-center space-y-1">
            <span className="text-xs text-muted-foreground block">Kode booking tiket</span>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-2xl font-medium text-foreground">
                {ticket.ticketCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-1"
                title="Salin kode tiket"
              >
                {copiedCode ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
              </button>
            </div>
          </div>

          {/* Ticket Information */}
          <div className="rounded-lg border p-3.5 space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground block text-xs">Nama pemesan</span>
                <span className="font-medium text-foreground block text-xs truncate">
                  {ticket.guestName}
                </span>
                <span className="text-muted-foreground block text-xs truncate">
                  {ticket.guestEmail}
                </span>
                {ticket.ticketTierName && (
                  <Badge variant="outline" className="mt-1 text-xs font-medium">
                    {ticket.ticketTierName}
                  </Badge>
                )}
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Jumlah & biaya</span>
                <span className="font-mono font-medium text-foreground block text-xs">
                  {ticket.ticketCount} tiket &bull;{" "}
                  {ticket.isInvitation || ticket.paymentMethod === "INVITATION"
                    ? "Undangan"
                    : ticket.totalPrice > 0
                    ? formatCurrencyIDR(ticket.totalPrice)
                    : "Gratis"}
                </span>
                <span className="text-muted-foreground block text-xs capitalize">
                  {ticket.isInvitation ? "Undangan resmi" : ticket.paymentMethod?.toLowerCase() || "—"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t">
              <span className="text-muted-foreground block text-xs">Lokasi venue</span>
              <span className="text-foreground block text-xs">
                {ticket.eventLocation || "Dago Creative Hub"}
              </span>
            </div>
          </div>

          {/* Refund Notice */}
          {ticket.refundStatus === "REQUESTED" && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning space-y-0.5">
              <span className="font-medium block">Pengajuan Refund Sedang Diproses</span>
              <p className="text-muted-foreground leading-relaxed">
                Pengembalian dana sebesar {formatCurrencyIDR(ticket.refundRequest?.refundAmount || ticket.totalPrice)} sedang menunggu proses oleh admin.
              </p>
            </div>
          )}

          {ticket.paymentStatus === "REFUNDED" && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive space-y-0.5">
              <span className="font-medium block">Tiket Telah Di-refund</span>
              <p className="text-muted-foreground leading-relaxed">
                Tiket ini telah dibatalkan dan dananya telah disetujui untuk dikembalikan. Tiket tidak dapat digunakan untuk check-in.
              </p>
            </div>
          )}

          {/* QR Code Container */}
          {isPaid && ticket.paymentStatus !== "REFUNDED" ? (
            <div
              id="event-detail-ticket-qr"
              className="rounded-lg border bg-muted/30 p-4 flex flex-col items-center justify-center gap-3 text-center"
            >
              <div className="p-3 bg-white rounded-lg border shadow-xs">
                <QRCodeSVG
                  value={JSON.stringify({
                    ticketCode: ticket.ticketCount > 1 ? `${ticket.ticketCode}-01` : ticket.ticketCode,
                    eventId: ticket.eventId,
                  })}
                  size={150}
                  level="M"
                  includeMargin
                />
              </div>

              <div className="space-y-1 text-xs">
                <span className="font-medium text-foreground block">
                  QR code check-in aktif
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  Tunjukkan QR code ini kepada panitia saat registrasi ulang di pintu masuk venue.
                </p>
                {ticket.ticketCount > 1 && (
                  <p className="text-muted-foreground text-xs pt-1">
                    Pesanan ini mencakup {ticket.ticketCount} tiket. Buka tautan lengkap di bawah untuk melihat tiket lainnya.
                  </p>
                )}
              </div>
            </div>
          ) : ticket.paymentStatus === "REFUNDED" ? (
            <div className="rounded-lg border bg-muted/40 p-4 text-center space-y-1 text-xs">
              <span className="font-semibold text-foreground block">Dana tiket telah dikembalikan</span>
              <p className="text-muted-foreground leading-relaxed">
                Pemesanan tiket ini telah di-refund dan tidak berlaku untuk check-in di lokasi acara.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3.5 flex items-start gap-3 text-warning">
              <div className="size-10 rounded-lg bg-warning/20 flex items-center justify-center shrink-0">
                <QrCode className="size-5 text-warning" />
              </div>
              <div className="space-y-0.5 text-xs">
                <span className="font-medium text-warning block">
                  QR check-in belum aktif
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  Tiket menunggu verifikasi pembayaran. Setelah pembayaran diverifikasi lunas oleh tim Dago, QR check-in akan otomatis aktif.
                </p>
              </div>
            </div>
          )}

          {/* Full ticket page link */}
          {ticket.guestToken && (
            <Button
              variant="outline"
              size="lg"
              render={<Link href={`/events/tickets/${ticket.guestToken}`} />}
              nativeButton={false}
              className="w-full"
            >
              <ExternalLink />
              <span>Buka halaman lengkap tiket</span>
            </Button>
          )}
        </div>

        <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
          {isPaid && (
            <Button
              variant="outline"
              size="lg"
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex-1"
            >
              <Download />
              <span>{isDownloading ? "Mengunduh..." : "Unduh tiket"}</span>
            </Button>
          )}

          <Button
            size="lg"
            onClick={onDone}
            className="flex-1"
          >
            Selesai
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
