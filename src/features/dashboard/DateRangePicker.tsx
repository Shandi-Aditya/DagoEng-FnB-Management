"use client";

import React, { useState } from "react";
import { useDateFilter, DateShortcut } from "@/contexts/DateFilterContext";
import { Calendar, ChevronDown, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const SHORTCUTS: { key: DateShortcut; label: string }[] = [
  { key: "TODAY", label: "Hari Ini (14 Sep)" },
  { key: "YESTERDAY", label: "Kemarin (13 Sep)" },
  { key: "LAST_7_DAYS", label: "7 Hari Terakhir" },
  { key: "THIS_MONTH", label: "Bulan Ini (Sep 2026)" },
  { key: "CUSTOM", label: "Custom Range..." },
];

export function DateRangePicker() {
  const {
    startDate,
    endDate,
    shortcut,
    setShortcut,
    setCustomRange,
    formattedRangeLabel,
  } = useDateFilter();

  const [isOpen, setIsOpen] = useState(false);
  const [customStart, setCustomStart] = useState(startDate);
  const [customEnd, setCustomEnd] = useState(endDate);

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomRange(customStart, customEnd);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm transition-colors"
      >
        <Calendar className="w-3.5 h-3.5 text-brand-orange" />
        <span>{formattedRangeLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-80 bg-white rounded-xl shadow-dropdown border border-slate-200 p-3 z-50 text-slate-900 animate-in fade-in zoom-in-95 duration-100 space-y-3">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5">
              Pilih Rentang Tanggal Analisis
            </div>

            {/* Quick Shortcuts */}
            <div className="grid grid-cols-2 gap-1.5">
              {SHORTCUTS.map((sc) => {
                const isSelected = shortcut === sc.key;
                return (
                  <button
                    key={sc.key}
                    onClick={() => {
                      setShortcut(sc.key);
                      if (sc.key !== "CUSTOM") setIsOpen(false);
                    }}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold text-left transition-colors flex items-center justify-between ${
                      isSelected
                        ? "bg-brand-orange text-white"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    <span>{sc.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>

            {/* Custom Range Input */}
            <form onSubmit={handleApplyCustom} className="pt-2 border-t border-slate-100 space-y-2">
              <div className="text-[11px] font-bold text-slate-600">Atur Tanggal Spesifik (Custom)</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 font-medium">Mulai (Start Date)</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full mt-0.5 px-2 py-1 border border-slate-200 rounded text-xs text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-medium">Sampai (End Date)</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full mt-0.5 px-2 py-1 border border-slate-200 rounded text-xs text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button type="submit" size="sm" className="h-7 text-xs px-3">
                  <span>Terapkan Filter</span>
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
