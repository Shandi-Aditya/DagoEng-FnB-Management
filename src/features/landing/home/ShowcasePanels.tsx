"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { eventCategoryLabel, eventNoticeRow } from "@/features/landing/landing-logic";
import { useUpcomingEvents } from "@/features/landing/use-upcoming-events";
import { cn } from "@/lib/utils";

import { BrandRings } from "./BrandRings";
import { EVENT_PHOTO, FOOD_PHOTO, HERO_PHOTO, KITCHENS, PARTNER_ROLES, WORKSPACES, type LibraryPhoto } from "./home-content";

type StageTint = "event" | "loyalty";

// Static class names so Tailwind can detect them
const TINT_CLASS: Record<StageTint, string> = {
  event: "bg-unit-event/10",
  loyalty: "bg-unit-loyalty/15",
};

interface PhotoStageProps {
  photo?: LibraryPhoto;
  /** Background for a stage without a photograph: a soft business-unit colour with the brand rings. */
  tint?: StageTint;
  sizes: string;
  priority?: boolean;
  withBottomDissolve?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * A product card resting on a photograph, the way Bonsai frames its screens.
 * Without a photo the stage takes a unit tint and the DagoEng letters, and the card sits in the middle.
 * The photo is a stand-in: data-slot and data-alt name what the hub's own picture should show.
 */
export function PhotoStage({
  photo,
  tint = "event",
  sizes,
  priority,
  withBottomDissolve = false,
  className,
  children,
}: PhotoStageProps) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-background",
        withBottomDissolve
          ? "rounded-t-xl sm:rounded-t-2xl rounded-b-none p-3.5 sm:p-6 pb-8 sm:pb-12"
          : "rounded-xl sm:rounded-2xl p-3.5 sm:p-6",
        photo ? "bg-muted" : TINT_CLASS[tint],
        className,
      )}
      data-slot={photo ? "photo-stage" : undefined}
      data-alt={photo?.wanted}
    >
      {photo ? (
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="-z-20 object-cover saturate-85"
        />
      ) : (
        <>
          <BrandRings className="absolute -top-16 -left-20 -z-20 h-[85%] opacity-30" />
          <BrandRings className="absolute -right-16 -bottom-24 -z-20 hidden h-[70%] rotate-180 opacity-20 sm:block" />
        </>
      )}

      {/* Bottom dissolve overlay: active only when withBottomDissolve is requested (e.g. Hero showcase) */}
      {withBottomDissolve && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-36 sm:h-52 bg-gradient-to-t from-background from-15% via-background/80 via-55% to-transparent -z-10"
          aria-hidden="true"
        />
      )}

      <div className={cn("relative z-10 flex h-full", photo ? "items-end justify-end" : "items-center justify-center")}>
        {children}
      </div>
    </div>
  );
}

function PriceList({
  items,
  compact = false,
}: {
  items: readonly { name: string; price: string }[];
  compact?: boolean;
}) {
  return (
    <ul className="flex flex-col divide-y divide-border/60">
      {items.map((item) => (
        <li
          key={item.name}
          className={cn(
            "flex items-center justify-between gap-3 first:pt-0 last:pb-0",
            compact ? "py-1.5" : "py-2.5",
          )}
        >
          <span className={cn("font-medium", compact ? "text-xs" : "text-sm")}>{item.name}</span>
          <span className={cn("font-mono tabular-nums", compact ? "text-xs" : "text-sm")}>{item.price}</span>
        </li>
      ))}
    </ul>
  );
}

