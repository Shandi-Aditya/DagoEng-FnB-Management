"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  Ticket,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock3,
  FileEdit,
  ArrowLeft,
  Search,
  Download,
  Check,
  RefreshCw,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  X,
  Mail,
  UserCheck,
  RotateCcw,
  List,
  Home,
  Tag,
  ChevronLeft,
  ChevronDown,
  Plus,
  Compass,
  BarChart3,
  SlidersHorizontal,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CommunityEvent, EventTicketOrder, OrganizerPortalData, AttendeeCheckInStatus } from "@/types/event";
import { resolveVenueCapacity } from "@/lib/event-capacity";
import { useAuth } from "@/contexts/AuthContext";

type OrganizerNavView = "EVENTS" | "ATTENDEES" | "FINANCE" | "HOME";
type EventViewMode = "LIST" | "CALENDAR";
type EventFilterStatus = "ALL" | "APPROVED" | "PENDING" | "REVISION_REQUESTED" | "REJECTED";

export default function CommunityOrganizerPortalPage() {
  const { user } = useAuth();
  const [organizerEmail, setOrganizerEmail] = useState("");
  const [activeEmail, setActiveEmail] = useState("");
  const [portalData, setPortalData] = useState<OrganizerPortalData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Eventbrite Navigation States
  const [activeNav, setActiveNav] = useState<OrganizerNavView>("EVENTS");
  const [eventViewMode, setEventViewMode] = useState<EventViewMode>("LIST");
  const [eventFilterStatus, setEventFilterStatus] = useState<EventFilterStatus>("ALL");
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [eventSubTab, setEventSubTab] = useState<"EVENTS" | "COLLECTIONS">("EVENTS");
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  // Attendees Filtering
  const [selectedEventId, setSelectedEventId] = useState<string>("ALL");
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [isUpdatingCheckIn, setIsUpdatingCheckIn] = useState<string | null>(null);

  // Revision Modal State
  const [revisionEvent, setRevisionEvent] = useState<CommunityEvent | null>(null);
  const [revisionTitle, setRevisionTitle] = useState("");
  const [revisionDesc, setRevisionDesc] = useState("");
  const [revisionLocation, setRevisionLocation] = useState("");
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);

  // Synchronize on mount or user changes
  useEffect(() => {
    const targetEmail = user?.email || localStorage.getItem("dago_organizer_email");
    loadPortalData(targetEmail || undefined);
  }, [user?.email, user?.role?.slug]);

  const loadPortalData = async (email?: string) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const queryParam = email && email.includes("@") ? `?email=${encodeURIComponent(email)}` : "";
      const res = await fetch(`/api/events/portal${queryParam}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        if (email && (json.error?.includes("Pelanggaran isolasi data") || json.error?.includes("FORBIDDEN"))) {
          localStorage.removeItem("dago_organizer_email");
          const retryRes = await fetch("/api/events/portal");
          const retryJson = await retryRes.json();
          if (retryRes.ok && retryJson.success) {
            setPortalData(retryJson.data);
            const verifiedEmail = retryJson.data.organizerEmail || "";
            setActiveEmail(verifiedEmail);
            setOrganizerEmail(verifiedEmail);
            localStorage.setItem("dago_organizer_email", verifiedEmail);
            return;
          }
        }

        setErrorMessage(json.error || "Gagal memuat portal komunitas.");
        setPortalData(null);
        return;
      }

      setPortalData(json.data);
      const verifiedEmail = json.data.organizerEmail || email || "";
      setActiveEmail(verifiedEmail);
      setOrganizerEmail(verifiedEmail);
      localStorage.setItem("dago_organizer_email", verifiedEmail);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan jaringan.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrganizerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPortalData(organizerEmail);
  };

  const handleSelectCommunity = async (comm: { id: string; name: string; email: string }) => {
    setOrganizerEmail(comm.email);
    await loadPortalData(comm.email);
  };

  // Partial & Full Check-in handler
  const handleCheckInTicket = async (
    booking: EventTicketOrder,
    action: "INCREMENT" | "RESET"
  ) => {
    if (!activeEmail || booking.paymentStatus === "CANCELLED") return;
    if (booking.paymentStatus === "PENDING" && action === "INCREMENT") {
      setErrorMessage(
        `Tiket ${booking.ticketCode} (${booking.guestName}) belum diverifikasi lunas (status masih PENDING). Konfirmasi pembayaran terlebih dahulu sebelum check-in.`
      );
      return;
    }

    const currentQty =
      booking.checkedInQty ?? (booking.checkInStatus === "CHECKED_IN" ? booking.ticketCount : 0);
    if (action === "INCREMENT" && currentQty >= booking.ticketCount) {
      setErrorMessage(
        `Semua tiket untuk pesanan ${booking.ticketCode} sudah selesai check-in (${booking.ticketCount}/${booking.ticketCount}).`
      );
      return;
    }

    try {
      setIsUpdatingCheckIn(booking.id);
      setErrorMessage(null);

      const targetStatus: AttendeeCheckInStatus =
        action === "RESET"
          ? "REGISTERED"
          : currentQty + 1 >= booking.ticketCount
          ? "CHECKED_IN"
          : "PARTIALLY_CHECKED_IN";

      const res = await fetch("/api/events/portal/check-in", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: activeEmail,
          bookingId: booking.id,
          checkInStatus: targetStatus,
          incrementQty: action === "INCREMENT" ? 1 : undefined,
          reset: action === "RESET",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error || "Gagal memperbarui status check-in.");
        return;
      }

      const updatedBooking: EventTicketOrder = json.data;

      if (portalData) {
        setPortalData({
          ...portalData,
          bookings: portalData.bookings.map((b) =>
            b.id === booking.id ? updatedBooking : b
          ),
        });
      }

      setSuccessMessage(json.message || "Status kehadiran berhasil diperbarui.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memperbarui status.");
    } finally {
      setIsUpdatingCheckIn(null);
    }
  };

  const openRevisionModal = (evt: CommunityEvent) => {
    setRevisionEvent(evt);
    setRevisionTitle(evt.title);
    setRevisionDesc(evt.description);
    setRevisionLocation(evt.location);
  };

  const handleSaveRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionEvent || !activeEmail) return;

    try {
      setIsSubmittingRevision(true);
      setErrorMessage(null);

      const res = await fetch("/api/events/portal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: activeEmail,
          eventId: revisionEvent.id,
          updates: {
            title: revisionTitle,
            description: revisionDesc,
            location: revisionLocation,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error || "Gagal menyimpan revisi.");
        return;
      }

      setSuccessMessage("Event berhasil diajukan ulang ke antrean review kurator!");
      setRevisionEvent(null);
      await loadPortalData(activeEmail);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal mengirim revisi.");
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  // Filtered Events based on search query and status filter
  const filteredEvents = useMemo(() => {
    if (!portalData) return [];
    return portalData.events.filter((evt) => {
      const q = eventSearchQuery.toLowerCase().trim();
      const matchSearch =
        q === "" ||
        evt.title.toLowerCase().includes(q) ||
        evt.location.toLowerCase().includes(q) ||
        evt.category.toLowerCase().includes(q);

      const matchStatus =
        eventFilterStatus === "ALL" ||
        (eventFilterStatus === "APPROVED" && evt.status === "APPROVED") ||
        (eventFilterStatus === "PENDING" && evt.status === "PENDING") ||
        (eventFilterStatus === "REVISION_REQUESTED" && evt.status === "REVISION_REQUESTED") ||
        (eventFilterStatus === "REJECTED" && (evt.status === "REJECTED" || evt.status === "ARCHIVED"));

      return matchSearch && matchStatus;
    });
  }, [portalData, eventSearchQuery, eventFilterStatus]);

  // Filtered Attendees for active tab
  const filteredAttendees = useMemo(() => {
    if (!portalData) return [];
    return portalData.bookings.filter((b) => {
      const matchesEvent = selectedEventId === "ALL" || b.eventId === selectedEventId;
      const q = attendeeSearch.toLowerCase().trim();
      const matchesSearch =
        q === "" ||
        b.ticketCode.toLowerCase().includes(q) ||
        b.guestName.toLowerCase().includes(q) ||
        (b.institution || "").toLowerCase().includes(q);
      return matchesEvent && matchesSearch;
    });
  }, [portalData, selectedEventId, attendeeSearch]);

  const handleExportCSV = () => {
    if (!portalData || filteredAttendees.length === 0) return;
    const headers = [
      "Kode Tiket",
      "Nama Event",
      "Nama Peserta",
      "No HP",
      "Instansi",
      "Qty Tiket",
      "Status Bayar",
      "Check In",
      "Waktu Check In",
    ];
    const rows = filteredAttendees.map((b) => [
      b.ticketCode,
      b.eventTitle,
      b.guestName,
      b.guestPhone,
      b.institution || "-",
      b.ticketCount,
      b.paymentStatus,
      b.checkInStatus,
      b.checkInTime ? new Date(b.checkInTime).toLocaleString("id-ID") : "-",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map((cell) => `"${cell}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `peserta-komunitas-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calendar View Grid Logic
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startingDayIndex = firstDay.getDay(); // 0 is Sunday
    const totalDays = lastDay.getDate();

    const days = [];
    // Padding previous month
    for (let i = 0; i < startingDayIndex; i++) {
      days.push({ day: null, dateStr: null, events: [] });
    }
    // Days in current month
    for (let d = 1; d <= totalDays; d++) {
      const cur = new Date(year, month, d);
      const curDateStr = cur.toISOString().split("T")[0];
      const dayEvents = (portalData?.events || []).filter((e) => {
        const startStr = e.startDate.split("T")[0];
        return startStr === curDateStr;
      });
      days.push({ day: d, dateStr: curDateStr, events: dayEvents });
    }
    return days;
  }, [calendarDate, portalData]);

  // Initial Avatar Letters
  const userInitial = useMemo(() => {
    const name = portalData?.summary.organizerName || user?.name || "K";
    return name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("");
  }, [portalData?.summary.organizerName, user?.name]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0A0F1D] text-[#1E293B] dark:text-[#E2E8F0] flex flex-col antialiased">
      {/* =========================================================================
          1. TOP NAVIGATION BAR (Eventbrite Style with DAGO Creative Hub Accents)
         ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-800 h-16 flex items-center justify-between px-4 sm:px-6 shadow-xs">
        {/* Left Brand Area */}
        <div className="flex items-center space-x-3">
          <Link href="/events" className="flex items-center space-x-2 group">
            <div className="w-8 h-8 rounded-lg bg-[#3B7A57] flex items-center justify-center text-white font-black text-sm shadow-xs group-hover:scale-105 transition-transform">
              d
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="font-black text-lg text-slate-900 dark:text-white tracking-tight">
                dago<span className="text-[#3B7A57]">eng</span>
              </span>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">
                Organizer
              </span>
            </div>
          </Link>
        </div>

        {/* Right Action & User Profile Area */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          <ThemeToggle variant="pill" />

          {/* Quick Create Event CTA Button (DagoEng Sage Green) */}
          <Link href="/events/submit">
            <Button
              size="sm"
              className="bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Event</span>
            </Button>
          </Link>

          {/* User Profile Pill Avatar */}
          <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div
              className="w-8 h-8 rounded-full bg-[#1E293B] dark:bg-slate-800 text-white flex items-center justify-center text-xs font-bold border border-slate-300 dark:border-slate-700 shadow-xs"
              title={activeEmail || organizerEmail}
            >
              {userInitial || "OR"}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                {portalData?.summary.organizerName || "Penyelenggara"}
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                {activeEmail || organizerEmail}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. MAIN BODY WRAPPER: SLIM SIDEBAR (LEFT) + WORKSPACE CONTENT (RIGHT)
         ========================================================================= */}
      <div className="flex-1 flex flex-row w-full">
        {/* Left Slim Icon Sidebar Navigation (Eventbrite-Style Nav with DagoEng Theme) */}
        <aside className="w-16 sm:w-18 bg-white dark:bg-[#0F172A] border-r border-slate-200 dark:border-slate-800 flex flex-col items-center py-5 space-y-3 flex-shrink-0">
          {/* Home / Summary View */}
          <button
            type="button"
            onClick={() => setActiveNav("HOME")}
            className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
              activeNav === "HOME"
                ? "bg-[#3B7A57]/10 text-[#3B7A57] dark:bg-[#3B7A57]/20 shadow-xs"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title="Overview & Metrik Ringkasan"
          >
            <Home className="w-5 h-5" />
            <span className="text-[8.5px] font-semibold mt-0.5">Home</span>
          </button>

          {/* Events Management (Primary View) */}
          <button
            type="button"
            onClick={() => setActiveNav("EVENTS")}
            className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
              activeNav === "EVENTS"
                ? "bg-[#3B7A57] text-white shadow-md shadow-[#3B7A57]/20"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title="Daftar Event & Penjadwalan"
          >
            <CalendarIcon className="w-5 h-5" />
            <span className="text-[8.5px] font-semibold mt-0.5">Events</span>
          </button>

          {/* Attendees & Orders Check-In View */}
          <button
            type="button"
            onClick={() => setActiveNav("ATTENDEES")}
            className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
              activeNav === "ATTENDEES"
                ? "bg-[#3B7A57]/10 text-[#3B7A57] dark:bg-[#3B7A57]/20 shadow-xs"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title="Pesanan Tiket & Meja Check-In"
          >
            <Users className="w-5 h-5" />
            <span className="text-[8.5px] font-semibold mt-0.5">Orders</span>
          </button>

          {/* Finance & Bagi Hasil Payout View */}
          <button
            type="button"
            onClick={() => setActiveNav("FINANCE")}
            className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
              activeNav === "FINANCE"
                ? "bg-[#3B7A57]/10 text-[#3B7A57] dark:bg-[#3B7A57]/20 shadow-xs"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title="Laporan Penjualan & Bagi Hasil 80%"
          >
            <DollarSign className="w-5 h-5" />
            <span className="text-[8.5px] font-semibold mt-0.5">Payout</span>
          </button>

          <div className="w-8 border-t border-slate-200 dark:border-slate-800 my-2" />

          {/* Customer Portal Link (F&B / Co-Working) */}
          <Link
            href="/customer"
            className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-brand-orange dark:hover:text-orange-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title="Kembali ke Customer Portal (Pesan F&B & Co-working)"
          >
            <Home className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[7.5px] font-bold mt-0.5 text-center leading-none">Customer</span>
          </Link>

          {/* Public Marketplace Link */}
          <Link
            href="/events"
            target="_blank"
            className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-[#3B7A57] dark:hover:text-[#52B788] hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            title="Buka Marketplace Publik"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="text-[8px] font-semibold mt-0.5">Katalog</span>
          </Link>
        </aside>

        {/* Right Workspace Main Content Area */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button onClick={() => setErrorMessage(null)} className="p-1 hover:text-rose-900 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
              <button onClick={() => setSuccessMessage(null)} className="p-1 hover:text-emerald-900 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Hub Admin Supervisor Switcher (Only visible to Platform Admins) */}
          {portalData?.isAdmin && (
            <Card className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Mode Pengawasan Administrator Hub Dago
                  </span>
                </div>
                <form onSubmit={handleOrganizerSubmit} className="flex items-center space-x-2">
                  <input
                    type="email"
                    value={organizerEmail}
                    onChange={(e) => setOrganizerEmail(e.target.value)}
                    placeholder="Email Komunitas..."
                    className="px-3 py-1.5 text-xs rounded-xl border bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-800 text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                  <Button type="submit" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8">
                    Supervisi
                  </Button>
                </form>
              </div>

              {portalData.accessibleCommunities && portalData.accessibleCommunities.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-3 mt-3 border-t border-amber-200/60 dark:border-amber-800/60">
                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">Pilih Komunitas:</span>
                  {portalData.accessibleCommunities.map((c) => (
                    <button
                      key={c.email}
                      type="button"
                      onClick={() => handleSelectCommunity(c)}
                      className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${
                        activeEmail === c.email
                          ? "bg-amber-600 text-white border-amber-600"
                          : "bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* =========================================================================
              VIEW 1: EVENTS (The Eventbrite Screenshot Experience)
             ========================================================================= */}
          {activeNav === "EVENTS" && (
            <div className="space-y-6">
              {/* Header Title & Sub-tabs */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                      Kelola Event
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Kelola jadwal, pantau keterisian tiket, dan pantau status moderasi event komunitas Anda.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadPortalData(activeEmail || organizerEmail)}
                      disabled={isLoading}
                      className="text-xs h-9 px-3 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Segarkan data event"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-slate-600 dark:text-slate-400 ${isLoading ? "animate-spin" : ""}`} />
                      <span className="ml-1.5 hidden sm:inline text-xs font-semibold">Segarkan</span>
                    </Button>

                    <Link href="/events/submit">
                      <Button
                        size="sm"
                        className="bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Buat Event Baru</span>
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Sub-tabs: Events vs Collections */}
                <div className="flex items-center space-x-6 border-b border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEventSubTab("EVENTS")}
                    className={`pb-3 text-sm font-bold transition-all border-b-2 cursor-pointer ${
                      eventSubTab === "EVENTS"
                        ? "border-[#3B7A57] text-[#3B7A57]"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    Daftar Event ({portalData?.events.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventSubTab("COLLECTIONS")}
                    className={`pb-3 text-sm font-bold transition-all border-b-2 cursor-pointer ${
                      eventSubTab === "COLLECTIONS"
                        ? "border-[#3B7A57] text-[#3B7A57]"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    Kategori & Fasilitas
                  </button>
                </div>
              </div>

              {eventSubTab === "EVENTS" ? (
                <>
                  {/* Status Pills Filter Bar (Eventbrite Pattern) */}
                  <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {(
                      [
                        { key: "ALL", label: "Semua" },
                        { key: "APPROVED", label: "Tayang / Live" },
                        { key: "PENDING", label: "Menunggu Review" },
                        { key: "REVISION_REQUESTED", label: "Perlu Revisi" },
                        { key: "REJECTED", label: "Ditolak / Arsip" },
                      ] as const
                    ).map((statusTab) => {
                      const count =
                        portalData?.events.filter((e) => {
                          if (statusTab.key === "ALL") return true;
                          if (statusTab.key === "REJECTED") return e.status === "REJECTED" || e.status === "ARCHIVED";
                          return e.status === statusTab.key;
                        }).length || 0;

                      const isActive = eventFilterStatus === statusTab.key;

                      return (
                        <button
                          key={statusTab.key}
                          type="button"
                          onClick={() => setEventFilterStatus(statusTab.key)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
                            isActive
                              ? "bg-[#3B7A57] text-white shadow-xs"
                              : "bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          <span>{statusTab.label}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Action Bar / Controls (Search, View Toggle) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left Controls: Search Bar */}
                    <div className="relative w-full sm:w-72">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={eventSearchQuery}
                        onChange={(e) => setEventSearchQuery(e.target.value)}
                        placeholder="Cari event berdasarkan judul atau lokasi..."
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                      />
                    </div>

                    {/* View Switcher: List vs Calendar */}
                    <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setEventViewMode("LIST")}
                        className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          eventViewMode === "LIST"
                            ? "bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                        }`}
                      >
                        <List className="w-3.5 h-3.5" />
                        <span>Daftar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEventViewMode("CALENDAR")}
                        className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          eventViewMode === "CALENDAR"
                            ? "bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                        }`}
                      >
                        <CalendarIcon className="w-3.5 h-3.5" />
                        <span>Kalender</span>
                      </button>
                    </div>
                  </div>

                  {/* =============================================================
                      LIST VIEW: Eventbrite Style Card List
                     ============================================================= */}
                  {eventViewMode === "LIST" && (
                    <div className="space-y-3.5">
                      {filteredEvents.length === 0 ? (
                        /* Empty State */
                        <div className="py-16 sm:py-20 px-4 text-center bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 shadow-xs">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center text-[#3B7A57] dark:text-[#52B788]">
                            <CalendarIcon className="w-8 h-8 sm:w-10 sm:h-10" />
                          </div>
                          <div>
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                              Belum Ada Event Komunitas
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                              {eventSearchQuery || eventFilterStatus !== "ALL"
                                ? "Tidak ada event yang cocok dengan kriteria pencarian atau status filter saat ini."
                                : "Mulai buat event komunitas pertamamu sekarang untuk menjangkau audiens di Singaraja."}
                            </p>
                          </div>
                          <div className="flex items-center justify-center space-x-2.5 pt-1">
                            {(eventSearchQuery || eventFilterStatus !== "ALL") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEventSearchQuery("");
                                  setEventFilterStatus("ALL");
                                }}
                                className="text-xs rounded-xl"
                              >
                                Reset Filter
                              </Button>
                            )}
                            <Link href="/events/submit">
                              <Button className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer">
                                <Plus className="w-4 h-4 mr-1.5" />
                                <span>Buat Event Baru</span>
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ) : (
                        filteredEvents.map((evt) => {
                          const eventBookings = (portalData?.bookings || []).filter((b) => b.eventId === evt.id);
                          const activeBookings = eventBookings.filter((b) => b.paymentStatus !== "CANCELLED");
                          const paidBookings = activeBookings.filter((b) => b.paymentStatus === "PAID");

                          const capacityRes = resolveVenueCapacity(evt);
                          const totalCapacity = capacityRes.capacity;

                          const ticketsPaid = paidBookings.reduce((s, b) => s + b.ticketCount, 0);
                          const ticketsReserved = activeBookings.reduce((s, b) => s + b.ticketCount, 0);
                          const occupancyRate = totalCapacity > 0 ? Math.min(100, Math.round((ticketsReserved / totalCapacity) * 100)) : 0;

                          const checkedInTickets = paidBookings.reduce(
                            (sum, b) =>
                              sum +
                              (b.checkedInQty ??
                                (b.checkInStatus === "CHECKED_IN" ? b.ticketCount : 0)),
                            0
                          );

                          const grossSales = paidBookings.reduce((s, b) => s + b.totalPrice, 0);

                          const eventDate = new Date(evt.startDate);
                          const monthStr = eventDate.toLocaleDateString("id-ID", { month: "short" }).toUpperCase();
                          const dayNum = eventDate.getDate();

                          return (
                            <Card
                              key={evt.id}
                              className="p-4 sm:p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs"
                            >
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                {/* Left Event Date & Details */}
                                <div className="flex items-start space-x-4">
                                  {/* Date Box Indicator (DagoEng Sage Green Style) */}
                                  <div className="flex-shrink-0 w-14 h-16 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center">
                                    <span className="text-[10px] font-black text-[#3B7A57] tracking-wider uppercase">
                                      {monthStr}
                                    </span>
                                    <span className="text-xl font-black text-slate-900 dark:text-white leading-none">
                                      {dayNum}
                                    </span>
                                  </div>

                                  {/* Event Main Meta */}
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      {/* Status Badges */}
                                      {evt.status === "APPROVED" && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                          ● Live / Disetujui
                                        </span>
                                      )}
                                      {evt.status === "PENDING" && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                          ⏳ Menunggu Review Kurator
                                        </span>
                                      )}
                                      {evt.status === "REVISION_REQUESTED" && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                          ✏️ Perlu Revisi
                                        </span>
                                      )}
                                      {evt.status === "REJECTED" && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                          ✕ Ditolak
                                        </span>
                                      )}

                                      <Badge variant="outline" className="text-[10px] font-semibold border-slate-200 dark:border-slate-700 text-slate-500">
                                        {evt.category}
                                      </Badge>
                                    </div>

                                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white line-clamp-1 hover:text-[#3B7A57] transition-colors">
                                      {evt.title}
                                    </h3>

                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                      <span className="flex items-center space-x-1">
                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                        <span>
                                          {eventDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                                        </span>
                                      </span>
                                      <span className="flex items-center space-x-1">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="truncate max-w-[200px]">{evt.location}</span>
                                      </span>
                                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                                        {evt.isPaid ? `Rp ${(evt.price || 0).toLocaleString("id-ID")}` : "Free"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Right Tickets Progress & Quick Action Buttons */}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                                  {/* Ticket Sales Mini Bar */}
                                  <div className="w-full sm:w-44 space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-slate-500 dark:text-slate-400 font-medium">Tiket Terjual:</span>
                                      <span className="font-bold text-slate-900 dark:text-white">
                                        {ticketsPaid} / {totalCapacity}
                                      </span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-[#3B7A57]"
                                        style={{ width: `${occupancyRate}%` }}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                                      <span>Hadir: {checkedInTickets}/{ticketsPaid || 0}</span>
                                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                        Rp {grossSales.toLocaleString("id-ID")}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                                    {evt.status === "APPROVED" && (
                                      <Link href={`/events/${evt.id}`} target="_blank">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="text-xs h-8 px-2.5 rounded-lg border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#3B7A57] cursor-pointer"
                                          title="Lihat halaman detail event publik"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </Button>
                                      </Link>
                                    )}

                                    {evt.status === "REVISION_REQUESTED" && (
                                      <Button
                                        size="sm"
                                        onClick={() => openRevisionModal(evt)}
                                        className="text-xs h-8 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold cursor-pointer"
                                      >
                                        <FileEdit className="w-3.5 h-3.5 mr-1" />
                                        <span>Revisi</span>
                                      </Button>
                                    )}

                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedEventId(evt.id);
                                        setActiveNav("ATTENDEES");
                                      }}
                                      className="text-xs h-8 px-3 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold cursor-pointer"
                                    >
                                      <Users className="w-3.5 h-3.5 mr-1" />
                                      <span>Peserta ({eventBookings.length})</span>
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* =============================================================
                      CALENDAR VIEW: Month Grid Calendar View
                     ============================================================= */}
                  {eventViewMode === "CALENDAR" && (
                    <Card className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4">
                      {/* Calendar Navigation Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center space-x-2">
                          <CalendarIcon className="w-5 h-5 text-[#3B7A57]" />
                          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                            {calendarDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                          </h2>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const prev = new Date(calendarDate);
                              prev.setMonth(prev.getMonth() - 1);
                              setCalendarDate(prev);
                            }}
                            className="h-8 w-8 p-0 rounded-lg border-slate-200 dark:border-slate-800 cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCalendarDate(new Date())}
                            className="text-xs h-8 px-2.5 rounded-lg border-slate-200 dark:border-slate-800 cursor-pointer"
                          >
                            Hari Ini
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const next = new Date(calendarDate);
                              next.setMonth(next.getMonth() + 1);
                              setCalendarDate(next);
                            }}
                            className="h-8 w-8 p-0 rounded-lg border-slate-200 dark:border-slate-800 cursor-pointer"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Day Names Grid */}
                      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 py-1 uppercase">
                        <div>Min</div>
                        <div>Sen</div>
                        <div>Sel</div>
                        <div>Rab</div>
                        <div>Kam</div>
                        <div>Jum</div>
                        <div>Sab</div>
                      </div>

                      {/* Calendar Days Matrix */}
                      <div className="grid grid-cols-7 gap-1.5">
                        {calendarDays.map((item, idx) => {
                          if (!item.day) {
                            return (
                              <div
                                key={`empty-${idx}`}
                                className="min-h-24 p-1.5 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-transparent"
                              />
                            );
                          }

                          const isToday =
                            new Date().toISOString().split("T")[0] === item.dateStr;

                          return (
                            <div
                              key={`day-${item.day}`}
                              className={`min-h-24 p-2 rounded-xl border flex flex-col justify-between transition-all ${
                                isToday
                                  ? "bg-[#3B7A57]/5 border-[#3B7A57]/40 dark:bg-[#3B7A57]/10"
                                  : "bg-white dark:bg-[#1E293B] border-slate-100 dark:border-slate-800"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className={`text-xs font-black ${
                                    isToday
                                      ? "text-[#3B7A57]"
                                      : "text-slate-700 dark:text-slate-300"
                                  }`}
                                >
                                  {item.day}
                                </span>
                                {item.events.length > 0 && (
                                  <span className="w-2 h-2 rounded-full bg-[#3B7A57]" />
                                )}
                              </div>

                              {/* Event Badges on this day */}
                              <div className="space-y-1 mt-1">
                                {item.events.slice(0, 2).map((e) => (
                                  <div
                                    key={e.id}
                                    onClick={() => {
                                      setSelectedEventId(e.id);
                                      setActiveNav("ATTENDEES");
                                    }}
                                    className="p-1 rounded-md bg-[#3B7A57]/10 dark:bg-[#3B7A57]/20 text-[#3B7A57] dark:text-[#52B788] text-[10px] font-bold truncate cursor-pointer hover:underline"
                                    title={`${e.title} (${e.location})`}
                                  >
                                    {e.title}
                                  </div>
                                ))}
                                {item.events.length > 2 && (
                                  <span className="text-[9px] text-slate-400 font-semibold block">
                                    +{item.events.length - 2} event lainnya
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}
                </>
              ) : (
                /* Collections & Category View */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Array.from(new Set(portalData?.events.map((e) => e.category) || [])).map((cat) => {
                    const catEvents = (portalData?.events || []).filter((e) => e.category === cat);
                    return (
                      <Card
                        key={cat}
                        className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs font-bold border-[#3B7A57]/40 text-[#3B7A57]">
                            {cat}
                          </Badge>
                          <span className="text-xs font-bold text-slate-400">
                            {catEvents.length} Event
                          </span>
                        </div>
                        <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                          {catEvents.map((e) => (
                            <li key={e.id} className="truncate">
                              • {e.title}
                            </li>
                          ))}
                        </ul>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              VIEW 2: ATTENDEES & CHECK-IN (Orders Management)
             ========================================================================= */}
          {activeNav === "ATTENDEES" && (
            <Card className="p-5 sm:p-6 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl space-y-5 shadow-xs">
              {/* Header Attendees */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    Daftar Peserta & Meja Check-In
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Mendukung Partial Check-In QTY: kehadiran dapat dicatat bertahap untuk pemesanan rombongan.
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={handleExportCSV}
                  disabled={filteredAttendees.length === 0}
                  className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold px-3.5 rounded-xl cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  <span>Ekspor CSV</span>
                </Button>
              </div>

              {/* Filtering & Search Row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                {/* Event Selector */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-slate-500">Filter Event:</span>
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    aria-label="Pilih filter event"
                    className="text-xs font-bold py-1.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">Semua Event ({portalData?.bookings.length || 0} Tiket)</option>
                    {portalData?.events.map((evt) => (
                      <option key={evt.id} value={evt.id}>
                        {evt.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Attendee search bar */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={attendeeSearch}
                    onChange={(e) => setAttendeeSearch(e.target.value)}
                    placeholder="Cari kode tiket, nama, instansi..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                  />
                </div>
              </div>

              {/* Attendees Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                {filteredAttendees.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400">
                    Tidak ada peserta yang cocok dengan filter atau kata kunci pencarian ini.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-3">Kode Tiket</th>
                        <th className="py-3 px-3">Peserta & Kontak</th>
                        <th className="py-3 px-3">Event</th>
                        <th className="py-3 px-3 text-center">Tiket</th>
                        <th className="py-3 px-3 text-center">Status Bayar</th>
                        <th className="py-3 px-3 text-center">Progres Hadir</th>
                        <th className="py-3 px-3 text-right">Aksi Check-In</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {filteredAttendees.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                            {b.ticketCode}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 dark:text-white">{b.guestName}</div>
                            <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 mt-0.5">
                              <span>{b.guestPhone}</span>
                              {b.institution && (
                                <>
                                  <span>•</span>
                                  <span>{b.institution}</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 max-w-[180px] truncate text-slate-600 dark:text-slate-300">
                            {b.eventTitle}
                          </td>
                          <td className="py-3 px-3 text-center font-bold">
                            {b.ticketCount} Pax
                          </td>
                          <td className="py-3 px-3 text-center">
                            {b.paymentStatus === "PAID" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                Lunas (PAID)
                              </span>
                            ) : b.paymentStatus === "CANCELLED" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                Batal
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                PENDING
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {b.checkInStatus === "CHECKED_IN" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <Check className="w-3 h-3 mr-1" />
                                {b.ticketCount > 1
                                  ? `${b.checkedInQty ?? b.ticketCount}/${b.ticketCount} Selesai`
                                  : "Hadir"}
                              </span>
                            ) : b.checkInStatus === "PARTIALLY_CHECKED_IN" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                                <Clock3 className="w-3 h-3 mr-1" />
                                {b.checkedInQty ?? 0}/{b.ticketCount} Hadir (Sisa {(b.ticketCount || 1) - (b.checkedInQty || 0)})
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                0/{b.ticketCount} Hadir
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {b.paymentStatus === "CANCELLED" ? (
                                <Button
                                  size="sm"
                                  disabled
                                  className="h-7 px-2.5 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                                >
                                  Dibatalkan
                                </Button>
                              ) : (b.checkedInQty || (b.checkInStatus === "CHECKED_IN" ? b.ticketCount : 0)) < b.ticketCount ? (
                                <Button
                                  size="sm"
                                  disabled={
                                    isUpdatingCheckIn === b.id ||
                                    (b.paymentStatus === "PENDING" && b.totalPrice > 0)
                                  }
                                  onClick={() => handleCheckInTicket(b, "INCREMENT")}
                                  className={`h-7 px-2.5 text-[11px] font-semibold rounded-lg ${
                                    b.paymentStatus === "PENDING" && b.totalPrice > 0
                                      ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700"
                                      : "bg-[#3B7A57] hover:bg-[#2E6044] text-white shadow-xs cursor-pointer"
                                  }`}
                                >
                                  {isUpdatingCheckIn === b.id ? (
                                    <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                                  ) : (
                                    <UserCheck className="w-3 h-3 mr-1" />
                                  )}
                                  <span>
                                    {b.paymentStatus === "PENDING" && b.totalPrice > 0
                                      ? "Belum Lunas"
                                      : b.ticketCount > 1
                                      ? `+ Check-In 1 (${(b.checkedInQty || 0) + 1}/${b.ticketCount})`
                                      : "Tandai Hadir"}
                                  </span>
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  disabled={isUpdatingCheckIn === b.id}
                                  onClick={() => handleCheckInTicket(b, "RESET")}
                                  className="h-7 px-2.5 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                                >
                                  {isUpdatingCheckIn === b.id ? (
                                    <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                                  ) : (
                                    <RotateCcw className="w-3 h-3 mr-1" />
                                  )}
                                  <span>Reset Hadir</span>
                                </Button>
                              )}

                              {b.checkInStatus === "PARTIALLY_CHECKED_IN" && (b.checkedInQty || 0) > 0 && (
                                <button
                                  type="button"
                                  disabled={isUpdatingCheckIn === b.id}
                                  onClick={() => handleCheckInTicket(b, "RESET")}
                                  className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Reset seluruh kehadiran ke 0"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          )}

          {/* =========================================================================
              VIEW 3: FINANCE & PAYOUT (Bagi Hasil 80% Penyelenggara)
             ========================================================================= */}
          {activeNav === "FINANCE" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                    Payout & Hak Bagi Hasil
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Transparansi pembagian revenue tiket: 80% untuk Komunitas Penyelenggara & 20% untuk Dago Hub.
                  </p>
                </div>
              </div>

              {/* Revenue Big Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Omset Penjualan</span>
                  <div className="text-3xl font-black text-slate-900 dark:text-white">
                    Rp {(portalData?.summary.grossRevenue || 0).toLocaleString("id-ID")}
                  </div>
                  <p className="text-[11px] text-slate-400">Dari {portalData?.summary.totalTicketsSold || 0} tiket lunas</p>
                </Card>

                <Card className="p-5 bg-white dark:bg-[#0F172A] border border-emerald-200 dark:border-emerald-900/50 rounded-3xl space-y-2 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Hak Payout Penyelenggara (80%)
                  </span>
                  <div className="text-3xl font-black text-[#3B7A57] dark:text-[#52B788]">
                    Rp {(portalData?.summary.organizerPayoutAmount || 0).toLocaleString("id-ID")}
                  </div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Ditransfer berkala pasca-event selesai
                  </p>
                </Card>

                <Card className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Bagi Hasil Dago Hub (20%)
                  </span>
                  <div className="text-3xl font-black text-slate-700 dark:text-slate-300">
                    Rp {(portalData?.summary.platformFeeAmount || 0).toLocaleString("id-ID")}
                  </div>
                  <p className="text-[11px] text-slate-400">Pemeliharaan venue & sistem tiket</p>
                </Card>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 4: HOME (Ringkasan Metrik / KPI Overview)
             ========================================================================= */}
          {activeNav === "HOME" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  Dashboard Overview
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Selamat datang kembali, {portalData?.summary.organizerName || "Komunitas"}. Berikut rangkuman performa event Anda.
                </p>
              </div>

              {/* KPI 4 Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                <Card className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Total Event</span>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                    {portalData?.summary.totalEvents || 0}
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                    {portalData?.summary.approvedEvents || 0} Tayang Live
                  </span>
                </Card>

                <Card className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Tiket Terjual</span>
                  <div className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400">
                    {portalData?.summary.totalTicketsSold || 0}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    {portalData?.summary.totalAttendees || 0} Pemesan
                  </span>
                </Card>

                <Card className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Hak Payout (80%)</span>
                  <div className="text-xl sm:text-2xl font-black text-[#3B7A57] dark:text-[#52B788]">
                    Rp {(portalData?.summary.organizerPayoutAmount || 0).toLocaleString("id-ID")}
                  </div>
                  <span className="text-[11px] text-emerald-600 mt-1 block font-medium">Estimasi Dana Komunitas</span>
                </Card>

                <Card className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Aksi Cepat</span>
                  <div className="space-y-1.5 pt-1">
                    <Button
                      size="sm"
                      onClick={() => setActiveNav("EVENTS")}
                      className="w-full text-xs h-7 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
                    >
                      Buka Kelola Events
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =========================================================================
          3. REVISION MODAL
         ========================================================================= */}
      {revisionEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider block">
                  Perbaiki & Ajukan Ulang Event
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {revisionEvent.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRevisionEvent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {revisionEvent.revisionNotes && (
              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 text-xs text-sky-800 dark:text-sky-300">
                <span className="font-bold block mb-1">Catatan Kurator:</span>
                <p className="text-[11px] leading-relaxed">{revisionEvent.revisionNotes}</p>
              </div>
            )}

            <form onSubmit={handleSaveRevision} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Judul Acara
                </label>
                <input
                  type="text"
                  required
                  value={revisionTitle}
                  onChange={(e) => setRevisionTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lokasi Venue
                </label>
                <input
                  type="text"
                  required
                  value={revisionLocation}
                  onChange={(e) => setRevisionLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Deskripsi Lengkap
                </label>
                <textarea
                  required
                  rows={4}
                  value={revisionDesc}
                  onChange={(e) => setRevisionDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] resize-y"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRevisionEvent(null)}
                  className="text-xs border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingRevision}
                  className="text-xs font-bold bg-[#3B7A57] hover:bg-[#2E6044] text-white rounded-xl cursor-pointer"
                >
                  {isSubmittingRevision ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  <span>Kirim Revisi ke Kurator</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
