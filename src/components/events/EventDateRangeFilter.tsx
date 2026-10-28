"use client";

import React, { useState, useEffect } from "react";
import { Calendar, AlertCircle, RotateCcw, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startMs?: number; // WITA 00:00:00
  endMs?: number; // WITA 23:59:59.999
}

export interface EventDateRangeFilterProps {
  onApplyFilter: (range: DateRange | null) => void;
  initialRange?: DateRange | null;
  className?: string;
  label?: string;
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
  timestamp: string | number,
  range?: DateRange | null
): boolean {
  if (!range || !range.startDate || !range.endDate) return true;
  const startMs = range.startMs ?? getWitaStartOfDay(range.startDate);
  const endMs = range.endMs ?? getWitaEndOfDay(range.endDate);

  const targetMs = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp;
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

  // Sync with initialRange changes
  useEffect(() => {
    if (initialRange) {
      setStartDate(initialRange.startDate);
      setEndDate(initialRange.endDate);
      setAppliedRange(initialRange);
    }
  }, [initialRange]);

  const handleApply = () => {
    setValidationError(null);

    // Validation: both dates must be supplied if one is supplied
    if ((startDate && !endDate) || (!startDate && endDate)) {
      setValidationError("Harap lengkapi tanggal mulai dan tanggal akhir.");
      return;
    }

    if (!startDate && !endDate) {
      handleReset();
      return;
    }

    // Validation: startDate <= endDate
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
    onApplyFilter(null);
  };

  const isFilterActive = Boolean(appliedRange && appliedRange.startDate && appliedRange.endDate);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Label */}
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center space-x-1.5 shrink-0">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          <span>{label}:</span>
        </span>

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
            className="text-xs font-medium py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
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
            className="text-xs font-medium py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Apply Button */}
        <Button
          type="button"
          size="sm"
          onClick={handleApply}
          className="h-8 text-xs font-semibold px-3 bg-primary hover:bg-primary/90 text-white rounded-lg shadow-xs"
        >
          <Check className="w-3.5 h-3.5 mr-1" />
          Terapkan Filter
        </Button>

        {/* Reset Button */}
        {isFilterActive && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-8 text-xs font-semibold px-2.5 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg"
            title="Kembalikan ke Semua Periode"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
        )}
      </div>

      {/* Validation Warning Alert */}
      {validationError && (
        <div className="flex items-center space-x-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-3 py-1.5 rounded-lg animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Active Period Indicator */}
      {isFilterActive && !validationError && (
        <div className="flex items-center space-x-2 text-[11px] font-semibold text-primary dark:text-primary-light bg-primary/5 dark:bg-primary/10 border border-primary/20 px-3 py-1 rounded-lg w-fit">
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
            (WITA)
          </span>
        </div>
      )}
    </div>
  );
}
