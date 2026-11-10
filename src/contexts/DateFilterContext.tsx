"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";

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
  const todayStr = useMemo(() => {
    try {
      return format(new Date(), "yyyy-MM-dd");
    } catch {
      return "2026-09-16";
    }
  }, []);

  const [shortcut, setShortcutState] = useState<DateShortcut>("THIS_MONTH");
  const [startDate, setStartDate] = useState<string>("2026-09-01");
  const [endDate, setEndDate] = useState<string>(todayStr);

  const setShortcut = (sc: DateShortcut) => {
    setShortcutState(sc);
    const now = new Date();
    const currToday = format(now, "yyyy-MM-dd");

    switch (sc) {
      case "TODAY":
        setStartDate(currToday);
        setEndDate(currToday);
        break;
      case "YESTERDAY": {
        const yest = format(subDays(now, 1), "yyyy-MM-dd");
        setStartDate(yest);
        setEndDate(yest);
        break;
      }
      case "LAST_7_DAYS": {
        const d7 = format(subDays(now, 7), "yyyy-MM-dd");
        setStartDate(d7);
        setEndDate(currToday);
        break;
      }
      case "THIS_MONTH": {
        setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
        setEndDate(currToday);
        break;
      }
      case "CUSTOM":
        break;
    }
  };

  const setCustomRange = (start: string, end: string) => {
    setShortcutState("CUSTOM");
    setStartDate(start);
    setEndDate(end);
  };

  const formattedRangeLabel = useMemo(() => {
    if (startDate === endDate) {
      return format(parseISO(startDate), "dd MMM yyyy");
    }
    return `${format(parseISO(startDate), "dd MMM")} - ${format(parseISO(endDate), "dd MMM yyyy")}`;
  }, [startDate, endDate]);

  const previousPeriodLabel = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const prevEnd = subDays(start, 1);
    const prevStart = subDays(prevEnd, diffDays - 1);

    return `${format(prevStart, "dd MMM")} - ${format(prevEnd, "dd MMM")}`;
  }, [startDate, endDate]);

  const isDateInRange = (dateStr: string): boolean => {
    try {
      const itemDate = parseISO(dateStr);
      const start = parseISO(startDate);
      const end = parseISO(`${endDate}T23:59:59`);
      return itemDate >= start && itemDate <= end;
    } catch {
      return true;
    }
  };

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