export function WorkspacePanel({
  priority,
  className,
  compact = false,
  withBottomDissolve,
}: {
  priority?: boolean;
  className?: string;
  compact?: boolean;
  withBottomDissolve?: boolean;
}) {
  if (compact) {
    return (
      <div className={cn("relative flex items-center justify-center p-3 sm:p-6", className)}>
        <div className="relative w-full max-w-xl sm:min-w-[506px] h-[365.5px] rounded-2xl overflow-hidden bg-muted">
          <Image
            src={HERO_PHOTO.src}
            alt={HERO_PHOTO.alt}
            fill
            sizes="(min-width: 64rem) 1100px, 100vw"
            priority={priority}
            className="object-cover saturate-85"
          />
          <div className="relative z-10 flex h-full items-end justify-end p-3 sm:p-4">
            <Card className="rounded-2xl border border-border/60 bg-background/95 shadow-xl backdrop-blur-md w-full max-w-[15rem] sm:max-w-[16.5rem] py-2 px-3 gap-1.5">
              <CardHeader className="p-0 gap-0.5">
                <CardTitle className="text-sm font-semibold">Tarif ruang kerja</CardTitle>
                <CardDescription className="text-xs">Per jam, dipesan dari ponsel</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <PriceList items={WORKSPACES} compact />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PhotoStage
      photo={HERO_PHOTO}
      sizes="(min-width: 64rem) 1100px, 100vw"
      priority={priority}
      withBottomDissolve={withBottomDissolve}
      className={className}
    >
      <Card className="w-full max-w-sm py-3 px-4 gap-2.5 rounded-2xl border border-border/60 bg-background/95 shadow-xl backdrop-blur-md">
        <CardHeader className="p-0 gap-0.5">
          <CardTitle className="text-base font-semibold">Tarif ruang kerja</CardTitle>
          <CardDescription className="text-xs">Per jam, dipesan dari ponsel</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <PriceList items={WORKSPACES} />
        </CardContent>
      </Card>
    </PhotoStage>
  );
}

function KitchenList({ compact = false }: { compact?: boolean }) {
  return (
    <ul className="flex flex-col divide-y divide-border/60">
      {KITCHENS.map((kitchen) => (
        <li
          key={kitchen}
          className={cn(
            "first:pt-0 last:pb-0",
            compact ? "py-1.5" : "py-2.5",
          )}
        >
          <span className={cn("font-medium", compact ? "text-xs" : "text-sm")}>{kitchen}</span>
        </li>
      ))}
    </ul>
  );
}

export function FoodPanel({
  className,
  compact = false,
  withBottomDissolve,
}: {
  className?: string;
  compact?: boolean;
  withBottomDissolve?: boolean;
}) {
  if (compact) {
    return (
      <div className={cn("relative flex items-center justify-center p-3 sm:p-6", className)}>
        <div className="relative w-full max-w-xl sm:min-w-[506px] h-[365.5px] rounded-2xl overflow-hidden bg-muted">
          <Image
            src={FOOD_PHOTO.src}
            alt={FOOD_PHOTO.alt}
            fill
            sizes="(min-width: 64rem) 1100px, 100vw"
            className="object-cover saturate-85"
          />
          <div className="relative z-10 flex h-full items-end justify-end p-3 sm:p-4">
            <Card className="rounded-2xl border border-border/60 bg-background/95 shadow-xl backdrop-blur-md w-full max-w-[15rem] sm:max-w-[16.5rem] py-2 px-3 gap-1.5">
              <CardHeader className="p-0 gap-0.5">
                <CardTitle className="text-sm font-semibold">Daftar dapur mitra</CardTitle>
                <CardDescription className="truncate text-xs">Pesan dari meja, diantar langsung</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <KitchenList compact />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PhotoStage
      photo={FOOD_PHOTO}
      sizes="(min-width: 64rem) 1100px, 100vw"
      withBottomDissolve={withBottomDissolve}
      className={className}
    >
      <Card className="w-full max-w-sm py-3 px-4 gap-2.5 rounded-2xl border border-border/60 bg-background/95 shadow-xl backdrop-blur-md">
        <CardHeader className="p-0 gap-0.5">
          <CardTitle className="text-base font-semibold">Daftar dapur mitra</CardTitle>
          <CardDescription className="truncate text-xs">Pesan dari meja, diantar langsung</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <KitchenList />
        </CardContent>
      </Card>
    </PhotoStage>
  );
}

function EventList() {
  const state = useUpcomingEvents();

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Memuat jadwal event">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (state.status === "error" || state.events.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title={state.status === "error" ? "Jadwal event tidak bisa dimuat" : "Belum ada event terjadwal"}
        description="Lihat semua event atau ajukan event komunitas Anda."
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y">
      {state.events.map((event) => {
        const row = eventNoticeRow(event);
        return (
          <li key={event.id}>
            <Link
              href={`/events/${event.id}`}
              className="flex items-center gap-3 sm:gap-4 py-2.5 sm:py-3 hover:text-primary"
            >
              <span className="flex w-11 sm:w-12 shrink-0 flex-col items-center rounded-md border py-1">
                <span className="font-mono text-sm sm:text-base tabular-nums">{row.day}</span>
                <span className="text-xs text-muted-foreground">{row.month}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs sm:text-sm font-medium">{event.title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {eventCategoryLabel(event.category)}, {row.time} WITA, {row.price}
                </span>
              </span>
              {row.ticket ? (
                <StatusBadge
                  status={row.ticket === "tersedia" ? "success" : "neutral"}
                  className="hidden sm:inline-flex shrink-0"
                >
                  {row.ticket === "tersedia" ? "Tiket tersedia" : "Habis"}
                </StatusBadge>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function EventsPanel({
  className,
  noPhoto = false,
  withBottomDissolve,
}: {
  className?: string;
  noPhoto?: boolean;
  withBottomDissolve?: boolean;
}) {
  const card = (
    <Card className="w-full max-w-xl rounded-2xl border border-border/60 bg-background/95 shadow-none backdrop-blur-md p-3.5 sm:p-6">
      <CardHeader className="p-0 pb-2.5 sm:pb-4">
        <CardTitle className="text-base sm:text-lg">Event di Singaraja</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Jadwal event terbaru yang bisa kamu ikuti</CardDescription>
      </CardHeader>
      <CardContent className="p-0 flex flex-col gap-3 sm:gap-4">
        <EventList />
        <Button variant="outline" size="lg" render={<Link href="/events" />} nativeButton={false}>
          Semua event
        </Button>
      </CardContent>
    </Card>
  );

  if (noPhoto) {
    return (
      <div className={cn("relative flex items-center justify-center p-1 sm:p-6 w-full", className)}>
        {card}
      </div>
    );
  }

  return (
    <PhotoStage
      photo={EVENT_PHOTO}
      sizes="100vw"
      withBottomDissolve={withBottomDissolve}
      className={className}
    >
      {card}
    </PhotoStage>
  );
}

export function PartnerPanel({
  className,
  withBottomDissolve,
}: {
  className?: string;
  withBottomDissolve?: boolean;
}) {
  return (
    <PhotoStage
      tint="loyalty"
      sizes="100vw"
      withBottomDissolve={withBottomDissolve}
      className={className}
    >
      <Card className="w-full max-w-xl shadow-lg">
        <CardHeader>
          <CardTitle>Ekosistem F&amp;B, coworking, dan event</CardTitle>
          <CardDescription>Dapur mitra, tenant, penyelenggara event, dan tim operasional dalam satu ekosistem</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {PARTNER_ROLES.map((role) => (
              <li key={role.id} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
                <span className="text-sm font-medium">{role.title}</span>
                <span className="text-xs text-muted-foreground">{role.line}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </PhotoStage>
  );
}
