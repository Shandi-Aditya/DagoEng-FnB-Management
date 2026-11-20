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
import { isEventPaidEffective, formatEventPriceSummary } from "@/features/events-catalog/events-catalog-domain";

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
  const ticketsRemaining = event.availability?.ticketsRemaining ?? 0;
  const occupancyRate = event.availability?.occupancyRate ?? 0;

  const hasTiers = Boolean(event.ticketTiers && event.ticketTiers.length > 0);
  const tiers = event.ticketTiers || [];
  const tierAvailabilities = event.availability?.tiers || event.tierAvailability || [];
  const hasOnSaleTier = hasTiers
    ? tiers.some((t) => {
        const a = tierAvailabilities.find((ta) => ta.tierId === t.id);
        return a ? !a.isSoldOut && a.salesStatus === "ON_SALE" : true;
      })
    : !isSoldOut;

  const allTiersUpcoming =
    hasTiers &&
    tierAvailabilities.length > 0 &&
    tierAvailabilities.every((a) => a.salesStatus === "UPCOMING");

  const allTiersEnded =
    hasTiers &&
    tierAvailabilities.length > 0 &&
    tierAvailabilities.every((a) => a.salesStatus === "ENDED");

  let quotaStatus: { label: string; tone: "success" | "warning" | "destructive" | "info" | "neutral" } =
    getQuotaBadgeTone(occupancyRate, isSoldOut);
  if (!isSoldOut && ticketsRemaining > 0) {
    if (allTiersUpcoming) {
      quotaStatus = { label: "Penjualan belum dibuka", tone: "info" };
    } else if (allTiersEnded) {
      quotaStatus = { label: "Penjualan telah berakhir", tone: "destructive" };
    }
  } else if (isSoldOut) {
    quotaStatus = { label: "Habis terjual", tone: "destructive" };
  }

  const isPaidEffective = isEventPaidEffective(event);
  const displayPrice = formatEventPriceSummary(event);

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
            {isPaidEffective && (
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
                    : allTiersEnded
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
                <span className="text-destructive font-medium">Habis terjual</span>
              ) : allTiersUpcoming ? (
                <span className="text-muted-foreground font-medium">Penjualan belum dibuka</span>
              ) : allTiersEnded ? (
                <span className="text-destructive font-medium">Penjualan telah berakhir</span>
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
                const isUpcoming = avail?.salesStatus === "UPCOMING";
                const isEnded = avail?.salesStatus === "ENDED";

                const witaRange =
                  t.salesStartDate || t.salesEndDate
                    ? `${t.salesStartDate ? new Date(t.salesStartDate).toLocaleDateString("id-ID", { timeZone: "Asia/Makassar", day: "numeric", month: "short" }) : ""} – ${t.salesEndDate ? new Date(t.salesEndDate).toLocaleDateString("id-ID", { timeZone: "Asia/Makassar", day: "numeric", month: "short" }) : ""} WITA`
                    : null;

                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-medium text-foreground block truncate">
                        {t.name}
                      </span>
                      <span className="text-xs text-muted-foreground block">
                        {isSoldOutTier
                          ? "Habis terjual"
                          : isUpcoming
                          ? "Penjualan belum dibuka"
                          : isEnded
                          ? "Penjualan berakhir"
                          : avail
                          ? `Sisa ${avail.remaining} tiket`
                          : `Kuota ${t.quota} tiket`}
                      </span>
                      {witaRange && (
                        <span className="text-xs text-muted-foreground/80 block">
                          {witaRange}
                        </span>
                      )}
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
              Habis terjual
            </Button>
          ) : allTiersUpcoming ? (
            <Button disabled variant="outline" size="lg" className="w-full">
              Penjualan belum dibuka
            </Button>
          ) : allTiersEnded || (hasTiers && !hasOnSaleTier) ? (
            <Button disabled variant="outline" size="lg" className="w-full text-destructive">
              Penjualan telah berakhir
            </Button>
          ) : (
            <Button
              variant="default"
              size="lg"
              onClick={onOpenBooking}
              className="w-full"
            >
              <Ticket />
              <span>{isPaidEffective ? "Pesan tiket sekarang" : "Daftar gratis"}</span>
            </Button>
          )}
        </div>

        {/* Trust Signals */}
        <div className="pt-2 text-xs text-muted-foreground space-y-1.5 border-t">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="size-3.5 text-success shrink-0 mt-0.5" />
            <span>
              {isPaidEffective
                ? "Pembayaran transfer diverifikasi manual oleh tim Dago sebelum QR check-in aktif"
                : "Konfirmasi instan & penerbitan e-tiket otomatis"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 text-success shrink-0" />
            <span>QR code check-in resmi Dago Creative Hub</span>
          </div>
          <div className="pt-2 border-t text-xs space-y-1">
            <span className="font-medium text-foreground block">Ketentuan refund:</span>
            {event.refundPolicy?.policyType === "REFUNDABLE_UNTIL_H_MINUS" ? (
              <span className="text-muted-foreground block leading-relaxed">
                Bisa refund sampai H-{event.refundPolicy.hMinusDays ?? 0} sebelum acara
                {Boolean(event.refundPolicy.refundFeePercent) && ` (potongan biaya ${event.refundPolicy.refundFeePercent}%)`}.
              </span>
            ) : (
              <span className="text-muted-foreground block leading-relaxed">
                Event ini memberlakukan kebijakan tanpa refund (tiket tidak dapat dibatalkan).
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
