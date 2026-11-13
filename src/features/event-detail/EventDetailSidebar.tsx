"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2, Search, Ticket } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/app/status-badge";
import { formatCurrencyIDR } from "@/lib/utils";
import type { PublicCommunityEvent } from "@/types/event";
import { getQuotaBadgeTone } from "./event-detail-domain";

interface EventDetailSidebarProps {
  event: PublicCommunityEvent;
  isPast?: boolean;
  onOpenBooking: () => void;
}

export function EventDetailSidebar({
  event,
  isPast,
  onOpenBooking,
}: EventDetailSidebarProps) {
  const isSoldOut = Boolean(event.availability?.isSoldOut);
  const occupancyRate = event.availability?.occupancyRate ?? 0;
  const quotaStatus = getQuotaBadgeTone(occupancyRate, isSoldOut);

  return (
    <div className="space-y-4">
      {/* 1. Main Sticky Ticket Card */}
      <Card className="rounded-xl border bg-card p-5 sm:p-6 space-y-4">
        <div className="pb-3 border-b space-y-1">
          <span className="text-xs text-muted-foreground block">
            Tiket masuk
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl sm:text-3xl font-medium text-foreground">
              {event.isPaid ? formatCurrencyIDR(event.price) : "Gratis"}
            </span>
            {event.isPaid && (
              <span className="text-xs text-muted-foreground">/ orang</span>
            )}
          </div>
        </div>

        {/* Quota Progress */}
        {event.availability && (
          <div className="rounded-lg border bg-muted/20 p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Ticket className="size-3.5 text-primary" />
                <span>Ketersediaan kuota</span>
              </span>
              <StatusBadge status={quotaStatus.tone}>
                {quotaStatus.label}
              </StatusBadge>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                <strong className="font-mono text-foreground font-medium">
                  {event.availability.ticketsReserved}
                </strong>{" "}
                dari{" "}
                <strong className="font-mono text-foreground font-medium">
                  {event.availability.totalCapacity}
                </strong>{" "}
                tiket terisi
              </span>
              <span className="font-mono font-medium text-foreground">
                {occupancyRate}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isSoldOut
                    ? "bg-destructive"
                    : occupancyRate >= 80
                    ? "bg-warning"
                    : "bg-primary"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, occupancyRate))}%` }}
              />
            </div>

            <span className="text-xs text-muted-foreground block pt-0.5">
              {isSoldOut ? (
                <span className="text-destructive font-medium">Semua tiket telah dipesan</span>
              ) : (
                <span>
                  <strong className="font-mono text-foreground font-medium">{event.availability.ticketsRemaining}</strong> tiket tersisa
                </span>
              )}
            </span>
          </div>
        )}

        {/* Action Button */}
        <div>
          {isPast ? (
            <Button disabled variant="outline" className="w-full">
              Event telah selesai
            </Button>
          ) : isSoldOut ? (
            <Button disabled variant="outline" className="w-full text-destructive">
              Tiket habis terjual
            </Button>
          ) : (
            <Button
              variant="default"
              onClick={onOpenBooking}
              className="w-full"
            >
              <Ticket />
              <span>{event.isPaid ? "Pesan tiket sekarang" : "Daftar gratis"}</span>
            </Button>
          )}
        </div>

        {/* Trust Signals */}
        <div className="pt-2 text-xs text-muted-foreground space-y-1.5 border-t">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="size-3.5 text-success shrink-0 mt-0.5" />
            <span>
              {event.isPaid
                ? "Pembayaran transfer diverifikasi manual oleh tim Dago sebelum QR check-in aktif"
                : "Konfirmasi instan & penerbitan e-tiket otomatis"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 text-success shrink-0" />
            <span>QR code check-in resmi Dago Creative Hub</span>
          </div>
          <div className="pt-2 border-t text-center">
            <Link
              href="/events/tickets/recovery"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              <Search className="size-3" />
              <span>Sudah pesan tiket? Lupa kode booking? Cek di sini &rarr;</span>
            </Link>
          </div>
        </div>
      </Card>

      {/* 2. Host Community Event Card */}
      <Card className="rounded-xl border bg-muted/20 p-4 text-center space-y-2 text-xs">
        <span className="font-medium text-foreground block">
          Ingin mengadakan event komunitas?
        </span>
        <p className="text-muted-foreground leading-relaxed">
          Gunakan fasilitas amphitheater, meeting room, dan lab Dago Hub untuk kegiatan komunitas Anda.
        </p>
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/events/portal" />}
          nativeButton={false}
          className="w-full"
        >
          Portal mitra
        </Button>
      </Card>
    </div>
  );
}
