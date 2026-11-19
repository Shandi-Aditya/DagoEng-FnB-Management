"use client";

import React from "react";
import { Check, Clock, Lock, AlertCircle, Ticket } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/app/status-badge";
import type { SubTicketInfo } from "./ticket-pass-domain";

interface TicketQRSectionProps {
  paymentStatus: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED" | "REFUNDED" | string;
  isMultiTicket: boolean;
  ticketCount: number;
  selectedTicketIndex: number;
  onSelectTicketIndex: (index: number) => void;
  activeSubInfo: SubTicketInfo;
  isSeatCheckedIn: (seatNum: number) => boolean;
  timeLeft: { minutes: number; seconds: number; isExpired: boolean } | null;
  createdAtIso?: string;
  checkedInQty?: number;
}

export function TicketQRSection({
  paymentStatus,
  isMultiTicket,
  ticketCount,
  selectedTicketIndex,
  onSelectTicketIndex,
  activeSubInfo,
  isSeatCheckedIn,
  timeLeft,
  createdAtIso,
  checkedInQty = 0,
}: TicketQRSectionProps) {
  const isPaid = paymentStatus === "PAID";
  const isPending = paymentStatus === "PENDING";

  return (
    <div className="space-y-4">
      {/* Multi-Ticket Selector Tabs */}
      {isPaid && isMultiTicket && (
        <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Ticket className="size-3.5 text-primary" />
              <span>
                Pilih tiket ({selectedTicketIndex} dari {ticketCount}):
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              Kehadiran: <strong className="text-foreground">{checkedInQty}/{ticketCount}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {Array.from({ length: ticketCount }).map((_, idx) => {
              const seatNum = idx + 1;
              const isSelected = selectedTicketIndex === seatNum;
              const isDone = isSeatCheckedIn(seatNum);

              return (
                <button
                  key={seatNum}
                  type="button"
                  onClick={() => onSelectTicketIndex(seatNum)}
                  className={`flex-1 min-w-[100px] py-2 px-2.5 rounded-lg text-xs font-medium transition-colors text-center border cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Tiket #{seatNum}</span>
                    {isDone && <Check className="size-3 text-success shrink-0" />}
                  </div>
                  <span
                    className={`text-xs block truncate ${
                      isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}
                  >
                    {seatNum === 1 ? "Pemesan" : `Tamu #${seatNum}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main QR Presentation Box */}
      {isPaid ? (
        activeSubInfo.isCheckedIn ? (
          <div className="p-6 bg-muted/30 rounded-2xl border border-border flex flex-col items-center justify-center text-center space-y-3">
            <div className="size-12 rounded-full bg-success text-success-foreground flex items-center justify-center shadow-xs">
              <Check className="size-6 stroke-[2.5]" />
            </div>
            <StatusBadge status="success">
              {isMultiTicket
                ? `Tiket #${selectedTicketIndex} selesai check-in`
                : "Selesai check-in (sudah hadir)"}
            </StatusBadge>
            <p className="text-xs text-muted-foreground max-w-sm">
              {isMultiTicket
                ? `Tiket #${selectedTicketIndex} (${activeSubInfo.subTicketCode}) milik ${activeSubInfo.guestLabel} telah diverifikasi masuk di lokasi acara.`
                : "Seluruh tiket dalam pemesanan ini telah diverifikasi hadir oleh petugas di lokasi acara."}
            </p>
          </div>
        ) : (
          <div id="ticket-qr-container" className="p-6 bg-muted/20 rounded-2xl border border-border flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-3 bg-white rounded-xl shadow-xs border border-border flex items-center justify-center">
              <QRCodeSVG
                value={activeSubInfo.subPayload}
                size={180}
                level="M"
                includeMargin
              />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-foreground block">
                {isMultiTicket
                  ? `QR check-in tiket #${selectedTicketIndex} (${activeSubInfo.guestLabel})`
                  : "QR check-in aktif"}
              </span>
              <div className="font-mono font-semibold text-sm text-foreground">
                {activeSubInfo.subTicketCode}
              </div>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Tunjukkan QR code ini kepada petugas saat registrasi ulang di pintu masuk venue.
              </p>
            </div>
          </div>
        )
      ) : isPending ? (
        <div className="space-y-3">
          {/* Lock Notice */}
          <div className="p-4 bg-muted/40 rounded-xl border border-border flex items-start gap-3 text-left">
            <div className="p-2 bg-muted rounded-lg text-foreground shrink-0 mt-0.5">
              <Lock className="size-4" />
            </div>
            <div className="space-y-1">
              <h4 className="font-medium text-xs text-foreground">
                QR check-in menunggu pembayaran
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Selesaikan pembayaran transfer bank dan unggah bukti transfer agar e-tiket dan QR code Anda segera aktif.
              </p>
            </div>
          </div>

          {/* 60-Minute Payment Deadline Countdown */}
          {timeLeft && (
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                timeLeft.isExpired
                  ? "bg-destructive/10 border-destructive/20 text-destructive"
                  : "bg-muted/40 border-border text-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock
                  className={`size-4 shrink-0 ${
                    timeLeft.isExpired ? "text-destructive" : "text-primary animate-pulse"
                  }`}
                />
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground font-medium block">
                    Batas waktu pembayaran (60 menit)
                  </span>
                  <span className="text-xs font-medium">
                    {timeLeft.isExpired
                      ? "Tenggat waktu transfer 60 menit telah berakhir."
                      : "Selesaikan transfer sebelum batas waktu berakhir."}
                  </span>
                </div>
              </div>

              {!timeLeft.isExpired && (
                <div className="font-mono font-semibold text-base sm:text-lg text-foreground bg-card px-2.5 py-1 rounded-lg border border-border shadow-2xs shrink-0 tabular-nums">
                  {String(timeLeft.minutes).padStart(2, "0")}:{String(timeLeft.seconds).padStart(2, "0")}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 bg-destructive/10 rounded-2xl border border-destructive/20 text-center space-y-1.5">
          <AlertCircle className="size-8 text-destructive mx-auto" />
          <h4 className="font-medium text-sm text-destructive">Tiket dibatalkan</h4>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Pemesanan tiket ini telah dibatalkan atau kedaluwarsa, sehingga hak hadir tidak berlaku.
          </p>
        </div>
      )}
    </div>
  );
}
