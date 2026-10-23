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
import { CommunityEvent, EventTicketOrder, OrganizerPortalData, AttendeeCheckInStatus } from "@/types/event";
import { resolveVenueCapacity } from "@/lib/event-capacity";
import { useAuth, PersonaKey } from "@/contexts/AuthContext";

export default function CommunityOrganizerPortalPage() {
  const { user } = useAuth();
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
    // If user email exists in context, try that; otherwise call without query param to let server session resolve!
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
        // Self-heal: If 403 Data Isolation error occurs due to stale query email from previous login session,
        // clear stale storage and re-fetch using authenticated server session cookie!
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

      // Update state locally
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

        {/* 2. Organizer Profile & Verification Header */}
        <Card className="p-5 sm:p-6 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[#3B7A57] dark:text-[#52B788] text-[10px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  {portalData?.isAdmin
                    ? "Mode Supervisi Administrator Hub"
                    : "Dashboard Penyelenggara Terverifikasi"}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {portalData?.summary.organizerName || "Portal Komunitas Dago Hub"}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {portalData?.isAdmin
                  ? "Akses pengawasan platform untuk memantau aktivitas, penjualan tiket, dan operasional seluruh komunitas."
                  : "Akses terisolasi untuk memantau pengajuan event, penjualan tiket, estimasi hak bagi hasil 80%, dan check-in peserta."}
              </p>
            </div>

            {/* Profile Action Area: Clean Personal View for Organizer, Switcher for Hub Admin */}
            {portalData?.isAdmin ? (
              <form onSubmit={handleOrganizerSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={organizerEmail}
                    onChange={(e) => setOrganizerEmail(e.target.value)}
                    placeholder="Email Komunitas..."
                    className="w-full sm:w-64 pl-9 pr-3 py-2 text-xs rounded-xl border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
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
            ) : (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                  <Mail className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{activeEmail || organizerEmail}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadPortalData(activeEmail || organizerEmail)}
                  disabled={isLoading}
                  className="text-xs h-9 px-3 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title="Segarkan data terbaru"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-600 dark:text-slate-300 ${isLoading ? "animate-spin" : ""}`} />
                  <span className="ml-1.5 hidden sm:inline text-xs font-medium text-slate-700 dark:text-slate-300">Segarkan</span>
                </Button>
              </div>
            )}
          </div>

          {/* Hub Admin Supervisor Navigation: Only shown when logged in as Platform Admin */}
          {portalData?.isAdmin && portalData.accessibleCommunities && portalData.accessibleCommunities.length > 0 && (
            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Pilih Komunitas (Supervisi Hub):
              </span>
              {portalData.accessibleCommunities.map((comm) => (
                <button
                  key={comm.email}
                  type="button"
                  onClick={() => handleSelectCommunity(comm)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
                    activeEmail === comm.email
                      ? "bg-[#3B7A57] text-white border-[#3B7A57] shadow-xs"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                  }`}
                >
                  {comm.name}
                </button>
              ))}
            </div>
          )}
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
                      // Anti-double-counting: pesanan CANCELLED tidak mengurangi kuota
                      const activeBookings = eventBookings.filter((b) => b.paymentStatus !== "CANCELLED");
                      const paidBookings = activeBookings.filter((b) => b.paymentStatus === "PAID");
                      const cancelledBookings = eventBookings.filter((b) => b.paymentStatus === "CANCELLED");

                      // Audit Kapasitas: pisahkan angka resmi vs estimasi sementara
                      const capacityRes = resolveVenueCapacity(evt);
                      const totalCapacity = capacityRes.capacity;
                      const isConfirmed = capacityRes.isConfirmed;

                      // Metrik kuota tiket:
                      // - ticketsReserved: seluruh tiket aktif (PAID + PENDING)
                      // - ticketsPaid: hanya tiket yang terverifikasi lunas
                      // - ticketsRemaining: sisa kuota yang masih dapat dipesan
                      const ticketsReserved = activeBookings.reduce((s, b) => s + b.ticketCount, 0);
                      const ticketsPaid = paidBookings.reduce((s, b) => s + b.ticketCount, 0);
                      const ticketsRemaining = Math.max(0, totalCapacity - ticketsReserved);
                      const occupancyRate = totalCapacity > 0 ? Math.min(100, Math.round((ticketsReserved / totalCapacity) * 100)) : 0;

                      // Progres Check-In aktual di venue (menghitung tiket fisik yang hadir secara parsial / penuh)
                      const checkedInTickets = paidBookings.reduce(
                        (sum, b) =>
                          sum +
                          (b.checkedInQty ??
                            (b.checkInStatus === "CHECKED_IN" ? b.ticketCount : 0)),
                        0
                      );
                      const eligibleTicketsCount = ticketsPaid;
                      const checkInRate =
                        eligibleTicketsCount > 0
                          ? Math.round((checkedInTickets / eligibleTicketsCount) * 100)
                          : 0;

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
                                <span>{ticketsPaid} Tiket Lunas</span>
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

                            {/* SECTION KUOTA TIKET & PROGRES CHECK-IN */}
                            <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-3">
                              {/* Header Status Kapasitas Venue */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center space-x-1.5 min-w-0">
                                  {isConfirmed ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                                      <ShieldCheck className="w-3 h-3 mr-1 text-emerald-600 dark:text-emerald-400" />
                                      Kapasitas Resmi: {totalCapacity} Pax
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300" title={capacityRes.sourceDescription}>
                                      <AlertCircle className="w-3 h-3 mr-1 text-amber-600 dark:text-amber-400" />
                                      Estimasi Ruang: ~{totalCapacity} Pax (Belum Dikonfirmasi)
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 flex-shrink-0">
                                  {isConfirmed ? (evt.maxCapacity ? "Kuota Penyelenggara" : "Master Coworking") : "Estimasi Sementara"}
                                </span>
                              </div>

                              {/* 4 Metrik Utama Kuota & Tiket */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div className="p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 text-center">
                                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">Total Kuota</span>
                                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{totalCapacity}</span>
                                  <span className="text-[9px] text-slate-400 block truncate">
                                    {isConfirmed ? "Resmi" : "Perkiraan"}
                                  </span>
                                </div>

                                <div className="p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 text-center">
                                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">
                                    {evt.isPaid ? "Tiket Terbit" : "Tiket Terdaftar"}
                                  </span>
                                  <span className="text-sm font-bold text-[#3B7A57] dark:text-[#52B788]">{ticketsReserved}</span>
                                  <span className="text-[9px] text-slate-400 block truncate">
                                    {evt.isPaid ? `${ticketsPaid} lunas` : "Terdaftar"}
                                  </span>
                                </div>

                                <div className="p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 text-center">
                                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">Sisa Kuota</span>
                                  <span className={`text-sm font-bold ${ticketsRemaining === 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-100"}`}>
                                    {ticketsRemaining}
                                  </span>
                                  <span className="text-[9px] text-slate-400 block truncate">
                                    {ticketsRemaining === 0 ? "Penuh" : "Tersedia"}
                                  </span>
                                </div>

                                <div className="p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 text-center">
                                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">Keterisian</span>
                                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{occupancyRate}%</span>
                                  <span className="text-[9px] text-slate-400 block truncate">Kapasitas</span>
                                </div>
                              </div>

                              {/* Progress Bar 1: Keterisian Kuota Venue */}
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="text-slate-500 dark:text-slate-400 font-medium">Keterisian Kuota Venue:</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-300">
                                    {ticketsReserved} / {totalCapacity} tiket ({occupancyRate}%)
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700/70 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      occupancyRate >= 100
                                        ? "bg-rose-500"
                                        : occupancyRate >= 80
                                        ? "bg-amber-500"
                                        : "bg-[#3B7A57] dark:bg-[#52B788]"
                                    }`}
                                    style={{ width: `${occupancyRate}%` }}
                                  />
                                </div>
                              </div>

                              {/* Progress Bar 2: Progres Check-In Peserta Lunas di Venue */}
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="text-slate-500 dark:text-slate-400 font-medium">Progres Kehadiran Peserta Lunas:</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-300">
                                    {eligibleTicketsCount > 0
                                      ? `${checkedInTickets} / ${eligibleTicketsCount} tiket hadir (${checkInRate}%)`
                                      : "Belum ada pesanan lunas"}
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700/70 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 transition-all duration-300"
                                    style={{ width: `${checkInRate}%` }}
                                  />
                                </div>
                              </div>

                              {cancelledBookings.length > 0 && (
                                <div className="text-[10px] text-slate-400 italic">
                                  * {cancelledBookings.length} pesanan dibatalkan ({cancelledBookings.reduce((s, b) => s + b.ticketCount, 0)} tiket dikecualikan dari kuota).
                                </div>
                              )}
                            </div>

                            {/* Revenue metrics row for paid events */}
                            {evt.isPaid && (
                              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                                <div>
                                  <span className="text-[10px] text-slate-400 block">Omset Tiket Lunas:</span>
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

                {/* Ringkasan Komposisi Peserta & Check-In */}
                {(() => {
                  const relevantBookings = portalData.bookings.filter(
                    (b) => selectedEventId === "ALL" || b.eventId === selectedEventId
                  );
                  const activeB = relevantBookings.filter((b) => b.paymentStatus !== "CANCELLED");
                  const paidB = activeB.filter((b) => b.paymentStatus === "PAID");
                  const checkedInTickets = paidB.reduce(
                    (s, b) =>
                      s +
                      (b.checkedInQty ??
                        (b.checkInStatus === "CHECKED_IN" ? b.ticketCount : 0)),
                    0
                  );
                  const totalPaidTickets = paidB.reduce((s, b) => s + b.ticketCount, 0);
                  const pendingB = activeB.filter((b) => b.paymentStatus === "PENDING");
                  const cancelledB = relevantBookings.filter((b) => b.paymentStatus === "CANCELLED");
                  const totalTickets = activeB.reduce((s, b) => s + b.ticketCount, 0);

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Total Pesanan Aktif</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {activeB.length} ({totalTickets} tiket)
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">Tiket Lunas</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {totalPaidTickets} Tiket ({paidB.length} pesanan)
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-sky-600 dark:text-sky-400 block font-medium">Hadir di Venue</span>
                        <span className="font-bold text-sky-700 dark:text-sky-400">
                          {checkedInTickets} / {totalPaidTickets} ({totalPaidTickets > 0 ? Math.round((checkedInTickets / totalPaidTickets) * 100) : 0}%)
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-medium">Pending Verifikasi</span>
                        <span className="font-bold text-amber-700 dark:text-amber-400">
                          {pendingB.length} Pesanan
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 block font-medium">Dibatalkan</span>
                        <span className="font-bold text-rose-700 dark:text-rose-400">
                          {cancelledB.length} Pesanan
                        </span>
                      </div>
                    </div>
                  );
                })()}

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
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end space-x-1.5">
                                {b.paymentStatus === "CANCELLED" ? (
                                  <Button
                                    size="sm"
                                    disabled
                                    className="h-7 px-2.5 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-800"
                                    title="Tiket yang dibatalkan tidak dapat check-in"
                                  >
                                    <X className="w-3 h-3 mr-1" /> Dibatalkan
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
                                        ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed"
                                        : "bg-[#3B7A57] hover:bg-[#2E6044] text-white shadow-xs cursor-pointer"
                                    }`}
                                    title={
                                      b.paymentStatus === "PENDING" && b.totalPrice > 0
                                        ? "Tiket belum diverifikasi lunas (status masih PENDING)"
                                        : b.ticketCount > 1
                                        ? `Check-in tiket ke-${(b.checkedInQty || 0) + 1} dari ${b.ticketCount}`
                                        : "Tandai Hadir"
                                    }
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
                                    title="Batalkan seluruh kehadiran pada booking ini"
                                  >
                                    {isUpdatingCheckIn === b.id ? (
                                      <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                                    ) : (
                                      <RotateCcw className="w-3 h-3 mr-1" />
                                    )}
                                    <span>Reset Hadir</span>
                                  </Button>
                                )}

                                {/* Quick reset icon if partially checked in */}
                                {b.checkInStatus === "PARTIALLY_CHECKED_IN" && (b.checkedInQty || 0) > 0 && (
                                  <button
                                    type="button"
                                    disabled={isUpdatingCheckIn === b.id}
                                    onClick={() => handleCheckInTicket(b, "RESET")}
                                    className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
