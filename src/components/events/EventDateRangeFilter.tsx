"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Calendar, Check, ChevronDown, Clock, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startMs?: number; // WITA 00:00:00
  endMs?: number; // WITA 23:59:59.999
}

export type PresetKey = "ALL" | "TODAY" | "7D" | "30D" | "MONTH" | "CUSTOM";

export interface EventDateRangeFilterProps {
  onApplyFilter: (range: DateRange | null) => void;
  initialRange?: DateRange | null;
  className?: string;
  label?: string;
  align?: "left" | "right";
}

/**
 * Menghitung format tanggal (YYYY-MM-DD) dalam zona waktu WITA (Asia/Makassar, UTC+8).
 */
export function getWitaDateString(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(date);
  } catch {
    const tzOffset = 8 * 60;
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const witaDate = new Date(utc + tzOffset * 60000);
    return witaDate.toISOString().slice(0, 10);
  }
}

/**
 * Menghitung tanggal N hari lalu dalam WITA.
 */
export function getWitaDaysAgoString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return getWitaDateString(d);
}

/**
 * Menghitung tanggal awal bulan ini dalam WITA (YYYY-MM-01).
 */
export function getWitaStartOfMonthString(): string {
  const todayWita = getWitaDateString();
  return `${todayWita.slice(0, 7)}-01`;
}

/**
 * Menghitung epoch timestamp (ms) untuk 00:00:00.000 WITA pada tanggal YYYY-MM-DD.
 */
