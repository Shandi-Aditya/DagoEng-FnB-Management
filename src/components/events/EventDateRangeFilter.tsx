"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Calendar, AlertCircle, RotateCcw, Check, Clock, ChevronDown, X } from "lucide-react";
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
  align?: "left" | "right";
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
  align = "left",
}: EventDateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  const activeLabel = useMemo(() => {
    switch (activePreset) {
      case "TODAY":
        return "Hari Ini (WITA)";
      case "7D":
        return "7 Hari Terakhir";
      case "30D":
        return "30 Hari Terakhir";
      case "MONTH":
        return "Bulan Ini";
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
            return `${s} - ${e}`;
          } catch {
            return `${appliedRange.startDate} - ${appliedRange.endDate}`;
          }
        }
        return "Kustom";
      case "ALL":
      default:
        return "Semua Waktu";
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
      setValidationError("Tanggal mulai tidak boleh lebih besar dari tanggal akhir.");
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
    { key: "ALL", label: "Semua Waktu" },
    { key: "TODAY", label: "Hari Ini" },
    { key: "7D", label: "7 Hari Terakhir" },
    { key: "30D", label: "30 Hari Terakhir" },
    { key: "MONTH", label: "Bulan Ini" },
    { key: "CUSTOM", label: "Kustom Rentang" },
  ];

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Dropdown Trigger Button */}
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-xs cursor-pointer ${
            isFilterActive
              ? "bg-[#3B7A57]/10 dark:bg-[#3B7A57]/20 border-[#3B7A57] text-[#3B7A57] dark:text-[#52B788]"
              : "bg-white dark:bg-[#1E293B] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
          }`}
          title="Filter rentang tanggal pelaksanaan event (WITA)"
        >
          <Calendar className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788] shrink-0" />
          <span className="truncate max-w-[140px] sm:max-w-[180px]">{activeLabel}</span>
          {isFilterActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B7A57] dark:bg-[#52B788] shrink-0" />
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isFilterActive && (
          <button
            type="button"
            onClick={handleReset}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            title="Reset Filter Tanggal"
            aria-label="Reset filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className={`absolute top-full mt-1.5 z-50 w-72 sm:w-80 bg-white dark:bg-[#1E293B] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-100 ${
              align === "right" ? "right-0 left-auto" : "left-0 right-auto"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
                <span className="truncate">{label}</span>
              </span>
              {isFilterActive && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 gap-1.5">
              {presets.map((p) => {
                const isSelected = activePreset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleApplyPreset(p.key)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? "bg-[#3B7A57] text-white shadow-xs font-bold"
                        : "bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span>{p.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Custom Range Section */}
            {(showCustomInputs || activePreset === "CUSTOM") && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 animate-in fade-in">
                <div className="text-[11px] font-semibold text-slate-500">Rentang Tanggal (WITA):</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Mulai</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setValidationError(null);
                      }}
                      className="w-full text-xs font-medium py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#3B7A57]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Selesai</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setValidationError(null);
                      }}
                      className="w-full text-xs font-medium py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#3B7A57]"
                    />
                  </div>
                </div>

                {validationError && (
                  <div className="flex items-center space-x-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-2 py-1 rounded-lg">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}

                <Button
                  type="button"
                  size="sm"
                  onClick={handleApplyCustom}
                  className="w-full h-8 text-xs font-semibold bg-[#3B7A57] hover:bg-[#2E6044] text-white rounded-xl shadow-xs cursor-pointer mt-1"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Terapkan Filter
                </Button>
              </div>
            )}

            {/* Active Period Note */}
            {isFilterActive && !validationError && (
              <div className="flex items-center space-x-1.5 text-[10px] text-[#3B7A57] dark:text-[#52B788] bg-[#3B7A57]/5 dark:bg-[#3B7A57]/10 p-2 rounded-lg">
                <Clock className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  WITA (Asia/Makassar): {appliedRange!.startDate} s/d {appliedRange!.endDate}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
