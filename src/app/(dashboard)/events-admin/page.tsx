"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Archive,
  Eye,
  Edit,
  ExternalLink,
  Mail,
  Phone,
  User,
  Sparkles,
  RefreshCw,
  MessageSquare,
  ShieldAlert,
  Ticket,
  PlusCircle,
  Download,
  UserCheck,
  DollarSign,
  Users,
  Check,
  X,
  RotateCcw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommunityEvent, EventCategory, EventStatus, EventTicketOrder, EventOperationalStats } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";
import { downloadCSV } from "@/lib/export-utils";

const STATUS_TABS: { key: string; label: string; status?: EventStatus }[] = [
  { key: "ALL", label: "Semua Pengajuan" },
  { key: "PENDING", label: "Menunggu Review", status: "PENDING" },
  { key: "APPROVED", label: "Disetujui", status: "APPROVED" },
  { key: "REVISION_REQUESTED", label: "Perlu Revisi", status: "REVISION_REQUESTED" },
  { key: "REJECTED", label: "Ditolak", status: "REJECTED" },
  { key: "ARCHIVED", label: "Arsip", status: "ARCHIVED" },
];

const CATEGORIES: EventCategory[] = [
  "WORKSHOP",
  "MEETUP",
  "CREATIVE",
  "COMMUNITY",
  "TECH",
  "SEMINAR",
  "OTHER",
];

