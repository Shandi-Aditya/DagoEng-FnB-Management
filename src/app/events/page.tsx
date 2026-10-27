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
  CheckCircle2,
  Users,
  Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { PublicCommunityEvent, EventCategory } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user } = useAuth();
  const [events, setEvents] = useState<PublicCommunityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewTab, setViewTab] = useState<"UPCOMING" | "PAST">("UPCOMING");
  const [priceFilter, setPriceFilter] = useState<"ALL" | "FREE" | "PAID">("ALL");

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

  // Filter by category, price, and search
  const filteredEvents = useMemo(() => {
    return activePool.filter((evt) => {
      const matchesCategory =
        selectedCategory === "ALL" || evt.category === selectedCategory;
      const matchesPrice =
        priceFilter === "ALL" ||
        (priceFilter === "FREE" && !evt.isPaid) ||
        (priceFilter === "PAID" && evt.isPaid);
      const matchesSearch =
        searchQuery === "" ||
        evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.organizerName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesPrice && matchesSearch;
    });
  }, [activePool, selectedCategory, priceFilter, searchQuery]);

  const parseDateParts = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const month = d.toLocaleDateString("id-ID", { month: "short" }).toUpperCase();
      const day = d.toLocaleDateString("id-ID", { day: "numeric" });
      const weekday = d.toLocaleDateString("id-ID", { weekday: "short" });
      const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      return { month, day, weekday, time };
    } catch {
      return { month: "EVT", day: "--", weekday: "", time: "" };
    }
  };

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
      }) + " WIB";
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-[#1E293B] dark:text-[#E2E8F0] transition-colors duration-200 flex flex-col justify-between">
      {/* 1. Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-8 h-8 relative transition-transform group-hover:scale-105 shrink-0">
                <Image
                  src="/logo-dago.png"
                  alt="DagoEng Logo"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-sm tracking-tight text-slate-900 dark:text-white leading-tight">
                  Dago Creative Hub
                </span>
                <span className="text-[10px] font-bold text-[#3B7A57] dark:text-[#52B788] uppercase tracking-wider">
                  Event Marketplace
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <ThemeToggle variant="pill" />

            <Link href={user ? "/customer?tab=PROFILE" : "/login?returnTo=/customer?tab=PROFILE&mode=CUSTOMER"}>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-9 px-3 sm:px-3.5 font-bold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#3B7A57] hover:text-[#3B7A57] rounded-xl transition-all"
              >
                <Ticket className="w-3.5 h-3.5 mr-1.5 text-[#3B7A57] dark:text-[#52B788]" />
                <span className="hidden sm:inline">Tiket Saya</span>
                <span className="sm:hidden">Tiket</span>
              </Button>
            </Link>

            <Link href="/events/submit">
              <Button
                size="sm"
                className="text-xs h-9 px-3.5 sm:px-4 font-bold bg-[#3B7A57] hover:bg-[#2E6044] dark:bg-[#3B7A57] dark:hover:bg-[#488e68] text-white rounded-xl shadow-sm transition-all hover:scale-105 active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                <span>Buat Event</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section - Eventbrite Style */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/70 via-slate-50 to-[#F8FAFC] dark:from-emerald-950/20 dark:via-[#0B1120] dark:to-[#0B1120] border-b border-slate-200/60 dark:border-slate-800/80 pt-10 pb-12 sm:pt-14 sm:pb-16 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-100/70 dark:bg-emerald-900/40 border border-emerald-300/50 dark:border-emerald-700/50 text-[#3B7A57] dark:text-[#52B788] text-xs font-bold shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pusat Kegiatan Kreatif, Workshop & Komunitas Singaraja</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              Temukan Acara Komunitas Berikutnya
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
              Ikuti lokakarya kopi spesialti, meetup teknologi, pameran seni grafis, hingga sesi berbagi inspirasi dari berbagai kreator di kawasan Dago Creative Hub.
            </p>

            {/* Eventbrite-Style Unified Search Bar */}
            <div className="pt-4 max-w-2xl mx-auto">
              <div className="p-2 sm:p-2.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-none flex flex-col sm:flex-row items-center gap-2">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari acara, topik, workshop, atau komunitas..."
                    className="w-full pl-10 pr-3 py-2 text-xs sm:text-sm bg-transparent border-0 focus:outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                  />
                </div>

                <div className="flex items-center w-full sm:w-auto space-x-1.5 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700 pt-2 sm:pt-0 sm:pl-2">
                  <button
                    onClick={() => setPriceFilter("ALL")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      priceFilter === "ALL"
                        ? "bg-[#3B7A57] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setPriceFilter("FREE")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      priceFilter === "FREE"
                        ? "bg-[#3B7A57] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Gratis
                  </button>
                  <button
                    onClick={() => setPriceFilter("PAID")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      priceFilter === "PAID"
                        ? "bg-[#3B7A57] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Berbayar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Main Directory Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Navigation Bar: Tabs & Categories */}
        <div className="space-y-4 pb-6 border-b border-slate-200 dark:border-slate-800 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Upcoming vs Past Toggle */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
              <button
                onClick={() => setViewTab("UPCOMING")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewTab === "UPCOMING"
                    ? "bg-white dark:bg-[#1E293B] text-[#3B7A57] dark:text-[#52B788] shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Event Mendatang ({upcomingEvents.length})
              </button>
              <button
                onClick={() => setViewTab("PAST")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  viewTab === "PAST"
                    ? "bg-white dark:bg-[#1E293B] text-[#3B7A57] dark:text-[#52B788] shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Telah Berlalu ({pastEvents.length})</span>
              </button>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Menampilkan <span className="font-bold text-slate-900 dark:text-white">{filteredEvents.length}</span> event
            </div>
          </div>

          {/* Category Chips - Scrollable */}
          <div className="flex items-center space-x-2 overflow-x-auto w-full pb-1 scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const active = selectedCategory === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setSelectedCategory(tab.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? "bg-[#3B7A57] text-white shadow-xs"
                      : "bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white"
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
                className="h-96 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse border border-slate-200 dark:border-slate-800"
              />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          /* EMPTY STATE */
          <div className="py-16 text-center max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
              <Calendar className="w-8 h-8 text-[#3B7A57] dark:text-[#52B788]" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">
              {viewTab === "UPCOMING"
                ? "Tidak ada event yang sesuai pencarian."
                : "Belum ada arsip event yang selesai pada filter ini."}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              Coba gunakan kata kunci lain atau reset filter kategori. Anda juga dapat mendaftarkan event komunitas Anda sendiri.
            </p>
            <div className="flex items-center justify-center space-x-3">
              {(searchQuery || selectedCategory !== "ALL" || priceFilter !== "ALL") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("ALL");
                    setPriceFilter("ALL");
                  }}
                  className="text-xs rounded-xl"
                >
                  Reset Filter
                </Button>
              )}
              <Link href="/events/submit">
                <Button className="bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs px-4 py-2 rounded-xl">
                  <PlusCircle className="w-4 h-4 mr-1.5" />
                  Buat Event Baru
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* EVENT GRID - EVENTBRITE STYLE */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((evt) => {
              const isPast = new Date(evt.endDate).getTime() < now;
              const dateParts = parseDateParts(evt.startDate);

              return (
                <Card
                  key={evt.id}
                  className={`group overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-xl flex flex-col justify-between ${
                    isPast
                      ? "opacity-75 bg-slate-50/60 dark:bg-[#161F31]/60 border-slate-200 dark:border-slate-800"
                      : "bg-white dark:bg-[#1E293B] border-slate-200/90 dark:border-slate-800 hover:-translate-y-1 hover:border-[#3B7A57]/40 shadow-xs"
                  }`}
                >
                  <Link href={`/events/${evt.id}`} className="block flex-1">
                    {/* Poster Image Container */}
                    <div className="relative h-48 w-full bg-slate-900 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={evt.posterUrl}
                        alt={evt.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex items-center space-x-1.5">
                        <Badge className="bg-slate-950/80 backdrop-blur-md text-white border-0 text-[10px] font-bold px-2.5 py-0.5">
                          {evt.category}
                        </Badge>
                        {isPast && (
                          <Badge variant="outline" className="bg-rose-950/80 text-rose-300 border-rose-800 text-[10px] px-2 py-0.5">
                            Selesai
                          </Badge>
                        )}
                      </div>

                      {/* Pricing Tag Overlay */}
                      <div className="absolute top-3 right-3">
                        <span
                          className={`text-[11px] font-black px-2.5 py-1 rounded-full shadow-xs backdrop-blur-md ${
                            evt.isPaid
                              ? "bg-amber-500/95 text-white"
                              : "bg-[#3B7A57]/95 text-white"
                          }`}
                        >
                          {evt.isPaid ? formatCurrencyIDR(evt.price) : "GRATIS"}
                        </span>
                      </div>

                      {/* Organizer Name Floating */}
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center space-x-1.5 text-[11px] font-medium text-white/95 drop-shadow-xs">
                        <Users className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                        <span className="truncate">Oleh: <strong className="font-bold">{evt.organizerName}</strong></span>
                      </div>
                    </div>

                    {/* Card Body with Eventbrite Date Box Pattern */}
                    <div className="p-4 sm:p-5 flex items-start space-x-3.5">
                      {/* Date Block */}
                      <div className="shrink-0 w-11 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 flex flex-col items-center justify-center text-center shadow-xs">
                        <span className="text-[9px] font-black tracking-wider text-[#3B7A57] dark:text-[#52B788] leading-none uppercase">
                          {dateParts.month}
                        </span>
                        <span className="text-base font-black text-slate-900 dark:text-white leading-none mt-1">
                          {dateParts.day}
                        </span>
                      </div>

                      {/* Info Column */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-[#3B7A57] dark:group-hover:text-[#52B788] transition-colors">
                          {evt.title}
                        </h3>

                        <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center space-x-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788] shrink-0" />
                            <span className="truncate">{dateParts.weekday}, {dateParts.time} WIB</span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{evt.location}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* Card Footer Action */}
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0">
                    <Link href={`/events/${evt.id}`}>
                      <Button
                        variant="outline"
                        className="w-full text-xs font-bold border-slate-200 dark:border-slate-700 hover:bg-[#3B7A57] hover:text-white hover:border-[#3B7A57] dark:hover:bg-[#3B7A57] dark:hover:text-white transition-all rounded-xl justify-between group/btn"
                      >
                        <span>{evt.isPaid ? "Pesan Tiket" : "Daftar Tiket"}</span>
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
      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-[#0B1120]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Dago Creative Hub — Ekosistem Terpadu F&B, Co-Working & Komunitas.</p>
          <div className="flex items-center space-x-4 font-medium">
            <Link href="/" className="hover:text-slate-800 dark:hover:text-white transition-colors">
              Beranda
            </Link>
            <Link href="/events/submit" className="hover:text-[#3B7A57] dark:hover:text-[#52B788] transition-colors">
              Pasang Event
            </Link>
            <Link href="/events/portal" className="hover:text-[#3B7A57] dark:hover:text-[#52B788] transition-colors">
              Portal Penyelenggara
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
