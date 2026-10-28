"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  CheckCircle2,
  AlertCircle,
  Users,
  Ticket,
  ArrowLeft,
  RefreshCw,
  QrCode,
  UserCheck,
  Building,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Check,
  X,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { CommunityEvent, EventTicketOrder, AttendeeCheckInStatus } from "@/types/event";
import { EventSearchInput } from "@/components/events/EventSearchInput";
import { formatCurrencyIDR } from "@/lib/utils";

export default function EventCheckInDashboardPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [bookings, setBookings] = useState<EventTicketOrder[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [ticketSearch, setTicketSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load events and bookings
  const loadData = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      // 1. Fetch public/admin approved events
      const evtRes = await fetch("/api/events");
      const evtJson = await evtRes.json();
      const allEvents: CommunityEvent[] = evtJson.success ? evtJson.data : [];

      // Determine accessible events based on user persona / role:
      // - Hub Admin (SUPER_ADMIN, DAGO_OWNER, MANAGER): all approved events
      // - Field Staff (WAITER, CASHIER): operational venue events
      // - Organizer: their own community events
      const userEmail = (user?.email || "").toLowerCase();
      const isHubStaff =
        user?.role.slug === "SUPER_ADMIN" ||
        user?.scopeLevel === "ORGANIZATION" ||
        user?.scopeLevel === "PLATFORM" ||
        user?.role.slug === "WAITER" ||
        user?.role.slug === "CASHIER";

      const accessibleEvents = isHubStaff
        ? allEvents.filter((e) => e.status === "APPROVED")
        : allEvents.filter(
            (e) => e.status === "APPROVED" && (e.organizerEmail || "").toLowerCase() === userEmail
          );

      setEvents(accessibleEvents);

      // Select first event by default if available and not set
      if (accessibleEvents.length > 0 && !selectedEventId) {
        // Prioritize currently ongoing or upcoming event
        const now = Date.now();
        const ongoing = accessibleEvents.find((e) => {
          const s = new Date(e.startDate).getTime();
          const end = new Date(e.endDate).getTime();
          return s <= now && end >= now;
        });
        const target = ongoing || accessibleEvents[0];
        setSelectedEventId(target.id);
      }

      // 2. Fetch ticket bookings
      const bRes = await fetch("/api/events/bookings");
      const bJson = await bRes.json();
      if (bJson.success && Array.isArray(bJson.data)) {
        setBookings(bJson.data);
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Gagal memuat data check-in event." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Current selected event object
  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return events.find((e) => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // Event category breakdown: Ongoing, Upcoming, Past
  const eventSections = useMemo(() => {
    const now = Date.now();
    const ongoing: CommunityEvent[] = [];
    const upcoming: CommunityEvent[] = [];
    const past: CommunityEvent[] = [];

    events.forEach((e) => {
      const startMs = new Date(e.startDate).getTime();
      const endMs = new Date(e.endDate).getTime();

      if (startMs <= now && endMs >= now) {
        ongoing.push(e);
      } else if (startMs > now) {
        upcoming.push(e);
      } else {
        past.push(e);
      }
    });

    return { ongoing, upcoming, past };
  }, [events]);

  // Filtered tickets strictly restricted to the selected event
  const eventTickets = useMemo(() => {
    if (!selectedEventId) return [];
    return bookings.filter((b) => b.eventId === selectedEventId);
  }, [bookings, selectedEventId]);

  // Real-time Event Statistics
  const stats = useMemo(() => {
    const totalTickets = eventTickets.reduce((sum, b) => sum + (b.ticketCount || 1), 0);
    const checkedInCount = eventTickets.reduce(
      (sum, b) =>
        sum +
        (typeof b.checkedInQty === "number"
          ? b.checkedInQty
          : b.checkInStatus === "CHECKED_IN"
          ? b.ticketCount || 1
          : 0),
      0
    );
    const remainingCount = Math.max(0, totalTickets - checkedInCount);
    const percentage = totalTickets > 0 ? Math.round((checkedInCount / totalTickets) * 100) : 0;

    return { totalTickets, checkedInCount, remainingCount, percentage };
  }, [eventTickets]);

  // Search filtered tickets
  const filteredTickets = useMemo(() => {
    const q = ticketSearch.trim().toLowerCase();
    if (!q) return eventTickets;

    return eventTickets.filter((b) => {
      const matchCode = (b.ticketCode || "").toLowerCase().includes(q);
      const matchName = (b.guestName || "").toLowerCase().includes(q);
      const matchEmail = (b.guestEmail || "").toLowerCase().includes(q);
      const matchPhone = (b.guestPhone || "").toLowerCase().includes(q);
      return matchCode || matchName || matchEmail || matchPhone;
    });
  }, [eventTickets, ticketSearch]);

  // Server-side Check-In Handler
  const handleCheckIn = async (booking: EventTicketOrder, newStatus: AttendeeCheckInStatus) => {
    setIsProcessingId(booking.id);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/events/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkInStatus: newStatus,
          reset: newStatus === "REGISTERED",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memproses check-in tiket.");
      }

      // Update local state with updated booking
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, ...json.data } : b))
      );

      setStatusMessage({
        type: "success",
        text:
          newStatus === "CHECKED_IN"
            ? `Tiket [${booking.ticketCode}] (${booking.guestName}) berhasil check-in!`
            : `Status kehadiran [${booking.ticketCode}] berhasil direset.`,
      });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Gagal memproses check-in." });
    } finally {
      setIsProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Header Bar */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Dashboard Utama
              </Link>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs font-bold text-primary dark:text-primary-light">
                Check-in Petugas Lapangan
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center space-x-2.5">
              <UserCheck className="w-6 h-6 text-primary" />
              <span>Dashboard Petugas Check-in Event</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Operasional meja registrasi, verifikasi tiket masuk, dan pemantauan kehadiran peserta Dago Creative Hub.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              className="h-8 text-xs font-semibold rounded-lg"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Segarkan Data
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {/* Global Feedback Alert */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
              statusMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
            }`}
          >
            <div className="flex items-center space-x-2">
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Empty State: No Accessible Events */}
        {events.length === 0 && !isLoading && (
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm text-center py-12 px-4">
            <Building className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Belum Ada Event yang Ditugaskan
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Akun Anda belum memiliki event aktif yang disetujui kurator untuk operasional check-in. Hubungi Admin Hub atau koordinator acara untuk penugasan meja registrasi.
            </p>
            <Link href="/events">
              <Button size="sm" variant="outline" className="text-xs font-semibold">
                Lihat Kalender Event Publik
              </Button>
            </Link>
          </Card>
        )}

        {events.length > 0 && (
          <div className="space-y-6">
            {/* Section 1: Event Selector via Text Search Box */}
            <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>Pilih Event Operasional:</span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Ketik nama event untuk memfilter daftar tiket peserta pada meja registrasi.
                  </p>
                </div>

                <div className="w-full md:w-96">
                  <EventSearchInput
                    events={events}
                    selectedEventId={selectedEventId}
                    onSelectEvent={(id) => setSelectedEventId(id)}
                    placeholder="Cari nama event..."
                    allowAllOption={false}
                  />
                </div>
              </div>

              {/* Quick Switcher Tags: Ongoing Events */}
              {eventSections.ongoing.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>Sedang Berlangsung Hari Ini:</span>
                  </span>
                  {eventSections.ongoing.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setSelectedEventId(e.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        selectedEventId === e.id
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                      }`}
                    >
                      {e.title}
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Section 2: Selected Event Overview & Real-Time Stats */}
            {selectedEvent && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Event Banner Card */}
                <Card className="border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-sm">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-primary/90 text-white font-bold text-[10px] px-2 py-0.5">
                          {selectedEvent.category}
                        </Badge>
                        <span className="text-xs font-medium text-slate-300">
                          Penyelenggara: <strong className="text-white">{selectedEvent.organizerName}</strong>
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                        {selectedEvent.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-primary-light" />
                          <span>
                            {new Date(selectedEvent.startDate).toLocaleDateString("id-ID", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-primary-light" />
                          <span>
                            {new Date(selectedEvent.startDate).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            WITA
                          </span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-primary-light" />
                          <span>{selectedEvent.location}</span>
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 text-center shrink-0 min-w-[130px]">
                      <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                        Harga Tiket
                      </p>
                      <p className="text-base font-black text-white">
                        {selectedEvent.isPaid ? formatCurrencyIDR(selectedEvent.price || 0) : "GRATIS"}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* KPI Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <Card className="p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                      <Ticket className="w-3.5 h-3.5 text-primary" />
                      <span>Total Tiket Terdaftar</span>
                    </p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                      {stats.totalTickets}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Seluruh pemesan terverifikasi</p>
                  </Card>

                  <Card className="p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                    <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Sudah Check-In</span>
                    </p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {stats.checkedInCount}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Telah berada di venue</p>
                  </Card>

                  <Card className="p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                    <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Belum Check-In</span>
                    </p>
                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                      {stats.remainingCount}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Menunggu kedatangan</p>
                  </Card>

                  <Card className="p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" />
                      <span>Persentase Kehadiran</span>
                    </p>
                    <div className="flex items-baseline space-x-1.5 mt-1">
                      <p className="text-2xl font-black text-primary dark:text-primary-light">
                        {stats.percentage}%
                      </p>
                      <span className="text-[10px] text-slate-400">attendance rate</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all duration-300"
                        style={{ width: `${Math.min(100, stats.percentage)}%` }}
                      />
                    </div>
                  </Card>
                </div>

                {/* Section 3: Attendees Check-In Table & Fast Search */}
                <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                        <Users className="w-4 h-4 text-primary" />
                        <span>Daftar Peserta & Verifikasi Masuk</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Menampilkan {filteredTickets.length} dari {eventTickets.length} pemesanan tiket pada event ini.
                      </p>
                    </div>

                    <div className="relative w-full sm:w-80">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={ticketSearch}
                        onChange={(e) => setTicketSearch(e.target.value)}
                        placeholder="Cari kode tiket, nama, atau email..."
                        className="w-full text-xs font-medium pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {ticketSearch && (
                        <button
                          type="button"
                          onClick={() => setTicketSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Attendees Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-100 dark:border-slate-800 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Kode Tiket</th>
                          <th className="py-3 px-4">Nama Peserta</th>
                          <th className="py-3 px-4">Kontak</th>
                          <th className="py-3 px-4 text-center">Jumlah Tiket</th>
                          <th className="py-3 px-4 text-center">Status Bayar</th>
                          <th className="py-3 px-4 text-center">Status Kehadiran</th>
                          <th className="py-3 px-4 text-right">Aksi Meja Registrasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredTickets.length > 0 ? (
                          filteredTickets.map((b) => {
                            const isFullyCheckedIn = b.checkInStatus === "CHECKED_IN";
                            const isPaid = b.paymentStatus === "PAID";
                            const isProcessing = isProcessingId === b.id;

                            return (
                              <tr
                                key={b.id}
                                className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                                  isFullyCheckedIn
                                    ? "bg-emerald-50/30 dark:bg-emerald-950/10"
                                    : ""
                                }`}
                              >
                                <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                                  {b.ticketCode}
                                </td>
                                <td className="py-3 px-4">
                                  <p className="font-bold text-slate-800 dark:text-slate-100">{b.guestName}</p>
                                  {b.institution && (
                                    <p className="text-[10px] text-slate-400">{b.institution}</p>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-[11px]">
                                  <p>{b.guestEmail}</p>
                                  <p className="font-mono text-[10px]">{b.guestPhone}</p>
                                </td>
                                <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                                  {b.ticketCount} Tiket
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      b.paymentStatus === "PAID"
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                                        : b.paymentStatus === "CANCELLED" || b.paymentStatus === "EXPIRED"
                                        ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
                                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                                    }`}
                                  >
                                    {b.paymentStatus}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      isFullyCheckedIn
                                        ? "bg-emerald-600 text-white shadow-2xs"
                                        : b.checkInStatus === "PARTIALLY_CHECKED_IN"
                                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                                        : "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                                    }`}
                                  >
                                    {isFullyCheckedIn
                                      ? "SUDAH CHECK-IN"
                                      : b.checkInStatus === "PARTIALLY_CHECKED_IN"
                                      ? `HADIR (${b.checkedInQty}/${b.ticketCount})`
                                      : "BELUM HADIR"}
                                  </span>
                                  {b.checkInTime && (
                                    <p className="text-[9px] text-slate-400 mt-0.5">
                                      {new Date(b.checkInTime).toLocaleTimeString("id-ID", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}{" "}
                                      WITA
                                    </p>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end space-x-1.5">
                                    {!isFullyCheckedIn ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        disabled={!isPaid || isProcessing}
                                        onClick={() => handleCheckIn(b, "CHECKED_IN")}
                                        className={`h-7 px-2.5 text-xs font-bold rounded-lg shadow-xs ${
                                          !isPaid
                                            ? "opacity-50 cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-800"
                                            : "bg-primary hover:bg-primary/90 text-white"
                                        }`}
                                      >
                                        <Check className="w-3.5 h-3.5 mr-1" />
                                        {isProcessing ? "Menyimpan..." : "Check-in Tiket"}
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={isProcessing}
                                        onClick={() => handleCheckIn(b, "REGISTERED")}
                                        className="h-7 px-2 text-xs font-semibold text-slate-500 hover:text-rose-600 border-slate-200 dark:border-slate-700 rounded-lg"
                                        title="Batalkan status kehadiran peserta"
                                      >
                                        <RotateCcw className="w-3 h-3 mr-1" />
                                        Reset
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-400">
                              <Ticket className="w-8 h-8 mx-auto mb-1 text-slate-300 dark:text-slate-600" />
                              <p className="font-semibold text-slate-600 dark:text-slate-300">
                                Tidak ada tiket yang sesuai dengan pencarian
                              </p>
                              <p className="text-[11px] text-slate-400">
                                Pastikan kode tiket atau nama peserta yang diketik sudah benar.
                              </p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
