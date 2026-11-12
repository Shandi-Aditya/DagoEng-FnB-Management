"use client";

import Link from "next/link";
import {
  ArrowRight,
  Award,
  CalendarDays,
  Clock,
  Coffee,
  Copy,
  Laptop,
  LogIn,
  Store,
  Tag,
  Ticket,
  UtensilsCrossed,
} from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandRings } from "@/features/landing/home/BrandRings";
import { formatCurrencyIDR } from "@/lib/utils";
import type { OrderRecord } from "@/types/order";
import type { PromoConfig } from "@/lib/promo";

import { customerOrderStatusLabel, customerOrderStatusTone } from "./customer-domain";

interface FnbPartnerSummary {
  id: string;
  name: string;
  tagline: string;
  badge: string;
}

export interface CustomerHomeTabProps {
  isLoggedIn: boolean;
  memberName?: string;
  memberTier?: string;
  memberPoints?: number;
  memberNextTierName?: string;
  memberPointsToNextTier?: number;
  memberTierProgressPercent?: number;
  activeOrders: OrderRecord[];
  activeBookingsCount: number;
  promos: PromoConfig[];
  partners: FnbPartnerSummary[];
  onNavigateTab: (tab: "MENU" | "COWORKING" | "ORDERS" | "LOYALTY" | "PROFILE") => void;
  onSelectPartner: (partnerId: string) => void;
}

export function CustomerHomeTab({
  isLoggedIn,
  memberName,
  memberTier = "Bronze",
  memberPoints = 0,
  memberNextTierName,
  memberPointsToNextTier = 0,
  memberTierProgressPercent = 0,
  activeOrders,
  activeBookingsCount,
  promos,
  partners,
  onNavigateTab,
  onSelectPartner,
}: CustomerHomeTabProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* 1. HERO STAGE BERKARTU BRAND RINGS */}
      <div className="relative isolate overflow-hidden rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <BrandRings className="absolute -top-16 -left-20 -z-10 h-72 opacity-25" />
        <BrandRings className="absolute -right-16 -bottom-24 -z-10 hidden h-64 rotate-180 opacity-20 sm:block" />

        {!isLoggedIn ? (
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex max-w-xl flex-col gap-2">
              <Badge variant="outline" className="w-fit gap-1.5 text-xs">
                <SparklesIcon className="size-3.5 text-unit-loyalty" />
                <span>Poin & Keanggotaan</span>
              </Badge>
              <h2 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
                Kerja, makan, dan kumpulkan poin di Dago Creative Hub
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Daftar akun member gratis untuk mendapatkan 50 poin pertama dan nikmati potongan harga khusus.
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
              <Button
                size="lg"
                render={<Link href="/login?mode=register&returnTo=/customer" />}
                nativeButton={false}
              >
                <LogIn />
                <span>Daftar member</span>
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => onNavigateTab("MENU")}
              >
                <span>Lihat menu</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Member aktif</span>
                <p className="text-2xl font-medium text-foreground">{memberName}</p>
                <span className="text-xs text-muted-foreground">Level keanggotaan Dago Creative Hub</span>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="outline" className="px-3 py-1 text-xs">
                  Tier {memberTier}
                </Badge>
                <div className="flex flex-col items-end">
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-3xl font-medium text-foreground tabular-nums">
                      {memberPoints}
                    </span>
                    <span className="text-xs text-muted-foreground">poin</span>
                  </div>
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
            ) : null}
          </div>
        )}
      </div>

      {/* 2. PINTASAN CEPAT 4 UNIT BISNIS (SEPERTI LANDING PAGE) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => onNavigateTab("MENU")}
          className="flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:bg-muted/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-unit-fnb/10 text-unit-fnb">
            <UtensilsCrossed className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Pesan Menu</p>
            <p className="text-xs text-muted-foreground">4 dapur mitra kuliner</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab("COWORKING")}
          className="flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:bg-muted/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-unit-coworking/10 text-unit-coworking">
            <Laptop className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Ruang Kerja</p>
            <p className="text-xs text-muted-foreground">Mulai Rp 15.000/jam</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab("ORDERS")}
          className="flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:bg-muted/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-unit-event/10 text-unit-event">
            <Ticket className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Pesanan & Tiket</p>
            <p className="text-xs text-muted-foreground">Status & e-tiket QR</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab("LOYALTY")}
          className="flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:bg-muted/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-unit-loyalty/15 text-unit-loyalty">
            <Award className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Poin & Hadiah</p>
            <p className="text-xs text-muted-foreground">Voucher & diskon</p>
          </div>
        </button>
      </div>

      {/* 3. PELACAK PESANAN AKTIF BERJALAN */}
      {activeOrders.length > 0 || activeBookingsCount > 0 ? (
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-medium">Pesanan aktif berjalan</CardTitle>
              <CardDescription>
                {activeOrders.length} pesanan makanan · {activeBookingsCount} booking ruang
              </CardDescription>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => onNavigateTab("ORDERS")}>
              <span>Semua pesanan</span>
              <ArrowRight />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {activeOrders.slice(0, 3).map((order) => (
              <div key={order.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-sm font-medium text-foreground">{order.orderNumber}</span>
                  <span className="text-muted-foreground">Meja {order.tableNumber}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                    {formatCurrencyIDR(order.total)}
                  </span>
                  <StatusBadge status={customerOrderStatusTone(order.status)}>
                    {customerOrderStatusLabel(order.status)}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* 4. MITRA KULINER PILIHAN */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium text-foreground">Empat dapur mitra</h3>
            <p className="text-xs text-muted-foreground">Pesan makanan dan minuman langsung dari meja Anda.</p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => onNavigateTab("MENU")}>
            <span>Buka katalog</span>
            <ArrowRight />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-4">
          {partners.map((partner) => (
            <button
              key={partner.id}
              type="button"
              onClick={() => {
                onSelectPartner(partner.id);
                onNavigateTab("MENU");
              }}
              className="flex flex-col justify-between rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{partner.name}</span>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {partner.badge}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{partner.tagline}</p>
              </div>

              <div className="flex items-center gap-1 text-xs font-medium text-primary pt-3 mt-2 border-t">
                <span>Lihat menu</span>
                <ArrowRight className="size-3" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 5. VOUCHER & PROMO */}
      {promos.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-medium text-foreground">Voucher dan promo</h3>
              <p className="text-xs text-muted-foreground">Gunakan kode kupon saat menyelesaikan pembayaran.</p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => onNavigateTab("LOYALTY")}>
              <span>Semua voucher</span>
              <ArrowRight />
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {promos.slice(0, 3).map((promo) => (
              <div key={promo.id} className="flex flex-col justify-between rounded-xl border bg-card p-4 text-xs shadow-xs">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium text-foreground">{promo.code || "PROMO"}</span>
                    <Badge variant="outline">
                      {promo.discountType === "PERCENTAGE" ? `${promo.discountValue}%` : formatCurrencyIDR(promo.discountValue)}
                    </Badge>
                  </div>
                  <p className="font-medium text-foreground mt-1">{promo.name}</p>
                  {promo.description ? (
                    <p className="text-muted-foreground line-clamp-1">{promo.description}</p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between pt-3 mt-2 border-t text-muted-foreground">
                  <span>{promo.validUntil ? `Hingga ${promo.validUntil.slice(0, 10)}` : "Tanpa batas"}</span>
                  <span className="font-medium text-foreground">Kupon aktif</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  );
}

