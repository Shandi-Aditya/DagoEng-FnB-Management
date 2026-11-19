"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import { AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type {
  CommunityEvent,
  EventOperationalStats,
  EventTicketOrder,
  PayoutRecord,
} from "@/types/event";
import {
  isEventInWitaPeriod,
  isTimestampInWitaPeriod,
  type DateRange,
} from "@/components/events/EventDateRangeFilter";
import { downloadCSV } from "@/lib/export-utils";

// Sub-komponen modular yang sudah diredesign
import {
  calculateEventsKPI,
  filterBookings,
  filterEvents,
  getEffectiveStatus,
} from "@/features/events-admin/events-admin-domain";
import { EventsAdminHeader } from "@/features/events-admin/EventsAdminHeader";
import {
  AdminSectionType,
  EventsAdminTabs,
} from "@/features/events-admin/EventsAdminTabs";
import { EventsModerationKPI } from "@/features/events-admin/EventsModerationKPI";
import { EventsModerationToolbar } from "@/features/events-admin/EventsModerationToolbar";
import { EventsModerationTable } from "@/features/events-admin/EventsModerationTable";
import { EventsPaymentsTable } from "@/features/events-admin/EventsPaymentsTable";
import { EventsPayoutsTable } from "@/features/events-admin/EventsPayoutsTable";
import { EventsRefundsTable } from "@/features/events-admin/EventsRefundsTable";
import { EventsSettingsView } from "@/features/events-admin/EventsSettingsView";
import { EventDetailSheet } from "@/features/events-admin/EventDetailSheet";
import { EventAttendeesModal } from "@/features/events-admin/EventAttendeesModal";
import { PaymentProofDialog } from "@/features/events-admin/PaymentProofDialog";
import { RejectPaymentDialog } from "@/features/events-admin/RejectPaymentDialog";
import {
  ModerationActionDialog,
  ModerationActionType,
} from "@/features/events-admin/ModerationActionDialog";
import {
  PayoutActionDialog,
  PayoutTarget,
} from "@/features/events-admin/PayoutActionDialog";
import { BankFormData, BankModal } from "@/features/events-admin/BankModal";
import { EventEditModal } from "@/features/events-admin/EventEditModal";
import { EventPromosDialog } from "@/components/events/EventPromosDialog";

