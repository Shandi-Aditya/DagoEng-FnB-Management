"use client";

import { Award, Check, Copy, Gift, History, Sparkles, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandRings } from "@/features/landing/home/BrandRings";
import { formatCurrencyIDR } from "@/lib/utils";
import type { PromoConfig } from "@/lib/promo";

export interface CustomerLoyaltyTabProps {
  isLoggedIn: boolean;
  memberTier: string;
  memberPoints: number;
  memberNextTierName?: string;
  memberPointsToNextTier: number;
  memberTierProgressPercent: number;
  ownedPromos: PromoConfig[];
  claimablePromos: PromoConfig[];
  loyaltyPerkVouchers: any[];
  pointHistory: any[];
  onClaimPromo: (promo: PromoConfig) => void;
  onRedeemReward: (voucher: any) => void;
  onCopyPromoCode: (code: string) => void;
}

export function CustomerLoyaltyTab({
  isLoggedIn,
  memberTier,
  memberPoints,
  memberNextTierName,
  memberPointsToNextTier,
  memberTierProgressPercent,
  ownedPromos,
  claimablePromos,
  loyaltyPerkVouchers,
  pointHistory,
  onClaimPromo,
  onRedeemReward,
  onCopyPromoCode,
}: CustomerLoyaltyTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Kartu Status Poin & Tier dengan Brand Rings */}
      <div className="relative isolate overflow-hidden rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <BrandRings className="absolute -top-16 -left-20 -z-10 h-72 opacity-25" />
        <BrandRings className="absolute -right-16 -bottom-24 -z-10 hidden h-64 rotate-180 opacity-20 sm:block" />

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div>
              <span className="text-xs text-muted-foreground">Tingkatan member aktif</span>
              <div className="flex items-center gap-2 mt-0.5">
                <h2 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
                  Tier {memberTier}
                </h2>
                <Badge variant="outline" className="text-xs">
                  Loyalty Member
                </Badge>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground">Saldo poin terkumpul</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-mono text-3xl font-medium text-foreground tabular-nums">
                  {memberPoints}
                </span>
                <span className="text-xs text-muted-foreground">poin</span>
              </div>
            </div>
          </div>

          {memberNextTierName ? (
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Progres menuju tier {memberNextTierName}</span>
                <span className="font-mono tabular-nums">{memberPointsToNextTier} poin lagi</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{ width: `${Math.min(100, Math.max(5, memberTierProgressPercent))}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Selamat! Anda berada di tingkatan tertinggi member Dago Creative Hub.
            </p>
          )}
        </div>
      </div>

      {/* 1. Voucher Saya (Yang Sudah Diklaim / Dimiliki) */}
      {ownedPromos.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Tag className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Voucher saya ({ownedPromos.length})</h3>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ownedPromos.map((promo) => (
              <Card key={promo.id}>
                <CardContent className="flex flex-col justify-between gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-medium text-foreground">{promo.code}</span>
                      <p className="text-sm font-medium mt-0.5">{promo.name}</p>
                      {promo.description ? (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {promo.description}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="secondary">
                      {promo.discountType === "PERCENTAGE" ? `${promo.discountValue}%` : formatCurrencyIDR(promo.discountValue)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between border-t pt-2 text-xs">
                    <span className="text-muted-foreground">
                      {promo.validUntil ? `Sampai ${promo.validUntil.slice(0, 10)}` : "Tanpa kedaluwarsa"}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onCopyPromoCode(promo.code || "")}
                    >
                      <Copy />
                      <span>Salin kode</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {/* 2. Voucher Tersedia untuk Diklaim */}
      {claimablePromos.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Gift className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Promo tersedia untuk diklaim</h3>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {claimablePromos.map((promo) => (
              <Card key={promo.id}>
                <CardContent className="flex flex-col justify-between gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-medium text-foreground">{promo.code || "PROMO"}</span>
                      <p className="text-sm font-medium mt-0.5">{promo.name}</p>
                      {promo.description ? (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {promo.description}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="secondary">
                      {promo.discountType === "PERCENTAGE" ? `${promo.discountValue}%` : formatCurrencyIDR(promo.discountValue)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between border-t pt-2 text-xs">
                    <span className="text-muted-foreground">Gratis untuk member</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onClaimPromo(promo)}
                    >
                      <Gift />
                      <span>Klaim voucher</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {/* 3. Tukar Hadiah / Reward dengan Poin */}
      {loyaltyPerkVouchers.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Award className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Tukar poin dengan hadiah</h3>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {loyaltyPerkVouchers.map((perk) => {
              const canAfford = memberPoints >= perk.pointsCost;

              return (
                <Card key={perk.id}>
                  <CardContent className="flex flex-col justify-between gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-medium text-foreground">{perk.code}</span>
                        <p className="text-sm font-medium mt-0.5">{perk.title || perk.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{perk.description}</p>
                      </div>
                      <Badge variant="outline" className="font-mono tabular-nums">
                        {perk.pointsCost} poin
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between border-t pt-2 text-xs">
                      <span className="text-muted-foreground font-mono tabular-nums">
                        Potongan {formatCurrencyIDR(perk.discountValue)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant={canAfford ? "default" : "outline"}
                        disabled={!canAfford}
                        onClick={() => onRedeemReward(perk)}
                      >
                        {canAfford ? "Tukar poin" : "Poin belum cukup"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 4. Riwayat Mutasi Poin */}
      {pointHistory && pointHistory.length > 0 ? (
        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Riwayat poin</h3>
          </div>

          <div className="flex flex-col divide-y rounded-lg border bg-card">
            {pointHistory.slice(0, 10).map((h, i) => (
              <div key={h.id || i} className="flex items-center justify-between p-3.5 text-xs">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{h.description || h.action}</span>
                  <span className="font-mono text-muted-foreground">
                    {new Date(h.timestamp || h.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <span
                  className={`font-mono font-medium tabular-nums ${
                    h.points > 0 ? "text-success" : "text-destructive"
                  }`}
                >
                  {h.points > 0 ? `+${h.points}` : h.points} poin
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
