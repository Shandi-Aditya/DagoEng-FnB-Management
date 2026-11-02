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
  maxResults?: number;
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
  maxResults = 6,
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

  // Filter events based on input keyword and cap at maxResults (default 6 items)
  const { displayedEvents, totalMatches, hasMore } = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const matches = !q
      ? events
      : events.filter((e) => {
          const titleMatch = (e.title || "").toLowerCase().includes(q);
          const orgMatch = (e.organizerName || "").toLowerCase().includes(q);
          const locMatch = (e.location || "").toLowerCase().includes(q);
          const catMatch = (e.category || "").toLowerCase().includes(q);
          return titleMatch || orgMatch || locMatch || catMatch;
        });

    return {
      displayedEvents: matches.slice(0, maxResults),
      totalMatches: matches.length,
      hasMore: matches.length > maxResults,
    };
  }, [events, searchTerm, maxResults]);

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
            ? "border-[#3B7A57] ring-2 ring-[#3B7A57]/20 bg-slate-50/90 dark:bg-slate-800/90 shadow-sm"
            : "border-slate-200 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600"
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
          className="w-full bg-transparent border-0 border-none text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-0 shadow-none"
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
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl py-1.5 animate-in fade-in zoom-in-95 duration-100">
          {/* Option: Semua Event */}
          {allowAllOption && (
            <div
              className={`px-3 py-2 text-xs font-bold cursor-pointer flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors border-b border-slate-100 dark:border-slate-700 ${
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

          {/* Filtered Event List capped at maxResults */}
          {displayedEvents.length > 0 ? (
            <>
              {displayedEvents.map((evt) => {
                const isSelected = selectedEventId === evt.id;
                const now = Date.now();
                const startMs = evt.startDate ? new Date(evt.startDate).getTime() : 0;
                const endMs = evt.endDate ? new Date(evt.endDate).getTime() : startMs;
                const isOngoing = startMs <= now && endMs >= now;
                const isPast = endMs < now;

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
                    className={`px-3 py-2.5 text-xs cursor-pointer flex items-start justify-between hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors border-b border-slate-100 dark:border-slate-700/60 last:border-0 ${
                      isSelected
                        ? "bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-light"
                        : "text-slate-800 dark:text-slate-200"
                    }`}
                    onClick={() => handleSelect(evt.id, evt)}
                  >
                    <div className="space-y-1 min-w-0 pr-2 flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-bold truncate text-slate-900 dark:text-slate-100 flex-1">
                          {evt.title}
                        </p>
                        {isOngoing ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                            Hari Ini
                          </span>
                        ) : isPast ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400 shrink-0">
                            Selesai
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                            Mendatang
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center space-x-1 shrink-0">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{dateFormatted}</span>
                        </span>
                        {evt.location && (
                          <span className="flex items-center space-x-1 truncate max-w-[140px]">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{evt.location}</span>
                          </span>
                        )}
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {evt.category || "EVENT"}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-primary shrink-0 mt-0.5 ml-1" />}
                  </div>
                );
              })}

              {/* Informative footer when there are more matching events */}
              {hasMore && (
                <div className="px-3 py-2 bg-slate-50/80 dark:bg-slate-700/50 border-t border-slate-100 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 text-center font-medium">
                  Menampilkan {displayedEvents.length} dari {totalMatches} event • Ketik judul untuk mencari lebih spesifik
                </div>
              )}
            </>
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
