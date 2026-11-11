"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Plus } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LandingSection } from "@/features/landing/LandingSection";
import { eventCategoryLabel } from "@/features/landing/landing-logic";
import { useUpcomingEvents } from "@/features/landing/use-upcoming-events";
import { formatCurrencyIDR } from "@/lib/utils";
import type { PublicCommunityEvent } from "@/types/event";

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};

function EventCard({ event }: { event: PublicCommunityEvent }) {
  return (
    <Card className="overflow-hidden pt-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- posters come from arbitrary organizer hosts */}
      <img src={event.posterUrl} alt="" className="aspect-video w-full bg-muted object-cover" loading="lazy" />
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{eventCategoryLabel(event.category)}</Badge>
          <Badge variant="outline">{event.isPaid ? formatCurrencyIDR(event.price) : "Gratis"}</Badge>
        </div>
        <CardTitle className="line-clamp-2 text-base">{event.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0" aria-hidden />
          {new Date(event.startDate).toLocaleDateString("id-ID", DATE_FORMAT)}
        </span>
        <span className="flex items-center gap-2">
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{event.location}</span>
        </span>
        <span>oleh {event.organizerName}</span>
      </CardContent>
      <CardFooter className="mt-auto">
        <Button variant="outline" size="sm" render={<Link href={`/events/${event.id}`} />} nativeButton={false}>
          Detail event
          <ArrowRight />
        </Button>
      </CardFooter>
    </Card>
  );
}

function EventsBody() {
  const state = useUpcomingEvents();

  if (state.status === "loading") {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-80 rounded-xl" />
        ))}
      </div>
    );
  }

  if (state.status === "error" || state.events.length === 0) {
    return (
      <EmptyState
        className="border"
        icon={<CalendarDays />}
        title={state.status === "error" ? "Daftar event belum bisa dimuat" : "Belum ada event terjadwal"}
        description="Mau mengadakan workshop, meetup, atau sesi berbagi? Ajukan eventmu, gratis."
        action={
          <Button render={<Link href="/events/submit" />} nativeButton={false}>
            Ajukan event
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {state.events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

export function EventsSection() {
  return (
    <LandingSection
      id="events"
      title="Event komunitas"
      description="Workshop, meetup, dan sesi berbagi dari komunitas di Singaraja dan sekitarnya."
      action={
        <>
          <Button variant="outline" render={<Link href="/events/submit" />} nativeButton={false}>
            <Plus />
            Ajukan event
          </Button>
          <Button variant="ghost" render={<Link href="/events" />} nativeButton={false}>
            Semua event
            <ArrowRight />
          </Button>
        </>
      }
    >
      <EventsBody />
    </LandingSection>
  );
}
