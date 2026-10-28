"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, Calendar, MapPin, Check, ChevronDown, Sparkles } from "lucide-react";
import { CommunityEvent } from "@/types/event";

export interface EventSearchInputProps {
  events: CommunityEvent[];
  selectedEventId: string; // "ALL" or specific event ID
  onSelectEvent: (eventId: string, event: CommunityEvent | null) => void;
  placeholder?: string;
  className?: string;
  allowAllOption?: boolean;
  allOptionLabel?: string;
  disabled?: boolean;
}

export function EventSearchInput({
  events = [],
  selectedEventId = "ALL",
  onSelectEvent,
  placeholder = "Cari nama event...",
  className = "",
  allowAllOption = true,
  allOptionLabel = "Semua Event",
  disabled = false,
}: EventSearchInputProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Identify currently selected event from system records
  const selectedEvent = useMemo(() => {
    if (selectedEventId === "ALL" || !selectedEventId) return null;
    return events.find((e) => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // Click-outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter events based on input keyword (debounced / responsive search)
  const filteredEvents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return events.slice(0, 15);
    return events
      .filter((e) => {
        const titleMatch = (e.title || "").toLowerCase().includes(q);
        const orgMatch = (e.organizerName || "").toLowerCase().includes(q);
        const locMatch = (e.location || "").toLowerCase().includes(q);
        const catMatch = (e.category || "").toLowerCase().includes(q);
        return titleMatch || orgMatch || locMatch || catMatch;
      })
      .slice(0, 15);
  }, [events, searchTerm]);

  const handleSelect = (eventId: string, event: CommunityEvent | null) => {
    onSelectEvent(eventId, event);
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectEvent("ALL", null);
    setSearchTerm("");
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input Trigger */}
      <div
        className={`flex items-center space-x-2 px-3 py-2 rounded-xl border transition-all ${
          disabled
            ? "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-60"
            : isOpen
            ? "border-primary ring-2 ring-primary/10 bg-white dark:bg-slate-900 shadow-sm"
            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600"
        }`}
        onClick={() => !disabled && setIsOpen(true)}
      >
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        
        <input
          type="text"
          value={isOpen ? searchTerm : selectedEvent ? selectedEvent.title : ""}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          placeholder={selectedEvent ? selectedEvent.title : placeholder}
          disabled={disabled}
          className="w-full bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
        />

        {/* Clear Button */}
        {selectedEventId !== "ALL" && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="Kembalikan ke Semua Event"
            aria-label="Bersihkan pilihan event"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </div>

      {/* Selectable Results Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1.5 animate-in fade-in zoom-in-95 duration-100">
          {/* Option: Semua Event */}
          {allowAllOption && (
            <div
              className={`px-3 py-2 text-xs font-bold cursor-pointer flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors border-b border-slate-100 dark:border-slate-800 ${
                selectedEventId === "ALL"
                  ? "text-primary dark:text-primary-light bg-primary/5 dark:bg-primary/10"
                  : "text-slate-700 dark:text-slate-300"
              }`}
              onClick={() => handleSelect("ALL", null)}
            >
              <div className="flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>{allOptionLabel} ({events.length} Event)</span>
              </div>
              {selectedEventId === "ALL" && <Check className="w-3.5 h-3.5 text-primary" />}
            </div>
          )}

          {/* Filtered Event List */}
          {filteredEvents.length > 0 ? (
            filteredEvents.map((evt) => {
              const isSelected = selectedEventId === evt.id;
              const dateFormatted = evt.startDate
                ? new Date(evt.startDate).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "-";

              return (
                <div
                  key={evt.id}
                  className={`px-3 py-2.5 text-xs cursor-pointer flex items-start justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors border-b border-slate-50 dark:border-slate-800/40 last:border-0 ${
                    isSelected
                      ? "bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-light"
                      : "text-slate-800 dark:text-slate-200"
                  }`}
                  onClick={() => handleSelect(evt.id, evt)}
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <p className="font-bold truncate text-slate-900 dark:text-slate-100">
                      {evt.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{dateFormatted}</span>
                      </span>
                      {evt.location && (
                        <span className="flex items-center space-x-1 truncate max-w-[150px]">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span className="truncate">{evt.location}</span>
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                          evt.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                            : evt.status === "PENDING"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {evt.status}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                </div>
              );
            })
          ) : (
            <div className="px-4 py-4 text-center text-xs text-slate-400">
              <Search className="w-6 h-6 mx-auto mb-1 text-slate-300 dark:text-slate-600" />
              <p className="font-medium text-slate-600 dark:text-slate-300">
                Event tidak ditemukan
              </p>
              <p className="text-[10px] text-slate-400">
                Tidak ada event yang cocok dengan &quot;{searchTerm}&quot;
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
