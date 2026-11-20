"use client";

import React from "react";
import { Calendar, MapPin, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/app/status-badge";
import { formatTicketEventDate, getTicketPaymentStatusTone } from "./ticket-pass-domain";

interface TicketEventMetaProps {
  title: string;
  category?: string;
  organizerName?: string;
  eventDate: string;
  location: string;
  paymentStatus: string;
  ticketTierName?: string | null;
  isInvitation?: boolean;
}

export function TicketEventMeta({
  title,
  category,
  organizerName,
  eventDate,
  location,
  paymentStatus,
  ticketTierName,
  isInvitation,
}: TicketEventMetaProps) {
  const statusInfo = getTicketPaymentStatusTone(paymentStatus);

  return (
    <div className="space-y-4">
      {/* Top Banner Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <span className="text-xs text-muted-foreground block">
            E-Tiket Komunitas Resmi
          </span>
          <h2 className="text-base font-semibold leading-tight text-foreground">
            Dago Creative Hub
          </h2>
        </div>
        <StatusBadge status={statusInfo.tone}>
          {statusInfo.label}
        </StatusBadge>
      </div>

      {/* Event Details */}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {category && (
            <Badge variant="secondary" className="text-xs">
              {category}
            </Badge>
          )}
          {isInvitation && (
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs">
              Tiket undangan
            </Badge>
          )}
          {ticketTierName && (
            <Badge variant="outline" className="text-xs">
              {ticketTierName}
            </Badge>
          )}
        </div>
        <h1 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
          {title}
        </h1>
        {organizerName && (
          <p className="text-xs text-muted-foreground">
            Diselenggarakan oleh <span className="font-medium text-foreground">{organizerName}</span>
          </p>
        )}
      </div>

      {/* Date & Location Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-border bg-muted/30 text-xs">
        <div className="flex items-start gap-2.5">
          <Calendar className="size-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="text-xs text-muted-foreground font-medium block">Waktu acara</span>
            <span className="font-medium text-foreground leading-snug block">
              {formatTicketEventDate(eventDate)}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="text-xs text-muted-foreground font-medium block">Lokasi venue</span>
            <span className="font-medium text-foreground leading-snug block">
              {location}
            </span>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium pt-0.5"
            >
              <span>Buka Google Maps</span>
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
