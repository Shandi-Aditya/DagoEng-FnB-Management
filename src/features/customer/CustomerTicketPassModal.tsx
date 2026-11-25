"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, CheckCircle2, Clock, Download, MapPin, Ticket } from "lucide-react";
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
import { StatusBadge } from "@/components/app/status-badge";
import {
  formatCheckInTime,
  getBookingAttendance,
} from "@/features/events-checkin/events-checkin-domain";
import { getSubTicketDetails } from "@/features/events-tickets/ticket-pass-domain";
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
  const [selectedSeatIdx, setSelectedSeatIdx] = useState(1);
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSelectedSeatIdx(1);
    }
  }, [ticket?.id, open]);

  if (!ticket) return null;

  const isPaid = ticket.paymentStatus === "PAID";
  const attendance = getBookingAttendance(ticket);
  const totalCount = attendance.ticketCount;

  const subTickets = Array.from({ length: totalCount }, (_, i) => {
    const seatIdx = i + 1;
    const info = getSubTicketDetails(ticket, seatIdx);
    const seatLabel = ticket.selectedSeats?.[i];
    const timeIso =
      ticket.seatCheckInTimes?.[String(seatIdx)] ||
      (info.isCheckedIn ? ticket.checkInTime : null);
    const officer =
      ticket.seatCheckInBy?.[String(seatIdx)] ||
      (info.isCheckedIn ? ticket.checkedInBy : null);
    const timeFormatted = formatCheckInTime(timeIso);
    return {
      seatIdx,
      ...info,
      seatLabel,
      timeFormatted,
      officer,
    };
  });

  const activeSeatIdx = Math.min(Math.max(1, selectedSeatIdx), totalCount);
  const activeSubTicket = subTickets[activeSeatIdx - 1];
  const overallTimeFormatted = formatCheckInTime(ticket.checkInTime);
  const attendanceTone = attendance.isCheckedIn
    ? "success"
    : attendance.isPartial
    ? "info"
    : "neutral";

  const formattedDate = new Date(ticket.eventDate).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Makassar",
  });

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const qrSvg = qrWrapperRef.current?.querySelector("svg") ?? null;
      await downloadTicketAsImage(
        {
          ticketCode: ticket.ticketCode,
          eventTitle: ticket.eventTitle,
          guestName: ticket.guestName,
          guestEmail: ticket.guestEmail,
          ticketCount: totalCount,
          totalPrice: ticket.totalPrice,
          paymentMethod: ticket.paymentMethod,
          paymentStatus: ticket.paymentStatus,
          eventLocation: ticket.eventLocation,
          eventDate: ticket.eventDate,
          subTicketIndex: totalCount > 1 ? activeSeatIdx : undefined,
          subTicketCode: totalCount > 1 ? activeSubTicket.subTicketCode : undefined,
          subGuestLabel: totalCount > 1 ? activeSubTicket.guestLabel : undefined,
          subCheckedIn: activeSubTicket.isCheckedIn,
        },
        qrSvg
      );
    } catch (err) {
      console.error("Gagal mengunduh gambar tiket", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const displayTime =
    activeSubTicket.timeFormatted !== "—" ? activeSubTicket.timeFormatted : overallTimeFormatted;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 gap-0 max-w-md">
        <DialogHeader className="shrink-0 p-5 pb-3 border-b">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-base font-medium">Tiket digital masuk</DialogTitle>
            <div className="flex items-center gap-1.5">
              {isPaid ? (
                <StatusBadge status={attendanceTone}>{attendance.attendanceLabel}</StatusBadge>
              ) : null}
              <Badge variant={isPaid ? "default" : "secondary"} className="text-xs">
                {isPaid ? "Lunas (Siap dipakai)" : "Menunggu verifikasi"}
              </Badge>
            </div>
          </div>
          <DialogDescription className="text-xs">
            Tunjukkan kode QR ini kepada petugas pintu masuk saat tiba di lokasi.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          <div
            id="customer-ticket-card-element"
            className="flex flex-col rounded-xl border bg-card overflow-hidden shadow-xs text-xs"
          >
            <div className="p-4 bg-muted/30 border-b flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-medium text-foreground">
                  {activeSubTicket.subTicketCode}
                </span>
                {activeSubTicket.seatLabel ? (
                  <Badge variant="outline" className="text-xs font-mono">
                    Kursi {activeSubTicket.seatLabel}
                  </Badge>
                ) : null}
              </div>
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

            {isPaid && totalCount > 1 ? (
              <div className="p-3 bg-muted/20 border-b space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Pilih sub-tiket ({totalCount} tiket)</span>
                  <span className="font-mono tabular-nums">
                    {attendance.checkedInQty}/{totalCount} hadir
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {subTickets.map((sub) => (
                    <Button
                      key={sub.subTicketCode}
                      type="button"
                      size="sm"
                      variant={sub.seatIdx === activeSeatIdx ? "default" : "outline"}
                      onClick={() => setSelectedSeatIdx(sub.seatIdx)}
                      className="font-mono"
                    >
                      {sub.isCheckedIn ? <CheckCircle2 /> : <Clock />}
                      <span>
                        #{sub.seatIdx}
                        {sub.seatLabel ? ` (${sub.seatLabel})` : ""}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            <div
              id="ticket-qr-container"
              ref={qrWrapperRef}
              className="flex flex-col items-center justify-center p-6 bg-card gap-2"
            >
              {isPaid ? (
                <>
                  <div className="rounded-lg bg-white p-2 border border-border">
                    <QRCodeSVG
                      value={activeSubTicket.subPayload}
                      size={160}
                      level="H"
                      includeMargin
                    />
                  </div>
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {activeSubTicket.subTicketCode}
                  </span>
                  {totalCount > 1 ? (
                    <span className="text-xs text-muted-foreground text-center">
                      QR khusus tiket #{activeSeatIdx} dari {totalCount} peserta
                      {activeSubTicket.seatLabel ? ` · Kursi ${activeSubTicket.seatLabel}` : ""}
                    </span>
                  ) : null}
                  {activeSubTicket.isCheckedIn ? (
                    <StatusBadge status="success">
                      {activeSubTicket.timeFormatted !== "—"
                        ? `Hadir · ${activeSubTicket.timeFormatted}`
                        : "Hadir"}
                    </StatusBadge>
                  ) : (
                    <StatusBadge status="neutral">Belum hadir</StatusBadge>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center text-muted-foreground gap-2">
                  <Ticket className="size-12 opacity-40" />
                  <p className="font-medium text-foreground">Menunggu konfirmasi pembayaran</p>
                  <p className="text-xs">
                    QR code akan aktif segera setelah transfer diverifikasi kasir/admin.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-muted/20 border-t space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Nama pemesan</span>
                <span className="font-medium text-foreground text-right">
                  {totalCount > 1 ? activeSubTicket.guestLabel : ticket.guestName}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Status kehadiran</span>
                <span className="font-medium text-foreground text-right">
                  {attendance.attendanceLabel}
                </span>
              </div>
              {(activeSubTicket.isCheckedIn || attendance.checkedInQty > 0) && displayTime !== "—" ? (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Waktu check-in</span>
                  <span className="font-mono text-foreground text-right tabular-nums">
                    {displayTime}
                    {activeSubTicket.officer ? ` · ${activeSubTicket.officer}` : ""}
                  </span>
                </div>
              ) : null}
              {ticket.selectedSeats && ticket.selectedSeats.length > 0 ? (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Nomor kursi</span>
                  <span className="font-mono font-medium text-primary text-right">
                    {ticket.selectedSeats.join(", ")}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Email</span>
                <span className="text-foreground text-right">{ticket.guestEmail}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Total pembayaran</span>
                <span className="font-mono font-medium text-foreground tabular-nums text-right">
                  {formatCurrencyIDR(ticket.totalPrice)}
                </span>
              </div>
            </div>
          </div>

          {isPaid && totalCount > 1 ? (
            <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5 text-xs">
              <p className="font-medium text-foreground">Daftar status seluruh sub-tiket</p>
              <div className="space-y-1">
                {subTickets.map((sub) => (
                  <div
                    key={sub.subTicketCode}
                    className="flex items-center justify-between gap-2 py-1 border-b last:border-b-0 border-border/50"
                  >
                    <span className="font-mono text-foreground">
                      {sub.subTicketCode}
                      {sub.seatLabel ? ` (${sub.seatLabel})` : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {sub.isCheckedIn
                        ? sub.timeFormatted !== "—"
                          ? `Hadir · ${sub.timeFormatted}`
                          : "Hadir"
                        : "Belum hadir"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 p-4 pt-3 border-t gap-2">
          <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          {isPaid ? (
            <Button type="button" size="lg" onClick={handleDownload} disabled={isDownloading}>
              <Download />
              <span>{isDownloading ? "Mengunduh…" : "Simpan gambar tiket"}</span>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
