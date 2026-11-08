"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Camera,
  UserCheck,
  Building,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Check,
  X,
  TrendingUp,
  LogOut,
  Filter,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { CommunityEvent, EventTicketOrder, AttendeeCheckInStatus } from "@/types/event";
import { EventSearchInput } from "@/components/events/EventSearchInput";
import { formatCurrencyIDR } from "@/lib/utils";
import { canAccessEventCheckIn, getRoleSlug } from "@/lib/rbac";
import { EventCheckInQRScannerModal } from "./EventCheckInQRScannerModal";
import { QRCodeSVG } from "qrcode.react";

export default function EventCheckInDashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [bookings, setBookings] = useState<EventTicketOrder[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [ticketSearch, setTicketSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"UNCHECKED" | "CHECKED" | "ALL">("UNCHECKED");
  const [quickBarcodeInput, setQuickBarcodeInput] = useState("");
  const [isQuickScanning, setIsQuickScanning] = useState(false);
  const barcodeInputRef = React.useRef<HTMLInputElement>(null);
  const lastScanRef = React.useRef<{ code: string; timestamp: number } | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [viewQRBooking, setViewQRBooking] = useState<EventTicketOrder | null>(null);
  const [groupCheckInBooking, setGroupCheckInBooking] = useState<EventTicketOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isAuthorized = canAccessEventCheckIn(user);
  const roleSlug = getRoleSlug(user);
  const isHubAdmin =
    roleSlug === "SUPER_ADMIN" ||
    ((roleSlug === "OWNER" || roleSlug === "MANAGER") &&
      (user?.scopeLevel === "ORGANIZATION" || user?.scopeLevel === "PLATFORM"));
  const isEventStaff = Boolean(user?.permissions?.includes("events:checkin"));

  // Load events and bookings in parallel
  const loadData = async () => {
    if (!canAccessEventCheckIn(user)) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);
    try {
      // 1. Fetch public/admin approved events and bookings concurrently
      const [evtRes, bRes] = await Promise.all([
        fetch("/api/events"),
        fetch("/api/events/bookings"),
      ]);

      const [evtJson, bJson] = await Promise.all([evtRes.json(), bRes.json()]);
      const allEvents: CommunityEvent[] = evtJson.success ? evtJson.data : [];
      const allBookings: EventTicketOrder[] = bJson.success && Array.isArray(bJson.data) ? bJson.data : [];
      setBookings(allBookings);

      // Determine accessible events based on user persona / role:
      // - Hub Admin & Event Staff: all approved venue events
      // - Community Organizer: strictly their own community events
      const userEmail = (user?.email || "").toLowerCase();

      const accessibleEvents = (isHubAdmin || isEventStaff)
        ? allEvents.filter((e) => e.status === "APPROVED")
        : allEvents.filter(
            (e) => e.status === "APPROVED" && (e.organizerEmail || "").toLowerCase() === userEmail
          );

      setEvents(accessibleEvents);

      // Prioritize selecting an event that ACTUALLY HAS registered attendee bookings
      if (accessibleEvents.length > 0 && !selectedEventId) {
        const now = Date.now();
        const eventWithBookings = accessibleEvents.find((e) => {
          const hasBookings = allBookings.some((b) => b.eventId === e.id);
          const s = new Date(e.startDate).getTime();
          const end = new Date(e.endDate).getTime();
          return hasBookings && s <= now && end >= now;
        }) || accessibleEvents.find((e) => allBookings.some((b) => b.eventId === e.id)) || accessibleEvents[0];

        setSelectedEventId(eventWithBookings.id);
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

  // Ticket count map per event
  const ticketsCountByEvent = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach((b) => {
      counts[b.eventId] = (counts[b.eventId] || 0) + (b.ticketCount || 1);
    });
    return counts;
  }, [bookings]);

  // Filter events strictly for active / ongoing / upcoming operational events
  const filteredEventsList = useMemo(() => {
    const now = Date.now();
    const activeOrUpcoming = events.filter((e) => {
      const endMs = e.endDate ? new Date(e.endDate).getTime() : new Date(e.startDate).getTime();
      return endMs >= now || isNaN(endMs);
    });
    return activeOrUpcoming.length > 0 ? activeOrUpcoming : events;
  }, [events]);

  // Filtered tickets strictly restricted to the selected event (1 booking per item)
  const eventTickets = useMemo(() => {
    if (!selectedEventId) return [];
    return bookings.filter((b) => b.eventId === selectedEventId);
  }, [bookings, selectedEventId]);

  // Real-time Event Attendance Statistics
  const stats = useMemo(() => {
    // Total tickets count (sum of all ticketCount / seats)
    const totalTickets = eventTickets.reduce((acc, b) => acc + (b.ticketCount || 1), 0);
    // Total checked-in pax
    const checkedInCount = eventTickets.reduce((acc, b) => {
      if (typeof b.checkedInQty === "number") return acc + b.checkedInQty;
      return b.checkInStatus === "CHECKED_IN" ? acc + (b.ticketCount || 1) : acc;
    }, 0);
    const remainingCount = Math.max(0, totalTickets - checkedInCount);
    const percentage = totalTickets > 0 ? Math.round((checkedInCount / totalTickets) * 100) : 0;

    // Booking order level counts for Tabs:
    const uncheckedOrders = eventTickets.filter((b) => b.checkInStatus !== "CHECKED_IN").length;
    const checkedOrders = eventTickets.filter((b) => b.checkInStatus === "CHECKED_IN").length;
    const totalOrders = eventTickets.length;

    return {
      totalTickets,
      checkedInCount,
      remainingCount,
      percentage,
      uncheckedOrders,
      checkedOrders,
      totalOrders,
    };
  }, [eventTickets]);

  // Filtered tickets taking Active Tab and Search query into account (1 row per booking/order)
  const filteredTickets = useMemo(() => {
    let list = eventTickets;
    if (activeTab === "UNCHECKED") {
      list = list.filter((b) => b.checkInStatus !== "CHECKED_IN");
    } else if (activeTab === "CHECKED") {
      list = list.filter((b) => b.checkInStatus === "CHECKED_IN");
    }

    const q = ticketSearch.trim().toLowerCase();
    if (!q) return list;

    return list.filter((b) => {
      const matchCode = (b.ticketCode || "").toLowerCase().includes(q);
      const matchName = (b.guestName || "").toLowerCase().includes(q);
      const matchEmail = (b.guestEmail || "").toLowerCase().includes(q);
      const matchPhone = (b.guestPhone || "").toLowerCase().includes(q);
      const matchInst = (b.institution || "").toLowerCase().includes(q);
      return matchCode || matchName || matchEmail || matchPhone || matchInst;
    });
  }, [eventTickets, activeTab, ticketSearch]);

  // Server-side Check-In Handler
  const handleCheckIn = async (
    booking: EventTicketOrder,
    newStatus: AttendeeCheckInStatus,
    options?: {
      incrementQty?: number;
      targetQty?: number;
      reset?: boolean;
      ticketCode?: string;
      seatNumber?: number;
    }
  ) => {
    setIsProcessingId(booking.id);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/events/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkInStatus: newStatus,
          reset: options?.reset || newStatus === "REGISTERED",
          incrementQty: options?.incrementQty,
          targetQty: options?.targetQty,
          ticketCode: options?.ticketCode,
          seatNumber: options?.seatNumber,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memproses check-in tiket.");
      }

      const updated = json.data as EventTicketOrder;

      // Update local state with updated booking
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, ...updated } : b))
      );

      const count =
        updated.checkedInQty ??
        (updated.checkInStatus === "CHECKED_IN" ? updated.ticketCount : 0);
      const isComplete = count >= updated.ticketCount;

      setStatusMessage({
        type: "success",
        text:
          newStatus === "REGISTERED" || options?.reset
            ? `Status kehadiran [${booking.ticketCode}] (${booking.guestName}) berhasil direset ke 0.`
            : options?.seatNumber !== undefined
            ? `Tiket #${options.seatNumber} [${options.ticketCode || booking.ticketCode}] (${booking.guestName}): Berhasil check-in! (${count}/${updated.ticketCount} hadir)`
            : updated.ticketCount > 1
            ? `Tiket grup [${booking.ticketCode}] (${booking.guestName}): ${count}/${updated.ticketCount} tiket hadir ${
                isComplete
                  ? "(Lengkap 🎉)"
                  : `(Sisa ${updated.ticketCount - count} teman dapat menyusul)`
              }`
            : `Tiket [${booking.ticketCode}] (${booking.guestName}) berhasil check-in!`,
      });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Gagal memproses check-in." });
    } finally {
      setIsProcessingId(null);
    }
  };

  // Quick Barcode Gun / Manual Input Check-in Submission (BUG 1 & BUG 2 Protected)
  const handleQuickBarcodeSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isQuickScanning) return;

    const cleanCode = quickBarcodeInput.trim().toUpperCase();
    // Immediately clear input buffer so fast consecutive scans cannot concatenate strings
    setQuickBarcodeInput("");

    if (!cleanCode) {
      barcodeInputRef.current?.focus();
      return;
    }

    // Hardware Scanner deduplication guard against duplicate Enter/Tab events fired within 1200ms
    const now = Date.now();
    if (
      lastScanRef.current &&
      lastScanRef.current.code === cleanCode &&
      now - lastScanRef.current.timestamp < 1200
    ) {
      barcodeInputRef.current?.focus();
      return;
    }
    lastScanRef.current = { code: cleanCode, timestamp: now };

    setIsQuickScanning(true);
    setStatusMessage(null);

    try {
      // Support both sub-ticket code (DAGO-EVT-96354-01) or base ticket code (DAGO-EVT-96354)
      const matchSeat = cleanCode.match(/^(DAGO-EVT-[A-Z0-9]+)-0*(\d+)$/i);
      const baseCode = matchSeat ? matchSeat[1] : cleanCode;
      const requestedSeat = matchSeat ? parseInt(matchSeat[2], 10) : undefined;

      const booking = eventTickets.find(
        (b) => b.ticketCode.toUpperCase() === cleanCode || b.ticketCode.toUpperCase() === baseCode
      );

      if (!booking) {
        const anyBooking = bookings.find(
          (b) => b.ticketCode.toUpperCase() === cleanCode || b.ticketCode.toUpperCase() === baseCode
        );
        if (anyBooking) {
          setStatusMessage({
            type: "error",
            text: `Tiket [${cleanCode}] (${anyBooking.guestName}) terdaftar pada "${anyBooking.eventTitle || "event lain"}", bukan event ini!`,
          });
        } else {
          setStatusMessage({
            type: "error",
            text: `Tiket dengan kode [${cleanCode}] tidak ditemukan pada sistem data pemesanan.`,
          });
        }
        return;
      }

      if (booking.paymentStatus !== "PAID") {
        setStatusMessage({
          type: "error",
          text: `Tiket [${cleanCode}] (${booking.guestName}) belum berstatus Lunas (Status: ${booking.paymentStatus}).`,
        });
        return;
      }

      const ticketCount = booking.ticketCount || 1;
      const currentCheckedSeats: number[] = Array.isArray(booking.checkedInSeats)
        ? [...booking.checkedInSeats]
        : Array.from({ length: booking.checkedInQty || 0 }, (_, i) => i + 1);

      // Check if specific sub-ticket code has already checked in
      if (requestedSeat !== undefined) {
        if (requestedSeat < 1 || requestedSeat > ticketCount) {
          setStatusMessage({
            type: "error",
            text: `Nomor tiket #${requestedSeat} tidak valid untuk pemesanan ini (total ${ticketCount} tiket).`,
          });
          return;
        }

        if (currentCheckedSeats.includes(requestedSeat)) {
          const priorTime = booking.seatCheckInTimes?.[String(requestedSeat)] || booking.checkInTime;
          const timeFormatted = priorTime
            ? new Date(priorTime).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Makassar",
              }) + " WITA"
            : "";
          setStatusMessage({
            type: "error",
            text: `Tiket #${requestedSeat} [${cleanCode}] (${booking.guestName}) sudah digunakan untuk check-in sebelumnya${timeFormatted ? ` (check-in pada pukul ${timeFormatted})` : ""}!`,
          });
          return;
        }

        const isComplete = currentCheckedSeats.length + 1 >= ticketCount;
        await handleCheckIn(booking, isComplete ? "CHECKED_IN" : "PARTIALLY_CHECKED_IN", {
          ticketCode: cleanCode,
          seatNumber: requestedSeat,
          incrementQty: 1,
        });
      } else {
        if (currentCheckedSeats.length >= ticketCount) {
          const timeStr = booking.checkInTime
            ? new Date(booking.checkInTime).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Makassar",
              }) + " WITA"
            : "sebelumnya";
          setStatusMessage({
            type: "error",
            text: `Peringatan: Seluruh ${ticketCount} tiket [${cleanCode}] atas nama ${booking.guestName} sudah selesai check-in sebelumnya (${timeStr})!`,
          });
          return;
        }

        if (ticketCount > 1) {
          const isComplete = currentCheckedSeats.length + 1 >= ticketCount;
          await handleCheckIn(booking, isComplete ? "CHECKED_IN" : "PARTIALLY_CHECKED_IN", {
            incrementQty: 1,
          });
        } else {
          await handleCheckIn(booking, "CHECKED_IN", { ticketCode: cleanCode });
        }
      }
    } finally {
      setIsQuickScanning(false);
      setQuickBarcodeInput("");
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);
    }
  };

  // Handle Logout & return to login
  const handleOfficerLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (!isLoading && !isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8 border-red-200 dark:border-red-900/40 shadow-xl bg-white dark:bg-[#1E293B] rounded-3xl">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-950/60 rounded-2xl flex items-center justify-center mx-auto mb-5 text-red-600 dark:text-red-400">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-2 text-slate-900 dark:text-white">
            Akses Terbatas: Check-in Event
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            Akun Anda ({user?.email || "Tamu"}) tidak memiliki otorisasi petugas lapangan atau penugasan event untuk melakukan check-in peserta.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild variant="outline" size="sm" className="rounded-xl text-xs font-semibold">
              <Link href="/">Kembali ke Beranda</Link>
            </Button>
            <Button asChild size="sm" className="rounded-xl text-xs font-bold bg-[#3B7A57] hover:bg-[#2E6044] text-white">
              <Link href={roleSlug === "CUSTOMER" ? "/customer" : "/dashboard"}>
                Ke Workspace Saya
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200">
      {/* 1. DEDICATED FIELD OFFICER TOP NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand & Station Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#3B7A57]/10 dark:bg-[#52B788]/20 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                  DagoEng Event Desk
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[#3B7A57] dark:text-[#52B788] border border-emerald-200 dark:border-emerald-800">
                  Meja Registrasi & Check-In
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1.5 mt-0.5">
                <span>Petugas:</span>
                <strong className="text-slate-800 dark:text-slate-200">
                  {user?.name || "Petugas Lapangan"}
                </strong>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="font-mono text-[10px] text-slate-400">{user?.email}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {user?.email === "eventstaff@dagoeng.com"
                    ? "Petugas Lapangan Resmi"
                    : isHubAdmin
                    ? "Supervisor / Hub Admin"
                    : "Penyelenggara"}
                </span>
              </p>
            </div>
          </div>

          {/* Action Tools & Session Controls */}
          <div className="flex items-center space-x-2">
            {isHubAdmin && (
              <Link href="/dashboard" className="hidden md:inline-flex">
                <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 cursor-pointer">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Dashboard
                </Button>
              </Link>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              className="h-8 text-xs font-semibold rounded-xl border-slate-200 dark:border-slate-800"
              title="Segarkan data tiket"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Segarkan</span>
            </Button>

            <ThemeToggle variant="pill" />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleOfficerLogout}
              className="h-8 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl"
              title="Keluar dari sesi petugas"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1 w-full">
        {/* Global Feedback Alert */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between shadow-xs animate-in slide-in-from-top-2 ${
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
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm text-center py-16 px-4 rounded-3xl bg-white dark:bg-[#1E293B]">
            <Building className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Belum Ada Event Aktif yang Ditugaskan
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4 leading-relaxed">
              Akun Anda belum memiliki event aktif yang disetujui kurator untuk operasional check-in. Hubungi Admin Hub atau koordinator acara untuk penugasan meja registrasi.
            </p>
            <Link href="/events">
              <Button size="sm" variant="outline" className="text-xs font-semibold rounded-xl">
                Lihat Kalender Event Publik
              </Button>
            </Link>
          </Card>
        )}

        {events.length > 0 && (
          <div className="space-y-6">
            {/* Event Selector Card */}
            <Card className="p-4 sm:p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] rounded-3xl shadow-xs">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
                    <span>Pilih Event Operasional:</span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Pilih event yang sedang berlangsung untuk membuka meja registrasi dan memindai tiket peserta.
                  </p>
                </div>

                <div className="w-full sm:w-80 md:w-96">
                  <EventSearchInput
                    events={filteredEventsList}
                    selectedEventId={selectedEventId}
                    onSelectEvent={(id) => setSelectedEventId(id)}
                    placeholder="Pilih atau cari event..."
                    allowAllOption={false}
                    maxResults={6}
                  />
                </div>
              </div>
            </Card>

            {/* Selected Event Context */}
            {selectedEvent && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* 2. DEDICATED QR SCANNER ACTION HERO BANNER */}
                <Card className="p-6 border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-[#0F2317] to-slate-900 text-white rounded-3xl shadow-lg relative overflow-hidden">
                  <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-[#3B7A57] text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full border-none">
                          {selectedEvent.category}
                        </Badge>
                        <span className="text-xs text-slate-300 font-medium">
                          Penyelenggara: <strong className="text-white">{selectedEvent.organizerName}</strong>
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                        {selectedEvent.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                        <span className="flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#52B788]" />
                          <span>
                            {new Date(selectedEvent.startDate).toLocaleDateString("id-ID", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                        </span>
                        <span className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#52B788]" />
                          <span>
                            {new Date(selectedEvent.startDate).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            WITA
                          </span>
                        </span>
                        <span className="flex items-center space-x-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#52B788]" />
                          <span>{selectedEvent.location}</span>
                        </span>
                      </div>
                    </div>

                    {/* Prominent QR Camera Scanner Button & Barcode Gun Input */}
                    <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                      <Button
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        className="bg-[#3B7A57] hover:bg-[#2E6044] text-white font-black text-xs sm:text-sm px-6 py-5 rounded-2xl shadow-lg shadow-[#3B7A57]/30 flex items-center justify-center space-x-2.5 cursor-pointer transition-all hover:scale-105 active:scale-95"
                      >
                        <Camera className="w-5 h-5 text-white" />
                        <span>Buka Kamera Scanner QR</span>
                      </Button>

                      {/* Fast Barcode Gun Form */}
                      <form onSubmit={handleQuickBarcodeSubmit} className="flex items-center gap-2 bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-emerald-500/40 shadow-sm ring-1 ring-emerald-500/20">
                        <ScanLine className="w-4 h-4 text-emerald-400 shrink-0" />
                        <input
                          ref={barcodeInputRef}
                          type="text"
                          value={quickBarcodeInput}
                          onChange={(e) => setQuickBarcodeInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "Tab") {
                              e.preventDefault();
                              handleQuickBarcodeSubmit();
                            }
                          }}
                          placeholder={isQuickScanning ? "Memvalidasi tiket..." : "Ketik / Scan Barcode..."}
                          disabled={isQuickScanning}
                          className="px-1 py-1 text-xs font-mono font-bold bg-transparent border-none text-white placeholder:text-slate-400 focus:outline-none focus:ring-0 shadow-none w-48 sm:w-56 disabled:opacity-60"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!quickBarcodeInput.trim() || isQuickScanning}
                          className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold rounded-xl px-3 h-8 cursor-pointer shadow-xs disabled:opacity-40"
                        >
                          {isQuickScanning ? (
                            <span className="flex items-center space-x-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Validasi...</span>
                            </span>
                          ) : (
                            "Check-in"
                          )}
                        </Button>
                      </form>
                    </div>
                  </div>
                </Card>

                {/* 3. KPI ATTENDANCE METRICS */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <Card className="p-4 sm:p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] rounded-3xl shadow-xs">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                      <Ticket className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
                      <span>Total Tiket Terdaftar</span>
                    </p>
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                      {stats.totalTickets}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Semua pemesanan tiket</p>
                  </Card>

                  <Card className="p-4 sm:p-5 border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-3xl shadow-xs">
                    <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Sudah Check-In</span>
                    </p>
                    <p className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                      {stats.checkedInCount}
                    </p>
                    <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">Telah berada di lokasi</p>
                  </Card>

                  <Card className="p-4 sm:p-5 border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 rounded-3xl shadow-xs">
                    <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Belum Hadir</span>
                    </p>
                    <p className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-400 mt-1">
                      {stats.remainingCount}
                    </p>
                    <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">Menunggu verifikasi</p>
                  </Card>

                  <Card className="p-4 sm:p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] rounded-3xl shadow-xs">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                      <TrendingUp className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
                      <span>Tingkat Kehadiran</span>
                    </p>
                    <div className="flex items-baseline space-x-1.5 mt-1">
                      <p className="text-2xl sm:text-3xl font-black text-[#3B7A57] dark:text-[#52B788]">
                        {stats.percentage}%
                      </p>
                      <span className="text-[10px] text-slate-400">attendance</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2.5 overflow-hidden">
                      <div
                        className="bg-[#3B7A57] dark:bg-[#52B788] h-full transition-all duration-300"
                        style={{ width: `${Math.min(100, stats.percentage)}%` }}
                      />
                    </div>
                  </Card>
                </div>

                {/* 4. ATTENDEES TABLE WITH FAST FILTER TABS */}
                <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] rounded-3xl shadow-xs overflow-hidden">
                  <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                    {/* Filter Tabs */}
                    <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-2xl w-full sm:w-auto border border-slate-200/50 dark:border-slate-700/50">
                      <button
                        type="button"
                        onClick={() => setActiveTab("UNCHECKED")}
                        className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          activeTab === "UNCHECKED"
                            ? "bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-200 shadow-xs border border-amber-300/30 dark:border-amber-700/50"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                      >
                        Belum Hadir ({stats.uncheckedOrders})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("CHECKED")}
                        className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          activeTab === "CHECKED"
                            ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-200 shadow-xs border border-emerald-300/30 dark:border-emerald-700/50"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                      >
                        Sudah Hadir ({stats.checkedOrders})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("ALL")}
                        className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          activeTab === "ALL"
                            ? "bg-white dark:bg-slate-700 text-[#3B7A57] dark:text-[#52B788] shadow-xs border border-[#3B7A57]/30 dark:border-[#52B788]/50"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                      >
                        Semua ({stats.totalOrders})
                      </button>
                    </div>

                    {/* Real-time Search Box */}
                    <div className="relative w-full sm:w-80">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={ticketSearch}
                        onChange={(e) => setTicketSearch(e.target.value)}
                        placeholder="Cari kode tiket, nama, HP..."
                        className="w-full text-xs font-medium pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]/30 focus:border-[#3B7A57] transition-all"
                      />
                      {ticketSearch && (
                        <button
                          type="button"
                          onClick={() => setTicketSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Attendees Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-3.5 px-4">Kode Tiket</th>
                          <th className="py-3.5 px-4">Nama Peserta</th>
                          <th className="py-3.5 px-4">Kontak</th>
                          <th className="py-3.5 px-4 text-center">Tiket</th>
                          <th className="py-3.5 px-4 text-center">Status Pembayaran</th>
                          <th className="py-3.5 px-4 text-center">Kehadiran</th>
                          <th className="py-3.5 px-4 text-right">Aksi Meja Registrasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredTickets.length > 0 ? (
                          filteredTickets.map((b) => {
                            const ticketCount = b.ticketCount || 1;
                            const checkedQty =
                              typeof b.checkedInQty === "number"
                                ? b.checkedInQty
                                : b.checkInStatus === "CHECKED_IN"
                                ? ticketCount
                                : 0;
                            const isFullyCheckedIn = b.checkInStatus === "CHECKED_IN" || checkedQty >= ticketCount;
                            const isPartiallyCheckedIn = !isFullyCheckedIn && checkedQty > 0;
                            const isPaid = b.paymentStatus === "PAID";
                            const isProcessing = isProcessingId === b.id;
                            const sisa = Math.max(0, ticketCount - checkedQty);

                            return (
                              <tr
                                key={b.id}
                                className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                                  isFullyCheckedIn
                                    ? "bg-emerald-50/30 dark:bg-emerald-950/10"
                                    : ""
                                }`}
                              >
                                <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                                  <div className="flex items-center space-x-2">
                                    <span>{b.ticketCode}</span>
                                    <button
                                      type="button"
                                      onClick={() => setViewQRBooking(b)}
                                      className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-[#3B7A57] dark:hover:text-[#52B788] transition-colors cursor-pointer"
                                      title="Tampilkan QR Code E-Tiket"
                                    >
                                      <QrCode className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <p className="font-bold text-slate-800 dark:text-slate-100">{b.guestName}</p>
                                  {b.institution && (
                                    <p className="text-[10px] text-slate-400">{b.institution}</p>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 text-[11px]">
                                  <p>{b.guestEmail}</p>
                                  <p className="font-mono text-[10px]">{b.guestPhone}</p>
                                </td>
                                <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
                                    {ticketCount} Pax
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-center">
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
                                <td className="py-3.5 px-4 text-center">
                                  {isFullyCheckedIn ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                                      SUDAH HADIR {ticketCount > 1 ? `(${ticketCount} Pax)` : ""}
                                    </span>
                                  ) : isPartiallyCheckedIn ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                                      HADIR {checkedQty}/{ticketCount} Pax (Sisa {sisa})
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800">
                                      BELUM HADIR {ticketCount > 1 ? `(0/${ticketCount} Pax)` : ""}
                                    </span>
                                  )}
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
                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex items-center justify-end space-x-1.5">
                                    {!isFullyCheckedIn ? (
                                      <>
                                        <Button
                                          type="button"
                                          size="sm"
                                          disabled={!isPaid || isProcessing}
                                          onClick={() => {
                                            if (ticketCount > 1) {
                                              setGroupCheckInBooking(b);
                                            } else {
                                              handleCheckIn(b, "CHECKED_IN");
                                            }
                                          }}
                                          className={`h-7 px-3 text-xs font-bold rounded-xl shadow-xs cursor-pointer ${
                                            !isPaid
                                              ? "opacity-50 cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-800"
                                              : "bg-[#3B7A57] hover:bg-[#2E6044] text-white"
                                          }`}
                                        >
                                          <Check className="w-3.5 h-3.5 mr-1" />
                                          {isProcessing
                                            ? "Menyimpan..."
                                            : isPartiallyCheckedIn
                                            ? `Check-in (+1)`
                                            : "Check-in"}
                                        </Button>

                                        {isPartiallyCheckedIn && (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={isProcessing}
                                            onClick={() => handleCheckIn(b, "REGISTERED", { reset: true })}
                                            className="h-7 px-2 text-xs font-semibold text-slate-400 hover:text-rose-600 border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
                                            title="Reset kehadiran kembali ke 0"
                                          >
                                            <RotateCcw className="w-3 h-3" />
                                          </Button>
                                        )}
                                      </>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={isProcessing}
                                        onClick={() => handleCheckIn(b, "REGISTERED", { reset: true })}
                                        className="h-7 px-2.5 text-xs font-semibold text-slate-500 hover:text-rose-600 border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
                                        title="Batalkan status kehadiran tiket ini (Reset)"
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
                            <td colSpan={7} className="py-14 text-center">
                              <div className="max-w-md mx-auto space-y-3 px-4">
                                {eventTickets.length > 0 && stats.remainingCount === 0 && activeTab === "UNCHECKED" ? (
                                  <>
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                                      <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100">
                                        Semua Peserta ({stats.checkedInCount}) Sudah Hadir & Check-in!
                                      </p>
                                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                        Tidak ada peserta yang berstatus &quot;Belum Hadir&quot; pada event ini.
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => setActiveTab("CHECKED")}
                                      className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold rounded-xl cursor-pointer"
                                    >
                                      Lihat {stats.checkedInCount} Peserta yang Sudah Hadir
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center mx-auto text-slate-400">
                                      <Ticket className="w-6 h-6 text-slate-400" />
                                    </div>
                                    <div>
                                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                        {eventTickets.length === 0
                                          ? "Belum Ada Peserta Terdaftar di Event Ini"
                                          : "Tidak Ada Tiket yang Cocok"}
                                      </p>
                                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                        {eventTickets.length === 0
                                          ? `Event "${selectedEvent?.title}" saat ini belum memiliki transaksi pemesanan tiket.`
                                          : "Tidak ditemukan data tiket yang cocok dengan filter tab atau kata kunci pencarian Anda."}
                                      </p>
                                    </div>
                                  </>
                                )}
                              </div>
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
      </main>

      {/* FOOTER */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-center text-[11px] text-slate-400 w-full border-t border-slate-200/60 dark:border-slate-800/60">
        © {new Date().getFullYear()} Dago Creative Hub — Modul Check-In Registrasi Lapangan Terpadu.
      </footer>

      {/* 4.5. POPUP PREVIEW QR CODE TIKET PEMESAN */}
      {viewQRBooking && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl overflow-hidden p-6 space-y-5 text-center">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-[#3B7A57]/10 dark:bg-[#52B788]/20 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">QR Code E-Tiket Peserta</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{viewQRBooking.ticketCode}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setViewQRBooking(null)}
                className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* QR Code Presentation */}
            <div className="bg-white p-4 rounded-2xl shadow-inner border border-slate-100 inline-block mx-auto">
              <QRCodeSVG
                value={viewQRBooking.ticketCode}
                size={200}
                level="M"
                includeMargin={true}
              />
            </div>

            {/* Attendee Summary Details */}
            <div className="space-y-1.5 text-left bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400 font-medium">Nama Peserta:</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">{viewQRBooking.guestName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400 font-medium">Kode Tiket:</span>
                <span className="font-mono text-xs font-bold text-[#3B7A57] dark:text-[#52B788]">{viewQRBooking.ticketCode}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400 font-medium">Jumlah Tiket:</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">{viewQRBooking.ticketCount || 1} Pax</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400 font-medium">Status Kehadiran:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  viewQRBooking.checkInStatus === "CHECKED_IN"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                    : viewQRBooking.checkInStatus === "PARTIALLY_CHECKED_IN"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                }`}>
                  {viewQRBooking.checkInStatus === "CHECKED_IN"
                    ? "SUDAH HADIR"
                    : viewQRBooking.checkInStatus === "PARTIALLY_CHECKED_IN"
                    ? `HADIR ${viewQRBooking.checkedInQty || 0}/${viewQRBooking.ticketCount || 1} Pax`
                    : "BELUM HADIR"}
                </span>
              </div>
            </div>

            {/* Simulation & Close Actions */}
            <div className="space-y-2 pt-1">
              <Button
                type="button"
                onClick={async () => {
                  const target = viewQRBooking;
                  setViewQRBooking(null);
                  if (target) {
                    if ((target.ticketCount || 1) > 1) {
                      setGroupCheckInBooking(target);
                    } else {
                      await handleCheckIn(target, "CHECKED_IN");
                    }
                  }
                }}
                disabled={viewQRBooking.checkInStatus === "CHECKED_IN"}
                className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs h-10 rounded-xl shadow-md shadow-[#3B7A57]/20 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {viewQRBooking.checkInStatus === "CHECKED_IN"
                    ? "Tiket Sudah Digunakan Lengkap"
                    : (viewQRBooking.ticketCount || 1) > 1
                    ? "Check-in Rombongan Ini"
                    : "Simulasikan Scan & Check-in Tiket Ini"}
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewQRBooking(null)}
                className="w-full text-xs font-semibold h-9 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Tutup Pratinjau
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 4.6. POPUP CHECK-IN ROMBONGAN / MULTI-PAX */}
      {groupCheckInBooking && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#3B7A57]/10 dark:bg-[#52B788]/20 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Check-in Tiket Rombongan</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{groupCheckInBooking.ticketCode}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setGroupCheckInBooking(null)}
                className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Attendance Progress Box */}
            {(() => {
              const count = groupCheckInBooking.ticketCount || 1;
              const checked =
                typeof groupCheckInBooking.checkedInQty === "number"
                  ? groupCheckInBooking.checkedInQty
                  : groupCheckInBooking.checkInStatus === "CHECKED_IN"
                  ? count
                  : 0;
              const remaining = Math.max(0, count - checked);
              const isProcessing = isProcessingId === groupCheckInBooking.id;

              return (
                <>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Pemesan:</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {groupCheckInBooking.guestName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Total Kursi/Tiket:</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{count} Pax</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Status Hadir:</span>
                      <span className="text-xs font-bold text-[#3B7A57] dark:text-[#52B788]">
                        {checked} Hadir &bull; {remaining} Belum Hadir
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#3B7A57] dark:bg-[#52B788] h-full transition-all"
                        style={{ width: `${(checked / count) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <p className="text-xs text-slate-500 text-center font-medium">Pilih Opsi Kehadiran:</p>

                    {/* Option 1: Partial / +1 */}
                    <Button
                      type="button"
                      disabled={remaining <= 0 || isProcessing}
                      onClick={async () => {
                        const newChecked = checked + 1;
                        const isComplete = newChecked >= count;
                        await handleCheckIn(
                          groupCheckInBooking,
                          isComplete ? "CHECKED_IN" : "PARTIALLY_CHECKED_IN",
                          { incrementQty: 1 }
                        );
                        if (isComplete) {
                          setGroupCheckInBooking(null);
                        }
                      }}
                      className="w-full h-auto py-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all"
                    >
                      <span className="font-bold text-xs flex items-center space-x-1.5">
                        <Check className="w-3.5 h-3.5" />
                        <span>Masuk 1 Orang (+1 Pax)</span>
                      </span>
                      <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                        Teman rombongan lain datang menyusul kemudian
                      </span>
                    </Button>

                    {/* Option 2: All remaining */}
                    <Button
                      type="button"
                      disabled={remaining <= 0 || isProcessing}
                      onClick={async () => {
                        await handleCheckIn(groupCheckInBooking, "CHECKED_IN", {
                          targetQty: count,
                        });
                        setGroupCheckInBooking(null);
                      }}
                      className="w-full h-auto py-2.5 px-4 bg-[#3B7A57] hover:bg-[#2E6044] text-white rounded-2xl flex flex-col items-center justify-center cursor-pointer shadow-md shadow-[#3B7A57]/20 transition-all"
                    >
                      <span className="font-bold text-xs flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Hadir Semua Sekaligus ({remaining} Orang)</span>
                      </span>
                      <span className="text-[10px] text-emerald-100/80 mt-0.5">
                        Seluruh rombongan sudah tiba di lokasi lengkap
                      </span>
                    </Button>

                    {checked > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isProcessing}
                        onClick={async () => {
                          await handleCheckIn(groupCheckInBooking, "REGISTERED", { reset: true });
                          setGroupCheckInBooking(null);
                        }}
                        className="w-full text-xs font-semibold h-8 rounded-xl border-slate-200 dark:border-slate-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                      >
                        Reset Status Kehadiran (0/{count})
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setGroupCheckInBooking(null)}
                      className="w-full text-xs text-slate-500 hover:text-slate-700 h-8 rounded-xl cursor-pointer"
                    >
                      Batal / Tutup
                    </Button>
                  </div>
                </>
              );
            })()}
          </Card>
        </div>
      )}

      {/* 5. LIVE CAMERA QR SCANNER MODAL */}
      <EventCheckInQRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        selectedEvent={selectedEvent}
        bookings={bookings}
        onCheckIn={handleCheckIn}
      />
    </div>
  );
}