export default function AdminEventsPage() {
  const { user } = useAuth();
  const { logActivity } = useActivityLog();

  const isAuthorized =
    (user?.role?.slug === "SUPER_ADMIN" ||
      user?.role?.slug === "OWNER" ||
      user?.role?.slug === "MANAGER") &&
    (user?.scopeLevel === "PLATFORM" || user?.scopeLevel === "ORGANIZATION");

  // Core Data
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [allBookings, setAllBookings] = useState<EventTicketOrder[]>([]);
  const [allRefunds, setAllRefunds] = useState<EventTicketOrder[]>([]);
  const [operationalStats, setOperationalStats] = useState<EventOperationalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Notifications
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  // Section & Tab State
  const [adminSection, setAdminSection] = useState<AdminSectionType>("MODERATION");
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [moderationPage, setModerationPage] = useState(1);
  const [moderationPageSize, setModerationPageSize] = useState(10);

  const [paymentFilterStatus, setPaymentFilterStatus] = useState<string>("PENDING_PROOF");
  const [paymentSearchQuery, setPaymentSearchQuery] = useState("");
  const [paymentDateRange, setPaymentDateRange] = useState<DateRange | null>(null);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsPageSize, setPaymentsPageSize] = useState(10);
  const [selectedProofBooking, setSelectedProofBooking] = useState<EventTicketOrder | null>(null);
  const [rejectPaymentTarget, setRejectPaymentTarget] = useState<EventTicketOrder | null>(null);
  const [rejectPaymentReason, setRejectPaymentReason] = useState("");
  const [rejectPaymentCancelBooking, setRejectPaymentCancelBooking] = useState(false);
  const [isProcessingPaymentAction, setIsProcessingPaymentAction] = useState(false);

  const [payoutFilterStatus, setPayoutFilterStatus] = useState<string>("ALL");
  const [payoutSearchQuery, setPayoutSearchQuery] = useState("");
  const [payoutDateRange, setPayoutDateRange] = useState<DateRange | null>(null);
  const [payoutsPage, setPayoutsPage] = useState(1);
  const [payoutsPageSize, setPayoutsPageSize] = useState(10);
  const [payoutTarget, setPayoutTarget] = useState<PayoutTarget | null>(null);
  const [payoutInputText, setPayoutInputText] = useState("");
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);

  // Detail Sheet & Moderation Dialog
  const [selectedEvent, setSelectedEvent] = useState<CommunityEvent | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [moderationTarget, setModerationTarget] = useState<{
    event: CommunityEvent;
    action: ModerationActionType;
  } | null>(null);
  const [moderationNotes, setModerationNotes] = useState("");
  const [isProcessingModeration, setIsProcessingModeration] = useState(false);

  // Attendees Modal
  const [selectedEventForAttendees, setSelectedEventForAttendees] = useState<CommunityEvent | null>(null);
  const [isAttendeesModalOpen, setIsAttendeesModalOpen] = useState(false);
  const [isUpdatingCheckInId, setIsUpdatingCheckInId] = useState<string | null>(null);

  // Edit Event Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<CommunityEvent>>({});
  const [editGuidelinesText, setEditGuidelinesText] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [promoEvent, setPromoEvent] = useState<CommunityEvent | null>(null);

  // Settings State
  const [businessPolicy, setBusinessPolicy] = useState<any>(null);
  const [bankAccountsList, setBankAccountsList] = useState<any[]>([]);
  const [bankChangeHistory, setBankChangeHistory] = useState<any[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isAddBankModalOpen, setIsAddBankModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<any | null>(null);
  const [bankForm, setBankForm] = useState<BankFormData>({
    label: "",
    bankName: "BCA",
    accountNumber: "",
    accountHolder: "",
    branch: "",
    badge: "Utama",
    isDefault: false,
  });

  // URL Sync
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sec = params.get("section");
      const tab = params.get("tab");
      if (sec === "MODERATION" || sec === "PAYMENTS" || sec === "PAYOUTS" || sec === "REFUNDS" || sec === "SETTINGS") {
        setAdminSection(sec);
      }
      if (tab) {
        setSelectedStatusTab(tab);
      }
    }
  }, []);

  // Initial Load
  useEffect(() => {
    if (isAuthorized) {
      loadAdminEvents();
      loadBusinessSettings();
    }
  }, [isAuthorized]);

  // Auto-dismiss success message
  useEffect(() => {
    if (actionSuccessMessage) {
      const timer = setTimeout(() => setActionSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccessMessage]);

  const loadAdminRefunds = async () => {
    try {
      const res = await fetch("/api/events/admin/refunds");
      const json = await res.json();
      if (res.ok && json.success) {
        setAllRefunds(json.refunds || []);
      }
    } catch (e) {
      console.error("Error loading event refunds:", e);
    }
  };

  const loadAdminEvents = async () => {
    try {
      setIsLoading(true);
      setActionErrorMessage(null);

      const [eventsRes, bookingsRes, refundsRes] = await Promise.all([
        fetch("/api/events/admin"),
        fetch("/api/events/bookings?includeStats=true&unmasked=true"),
        fetch("/api/events/admin/refunds"),
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

      const refundsJson = await refundsRes.json();
      if (refundsRes.ok && refundsJson.success) {
        setAllRefunds(refundsJson.refunds || []);
      }
    } catch (err: any) {
      setActionErrorMessage(err.message || "Kesalahan jaringan.");
    } finally {
      setIsLoading(false);
    }
  };

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
        const rawAccounts = banksData.data.bankAccounts || [];
        setBankAccountsList(rawAccounts.filter((b: any) => b.accountType !== "ORGANIZER"));
        setBankChangeHistory(banksData.data.bankHistory || []);
      }
    } catch (e) {
      console.error("Error loading event settings:", e);
    }
  };

  const eventsWithBookedCount = useMemo(() => {
    const bookedByEvent = new Map<string, number>();
    for (const b of allBookings) {
      if (b.paymentStatus === "PAID") {
        bookedByEvent.set(b.eventId, (bookedByEvent.get(b.eventId) ?? 0) + (b.ticketCount || 1));
      }
    }
    return events.map((e) => ({
      ...e,
      bookedCount: bookedByEvent.get(e.id) ?? (e as CommunityEvent & { bookedCount?: number }).bookedCount ?? 0,
    }));
  }, [events, allBookings]);

  const kpi = useMemo(
    () => calculateEventsKPI(eventsWithBookedCount, allBookings),
    [eventsWithBookedCount, allBookings]
  );

  const moderationKpi = useMemo(() => {
    if (!dateRange) return kpi;
    const periodEvents = eventsWithBookedCount.filter((e) => isEventInWitaPeriod(e, dateRange));
    return calculateEventsKPI(periodEvents, allBookings);
  }, [eventsWithBookedCount, allBookings, dateRange, kpi]);

  const filteredEvents = useMemo(
    () => filterEvents(eventsWithBookedCount, selectedStatusTab, searchQuery, dateRange),
    [eventsWithBookedCount, selectedStatusTab, searchQuery, dateRange]
  );

  const filteredBookings = useMemo(
    () => filterBookings(allBookings, paymentFilterStatus, paymentSearchQuery, paymentDateRange),
    [allBookings, paymentFilterStatus, paymentSearchQuery, paymentDateRange]
  );

  const allPayouts = useMemo(() => {
    const list: any[] = [];
    eventsWithBookedCount.forEach((e) => {
      if (e.payoutHistory && Array.isArray(e.payoutHistory)) {
        e.payoutHistory.forEach((pr: PayoutRecord) => {
          list.push({
            ...pr,
            eventId: pr.eventId || e.id,
            eventTitle: e.title,
            organizerName: e.organizerName,
            bankName: pr.bankName || "BCA",
            accountNumber: pr.accountNumber || "—",
            accountHolder: pr.accountHolder || e.organizerName,
          });
        });
      }
    });
    return list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }, [eventsWithBookedCount]);

  const pendingPayoutsCount = useMemo(
    () => allPayouts.filter((p) => p.status === "REQUESTED" || p.status === "PROCESSING").length,
    [allPayouts]
  );

  const pendingRefundsCount = useMemo(
    () => allRefunds.filter((r) => r.refundStatus === "REQUESTED").length,
    [allRefunds]
  );

  const filteredPayoutsForExport = useMemo(() => {
    const needle = payoutSearchQuery.trim().toLowerCase();
    return allPayouts.filter((p) => {
      if (payoutFilterStatus !== "ALL" && p.status !== payoutFilterStatus) return false;
      if (payoutDateRange && !isTimestampInWitaPeriod(p.requestedAt, payoutDateRange)) return false;
      if (needle) {
        const matchTitle = p.eventTitle?.toLowerCase().includes(needle);
        const matchOrg = p.organizerName?.toLowerCase().includes(needle);
        const matchBank = p.bankName?.toLowerCase().includes(needle);
        const matchAcc = p.accountNumber?.toLowerCase().includes(needle);
        const matchHolder = p.accountHolder?.toLowerCase().includes(needle);
        const matchRef = p.referenceNo?.toLowerCase().includes(needle);
        if (!matchTitle && !matchOrg && !matchBank && !matchAcc && !matchHolder && !matchRef) {
          return false;
        }
      }
      return true;
    });
  }, [allPayouts, payoutFilterStatus, payoutDateRange, payoutSearchQuery]);

  // Moderation Action Handlers
  const openModerationDialog = (event: CommunityEvent, action: ModerationActionType) => {
    setModerationTarget({ event, action });
    setModerationNotes("");
  };

  const handleConfirmModeration = async () => {
    if (!moderationTarget) return;
    const { event, action } = moderationTarget;

    try {
      setIsProcessingModeration(true);
      let payloadAction = "APPROVE";
      if (action === "REVISION") payloadAction = "REQUEST_REVISION";
      else if (action === "REJECT") payloadAction = "REJECT";
      else if (action === "ARCHIVE") payloadAction = "ARCHIVE";

      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: payloadAction,
          reason: moderationNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memproses moderasi event.");
      }

      setActionSuccessMessage(
        action === "APPROVE"
          ? `Event "${event.title}" berhasil disetujui!`
          : action === "REVISION"
          ? `Permintaan revisi dikirim ke penyelenggara.`
          : action === "REJECT"
          ? `Pengajuan event ditolak.`
          : `Event berhasil diarsipkan.`
      );

      setModerationTarget(null);
      await loadAdminEvents();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal memproses tindakan.");
    } finally {
      setIsProcessingModeration(false);
    }
  };

  // Payment Verification Handlers
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
      setActionSuccessMessage(`Pembayaran tiket ${booking.ticketCode} (${booking.guestName}) berhasil disetujui.`);
      await loadAdminEvents();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal menyetujui pembayaran.");
    } finally {
      setIsProcessingPaymentAction(false);
    }
  };

  const handleDeleteEvent = async (event: CommunityEvent) => {
    if (!window.confirm(`Hapus permanen event "${event.title}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      setIsProcessingModeration(true);
      const res = await fetch(`/api/events/${event.id}`, {
        method: "DELETE",
        headers: {
          "If-Match": event.updatedAt || "",
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menghapus event.");
      }
      setActionSuccessMessage(`Event "${event.title}" berhasil dihapus permanen.`);
      await loadAdminEvents();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal menghapus event.");
    } finally {
      setIsProcessingModeration(false);
    }
  };

  const handleDeleteBooking = async (booking: EventTicketOrder) => {
    if (!window.confirm(`Hapus permanen pesanan tiket ${booking.ticketCode} (${booking.guestName})? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      setIsProcessingPaymentAction(true);
      const res = await fetch(`/api/events/bookings/${booking.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menghapus pesanan tiket.");
      }
      setActionSuccessMessage(`Pesanan tiket "${booking.ticketCode}" berhasil dihapus permanen.`);
      await loadAdminEvents();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal menghapus pesanan tiket.");
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
      setActionSuccessMessage(`Bukti pembayaran tiket ${rejectPaymentTarget.ticketCode} berhasil ditolak.`);
      setRejectPaymentTarget(null);
      setRejectPaymentReason("");
      setRejectPaymentCancelBooking(false);
      await loadAdminEvents();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal menolak pembayaran.");
    } finally {
      setIsProcessingPaymentAction(false);
    }
  };

  const handleConfirmPayoutAction = async () => {
    if (!payoutTarget) return;
    const resolvedEventId =
      payoutTarget.eventId ||
      events.find((e) => e.payoutHistory?.some((pr) => pr.id === payoutTarget.id))?.id;
    if (!resolvedEventId) {
      setActionErrorMessage("ID event untuk permohonan pencairan ini tidak ditemukan.");
      return;
    }
    try {
      setIsProcessingPayout(true);
      const res = await fetch(`/api/events/${encodeURIComponent(resolvedEventId)}/payout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutId: payoutTarget.id,
          newStatus: payoutTarget.status,
          rejectionReason: payoutTarget.status === "REJECTED" ? payoutInputText.trim() : undefined,
          referenceNo: payoutTarget.status === "PAID" ? payoutInputText.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memperbarui status pencairan saldo.");
      }
      setActionSuccessMessage(
        payoutTarget.status === "PAID"
          ? "Pencairan saldo berhasil dikonfirmasi selesai ditransfer!"
          : "Permohonan pencairan saldo berhasil ditolak."
      );
      setPayoutTarget(null);
      setPayoutInputText("");
      await loadAdminEvents();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal memproses payout.");
    } finally {
      setIsProcessingPayout(false);
    }
  };

  // Check-In Toggle
  const handleCheckInToggle = async (booking: EventTicketOrder) => {
    if (booking.paymentStatus === "CANCELLED") return;
    if (booking.paymentStatus === "PENDING" && booking.checkInStatus !== "CHECKED_IN") {
      setActionErrorMessage(
        `Tiket ${booking.ticketCode} (${booking.guestName}) belum diverifikasi lunas. Silakan verifikasi pembayaran terlebih dahulu.`
      );
      return;
    }
    try {
      setIsUpdatingCheckInId(booking.id);
      const nextStatus = booking.checkInStatus === "CHECKED_IN" ? "REGISTERED" : "CHECKED_IN";

      const res = await fetch(`/api/events/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
        description: `Check-in ${booking.guestName} (${booking.ticketCode}): ${nextStatus}`,
        status: "SUCCESS",
      });
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal memperbarui check-in.");
    } finally {
      setIsUpdatingCheckInId(null);
    }
  };

  // Edit Event Handlers
  const handleOpenEdit = (event: CommunityEvent) => {
    setSelectedEvent(event);
    setEditFormData({
      title: event.title,
      category: event.category,
      location: event.location,
      startDate: event.startDate,
      endDate: event.endDate,
      description: event.description,
      price: event.price,
      maxCapacity: event.maxCapacity,
    });
    setEditGuidelinesText((event.guidelines || []).join("\n"));
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedEvent) return;
    try {
      setIsSavingEdit(true);
      const guidelines = editGuidelinesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch(`/api/events/${selectedEvent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editFormData,
          guidelines,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan perubahan event.");
      }

      setActionSuccessMessage(`Perubahan untuk "${editFormData.title || selectedEvent.title}" berhasil disimpan!`);
      setIsEditModalOpen(false);
      await loadAdminEvents();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal menyimpan perubahan event.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Bank & Policy Handlers
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessPolicy) return;

    const fee = Number(businessPolicy.defaultPlatformFeePercent);
    if (
      businessPolicy.defaultPlatformFeePercent === "" ||
      !Number.isSafeInteger(fee) ||
      fee < 0 ||
      fee > 50
    ) {
      setActionErrorMessage("Komisi platform harus berupa bilangan bulat antara 0% hingga 50%.");
      return;
    }

    try {
      setIsSavingSettings(true);
      const res = await fetch("/api/events/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...businessPolicy,
          defaultPlatformFeePercent: fee,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan kebijakan.");
      }
      setActionSuccessMessage("Kebijakan bisnis event berhasil diperbarui!");
      await loadBusinessSettings();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal menyimpan kebijakan.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleOpenAddBank = () => {
    setEditingBank(null);
    setBankForm({
      label: "",
      bankName: "BCA",
      customBankName: "",
      accountNumber: "",
      accountHolder: "",
      branch: "",
      badge: "Utama",
      isDefault: false,
    });
    setIsAddBankModalOpen(true);
  };

  const handleOpenEditBank = (acc: any) => {
    setEditingBank(acc);
    const knownBanks = ["BCA", "Mandiri", "BNI", "BRI", "BSI", "CIMB", "Permata"];
    const isKnown = knownBanks.includes(acc.bankName);
    setBankForm({
      label: acc.label || "",
      bankName: isKnown ? acc.bankName : "Other",
      customBankName: isKnown ? "" : acc.bankName,
      accountNumber: acc.accountNumber || "",
      accountHolder: acc.accountHolder || "",
      branch: acc.branch || "",
      badge: acc.badge || "",
      isDefault: !!acc.isDefault,
    });
    setIsAddBankModalOpen(true);
  };

  const handleSubmitBankForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingSettings(true);
      const isEdit = Boolean(editingBank);
      const url = "/api/events/admin/settings/banks";
      const method = isEdit ? "PATCH" : "POST";
      const effectiveBankName =
        bankForm.bankName === "Other" && bankForm.customBankName?.trim()
          ? bankForm.customBankName.trim()
          : bankForm.bankName;
      const normalizedBankForm: any = {
        ...bankForm,
        bankName: effectiveBankName,
      };
      delete normalizedBankForm.customBankName;
      const body = isEdit ? { id: editingBank.id, ...normalizedBankForm } : normalizedBankForm;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan rekening bank.");
      }

      setActionSuccessMessage(`Rekening ${effectiveBankName} berhasil ${isEdit ? "diperbarui" : "ditambahkan"}!`);
      setIsAddBankModalOpen(false);
      setEditingBank(null);
      await loadBusinessSettings();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal menyimpan rekening.");
    } finally {
      setIsSavingSettings(false);
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
      setActionSuccessMessage("Rekening utama platform berhasil diperbarui!");
      await loadBusinessSettings();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal menetapkan rekening utama.");
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

  const handleExportData = () => {
    const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(
      new Date()
    );
    if (adminSection === "PAYMENTS") {
      const headers = [
        "Kode Tiket",
        "Event",
        "Nama Peserta",
        "Email",
        "Telepon",
        "Jumlah Tiket",
        "Total Bayar",
        "Status Pembayaran",
        "Waktu Pesan",
      ];
      const rows = filteredBookings.map((b) => [
        b.ticketCode,
        b.eventTitle || "—",
        b.guestName,
        b.guestEmail,
        b.guestPhone || "—",
        b.ticketCount || 1,
        b.totalPrice,
        b.paymentStatus === "PENDING" && b.paymentRejectionReason ? "REJECTED" : b.paymentStatus,
        b.createdAt,
      ]);
      downloadCSV(`Events_Payments_${todayIso}.csv`, headers, rows);
      return;
    }

    if (adminSection === "PAYOUTS") {
      const headers = [
        "ID Pencairan",
        "Event",
        "Penyelenggara",
        "Bank",
        "No Rekening",
        "Atas Nama",
        "Nominal",
        "Status",
        "No Referensi",
        "Waktu Pengajuan",
      ];
      const rows = filteredPayoutsForExport.map((p) => [
        p.id,
        p.eventTitle || "—",
        p.organizerName || "—",
        p.bankName || "—",
        p.accountNumber || "—",
        p.accountHolder || "—",
        p.amount,
        p.status,
        p.referenceNo || "—",
        p.requestedAt,
      ]);
      downloadCSV(`Events_Payouts_${todayIso}.csv`, headers, rows);
      return;
    }

    if (adminSection === "REFUNDS") {
      const headers = [
        "Kode Tiket",
        "Event",
        "Nama Peserta",
        "Email",
        "Status Refund",
        "Total Harga",
        "Biaya Potongan",
        "Nominal Refund",
        "Bank",
        "No Rekening",
        "Atas Nama",
        "Alasan",
        "Waktu Pengajuan",
      ];
      const rows = allRefunds.map((r) => [
        r.ticketCode,
        r.eventTitle || "—",
        r.guestName,
        r.guestEmail,
        r.refundStatus || "—",
        r.totalPrice,
        r.refundRequest?.feeDeducted || 0,
        r.refundRequest?.refundAmount || 0,
        r.refundRequest?.bankName || "—",
        r.refundRequest?.accountNumber || "—",
        r.refundRequest?.accountHolder || "—",
        r.refundRequest?.reason || "—",
        r.refundRequest?.requestedAt || r.createdAt,
      ]);
      downloadCSV(`Events_Refunds_${todayIso}.csv`, headers, rows);
      return;
    }

    const headers = [
      "ID",
      "Judul",
      "Kategori",
      "Status",
      "Penyelenggara",
      "Email",
      "Telepon",
      "Lokasi",
      "Harga",
      "Kuota",
      "Terjual",
      "Waktu Mulai",
      "Dibuat Pada",
    ];
    const rows = filteredEvents.map((e) => [
      e.id,
      e.title,
      e.category,
      getEffectiveStatus(e),
      e.organizerName,
      e.organizerEmail || "—",
      e.organizerPhone || "—",
      e.location,
      e.price,
      e.maxCapacity || 0,
      (e as any).bookedCount || 0,
      e.startDate,
      e.createdAt,
    ]);
    downloadCSV(`Events_Admin_${todayIso}.csv`, headers, rows);
  };

  // Auth Guard
  if (!isAuthorized) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
          <ShieldAlert className="size-6" />
        </div>
        <h2 className="text-lg font-medium text-foreground">Akses dibatasi</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Halaman ini khusus untuk peran Administrator atau Pemilik Platform Dago.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Notifications */}
      {actionSuccessMessage ? (
        <Alert>
          <CheckCircle2 className="text-success" />
          <AlertTitle>Berhasil</AlertTitle>
          <AlertDescription>{actionSuccessMessage}</AlertDescription>
        </Alert>
      ) : null}

      {actionErrorMessage ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Kendala</AlertTitle>
          <AlertDescription>{actionErrorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {/* Header */}
      <EventsAdminHeader
        onExportData={handleExportData}
        onRefresh={loadAdminEvents}
        isLoading={isLoading}
      />

      <EventsAdminTabs
        currentSection={adminSection}
        onSectionChange={setAdminSection}
        pendingReviewsCount={kpi.pendingReviewsCount}
        pendingPaymentsCount={kpi.pendingPaymentsCount}
        pendingPayoutsCount={pendingPayoutsCount}
        pendingRefundsCount={pendingRefundsCount}
      />

      {adminSection === "MODERATION" && (
        <div className="flex flex-col gap-6">
          <EventsModerationKPI
            pendingCount={moderationKpi.pendingReviewsCount}
            approvedCount={moderationKpi.approvedEventsCount}
            revisionCount={moderationKpi.revisionEventsCount}
          />

          <EventsModerationToolbar
            statusTab={selectedStatusTab}
            onStatusTabChange={(tab) => {
              setSelectedStatusTab(tab);
              setModerationPage(1);
            }}
            searchQuery={searchQuery}
            onSearchChange={(q) => {
              setSearchQuery(q);
              setModerationPage(1);
            }}
            dateRange={dateRange}
            onDateRangeChange={(r) => {
              setDateRange(r);
              setModerationPage(1);
            }}
            pendingCount={kpi.pendingReviewsCount}
          />

          <EventsModerationTable
            events={filteredEvents}
            totalItems={filteredEvents.length}
            currentPage={moderationPage}
            pageSize={moderationPageSize}
            onPageChange={setModerationPage}
            onPageSizeChange={setModerationPageSize}
            onViewDetail={(e) => {
              setSelectedEvent(e);
              setIsDetailSheetOpen(true);
            }}
            onEdit={handleOpenEdit}
            onManageAttendees={(e) => {
              setSelectedEventForAttendees(e);
              setIsAttendeesModalOpen(true);
            }}
            onApprove={(e) => openModerationDialog(e, "APPROVE")}
            onRequestRevision={(e) => openModerationDialog(e, "REVISION")}
            onReject={(e) => openModerationDialog(e, "REJECT")}
            onArchive={(e) => openModerationDialog(e, "ARCHIVE")}
            onDelete={handleDeleteEvent}
            searchQuery={searchQuery}
          />
        </div>
      )}

      {adminSection === "PAYMENTS" && (
        <EventsPaymentsTable
          bookings={filteredBookings}
          filterStatus={paymentFilterStatus}
          onFilterStatusChange={(s) => {
            setPaymentFilterStatus(s);
            setPaymentsPage(1);
          }}
          searchQuery={paymentSearchQuery}
          onSearchChange={(q) => {
            setPaymentSearchQuery(q);
            setPaymentsPage(1);
          }}
          dateRange={paymentDateRange}
          onDateRangeChange={(r) => {
            setPaymentDateRange(r);
            setPaymentsPage(1);
          }}
          currentPage={paymentsPage}
          pageSize={paymentsPageSize}
          onPageChange={setPaymentsPage}
          onPageSizeChange={(s) => {
            setPaymentsPageSize(s);
            setPaymentsPage(1);
          }}
          onApprove={handleApprovePayment}
          onReject={(b) => {
            setRejectPaymentTarget(b);
            setRejectPaymentReason("");
            setRejectPaymentCancelBooking(false);
          }}
          onPreviewProof={(b) => setSelectedProofBooking(b)}
          onDeleteBooking={handleDeleteBooking}
          isProcessing={isProcessingPaymentAction}
        />
      )}

      {adminSection === "PAYOUTS" && (
        <EventsPayoutsTable
          payouts={allPayouts}
          filterStatus={payoutFilterStatus}
          onFilterStatusChange={(s) => {
            setPayoutFilterStatus(s);
            setPayoutsPage(1);
          }}
          searchQuery={payoutSearchQuery}
          onSearchChange={(q) => {
            setPayoutSearchQuery(q);
            setPayoutsPage(1);
          }}
          dateRange={payoutDateRange}
          onDateRangeChange={(r) => {
            setPayoutDateRange(r);
            setPayoutsPage(1);
          }}
          currentPage={payoutsPage}
          pageSize={payoutsPageSize}
          onPageChange={setPayoutsPage}
          onPageSizeChange={(s) => {
            setPayoutsPageSize(s);
            setPayoutsPage(1);
          }}
          onActionClick={(target) => {
            setPayoutTarget(target);
            setPayoutInputText("");
          }}
          isProcessing={isProcessingPayout}
        />
      )}

      {adminSection === "REFUNDS" && (
        <EventsRefundsTable
          refunds={allRefunds}
          onRefresh={() => {
            loadAdminRefunds();
            loadAdminEvents();
          }}
        />
      )}

      {adminSection === "SETTINGS" && (
        <EventsSettingsView
          businessPolicy={businessPolicy}
          setBusinessPolicy={setBusinessPolicy}
          bankAccountsList={bankAccountsList}
          bankChangeHistory={bankChangeHistory}
          onSavePolicy={handleSavePolicy}
          onOpenAddBank={handleOpenAddBank}
          onEditBank={handleOpenEditBank}
          onDeleteBank={handleDeleteBank}
          onSetDefaultBank={handleSetDefaultBank}
          onToggleBankActive={handleToggleBankActive}
          isSaving={isSavingSettings}
        />
      )}

      {/* Sheets & Dialogs */}
      <EventDetailSheet
        event={selectedEvent}
        open={isDetailSheetOpen}
        onOpenChange={setIsDetailSheetOpen}
        onApprove={(e) => openModerationDialog(e, "APPROVE")}
        onRequestRevision={(e) => openModerationDialog(e, "REVISION")}
        onReject={(e) => openModerationDialog(e, "REJECT")}
        onArchive={(e) => openModerationDialog(e, "ARCHIVE")}
        onEdit={handleOpenEdit}
        onManageAttendees={(e) => {
          setSelectedEventForAttendees(e);
          setIsAttendeesModalOpen(true);
        }}
        onManagePromos={(e) => setPromoEvent(e)}
        onDelete={handleDeleteEvent}
        isProcessing={isProcessingModeration}
      />

      <EventPromosDialog
        open={Boolean(promoEvent)}
        onOpenChange={(open) => !open && setPromoEvent(null)}
        event={promoEvent}
        onPromoUpdated={loadAdminEvents}
      />

      <EventAttendeesModal
        open={isAttendeesModalOpen}
        onOpenChange={setIsAttendeesModalOpen}
        event={selectedEventForAttendees}
        bookings={allBookings}
        onToggleCheckIn={handleCheckInToggle}
        onDeleteBooking={handleDeleteBooking}
        isUpdatingCheckInId={isUpdatingCheckInId}
      />

      <PaymentProofDialog
        booking={selectedProofBooking}
        open={Boolean(selectedProofBooking)}
        onOpenChange={(open) => !open && setSelectedProofBooking(null)}
        onApprove={handleApprovePayment}
        onReject={(b) => {
          setSelectedProofBooking(null);
          setRejectPaymentTarget(b);
          setRejectPaymentReason("");
          setRejectPaymentCancelBooking(false);
        }}
        isProcessing={isProcessingPaymentAction}
      />

      <RejectPaymentDialog
        booking={rejectPaymentTarget}
        open={Boolean(rejectPaymentTarget)}
        onOpenChange={(open) => !open && setRejectPaymentTarget(null)}
        reason={rejectPaymentReason}
        onReasonChange={setRejectPaymentReason}
        cancelBooking={rejectPaymentCancelBooking}
        onCancelBookingChange={setRejectPaymentCancelBooking}
        onConfirmReject={handleConfirmRejectPayment}
        isProcessing={isProcessingPaymentAction}
      />

      <ModerationActionDialog
        event={moderationTarget?.event || null}
        actionType={moderationTarget?.action || null}
        open={Boolean(moderationTarget)}
        onOpenChange={(open) => !open && setModerationTarget(null)}
        notes={moderationNotes}
        onNotesChange={setModerationNotes}
        onConfirm={handleConfirmModeration}
        isProcessing={isProcessingModeration}
      />

      <PayoutActionDialog
        target={payoutTarget}
        open={Boolean(payoutTarget)}
        onOpenChange={(open) => !open && setPayoutTarget(null)}
        inputText={payoutInputText}
        onInputTextChange={setPayoutInputText}
        onConfirm={handleConfirmPayoutAction}
        isProcessing={isProcessingPayout}
      />

      <BankModal
        open={isAddBankModalOpen}
        onOpenChange={setIsAddBankModalOpen}
        isEdit={Boolean(editingBank)}
        formData={bankForm}
        onFormChange={setBankForm}
        onSubmit={handleSubmitBankForm}
        isSaving={isSavingSettings}
      />

      <EventEditModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        event={selectedEvent}
        formData={editFormData}
        onFormDataChange={setEditFormData}
        guidelinesText={editGuidelinesText}
        onGuidelinesTextChange={setEditGuidelinesText}
        onSave={handleSaveEdit}
        isSaving={isSavingEdit}
        hasPaidTickets={allBookings.some((b) => b.eventId === selectedEvent?.id && b.paymentStatus === "PAID")}
      />
    </div>
  );
}
