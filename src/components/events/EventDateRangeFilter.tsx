
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Calendar, AlertCircle, RotateCcw, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

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
}

/**
 * Calculates date string (YYYY-MM-DD) in WITA timezone (Asia/Makassar, UTC+8).
 */
export function getWitaDateString(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(date);
  } catch {
    // Fallback if Intl timeZone unavailable
    const tzOffset = 8 * 60; // WITA is UTC+8
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const witaDate = new Date(utc + tzOffset * 60000);
    return witaDate.toISOString().slice(0, 10);
  }
}

/**
 * Calculates date string (YYYY-MM-DD) in WITA for N days ago.
 */
export function getWitaDaysAgoString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return getWitaDateString(d);
}

/**
 * Calculates start of month (YYYY-MM-01) in WITA timezone.
 */
export function getWitaStartOfMonthString(): string {
  const todayStr = getWitaDateString();
  const [year, month] = todayStr.split("-");
  return `${year}-${month}-01`;
}

/**
 * Calculates start-of-day timestamp in WITA timezone (UTC+8).
 */
export function getWitaStartOfDay(dateStr: string): number {
  if (!dateStr) return 0;
  return new Date(`${dateStr}T00:00:00.000+08:00`).getTime();
}

/**
 * Calculates end-of-day timestamp in WITA timezone (UTC+8) to prevent missing end-of-day records.
 */
export function getWitaEndOfDay(dateStr: string): number {
  if (!dateStr) return Number.MAX_SAFE_INTEGER;
  return new Date(`${dateStr}T23:59:59.999+08:00`).getTime();
}

/**
 * Helper: checks if event execution interval intersects with the filtered period.
 */
export function isEventInWitaPeriod(
  event: { startDate: string; endDate: string },
  range?: DateRange | null
): boolean {
  if (!range || !range.startDate || !range.endDate) return true;
  const startMs = range.startMs ?? getWitaStartOfDay(range.startDate);
  const endMs = range.endMs ?? getWitaEndOfDay(range.endDate);

  const eventStart = new Date(event.startDate).getTime();
  const eventEnd = new Date(event.endDate).getTime();

  // Event intersects if event starts before period ends AND event ends after period starts
  return eventStart <= endMs && eventEnd >= startMs;
}

/**
 * Helper: checks if booking/transaction timestamp falls within the filtered period.
 */
export function isTimestampInWitaPeriod(
  timestamp: string | number | undefined | null,
  range?: DateRange | null
): boolean {
  if (!range || !range.startDate || !range.endDate) return true;
  if (!timestamp) return false;

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
  label = "Filter Periode",
}: EventDateRangeFilterProps) {
  const [startDate, setStartDate] = useState(initialRange?.startDate || "");
  const [endDate, setEndDate] = useState(initialRange?.endDate || "");
  const [appliedRange, setAppliedRange] = useState<DateRange | null>(initialRange);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showCustomInputs, setShowCustomInputs] = useState(false);

  // Sync with initialRange changes
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

  // Determine active preset
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

  const handleApplyPreset = (preset: PresetKey) => {
    setValidationError(null);

    if (preset === "ALL") {
      setStartDate("");
      setEndDate("");
      setAppliedRange(null);
      setShowCustomInputs(false);
      onApplyFilter(null);
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
  };

  const handleApplyCustom = () => {
    setValidationError(null);

    if ((startDate && !endDate) || (!startDate && endDate)) {
      setValidationError("Harap lengkapi tanggal mulai dan tanggal akhir.");
      return;
    }

    if (!startDate && !endDate) {
      handleReset();
      return;
    }

    const startMs = getWitaStartOfDay(startDate);
    const endMs = getWitaEndOfDay(endDate);

    if (startMs > endMs) {
      setValidationError("Tanggal mulai tidak boleh lebih besar daripada tanggal akhir.");
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
  };

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setValidationError(null);
    setAppliedRange(null);
    setShowCustomInputs(false);
    onApplyFilter(null);
  };

  const isFilterActive = Boolean(appliedRange && appliedRange.startDate && appliedRange.endDate);

  const presets: { key: PresetKey; label: string }[] = [
    { key: "ALL", label: "Semua Waktu" },
    { key: "TODAY", label: "Hari Ini" },
    { key: "7D", label: "7 Hari" },
    { key: "30D", label: "30 Hari" },
    { key: "MONTH", label: "Bulan Ini" },
    { key: "CUSTOM", label: "Kustom" },
  ];

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Preset Buttons & Label */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center space-x-1.5 shrink-0 mr-1">
          <Calendar className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
          <span>{label}:</span>
        </span>

        {presets.map((p) => {
          const isActive = activePreset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => handleApplyPreset(p.key)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${isActive
                ? "bg-[#3B7A57] text-white shadow-xs"
                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#3B7A57]/50 hover:text-slate-900 dark:hover:text-white"
                }`}
            >
              {p.label}
            </button>
          );
        })}

        {isFilterActive && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 text-xs font-semibold px-2 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
            title="Reset ke Semua Waktu"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
        )}
      </div>

      {/* Custom Inputs Panel (if custom preset chosen or user wants custom dates) */}
      {(showCustomInputs || activePreset === "CUSTOM") && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 animate-in fade-in">
          <span className="text-[11px] text-slate-500 font-medium">Rentang:</span>
          {/* Input Start Date */}
          <div className="relative">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setValidationError(null);
              }}
              aria-label="Tanggal Mulai"
              className="text-xs font-medium py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#3B7A57]"
            />
          </div>

          <span className="text-xs text-slate-400">s/d</span>

          {/* Input End Date */}
          <div className="relative">
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setValidationError(null);
              }}
              aria-label="Tanggal Akhir"
              className="text-xs font-medium py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#3B7A57]"
            />
          </div>

          {/* Apply Button */}
          <Button
            type="button"
            size="sm"
            onClick={handleApplyCustom}
            className="h-7 text-xs font-semibold px-2.5 bg-[#3B7A57] hover:bg-[#2E6044] text-white rounded-lg shadow-xs cursor-pointer"
          >
            <Check className="w-3 h-3 mr-1" />
            Terapkan
          </Button>
        </div>
      )}

      {/* Validation Warning Alert */}
      {validationError && (
        <div className="flex items-center space-x-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-3 py-1.5 rounded-lg animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Active Period Indicator */}
      {isFilterActive && !validationError && (
        <div className="flex items-center space-x-2 text-[11px] font-semibold text-[#3B7A57] dark:text-[#52B788] bg-[#3B7A57]/5 dark:bg-[#3B7A57]/10 border border-[#3B7A57]/20 px-2.5 py-0.5 rounded-lg w-fit">
          <Clock className="w-3 h-3" />
          <span>
            Periode Aktif:{" "}
            {new Date(`${appliedRange!.startDate}T00:00:00+08:00`).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            —{" "}
            {new Date(`${appliedRange!.endDate}T23:59:59+08:00`).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            (WITA Asia/Makassar)
          </span>
        </div>
      )}
    </div>
  );
}
