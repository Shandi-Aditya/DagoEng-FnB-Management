"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type DateShortcut = "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "THIS_MONTH" | "CUSTOM";

export interface DateFilterContextType {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  shortcut: DateShortcut;
  setShortcut: (shortcut: DateShortcut) => void;
  setCustomRange: (start: string, end: string) => void;
  formattedRangeLabel: string;
  previousPeriodLabel: string;
  isDateInRange: (dateStr: string) => boolean;
}

const WITA_TIMEZONE = "Asia/Makassar";

const SHORT_MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_INDEX_BY_NAME: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  mei: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  agu: "08",
  sep: "09",
  oct: "10",
  okt: "10",
  nov: "11",
  dec: "12",
  des: "12",
};

const WITA_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: WITA_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

interface WitaDateTimeParts {
  year: string;
  month: string;
  day: string;
  hour: number;
  minute: number;
  second: number;
}

function parseUnzonedWitaTimestamp(raw: string): WitaDateTimeParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/.exec(raw);
  if (!match) return null;
  return {
    year: match[1],
    month: match[2],
    day: match[3],
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
}

function extractWitaParts(isoOrDate: string | Date): WitaDateTimeParts | null {
  if (isoOrDate instanceof Date) {
    if (Number.isNaN(isoOrDate.getTime())) return null;
    const partMap = new Map<string, string>();
    for (const part of WITA_PARTS_FORMATTER.formatToParts(isoOrDate)) {
      if (part.type !== "literal") partMap.set(part.type, part.value);
    }
    return {
      year: partMap.get("year") ?? "1970",
      month: partMap.get("month") ?? "01",
      day: partMap.get("day") ?? "01",
      hour: Number(partMap.get("hour") ?? 0),
      minute: Number(partMap.get("minute") ?? 0),
      second: Number(partMap.get("second") ?? 0),
    };
  }

  if (typeof isoOrDate !== "string") return null;
  const raw = isoOrDate.trim();
  if (!raw) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnlyMatch) {
    return {
      year: dateOnlyMatch[1],
      month: dateOnlyMatch[2],
      day: dateOnlyMatch[3],
      hour: 0,
      minute: 0,
      second: 0,
    };
  }

  const unzonedWita = parseUnzonedWitaTimestamp(raw);
  if (unzonedWita) return unzonedWita;

  const dmyMatch = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(raw);
  if (dmyMatch) {
    const month = MONTH_INDEX_BY_NAME[dmyMatch[2].toLowerCase()];
    if (month) {
      return {
        year: dmyMatch[3],
        month,
        day: dmyMatch[1].padStart(2, "0"),
        hour: 0,
        minute: 0,
        second: 0,
      };
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return extractWitaParts(parsed);
}

export function getTodayWitaDateString(now: Date = new Date()): string {
  const safeNow = Number.isNaN(now.getTime()) ? new Date() : now;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WITA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(safeNow);
}

export function toWitaDateKey(isoOrDate: string | Date): string {
  const parts = extractWitaParts(isoOrDate);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : "";
}

export function getWitaHour(isoOrDate: string | Date): number | null {
  const parts = extractWitaParts(isoOrDate);
  return parts ? parts.hour : null;
}

/** Formats a date or timestamp in WITA using dd, MM, MMM, yyyy, HH, mm, ss tokens. */
export function formatWitaDateTime(
  isoOrDate: string | Date,
  pattern: string = "dd/MM/yyyy HH:mm"
): string {
  const parts = extractWitaParts(isoOrDate);
  if (!parts) return "";
  const monthIdx = Math.max(0, Math.min(11, Number(parts.month) - 1));
  const tokens: Record<string, string> = {
    yyyy: parts.year,
    MMM: SHORT_MONTH_LABELS[monthIdx] ?? parts.month,
    MM: parts.month,
    dd: parts.day,
    HH: String(parts.hour).padStart(2, "0"),
    mm: String(parts.minute).padStart(2, "0"),
    ss: String(parts.second).padStart(2, "0"),
  };
  return pattern.replace(/yyyy|MMM|MM|dd|HH|mm|ss/g, (token) => tokens[token] ?? token);
}

function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

function diffDaysInclusive(startKey: string, endKey: string): number {
  const [sy, sm, sd] = startKey.split("-").map(Number);
  const [ey, em, ed] = endKey.split("-").map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return 1;
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  return Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1);
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined);

export function DateFilterProvider({ children }: { children: React.ReactNode }) {
  const todayStr = useMemo(() => getTodayWitaDateString(), []);

  const [shortcut, setShortcutState] = useState<DateShortcut>("THIS_MONTH");
  const [startDate, setStartDate] = useState<string>(() => `${todayStr.slice(0, 8)}01`);
  const [endDate, setEndDate] = useState<string>(todayStr);

  const setShortcut = useCallback((sc: DateShortcut) => {
    setShortcutState(sc);
    const currToday = getTodayWitaDateString();

    switch (sc) {
      case "TODAY":
        setStartDate(currToday);
        setEndDate(currToday);
        break;
      case "YESTERDAY": {
        const yest = addDaysToDateKey(currToday, -1);
        setStartDate(yest);
        setEndDate(yest);
        break;
      }
      case "LAST_7_DAYS": {
        const d7 = addDaysToDateKey(currToday, -6);
        setStartDate(d7);
        setEndDate(currToday);
        break;
      }
      case "THIS_MONTH": {
        setStartDate(`${currToday.slice(0, 8)}01`);
        setEndDate(currToday);
        break;
      }
      case "CUSTOM":
        break;
    }
  }, []);

  const setCustomRange = useCallback((start: string, end: string) => {
    setShortcutState("CUSTOM");
    setStartDate(start);
    setEndDate(end);
  }, []);

  const formattedRangeLabel = useMemo(() => {
    if (startDate === endDate) {
      return formatWitaDateTime(startDate, "dd MMM yyyy");
    }
    return `${formatWitaDateTime(startDate, "dd MMM")} - ${formatWitaDateTime(endDate, "dd MMM yyyy")}`;
  }, [startDate, endDate]);

  const previousPeriodLabel = useMemo(() => {
    const diffDays = diffDaysInclusive(startDate, endDate);
    const prevEnd = addDaysToDateKey(startDate, -1);
    const prevStart = addDaysToDateKey(prevEnd, -(diffDays - 1));
    return `${formatWitaDateTime(prevStart, "dd MMM")} - ${formatWitaDateTime(prevEnd, "dd MMM")}`;
  }, [startDate, endDate]);

  const isDateInRange = useCallback(
    (dateStr: string): boolean => {
      const dKey = toWitaDateKey(dateStr);
      return Boolean(dKey) && dKey >= startDate && dKey <= endDate;
    },
    [startDate, endDate]
  );

  return (
    <DateFilterContext.Provider
      value={{
        startDate,
        endDate,
        shortcut,
        setShortcut,
        setCustomRange,
        formattedRangeLabel,
        previousPeriodLabel,
        isDateInRange,
      }}
    >
      {children}
    </DateFilterContext.Provider>
  );
}

export function useDateFilter() {
  const context = useContext(DateFilterContext);
  if (!context) throw new Error("useDateFilter must be used within a DateFilterProvider");
  return context;
}
