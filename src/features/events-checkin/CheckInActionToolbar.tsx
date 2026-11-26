"use client";

import React, { useRef } from "react";
import { Camera, Calendar, Clock, MapPin, ScanLine, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { CommunityEvent } from "@/types/event";

interface CheckInActionToolbarProps {
  event: CommunityEvent;
  events?: readonly CommunityEvent[];
  selectedEventId?: string;
  onSelectEvent?: (id: string) => void;
  barcodeInput: string;
  onChangeBarcodeInput: (value: string) => void;
  onSubmitBarcode: (e?: React.FormEvent) => void;
  isQuickScanning: boolean;
  onOpenScanner: () => void;
}

export function CheckInActionToolbar({
  event,
  events,
  selectedEventId,
  onSelectEvent,
  barcodeInput,
  onChangeBarcodeInput,
  onSubmitBarcode,
  isQuickScanning,
  onOpenScanner,
}: CheckInActionToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const formattedDate = new Date(event.startDate).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Makassar",
  });

  const formattedTime =
    new Date(event.startDate).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Makassar",
    }) + " WITA";

  const hasMultipleEvents = Boolean(events && events.length > 1 && onSelectEvent);

  return (
    <Card className="p-4 sm:p-5 space-y-4">
      {/* Event Meta Line / Event Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-border">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {event.category}
          </Badge>
          <Badge variant="default" className="text-xs">
            Hari ini (WITA)
          </Badge>
          {event.organizerName && (
            <span className="text-xs text-muted-foreground truncate">
              Penyelenggara: <span className="text-foreground font-medium">{event.organizerName}</span>
            </span>
          )}
        </div>

        {hasMultipleEvents && onSelectEvent && (
          <div className="w-full sm:w-72 md:w-80">
            <NativeSelect
              value={selectedEventId || event.id}
              onChange={(e) => onSelectEvent(e.target.value)}
              aria-label="Pilih event hari ini"
              className="text-xs"
            >
              {events!.map((evt) => (
                <NativeSelectOption key={evt.id} value={evt.id}>
                  {evt.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Event Details */}
        <div className="space-y-1.5 min-w-0 w-full max-w-2xl">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground truncate">
            {event.title}
          </h2>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground min-w-0 max-w-full">
            <span className="inline-flex items-center gap-1.5 shrink-0">
              <Calendar className="size-3.5" />
              <span>{formattedDate}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 shrink-0">
              <Clock className="size-3.5" />
              <span>{formattedTime}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{event.location}</span>
            </span>
          </div>
        </div>

        {/* Scan Actions: Camera Button + Barcode Gun Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto shrink-0">
          <Button
            type="button"
            size="lg"
            variant="default"
            onClick={onOpenScanner}
            className="w-full sm:w-auto"
          >
            <Camera />
            <span>Buka kamera QR</span>
          </Button>

          <form onSubmit={onSubmitBarcode} className="flex items-center gap-2 w-full sm:w-auto min-w-0">
            <InputGroup className="w-full sm:w-60 md:w-64">
              <InputGroupAddon>
                {isQuickScanning ? (
                  <Loader2 className="animate-spin text-muted-foreground" />
                ) : (
                  <ScanLine className="text-muted-foreground" />
                )}
              </InputGroupAddon>
              <InputGroupInput
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => onChangeBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    onSubmitBarcode();
                  }
                }}
                placeholder={isQuickScanning ? "Memvalidasi..." : "Scan barcode / ketik kode"}
                disabled={isQuickScanning}
                aria-label="Input kode tiket atau scan barcode"
              />
            </InputGroup>

            <Button
              type="submit"
              size="default"
              variant="outline"
              disabled={!barcodeInput.trim() || isQuickScanning}
            >
              <span>Validasi</span>
            </Button>
          </form>
        </div>
      </div>
    </Card>
  );
}
