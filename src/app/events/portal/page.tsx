"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
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
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CommunityEvent, EventTicketOrder, OrganizerPortalData } from "@/types/event";
import { useAuth, PersonaKey } from "@/contexts/AuthContext";

const PRESET_ORGANIZERS = [
  { name: "Dago Barista Guild", email: "baristaguild@dagocreative.id", persona: "COMMUNITY_BARISTA" as PersonaKey },
  { name: "Bandung Dev Community", email: "halo@bandungdev.org", persona: "COMMUNITY_BANDUNGDEV" as PersonaKey },
  { name: "Aksara Priangan Studio", email: "info@aksarapriangan.id", persona: "COMMUNITY_AKSARAPRIANGAN" as PersonaKey },
  { name: "Dago Berkebun", email: "kontak@dagohijau.id", persona: undefined },
];

const EMAIL_TO_PERSONA: Record<string, PersonaKey> = {
  "baristaguild@dagocreative.id": "COMMUNITY_BARISTA",
  "halo@bandungdev.org": "COMMUNITY_BANDUNGDEV",
  "info@aksarapriangan.id": "COMMUNITY_AKSARAPRIANGAN",
};

export default function CommunityOrganizerPortalPage() {
  const { user, switchPersona } = useAuth();
  const [organizerEmail, setOrganizerEmail] = useState("");
  const [activeEmail, setActiveEmail] = useState("");
  const [portalData, setPortalData] = useState<OrganizerPortalData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active view tab in portal
  const [portalTab, setPortalTab] = useState<"EVENTS" | "ATTENDEES">("EVENTS");

  // Attendees filtering
  const [selectedEventId, setSelectedEventId] = useState<string>("ALL");
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [isUpdatingCheckIn, setIsUpdatingCheckIn] = useState<string | null>(null);

  // Revision modal
  const [revisionEvent, setRevisionEvent] = useState<CommunityEvent | null>(null);
  const [revisionTitle, setRevisionTitle] = useState("");
  const [revisionDesc, setRevisionDesc] = useState("");
  const [revisionLocation, setRevisionLocation] = useState("");
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);

  // Synchronize on mount or user changes
  useEffect(() => {
    if (user?.email) {
      setOrganizerEmail(user.email);
      loadPortalData(user.email);
    } else {
      // Default initial view: attempt to load Barista Guild
      const defaultEmail = PRESET_ORGANIZERS[0].email;
      setOrganizerEmail(defaultEmail);
      loadPortalData(defaultEmail);
    }
  }, [user?.email, user?.role?.slug]);

  const loadPortalData = async (email: string) => {
    if (!email || !email.includes("@")) {
      setErrorMessage("Masukkan alamat email yang valid.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const res = await fetch(`/api/events/portal?email=${encodeURIComponent(email)}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMessage(json.error || "Gagal memuat portal komunitas.");
        setPortalData(null);
        return;
      }

      setPortalData(json.data);
      setActiveEmail(email);
      localStorage.setItem("dago_organizer_email", email);
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

  const handleSelectPreset = async (preset: typeof PRESET_ORGANIZERS[0]) => {
    setOrganizerEmail(preset.email);
    const isHubAdmin =
      user?.role?.slug === "SUPER_ADMIN" ||
      user?.role?.slug === "OWNER" ||
      user?.role?.slug === "MANAGER";

    if (!isHubAdmin && preset.persona) {
      await switchPersona(preset.persona);
    }
    await loadPortalData(preset.email);
  };

  const handleCheckInToggle = async (booking: EventTicketOrder) => {
    if (!activeEmail || booking.paymentStatus === "CANCELLED") return;
    try {
      setIsUpdatingCheckIn(booking.id);
      const nextStatus = booking.checkInStatus === "CHECKED_IN" ? "REGISTERED" : "CHECKED_IN";

      const res = await fetch("/api/events/portal/check-in", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: activeEmail,
          bookingId: booking.id,
          checkInStatus: nextStatus,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error || "Gagal memperbarui status check-in.");
        return;
      }

      // Update state locally
      if (portalData) {
        setPortalData({
          ...portalData,
          bookings: portalData.bookings.map((b) =>
            b.id === booking.id
              ? {
                  ...b,
                  checkInStatus: nextStatus,
                  checkInTime: nextStatus === "CHECKED_IN" ? new Date().toISOString() : null,
                }
              : b
          ),
        });
      }

      setSuccessMessage(
        nextStatus === "CHECKED_IN"
          ? `Peserta ${booking.guestName} berhasil ditandai hadir!`
          : `Kehadiran peserta ${booking.guestName} dibatalkan.`
      );
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

  // Filtered attendees for the active tab
  const filteredAttendees = useMemo(() => {
    if (!portalData) return [];
    return portalData.bookings.filter((b) => {
      const matchesEvent = selectedEventId === "ALL" || b.eventId === selectedEventId;
      const q = attendeeSearch.toLowerCase();
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
      [headers.join(","), ...rows.map((e) => e.map((val) => `"${val}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `peserta-komunitas-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-[#1E293B] dark:text-[#E2E8F0] transition-colors duration-200">
      {/* 1. Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-[#0F172A]/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/events" className="flex items-center space-x-2 text-xs font-semibold text-slate-500 hover:text-[#3B7A57] dark:hover:text-[#52B788] transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span>Marketplace Event</span>
            </Link>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 relative">
                <Image src="/logo-dago.png" alt="Dago Logo" width={28} height={28} className="object-contain" />
              </div>
              <span className="font-extrabold text-xs sm:text-sm tracking-tight text-slate-900 dark:text-white">
                Portal Komunitas <span className="text-[#3B7A57] dark:text-[#52B788]">Penyelenggara</span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <ThemeToggle variant="pill" />
            <Link href="/events/submit">
              <Button size="sm" className="text-xs h-9 px-3.5 font-bold bg-[#3B7A57] hover:bg-[#2E6044] text-white rounded-xl shadow-xs">
                <span>+ Ajukan Event Baru</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Alerts */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="p-1 hover:text-rose-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="p-1 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 2. Organizer Switcher & Verification Header */}
        <Card className="p-5 sm:p-6 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[#3B7A57] dark:text-[#52B788] text-[10px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Akses Mandiri Terverifikasi Server</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {portalData?.summary.organizerName || "Portal Komunitas Dago Hub"}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Akses terisolasi untuk memantau pengajuan event, penjualan tiket, estimasi hak bagi hasil 80%, dan check-in peserta.
              </p>
            </div>

            {/* Email Switcher Form */}
            <form onSubmit={handleOrganizerSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={organizerEmail}
                  onChange={(e) => setOrganizerEmail(e.target.value)}
                  placeholder="Email Penyelenggara..."
                  className="w-full sm:w-64 pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                <span>Buka Portal</span>
              </Button>
            </form>
          </div>

          {/* Quick preset switches for demo / evaluation */}
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Komunitas Terdaftar:</span>
            {PRESET_ORGANIZERS.map((preset) => (
              <button
                key={preset.email}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
                  activeEmail === preset.email
                    ? "bg-[#3B7A57] text-white border-[#3B7A57] shadow-xs"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </Card>

        {portalData && (
          <>
            {/* 3. KPI Metrics Dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="p-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Event Anda</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {portalData.summary.totalEvents} <span className="text-xs font-normal text-slate-400">Event</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center space-x-2">
                  <span className="text-emerald-600 font-bold">{portalData.summary.approvedEvents} Disetujui</span>
                  <span>•</span>
                  <span>{portalData.summary.pendingEvents} Antrean</span>
                </div>
              </Card>

              <Card className="p-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tiket Terjual (PAID)</span>
                  <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Ticket className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-sky-700 dark:text-sky-400">
                  {portalData.summary.totalTicketsSold} <span className="text-xs font-normal text-slate-400">Tiket</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Dari {portalData.summary.totalAttendees} pesanan terverifikasi
                </div>
              </Card>

              {(() => {
                const orgPercent = portalData.summary.grossRevenue > 0
                  ? Math.round((portalData.summary.organizerPayoutAmount / portalData.summary.grossRevenue) * 100)
                  : 80;
                const dagoPercent = 100 - orgPercent;

                return (
                  <>
                    <Card className="p-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                      <div className="flex items-center justify-between pb-2">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          Hak Payout Anda ({orgPercent}%)
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl font-black text-[#3B7A57] dark:text-[#52B788]">
                        Rp {portalData.summary.organizerPayoutAmount.toLocaleString("id-ID")}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-medium mt-1">
                        {orgPercent}% dari total omset tiket Rp {portalData.summary.grossRevenue.toLocaleString("id-ID")}
                      </div>
                    </Card>

                    <Card className="p-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                      <div className="flex items-center justify-between pb-2">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          Bagi Hasil Dago ({dagoPercent}%)
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                          <DollarSign className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl font-black text-slate-700 dark:text-slate-300">
                        Rp {portalData.summary.platformFeeAmount.toLocaleString("id-ID")}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Dukungan venue & platform Dago Hub
                      </div>
                    </Card>
                  </>
                );
              })()}
            </div>

            {/* 4. Tab Navigation */}
            <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setPortalTab("EVENTS")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  portalTab === "EVENTS"
                    ? "bg-[#3B7A57] text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Event Milik Saya ({portalData.events.length})
              </button>
              <button
                type="button"
                onClick={() => setPortalTab("ATTENDEES")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  portalTab === "ATTENDEES"
                    ? "bg-[#3B7A57] text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Daftar Peserta & Check-In ({portalData.bookings.length})
              </button>
            </div>

            {/* TAB 1: EVENTS */}
            {portalTab === "EVENTS" && (
              <div className="space-y-4">
                {portalData.events.length === 0 ? (
                  <Card className="p-12 text-center bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl">
                    <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Belum Ada Event Terdaftar</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                      Komunitas Anda belum memiliki pengajuan event dengan email ini. Silakan pasang event komunitas pertama Anda.
                    </p>
                    <Link href="/events/submit">
                      <Button className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold px-4 py-2 rounded-xl">
                        Pasang Event Sekarang
                      </Button>
                    </Link>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {portalData.events.map((evt) => {
                      const eventBookings = portalData.bookings.filter((b) => b.eventId === evt.id);
                      const paidBookings = eventBookings.filter((b) => b.paymentStatus === "PAID");
                      const ticketsSold = paidBookings.reduce((s, b) => s + b.ticketCount, 0);
                      const grossSales = paidBookings.reduce((s, b) => s + b.totalPrice, 0);
                      const payoutEst = paidBookings.reduce((s, b) => s + b.organizerRevenueAmount, 0);

                      return (
                        <Card
                          key={evt.id}
                          className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4"
                        >
                          <div className="space-y-3">
                            {/* Badges & Status */}
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-[10px] font-bold border-emerald-300 dark:border-emerald-800 text-[#3B7A57] dark:text-[#52B788]">
                                {evt.category}
                              </Badge>

                              {evt.status === "APPROVED" && (
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                  ● TAYANG DI MARKETPLACE
                                </Badge>
                              )}
                              {evt.status === "PENDING" && (
                                <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                                  ⏳ MENUNGGU REVIEW KURATOR
                                </Badge>
                              )}
                              {evt.status === "REVISION_REQUESTED" && (
                                <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 text-[10px] font-bold">
                                  ✏️ PERLU REVISI
                                </Badge>
                              )}
                              {evt.status === "REJECTED" && (
                                <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-[10px] font-bold">
                                  ✕ DITOLAK
                                </Badge>
                              )}
                            </div>

                            {/* Title & Info */}
                            <div>
                              <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-2">
                                {evt.title}
                              </h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                {evt.description}
                              </p>
                            </div>

                            {/* Details meta */}
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                              <div className="flex items-center space-x-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span className="truncate">
                                  {new Date(evt.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1.5">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{evt.location}</span>
                              </div>
                              <div className="flex items-center space-x-1.5">
                                <Ticket className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {evt.isPaid ? `Rp ${(evt.price || 0).toLocaleString("id-ID")}` : "Gratis"}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1.5">
                                <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span>{ticketsSold} Tiket Terjual</span>
                              </div>
                            </div>

                            {/* Revision notes banner if requested */}
                            {evt.status === "REVISION_REQUESTED" && evt.revisionNotes && (
                              <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/50 rounded-xl text-xs text-sky-800 dark:text-sky-300 space-y-1">
                                <span className="font-bold block">Catatan Tim Kurator Dago Hub:</span>
                                <p className="text-[11px]">{evt.revisionNotes}</p>
                              </div>
                            )}

                            {/* Rejection reason banner */}
                            {evt.status === "REJECTED" && evt.rejectionReason && (
                              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl text-xs text-rose-800 dark:text-rose-300 space-y-1">
                                <span className="font-bold block">Alasan Penolakan:</span>
                                <p className="text-[11px]">{evt.rejectionReason}</p>
                              </div>
                            )}

                            {/* Revenue metrics row for paid events */}
                            {evt.isPaid && (
                              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                                <div>
                                  <span className="text-[10px] text-slate-400 block">Omset Tiket:</span>
                                  <span className="font-bold text-slate-800 dark:text-slate-200">
                                    Rp {grossSales.toLocaleString("id-ID")}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-emerald-600 block">Hak Komunitas (80%):</span>
                                  <span className="font-bold text-[#3B7A57] dark:text-[#52B788]">
                                    Rp {payoutEst.toLocaleString("id-ID")}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                            {evt.status === "REVISION_REQUESTED" ? (
                              <Button
                                size="sm"
                                onClick={() => openRevisionModal(evt)}
                                className="w-full text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl"
                              >
                                <FileEdit className="w-3.5 h-3.5 mr-1.5" />
                                <span>Perbaiki & Ajukan Ulang</span>
                              </Button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedEventId(evt.id);
                                    setPortalTab("ATTENDEES");
                                  }}
                                  className="text-xs font-semibold text-[#3B7A57] dark:text-[#52B788] hover:underline"
                                >
                                  Kelola Peserta ({eventBookings.length})
                                </button>
                                {evt.status === "APPROVED" && (
                                  <Link href={`/events/${evt.id}`} target="_blank">
                                    <Button size="sm" variant="outline" className="h-8 text-xs border-slate-200 dark:border-slate-700 rounded-xl">
                                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                      <span>Lihat Publik</span>
                                    </Button>
                                  </Link>
                                )}
                              </>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ATTENDEES & CHECK-IN */}
            {portalTab === "ATTENDEES" && (
              <Card className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                {/* Search & Event Filter Header */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
                    <select
                      value={selectedEventId}
                      onChange={(e) => setSelectedEventId(e.target.value)}
                      className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#3B7A57]"
                    >
                      <option value="ALL">Semua Event ({portalData.events.length})</option>
                      {portalData.events.map((evt) => (
                        <option key={evt.id} value={evt.id}>
                          {evt.title}
                        </option>
                      ))}
                    </select>

                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={attendeeSearch}
                        onChange={(e) => setAttendeeSearch(e.target.value)}
                        placeholder="Cari nama peserta, kode tiket, atau instansi..."
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#3B7A57]"
                      />
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportCSV}
                    disabled={filteredAttendees.length === 0}
                    className="text-xs font-bold border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    <span>Ekspor CSV</span>
                  </Button>
                </div>

                {/* Attendees Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                  {filteredAttendees.length === 0 ? (
                    <div className="p-12 text-center">
                      <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Belum ada peserta yang cocok dengan filter atau pencarian.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/70 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-100 dark:border-slate-800">
                          <th className="py-2.5 px-3">Kode Tiket</th>
                          <th className="py-2.5 px-3">Nama Peserta</th>
                          <th className="py-2.5 px-3">Kontak (Masked)</th>
                          <th className="py-2.5 px-3 text-center">Qty</th>
                          <th className="py-2.5 px-3">Status Bayar</th>
                          <th className="py-2.5 px-3 text-center">Kehadiran</th>
                          <th className="py-2.5 px-3 text-right">Aksi Check-In</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {filteredAttendees.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-[#3B7A57] dark:text-[#52B788] whitespace-nowrap">
                              {b.ticketCode}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-900 dark:text-white block">{b.guestName}</span>
                              {b.institution && <span className="text-[10px] text-slate-400 block">{b.institution}</span>}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px]">
                              <span className="text-slate-700 dark:text-slate-300 block">{b.guestPhone}</span>
                              <span className="text-slate-400 text-[10px] block">{b.guestEmail}</span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                              {b.ticketCount}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {b.paymentStatus === "PAID" ? (
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">
                                  LUNAS
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[10px]">
                                  {b.paymentStatus}
                                </Badge>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {b.checkInStatus === "CHECKED_IN" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  <Check className="w-3 h-3 mr-1" /> Hadir
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  Belum Hadir
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <Button
                                size="sm"
                                disabled={isUpdatingCheckIn === b.id || b.paymentStatus === "CANCELLED"}
                                onClick={() => handleCheckInToggle(b)}
                                className={`h-7 px-2.5 text-[11px] font-semibold rounded-lg ${
                                  b.paymentStatus === "CANCELLED"
                                    ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-800"
                                    : b.checkInStatus === "CHECKED_IN"
                                    ? "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                                    : "bg-[#3B7A57] hover:bg-[#2E6044] text-white shadow-xs cursor-pointer"
                                }`}
                                title={b.paymentStatus === "CANCELLED" ? "Tiket yang dibatalkan tidak dapat check-in" : undefined}
                              >
                                {isUpdatingCheckIn === b.id ? (
                                  <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                                ) : b.paymentStatus === "CANCELLED" ? (
                                  <X className="w-3 h-3 mr-1" />
                                ) : b.checkInStatus === "CHECKED_IN" ? (
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                ) : (
                                  <UserCheck className="w-3 h-3 mr-1" />
                                )}
                                <span>
                                  {b.paymentStatus === "CANCELLED"
                                    ? "Dibatalkan"
                                    : b.checkInStatus === "CHECKED_IN"
                                    ? "Batalkan"
                                    : "Tandai Hadir"}
                                </span>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </Card>
            )}
          </>
        )}
      </main>

      {/* 5. Revision Modal */}
      {revisionEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#1E293B] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
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
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                  className="text-xs border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingRevision}
                  className="text-xs font-bold bg-[#3B7A57] hover:bg-[#2E6044] text-white rounded-xl"
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
