"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calendar, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { PublicCommunityEvent } from "@/types/event";
import {
  eventCategoryLabel,
  eventPriceLabel,
  formatEventSchedule,
  parseEventDateBadge,
} from "./events-catalog-domain";

interface EventCardProps {
  event: PublicCommunityEvent;
  isPast?: boolean;
}

export function EventCard({ event, isPast }: EventCardProps) {
  const dateBadge = parseEventDateBadge(event.startDate);
  const scheduleFormatted = formatEventSchedule(event.startDate, event.endDate);
  const priceDisplay = eventPriceLabel(event.isPaid, event.price);

  return (
    <Card className={`group flex flex-col justify-between overflow-hidden pt-0 transition-colors ${
      isPast ? "opacity-75 bg-muted/20" : "bg-card"
    }`}>
      <Link href={`/events/${event.id}`} className="block flex-1">
        {/* Poster Container */}
        <div className="relative aspect-video w-full overflow-hidden bg-muted rounded-t-lg">
          {event.posterUrl ? (
            <Image
              src={event.posterUrl}
              alt={event.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Calendar className="size-8" />
            </div>
          )}

          {/* Badges Overlay */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className="backdrop-blur-md bg-background/80 text-xs">
              {eventCategoryLabel(event.category)}
            </Badge>
            {isPast && (
              <Badge variant="outline" className="backdrop-blur-md bg-background/80 text-xs">
                Selesai
              </Badge>
            )}
          </div>
        </div>

        {/* Card Body */}
        <CardHeader className="p-4 sm:p-5 pb-3">
          <div className="flex items-start gap-3">
            {/* Date Box */}
            <div className="flex flex-col items-center justify-center rounded-md border bg-muted/40 px-2.5 py-1.5 text-center shrink-0">
              <span className="text-xs font-medium text-muted-foreground leading-none">
                {dateBadge.month}
              </span>
              <span className="font-mono text-lg font-medium text-foreground leading-tight mt-0.5">
                {dateBadge.day}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-base text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {event.title}
              </h3>
              <p className="text-xs text-muted-foreground truncate mt-1 flex items-center gap-1">
                <Users className="size-3.5 shrink-0" />
                <span>Oleh {event.organizerName}</span>
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 sm:px-5 py-0 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 truncate">
            <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{scheduleFormatted}</span>
          </div>

          <div className="flex items-center gap-2 truncate">
            <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{event.location || "Amphitheater Dago Creative Hub"}</span>
          </div>
        </CardContent>
      </Link>

      {/* Card Footer: Price & CTA */}
      <CardFooter className="p-4 sm:p-5 pt-4 border-t flex items-center justify-between gap-3 mt-3">
        <div>
          <span className="text-xs text-muted-foreground block">Tiket</span>
          <span className="font-mono tabular-nums font-medium text-sm text-foreground">
            {priceDisplay}
          </span>
        </div>

        <Button
          variant={isPast ? "outline" : "default"}
          size="sm"
          render={<Link href={`/events/${event.id}`} />}
          nativeButton={false}
        >
          <span>{isPast ? "Lihat detail" : (event.isPaid ? "Pesan tiket" : "Daftar")}</span>
          <ArrowRight className="size-3.5" />
        </Button>
      </CardFooter>
    </Card>
  );
}