export default function AdminEventsPage() {
  const { user } = useAuth();
  const { logActivity } = useActivityLog();

  const isAuthorized =
    (user?.role?.slug === "SUPER_ADMIN" ||
      user?.role?.slug === "OWNER" ||
      user?.role?.slug === "MANAGER") &&
    (user?.scopeLevel === "PLATFORM" || user?.scopeLevel === "ORGANIZATION");

  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [allBookings, setAllBookings] = useState<EventTicketOrder[]>([]);
  const [operationalStats, setOperationalStats] = useState<EventOperationalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  // Attendees Modal & Drawer state
  const [selectedEventForAttendees, setSelectedEventForAttendees] = useState<CommunityEvent | null>(null);
  const [isAttendeesModalOpen, setIsAttendeesModalOpen] = useState(false);
  const [attendeeSearchQuery, setAttendeeSearchQuery] = useState("");
  const [isUpdatingCheckIn, setIsUpdatingCheckIn] = useState<string | null>(null);
  const [selectedProofBooking, setSelectedProofBooking] = useState<EventTicketOrder | null>(null);

  // Modals state
  const [selectedEvent, setSelectedEvent] = useState<CommunityEvent | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // Revision / Reject form notes
  const [modalNotes, setModalNotes] = useState("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Edit form state
  const [editFormData, setEditFormData] = useState<Partial<CommunityEvent>>({});
  const [editGuidelinesText, setEditGuidelinesText] = useState("");

  // Auto-dismiss actionSuccessMessage after 4 seconds
  useEffect(() => {
    if (actionSuccessMessage) {
      const timer = setTimeout(() => {
        setActionSuccessMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccessMessage]);

  useEffect(() => {
    if (isAuthorized) {
      loadAdminEvents();
    }
  }, [isAuthorized]);

  const loadAdminEvents = async () => {
    try {
      setIsLoading(true);
      setActionErrorMessage(null);

      const [eventsRes, bookingsRes] = await Promise.all([
        fetch("/api/events/admin"),
        fetch("/api/events/bookings?includeStats=true&unmasked=true"),
      ]);

      const eventsJson = await eventsRes.json();
      if (!eventsRes.ok || !eventsJson.success) {
        setActionErrorMessage(eventsJson.error || "Gagal memuat data event.");
        return;
      }
      setEvents(eventsJson.data || []);

      const bookingsJson = await bookingsRes.json();
      if (bookingsRes.ok && bookingsJson.success) {
        setAllBookings(bookingsJson.data || []);
        if (bookingsJson.stats) {
          setOperationalStats(bookingsJson.stats);
        }
      }
    } catch (err: any) {
      setActionErrorMessage(err.message || "Kesalahan jaringan.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckInToggle = async (booking: EventTicketOrder) => {
    if (booking.paymentStatus === "CANCELLED") return;
    if (booking.paymentStatus === "PENDING" && booking.checkInStatus !== "CHECKED_IN") {
      setActionErrorMessage(
        `Tiket ${booking.ticketCode} (${booking.guestName}) belum diverifikasi lunas (status masih PENDING). Silakan verifikasi pembayaran terlebih dahulu sebelum menandai hadir.`
      );
      return;
    }
    try {
      setIsUpdatingCheckIn(booking.id);
      const nextStatus = booking.checkInStatus === "CHECKED_IN" ? "REGISTERED" : "CHECKED_IN";

      const res = await fetch(`/api/events/bookings/${booking.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ checkInStatus: nextStatus }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setActionErrorMessage(json.error || "Gagal memperbarui status check-in peserta.");
        return;
      }

      setAllBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id
            ? { ...b, checkInStatus: nextStatus, checkInTime: nextStatus === "CHECKED_IN" ? new Date().toISOString() : null }
            : b
        )
      );

      logActivity({
        module: "COMMERCIAL",
        action: nextStatus === "CHECKED_IN" ? "CHECK_IN_ATTENDEE" : "CANCEL_CHECK_IN_ATTENDEE",
        recordId: booking.id,
        description: `Peserta ${booking.guestName} (${booking.ticketCode}) ditandai ${nextStatus === "CHECKED_IN" ? "Hadir" : "Belum Hadir"} pada ${booking.eventTitle}`,
        status: "SUCCESS",
        severity: "LOW",
        category: "OPERATIONAL",
      });

      setActionSuccessMessage(
        nextStatus === "CHECKED_IN"
          ? `Peserta ${booking.guestName} berhasil ditandai hadir!`
          : `Kehadiran peserta ${booking.guestName} dibatalkan.`
      );
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal memperbarui check-in.");
    } finally {
      setIsUpdatingCheckIn(null);
    }
  };

  const handleVerifyPayment = async (booking: EventTicketOrder) => {
    try {
      setIsUpdatingCheckIn(booking.id);
      const res = await fetch(`/api/events/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: "PAID" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setActionErrorMessage(json.error || "Gagal memverifikasi status pembayaran tiket.");
        return;
      }
      setAllBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, paymentStatus: "PAID" } : b))
      );
      setActionSuccessMessage(
        `Pembayaran tiket ${booking.ticketCode} (${booking.guestName}) berhasil diverifikasi Lunas!`
      );
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal memverifikasi pembayaran.");
    } finally {
      setIsUpdatingCheckIn(null);
    }
  };

  const handleExportData = () => {
    const headers = [
      "ID Event",
      "Nama Event",
      "Kategori",
      "Status",
      "Penyelenggara",
      "Email Penyelenggara",
      "No WA Penyelenggara",
      "Tanggal Mulai",
      "Tanggal Selesai",
      "Lokasi",
      "Harga Tiket",
      "Total Peserta",
      "Total Tiket Terjual",
      "Total Omset",
      "Komisi Platform (20%)",
      "Payout Komunitas (80%)",
    ];

    const rows = events.map((evt) => {
      const eventBookings = allBookings.filter((b) => b.eventId === evt.id && b.paymentStatus === "PAID");
      const totalTickets = eventBookings.reduce((sum, b) => sum + b.ticketCount, 0);
      const totalRevenue = eventBookings.reduce((sum, b) => sum + b.totalPrice, 0);
      const platformFee = eventBookings.reduce((sum, b) => sum + b.platformFeeAmount, 0);
      const organizerPayout = eventBookings.reduce((sum, b) => sum + b.organizerRevenueAmount, 0);

      return [
        evt.id,
        evt.title,
        evt.category,
        evt.status,
        evt.organizerName,
        evt.organizerEmail,
        evt.organizerPhone,
        evt.startDate,
        evt.endDate,
        evt.location,
        evt.isPaid ? evt.price : 0,
        eventBookings.length,
        totalTickets,
        totalRevenue,
        platformFee,
        organizerPayout,
      ];
    });

    downloadCSV(`rekap-event-komunitas-dago-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
    setActionSuccessMessage("Data rekap event dan peserta berhasil diekspor ke file CSV!");
  };

  const handleUpdateStatus = async (
    eventId: string,
    newStatus: EventStatus,
    extraData?: { rejectionReason?: string; revisionNotes?: string; adminNotes?: string }
  ) => {
    try {
      setIsProcessingAction(true);
      setActionErrorMessage(null);
      setActionSuccessMessage(null);

      const targetEvt = events.find((e) => e.id === eventId);

      const res = await fetch(`/api/events/${eventId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
          ...extraData,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setActionErrorMessage(json.error || "Gagal memperbarui status event.");
        return;
      }

      logActivity({
        module: "COMMERCIAL",
        action: `MODERATE_EVENT_${newStatus}`,
        recordId: eventId,
        description: `Status event '${targetEvt?.title || eventId}' diubah menjadi ${newStatus}`,
        status: "SUCCESS",
        severity: newStatus === "APPROVED" ? "LOW" : "MEDIUM",
        category: "OPERATIONAL",
      });

      setActionSuccessMessage(json.message);
      setIsRevisionModalOpen(false);
      setIsRejectModalOpen(false);
      setIsDetailModalOpen(false);
      setModalNotes("");

      // Refresh list
      await loadAdminEvents();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal memproses perubahan status.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedEvent) return;

    try {
      setIsProcessingAction(true);
      setActionErrorMessage(null);

      const payload = {
        ...editFormData,
        guidelines: editGuidelinesText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      };

      const res = await fetch(`/api/events/${selectedEvent.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setActionErrorMessage(json.error || "Gagal memperbarui rincian event.");
        return;
      }

      setActionSuccessMessage("Rincian event berhasil diperbarui.");
      setIsEditModalOpen(false);
      await loadAdminEvents();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal menyimpan rincian event.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const openEditModal = (event: CommunityEvent) => {
    setSelectedEvent(event);
    setEditFormData({
      title: event.title,
      category: event.category,
      description: event.description,
      location: event.location,
      startDate: event.startDate ? event.startDate.substring(0, 16) : "",
      endDate: event.endDate ? event.endDate.substring(0, 16) : "",
      isPaid: event.isPaid,
      price: event.price,
      posterUrl: event.posterUrl,
      externalRegistrationUrl: event.externalRegistrationUrl || "",
      guidelines: event.guidelines || [],
    });
    setEditGuidelinesText(
      Array.isArray(event.guidelines) ? event.guidelines.join("\n") : ""
    );
    setIsEditModalOpen(true);
  };

  // Status counts for badges
  const pendingCount = useMemo(
    () => events.filter((e) => e.status === "PENDING").length,
    [events]
  );

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchStatus =
        selectedStatusTab === "ALL" || e.status === selectedStatusTab;
      const matchSearch =
        searchQuery === "" ||
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.organizerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.location.toLowerCase().includes(searchQuery.toLowerCase());

      return matchStatus && matchSearch;
    });
  }, [events, selectedStatusTab, searchQuery]);

  if (!isAuthorized) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card className="p-8 text-center bg-white dark:bg-[#1E293B] border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Akses Dibatasi (Unauthorized)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Halaman moderasi Event Komunitas hanya dapat diakses oleh peran Super Admin, Owner, dan Manager.
            Role Anda saat ini adalah <span className="font-semibold text-rose-600 dark:text-rose-400">{user?.role?.name || "Staff"}</span>.
          </p>
        </Card>
      </div>
    );
  }

  const renderStatusBadge = (status: EventStatus) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold">
            Menunggu Review
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
            Disetujui (Tayang)
          </Badge>
        );
      case "REVISION_REQUESTED":
        return (
          <Badge className="bg-sky-100 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[10px] font-bold">
            Perlu Revisi
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-bold">
            Ditolak
          </Badge>
        );
      case "ARCHIVED":
        return (
          <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-bold">
            Diarsipkan
          </Badge>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Event Komunitas
            </h1>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-extrabold animate-pulse">
                {pendingCount} Menunggu Review
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pengelolaan operasional event komunitas, pendaftaran peserta, tiket digital, moderasi pengajuan, dan integrasi ekosistem Dago.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/events/submit">
            <Button
              size="sm"
              className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Tambah Event</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
            className="text-xs font-semibold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span>Ekspor Data</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAdminEvents}
            disabled={isLoading}
            className="text-xs font-semibold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </Button>
          <a href="/events" target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-semibold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              <span>Katalog Publik</span>
            </Button>
          </a>
        </div>
      </div>

      {/* 4 Kartu Ringkasan Operasional Sederhana */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Event Terdaftar</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {events.length} <span className="text-xs font-normal text-slate-400">Event</span>
          </div>
          <span className="text-[10px] text-slate-400">Seluruh agenda komunitas</span>
        </Card>

        <Card className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Event Aktif & Tayang</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {events.filter((e) => e.status === "APPROVED").length} <span className="text-xs font-normal text-slate-400">Disetujui</span>
          </div>
          <span className="text-[10px] text-slate-400">Dapat diakses publik</span>
        </Card>

        <Card className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Menunggu Moderasi</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400">
            {events.filter((e) => e.status === "PENDING" || e.status === "REVISION_REQUESTED").length} <span className="text-xs font-normal text-slate-400">Review</span>
          </div>
          <span className="text-[10px] text-slate-400">Perlu tindakan kurasi</span>
        </Card>

        <Card className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Tiket & Peserta</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 flex items-center justify-center">
              <Ticket className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {allBookings.filter((b) => b.paymentStatus === "PAID").length} <span className="text-xs font-normal text-slate-400">Peserta</span>
          </div>
          <span className="text-[10px] font-bold text-[#3B7A57] dark:text-[#52B788]">
            {formatCurrencyIDR(allBookings.filter((b) => b.paymentStatus === "PAID").reduce((sum, b) => sum + b.totalPrice, 0))}
          </span>
        </Card>
      </div>

      {/* Action Notices */}
      {actionSuccessMessage && (
        <div className="relative overflow-hidden p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <div>
              <span className="font-bold block">{actionSuccessMessage}</span>
              <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80">Pemberitahuan otomatis tertutup dalam beberapa detik</span>
            </div>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 px-2 py-1 rounded-lg ml-4 transition-colors cursor-pointer"
          >
            ✕ Tutup
          </button>
        </div>
      )}

      {actionErrorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{actionErrorMessage}</span>
          </div>
          <div className="flex items-center space-x-3">
            {actionErrorMessage.includes("CUSTOMER") && (
              <Link href="/events/portal">
                <Button size="sm" className="h-7 text-[11px] bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold rounded-lg px-2.5">
                  Buka Portal Penyelenggara
                </Button>
              </Link>
            )}
            <button
              onClick={() => setActionErrorMessage(null)}
              className="text-xs font-bold underline cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {STATUS_TABS.map((tab) => {
            const active = selectedStatusTab === tab.key;
            const count =
              tab.status !== undefined
                ? events.filter((e) => e.status === tab.status).length
                : events.length;

            return (
              <button
                key={tab.key}
                onClick={() => setSelectedStatusTab(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                  active
                    ? "bg-[#3B7A57] text-white shadow-sm"
                    : "bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama event atau penyelenggara..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
          />
        </div>
      </div>

      {/* Table / List View of Events */}
      <Card className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <div className="w-6 h-6 border-2 border-[#3B7A57] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Memuat pengajuan event...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            Tidak ada pengajuan event pada status ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Event & Poster</th>
                  <th className="py-3 px-4">Kategori & Harga</th>
                  <th className="py-3 px-4">Jadwal & Ruang</th>
                  <th className="py-3 px-4">Penyelenggara</th>
                  <th className="py-3 px-4">Peserta & Tiket</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi Pengelolaan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredEvents.map((evt) => {
                  const evtBookings = allBookings.filter((b) => b.eventId === evt.id && b.paymentStatus === "PAID");
                  const totalTickets = evtBookings.reduce((sum, b) => sum + b.ticketCount, 0);
                  const totalRevenue = evtBookings.reduce((sum, b) => sum + b.totalPrice, 0);

                  return (
                    <tr
                      key={evt.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Event Title & Poster */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0 relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={evt.posterUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white block truncate">
                              {evt.title}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-300 font-mono block">
                              ID: {evt.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category & Pricing */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <Badge variant="outline" className="text-[10px] border-slate-300 dark:border-slate-700">
                            {evt.category}
                          </Badge>
                          <span className="block font-bold text-slate-800 dark:text-slate-200">
                            {evt.isPaid ? formatCurrencyIDR(evt.price) : "Gratis"}
                          </span>
                        </div>
                      </td>

                      {/* Schedule & Venue */}
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1.5 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
                            <span>{new Date(evt.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                          </div>
                          <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-300 text-[11px]">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">{evt.location}</span>
                          </div>
                        </div>
                      </td>

                      {/* Organizer details */}
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span className="font-semibold block truncate max-w-[140px]">
                            {evt.organizerName}
                          </span>
                          <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-300">
                            <a
                              href={`https://wa.me/${evt.organizerPhone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-emerald-600"
                              title="WhatsApp"
                            >
                              <Phone className="w-3 h-3 inline mr-0.5" />
                              WA
                            </a>
                            <span>•</span>
                            <a
                              href={`mailto:${evt.organizerEmail}`}
                              className="hover:text-emerald-600"
                              title="Email"
                            >
                              <Mail className="w-3 h-3 inline mr-0.5" />
                              Email
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* Peserta & Tiket */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 dark:text-white flex items-center space-x-1">
                            <Users className="w-3 h-3 text-[#3B7A57]" />
                            <span>{evtBookings.length} Peserta ({totalTickets} Tiket)</span>
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">
                            {evt.isPaid ? formatCurrencyIDR(totalRevenue) : "Event Gratis"}
                          </span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadge(evt.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1.5">
                          {/* Kelola Peserta & Tiket */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEventForAttendees(evt);
                              setAttendeeSearchQuery("");
                              setIsAttendeesModalOpen(true);
                            }}
                            className="h-8 px-2.5 text-[11px] font-bold text-[#3B7A57] dark:text-[#52B788] border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg cursor-pointer"
                            title="Kelola Data Peserta & Check-In Tiket"
                          >
                            <Ticket className="w-3.5 h-3.5 mr-1" />
                            <span>Peserta</span>
                          </Button>

                          {/* View Details */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedEvent(evt);
                              setIsDetailModalOpen(true);
                            }}
                            className="h-8 px-2 text-slate-600 dark:text-slate-400 hover:text-[#3B7A57]"
                            title="Lihat Detail & Kontak"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>

                          {/* Edit details */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(evt)}
                            className="h-8 px-2 text-slate-600 dark:text-slate-400 hover:text-blue-600"
                            title="Edit Rincian"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>

                          {/* Approve Quick Button */}
                          {evt.status !== "APPROVED" && (
                            <Button
                              size="sm"
                              onClick={() => handleUpdateStatus(evt.id, "APPROVED")}
                              disabled={isProcessingAction}
                              className="h-8 px-2.5 bg-[#3B7A57] hover:bg-[#2E6044] text-white text-[11px] font-bold rounded-lg shadow-xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Setujui
                            </Button>
                          )}

                          {/* Request Revision */}
                          {evt.status === "PENDING" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedEvent(evt);
                                setModalNotes(evt.revisionNotes || "");
                                setIsRevisionModalOpen(true);
                              }}
                              className="h-8 px-2.5 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800 hover:bg-sky-50 text-[11px] font-semibold rounded-lg"
                            >
                              Revisi
                            </Button>
                          )}

                          {/* Reject */}
                          {evt.status === "PENDING" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedEvent(evt);
                                setModalNotes(evt.rejectionReason || "");
                                setIsRejectModalOpen(true);
                              }}
                              className="h-8 px-2 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 hover:bg-rose-50 text-[11px] rounded-lg"
                              title="Tolak Pengajuan"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          {/* Archive (for approved/rejected) */}
                          {evt.status === "APPROVED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUpdateStatus(evt.id, "ARCHIVED")}
                              disabled={isProcessingAction}
                              className="h-8 px-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              title="Arsipkan Event"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* DETAIL MODAL */}
      {isDetailModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-y-auto max-h-[90vh] space-y-5">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[11px] text-slate-400 font-mono">ID: {selectedEvent.id}</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Poster Preview */}
            <div className="h-44 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedEvent.posterUrl}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 flex space-x-1.5">
                {renderStatusBadge(selectedEvent.status)}
                <Badge className="bg-slate-900/80 text-white text-[10px]">
                  {selectedEvent.category}
                </Badge>
              </div>
            </div>

            {/* Organizer Contact Card (Private) */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Kontak Penyelenggara (Privat):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Nama:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedEvent.organizerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Email:</span>
                  <a href={`mailto:${selectedEvent.organizerEmail}`} className="text-emerald-600 underline">
                    {selectedEvent.organizerEmail}
                  </a>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">WhatsApp / Telp:</span>
                  <a
                    href={`https://wa.me/${selectedEvent.organizerPhone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 underline font-semibold"
                  >
                    {selectedEvent.organizerPhone}
                  </a>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                Pemberitahuan perubahan status atau revisi disampaikan secara manual menggunakan kontak di atas.
              </p>
            </div>

            {/* Description */}
            <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
              {selectedEvent.description}
            </div>

            {/* Guidelines if exists */}
            {selectedEvent.guidelines && selectedEvent.guidelines.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-200 block mb-1">
                  Panduan & Ketentuan Khusus Acara:
                </span>
                <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  {selectedEvent.guidelines.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Rejection / Revision Notes if exists */}
            {selectedEvent.revisionNotes && (
              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-xs">
                <span className="font-bold block">Catatan Revisi Terakhir:</span>
                {selectedEvent.revisionNotes}
              </div>
            )}
            {selectedEvent.rejectionReason && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs">
                <span className="font-bold block">Alasan Penolakan:</span>
                {selectedEvent.rejectionReason}
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDetailModalOpen(false)}
                className="text-xs"
              >
                Tutup
              </Button>

              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedEventForAttendees(selectedEvent);
                    setAttendeeSearchQuery("");
                    setIsAttendeesModalOpen(true);
                  }}
                  className="text-xs font-bold text-[#3B7A57] dark:text-[#52B788] border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  <Ticket className="w-3.5 h-3.5 mr-1" />
                  <span>Daftar Peserta</span>
                </Button>
                {selectedEvent.status !== "APPROVED" && (
                  <Button
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedEvent.id, "APPROVED")}
                    disabled={isProcessingAction}
                    className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold"
                  >
                    Setujui & Publikasikan
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REVISION MODAL */}
      {isRevisionModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Minta Revisi Pengajuan
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tuliskan poin yang perlu disesuaikan oleh penyelenggara (misal resolusi poster, penyesuaian jam ruangan, dll).
            </p>

            <textarea
              rows={4}
              value={modalNotes}
              onChange={(e) => setModalNotes(e.target.value)}
              placeholder="Contoh: Mohon perbarui deskripsi agar mencantumkan target peserta dan fasilitas yang disediakan..."
              className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />

            <div className="flex items-center justify-end space-x-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRevisionModalOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                size="sm"
                disabled={isProcessingAction || !modalNotes.trim()}
                onClick={() =>
                  handleUpdateStatus(selectedEvent.id, "REVISION_REQUESTED", {
                    revisionNotes: modalNotes,
                  })
                }
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
              >
                Kirim Permintaan Revisi
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {isRejectModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Tolak Pengajuan Event
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tuliskan alasan penolakan untuk catatan kurator internal dan konfirmasi ke penyelenggara.
            </p>

            <textarea
              rows={3}
              value={modalNotes}
              onChange={(e) => setModalNotes(e.target.value)}
              placeholder="Contoh: Ruang amphitheater telah terbooking penuh pada tanggal yang diajukan..."
              className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />

            <div className="flex items-center justify-end space-x-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRejectModalOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                size="sm"
                disabled={isProcessingAction || !modalNotes.trim()}
                onClick={() =>
                  handleUpdateStatus(selectedEvent.id, "REJECTED", {
                    rejectionReason: modalNotes,
                  })
                }
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Tolak Pengajuan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-y-auto max-h-[90vh] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Edit Informasi Event
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Judul Event</label>
                <input
                  type="text"
                  value={editFormData.title || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Kategori</label>
                  <select
                    value={editFormData.category || "COMMUNITY"}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, category: e.target.value as EventCategory })
                    }
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Lokasi</label>
                  <input
                    type="text"
                    value={editFormData.location || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Waktu Mulai</label>
                  <input
                    type="datetime-local"
                    value={editFormData.startDate || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Waktu Selesai</label>
                  <input
                    type="datetime-local"
                    value={editFormData.endDate || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Deskripsi</label>
                <textarea
                  rows={4}
                  value={editFormData.description || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Harga Tiket (Rp)</label>
                  <input
                    type="number"
                    value={editFormData.price || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        price: Number(e.target.value),
                        isPaid: Number(e.target.value) > 0,
                      })
                    }
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">URL Poster</label>
                  <input
                    type="url"
                    value={editFormData.posterUrl || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, posterUrl: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">URL Pendaftaran Eksternal</label>
                <input
                  type="url"
                  value={editFormData.externalRegistrationUrl || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, externalRegistrationUrl: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  Panduan & Ketentuan Khusus Acara (1 baris per poin)
                </label>
                <textarea
                  rows={3}
                  value={editGuidelinesText}
                  onChange={(e) => setEditGuidelinesText(e.target.value)}
                  placeholder="Contoh:&#10;Bawa laptop dan charger masing-masing&#10;Dilarang membawa makanan dari luar"
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditModalOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                size="sm"
                disabled={isProcessingAction}
                onClick={handleSaveEdit}
                className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold"
              >
                Simpan Perubahan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* KELOLA PESERTA & CHECK-IN MODAL */}
      {isAttendeesModalOpen && selectedEventForAttendees && (() => {
        const evt = selectedEventForAttendees;
        const eventBookings = allBookings.filter((b) => b.eventId === evt.id);
        const paidBookings = eventBookings.filter((b) => b.paymentStatus === "PAID");
        const totalTicketsSold = paidBookings.reduce((sum, b) => sum + b.ticketCount, 0);
        const grossOmset = paidBookings.reduce((sum, b) => sum + b.totalPrice, 0);
        const platformRevenue = paidBookings.reduce((sum, b) => sum + b.platformFeeAmount, 0);
        const organizerPayout = paidBookings.reduce((sum, b) => sum + b.organizerRevenueAmount, 0);
        const checkedInCount = paidBookings.filter((b) => b.checkInStatus === "CHECKED_IN").length;

        const filteredAttendees = eventBookings.filter((b) => {
          const q = attendeeSearchQuery.toLowerCase();
          return (
            b.guestName.toLowerCase().includes(q) ||
            b.ticketCode.toLowerCase().includes(q) ||
            b.guestEmail.toLowerCase().includes(q) ||
            b.guestPhone.includes(q) ||
            (b.institution && b.institution.toLowerCase().includes(q))
          );
        });

        const handleExportAttendeesCSV = () => {
          const headers = [
            "Kode Tiket",
            "Nama Peserta",
            "Email",
            "No WhatsApp",
            "Instansi / Komunitas",
            "Jumlah Tiket",
            "Total Bayar (Rp)",
            "Status Pembayaran",
            "Status Check-In",
            "Waktu Check-In",
            "Waktu Registrasi",
          ];
          const rows = eventBookings.map((b) => [
            b.ticketCode,
            b.guestName,
            b.guestEmail,
            b.guestPhone,
            b.institution || "-",
            b.ticketCount,
            b.totalPrice,
            b.paymentStatus,
            b.checkInStatus === "CHECKED_IN" ? "HADIR" : "BELUM HADIR",
            b.checkInTime ? new Date(b.checkInTime).toLocaleString("id-ID") : "-",
            new Date(b.createdAt).toLocaleString("id-ID"),
          ]);
          downloadCSV(`daftar-peserta-${evt.id}.csv`, headers, rows);
          setActionSuccessMessage(`Data ${rows.length} peserta event berhasil diekspor!`);
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="relative w-full max-w-4xl bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 overflow-hidden flex flex-col max-h-[92vh]">
              {/* Header */}
              <div className="flex items-start justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <Badge variant="outline" className="text-[10px] border-emerald-300 dark:border-emerald-800 text-[#3B7A57] dark:text-[#52B788]">
                      {evt.category}
                    </Badge>
                    <span className="text-[10px] text-slate-400 font-mono">ID: {evt.id}</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Kelola Peserta & Check-In: {evt.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {new Date(evt.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} • {evt.location}
                  </p>
                </div>
                <button
                  onClick={() => setIsAttendeesModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Financial & Attendance Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-3.5 flex-shrink-0">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Kehadiran Peserta</span>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {checkedInCount} <span className="text-xs font-normal text-slate-400">/ {paidBookings.length} Hadir</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium">
                    {paidBookings.length > 0 ? `${Math.round((checkedInCount / paidBookings.length) * 100)}% Rasio Kehadiran` : "Belum ada peserta"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Total Tiket Terjual</span>
                  <div className="text-base font-extrabold text-[#3B7A57] dark:text-[#52B788] mt-0.5">
                    {totalTicketsSold} <span className="text-xs font-normal text-slate-400">Tiket</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {evt.isPaid ? formatCurrencyIDR(grossOmset) : "Event Gratis"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Bagi Hasil Dago (20%)</span>
                  <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {formatCurrencyIDR(platformRevenue)}
                  </div>
                  <span className="text-[10px] text-slate-400">Fee platform & venue</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Payout Komunitas (80%)</span>
                  <div className="text-base font-extrabold text-sky-700 dark:text-sky-400 mt-0.5">
                    {formatCurrencyIDR(organizerPayout)}
                  </div>
                  <span className="text-[10px] text-slate-400">Hak penyelenggara</span>
                </div>
              </div>

              {/* Search & Actions Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-3 flex-shrink-0">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={attendeeSearchQuery}
                    onChange={(e) => setAttendeeSearchQuery(e.target.value)}
                    placeholder="Cari kode tiket, nama, instansi, email, atau no WhatsApp..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#3B7A57]"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportAttendeesCSV}
                  disabled={eventBookings.length === 0}
                  className="text-xs font-semibold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  <span>Ekspor CSV</span>
                </Button>
              </div>

              {/* Attendee Table */}
              <div className="flex-1 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800/80">
                {filteredAttendees.length === 0 ? (
                  <div className="p-10 text-center">
                    <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {eventBookings.length === 0
                        ? "Belum ada pendaftaran tiket untuk event ini."
                        : "Tidak ada data peserta yang cocok dengan pencarian."}
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/70 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-100 dark:border-slate-800">
                        <th className="py-2.5 px-3">Kode Tiket</th>
                        <th className="py-2.5 px-3">Data Peserta</th>
                        <th className="py-2.5 px-3">Kontak</th>
                        <th className="py-2.5 px-3 text-center">Qty Tiket</th>
                        <th className="py-2.5 px-3">Status Bayar</th>
                        <th className="py-2.5 px-3 text-center">Status Kehadiran</th>
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
                            <span className="font-semibold text-slate-900 dark:text-white block">
                              {b.guestName}
                            </span>
                            {b.institution && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate max-w-[150px]">
                                {b.institution}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-[11px]">
                            <a
                              href={`https://wa.me/${b.guestPhone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:underline block"
                            >
                              <Phone className="w-3 h-3 inline mr-1" />
                              {b.guestPhone}
                            </a>
                            <span className="text-slate-400 text-[10px] block truncate max-w-[140px]">
                              {b.guestEmail}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                            {b.ticketCount}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center space-x-1.5">
                              {b.paymentStatus === "PAID" ? (
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">
                                  LUNAS
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[10px]">
                                  {b.paymentStatus}
                                </Badge>
                              )}
                              {b.paymentProofUrl && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedProofBooking(b)}
                                  className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[10px] font-bold hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors cursor-pointer"
                                  title="Lihat Bukti Transfer"
                                >
                                  <Eye className="w-2.5 h-2.5" />
                                  <span>Bukti</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {b.checkInStatus === "CHECKED_IN" ? (
                              <span className="inline-flex flex-col items-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  <Check className="w-3 h-3 mr-1" /> Hadir
                                </span>
                                {b.checkInTime && (
                                  <span className="text-[9px] text-slate-400 mt-0.5">
                                    {new Date(b.checkInTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                Belum Hadir
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {b.paymentStatus === "PENDING" && (
                              <div className="inline-flex items-center space-x-1 mr-1.5">
                                {b.paymentProofUrl && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedProofBooking(b)}
                                    className="h-7 px-2 text-[10px] font-bold border-sky-300 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-lg cursor-pointer"
                                    title="Periksa Foto Bukti Transfer"
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    <span>Bukti</span>
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  disabled={isUpdatingCheckIn === b.id}
                                  onClick={() => handleVerifyPayment(b)}
                                  className="h-7 px-2 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-xs cursor-pointer"
                                  title="Verifikasi Pembayaran Lunas"
                                >
                                  Verifikasi Lunas
                                </Button>
                              </div>
                            )}
                            <Button
                              size="sm"
                              disabled={isUpdatingCheckIn === b.id || b.paymentStatus === "CANCELLED"}
                              onClick={() => handleCheckInToggle(b)}
                              className={`h-7 px-2 text-[11px] font-semibold rounded-lg ${
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
                                  ? "Batal"
                                  : b.checkInStatus === "CHECKED_IN"
                                  ? "Batal"
                                  : "Hadir"}
                              </span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Total {filteredAttendees.length} dari {eventBookings.length} data pendaftar
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAttendeesModalOpen(false)}
                  className="text-xs"
                >
                  Tutup
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Preview Bukti Transfer Pembayaran */}
      {selectedProofBooking && selectedProofBooking.paymentProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Verifikasi Bukti Transfer</span>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  {selectedProofBooking.ticketCode} • {selectedProofBooking.guestName}
                </h4>
              </div>
              <button
                onClick={() => setSelectedProofBooking(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2 py-1 rounded-lg cursor-pointer"
              >
                ✕ Tutup
              </button>
            </div>

            <div className="p-4 bg-slate-950 flex items-center justify-center max-h-[60vh] overflow-auto">
              <img
                src={selectedProofBooking.paymentProofUrl}
                alt="Bukti Transfer"
                className="max-h-[55vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">Total Tagihan:</span>
                  <span className="font-bold text-[#3B7A57] dark:text-[#52B788] text-sm">
                    {formatCurrencyIDR(selectedProofBooking.totalPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Waktu Unggah:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                    {selectedProofBooking.paymentProofUploadedAt ? new Date(selectedProofBooking.paymentProofUploadedAt).toLocaleString("id-ID") : "Baru saja"}
                  </span>
                </div>
              </div>

              {selectedProofBooking.paymentProofNote && (
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-[10px] text-slate-400 block font-semibold">Catatan dari Pemesan:</span>
                  <p className="text-slate-700 dark:text-slate-300 font-medium">
                    &quot;{selectedProofBooking.paymentProofNote}&quot;
                  </p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedProofBooking(null)}
                  className="text-xs h-8 px-3 font-semibold rounded-xl cursor-pointer"
                >
                  Tutup
                </Button>
                {selectedProofBooking.paymentStatus === "PENDING" && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      await handleVerifyPayment(selectedProofBooking);
                      setSelectedProofBooking(null);
                    }}
                    className="text-xs h-8 px-4 font-bold bg-[#3B7A57] hover:bg-[#2E6044] text-white rounded-xl shadow-xs cursor-pointer flex items-center space-x-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Konfirmasi & Verifikasi Lunas</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
