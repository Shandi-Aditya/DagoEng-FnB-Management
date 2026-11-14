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
import { FOOD_PHOTO, HERO_PHOTO, KITCHENS, PARTNER_ROLES, SAMPLE_PRICES, WORKSPACES, type LibraryPhoto } from "./home-content";

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
  className?: string;
  children: React.ReactNode;
}

/**
 * A product card resting on a photograph, the way Bonsai frames its screens.
 * Without a photo the stage takes a unit tint and the DagoEng letters, and the card sits in the middle.
 * The photo is a stand-in: data-slot and data-alt name what the hub's own picture should show.
 */
export function PhotoStage({ photo, tint = "event", sizes, priority, className, children }: PhotoStageProps) {
  return (
    <div
      className={cn("relative isolate overflow-hidden rounded-2xl p-4 sm:p-8", photo ? "bg-muted" : TINT_CLASS[tint], className)}
      data-slot={photo ? "photo-stage" : undefined}
      data-alt={photo?.wanted}
    >
      {photo ? (
        <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} className="-z-10 object-cover saturate-75" />
      ) : (
        <>
          <BrandRings className="absolute -top-16 -left-20 -z-10 h-[85%] opacity-30" />
          <BrandRings className="absolute -right-16 -bottom-24 -z-10 hidden h-[70%] rotate-180 opacity-20 sm:block" />
        </>
      )}
      <div className={cn("flex h-full", photo ? "items-end justify-end" : "items-center justify-center")}>{children}</div>
    </div>
  );
}

function PriceList({ items }: { items: readonly { name: string; price: string }[] }) {
  return (
    <ul className="flex flex-col divide-y">
      {items.map((item) => (
        <li key={item.name} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <span className="text-sm font-medium">{item.name}</span>
          <span className="font-mono text-sm tabular-nums">{item.price}</span>
        </li>
      ))}
    </ul>
  );
}

export function WorkspacePanel({ priority, className }: { priority?: boolean; className?: string }) {
  return (
    <PhotoStage photo={HERO_PHOTO} sizes="(min-width: 64rem) 1100px, 100vw" priority={priority} className={className}>
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader>
          <CardTitle>Tarif ruang kerja</CardTitle>
          <CardDescription>Per jam, dipesan dari ponsel</CardDescription>
        </CardHeader>
        <CardContent>
          <PriceList items={WORKSPACES} />
        </CardContent>
      </Card>
    </PhotoStage>
  );
}

export function FoodPanel({ className }: { className?: string }) {
  return (
    <PhotoStage photo={FOOD_PHOTO} sizes="(min-width: 64rem) 1100px, 100vw" className={className}>
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader>
          <CardTitle>Empat dapur, satu meja</CardTitle>
          <CardDescription>{KITCHENS.join(", ")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PriceList items={SAMPLE_PRICES} />
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
            <Link href={`/events/${event.id}`} className="flex items-center gap-4 py-3 hover:text-primary">
              <span className="flex w-12 shrink-0 flex-col items-center rounded-md border py-1">
                <span className="font-mono text-base tabular-nums">{row.day}</span>
                <span className="text-xs text-muted-foreground">{row.month}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{event.title}</span>
                <span className="text-xs text-muted-foreground">
                  {eventCategoryLabel(event.category)}, {row.time} WITA, {row.price}
                </span>
              </span>
              {row.ticket ? (
                <StatusBadge status={row.ticket === "tersedia" ? "success" : "neutral"}>
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

export function EventsPanel({ className }: { className?: string }) {
  return (
    <PhotoStage sizes="100vw" className={className}>
      <Card className="w-full max-w-xl shadow-lg">
        <CardHeader>
          <CardTitle>Event berikutnya</CardTitle>
          <CardDescription>Langsung dari jadwal Dago Creative Hub</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <EventList />
          <Button variant="outline" size="lg" render={<Link href="/events" />} nativeButton={false}>
            Semua event
          </Button>
        </CardContent>
      </Card>
    </PhotoStage>
  );
}

export function PartnerPanel({ className }: { className?: string }) {
  return (
    <PhotoStage tint="loyalty" sizes="100vw" className={className}>
      <Card className="w-full max-w-xl shadow-lg">
        <CardHeader>
          <CardTitle>Satu sistem untuk semua yang bekerja di sini</CardTitle>
          <CardDescription>Kasir, dapur, tenant, dan penyelenggara memakai data yang sama</CardDescription>
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
