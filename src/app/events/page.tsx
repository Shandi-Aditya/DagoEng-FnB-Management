"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  Filter,
  PlusCircle,
  ArrowRight,
  Sparkles,
  Ticket,
  ChevronRight,
  History,
  Tag,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { PublicCommunityEvent, EventCategory } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";

const CATEGORY_TABS: { key: string; label: string }[] = [
  { key: "ALL", label: "Semua Kategori" },
  { key: "WORKSHOP", label: "Workshop" },
  { key: "MEETUP", label: "Meetup" },
  { key: "CREATIVE", label: "Kreatif" },
  { key: "TECH", label: "Teknologi" },
  { key: "COMMUNITY", label: "Komunitas" },
  { key: "SEMINAR", label: "Seminar" },
];

export default function EventsListingPage() {
  const [events, setEvents] = useState<PublicCommunityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewTab, setViewTab] = useState<"UPCOMING" | "PAST">("UPCOMING");

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/events");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setEvents(json.data);
      }
    } catch (err) {
      console.error("Failed to load events", err);
    } finally {
      setIsLoading(false);
    }
  };

  const now = useMemo(() => new Date().getTime(), []);

  // Split into upcoming and past
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const upcoming: PublicCommunityEvent[] = [];
    const past: PublicCommunityEvent[] = [];

    events.forEach((evt) => {
      const end = new Date(evt.endDate).getTime();
      if (end < now) {
        past.push(evt);
      } else {
        upcoming.push(evt);
      }
    });

    // Upcoming: closest first
    upcoming.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    // Past: most recent first
    past.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());

    return { upcomingEvents: upcoming, pastEvents: past };
  }, [events, now]);

  // Current active pool based on tab
  const activePool = viewTab === "UPCOMING" ? upcomingEvents : pastEvents;

  // Filter by category and search
  const filteredEvents = useMemo(() => {
    return activePool.filter((evt) => {
      const matchesCategory =
        selectedCategory === "ALL" || evt.category === selectedCategory;
      const matchesSearch =
        searchQuery === "" ||
        evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.organizerName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [activePool, selectedCategory, searchQuery]);

  const formatDateDisplay = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-[#1E293B] dark:text-[#E2E8F0] transition-colors duration-200 flex flex-col justify-between">
      {/* 1. Header Navigation */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-[#0F172A]/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-8 h-8 relative transition-transform group-hover:scale-105">
                <Image
                  src="/logo-dago.png"
                  alt="DagoEng Logo"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <span className="font-black text-sm tracking-tight text-slate-900 dark:text-white">
                Dago Creative Hub <span className="text-[#3B7A57] dark:text-[#52B788]">Events</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <ThemeToggle variant="pill" />

            <Link href="/events/submit">
              <Button
                size="sm"
                className="text-xs h-9 px-4 font-bold bg-[#3B7A57] hover:bg-[#2E6044] dark:bg-[#3B7A57] dark:hover:bg-[#488e68] text-white rounded-xl shadow-sm transition-all hover:scale-105 active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                <span>Pasang Event</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="bg-gradient-to-b from-emerald-50/60 via-slate-50 to-[#F8FAFC] dark:from-emerald-950/20 dark:via-[#0F172A] dark:to-[#0F172A] border-b border-slate-200/60 dark:border-slate-800/80 py-12 sm:py-16 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-100/70 dark:bg-emerald-900/40 border border-emerald-300/50 dark:border-emerald-700/50 text-[#3B7A57] dark:text-[#52B788] text-xs font-bold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Marketplace Event & Komunitas Kreatif Singaraja</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
            Agenda & Event Komunitas Singaraja
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed mb-8">
            Temukan berbagai lokakarya kreatif, talkshow, meetup komunitas, dan agenda kolaborasi menarik dari berbagai penyelenggara di kawasan Singaraja dan sekitarnya.
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari event berdasarkan judul, lokasi, atau nama komunitas..."
              className="w-full pl-11 pr-4 py-3 text-xs sm:text-sm rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 shadow-md shadow-slate-200/50 dark:shadow-none focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100 transition-colors"
            />
          </div>
        </div>
      </section>

      {/* 3. Main Directory */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Navigation Tabs: Upcoming vs Past & Category Filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800 mb-8">
          {/* Upcoming vs Past Toggle */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewTab("UPCOMING")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewTab === "UPCOMING"
                  ? "bg-white dark:bg-[#1E293B] text-[#3B7A57] dark:text-[#52B788] shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Event Mendatang ({upcomingEvents.length})
            </button>
            <button
              onClick={() => setViewTab("PAST")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                viewTab === "PAST"
                  ? "bg-white dark:bg-[#1E293B] text-[#3B7A57] dark:text-[#52B788] shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Event Telah Berlalu ({pastEvents.length})</span>
            </button>
          </div>

          {/* Category Chips */}
          <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const active = selectedCategory === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setSelectedCategory(tab.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    active
                      ? "bg-[#3B7A57] text-white shadow-sm"
                      : "bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-96 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse"
              />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          /* EMPTY STATE */
          <div className="py-16 text-center max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">
              {viewTab === "UPCOMING"
                ? "Belum ada event mendatang yang sesuai kriteria."
                : "Belum ada arsip event yang selesai pada filter ini."}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              Punya ide lokakarya, meetup hobi, atau sesi diskusi komunitas? Ajukan event-mu sekarang tanpa dipungut biaya platform.
            </p>
            <Link href="/events/submit">
              <Button className="bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs px-5 py-2 rounded-xl">
                <PlusCircle className="w-4 h-4 mr-1.5" />
                Pasang Event Komunitas
              </Button>
            </Link>
          </div>
        ) : (
          /* EVENT GRID */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((evt) => {
              const isPast = new Date(evt.endDate).getTime() < now;
              return (
                <Card
                  key={evt.id}
                  className={`group overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-xl flex flex-col justify-between ${
                    isPast
                      ? "opacity-80 bg-slate-50/60 dark:bg-[#161F31]/60 border-slate-200 dark:border-slate-800"
                      : "bg-white dark:bg-[#1E293B] border-slate-200/90 dark:border-slate-800 hover:-translate-y-1 hover:border-[#3B7A57]/40"
                  }`}
                >
                  <div>
                    {/* Poster Image Container */}
                    <div className="relative h-48 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={evt.posterUrl}
                        alt={evt.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex items-center space-x-2">
                        <Badge className="bg-slate-900/80 backdrop-blur-md text-white border-0 text-[10px] font-bold">
                          {evt.category}
                        </Badge>
                        {isPast && (
                          <Badge variant="outline" className="bg-slate-800/90 text-slate-300 border-slate-600 text-[10px]">
                            Event Selesai
                          </Badge>
                        )}
                      </div>

                      {/* Pricing Tag */}
                      <div className="absolute top-3 right-3">
                        <span
                          className={`text-[11px] font-black px-2.5 py-1 rounded-full shadow-sm backdrop-blur-md ${
                            evt.isPaid
                              ? "bg-amber-500/90 text-white"
                              : "bg-emerald-600/90 text-white"
                          }`}
                        >
                          {evt.isPaid ? formatCurrencyIDR(evt.price) : "GRATIS"}
                        </span>
                      </div>

                      {/* Organizer Name Floating */}
                      <div className="absolute bottom-2.5 left-3 text-[11px] font-medium text-white/90 drop-shadow">
                        Oleh: <span className="font-bold">{evt.organizerName}</span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 space-y-3">
                      <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-[#3B7A57] dark:group-hover:text-[#52B788] transition-colors">
                        {evt.title}
                      </h3>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {evt.description}
                      </p>

                      <div className="pt-2 space-y-1.5 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0" />
                          <span className="font-medium truncate">{formatDateDisplay(evt.startDate)}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{evt.location}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Action */}
                  <div className="p-5 pt-0">
                    <Link href={`/events/${evt.id}`}>
                      <Button
                        variant="outline"
                        className="w-full text-xs font-bold border-slate-200 dark:border-slate-700 hover:bg-[#3B7A57] hover:text-white hover:border-[#3B7A57] dark:hover:bg-[#3B7A57] dark:hover:text-white transition-all rounded-xl justify-between group/btn"
                      >
                        <span>Lihat Detail Event</span>
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* 4. Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-[#0F172A]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Dago Creative Hub — Ekosistem Terpadu F&B, Co-Working & Komunitas.</p>
          <div className="flex items-center space-x-4">
            <Link href="/" className="hover:text-slate-800 dark:hover:text-white transition-colors">
              Beranda
            </Link>
            <Link href="/events/submit" className="hover:text-slate-800 dark:hover:text-white transition-colors">
              Pasang Event
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
