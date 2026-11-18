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

  const hasTiers = Boolean(event.ticketTiers && event.ticketTiers.length > 0);
  const tiers = event.ticketTiers || [];
  const tierAvailabilities = event.availability?.tiers || event.tierAvailability || [];

  const minTierPrice = hasTiers
    ? Math.min(...tiers.map((t) => Number(t.price || 0)))
    : event.price;
  const maxTierPrice = hasTiers
    ? Math.max(...tiers.map((t) => Number(t.price || 0)))
    : event.price;

  const displayPrice = hasTiers
    ? minTierPrice === 0 && maxTierPrice === 0
      ? "Gratis"
      : minTierPrice === maxTierPrice
      ? formatCurrencyIDR(minTierPrice)
      : `Mulai dari ${formatCurrencyIDR(minTierPrice)}`
    : event.isPaid
    ? formatCurrencyIDR(event.price)
    : "Gratis";

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
              {displayPrice}
            </span>
            {(event.isPaid || (hasTiers && maxTierPrice > 0)) && (
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
                className={`h-full rounded-full transition-[width] ${
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

        {/* Tier Breakdown */}
        {hasTiers && (
          <div className="rounded-lg border bg-muted/10 p-3 space-y-2 text-xs">
            <span className="font-medium text-foreground block text-xs">
              Pilihan jenis tiket
            </span>
            <div className="space-y-1.5">
              {tiers.map((t) => {
                const avail = tierAvailabilities.find((a) => a.tierId === t.id);
                const isSoldOutTier = avail?.isSoldOut;
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-medium text-foreground block truncate">
                        {t.name}
                      </span>
                      <span className="text-xs text-muted-foreground block">
                        {isSoldOutTier
                          ? "Habis terjual"
                          : avail
                          ? `Sisa ${avail.remaining} tiket`
                          : `Kuota ${t.quota}`}
                      </span>
                    </div>
                    <span className="font-mono font-medium text-foreground text-xs shrink-0">
                      {t.price > 0 ? formatCurrencyIDR(t.price) : "Gratis"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div>
          {isPast ? (
            <Button disabled variant="outline" size="lg" className="w-full">
              Event telah selesai
            </Button>
          ) : isSoldOut ? (
            <Button disabled variant="outline" size="lg" className="w-full text-destructive">
              Tiket habis terjual
            </Button>
          ) : (
            <Button
              variant="default"
              size="lg"
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
          <div className="pt-2 border-t text-xs space-y-1">
            <span className="font-medium text-foreground block">Ketentuan Refund:</span>
            {event.refundPolicy?.policyType === "REFUNDABLE_UNTIL_H_MINUS" ? (
              <span className="text-muted-foreground block leading-relaxed">
                Dapat dibatalkan hingga H-{event.refundPolicy.hMinusDays ?? 0} sebelum event dimulai
                {Boolean(event.refundPolicy.refundFeePercent) && ` (potongan biaya ${event.refundPolicy.refundFeePercent}%)`}.
              </span>
            ) : (
              <span className="text-muted-foreground block leading-relaxed">
                Event ini memberlakukan kebijakan tidak dapat dibatalkan atau di-refund (No Refund).
              </span>
            )}
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
          size="lg"
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
