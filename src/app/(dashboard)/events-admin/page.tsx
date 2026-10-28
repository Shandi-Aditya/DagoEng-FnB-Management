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
  Building2,
  Settings,
  Trash2,
  Plus,
  AlertCircle,
  ArrowUpRight,
  CreditCard,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommunityEvent, EventCategory, EventStatus, EventTicketOrder, EventOperationalStats } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";
import { downloadCSV } from "@/lib/export-utils";
import {
  EventDateRangeFilter,
  DateRange,
  isEventInWitaPeriod,
} from "@/components/events/EventDateRangeFilter";

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
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
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

  // Revenue split negotiation state in admin modal
  const [isProposingSplit, setIsProposingSplit] = useState(false);
  const [splitOrgPercent, setSplitOrgPercent] = useState<number>(80);
  const [splitPlatPercent, setSplitPlatPercent] = useState<number>(20);
  const [splitReason, setSplitReason] = useState("");
  const [isSubmittingSplit, setIsSubmittingSplit] = useState(false);

  // Payout action state in admin modal
  const [payoutPromptModalOpen, setPayoutPromptModalOpen] = useState(false);
  const [activePayoutTarget, setActivePayoutTarget] = useState<{ id: string; status: "PROCESSING" | "PAID" | "REJECTED" } | null>(null);
  const [payoutInputText, setPayoutInputText] = useState("");
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);

  // Section Navigation: Moderation vs Payments Verification vs Bank/Business Settings
  const [adminSection, setAdminSection] = useState<"MODERATION" | "PAYMENTS" | "SETTINGS">("MODERATION");

  // Payment Verification state
  const [paymentFilterStatus, setPaymentFilterStatus] = useState<"ALL" | "PENDING_PROOF" | "PAID" | "REJECTED">("PENDING_PROOF");
  const [rejectPaymentTarget, setRejectPaymentTarget] = useState<EventTicketOrder | null>(null);
  const [rejectPaymentReason, setRejectPaymentReason] = useState("");
  const [rejectPaymentCancelBooking, setRejectPaymentCancelBooking] = useState(false);
  const [isProcessingPaymentAction, setIsProcessingPaymentAction] = useState(false);

  // Bank & Business Settings State
  const [businessPolicy, setBusinessPolicy] = useState<any>(null);
  const [bankAccountsList, setBankAccountsList] = useState<any[]>([]);
  const [bankChangeHistory, setBankChangeHistory] = useState<any[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isAddBankModalOpen, setIsAddBankModalOpen] = useState(false);
  const [newBankForm, setNewBankForm] = useState({
    label: "",
    bankName: "BCA",
    accountNumber: "",
    accountHolder: "",
    branch: "",
    badge: "Utama",
    isDefault: false,
  });

  const loadBusinessSettings = async () => {
    try {
      const [settingsRes, banksRes] = await Promise.all([
        fetch("/api/events/admin/settings"),
        fetch("/api/events/admin/settings/banks"),
      ]);
      const settingsData = await settingsRes.json();
      if (settingsData.success) {
        setBusinessPolicy(settingsData.data);
      }
      const banksData = await banksRes.json();
      if (banksData.success) {
        setBankAccountsList(banksData.data.bankAccounts || []);
        setBankChangeHistory(banksData.data.bankHistory || []);
      }
    } catch (e) {
      console.error("Error loading event settings:", e);
    }
  };

  const handleApprovePayment = async (booking: EventTicketOrder) => {
    try {
      setIsProcessingPaymentAction(true);
      const res = await fetch(`/api/events/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE_PAYMENT" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyetujui pembayaran.");
      }
      setActionSuccessMessage(`Pembayaran tiket ${booking.ticketCode} (${booking.guestName}) berhasil disetujui! E-Tiket & QR Code kini aktif.`);
      await loadAdminEvents();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal menyetujui pembayaran.");
    } finally {
      setIsProcessingPaymentAction(false);
    }
  };

  const handleConfirmRejectPayment = async () => {
    if (!rejectPaymentTarget || !rejectPaymentReason.trim()) {
      setActionErrorMessage("Alasan penolakan pembayaran wajib diisi.");
      return;
    }
    try {
      setIsProcessingPaymentAction(true);
      const res = await fetch(`/api/events/bookings/${rejectPaymentTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REJECT_PAYMENT",
          rejectionReason: rejectPaymentReason.trim(),
          cancelBooking: rejectPaymentCancelBooking,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menolak bukti pembayaran.");
      }
      setActionSuccessMessage(`Bukti pembayaran untuk tiket ${rejectPaymentTarget.ticketCode} berhasil ditolak.`);
      setRejectPaymentTarget(null);
      setRejectPaymentReason("");
      setRejectPaymentCancelBooking(false);
      await loadAdminEvents();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal menolak bukti pembayaran.");
    } finally {
      setIsProcessingPaymentAction(false);
    }
  };

  const handleSaveBusinessSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessPolicy) return;
    try {
      setIsSavingSettings(true);
      const res = await fetch("/api/events/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultPlatformFeePercent: businessPolicy.defaultPlatformFeePercent,
          maxTicketsPerBooking: businessPolicy.maxTicketsPerBooking,
          activePaymentMethod: businessPolicy.activePaymentMethod,
          bookingPaymentExpiryMinutes: businessPolicy.bookingPaymentExpiryMinutes,
          allowOrganizerBankAccounts: businessPolicy.allowOrganizerBankAccounts,
          allowEventBankOverride: businessPolicy.allowEventBankOverride,
          paymentInstructions: businessPolicy.paymentInstructions,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan pengaturan.");
      }
      setActionSuccessMessage("Pengaturan kebijakan bisnis & pembayaran event berhasil disimpan!");
      setBusinessPolicy(data.data);
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal menyimpan pengaturan.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCreateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingSettings(true);
      const res = await fetch("/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBankForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menambahkan rekening bank.");
      }
      setActionSuccessMessage(`Rekening ${data.data.bankName} berhasil ditambahkan.`);
      setIsAddBankModalOpen(false);
      setNewBankForm({
        label: "",
        bankName: "BCA",
        accountNumber: "",
        accountHolder: "",
        branch: "",
        badge: "Utama",
        isDefault: false,
      });
      await loadBusinessSettings();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal menambahkan rekening.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSetDefaultBank = async (bankId: string) => {
    try {
      const res = await fetch("/api/events/admin/settings/banks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bankId, action: "SET_DEFAULT" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menetapkan rekening default.");
      }
      setActionSuccessMessage("Rekening default platform berhasil diperbarui!");
      await loadBusinessSettings();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal menetapkan rekening default.");
    }
  };

  const handleToggleBankActive = async (bankId: string, currentActive: boolean) => {
    try {
      const res = await fetch("/api/events/admin/settings/banks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bankId, isActive: !currentActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memperbarui status rekening.");
      }
      setActionSuccessMessage(`Status rekening berhasil ${!currentActive ? "diaktifkan" : "dinonaktifkan"}.`);
      await loadBusinessSettings();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal memperbarui status rekening.");
    }
  };

  const handleDeleteBank = async (bankId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus rekening bank ini?")) return;
    try {
      const res = await fetch(`/api/events/admin/settings/banks?id=${bankId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menghapus rekening.");
      }
      setActionSuccessMessage("Rekening bank berhasil dihapus.");
      await loadBusinessSettings();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal menghapus rekening.");
    }
  };

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
      loadBusinessSettings();
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

  const handleProposeSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    if (splitOrgPercent + splitPlatPercent !== 100) {
      setActionErrorMessage("Total persentase bagi hasil harus tepat 100%.");
      return;
    }
    try {
      setIsSubmittingSplit(true);
      const res = await fetch(`/api/events/${selectedEvent.id}/revenue-share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposedBy: "DAGO_ADMIN",
          organizerPercent: splitOrgPercent,
          platformPercent: splitPlatPercent,
          reason: splitReason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengajukan usulan bagi hasil.");
      }
      setActionSuccessMessage("Usulan bagi hasil berhasil dikirim ke penyelenggara.");
      setSelectedEvent(data.data);
      setIsProposingSplit(false);
      await loadAdminEvents();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmittingSplit(false);
    }
  };

  const handleRespondSplit = async (decision: "ACCEPT" | "REJECT") => {
    if (!selectedEvent) return;
    try {
      setIsSubmittingSplit(true);
      const res = await fetch(`/api/events/${selectedEvent.id}/revenue-share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          respondingParty: "DAGO_ADMIN",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memproses respons bagi hasil.");
      }
      setActionSuccessMessage(data.message || "Respons bagi hasil berhasil diproses.");
      setSelectedEvent(data.data);
      await loadAdminEvents();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmittingSplit(false);
    }
  };

  const handleUpdatePayoutStatus = async (
    payoutId: string,
    newStatus: "PROCESSING" | "PAID" | "REJECTED",
    referenceNo?: string,
    rejectionReason?: string
  ) => {
    if (!selectedEvent) return;
    try {
      setIsProcessingPayout(true);
      const res = await fetch(`/api/events/${selectedEvent.id}/payout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutId,
          newStatus,
          referenceNo,
          rejectionReason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memperbarui status payout.");
      }
      setActionSuccessMessage(data.message || "Status payout berhasil diperbarui.");
      setSelectedEvent(data.data.event);
      setPayoutPromptModalOpen(false);
      setActivePayoutTarget(null);
      setPayoutInputText("");
      await loadAdminEvents();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Terjadi kesalahan.");
    } finally {
      setIsProcessingPayout(false);
    }
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
      const matchDate = isEventInWitaPeriod(e, dateRange);

      return matchStatus && matchSearch && matchDate;
    });
  }, [events, selectedStatusTab, searchQuery, dateRange]);

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

      {/* Main Admin Section Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setAdminSection("MODERATION")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            adminSection === "MODERATION"
              ? "bg-[#3B7A57] text-white shadow-sm"
              : "bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Moderasi Event</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-extrabold">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setAdminSection("PAYMENTS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            adminSection === "PAYMENTS"
              ? "bg-[#3B7A57] text-white shadow-sm"
              : "bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Verifikasi Pembayaran Manual</span>
          {allBookings.filter((b) => b.totalPrice > 0 && b.paymentStatus === "PENDING" && Boolean(b.paymentProofUrl)).length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-extrabold animate-pulse">
              {allBookings.filter((b) => b.totalPrice > 0 && b.paymentStatus === "PENDING" && Boolean(b.paymentProofUrl)).length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setAdminSection("SETTINGS");
            loadBusinessSettings();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            adminSection === "SETTINGS"
              ? "bg-[#3B7A57] text-white shadow-sm"
              : "bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Pengaturan Rekening & Bisnis</span>
        </button>
      </div>

      {adminSection === "MODERATION" && (
        <>
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

      {/* Date Range Filter for Event Execution */}
      <div className="pb-2">
        <EventDateRangeFilter
          onApplyFilter={(range) => setDateRange(range)}
          initialRange={dateRange}
          label="Filter Rentang Tanggal Pelaksanaan Event (WITA)"
        />
      </div>

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
      </>
      )}

      {/* ===================================================================== */}
      {/* SECTION B: VERIFIKASI PEMBAYARAN MANUAL */}
      {/* ===================================================================== */}
      {adminSection === "PAYMENTS" && (
        <div className="space-y-5">
          {/* Top KPI Cards for Payments */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 block pb-1">Total Pesanan Berbayar</span>
              <div className="text-xl font-black text-slate-900 dark:text-white">
                {allBookings.filter((b) => b.totalPrice > 0).length} <span className="text-xs font-normal text-slate-400">Pesanan</span>
              </div>
              <span className="text-[10px] text-slate-400">Seluruh modul marketplace</span>
            </Card>

            <Card className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-amber-200 dark:border-amber-900/50 shadow-2xs">
              <span className="text-[11px] font-semibold text-amber-600 block pb-1">Menunggu Verifikasi</span>
              <div className="text-xl font-black text-amber-600 dark:text-amber-400">
                {allBookings.filter((b) => b.totalPrice > 0 && b.paymentStatus === "PENDING" && Boolean(b.paymentProofUrl)).length}{" "}
                <span className="text-xs font-normal text-slate-400">Bukti</span>
              </div>
              <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 font-medium">Perlu tindakan review</span>
            </Card>

            <Card className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-emerald-200 dark:border-emerald-900/50 shadow-2xs">
              <span className="text-[11px] font-semibold text-emerald-600 block pb-1">Lunas Terverifikasi</span>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                {allBookings.filter((b) => b.paymentStatus === "PAID" && b.totalPrice > 0).length}{" "}
                <span className="text-xs font-normal text-slate-400">Transaksi</span>
              </div>
              <span className="text-[10px] font-bold text-[#3B7A57] dark:text-[#52B788]">
                {formatCurrencyIDR(allBookings.filter((b) => b.paymentStatus === "PAID" && b.totalPrice > 0).reduce((s, b) => s + b.totalPrice, 0))}
              </span>
            </Card>

            <Card className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-rose-200 dark:border-rose-900/50 shadow-2xs">
              <span className="text-[11px] font-semibold text-rose-600 block pb-1">Bukti Ditolak / Revisi</span>
              <div className="text-xl font-black text-rose-600 dark:text-rose-400">
                {allBookings.filter((b) => Boolean(b.paymentRejectionReason)).length}{" "}
                <span className="text-xs font-normal text-slate-400">Pesanan</span>
              </div>
              <span className="text-[10px] text-slate-400">Menunggu perbaikan transfer</span>
            </Card>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { key: "PENDING_PROOF", label: "Menunggu Verifikasi" },
                { key: "ALL", label: "Semua Transaksi" },
                { key: "PAID", label: "Lunas (Approved)" },
                { key: "REJECTED", label: "Ditolak / Revisi" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setPaymentFilterStatus(tab.key as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    paymentFilterStatus === tab.key
                      ? "bg-[#3B7A57] text-white shadow-xs"
                      : "bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table of Manual Payment Bookings */}
          <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs bg-white dark:bg-[#1E293B]">
            {(() => {
              const paymentBookings = allBookings.filter((b) => {
                if (b.totalPrice <= 0) return false;
                if (paymentFilterStatus === "PENDING_PROOF") {
                  return b.paymentStatus === "PENDING" && Boolean(b.paymentProofUrl);
                }
                if (paymentFilterStatus === "PAID") {
                  return b.paymentStatus === "PAID";
                }
                if (paymentFilterStatus === "REJECTED") {
                  return Boolean(b.paymentRejectionReason);
                }
                return true;
              });

              if (paymentBookings.length === 0) {
                return (
                  <div className="p-10 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <span className="font-bold text-sm text-slate-700 dark:text-slate-300 block">
                      Tidak Ada Antrean Verifikasi Pembayaran
                    </span>
                    <span className="text-xs text-slate-400 max-w-sm block mx-auto">
                      Semua transaksi tiket transfer manual telah terverifikasi atau tidak ada data yang cocok dengan filter aktif.
                    </span>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-slate-500 font-semibold">
                        <th className="py-3 px-3.5">Kode & Waktu</th>
                        <th className="py-3 px-3.5">Event</th>
                        <th className="py-3 px-3.5">Peserta & Kontak</th>
                        <th className="py-3 px-3.5">Total Tagihan</th>
                        <th className="py-3 px-3.5">Rekening Tujuan</th>
                        <th className="py-3 px-3.5">Bukti Transfer</th>
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3.5 text-right">Aksi Verifikasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {paymentBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="font-mono font-bold text-slate-900 dark:text-white block">
                              {b.ticketCode}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {new Date(b.createdAt).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 max-w-[200px]">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={b.eventTitle}>
                              {b.eventTitle}
                            </span>
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {b.guestName}
                            </span>
                            <span className="text-[10px] text-slate-400 block">{b.guestPhone}</span>
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="font-black text-[#3B7A57] dark:text-[#52B788] block text-sm">
                              {formatCurrencyIDR(b.totalPrice)}
                            </span>
                            <span className="text-[10px] text-slate-400 block">{b.ticketCount} Tiket</span>
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {b.destinationBankSnapshot ? (
                              <div>
                                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                  {b.destinationBankSnapshot.bankName}
                                </span>
                                <span className="font-mono text-[10px] text-slate-500 block">
                                  {b.destinationBankSnapshot.accountNumber}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Rekening Default Platform</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {b.paymentProofUrl ? (
                              <div className="flex items-center space-x-2">
                                <div
                                  onClick={() => setSelectedProofBooking(b)}
                                  className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                  title="Klik untuk melihat bukti transfer ukuran penuh"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={b.paymentProofUrl}
                                    alt="Bukti Transfer"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div>
                                  <button
                                    onClick={() => setSelectedProofBooking(b)}
                                    className="text-[10.5px] font-bold text-[#3B7A57] dark:text-[#52B788] hover:underline block cursor-pointer"
                                  >
                                    Periksa Bukti
                                  </button>
                                  <span className="text-[9.5px] text-slate-400 block">
                                    {b.paymentProofUploadedAt ? new Date(b.paymentProofUploadedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "Terkirim"}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Belum Diunggah</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {b.paymentStatus === "PAID" ? (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                                Lunas (PAID)
                              </Badge>
                            ) : b.paymentRejectionReason ? (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold">
                                Bukti Ditolak
                              </Badge>
                            ) : (
                              <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[10px] font-bold">
                                Menunggu Review
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            {b.paymentStatus === "PENDING" ? (
                              <div className="inline-flex items-center space-x-1.5">
                                <Button
                                  size="sm"
                                  disabled={isProcessingPaymentAction}
                                  onClick={() => handleApprovePayment(b)}
                                  className="h-7 px-2.5 bg-[#3B7A57] hover:bg-[#2E6044] text-white text-[10.5px] font-bold rounded-lg cursor-pointer"
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  <span>Setujui</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isProcessingPaymentAction}
                                  onClick={() => {
                                    setRejectPaymentTarget(b);
                                    setRejectPaymentReason("");
                                    setRejectPaymentCancelBooking(false);
                                  }}
                                  className="h-7 px-2 text-[10.5px] font-bold text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  <span>Tolak</span>
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                Selesai
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION C: PENGATURAN REKENING & BISNIS */}
      {/* ===================================================================== */}
      {adminSection === "SETTINGS" && (
        <div className="space-y-6">
          {/* Card 1: Pengaturan Kebijakan Bisnis Platform */}
          <Card className="p-6 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-[#3B7A57]" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Kebijakan Transaksi & Pembayaran Event
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Konfigurasi ini berlaku seketika untuk pemesanan tiket baru tanpa perlu deployment ulang kode.
                  </span>
                </div>
              </div>
            </div>

            {businessPolicy && (
              <form onSubmit={handleSaveBusinessSettings} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Metode Pembayaran Aktif
                    </label>
                    <select
                      value={businessPolicy.activePaymentMethod || "MANUAL_TRANSFER"}
                      onChange={(e) =>
                        setBusinessPolicy({ ...businessPolicy, activePaymentMethod: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    >
                      <option value="MANUAL_TRANSFER">Transfer Bank Manual (Aktif Resmi)</option>
                      <option value="DOKU_CHECKOUT">DOKU Checkout Gateway</option>
                    </select>
                    <span className="text-[10px] text-slate-400 block">
                      Transfer Bank Manual mengarahkan checkout ke rekening resmi dan menu verifikasi bukti transfer.
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Batas Maksimal Pembelian Tiket per Transaksi (Platform Default)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={businessPolicy.maxTicketsPerBooking || 5}
                      onChange={(e) =>
                        setBusinessPolicy({
                          ...businessPolicy,
                          maxTicketsPerBooking: parseInt(e.target.value, 10) || 5,
                        })
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                    <span className="text-[10px] text-slate-400 block">
                      Default platform adalah 5 tiket. Event tertentu dapat menentukan batas tersendiri jika diatur.
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Batas Waktu Pembayaran (Menit)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={1440}
                      value={businessPolicy.bookingPaymentExpiryMinutes || 60}
                      onChange={(e) =>
                        setBusinessPolicy({
                          ...businessPolicy,
                          bookingPaymentExpiryMinutes: parseInt(e.target.value, 10) || 60,
                        })
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                    <span className="text-[10px] text-slate-400 block">
                      Durasi penahanan kuota tiket sebelum booking PENDING kedaluwarsa otomatis (default: 60 menit).
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Komisi Platform Default (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={businessPolicy.defaultPlatformFeePercent ?? 20}
                      onChange={(e) =>
                        setBusinessPolicy({
                          ...businessPolicy,
                          defaultPlatformFeePercent: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                    <span className="text-[10px] text-slate-400 block">
                      Bagian platform (20%), bagian penyelenggara (80%).
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Instruksi Pembayaran Transfer Bank Resmi
                  </label>
                  <textarea
                    rows={2}
                    value={businessPolicy.paymentInstructions || ""}
                    onChange={(e) =>
                      setBusinessPolicy({ ...businessPolicy, paymentInstructions: e.target.value })
                    }
                    placeholder="Contoh: Silakan transfer tepat sesuai nominal yang tertera..."
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={isSavingSettings}
                    className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs cursor-pointer"
                  >
                    {isSavingSettings ? "Menyimpan..." : "Simpan Pengaturan Bisnis"}
                  </Button>
                </div>
              </form>
            )}
          </Card>

          {/* Card 2: Manajemen Rekening Bank Resmi */}
          <Card className="p-6 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-[#3B7A57]" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Rekening Bank Resmi Platform
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Daftar rekening tujuan pembayaran yang dapat dipilih atau digunakan untuk transaksi baru.
                  </span>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => setIsAddBankModalOpen(true)}
                className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Rekening</span>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-slate-500 font-semibold">
                    <th className="py-2.5 px-3">Label</th>
                    <th className="py-2.5 px-3">Bank & Nomor Rekening</th>
                    <th className="py-2.5 px-3">Atas Nama</th>
                    <th className="py-2.5 px-3">Cabang</th>
                    <th className="py-2.5 px-3">Default Platform</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {bankAccountsList.map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {acc.label}
                        </span>
                        {acc.badge && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[9px] font-bold border border-emerald-200 dark:border-emerald-800">
                            {acc.badge}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {acc.bankName}
                        </span>
                        <span className="font-mono text-slate-600 dark:text-slate-400 block text-[11px]">
                          {acc.accountNumber}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {acc.accountHolder}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {acc.branch || "-"}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {acc.isDefault ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 text-[10px] font-bold">
                            Default Platform
                          </Badge>
                        ) : (
                          <button
                            onClick={() => handleSetDefaultBank(acc.id)}
                            disabled={!acc.isActive}
                            className="text-[10px] font-bold text-[#3B7A57] dark:text-[#52B788] hover:underline cursor-pointer disabled:opacity-40"
                          >
                            Jadikan Default
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleBankActive(acc.id, acc.isActive)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                            acc.isActive
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {acc.isActive ? "Aktif" : "Nonaktif"}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={acc.isDefault}
                          onClick={() => handleDeleteBank(acc.id)}
                          className="h-7 px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer disabled:opacity-30"
                          title={acc.isDefault ? "Rekening default tidak dapat dihapus" : "Hapus rekening"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Card 3: Riwayat Perubahan Rekening Bank (Audit Log) */}
          <Card className="p-6 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Clock className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Riwayat Perubahan Rekening (Audit Trail)
              </h3>
            </div>

            {bankChangeHistory.length === 0 ? (
              <span className="text-xs text-slate-400 italic block py-2">
                Belum ada riwayat modifikasi rekening yang tercatat.
              </span>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[11px]">
                      <th className="py-2 px-3">Waktu</th>
                      <th className="py-2 px-3">Aktor</th>
                      <th className="py-2 px-3">Tindakan</th>
                      <th className="py-2 px-3">Rincian Perubahan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-[11px]">
                    {bankChangeHistory.slice(0, 10).map((h) => (
                      <tr key={h.id}>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-400">
                          {new Date(h.changedAt).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">
                          {h.changedBy}
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-[9px] font-bold">
                            {h.action}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400 max-w-md truncate">
                          {h.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

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

            {/* Kebutuhan Kolaborasi Venue & Promosi */}
            {(selectedEvent.collaborationFacilities || selectedEvent.collaborationPromotion || selectedEvent.collaborationNotes) && (
              <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs space-y-2">
                <span className="font-bold text-amber-900 dark:text-amber-200 block">
                  Kebutuhan Kolaborasi & Dukungan Venue:
                </span>
                {selectedEvent.collaborationFacilities && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">Fasilitas Venue Diminta:</span>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(selectedEvent.collaborationFacilities)
                        ? selectedEvent.collaborationFacilities
                        : [selectedEvent.collaborationFacilities]
                      ).map((f: any, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedEvent.collaborationPromotion && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">Dukungan Promosi Diminta:</span>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(selectedEvent.collaborationPromotion)
                        ? selectedEvent.collaborationPromotion
                        : [selectedEvent.collaborationPromotion]
                      ).map((p: any, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedEvent.collaborationNotes && (
                  <div className="pt-1 text-[11px] text-amber-900 dark:text-amber-100">
                    <span className="font-semibold">Catatan Kolaborasi: </span>
                    <span>{selectedEvent.collaborationNotes}</span>
                  </div>
                )}
              </div>
            )}

            {/* Bagian Pengelolaan & Negosiasi Bagi Hasil */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900 dark:text-white block">
                    Skema Bagi Hasil (Revenue Split)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Kesepakatan Aktif: <strong className="text-[#3B7A57] dark:text-[#52B788]">{selectedEvent.organizerFeePercent ?? 80}% Komunitas</strong> : <strong className="text-slate-700 dark:text-slate-300">{selectedEvent.customPlatformFeePercent ?? 20}% Dago</strong>
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsProposingSplit(!isProposingSplit)}
                  className="text-[11px] h-7 px-2.5 rounded-lg border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  {isProposingSplit ? "Tutup Form" : "Ajukan / Tawar"}
                </Button>
              </div>

              {/* Usulan Bagi Hasil Pending jika ada */}
              {selectedEvent.proposedRevenueSplit && selectedEvent.proposedRevenueSplit.status === "PENDING" && (
                <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-900 dark:text-sky-200">
                      Usulan dari {selectedEvent.proposedRevenueSplit.proposedBy === "ORGANIZER" ? "Penyelenggara Komunitas" : "Admin Dago"}
                    </span>
                    <Badge className="bg-sky-600 text-white text-[10px]">
                      {selectedEvent.proposedRevenueSplit.organizerPercent}% Komunitas : {selectedEvent.proposedRevenueSplit.platformPercent}% Dago
                    </Badge>
                  </div>
                  {selectedEvent.proposedRevenueSplit.reason && (
                    <p className="text-[11px] text-sky-800 dark:text-sky-300 italic">
                      &quot;{selectedEvent.proposedRevenueSplit.reason}&quot;
                    </p>
                  )}
                  {selectedEvent.proposedRevenueSplit.proposedBy === "ORGANIZER" && (
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        disabled={isSubmittingSplit}
                        onClick={() => handleRespondSplit("ACCEPT")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-7 px-2.5 rounded-lg font-bold"
                      >
                        Setujui Kesepakatan
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSubmittingSplit}
                        onClick={() => handleRespondSplit("REJECT")}
                        className="text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] h-7 px-2.5 rounded-lg font-semibold"
                      >
                        Tolak Usulan
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSplitOrgPercent(selectedEvent.proposedRevenueSplit?.organizerPercent ?? 80);
                          setSplitPlatPercent(selectedEvent.proposedRevenueSplit?.platformPercent ?? 20);
                          setIsProposingSplit(true);
                        }}
                        className="text-sky-600 border-sky-300 hover:bg-sky-50 text-[11px] h-7 px-2.5 rounded-lg font-semibold"
                      >
                        Tawar Tandingan
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Form Input Usulan Bagi Hasil */}
              {isProposingSplit && (
                <form onSubmit={handleProposeSplit} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Bagian Penyelenggara (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={splitOrgPercent}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          setSplitOrgPercent(val);
                          setSplitPlatPercent(100 - val);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border font-bold text-[#3B7A57]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Bagian Dago Hub (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={splitPlatPercent}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          setSplitPlatPercent(val);
                          setSplitOrgPercent(100 - val);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border font-bold text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Alasan / Keterangan Penawaran
                    </label>
                    <input
                      type="text"
                      value={splitReason}
                      onChange={(e) => setSplitReason(e.target.value)}
                      placeholder="Contoh: Kesepakatan kolaborasi workshop perdana"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setIsProposingSplit(false)}
                      className="text-[11px] h-7"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSubmittingSplit}
                      className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-[11px] h-7 font-bold"
                    >
                      Kirim Penawaran
                    </Button>
                  </div>
                </form>
              )}

              {/* Riwayat Kesepakatan Bagi Hasil */}
              {selectedEvent.revenueSplitHistory && selectedEvent.revenueSplitHistory.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Riwayat Kesepakatan
                  </span>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {selectedEvent.revenueSplitHistory.map((h, i) => (
                      <div key={h.id || i} className="text-[10px] flex items-center justify-between text-slate-500 py-0.5">
                        <span>{new Date(h.effectiveDate || h.agreedAt || "").toLocaleDateString("id-ID")}: {h.agreedOrganizerPercent ?? h.newOrganizerPercent}% Komunitas : {h.agreedPlatformPercent ?? h.newPlatformPercent}% Dago</span>
                        <span className="text-slate-400">({h.agreedBy || h.approvedBy || "Admin"})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bagian Payout / Pencairan Saldo Penyelenggara */}
            {selectedEvent.payoutHistory && selectedEvent.payoutHistory.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-white block">
                    Pengajuan Pencairan Saldo (Payout)
                  </span>
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {selectedEvent.payoutHistory.length} Pengajuan
                  </Badge>
                </div>

                <div className="space-y-2">
                  {selectedEvent.payoutHistory.map((p) => (
                    <div key={p.id} className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <strong className="text-slate-900 dark:text-white font-bold">{formatCurrencyIDR(p.amount)}</strong>
                          <Badge
                            className={`text-[9px] font-bold ${
                              p.status === "PAID"
                                ? "bg-emerald-600 text-white"
                                : p.status === "PROCESSING"
                                ? "bg-sky-600 text-white"
                                : p.status === "REQUESTED"
                                ? "bg-amber-600 text-white"
                                : "bg-rose-600 text-white"
                            }`}
                          >
                            {p.status}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {p.bankName} • {p.accountNumber} a/n {p.accountHolder}
                        </div>
                        {p.referenceNo && (
                          <div className="text-[10px] text-emerald-600 font-mono">
                            Ref: {p.referenceNo}
                          </div>
                        )}
                      </div>

                      {/* Admin Payout Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.status === "REQUESTED" && (
                          <Button
                            size="sm"
                            disabled={isProcessingPayout}
                            onClick={() => handleUpdatePayoutStatus(p.id, "PROCESSING")}
                            className="bg-sky-600 hover:bg-sky-700 text-white text-[10px] h-6 px-2 rounded-lg font-bold"
                          >
                            Tandai Diproses
                          </Button>
                        )}
                        {(p.status === "REQUESTED" || p.status === "PROCESSING") && (
                          <>
                            <Button
                              size="sm"
                              disabled={isProcessingPayout}
                              onClick={() => {
                                setActivePayoutTarget({ id: p.id, status: "PAID" });
                                setPayoutInputText("");
                                setPayoutPromptModalOpen(true);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] h-6 px-2 rounded-lg font-bold"
                            >
                              Konfirmasi Transfer
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isProcessingPayout}
                              onClick={() => {
                                setActivePayoutTarget({ id: p.id, status: "REJECTED" });
                                setPayoutInputText("");
                                setPayoutPromptModalOpen(true);
                              }}
                              className="text-rose-600 border-rose-300 text-[10px] h-6 px-2 rounded-lg font-bold"
                            >
                              Tolak
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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

      {/* Modal Prompt Status Payout (PAID atau REJECTED) */}
      {payoutPromptModalOpen && activePayoutTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-w-md w-full space-y-4">
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              {activePayoutTarget.status === "PAID"
                ? "Konfirmasi Pencairan Selesai Ditransfer"
                : "Tolak Pengajuan Pencairan Saldo"}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activePayoutTarget.status === "PAID"
                ? "Masukkan nomor referensi transfer bank manual (dari mutasi/resi m-Banking DAGO Finance) sebagai bukti payout kepada penyelenggara."
                : "Tuliskan alasan penolakan pencairan saldo untuk catatan penyelenggara."}
            </p>

            <input
              type="text"
              value={payoutInputText}
              onChange={(e) => setPayoutInputText(e.target.value)}
              placeholder={
                activePayoutTarget.status === "PAID"
                  ? "Contoh: BCA-TRF-20261028-98412"
                  : "Contoh: Nomor rekening bank tidak sesuai dengan nama penyelenggara"
              }
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPayoutPromptModalOpen(false);
                  setActivePayoutTarget(null);
                }}
                className="text-xs cursor-pointer"
              >
                Batal
              </Button>
              <Button
                size="sm"
                disabled={isProcessingPayout || !payoutInputText.trim()}
                onClick={() =>
                  handleUpdatePayoutStatus(
                    activePayoutTarget.id,
                    activePayoutTarget.status,
                    activePayoutTarget.status === "PAID" ? payoutInputText : undefined,
                    activePayoutTarget.status === "REJECTED" ? payoutInputText : undefined
                  )
                }
                className={`text-xs font-bold text-white cursor-pointer ${
                  activePayoutTarget.status === "PAID"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {activePayoutTarget.status === "PAID" ? "Simpan & Tandai Lunas" : "Tolak Pengajuan"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TOLAK BUKTI PEMBAYARAN */}
      {rejectPaymentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Tolak Bukti Pembayaran
                </h4>
                <span className="text-xs text-slate-400">
                  Kode: {rejectPaymentTarget.ticketCode} • {rejectPaymentTarget.guestName}
                </span>
              </div>
              <button
                onClick={() => setRejectPaymentTarget(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                Alasan Penolakan <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={rejectPaymentReason}
                onChange={(e) => setRejectPaymentReason(e.target.value)}
                placeholder="Contoh: Foto bukti transfer blur / nominal tidak sesuai / nomor rekening tujuan salah..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-rose-500"
              />
              <span className="text-[10.5px] text-slate-400 block">
                Alasan ini akan ditampilkan langsung kepada peserta pada halaman e-tiket mereka.
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rejectPaymentCancelBooking}
                  onChange={(e) => setRejectPaymentCancelBooking(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Batalkan pemesanan sekaligus (Lepaskan kuota tiket)
                </span>
              </label>
              <p className="text-[10px] text-slate-400 pl-5">
                Jika tidak dicentang, tiket tetap berstatus PENDING sehingga peserta masih dapat mengunggah bukti perbaikan sebelum batas waktu habis.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectPaymentTarget(null)}
                className="text-xs cursor-pointer"
              >
                Batal
              </Button>
              <Button
                size="sm"
                disabled={isProcessingPaymentAction || !rejectPaymentReason.trim()}
                onClick={handleConfirmRejectPayment}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                {isProcessingPaymentAction ? "Memproses..." : "Konfirmasi Penolakan"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH REKENING BANK */}
      {isAddBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Tambah Rekening Bank Resmi
                </h4>
                <span className="text-xs text-slate-400">
                  Rekening baru dapat segera digunakan untuk transaksi tiket event tanpa deployment ulang.
                </span>
              </div>
              <button
                onClick={() => setIsAddBankModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBank} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Label Rekening <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newBankForm.label}
                  onChange={(e) => setNewBankForm({ ...newBankForm, label: e.target.value })}
                  placeholder="Contoh: Rekening Operasional / Utama Platform"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Nama Bank <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newBankForm.bankName}
                    onChange={(e) => setNewBankForm({ ...newBankForm, bankName: e.target.value })}
                    placeholder="Contoh: BCA / Mandiri / BRI"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Nomor Rekening <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newBankForm.accountNumber}
                    onChange={(e) => setNewBankForm({ ...newBankForm, accountNumber: e.target.value })}
                    placeholder="Contoh: 1420993821"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Nama Pemilik Rekening (a.n.) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newBankForm.accountHolder}
                  onChange={(e) => setNewBankForm({ ...newBankForm, accountHolder: e.target.value })}
                  placeholder="Contoh: PT DAGO CREATIVE HUB"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Cabang (Opsional)
                  </label>
                  <input
                    type="text"
                    value={newBankForm.branch}
                    onChange={(e) => setNewBankForm({ ...newBankForm, branch: e.target.value })}
                    placeholder="Contoh: KCU Dago Bandung"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Badge / Tag (Opsional)
                  </label>
                  <input
                    type="text"
                    value={newBankForm.badge}
                    onChange={(e) => setNewBankForm({ ...newBankForm, badge: e.target.value })}
                    placeholder="Contoh: Utama / Bebas Biaya"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newBankForm.isDefault}
                    onChange={(e) => setNewBankForm({ ...newBankForm, isDefault: e.target.checked })}
                    className="rounded text-[#3B7A57] focus:ring-[#3B7A57]"
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Jadikan rekening default utama platform
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddBankModalOpen(false)}
                  className="text-xs cursor-pointer"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingSettings}
                  className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold cursor-pointer"
                >
                  {isSavingSettings ? "Menyimpan..." : "Simpan Rekening"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