export function getWitaStartOfDay(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00+08:00`).getTime();
}

/**
 * Menghitung epoch timestamp (ms) untuk 23:59:59.999 WITA pada tanggal YYYY-MM-DD.
 */
export function getWitaEndOfDay(dateStr: string): number {
  return new Date(`${dateStr}T23:59:59.999+08:00`).getTime();
}

/**
 * Memeriksa apakah event bersinggungan dengan rentang waktu periode WITA.
 */
export function isEventInWitaPeriod(
  event: { startDate: string; endDate?: string | null },
  range?: DateRange | null
): boolean {
  if (!range || !range.startDate || !range.endDate) return true;

  const filterStartMs = range.startMs ?? getWitaStartOfDay(range.startDate);
  const filterEndMs = range.endMs ?? getWitaEndOfDay(range.endDate);

  const eventStartMs = new Date(event.startDate).getTime();
  const eventEndMs = event.endDate
    ? new Date(event.endDate).getTime()
    : eventStartMs + 24 * 60 * 60 * 1000;

  if (isNaN(eventStartMs) || isNaN(eventEndMs)) return true;

  return eventStartMs <= filterEndMs && eventEndMs >= filterStartMs;
}

/**
 * Memeriksa apakah timestamp berada di dalam rentang filter tanggal WITA.
 */
export function isTimestampInWitaPeriod(
  timestamp: string | number,
  range?: DateRange | null
): boolean {
  if (!range || !range.startDate || !range.endDate) return true;

  const startMs = range.startMs ?? getWitaStartOfDay(range.startDate);
  const endMs = range.endMs ?? getWitaEndOfDay(range.endDate);

  const targetMs = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp;
  if (isNaN(targetMs)) return false;

  return targetMs >= startMs && targetMs <= endMs;
}

export function EventDateRangeFilter({
  onApplyFilter,
  initialRange = null,
  className = "",
  label = "Filter tanggal",
  align = "left",
}: EventDateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState(initialRange?.startDate || "");
  const [endDate, setEndDate] = useState(initialRange?.endDate || "");
  const [appliedRange, setAppliedRange] = useState<DateRange | null>(initialRange);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showCustomInputs, setShowCustomInputs] = useState(false);

  useEffect(() => {
    if (initialRange) {
      setStartDate(initialRange.startDate);
      setEndDate(initialRange.endDate);
      setAppliedRange(initialRange);
    } else {
      setStartDate("");
      setEndDate("");
      setAppliedRange(null);
    }
  }, [initialRange]);

  const activePreset = useMemo<PresetKey>(() => {
    if (!appliedRange || (!appliedRange.startDate && !appliedRange.endDate)) {
      return "ALL";
    }

    const todayStr = getWitaDateString();
    const daysAgo7 = getWitaDaysAgoString(7);
    const daysAgo30 = getWitaDaysAgoString(30);
    const monthStart = getWitaStartOfMonthString();

    if (appliedRange.startDate === todayStr && appliedRange.endDate === todayStr) {
      return "TODAY";
    }
    if (appliedRange.startDate === daysAgo7 && appliedRange.endDate === todayStr) {
      return "7D";
    }
    if (appliedRange.startDate === daysAgo30 && appliedRange.endDate === todayStr) {
      return "30D";
    }
    if (appliedRange.startDate === monthStart && appliedRange.endDate === todayStr) {
      return "MONTH";
    }

    return "CUSTOM";
  }, [appliedRange]);

  const activeLabel = useMemo(() => {
    switch (activePreset) {
      case "TODAY":
        return "Hari ini";
      case "7D":
        return "7 hari terakhir";
      case "30D":
        return "30 hari terakhir";
      case "MONTH":
        return "Bulan ini";
      case "CUSTOM":
        if (appliedRange?.startDate && appliedRange?.endDate) {
          try {
            const s = new Date(`${appliedRange.startDate}T00:00:00+08:00`).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
            });
            const e = new Date(`${appliedRange.endDate}T00:00:00+08:00`).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
            });
            return `${s} – ${e}`;
          } catch {
            return `${appliedRange.startDate} – ${appliedRange.endDate}`;
          }
        }
        return "Rentang kustom";
      case "ALL":
      default:
        return "Semua tanggal";
    }
  }, [activePreset, appliedRange]);

  const handleApplyPreset = (preset: PresetKey) => {
    setValidationError(null);

    if (preset === "ALL") {
      setStartDate("");
      setEndDate("");
      setAppliedRange(null);
      setShowCustomInputs(false);
      onApplyFilter(null);
      setIsOpen(false);
      return;
    }

    if (preset === "CUSTOM") {
      setShowCustomInputs(true);
      return;
    }

    setShowCustomInputs(false);
    const todayStr = getWitaDateString();
    let sDate = todayStr;
    let eDate = todayStr;

    if (preset === "TODAY") {
      sDate = todayStr;
      eDate = todayStr;
    } else if (preset === "7D") {
      sDate = getWitaDaysAgoString(7);
      eDate = todayStr;
    } else if (preset === "30D") {
      sDate = getWitaDaysAgoString(30);
      eDate = todayStr;
    } else if (preset === "MONTH") {
      sDate = getWitaStartOfMonthString();
      eDate = todayStr;
    }

    setStartDate(sDate);
    setEndDate(eDate);

    const range: DateRange = {
      startDate: sDate,
      endDate: eDate,
      startMs: getWitaStartOfDay(sDate),
      endMs: getWitaEndOfDay(eDate),
    };

    setAppliedRange(range);
    onApplyFilter(range);
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    setValidationError(null);

    if ((startDate && !endDate) || (!startDate && endDate)) {
      setValidationError("Lengkapi tanggal mulai dan tanggal akhir.");
      return;
    }

    if (!startDate && !endDate) {
      handleReset();
      return;
    }

    const startMs = getWitaStartOfDay(startDate);
    const endMs = getWitaEndOfDay(endDate);

    if (startMs > endMs) {
      setValidationError("Tanggal mulai tidak boleh melebihi tanggal akhir.");
      return;
    }

    const range: DateRange = {
      startDate,
      endDate,
      startMs,
      endMs,
    };

    setAppliedRange(range);
    onApplyFilter(range);
    setIsOpen(false);
  };

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setValidationError(null);
    setAppliedRange(null);
    setShowCustomInputs(false);
    onApplyFilter(null);
    setIsOpen(false);
  };

  const isFilterActive = Boolean(appliedRange && appliedRange.startDate && appliedRange.endDate);

  const presets: { key: PresetKey; label: string }[] = [
    { key: "ALL", label: "Semua tanggal" },
    { key: "TODAY", label: "Hari ini" },
    { key: "7D", label: "7 hari terakhir" },
    { key: "30D", label: "30 hari terakhir" },
    { key: "MONTH", label: "Bulan ini" },
    { key: "CUSTOM", label: "Rentang kustom" },
  ];

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
          <Calendar />
          <span className="truncate max-w-[160px] font-normal">{activeLabel}</span>
          <ChevronDown className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align={align === "right" ? "end" : "start"} className="w-80 p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b">
            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Calendar className="size-3.5 text-muted-foreground" />
              <span>{label}</span>
            </span>
            {isFilterActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
              >
                <RotateCcw />
                <span>Reset</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {presets.map((p) => {
              const isSelected = activePreset === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handleApplyPreset(p.key)}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer",
                    isSelected
                      ? "bg-accent font-medium text-accent-foreground"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <span>{p.label}</span>
                  {isSelected && <Check className="size-3.5 text-foreground" />}
                </button>
              );
            })}
          </div>

          {(showCustomInputs || activePreset === "CUSTOM") && (
            <div className="pt-2 border-t flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="customStart" className="text-xs text-muted-foreground">Mulai</Label>
                  <Input
                    id="customStart"
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setValidationError(null);
                    }}
                    className="text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="customEnd" className="text-xs text-muted-foreground">Selesai</Label>
                  <Input
                    id="customEnd"
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setValidationError(null);
                    }}
                    className="text-xs"
                  />
                </div>
              </div>

              {validationError && (
                <p className="text-xs text-destructive">
                  {validationError}
                </p>
              )}

              <Button
                type="button"
                size="sm"
                onClick={handleApplyCustom}
                className="w-full"
              >
                Terapkan
              </Button>
            </div>
          )}

          {isFilterActive && (
            <div className="pt-2 border-t flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3 text-muted-foreground" />
              <span className="truncate font-mono tabular-nums">
                WITA: {appliedRange!.startDate} s/d {appliedRange!.endDate}
              </span>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {isFilterActive && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleReset}
          aria-label="Hapus filter tanggal"
          title="Hapus filter tanggal"
        >
          <X />
        </Button>
      )}
    </div>
  );
}
