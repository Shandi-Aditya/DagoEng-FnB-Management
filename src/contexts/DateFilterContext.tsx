"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import {
  WITA_TIMEZONE,
  SHORT_MONTH_LABELS,
  MONTH_INDEX_BY_NAME,
  type WitaDateTimeParts,
  parseUnzonedWitaTimestamp,
  extractWitaParts,
  getTodayWitaDateString,
  toWitaDateKey,
  getWitaHour,
  formatWitaDateTime,
  normalizeDateRange,
  addDaysToDateKey,
  diffDaysInclusive,
} from "@/lib/date-utils";

export {
  WITA_TIMEZONE,
  SHORT_MONTH_LABELS,
  MONTH_INDEX_BY_NAME,
  type WitaDateTimeParts,
  parseUnzonedWitaTimestamp,
  extractWitaParts,
  getTodayWitaDateString,
  toWitaDateKey,
  getWitaHour,
  formatWitaDateTime,
  normalizeDateRange,
  addDaysToDateKey,
  diffDaysInclusive,
};

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
    const normalized = normalizeDateRange(start, end, getTodayWitaDateString());
    setShortcutState("CUSTOM");
    setStartDate(normalized.startDate);
    setEndDate(normalized.endDate);
  }, []);

  const formattedRangeLabel = useMemo(() => {
    if (startDate === endDate) {
      return formatWitaDateTime(startDate, "dd MMM yyyy");
    }
    if (startDate.slice(0, 4) !== endDate.slice(0, 4)) {
      return `${formatWitaDateTime(startDate, "dd MMM yyyy")} - ${formatWitaDateTime(endDate, "dd MMM yyyy")}`;
    }
    return `${formatWitaDateTime(startDate, "dd MMM")} - ${formatWitaDateTime(endDate, "dd MMM yyyy")}`;
  }, [startDate, endDate]);

  const previousPeriodLabel = useMemo(() => {
    const diffDays = diffDaysInclusive(startDate, endDate);
    const prevEnd = addDaysToDateKey(startDate, -1);
    const prevStart = addDaysToDateKey(prevEnd, -(diffDays - 1));
    if (prevStart === prevEnd) {
      return formatWitaDateTime(prevStart, "dd MMM yyyy");
    }
    return `${formatWitaDateTime(prevStart, "dd MMM")} - ${formatWitaDateTime(prevEnd, "dd MMM yyyy")}`;
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
