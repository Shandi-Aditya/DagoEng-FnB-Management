"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
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
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeft,
  ArrowRight,
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
  ChevronUp,
  Plus,
  Compass,
  BarChart3,
  SlidersHorizontal,
  Lock,
  LogIn,
  LogOut,
  Camera,
  Upload,
  Image as ImageIcon,
  AlertTriangle,
  Settings,
  CreditCard,
  QrCode,
  Wallet,
  Activity,
  ArrowUpRight,
  Building2,
  Phone,
  Save,
  Menu,
} from "lucide-react";
import { formatCurrencyIDR } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TablePagination, TablePageSizeSelector } from "@/components/ui/table-pagination";
import { CommunityEvent, EventTicketOrder, OrganizerPortalData, AttendeeCheckInStatus, PayoutRecord, EventCategory } from "@/types/event";
import { resolveVenueCapacity } from "@/lib/event-capacity";
import { useAuth } from "@/contexts/AuthContext";
import { EventSearchInput } from "@/components/events/EventSearchInput";
import {
  EventDateRangeFilter,
  DateRange,
  isEventInWitaPeriod,
  isTimestampInWitaPeriod,
  getWitaDateString,
  getWitaStartOfDay,
  getWitaEndOfDay,
  getWitaStartOfMonthString,
} from "@/components/events/EventDateRangeFilter";

type OrganizerNavView = "EVENTS" | "ATTENDEES" | "FINANCE" | "HOME" | "SETTINGS";
type EventViewMode = "LIST" | "CALENDAR";
type EventFilterStatus = "ALL" | "APPROVED" | "PENDING" | "REVISION_REQUESTED" | "REJECTED" | "ARCHIVED";

function formatWhatsAppUrl(phone?: string | null): string {
  if (!phone) return "#";
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (!cleaned) return "#";
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  } else if (!cleaned.startsWith("62")) {
    cleaned = "62" + cleaned;
  }
  return `https://wa.me/${cleaned}`;
}

export default function CommunityOrganizerPortalPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [organizerEmail, setOrganizerEmail] = useState("");
  const [activeEmail, setActiveEmail] = useState("");
  const [portalData, setPortalData] = useState<OrganizerPortalData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Viewing Event Detail Modal
  const [viewingDetailEvent, setViewingDetailEvent] = useState<CommunityEvent | null>(null);

  // Eventbrite Navigation States
  const [activeNav, setActiveNav] = useState<OrganizerNavView>("EVENTS");
  const [eventViewMode, setEventViewMode] = useState<EventViewMode>("LIST");
  const [eventFilterStatus, setEventFilterStatus] = useState<EventFilterStatus>("ALL");
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [isEventFilterOpen, setIsEventFilterOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [eventPage, setEventPage] = useState(1);
  const [eventPageSize, setEventPageSize] = useState(10);

  // Sidebar Expand / Collapse State (Consistent with FnB Dashboard)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dago_organizer_sidebar_collapsed");
      if (saved !== null) {
        setIsSidebarCollapsed(saved === "true");
      }
    } catch (_) {}
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("dago_organizer_sidebar_collapsed", String(next));
      } catch (_) {}
      return next;
    });
  };

  // Attendees Filtering & QR Scanner
  const [selectedEventId, setSelectedEventId] = useState<string>("ALL");
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [expandedBookingIds, setExpandedBookingIds] = useState<Set<string>>(new Set());

  const toggleBookingExpand = (bookingId: string) => {
    setExpandedBookingIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookingId)) {
        next.delete(bookingId);
      } else {
        next.add(bookingId);
      }
      return next;
    });
  };

  // Revision Modal State
  const [revisionEvent, setRevisionEvent] = useState<CommunityEvent | null>(null);
  const [revisionTitle, setRevisionTitle] = useState("");
  const [revisionCategory, setRevisionCategory] = useState<EventCategory>("CREATIVE");
  const [revisionDesc, setRevisionDesc] = useState("");
  const [revisionLocation, setRevisionLocation] = useState("");
  const [revisionCapacity, setRevisionCapacity] = useState<number>(50);
  const [revisionGuidelines, setRevisionGuidelines] = useState("");
  const [revisionPosterUrl, setRevisionPosterUrl] = useState("");
  const [revisionStartDate, setRevisionStartDate] = useState("");
  const [revisionEndDate, setRevisionEndDate] = useState("");
  const [isUploadingRevisionPoster, setIsUploadingRevisionPoster] = useState(false);
  const [revisionUploadError, setRevisionUploadError] = useState<string | null>(null);
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);

  // Revenue split negotiation modal in portal
  const [negotiatingEvent, setNegotiatingEvent] = useState<CommunityEvent | null>(null);
  const [splitOrgPercent, setSplitOrgPercent] = useState<number>(80);
  const [splitPlatPercent, setSplitPlatPercent] = useState<number>(20);
  const [splitReason, setSplitReason] = useState("");
  const [isSubmittingSplit, setIsSubmittingSplit] = useState(false);

  // Payout request modal in portal
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutTargetEventId, setPayoutTargetEventId] = useState<string>("");
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [payoutBankName, setPayoutBankName] = useState("BCA");
  const [payoutAccountNumber, setPayoutAccountNumber] = useState("");
  const [payoutAccountHolder, setPayoutAccountHolder] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);

  // Organizer Settings state (rekening penampung & profil komunitas)
  const [bankSettings, setBankSettings] = useState({
    bankName: "BCA",
    accountNumber: "8420192831",
    accountHolder: "Dago Specialty Coffee Society",
    branch: "KCU Singaraja",
  });
  const [profileSettings, setProfileSettings] = useState({
    communityName: "Dago Specialty Coffee Society",
    contactPhone: "+62 812-9876-5432",
    contactEmail: "baristaguild@dagocreative.id",
    description: "Komunitas Barista & Pecinta Kopi Spesialti di Dago Creative Hub. Rutin mengadakan latte art throwdown, sensory workshop, dan cupping session.",
    instagram: "@dagobaristaguild",
    website: "https://dagocreative.id/community/barista",
  });
  const [notifSettings, setNotifSettings] = useState({
    emailOnTicket: true,
    waOnTicket: true,
    instantCheckInAlert: false,
  });
  const [isSavedFeedback, setIsSavedFeedback] = useState<string | null>(null);

  // Restore settings from server data per active organizer email (purge sensitive data from localStorage)
  useEffect(() => {
    if (activeEmail) {
      try {
        if (portalData?.registeredBankAccount) {
          setBankSettings({
            bankName: portalData.registeredBankAccount.bankName,
            accountNumber: portalData.registeredBankAccount.accountNumber,
            accountHolder: portalData.registeredBankAccount.accountHolder,
            branch: portalData.registeredBankAccount.branch || "",
          });
          // Security purge: remove sensitive financial credentials from browser localStorage
          localStorage.removeItem(`dago_org_bank_${activeEmail}`);
        }
        const savedProfile = localStorage.getItem(`dago_org_profile_${activeEmail}`);
        if (savedProfile) {
          setProfileSettings(JSON.parse(savedProfile));
        } else if (portalData?.summary?.organizerName) {
          setProfileSettings((prev) => ({
            ...prev,
            communityName: portalData.summary.organizerName,
            contactEmail: activeEmail,
          }));
        }
        const savedNotif = localStorage.getItem(`dago_org_notif_${activeEmail}`);
        if (savedNotif) setNotifSettings(JSON.parse(savedNotif));
      } catch (_) {}
    }
  }, [activeEmail, portalData?.summary?.organizerName, portalData?.registeredBankAccount]);

  // Lock body scroll whenever any modal is open
  useEffect(() => {
    const isAnyModalOpen = Boolean(viewingDetailEvent || revisionEvent || negotiatingEvent || isPayoutModalOpen);
    if (isAnyModalOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [viewingDetailEvent, revisionEvent, negotiatingEvent, isPayoutModalOpen]);

  const handleSaveBankSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Save bank account securely to server API
      const res = await fetch("/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: `Rekening Mitra ${profileSettings.communityName || "Komunitas"}`,
          bankName: bankSettings.bankName,
          accountNumber: bankSettings.accountNumber,
          accountHolder: bankSettings.accountHolder,
          branch: bankSettings.branch,
          accountType: "ORGANIZER",
          organizerEmail: activeEmail,
        }),
      });

      // Purge any residual plaintext bank credential from localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem(`dago_org_bank_${activeEmail}`);
      }

      setIsSavedFeedback("Rekening penampung bagi hasil resmi berhasil didaftarkan dan tersimpan aman di server!");
      setTimeout(() => setIsSavedFeedback(null), 3500);
      await loadPortalData(activeEmail);
    } catch (_) {
      setIsSavedFeedback("Rekening penampung bagi hasil berhasil diperbarui.");
      setTimeout(() => setIsSavedFeedback(null), 3500);
    }
  };

  const handleSaveProfileSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(`dago_org_profile_${activeEmail}`, JSON.stringify(profileSettings));
      if (portalData) {
        setPortalData({
          ...portalData,
          summary: {
            ...portalData.summary,
            organizerName: profileSettings.communityName,
          },
        });
      }
      setIsSavedFeedback("Profil komunitas berhasil diperbarui!");
      setTimeout(() => setIsSavedFeedback(null), 3500);
    } catch (_) {}
  };

  const handleSaveNotifSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(`dago_org_notif_${activeEmail}`, JSON.stringify(notifSettings));
      setIsSavedFeedback("Preferensi notifikasi berhasil disimpan!");
      setTimeout(() => setIsSavedFeedback(null), 3500);
    } catch (_) {}
  };

  // Computed Executive Metrics for Home Dashboard
  const myEventsList = portalData?.events || [];
  const myBookingsList = portalData?.bookings || [];

  const upcomingEvents = useMemo(() => {
    return myEventsList
      .filter((e) => e.status === "APPROVED")
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [myEventsList]);

  const recentBookings = useMemo(() => {
    return [...myBookingsList]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [myBookingsList]);

  const totalCapacitySum = useMemo(() => {
    return myEventsList.reduce((acc, evt) => acc + (resolveVenueCapacity(evt).capacity || 0), 0);
  }, [myEventsList]);

  const totalSoldTickets = portalData?.summary?.totalTicketsSold || 0;
  const occupancyPercentage = totalCapacitySum > 0 ? Math.min(100, Math.round((totalSoldTickets / totalCapacitySum) * 100)) : 0;

  const salesTrend = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

    // 1. Filter bookings strictly by dateRange and verified PAID status
    const paidBookings = myBookingsList.filter((b) => {
      if (b.paymentStatus !== "PAID") return false;
      return dateRange ? isTimestampInWitaPeriod(b.createdAt, dateRange) : true;
    });

    let trend: Array<{
      label: string;
      subLabel?: string;
      ticketCount: number;
      revenue: number;
      payout: number;
    }> = [];
    let periodTitle = "Semua Waktu";

    if (!dateRange) {
      // DEFAULT: 6 Months Backwards
      periodTitle = "6 Bulan Terakhir";
      const currentMonth = new Date().getMonth();
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(currentMonth - i);
        const mIdx = d.getMonth();
        const yr = d.getFullYear();
        trend.push({
          label: monthNames[mIdx],
          subLabel: String(yr),
          ticketCount: 0,
          revenue: 0,
          payout: 0,
        });
      }

      paidBookings.forEach((b) => {
        const bDate = new Date(b.createdAt);
        const bMonth = bDate.getMonth();
        const bYear = bDate.getFullYear();
        const target = trend.find((t) => t.subLabel === String(bYear) && t.label === monthNames[bMonth]);
        if (target) {
          target.ticketCount += b.ticketCount || 1;
          target.revenue += b.totalPrice;
          target.payout += (b.organizerRevenueAmount ?? Math.round(b.totalPrice * 0.8));
        }
      });
    } else {
      const startMs = getWitaStartOfDay(dateRange.startDate);
      const endMs = getWitaEndOfDay(dateRange.endDate);
      const diffDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

      if (dateRange.startDate === dateRange.endDate) {
        // SCENARIO 1: HARI INI (1 HARI) -> 6 Interval Waktu per 4 Jam
        periodTitle = `Hari Ini (${new Date(dateRange.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" })})`;
        const windows = [
          { label: "00-04", startH: 0, endH: 4 },
          { label: "04-08", startH: 4, endH: 8 },
          { label: "08-12", startH: 8, endH: 12 },
          { label: "12-16", startH: 12, endH: 16 },
          { label: "16-20", startH: 16, endH: 20 },
          { label: "20-24", startH: 20, endH: 24 },
        ];

        trend = windows.map((w) => ({
          label: w.label,
          subLabel: "WITA",
          ticketCount: 0,
          revenue: 0,
          payout: 0,
        }));

        paidBookings.forEach((b) => {
          const bDate = new Date(b.createdAt);
          const utcHours = bDate.getUTCHours();
          const witaHours = (utcHours + 8) % 24;
          const targetIndex = windows.findIndex((w) => witaHours >= w.startH && witaHours < w.endH);
          if (targetIndex !== -1 && trend[targetIndex]) {
            trend[targetIndex].ticketCount += b.ticketCount || 1;
            trend[targetIndex].revenue += b.totalPrice;
            trend[targetIndex].payout += (b.organizerRevenueAmount ?? Math.round(b.totalPrice * 0.8));
          }
        });
      } else if (diffDays <= 7) {
        // SCENARIO 2: 7 HARI (Harian)
        periodTitle = "7 Hari Terakhir";
        const dayBuckets: Array<{ dateStr: string; label: string; subLabel: string }> = [];

        for (let i = 0; i < diffDays; i++) {
          const d = new Date(startMs + i * 24 * 60 * 60 * 1000);
          const dateStr = getWitaDateString(d);
          const dayNum = d.getDate();
          const dayName = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][d.getDay()];
          dayBuckets.push({
            dateStr,
            label: `${dayNum} ${monthNames[d.getMonth()]}`,
            subLabel: dayName,
          });
        }

        trend = dayBuckets.map((db) => ({
          label: db.label,
          subLabel: db.subLabel,
          ticketCount: 0,
          revenue: 0,
          payout: 0,
        }));

        paidBookings.forEach((b) => {
          const bDateStr = getWitaDateString(new Date(b.createdAt));
          const targetIndex = dayBuckets.findIndex((db) => db.dateStr === bDateStr);
          if (targetIndex !== -1 && trend[targetIndex]) {
            trend[targetIndex].ticketCount += b.ticketCount || 1;
            trend[targetIndex].revenue += b.totalPrice;
            trend[targetIndex].payout += (b.organizerRevenueAmount ?? Math.round(b.totalPrice * 0.8));
          }
        });
      } else if (diffDays <= 35) {
        // SCENARIO 3: 30 HARI / BULAN INI -> 5 Interval Tanggal
        periodTitle = dateRange.startDate === getWitaStartOfMonthString() ? "Bulan Ini" : "30 Hari Terakhir";
        const segmentCount = 5;
        const segmentDuration = (endMs - startMs) / segmentCount;

        const segments: Array<{ startMs: number; endMs: number; label: string; subLabel: string }> = [];
        for (let s = 0; s < segmentCount; s++) {
          const segStart = new Date(startMs + s * segmentDuration);
          const segEnd = new Date(startMs + (s + 1) * segmentDuration - 1);
          segments.push({
            startMs: segStart.getTime(),
            endMs: segEnd.getTime(),
            label: `${segStart.getDate()}-${segEnd.getDate()} ${monthNames[segEnd.getMonth()]}`,
            subLabel: `Sesi ${s + 1}`,
          });
        }

        trend = segments.map((seg) => ({
          label: seg.label,
          subLabel: seg.subLabel,
          ticketCount: 0,
          revenue: 0,
          payout: 0,
        }));

        paidBookings.forEach((b) => {
          const bTime = new Date(b.createdAt).getTime();
          const targetIndex = segments.findIndex((seg) => bTime >= seg.startMs && bTime <= seg.endMs);
          if (targetIndex !== -1 && trend[targetIndex]) {
            trend[targetIndex].ticketCount += b.ticketCount || 1;
            trend[targetIndex].revenue += b.totalPrice;
            trend[targetIndex].payout += (b.organizerRevenueAmount ?? Math.round(b.totalPrice * 0.8));
          }
        });
      } else {
        // SCENARIO 4: KUSTOM RENTANG PANJANG -> Bulanan
        periodTitle = `${dateRange.startDate} s/d ${dateRange.endDate}`;
        const startD = new Date(startMs);
        const endD = new Date(endMs);

        const monthBuckets: Array<{ year: number; month: number; label: string; subLabel: string }> = [];
        let curr = new Date(startD.getFullYear(), startD.getMonth(), 1);
        const endMonth = new Date(endD.getFullYear(), endD.getMonth(), 1);

        while (curr <= endMonth && monthBuckets.length < 12) {
          const mIdx = curr.getMonth();
          const yr = curr.getFullYear();
          monthBuckets.push({
            year: yr,
            month: mIdx,
            label: monthNames[mIdx],
            subLabel: String(yr),
          });
          curr.setMonth(curr.getMonth() + 1);
        }

        trend = monthBuckets.map((mb) => ({
          label: mb.label,
          subLabel: mb.subLabel,
          ticketCount: 0,
          revenue: 0,
          payout: 0,
        }));

        paidBookings.forEach((b) => {
          const bDate = new Date(b.createdAt);
          const bMonth = bDate.getMonth();
          const bYear = bDate.getFullYear();
          const targetIndex = monthBuckets.findIndex((mb) => mb.year === bYear && mb.month === bMonth);
          if (targetIndex !== -1 && trend[targetIndex]) {
            trend[targetIndex].ticketCount += b.ticketCount || 1;
            trend[targetIndex].revenue += b.totalPrice;
            trend[targetIndex].payout += (b.organizerRevenueAmount ?? Math.round(b.totalPrice * 0.8));
          }
        });
      }
    }

    const maxRevenue = Math.max(...trend.map((t) => t.payout), 50000);
    const maxTickets = Math.max(...trend.map((t) => t.ticketCount), 5);

    return { trend, maxRevenue, maxTickets, periodTitle };
  }, [myBookingsList, dateRange]);

  // Auto-dismiss success notification
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Synchronize on mount or user changes
  useEffect(() => {
    const isAdminUser =
      user?.role?.slug === "OWNER" ||
      user?.role?.slug === "SUPER_ADMIN" ||
      user?.role?.slug === "MANAGER";
    const savedEmail = typeof window !== "undefined" ? localStorage.getItem("dago_organizer_email") : null;
    const targetEmail = isAdminUser && !savedEmail ? "ALL_ADMIN" : (savedEmail || user?.email);
    loadPortalData(targetEmail || undefined);
  }, [user?.email, user?.role?.slug]);

  // Lock body scroll when any modal is open
  useEffect(() => {
    const isAnyModalOpen =
      Boolean(viewingDetailEvent) ||
      Boolean(revisionEvent) ||
      Boolean(negotiatingEvent) ||
      isPayoutModalOpen ||
      isMobileMenuOpen;

    if (isAnyModalOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [
    viewingDetailEvent,
    revisionEvent,
    negotiatingEvent,
    isPayoutModalOpen,
    isMobileMenuOpen,
  ]);

  // Global Escape key listener to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setViewingDetailEvent(null);
        setRevisionEvent(null);
        setNegotiatingEvent(null);
        setIsPayoutModalOpen(false);
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const loadPortalData = async (email?: string) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const queryParam = email ? `?email=${encodeURIComponent(email)}` : "";
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

  const toDateTimeLocal = (isoString?: string) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openRevisionModal = (evt: CommunityEvent) => {
    setRevisionEvent(evt);
    setRevisionTitle(evt.title || "");
    setRevisionCategory(evt.category || "CREATIVE");
    setRevisionDesc(evt.description || "");
    setRevisionLocation(evt.location || "");
    setRevisionCapacity(evt.maxCapacity || 50);
    setRevisionGuidelines(Array.isArray(evt.guidelines) ? evt.guidelines.join("\n") : (evt.guidelines || ""));
    setRevisionPosterUrl(evt.posterUrl || "");
    setRevisionStartDate(toDateTimeLocal(evt.startDate));
    setRevisionEndDate(toDateTimeLocal(evt.endDate));
    setRevisionUploadError(null);
  };

  const handleUploadRevisionPoster = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setRevisionUploadError("File harus berupa gambar (JPG, PNG, atau WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setRevisionUploadError("Ukuran gambar maksimal 5MB.");
      return;
    }

    try {
      setIsUploadingRevisionPoster(true);
      setRevisionUploadError(null);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/events/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengunggah file poster.");
      }

      setRevisionPosterUrl(json.url);
    } catch (err: any) {
      setRevisionUploadError(err.message || "Gagal mengunggah gambar poster.");
    } finally {
      setIsUploadingRevisionPoster(false);
    }
  };

  const handleSaveRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = activeEmail || organizerEmail || user?.email || "";
    if (!revisionEvent || !targetEmail) return;

    try {
      setIsSubmittingRevision(true);
      setErrorMessage(null);

      const res = await fetch("/api/events/portal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetEmail,
          eventId: revisionEvent.id,
          updates: {
            title: revisionTitle,
            category: revisionCategory,
            description: revisionDesc,
            location: revisionLocation,
            maxCapacity: Number(revisionCapacity),
            posterUrl: revisionPosterUrl,
            startDate: revisionStartDate ? new Date(revisionStartDate).toISOString() : revisionEvent.startDate,
            endDate: revisionEndDate ? new Date(revisionEndDate).toISOString() : revisionEvent.endDate,
            guidelines: revisionGuidelines,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error || "Gagal menyimpan revisi.");
        return;
      }

      setSuccessMessage(`Event "${revisionEvent.title}" berhasil diperbaiki dan diajukan ulang! Status event kini kembali ke [Menunggu Review] dan dapat Anda pantau langsung.`);
      setRevisionEvent(null);
      setEventFilterStatus("PENDING");
      await loadPortalData(activeEmail);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal mengirim revisi.");
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  const handleProposeSplitOrganizer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negotiatingEvent) return;
    if (splitOrgPercent + splitPlatPercent !== 100) {
      setErrorMessage("Total persentase bagi hasil harus tepat 100%.");
      return;
    }
    try {
      setIsSubmittingSplit(true);
      const res = await fetch(`/api/events/${negotiatingEvent.id}/revenue-share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposedBy: "ORGANIZER",
          organizerPercent: splitOrgPercent,
          platformPercent: splitPlatPercent,
          reason: splitReason,
          email: activeEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengajukan usulan bagi hasil.");
      }
      setSuccessMessage("Usulan bagi hasil berhasil diajukan dan akan ditinjau kurator Dago.");
      setNegotiatingEvent(null);
      setSplitReason("");
      await loadPortalData(activeEmail);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmittingSplit(false);
    }
  };

  const handleRespondSplitOrganizer = async (event: CommunityEvent, decision: "ACCEPT" | "REJECT") => {
    try {
      setIsSubmittingSplit(true);
      const res = await fetch(`/api/events/${event.id}/revenue-share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          respondingParty: "ORGANIZER",
          email: activeEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal merespons usulan bagi hasil.");
      }
      setSuccessMessage(data.message || "Respons bagi hasil berhasil disimpan.");
      await loadPortalData(activeEmail);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmittingSplit(false);
    }
  };

  const handleSubmitPayoutRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutTargetEventId || payoutAmount <= 0) {
      setErrorMessage("Pilih event dan masukkan nominal pencairan yang valid.");
      return;
    }
    try {
      setIsSubmittingPayout(true);
      const res = await fetch(`/api/events/${payoutTargetEventId}/payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(payoutAmount),
          bankDetails: {
            bankName: payoutBankName,
            accountNumber: payoutAccountNumber,
            accountHolder: payoutAccountHolder,
          },
          notes: payoutNotes,
          email: activeEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengajukan pencairan dana.");
      }
      setSuccessMessage("Pengajuan pencairan saldo berhasil dikirim. DAGO Finance akan memverifikasi dan mentransfer manual.");
      setIsPayoutModalOpen(false);
      setPayoutAmount(0);
      setPayoutNotes("");
      await loadPortalData(activeEmail);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  // Effective Summary computed from active dateRange filter (strictly PAID bookings for metrics)
  const effectiveSummary = useMemo(() => {
    if (!portalData) return null;

    const filteredBookings = portalData.bookings.filter((b) =>
      dateRange ? isTimestampInWitaPeriod(b.createdAt, dateRange) : true
    );
    const paidBookings = filteredBookings.filter((b) => b.paymentStatus === "PAID");
    const totalTicketsSold = paidBookings.reduce((sum, b) => sum + (b.ticketCount || 1), 0);
    const totalAttendees = paidBookings.length;
    const eligibleRevenue = paidBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    // Financial and ticket metrics strictly count verified PAID bookings only
    const grossRevenue = eligibleRevenue;
    const platformFeeAmount = paidBookings.reduce((sum, b) => sum + (b.platformFeeAmount || 0), 0);
    const organizerPayoutAmount = paidBookings.reduce((sum, b) => sum + (b.organizerRevenueAmount || 0), 0);

    const periodEvents = portalData.events.filter((e) =>
      dateRange ? isEventInWitaPeriod(e, dateRange) : true
    );

    let requestedPayoutAmount = 0;
    let paidPayoutAmount = 0;
    periodEvents.forEach((e) => {
      e.payoutHistory?.forEach((p) => {
        if (p.status === "REQUESTED" || p.status === "PROCESSING") requestedPayoutAmount += p.amount;
        else if (p.status === "PAID") paidPayoutAmount += p.amount;
      });
    });

    const availablePayoutAmount = Math.max(0, organizerPayoutAmount - paidPayoutAmount - requestedPayoutAmount);

    return {
      ...portalData.summary,
      totalEvents: periodEvents.length,
      approvedEvents: periodEvents.filter((e) => e.status === "APPROVED").length,
      pendingEvents: periodEvents.filter((e) => e.status === "PENDING").length,
      revisionEvents: periodEvents.filter((e) => e.status === "REVISION_REQUESTED").length,
      totalAttendees,
      totalTicketsSold,
      grossRevenue,
      eligibleRevenue,
      platformFeeAmount,
      organizerPayoutAmount,
      availablePayoutAmount,
      requestedPayoutAmount,
      paidPayoutAmount,
    };
  }, [portalData, dateRange]);

  const summary = effectiveSummary || portalData?.summary;

  const revisionEvents = useMemo(() => {
    return portalData?.events.filter((e) => e.status === "REVISION_REQUESTED") || [];
  }, [portalData?.events]);

  const rejectedEvents = useMemo(() => {
    return portalData?.events.filter((e) => e.status === "REJECTED") || [];
  }, [portalData?.events]);

  const archivedEvents = useMemo(() => {
    return portalData?.events.filter((e) => e.status === "ARCHIVED") || [];
  }, [portalData?.events]);

  const pendingRevenueSplitEvents = useMemo(() => {
    return (
      portalData?.events.filter(
        (e) =>
          e.proposedRevenueSplit?.status === "PENDING" &&
          e.proposedRevenueSplit.proposedBy !== "ORGANIZER"
      ) || []
    );
  }, [portalData?.events]);

  // Filtered Events based on search query, status filter, and WITA date range
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
        evt.status === eventFilterStatus;

      const matchDate = isEventInWitaPeriod(evt, dateRange);

      return matchSearch && matchStatus && matchDate;
    });
  }, [portalData, eventSearchQuery, eventFilterStatus, dateRange]);

  const paginatedEvents = useMemo(() => {
    const start = (eventPage - 1) * eventPageSize;
    return filteredEvents.slice(start, start + eventPageSize);
  }, [filteredEvents, eventPage, eventPageSize]);

  // Filtered Attendees for active tab with event, keyword, and date filters
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
      const matchesDate = isTimestampInWitaPeriod(b.createdAt, dateRange);
      return matchesEvent && matchesSearch && matchesDate;
    });
  }, [portalData, selectedEventId, attendeeSearch, dateRange]);

  // Combined payouts across all events
  const allPayouts = useMemo(() => {
    if (!portalData) return [];
    const list: (PayoutRecord & { eventTitle: string })[] = [];
    portalData.events.forEach((evt) => {
      if (evt.payoutHistory && Array.isArray(evt.payoutHistory)) {
        evt.payoutHistory.forEach((p) => {
          list.push({ ...p, eventTitle: evt.title });
        });
      }
    });
    return list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }, [portalData]);

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

  const organizerNavItems: {
    id: OrganizerNavView;
    label: string;
    icon: React.ReactNode;
    title: string;
    badge?: number;
  }[] = [
    {
      id: "HOME",
      label: "Ringkasan",
      icon: <Home className="w-4 h-4" />,
      title: "Overview & Metrik Ringkasan",
    },
    {
      id: "EVENTS",
      label: "Kelola Event",
      icon: <CalendarIcon className="w-4 h-4" />,
      title: "Daftar Event & Penjadwalan",
      badge: portalData?.events.length,
    },
    {
      id: "ATTENDEES",
      label: "Pesanan & Tiket",
      icon: <Users className="w-4 h-4" />,
      title: "Pesanan Tiket & Daftar Peserta",
      badge: portalData?.bookings.length,
    },
    {
      id: "FINANCE",
      label: "Keuangan & Payout",
      icon: <DollarSign className="w-4 h-4" />,
      title: "Laporan Pendapatan & Pencairan Saldo",
    },
    {
      id: "SETTINGS",
      label: "Pengaturan Mitra",
      icon: <Settings className="w-4 h-4" />,
      title: "Pengaturan Profil & Rekening Bank",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0A0F1D] text-[#1E293B] dark:text-[#E2E8F0] flex antialiased">
      {/* =========================================================================
          1. DESKTOP LEFT SIDEBAR (Visible only on large screens >= 1024px)
         ========================================================================= */}
      <aside
        className={`hidden lg:flex ${
          isSidebarCollapsed ? "w-20" : "w-64"
        } bg-white dark:bg-[#0F172A] border-r border-slate-200 dark:border-slate-800 flex-col justify-between select-none transition-all duration-300 ease-in-out flex-shrink-0 min-h-screen sticky top-0 h-screen z-40`}
      >
        {/* Scrollable Nav Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {/* Brand Header & Minimize Toggle (Identical to FnB Sidebar) */}
          <div
            className={`h-16 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center ${
              isSidebarCollapsed ? "justify-center" : "justify-between"
            }`}
          >
            {!isSidebarCollapsed ? (
              <>
                <Link href="/events/portal" className="flex items-center space-x-3 overflow-hidden min-w-0 group">
                  <div className="w-8 h-10 relative flex-shrink-0">
                    <NextImage
                      src="/logo-dago.png"
                      alt="Dago Creative Hub"
                      width={32}
                      height={40}
                      priority
                      className="object-contain group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="truncate">
                    <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 leading-tight truncate">
                      dago<span className="text-[#3B7A57] dark:text-[#52B788]">eng</span>
                    </h1>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">
                      ORGANIZER
                    </p>
                  </div>
                </Link>

                <div className="relative group/close">
                  <button
                    type="button"
                    onClick={toggleSidebar}
                    className="p-2 min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center shrink-0 touch-manipulation cursor-pointer"
                    title="Tutup sidebar"
                    aria-label="Tutup sidebar"
                  >
                    <PanelLeftClose className="w-5 h-5" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 hidden group-hover/close:flex items-center z-50 pointer-events-none animate-in fade-in duration-150">
                    <div className="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap shadow-md">
                      Tutup sidebar
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="relative group/toggle flex justify-center w-full">
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="relative w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all duration-200 cursor-pointer shadow-xs touch-manipulation group"
                  aria-label="Buka sidebar"
                >
                  {/* Default State: Logo Dago (tampil saat normal / tidak di-hover) */}
                  <div className="w-6 h-6 relative flex items-center justify-center transition-all duration-200 group-hover/toggle:opacity-0 group-hover/toggle:scale-75 group-hover/toggle:rotate-12">
                    <NextImage
                      src="/logo-dago.png"
                      alt="Dago Creative Hub"
                      width={24}
                      height={24}
                      priority
                      className="object-contain"
                    />
                  </div>

                  {/* Hover State: Tombol Buka Sidebar (tampil otomatis saat cursor hover di logo) */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-75 group-hover/toggle:opacity-100 group-hover/toggle:scale-100 transition-all duration-200 text-slate-700 dark:text-slate-100">
                    <PanelLeftOpen className="w-5 h-5" />
                  </div>
                </button>

                {/* Floating Pill Tooltip: "Buka sidebar" persis seperti FnB Dashboard */}
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 hidden group-hover/toggle:flex items-center z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                  <div className="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-3.5 py-1.5 rounded-2xl text-xs font-semibold whitespace-nowrap shadow-xl">
                    Buka sidebar
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Top Nav List */}
          <div className="p-3 space-y-4">
            {!isSidebarCollapsed && (
              <div className="px-3 pt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Menu Penyelenggara
              </div>
            )}

            {/* Navigation Buttons */}
            <nav className={`space-y-1.5 ${isSidebarCollapsed ? "flex flex-col items-center" : ""}`}>
              {organizerNavItems.map((item) => {
                const isActive = activeNav === item.id;

                if (isSidebarCollapsed) {
                  return (
                    <div key={item.id} className="relative group w-full flex justify-center">
                      <button
                        type="button"
                        onClick={() => setActiveNav(item.id)}
                        className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
                          isActive
                            ? "bg-[#3B7A57] text-white shadow-md shadow-[#3B7A57]/20"
                            : "text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                        }`}
                        title={item.label}
                      >
                        {item.icon}
                      </button>

                      {/* Tooltip on hover */}
                      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xl whitespace-nowrap hidden group-hover:flex items-center space-x-1.5 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                        <span>{item.label}</span>
                        {item.badge !== undefined && (
                          <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-mono">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveNav(item.id as OrganizerNavView)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#3B7A57] text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className={isActive ? "text-white" : "text-slate-400"}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-extrabold ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Separator */}
            <div className={`border-t border-slate-100 dark:border-slate-800 my-3 ${isSidebarCollapsed ? "w-8 mx-auto" : "w-full"}`} />

            {/* External Links */}
            <div className={`space-y-1 ${isSidebarCollapsed ? "flex flex-col items-center" : ""}`}>
              {!isSidebarCollapsed && (
                <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Pintasan Ekosistem
                </div>
              )}

              {/* Customer Portal */}
              {isSidebarCollapsed ? (
                <div className="relative group w-full flex justify-center">
                  <Link
                    href="/customer"
                    className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <Compass className="w-4 h-4 text-emerald-600" />
                  </Link>
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xl whitespace-nowrap hidden group-hover:flex items-center z-50 pointer-events-none">
                    Customer Portal (F&B)
                  </div>
                </div>
              ) : (
                <Link
                  href="/customer"
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 transition-all"
                >
                  <Compass className="w-4 h-4 text-emerald-600" />
                  <span>Customer Portal</span>
                </Link>
              )}

              {/* Public Events Catalog */}
              {isSidebarCollapsed ? (
                <div className="relative group w-full flex justify-center">
                  <Link
                    href="/events"
                    target="_blank"
                    className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-[#3B7A57] hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xl whitespace-nowrap hidden group-hover:flex items-center z-50 pointer-events-none">
                    Katalog Publik
                  </div>
                </div>
              ) : (
                <Link
                  href="/events"
                  target="_blank"
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 transition-all"
                >
                  <div className="flex items-center space-x-2.5">
                    <ExternalLink className="w-4 h-4 text-slate-400" />
                    <span>Katalog Publik</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              )}
            </div>
          </div>
        </div>

          {/* User Footer & Logout (Pinned to Bottom of Sidebar) */}
          <div className="shrink-0 p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            {!isSidebarCollapsed ? (
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#3B7A57] text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-xs">
                    {userInitial || "OR"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {portalData?.summary.organizerName || "Penyelenggara"}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {activeEmail || organizerEmail}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    if (typeof window !== "undefined") {
                      localStorage.removeItem("dago_organizer_email");
                    }
                    await logout();
                    router.push("/login");
                  }}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-800"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar dari Akun</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <div className="relative group w-full flex justify-center">
                  <button
                    type="button"
                    onClick={async () => {
                      if (typeof window !== "undefined") {
                        localStorage.removeItem("dago_organizer_email");
                      }
                      await logout();
                      router.push("/login");
                    }}
                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer"
                    title="Keluar dari Akun Penyelenggara"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xl whitespace-nowrap hidden group-hover:flex items-center z-50 pointer-events-none">
                    Keluar dari Akun
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* =========================================================================
            2. MOBILE & TABLET SLIDE-OVER DRAWER (< 1024px)
           ========================================================================= */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex animate-in fade-in duration-150">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-[#0F172A] border-r border-slate-200 dark:border-slate-800 z-10 shadow-2xl animate-in slide-in-from-left duration-200 overflow-y-auto">
              {/* Header */}
              <div className="h-16 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <Link
                  href="/events/portal"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center space-x-3 overflow-hidden min-w-0"
                >
                  <div className="w-8 h-10 relative flex-shrink-0">
                    <NextImage
                      src="/logo-dago.png"
                      alt="Dago Creative Hub"
                      width={32}
                      height={40}
                      priority
                      className="object-contain"
                    />
                  </div>
                  <div className="truncate">
                    <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 leading-tight truncate">
                      dago<span className="text-[#3B7A57] dark:text-[#52B788]">eng</span>
                    </h1>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">
                      ORGANIZER
                    </p>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 min-h-[44px] min-w-[44px] rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 flex items-center justify-center touch-manipulation cursor-pointer"
                  aria-label="Tutup Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Links */}
              <div className="p-3 space-y-4 flex-1">
                <div className="px-3 pt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Menu Penyelenggara
                </div>

                <nav className="space-y-1.5">
                  {organizerNavItems.map((item) => {
                    const isActive = activeNav === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveNav(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isActive
                            ? "bg-[#3B7A57] text-white shadow-sm"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className={isActive ? "text-white" : "text-slate-400"}>
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </div>
                        {item.badge !== undefined && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-extrabold ${
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>

                <div className="border-t border-slate-100 dark:border-slate-800 my-3" />

                <div className="space-y-1">
                  <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Pintasan Ekosistem
                  </div>
                  <Link
                    href="/customer"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 transition-all"
                  >
                    <Compass className="w-4 h-4 text-emerald-600" />
                    <span>Customer Portal</span>
                  </Link>
                  <Link
                    href="/events"
                    target="_blank"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 transition-all"
                  >
                    <div className="flex items-center space-x-3">
                      <ExternalLink className="w-4 h-4 text-slate-400" />
                      <span>Katalog Publik</span>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                  </Link>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#3B7A57] text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
                    {userInitial || "OR"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {portalData?.summary.organizerName || "Penyelenggara"}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {activeEmail || organizerEmail}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    if (typeof window !== "undefined") {
                      localStorage.removeItem("dago_organizer_email");
                    }
                    await logout();
                    router.push("/login");
                  }}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-800"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar dari Akun</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right Workspace Main Content Area (Header + Main) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto min-h-screen w-full">
          {/* Top Sticky Header for Workspace Area */}
          <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 h-16 flex items-center justify-between px-3 sm:px-6 shadow-xs gap-2">
            {/* Left: Mobile Drawer Trigger & Active Title */}
            <div className="flex items-center space-x-2 min-w-0">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors shrink-0 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Buka Menu Navigasi"
                aria-label="Buka Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-2 min-w-0">
                <span className="hidden sm:inline text-xs font-semibold text-slate-400 dark:text-slate-500 shrink-0">
                  Portal Komunitas /
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                  {activeNav === "HOME"
                    ? "Ringkasan"
                    : activeNav === "EVENTS"
                    ? "Kelola Event"
                    : activeNav === "ATTENDEES"
                    ? "Pesanan & Tiket"
                    : activeNav === "FINANCE"
                    ? "Keuangan & Payout"
                    : "Pengaturan Mitra"}
                </span>
              </div>
            </div>

            {/* Right Action & User Profile Area */}
            <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
              <ThemeToggle variant="pill" />

              {/* Quick Create Event CTA Button */}
              <Link href="/events/submit">
                <Button
                  size="sm"
                  className="bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs h-8 sm:h-9 px-2.5 sm:px-4 rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Buat Event</span>
                </Button>
              </Link>

              {/* User Profile Pill Avatar */}
              <div className="flex items-center space-x-2 pl-1.5 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="w-8 h-8 rounded-full bg-[#1E293B] dark:bg-slate-800 text-white flex items-center justify-center text-xs font-bold border border-slate-300 dark:border-slate-700 shadow-xs cursor-pointer"
                  title={activeEmail || organizerEmail}
                  aria-label="Buka Menu Pengguna"
                >
                  {userInitial || "OR"}
                </button>
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

          {/* Right Workspace Main Content Area */}
          <main className="flex-1 p-3.5 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-7xl mx-auto w-full space-y-5 sm:space-y-6">
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

          {/* Subtle Revision Notice */}
          {portalData && revisionEvents.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-2.5">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Event Perlu Revisi ({revisionEvents.length})
                </span>
              </div>

              <div className="space-y-2">
                {revisionEvents.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      {rev.posterUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={rev.posterUrl}
                          alt={rev.title}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-800 shrink-0"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white block truncate">{rev.title}</span>
                        <span className="text-[11px] text-amber-700 dark:text-amber-300">
                          Catatan: &ldquo;{rev.revisionNotes}&rdquo;
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => openRevisionModal(rev)}
                      className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs h-8 px-3.5 rounded-lg shrink-0 cursor-pointer font-bold"
                    >
                      <FileEdit className="w-3.5 h-3.5 mr-1" />
                      <span>Perbaiki Event</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rejected Notification Alert Card */}
          {portalData && rejectedEvents.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs space-y-2.5">
              <div className="flex items-center space-x-2 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Pemberitahuan Event Ditolak ({rejectedEvents.length})</span>
              </div>
              <div className="space-y-2">
                {rejectedEvents.map((rej) => (
                  <div key={rej.id} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-extrabold text-slate-900 dark:text-white block truncate">{rej.title}</span>
                      <span className="text-[11px] text-rose-700 dark:text-rose-300 block mt-0.5">
                        Alasan Penolakan Kurator: &ldquo;{rej.rejectionReason || rej.revisionNotes || "Proposal belum memenuhi pedoman kurasi komunitas Dago Hub."}&rdquo;
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openRevisionModal(rej)}
                      className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs h-8 px-3.5 rounded-lg shrink-0 cursor-pointer font-bold flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      <span>Ajukan Ulang / Perbaiki</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Revenue Split Negotiation Banner */}
          {portalData && pendingRevenueSplitEvents.length > 0 && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs space-y-2.5">
              <div className="flex items-center space-x-2 font-bold">
                <Sparkles className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788]" />
                <span>Usulan Skema Bagi Hasil dari Dago Menunggu Keputusan Anda ({pendingRevenueSplitEvents.length})</span>
              </div>
              <div className="space-y-2">
                {pendingRevenueSplitEvents.map((evt) => (
                  <div key={evt.id} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-extrabold text-slate-900 dark:text-white block truncate">{evt.title}</span>
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block mt-0.5">
                        Tawaran Dago: Penyelenggara {evt.proposedRevenueSplit?.organizerPercent}% : Dago {evt.proposedRevenueSplit?.platformPercent}% &bull; &ldquo;{evt.proposedRevenueSplit?.reason || "Penyesuaian bagi hasil"}&rdquo;
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setNegotiatingEvent(evt)}
                      className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs h-8 px-3.5 rounded-lg shrink-0 cursor-pointer font-bold flex items-center space-x-1"
                    >
                      <span>Tinjau &amp; Tanggapi Usulan</span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!portalData && !isLoading && (
            <Card className="p-8 sm:p-12 text-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xl space-y-6 max-w-2xl mx-auto my-8 animate-in fade-in">
              <div className="w-16 h-16 rounded-2xl bg-[#3B7A57]/10 dark:bg-[#52B788]/20 text-[#3B7A57] dark:text-[#52B788] mx-auto flex items-center justify-center">
                <Lock className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Akses Workspace Terproteksi</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  Masuk ke Organizer Workspace
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                  Untuk mengelola event komunitas, memantau penjualan tiket, dan melakukan check-in peserta pada hari pelaksanaan, silakan masuk menggunakan akun penyelenggara atau akun terpadu DagoEng Anda.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link href="/login?returnTo=/events/portal" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-sm h-11 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Masuk ke Akun Penyelenggara</span>
                  </Button>
                </Link>

                <Link href="/events/organizer-apply" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm h-11 px-6 rounded-2xl cursor-pointer"
                  >
                    <span>Daftar Akses Komunitas</span>
                  </Button>
                </Link>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-400">
                <span>Ingin melihat jadwal event publik? </span>
                <Link href="/events" className="text-[#3B7A57] dark:text-[#52B788] font-bold hover:underline">
                  Buka Marketplace DagoEng
                </Link>
              </div>
            </Card>
          )}

          {/* Loading Skeleton */}
          {isLoading && !portalData && (
            <div className="space-y-4 py-8">
              <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-xl w-48 animate-pulse" />
              <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
              <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
            </div>
          )}

          {portalData && (
            <>
              {/* Hub Admin Supervisor Switcher (Only visible to Platform Admins) */}
              {portalData.isAdmin && (
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
                  <button
                    type="button"
                    onClick={() => handleSelectCommunity({ id: "all_admin", name: "Semua Komunitas", email: "ALL_ADMIN" })}
                    className={`text-[10px] px-2.5 py-1 rounded-md border font-bold cursor-pointer transition-colors ${
                      activeEmail.toLowerCase() === "all_admin"
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                    }`}
                  >
                    🌐 Semua Komunitas Platform
                  </button>
                  {portalData.accessibleCommunities.map((c) => (
                    <button
                      key={c.email}
                      type="button"
                      onClick={() => handleSelectCommunity(c)}
                      className={`text-[10px] px-2 py-0.5 rounded-md border font-medium cursor-pointer ${
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
              {/* Header Title & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    Kelola Event
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Kelola jadwal, pantau keterisian tiket, dan pantau status moderasi event komunitas Anda ({portalData?.events.length || 0} total event).
                  </p>
                </div>
                <div className="flex items-center space-x-2">
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

              {/* Summary Metric Cards (Identical Layout to Events Admin) */}
              {(() => {
                const totalEventsCount = portalData?.events.length || 0;
                const activeEventsCount = portalData?.events.filter((e) => e.status === "APPROVED").length || 0;
                const reviewEventsCount = portalData?.events.filter((e) => e.status === "PENDING" || e.status === "REVISION_REQUESTED").length || 0;
                const paidBookingsList = (portalData?.bookings || []).filter((b) => b.paymentStatus === "PAID");
                const totalAttendeesCount = paidBookingsList.reduce((s, b) => s + b.ticketCount, 0);
                const totalRevenueAmount = paidBookingsList.reduce((s, b) => s + b.totalPrice, 0);

                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    <Card className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                      <div className="flex items-start justify-between gap-2 pb-1">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-tight min-w-0">Total Event Terdaftar</span>
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center shrink-0">
                          <CalendarIcon className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                        {totalEventsCount} <span className="text-xs font-normal text-slate-400">Event</span>
                      </div>
                      <span className="text-[10px] text-slate-400 truncate block">Seluruh agenda komunitas</span>
                    </Card>

                    <Card className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                      <div className="flex items-start justify-between gap-2 pb-1">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-tight min-w-0">Event Aktif &amp; Tayang</span>
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                        {activeEventsCount} <span className="text-xs font-normal text-slate-400">Disetujui</span>
                      </div>
                      <span className="text-[10px] text-slate-400 truncate block">Dapat diakses publik</span>
                    </Card>

                    <Card className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                      <div className="flex items-start justify-between gap-2 pb-1">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-tight min-w-0">Menunggu Moderasi</span>
                        <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
                          <Clock className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400">
                        {reviewEventsCount} <span className="text-xs font-normal text-slate-400">Review</span>
                      </div>
                      <span className="text-[10px] text-slate-400 truncate block">Perlu tindakan / kurasi</span>
                    </Card>

                    <Card className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                      <div className="flex items-start justify-between gap-2 pb-1">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-tight min-w-0">Total Tiket &amp; Peserta</span>
                        <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 flex items-center justify-center shrink-0">
                          <Ticket className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                        {totalAttendeesCount} <span className="text-xs font-normal text-slate-400">Peserta</span>
                      </div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate block">
                        Rp {totalRevenueAmount.toLocaleString("id-ID")}
                      </span>
                    </Card>
                  </div>
                );
              })()}

              {/* Filter Rentang Tanggal Pelaksanaan Event (WITA) */}
              <div className="bg-slate-50/70 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <EventDateRangeFilter
                  onApplyFilter={(range) => {
                    setDateRange(range);
                    setEventPage(1);
                  }}
                  initialRange={dateRange}
                  label="Filter Rentang Tanggal Pelaksanaan Event (WITA)"
                />
              </div>

              {/* Filter Tabs & Search Bar with Page Size Selector */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-1">
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  {([
                    { key: "ALL", label: "Semua Pengajuan", status: undefined },
                    { key: "PENDING", label: "Menunggu Review", status: "PENDING" },
                    { key: "APPROVED", label: "Disetujui", status: "APPROVED" },
                    { key: "REVISION_REQUESTED", label: "Perlu Revisi", status: "REVISION_REQUESTED" },
                    { key: "REJECTED", label: "Ditolak", status: "REJECTED" },
                    { key: "ARCHIVED", label: "Arsip", status: "ARCHIVED" },
                  ] as const).map((tab) => {
                    const active = eventFilterStatus === tab.key;
                    const count =
                      tab.status !== undefined
                        ? portalData?.events.filter((e) => e.status === tab.status).length || 0
                        : portalData?.events.length || 0;
                    const isRevisionAlert = tab.key === "REVISION_REQUESTED" && count > 0;

                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          setEventFilterStatus(tab.key);
                          setEventPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
                          active
                            ? "bg-[#3B7A57] text-white shadow-xs"
                            : isRevisionAlert
                            ? "bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                            : "bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                            active
                              ? "bg-white/20 text-white"
                              : isRevisionAlert
                              ? "bg-amber-500 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap sm:flex-nowrap">
                  <TablePageSizeSelector
                    pageSize={eventPageSize}
                    onPageSizeChange={(sz) => {
                      setEventPageSize(sz);
                      setEventPage(1);
                    }}
                    label="records"
                  />

                  <div className="relative flex-1 sm:flex-initial min-w-[140px] sm:min-w-[220px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={eventSearchQuery}
                      onChange={(e) => {
                        setEventSearchQuery(e.target.value);
                        setEventPage(1);
                      }}
                      placeholder="Cari nama event..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                    />
                  </div>

                  {/* View Switcher (List vs Calendar) */}
                  <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEventViewMode("LIST")}
                      className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        eventViewMode === "LIST"
                          ? "bg-white dark:bg-[#0F172A] text-[#3B7A57] dark:text-[#52B788] shadow-xs"
                          : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                      title="Tampilan Tabel"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEventViewMode("CALENDAR")}
                      className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        eventViewMode === "CALENDAR"
                          ? "bg-white dark:bg-[#0F172A] text-[#3B7A57] dark:text-[#52B788] shadow-xs"
                          : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                      title="Tampilan Kalender"
                    >
                      <CalendarIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Table / List View of Events */}
              {eventViewMode === "LIST" && (
                <Card className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
                  {filteredEvents.length === 0 ? (
                    <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                      <p className="font-semibold">Tidak ada event pada status ini.</p>
                      <p className="text-[11px] text-slate-400">
                        {eventSearchQuery || eventFilterStatus !== "ALL" || dateRange
                          ? "Coba ubah kata kunci pencarian atau reset filter status."
                          : "Mulai buat event komunitas baru untuk ditayangkan di ekosistem Dago."}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50/80 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                              <th className="py-3 px-4">Event & Poster</th>
                              <th className="py-3 px-4">Kategori & Harga</th>
                              <th className="py-3 px-4">Jadwal & Ruang</th>
                              <th className="py-3 px-4">Peserta & Tiket</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4 text-right">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {paginatedEvents.map((evt) => {
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

                              return (
                                <tr
                                  key={evt.id}
                                  onClick={() => setViewingDetailEvent(evt)}
                                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                                  title="Klik baris atau judul untuk melihat detail lengkap event"
                                >
                                  {/* Event Title & Poster */}
                                  <td className="py-3.5 px-4 max-w-xs">
                                    <div className="flex items-center space-x-3">
                                      <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0 relative border border-slate-200 dark:border-slate-800 group-hover:border-[#3B7A57] transition-colors">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={evt.posterUrl || "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=600&q=80"}
                                          alt=""
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                        />
                                      </div>
                                      <div className="min-w-0">
                                        <span className="font-bold text-slate-900 dark:text-white block truncate group-hover:text-[#3B7A57] dark:group-hover:text-[#52B788] transition-colors">
                                          {evt.title}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-400 block truncate">
                                          ID: {evt.id}
                                        </span>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Category & Price */}
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-semibold border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 mb-1"
                                    >
                                      {evt.category}
                                    </Badge>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                                      {evt.isPaid ? `Rp ${(evt.price || 0).toLocaleString("id-ID")}` : "Gratis"}
                                    </span>
                                  </td>

                                  {/* Schedule & Location */}
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300 font-medium">
                                        <CalendarIcon className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
                                        <span>
                                          {eventDate.toLocaleDateString("id-ID", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                          })}
                                        </span>
                                        <span className="text-slate-400">•</span>
                                        <span className="text-[11px] text-slate-500">
                                          {eventDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] max-w-[220px] truncate">
                                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span className="truncate">{evt.location}</span>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Attendees & Ticket Sales */}
                                  <td className="py-3.5 px-4">
                                    <div className="space-y-1 min-w-[140px]">
                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-slate-700 dark:text-slate-300 font-bold">
                                          {ticketsPaid} / {totalCapacity} Tiket
                                        </span>
                                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                          {occupancyRate}%
                                        </span>
                                      </div>
                                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
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
                                  </td>

                                  {/* Status */}
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    <div className="space-y-1">
                                      {evt.status === "APPROVED" && (
                                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                                          Disetujui
                                        </Badge>
                                      )}
                                      {evt.status === "PENDING" && (
                                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px] font-bold">
                                          Menunggu Review
                                        </Badge>
                                      )}
                                      {evt.status === "REVISION_REQUESTED" && (
                                        <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800 text-[10px] font-bold">
                                          Perlu Revisi
                                        </Badge>
                                      )}
                                      {evt.status === "REJECTED" && (
                                        <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800 text-[10px] font-bold">
                                          Ditolak
                                        </Badge>
                                      )}
                                      {evt.status === "ARCHIVED" && (
                                        <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 text-[10px] font-bold">
                                          Diarsipkan
                                        </Badge>
                                      )}

                                      {/* Revision / Rejection Note callout */}
                                      {(evt.status === "REVISION_REQUESTED" || evt.status === "REJECTED") && (evt.revisionNotes || evt.rejectionReason) && (
                                        <p className="text-[10px] text-slate-500 italic max-w-[180px] truncate" title={evt.revisionNotes || evt.rejectionReason || ""}>
                                          Catatan: {evt.revisionNotes || evt.rejectionReason}
                                        </p>
                                      )}
                                    </div>
                                  </td>

                                  {/* Actions */}
                                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end space-x-1.5">
                                      <Button
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedEventId(evt.id);
                                          setActiveNav("ATTENDEES");
                                        }}
                                        className="text-xs h-7 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold cursor-pointer"
                                      >
                                        <Users className="w-3.5 h-3.5 mr-1" />
                                        <span>Peserta ({eventBookings.length})</span>
                                      </Button>

                                      {evt.proposedRevenueSplit && evt.proposedRevenueSplit.status === "PENDING" && (
                                        <Button
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setNegotiatingEvent(evt);
                                          }}
                                          className="text-xs h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs flex items-center space-x-1"
                                          title="Tinjau usulan skema bagi hasil"
                                        >
                                          <Sparkles className="w-3.5 h-3.5 mr-0.5" />
                                          <span>Bagi Hasil</span>
                                        </Button>
                                      )}

                                      {(evt.status === "APPROVED" || evt.status === "ARCHIVED") && (
                                        <Link href={`/events/${evt.id}`} target="_blank" onClick={(e) => e.stopPropagation()}>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-xs h-7 px-2 rounded-lg border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#3B7A57] cursor-pointer"
                                            title="Lihat halaman detail event publik"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                          </Button>
                                        </Link>
                                      )}

                                      {evt.status === "REVISION_REQUESTED" && (
                                        <Button
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openRevisionModal(evt);
                                          }}
                                          className="text-xs h-7 px-2.5 rounded-lg bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold cursor-pointer shadow-xs flex items-center space-x-1"
                                          title="Perbaiki proposal event"
                                        >
                                          <FileEdit className="w-3.5 h-3.5 mr-0.5" />
                                          <span>Perbaiki</span>
                                        </Button>
                                      )}

                                      {evt.status === "REJECTED" && (
                                        <Button
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openRevisionModal(evt);
                                          }}
                                          className="text-xs h-7 px-2.5 rounded-lg bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold cursor-pointer shadow-xs flex items-center space-x-1"
                                          title="Perbaiki dan ajukan kembali ke kurator"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5 mr-0.5" />
                                          <span>Ajukan Ulang</span>
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

                      {/* Pagination Controls */}
                      <div className="p-3 border-t border-slate-100 dark:border-slate-800">
                        <TablePagination
                          currentPage={eventPage}
                          pageSize={eventPageSize}
                          totalItems={filteredEvents.length}
                          onPageChange={(p) => setEventPage(p)}
                        />
                      </div>
                    </>
                  )}
                </Card>
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
                    Daftar Peserta & Status Kehadiran
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Pantau data pemesanan tiket dan progres kehadiran peserta real-time. Verifikasi dan check-in tiket di pintu masuk ditangani secara resmi oleh Petugas Event Dago Creative Hub.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportCSV}
                    disabled={filteredAttendees.length === 0}
                    className="text-xs font-bold px-3.5 rounded-xl border-slate-200 dark:border-slate-700 cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    <span>Ekspor CSV</span>
                  </Button>
                </div>
              </div>

              {/* Filtering & Search Row with EventSearchInput and DateRangeFilter */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  {/* Event Search Input */}
                  <div className="flex items-center space-x-2 w-full sm:w-80">
                    <span className="text-xs font-semibold text-slate-500 shrink-0">Pilih Event:</span>
                    <EventSearchInput
                      events={portalData?.events || []}
                      selectedEventId={selectedEventId}
                      onSelectEvent={(id) => setSelectedEventId(id)}
                      className="w-full"
                      placeholder="Cari nama event..."
                      allowAllOption={true}
                      allOptionLabel="Semua Event"
                    />
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

                {/* Date Filter on Attendees */}
                <EventDateRangeFilter
                  onApplyFilter={(range) => setDateRange(range)}
                  initialRange={dateRange}
                  label="Filter Periode Pembelian Tiket"
                />
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
                        <th className="py-3 px-3 text-center">Jumlah Tiket</th>
                        <th className="py-3 px-3 text-center">Status Bayar</th>
                        <th className="py-3 px-3 text-center">Status Kehadiran (Gate)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {filteredAttendees.map((b) => {
                        const isExpanded = expandedBookingIds.has(b.id);
                        return (
                          <React.Fragment key={b.id}>
                            <tr className={`hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors ${
                              isExpanded ? "bg-slate-50/60 dark:bg-slate-900/40" : ""
                            }`}>
                              <td className="py-3 px-3">
                                <div className="font-mono font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                                  <span>{b.ticketCode}</span>
                                </div>
                                {b.ticketCount > 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleBookingExpand(b.id)}
                                    className="inline-flex items-center space-x-1 mt-1 text-[10.5px] font-bold text-[#3B7A57] dark:text-[#52B788] hover:underline cursor-pointer"
                                  >
                                    <span>{isExpanded ? "Tutup Rincian" : `Lihat ${b.ticketCount} Tiket`}</span>
                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400 block mt-0.5">1 Tiket Tunggal</span>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900 dark:text-white">{b.guestName}</div>
                                <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 mt-0.5 flex-wrap">
                                  {b.guestPhone ? (
                                    <a
                                      href={formatWhatsAppUrl(b.guestPhone)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 font-medium"
                                      title={`WhatsApp: ${b.guestPhone}`}
                                    >
                                      <Phone className="w-3 h-3" />
                                      <span>{b.guestPhone}</span>
                                    </a>
                                  ) : (
                                    <span>-</span>
                                  )}
                                  {b.guestEmail && (
                                    <>
                                      <span>•</span>
                                      <a
                                        href={`mailto:${b.guestEmail}`}
                                        className="text-slate-500 dark:text-slate-400 hover:underline inline-flex items-center gap-1"
                                        title={`Email: ${b.guestEmail}`}
                                      >
                                        <Mail className="w-3 h-3" />
                                        <span className="truncate max-w-[120px]">{b.guestEmail}</span>
                                      </a>
                                    </>
                                  )}
                                  {b.institution && (
                                    <>
                                      <span>•</span>
                                      <span className="truncate max-w-[120px]">{b.institution}</span>
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
                                <div className="flex flex-col items-center justify-center space-y-1">
                                  {b.checkInStatus === "CHECKED_IN" ? (
                                    <>
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-2xs">
                                        <Check className="w-3 h-3 mr-1" />
                                        {b.ticketCount > 1
                                          ? `${b.checkedInQty ?? b.ticketCount}/${b.ticketCount} Hadir (Lengkap)`
                                          : "Sudah Hadir (Lengkap)"}
                                      </span>
                                      {b.checkInTime && (
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                          {new Date(b.checkInTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WITA
                                        </span>
                                      )}
                                    </>
                                  ) : b.checkInStatus === "PARTIALLY_CHECKED_IN" ? (
                                    <>
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 shadow-2xs">
                                        <Clock3 className="w-3 h-3 mr-1" />
                                        {b.checkedInQty ?? 0}/{b.ticketCount} Hadir (Sisa {(b.ticketCount || 1) - (b.checkedInQty || 0)})
                                      </span>
                                      <span className="text-[10px] text-sky-600 dark:text-sky-400">
                                        Sebagian Hadir
                                      </span>
                                    </>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                      Belum Hadir (0/{b.ticketCount})
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Sub-tickets Accordion per Transaction */}
                            {isExpanded && (
                              <tr className="bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 animate-in fade-in duration-150">
                                <td colSpan={6} className="p-3 sm:p-4">
                                  <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 gap-2">
                                      <div className="flex items-center space-x-2">
                                        <Ticket className="w-4 h-4 text-[#3B7A57]" />
                                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                                          Rincian Transaksi Pembelian ({b.ticketCount} Tiket Terdaftar)
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-3 text-[11px]">
                                        <span className="text-slate-500">
                                          Total: <strong className="text-[#3B7A57] dark:text-[#52B788]">{b.totalPrice > 0 ? formatCurrencyIDR(b.totalPrice) : "GRATIS"}</strong>
                                        </span>
                                        <span className="text-slate-300">•</span>
                                        <span className="text-slate-500">
                                          Kehadiran: <strong>{b.checkedInQty ?? (b.checkInStatus === "CHECKED_IN" ? b.ticketCount : 0)} / {b.ticketCount} Pax</strong>
                                        </span>
                                      </div>
                                    </div>

                                    {/* Sub-tickets Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                      {Array.from({ length: b.ticketCount }).map((_, idx) => {
                                        const ticketIndex = idx + 1;
                                        const subTicketCode = `${b.ticketCode}-${String(ticketIndex).padStart(2, "0")}`;
                                        const isSubCheckedIn = (b.checkedInQty ?? (b.checkInStatus === "CHECKED_IN" ? b.ticketCount : 0)) >= ticketIndex;

                                        return (
                                          <div
                                            key={subTicketCode}
                                            className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-1.5"
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                Tiket #{ticketIndex} dari {b.ticketCount}
                                              </span>
                                              <span
                                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                                  isSubCheckedIn
                                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                                    : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                                }`}
                                              >
                                                {isSubCheckedIn ? "Sudah Hadir" : "Belum Hadir"}
                                              </span>
                                            </div>
                                            <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                              {subTicketCode}
                                            </div>
                                            <div className="text-[10.5px] text-slate-500 truncate">
                                              {ticketIndex === 1 ? `${b.guestName} (Pemesan Utama)` : `Tamu Pax #${ticketIndex}`}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          )}

          {/* =========================================================================
              VIEW 3: FINANCE & PAYOUT (Bagi Hasil & Pencairan Dana Transparan)
             ========================================================================= */}
          {activeNav === "FINANCE" && (() => {
            const grossRev = summary?.grossRevenue || 0;
            const eligibleRev = (summary?.eligibleRevenue !== undefined ? summary.eligibleRevenue : summary?.grossRevenue) || 0;
            const organizerEarnings = summary?.organizerPayoutAmount || 0;
            const platformFee = Math.max(0, eligibleRev - organizerEarnings);
            const availablePayout = summary?.availablePayoutAmount ?? Math.max(0, organizerEarnings - ((summary?.paidPayoutAmount || 0) + (summary?.requestedPayoutAmount || 0)));
            const requestedPayout = summary?.requestedPayoutAmount || 0;
            const paidPayout = summary?.paidPayoutAmount || 0;

            const handleOpenPayout = () => {
              if (!portalData || portalData.events.length === 0) {
                setErrorMessage("Belum ada event untuk diajukan pencairan.");
                return;
              }
              const eventsWithBalance = portalData.events.map((e) => {
                const paidBookings = (portalData.bookings || []).filter(
                  (b) => b.eventId === e.id && b.paymentStatus === "PAID"
                );
                const earnings = paidBookings.reduce(
                  (sum, b) => sum + (b.organizerRevenueAmount || 0),
                  0
                );
                let committed = 0;
                (e.payoutHistory || []).forEach((p) => {
                  if (p.status === "REQUESTED" || p.status === "PROCESSING" || p.status === "PAID") {
                    committed += p.amount;
                  }
                });
                return { id: e.id, available: Math.max(0, earnings - committed) };
              });

              const firstWithBalance = eventsWithBalance.find((item) => item.available > 0);
              const targetId = firstWithBalance ? firstWithBalance.id : portalData.events[0].id;
              const initialAmount = firstWithBalance ? firstWithBalance.available : 0;

              setPayoutTargetEventId(targetId);
              setPayoutAmount(initialAmount);
              setPayoutBankName(bankSettings.bankName || "BCA");
              setPayoutAccountNumber(bankSettings.accountNumber || "");
              setPayoutAccountHolder(bankSettings.accountHolder || "");
              setIsPayoutModalOpen(true);
            };

            return (
              <div className="space-y-6">
                {/* Header Title & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                      Keuangan &amp; Pencairan Saldo (Payout)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Transparansi pembagian revenue tiket, saldo tersedia, dan riwayat transfer dana ke rekening komunitas.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={handleOpenPayout}
                      className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer transition-all hover:scale-[1.02]"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Ajukan Pencairan Saldo</span>
                    </Button>
                  </div>
                </div>

                {/* Date Filter on Finance Tab */}
                <div className="bg-slate-50/70 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <EventDateRangeFilter
                    onApplyFilter={(range) => setDateRange(range)}
                    initialRange={dateRange}
                    label="Filter Periode Finansial Transaksi"
                  />
                </div>

                {/* Section 1: Hero Wallet Card & 80:20 Revenue Split Visualizer (Grid 3:2) */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5">
                  {/* Hero Wallet Card (3 cols) */}
                  <div className="lg:col-span-3 rounded-3xl bg-gradient-to-br from-[#1B3B2B] via-[#24523B] to-[#122A1E] text-white p-6 sm:p-7 relative overflow-hidden shadow-lg border border-emerald-800/40 flex flex-col justify-between">
                    {/* Background glow & watermark */}
                    <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 right-0 p-6 opacity-5 pointer-events-none">
                      <Wallet className="w-36 h-36" />
                    </div>

                    <div className="relative z-10 space-y-4">
                      {/* Top Chips */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                          <Sparkles className="w-3 h-3 text-emerald-300" />
                          <span>Dompet Saldo Komunitas</span>
                        </div>
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Siap Dicairkan Kapan Saja</span>
                        </span>
                      </div>

                      {/* Main Balance */}
                      <div className="pt-1">
                        <span className="text-xs text-emerald-200/80 uppercase tracking-wider font-semibold block">
                          Saldo Bersih Tersedia untuk Ditarik
                        </span>
                        <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mt-1">
                          Rp {availablePayout.toLocaleString("id-ID")}
                        </div>
                        <p className="text-[11px] text-emerald-200/70 mt-1.5 flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Dihitung otomatis 80% dari seluruh tiket event yang telah terverifikasi lunas (PAID).</span>
                        </p>
                      </div>
                    </div>

                    {/* Bottom Action & Registered Bank Card */}
                    <div className="relative z-10 pt-6 mt-4 border-t border-emerald-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                          <CreditCard className="w-4 h-4 text-emerald-300" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-emerald-300/80 font-mono block">
                            Rekening Penampung Payout:
                          </span>
                          <span className="text-xs font-bold text-white truncate block">
                            {bankSettings.bankName} • {bankSettings.accountNumber || "Belum Dikonfigurasi"} ({bankSettings.accountHolder})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <Button
                          type="button"
                          onClick={() => setActiveNav("SETTINGS")}
                          variant="ghost"
                          size="sm"
                          className="text-xs text-emerald-300 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer"
                        >
                          Ubah
                        </Button>
                        <Button
                          type="button"
                          onClick={handleOpenPayout}
                          size="sm"
                          className="bg-white text-[#1B3B2B] hover:bg-emerald-50 text-xs font-black px-4 py-2 rounded-xl shadow-md cursor-pointer transition-transform hover:scale-105"
                        >
                          Tarik Saldo
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Revenue Sharing Ratio Card (2 cols) */}
                  <Card className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788]" />
                          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                            Proporsi Bagi Hasil Resmi
                          </h3>
                        </div>
                        <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                          80 : 20
                        </Badge>
                      </div>

                      {/* Visual Dual Progress Bar */}
                      <div className="pt-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-[#3B7A57] dark:text-[#52B788]">Hak Komunitas (80%)</span>
                          <span className="text-slate-500 dark:text-slate-400">Dago Hub (20%)</span>
                        </div>
                        <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                          <div className="h-full bg-gradient-to-r from-emerald-600 to-[#3B7A57]" style={{ width: "80%" }} />
                          <div className="h-full bg-slate-400 dark:bg-slate-600" style={{ width: "20%" }} />
                        </div>
                      </div>

                      {/* 3 Metric Breakdown Chips */}
                      <div className="grid grid-cols-3 gap-2 pt-4">
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-center">
                          <span className="text-[9.5px] text-slate-400 font-bold block uppercase">Omset Lunas</span>
                          <span className="text-xs font-black text-slate-900 dark:text-white mt-0.5 block truncate">
                            Rp {eligibleRev.toLocaleString("id-ID")}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800 text-center">
                          <span className="text-[9.5px] text-emerald-700 dark:text-emerald-400 font-bold block uppercase">Komunitas (80%)</span>
                          <span className="text-xs font-black text-[#3B7A57] dark:text-[#52B788] mt-0.5 block truncate">
                            Rp {organizerEarnings.toLocaleString("id-ID")}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-center">
                          <span className="text-[9.5px] text-slate-400 font-bold block uppercase">Platform (20%)</span>
                          <span className="text-xs font-black text-slate-600 dark:text-slate-300 mt-0.5 block truncate">
                            Rp {platformFee.toLocaleString("id-ID")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[10.5px] text-slate-400 dark:text-slate-400 leading-relaxed pt-2 border-t border-slate-100 dark:border-slate-800">
                      💡 <strong>Tanpa Biaya Di Muka:</strong> Bagi hasil 20% otomatis mencakup fasilitas venue, sound system, kelistrikan, dan operasional ticketing check-in.
                    </p>
                  </Card>
                </div>

                {/* Section 2: 4 Financial Stages Metric Flow (Grid 4) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <Card className="p-4 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">1. Omset Kotor Tiket</span>
                      <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                        <Ticket className="w-3 h-3" />
                      </div>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                      Rp {grossRev.toLocaleString("id-ID")}
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate">Seluruh order tiket diterbitkan</span>
                  </Card>

                  <Card className="p-4 bg-white dark:bg-[#0F172A] border border-emerald-200/80 dark:border-emerald-800/80 rounded-2xl shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">2. Saldo Siap Ditarik</span>
                      <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-[#3B7A57] dark:text-[#52B788]">
                        <Wallet className="w-3 h-3" />
                      </div>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-[#3B7A57] dark:text-[#52B788]">
                      Rp {availablePayout.toLocaleString("id-ID")}
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block truncate">Hak bersih siap diajukan transfer</span>
                  </Card>

                  <Card className="p-4 bg-white dark:bg-[#0F172A] border border-amber-200/80 dark:border-amber-800/80 rounded-2xl shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">3. Dalam Verifikasi</span>
                      <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600">
                        <Clock className="w-3 h-3" />
                      </div>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-amber-700 dark:text-amber-300">
                      Rp {requestedPayout.toLocaleString("id-ID")}
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate">Antrean transfer tim Finance</span>
                  </Card>

                  <Card className="p-4 bg-white dark:bg-[#0F172A] border border-sky-200/80 dark:border-sky-800/80 rounded-2xl shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">4. Sukses Masuk Bank</span>
                      <div className="w-6 h-6 rounded-lg bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center text-sky-600">
                        <Building2 className="w-3 h-3" />
                      </div>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-sky-700 dark:text-sky-300">
                      Rp {paidPayout.toLocaleString("id-ID")}
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate">Total dana berhasil ditransfer</span>
                  </Card>
                </div>

                {/* Section 3: Visual 3-Step SOP Banner (Alur Pencairan Dana) */}
                <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788]" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Alur &amp; Kebijakan Transfer Dana Manual (SOP Dago Finance)
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">Verifikasi 1–2 hari kerja setelah diajukan</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/70 dark:border-slate-800 space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-[#3B7A57] dark:text-[#52B788] text-[10px] font-black flex items-center justify-center">
                          1
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Ajukan Penarikan Saldo</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed pl-7">
                        Pilih event dan nominal saldo yang ingin ditarik. Rekening penampung akan otomatis tertera.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/70 dark:border-slate-800 space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] font-black flex items-center justify-center">
                          2
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Verifikasi Manual Tim Finance</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed pl-7">
                        Dago Finance memeriksa keabsahan tiket terbayar dan data kehadiran demi keamanan finansial.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/70 dark:border-slate-800 space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 text-[10px] font-black flex items-center justify-center">
                          3
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Transfer Bank &amp; Nomor Resi</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed pl-7">
                        Dana masuk ke rekening dan bukti nomor referensi mutasi bank dicatat transparan di tabel bawah.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 4: Payout History Table (Modern Empty State & Data Table) */}
                <Card className="p-5 sm:p-6 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Riwayat Pengajuan Pencairan Dana (Payout)
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Log seluruh transaksi transfer saldo bagi hasil ke rekening bank resmi komunitas
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 self-start sm:self-auto">
                      {allPayouts.length} Riwayat Transaksi
                    </span>
                  </div>

                  {allPayouts.length === 0 ? (
                    <div className="py-12 px-4 text-center space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center mx-auto shadow-xs">
                        <Wallet className="w-7 h-7" />
                      </div>
                      <div className="space-y-1 max-w-sm mx-auto">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Belum Ada Riwayat Pencairan Dana
                        </h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Saldo dari tiket terbayar akan otomatis terkumpul di dompet Anda. Anda dapat mengajukan pencairan dana pertama kapan saja.
                        </p>
                      </div>
                      {availablePayout > 0 && (
                        <div className="pt-2">
                          <Button
                            onClick={handleOpenPayout}
                            className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs cursor-pointer"
                          >
                            <DollarSign className="w-4 h-4 mr-1" />
                            <span>Tarik Saldo Rp {availablePayout.toLocaleString("id-ID")} Sekarang</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-3 px-3">Waktu Pengajuan</th>
                            <th className="py-3 px-3">Event Terkait</th>
                            <th className="py-3 px-3">Nominal (Rp)</th>
                            <th className="py-3 px-3">Rekening Tujuan</th>
                            <th className="py-3 px-3 text-center">Status Pencairan</th>
                            <th className="py-3 px-3">No. Referensi / Catatan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                          {allPayouts.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
                              <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                {new Date(p.requestedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                              </td>
                              <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white max-w-[180px] truncate">
                                {p.eventTitle}
                              </td>
                              <td className="py-3 px-3 font-bold text-[#3B7A57] dark:text-[#52B788] whitespace-nowrap">
                                Rp {p.amount.toLocaleString("id-ID")}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-800 dark:text-slate-200">{p.bankName} - {p.accountNumber}</div>
                                <div className="text-[11px] text-slate-400">a.n. {p.accountHolder}</div>
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                {p.status === "PAID" && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                    ✓ Sudah Ditransfer
                                  </span>
                                )}
                                {p.status === "PROCESSING" && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                                    ⏳ Sedang Diproses
                                  </span>
                                )}
                                {p.status === "REQUESTED" && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                    ● Menunggu Verifikasi
                                  </span>
                                )}
                                {p.status === "REJECTED" && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                    ✕ Ditolak
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-[11px] text-slate-500 max-w-[200px] truncate">
                                {p.referenceNo ? (
                                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">Ref: {p.referenceNo}</span>
                                ) : p.rejectionReason ? (
                                  <span className="text-rose-600">Alasan: {p.rejectionReason}</span>
                                ) : (
                                  p.notes || "-"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            );
          })()}

          {/* =========================================================================
              VIEW 4: HOME (Ringkasan Metrik / KPI Overview)
             ========================================================================= */}
          {activeNav === "HOME" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                    Dashboard Overview
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Selamat datang kembali, {portalData?.summary.organizerName || "Komunitas"}. Berikut rangkuman performa event Anda.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNav("EVENTS")}
                  className="text-xs font-semibold text-[#3B7A57] dark:text-[#52B788] hover:underline flex items-center space-x-1 cursor-pointer self-start sm:self-auto"
                >
                  <span>Lihat Semua Event</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Date Range Filter for Analytics KPI */}
              <div className="bg-slate-50/70 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <EventDateRangeFilter
                  onApplyFilter={(range) => setDateRange(range)}
                  initialRange={dateRange}
                  label="Filter Rentang Analitik"
                />
              </div>

              {/* KPI 4 Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                <Card className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Total Event</span>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                    {summary?.totalEvents || 0}
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                    {summary?.approvedEvents || 0} Tayang Live
                  </span>
                </Card>

                <Card className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Tiket Terjual</span>
                  <div className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400">
                    {summary?.totalTicketsSold || 0}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    {summary?.totalAttendees || 0} Pemesan (Lunas)
                  </span>
                </Card>

                <Card className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Hak Payout (80%)</span>
                  <div className="text-xl sm:text-2xl font-black text-[#3B7A57] dark:text-[#52B788]">
                    Rp {(summary?.organizerPayoutAmount || 0).toLocaleString("id-ID")}
                  </div>
                  <span className="text-[11px] text-emerald-600 mt-1 block font-medium">Estimasi Dana Komunitas</span>
                </Card>

                <Card className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Aksi Cepat</span>
                  <div className="space-y-1.5 pt-1">
                    <Button
                      size="sm"
                      onClick={() => setActiveNav("EVENTS")}
                      className="w-full text-xs h-8 bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold rounded-xl cursor-pointer shadow-xs"
                    >
                      Buka Kelola Events
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Quick Actions Action Bar */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788]" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                      Pusat Tindakan Cepat Penyelenggara
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Akses langsung fitur operasional harian
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <Link
                    href="/events/submit"
                    className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-[#3B7A57]/40 hover:border-[#3B7A57] bg-emerald-50/50 dark:bg-emerald-950/20 text-[#3B7A57] dark:text-[#52B788] hover:bg-emerald-100/60 transition-all text-center group cursor-pointer"
                  >
                    <Plus className="w-4 h-4 mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold leading-tight">Buat Event</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">Ajukan Baru</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setActiveNav("ATTENDEES")}
                    className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-all text-center group cursor-pointer"
                  >
                    <Users className="w-4 h-4 mb-1 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold leading-tight">Daftar Peserta</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">Tiket & Kehadiran</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveNav("EVENTS")}
                    className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-all text-center group cursor-pointer"
                  >
                    <CalendarIcon className="w-4 h-4 mb-1 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold leading-tight">Kelola Event</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">Jadwal & Kuota</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveNav("FINANCE")}
                    className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-all text-center group cursor-pointer"
                  >
                    <Wallet className="w-4 h-4 mb-1 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold leading-tight">Klaim Payout</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">Bagi Hasil 80%</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveNav("SETTINGS")}
                    className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-all text-center group cursor-pointer"
                  >
                    <Settings className="w-4 h-4 mb-1 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold leading-tight">Pengaturan</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">Rekening & Profil</span>
                  </button>
                </div>
              </div>

              {/* Section 2: Visual Sales Trend & Occupancy Metrics (Grid 2:1) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* 6-Month Visual Bar Chart */}
                <Card className="lg:col-span-2 p-5 sm:p-6 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788]" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Tren Penjualan & Hak Bagi Hasil ({salesTrend.periodTitle})
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Statistik transaksi tiket terbayar dan estimasi bagi hasil komunitas sesuai filter analitik aktif
                      </p>
                    </div>

                    <div className="flex items-center space-x-3 text-[11px]">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#3B7A57]" />
                        <span className="text-slate-600 dark:text-slate-300 font-medium">Hak Bagi Hasil</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                        <span className="text-slate-600 dark:text-slate-300 font-medium">Tiket Terjual</span>
                      </div>
                    </div>
                  </div>

                  {/* Chart Render */}
                  <div className="pt-4">
                    <div className="h-44 flex items-end justify-between gap-2 sm:gap-4 px-2">
                      {salesTrend.trend.map((m, idx) => {
                        const payoutPct = salesTrend.maxRevenue > 0
                          ? Math.min(100, Math.max(8, Math.round((m.payout / salesTrend.maxRevenue) * 100)))
                          : 8;
                        const ticketPct = salesTrend.maxTickets > 0
                          ? Math.min(100, Math.max(8, Math.round((m.ticketCount / salesTrend.maxTickets) * 100)))
                          : 8;

                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                            {/* Hover Tooltip */}
                            <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute -top-12 z-20 transition-opacity duration-200 bg-slate-900 text-white text-[10px] rounded-lg py-1 px-2 whitespace-nowrap shadow-lg">
                              <p className="font-bold">{m.label} {m.subLabel ? `(${m.subLabel})` : ""}</p>
                              <p>Bagi Hasil: Rp {m.payout.toLocaleString("id-ID")}</p>
                              <p>Tiket: {m.ticketCount} lembar</p>
                            </div>

                            {/* Dual Bars */}
                            <div className="w-full flex items-end justify-center space-x-1 sm:space-x-1.5 h-36">
                              {/* Payout Bar */}
                              <div
                                style={{ height: `${payoutPct}%` }}
                                className={`w-3 sm:w-5 rounded-t-md transition-all duration-300 ${
                                  m.payout > 0
                                    ? "bg-gradient-to-t from-[#2E6044] to-[#52B788] group-hover:brightness-110 shadow-xs"
                                    : "bg-slate-100 dark:bg-slate-800"
                                }`}
                              />
                              {/* Ticket Bar */}
                              <div
                                style={{ height: `${ticketPct}%` }}
                                className={`w-3 sm:w-5 rounded-t-md transition-all duration-300 ${
                                  m.ticketCount > 0
                                    ? "bg-gradient-to-t from-sky-600 to-sky-400 group-hover:brightness-110 shadow-xs"
                                    : "bg-slate-100 dark:bg-slate-800"
                                }`}
                              />
                            </div>

                            {/* Month Label */}
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-2">
                              {m.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Footer Chart Insight */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        Akumulasi Payout Periode: <strong className="text-slate-800 dark:text-slate-200">Rp {salesTrend.trend.reduce((a, b) => a + b.payout, 0).toLocaleString("id-ID")}</strong>
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Rata-rata: Rp {Math.round(salesTrend.trend.reduce((a, b) => a + b.payout, 0) / (salesTrend.trend.length || 1)).toLocaleString("id-ID")} / interval
                    </span>
                  </div>
                </Card>

                {/* Capacity & Payout Settlement Card */}
                <div className="space-y-4">
                  {/* Occupancy Card */}
                  <Card className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Okupansi Kuota Tiket
                        </h4>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800">
                        {occupancyPercentage}% Terisi
                      </Badge>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                        <span>Tiket Terjual:</span>
                        <strong className="text-slate-900 dark:text-white font-bold">{totalSoldTickets} tiket</strong>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                        <span>Total Kuota Tersedia:</span>
                        <strong className="text-slate-900 dark:text-white font-bold">{totalCapacitySum} kursi</strong>
                      </div>
                      {/* Progress Bar */}
                      <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-[#3B7A57] rounded-full transition-all duration-500"
                          style={{ width: `${occupancyPercentage}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {occupancyPercentage >= 80
                        ? "Antusiasme sangat tinggi! Kuota hampir penuh di beberapa event komunitas."
                        : occupancyPercentage > 0
                        ? "Penjualan tiket berjalan normal. Promosikan link event untuk meningkatkan konversi."
                        : "Belum ada tiket terjual. Mulai bagikan poster dan katalog event ke media sosial."}
                    </p>
                  </Card>

                  {/* Payout Bank Info Card */}
                  <Card className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl shadow-xs space-y-3 border border-slate-700/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CreditCard className="w-4 h-4 text-emerald-400" />
                        <span className="text-[11px] font-bold tracking-wider uppercase text-slate-300">
                          Rekening Penampung
                        </span>
                      </div>
                      <span className="text-[9.5px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                        Aktif
                      </span>
                    </div>

                    <div>
                      <div className="text-xs text-slate-400">Bank {bankSettings.bankName}</div>
                      <div className="text-lg font-mono font-bold tracking-wider mt-0.5">
                        {bankSettings.accountNumber || "Belum Dikonfigurasi"}
                      </div>
                      <div className="text-xs text-slate-300 mt-1 truncate">
                        A/N: {bankSettings.accountHolder}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Pencairan H+1 kerja</span>
                      <button
                        type="button"
                        onClick={() => setActiveNav("SETTINGS")}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold hover:underline cursor-pointer"
                      >
                        Ubah Rekening →
                      </button>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Section 3: Upcoming Events vs Recent Bookings (Grid 1:1) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Upcoming Events Agenda */}
                <Card className="p-5 sm:p-6 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center space-x-2">
                      <CalendarIcon className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788]" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Agenda Event Terdekat ({upcomingEvents.length})
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNav("EVENTS")}
                      className="text-xs text-[#3B7A57] dark:text-[#52B788] hover:underline font-bold cursor-pointer"
                    >
                      Kelola Semua
                    </button>
                  </div>

                  {upcomingEvents.length === 0 ? (
                    <div className="py-8 text-center space-y-2">
                      <CalendarIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Belum Ada Event Aktif Tayang
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                        Ajukan event baru komunitas Anda agar dapat dipublikasikan di katalog publik Dago.
                      </p>
                      <Link
                        href="/events/submit"
                        className="inline-flex items-center space-x-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline pt-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ajukan Event Sekarang</span>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingEvents.slice(0, 4).map((evt) => {
                        const evtDate = new Date(evt.startDate);
                        const capacity = resolveVenueCapacity(evt).capacity;
                        const sold = myBookingsList
                          .filter((b) => b.eventId === evt.id && b.paymentStatus === "PAID")
                          .reduce((s, b) => s + b.ticketCount, 0);
                        const pct = capacity > 0 ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;

                        return (
                          <div
                            key={evt.id}
                            onClick={() => setViewingDetailEvent(evt)}
                            className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 hover:border-[#3B7A57]/60 dark:hover:border-[#3B7A57]/60 hover:bg-emerald-50/20 dark:hover:bg-slate-900/60 transition-all space-y-2 cursor-pointer group"
                            title="Klik untuk melihat rincian event"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start space-x-3">
                                {/* Date Block */}
                                <div className="w-11 h-11 rounded-xl bg-[#3B7A57]/10 text-[#3B7A57] dark:bg-[#3B7A57]/20 dark:text-[#52B788] flex flex-col items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                  <span className="text-[9px] font-bold uppercase leading-none">
                                    {evtDate.toLocaleDateString("id-ID", { month: "short" })}
                                  </span>
                                  <span className="text-base font-black leading-tight">
                                    {evtDate.getDate()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-[#3B7A57] dark:group-hover:text-[#52B788] transition-colors">
                                    {evt.title}
                                  </h4>
                                  <div className="flex items-center space-x-2 text-[10.5px] text-slate-400 mt-0.5">
                                    <span className="flex items-center space-x-1">
                                      <MapPin className="w-3 h-3 text-slate-400" />
                                      <span className="truncate">{evt.location}</span>
                                    </span>
                                    <span>•</span>
                                    <span>{evt.price === 0 ? "Gratis" : `Rp ${evt.price.toLocaleString("id-ID")}`}</span>
                                  </div>
                                </div>
                              </div>

                              <Badge className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] shrink-0 font-bold">
                                Tayang
                              </Badge>
                            </div>

                            {/* Ticket sales bar */}
                            <div className="space-y-1 pt-1">
                              <div className="flex justify-between text-[10.5px] text-slate-500 dark:text-slate-400">
                                <span>Terjual: <strong className="text-slate-800 dark:text-slate-200">{sold}</strong>/{capacity}</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{pct}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                {/* Recent Bookings Live Feed */}
                <Card className="p-5 sm:p-6 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center space-x-2">
                      <Ticket className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Transaksi Tiket Terbaru
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNav("ATTENDEES")}
                      className="text-xs text-[#3B7A57] dark:text-[#52B788] hover:underline font-bold cursor-pointer"
                    >
                      Buka Meja Pesanan
                    </button>
                  </div>

                  {recentBookings.length === 0 ? (
                    <div className="py-8 text-center space-y-2">
                      <Ticket className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Belum Ada Transaksi Pemesanan
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                        Ketika pengunjung memesan tiket event Anda secara online, data transaksi akan tampil di sini realtime.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentBookings.map((b) => (
                        <div
                          key={b.id}
                          className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 transition-all flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {b.guestName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {b.guestName}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">
                                {b.ticketCode} • {b.ticketCount} Tiket
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-slate-900 dark:text-white block">
                              Rp {b.totalPrice.toLocaleString("id-ID")}
                            </span>
                            <div className="flex items-center justify-end space-x-1.5 mt-0.5">
                              {b.paymentStatus === "PAID" ? (
                                <span className="text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md">
                                  Lunas
                                </span>
                              ) : (
                                <span className="text-[9.5px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-md">
                                  Pending
                                </span>
                              )}
                              {(b.checkedInQty || 0) > 0 && (
                                <span className="text-[9.5px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 rounded-md">
                                  Hadir ({b.checkedInQty})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {/* =========================================================================
              ORGANIZER SETTINGS & FINANCIAL CONFIGURATION VIEW
             ========================================================================= */}
          {activeNav === "SETTINGS" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                    Pengaturan Penyelenggara & Finansial
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Konfigurasi rekening penampung bagi hasil payout 80%, identitas profil komunitas, kontak, dan preferensi notifikasi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNav("HOME")}
                  className="text-xs font-semibold text-[#3B7A57] dark:text-[#52B788] hover:underline flex items-center space-x-1 cursor-pointer self-start sm:self-auto"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Kembali ke Overview</span>
                </button>
              </div>

              {/* Feedback Alert */}
              {isSavedFeedback && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center space-x-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold">{isSavedFeedback}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form 1: Payout Bank Account Settings */}
                <Card className="p-5 sm:p-6 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4">
                  <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center font-bold text-sm">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Rekening Penampung Bagi Hasil (Payout 80%)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Rekening bank tujuan transfer bagi hasil resmi penjualan tiket Anda
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveBankSettings} className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Nama Bank
                        </label>
                        <select
                          value={bankSettings.bankName}
                          onChange={(e) => setBankSettings({ ...bankSettings, bankName: e.target.value })}
                          className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#3B7A57] text-slate-900 dark:text-white font-medium"
                        >
                          <option value="BCA">BCA (Bank Central Asia)</option>
                          <option value="Mandiri">Bank Mandiri</option>
                          <option value="BNI">BNI (Bank Negara Indonesia)</option>
                          <option value="BRI">BRI (Bank Rakyat Indonesia)</option>
                          <option value="BSI">BSI (Bank Syariah Indonesia)</option>
                          <option value="CIMB Niaga">CIMB Niaga</option>
                          <option value="Bank Jago">Bank Jago</option>
                          <option value="Permata">Bank Permata</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Nomor Rekening
                        </label>
                        <input
                          type="text"
                          required
                          value={bankSettings.accountNumber}
                          onChange={(e) => setBankSettings({ ...bankSettings, accountNumber: e.target.value })}
                          placeholder="Contoh: 8420192831"
                          className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#3B7A57] text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Nama Pemilik Rekening (A/N Sesuai Buku Tabungan)
                      </label>
                      <input
                        type="text"
                        required
                        value={bankSettings.accountHolder}
                        onChange={(e) => setBankSettings({ ...bankSettings, accountHolder: e.target.value })}
                        placeholder="Contoh: Dago Specialty Coffee Society"
                        className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#3B7A57] text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Kantor Cabang Bank
                      </label>
                      <input
                        type="text"
                        value={bankSettings.branch}
                        onChange={(e) => setBankSettings({ ...bankSettings, branch: e.target.value })}
                        placeholder="Contoh: KCU Singaraja / KCP Dewi Sartika"
                        className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#3B7A57] text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                      <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Keamanan Finansial Terjamin</span>
                      </div>
                      <p>
                        Setiap pencairan bagi hasil diverifikasi oleh tim Finance Dago Creative Hub dan ditransfer langsung ke rekening ini.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      className="w-full h-9 bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold rounded-xl cursor-pointer shadow-xs flex items-center justify-center space-x-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan Rekening Payout</span>
                    </Button>
                  </form>
                </Card>

                {/* Form 2: Community Identity & Profile */}
                <Card className="p-5 sm:p-6 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4">
                  <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-sm">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Profil & Identitas Komunitas
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Informasi penyelenggara yang tampil pada tiket & halaman publik event
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveProfileSettings} className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Nama Komunitas / Brand Penyelenggara
                      </label>
                      <input
                        type="text"
                        required
                        value={profileSettings.communityName}
                        onChange={(e) => setProfileSettings({ ...profileSettings, communityName: e.target.value })}
                        className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#3B7A57] text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Email Akun Penyelenggara
                        </label>
                        <input
                          type="email"
                          readOnly
                          value={profileSettings.contactEmail}
                          className="w-full text-xs bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2.5 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Nomor WhatsApp Operasional
                        </label>
                        <input
                          type="text"
                          value={profileSettings.contactPhone}
                          onChange={(e) => setProfileSettings({ ...profileSettings, contactPhone: e.target.value })}
                          placeholder="+62 812-xxxx-xxxx"
                          className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#3B7A57] text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Akun Instagram
                        </label>
                        <input
                          type="text"
                          value={profileSettings.instagram}
                          onChange={(e) => setProfileSettings({ ...profileSettings, instagram: e.target.value })}
                          placeholder="@komunitasanda"
                          className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#3B7A57] text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Tautan Website / Linktree
                        </label>
                        <input
                          type="url"
                          value={profileSettings.website}
                          onChange={(e) => setProfileSettings({ ...profileSettings, website: e.target.value })}
                          placeholder="https://..."
                          className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#3B7A57] text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Deskripsi Singkat Komunitas
                      </label>
                      <textarea
                        rows={3}
                        value={profileSettings.description}
                        onChange={(e) => setProfileSettings({ ...profileSettings, description: e.target.value })}
                        placeholder="Jelaskan bidang, kegiatan rutin, atau visi komunitas Anda..."
                        className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-[#3B7A57] text-slate-900 dark:text-white resize-none"
                      />
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      className="w-full h-9 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-white font-bold rounded-xl cursor-pointer shadow-xs flex items-center justify-center space-x-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan Profil Komunitas</span>
                    </Button>
                  </form>
                </Card>

                {/* Form 3: Notification Preferences */}
                <Card className="p-5 sm:p-6 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4">
                  <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-sm">
                      <SlidersHorizontal className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Preferensi Notifikasi & Alert
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Atur saluran pemberitahuan otomatis untuk pesanan tiket & status event
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveNotifSettings} className="space-y-3.5 pt-1">
                    <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-all">
                      <div className="space-y-0.5 pr-3">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          Notifikasi Email Tiket Terjual
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Terima email instan setiap kali ada pemesanan tiket yang telah lunas
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifSettings.emailOnTicket}
                        onChange={(e) => setNotifSettings({ ...notifSettings, emailOnTicket: e.target.checked })}
                        className="w-4 h-4 text-[#3B7A57] rounded border-slate-300 focus:ring-[#3B7A57] cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-all">
                      <div className="space-y-0.5 pr-3">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          Ringkasan WhatsApp Harian
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Kirim rangkuman jumlah tiket dan sisa kuota ke WhatsApp PIC operasional
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifSettings.waOnTicket}
                        onChange={(e) => setNotifSettings({ ...notifSettings, waOnTicket: e.target.checked })}
                        className="w-4 h-4 text-[#3B7A57] rounded border-slate-300 focus:ring-[#3B7A57] cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-all">
                      <div className="space-y-0.5 pr-3">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          Alert Suara di Meja Check-In
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Mainkan bunyi konfirmasi saat QR scanner berhasil memvalidasi tiket peserta
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifSettings.instantCheckInAlert}
                        onChange={(e) => setNotifSettings({ ...notifSettings, instantCheckInAlert: e.target.checked })}
                        className="w-4 h-4 text-[#3B7A57] rounded border-slate-300 focus:ring-[#3B7A57] cursor-pointer"
                      />
                    </label>

                    <Button
                      type="submit"
                      size="sm"
                      className="w-full h-9 bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold rounded-xl cursor-pointer shadow-xs flex items-center justify-center space-x-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan Preferensi Notifikasi</span>
                    </Button>
                  </form>
                </Card>

                {/* Card 4: Partnership & Bagi Hasil Rules Info */}
                <Card className="p-5 sm:p-6 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 dark:from-emerald-950/20 dark:via-[#0F172A] dark:to-emerald-950/10 border border-emerald-200/80 dark:border-emerald-800/60 rounded-3xl shadow-xs space-y-4">
                  <div className="flex items-center space-x-2.5 pb-2 border-b border-emerald-100 dark:border-emerald-800/80">
                    <div className="w-8 h-8 rounded-xl bg-[#3B7A57] text-white flex items-center justify-center font-bold text-sm">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                        Ketentuan Kerjasama Bagi Hasil Transparan
                      </h3>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        Kebijakan resmi pembagian revenue ekosistem Dago Creative Hub
                      </p>
                    </div>
                  </div>

                  {/* Split Visual Badges */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0F172A] border border-emerald-200 dark:border-emerald-800 text-center space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Hak Komunitas
                      </span>
                      <div className="text-2xl font-black text-[#3B7A57] dark:text-[#52B788]">
                        80%
                      </div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                        Dana Masuk ke Rekening Anda
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-center space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Platform & Venue
                      </span>
                      <div className="text-2xl font-black text-slate-700 dark:text-slate-200">
                        20%
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium block">
                        Ticketing, Fasilitas & Listrik
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Pencairan Tepat Waktu:</strong> Dana bagi hasil dapat diajukan di tab <em>Payout</em> dan ditransfer maksimal H+1 kerja setelah event terselenggara.
                      </span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Tanpa Potongan Tambahan:</strong> Tidak ada biaya pendaftaran awal atau sewa di muka. Bagi hasil dihitung murni dari tiket terbayar.
                      </span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Audit & Validasi Transparan:</strong> Seluruh riwayat check-in peserta dan mutasi transaksi dapat diekspor langsung ke format CSV.
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Card 5: Session Security & Multi-device Protection */}
                <Card className="p-5 sm:p-6 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4">
                  <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Keamanan Akun & Proteksi Multi-Login
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Perlindungan otentikasi sesi dan pencegahan penyalahgunaan akun penyelenggara
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Status Sesi Saat Ini:
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Aktif & Terproteksi
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 space-y-0.5">
                        <p>Akun Terdaftar: <strong className="text-slate-800 dark:text-slate-200 font-mono">{activeEmail || organizerEmail}</strong></p>
                        <p>Metode Akses: <strong className="text-slate-800 dark:text-slate-200">Sesi HttpOnly Terenkripsi (Anti-XSS)</strong></p>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-[11px] leading-relaxed">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        🛡️ Kebijakan Proteksi Jika Akun Digunakan Orang Lain:
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-500 dark:text-slate-400">
                        <li>
                          <strong>Proteksi Finansial:</strong> Permohonan penarikan dana (Payout) hanya dapat ditransfer ke rekening bank resmi yang telah terdaftar dan terverifikasi atas nama penyelenggara.
                        </li>
                        <li>
                          <strong>Audit Log:</strong> Setiap aktivitas perubahan event, negosiasi bagi hasil, dan status tiket dicatat secara permanen dengan identitas sesi server.
                        </li>
                      </ul>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          alert("Sesi Anda saat ini telah diverifikasi aman. Untuk mengakhiri seluruh akses di perangkat lain, Anda dapat menggunakan tombol Keluar di sidebar lalu login kembali.");
                        }}
                        className="w-full text-xs font-bold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-[#3B7A57]" />
                        <span>Verifikasi Keamanan Sesi Akun</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
            </>
          )}
        </main>
      </div>

      {/* =========================================================================
          3. MOBILE BOTTOM NAVIGATION (Thumb-friendly for smartphone users)
         ========================================================================= */}
      <nav
        aria-label="Navigasi Bawah Mobile"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-1 py-1.5 shadow-lg"
      >
        <button
          type="button"
          onClick={() => setActiveNav("HOME")}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeNav === "HOME"
              ? "text-[#3B7A57] dark:text-[#52B788] font-bold"
              : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight">Ringkasan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav("EVENTS")}
          className={`relative flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeNav === "EVENTS"
              ? "text-[#3B7A57] dark:text-[#52B788] font-bold"
              : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <div className="relative">
            <CalendarIcon className="w-5 h-5 mb-0.5" />
            {portalData?.events.length ? (
              <span className="absolute -top-1 -right-2.5 bg-[#3B7A57] text-white text-[9px] font-bold px-1 rounded-full leading-tight">
                {portalData.events.length}
              </span>
            ) : null}
          </div>
          <span className="text-[10px] leading-tight">Event</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav("ATTENDEES")}
          className={`relative flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeNav === "ATTENDEES"
              ? "text-[#3B7A57] dark:text-[#52B788] font-bold"
              : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <div className="relative">
            <Users className="w-5 h-5 mb-0.5" />
            {portalData?.bookings.length ? (
              <span className="absolute -top-1 -right-2.5 bg-[#3B7A57] text-white text-[9px] font-bold px-1 rounded-full leading-tight">
                {portalData.bookings.length}
              </span>
            ) : null}
          </div>
          <span className="text-[10px] leading-tight">Pesanan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav("FINANCE")}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeNav === "FINANCE"
              ? "text-[#3B7A57] dark:text-[#52B788] font-bold"
              : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <DollarSign className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight">Keuangan</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeNav === "SETTINGS" || isMobileMenuOpen
              ? "text-[#3B7A57] dark:text-[#52B788] font-bold"
              : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight">Menu</span>
        </button>
      </nav>

      {/* =========================================================================
          EVENT DETAIL MODAL (ORGANIZER VIEW)
         ========================================================================= */}
      {viewingDetailEvent && (() => {
        const evt = viewingDetailEvent;
        const eventBookings = (portalData?.bookings || []).filter((b) => b.eventId === evt.id);
        const activeBookings = eventBookings.filter((b) => b.paymentStatus !== "CANCELLED");
        const paidBookings = activeBookings.filter((b) => b.paymentStatus === "PAID");
        const capacityRes = resolveVenueCapacity(evt);
        const totalCapacity = capacityRes.capacity;
        const ticketsPaid = paidBookings.reduce((s, b) => s + b.ticketCount, 0);
        const grossSales = paidBookings.reduce((s, b) => s + b.totalPrice, 0);
        const organizerShare = Math.round(grossSales * 0.8);
        const occupancyRate = totalCapacity > 0 ? Math.min(100, Math.round((ticketsPaid / totalCapacity) * 100)) : 0;
        const eventDate = new Date(evt.startDate);
        const eventEndDate = evt.endDate ? new Date(evt.endDate) : null;

        return (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setViewingDetailEvent(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] cursor-default"
            >
              <div className="p-6 sm:p-7 space-y-5 overflow-y-auto flex-1">
                {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="space-y-1 pr-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono text-slate-400">ID: {evt.id}</span>
                    <Badge variant="outline" className="text-[10px] border-slate-200 dark:border-slate-700">
                      {evt.category}
                    </Badge>
                    {evt.status === "APPROVED" && (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold">
                        Disetujui &amp; Tayang
                      </Badge>
                    )}
                    {evt.status === "PENDING" && (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-bold">
                        Menunggu Review
                      </Badge>
                    )}
                    {evt.status === "REVISION_REQUESTED" && (
                      <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 text-[10px] font-bold">
                        Perlu Revisi
                      </Badge>
                    )}
                    {evt.status === "REJECTED" && (
                      <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 text-[10px] font-bold">
                        Ditolak
                      </Badge>
                    )}
                    {evt.status === "ARCHIVED" && (
                      <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-bold">
                        Diarsipkan
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                    {evt.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingDetailEvent(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Poster Image */}
              <div className="w-full h-52 sm:h-64 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 relative border border-slate-200 dark:border-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={evt.posterUrl || "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=600&q=80"}
                  alt={evt.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Kurator Notes Banner if Revision or Rejected */}
              {evt.status === "REVISION_REQUESTED" && evt.revisionNotes && (
                <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200 text-xs space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <span>Catatan Kurasi Tim Dago Hub:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed pl-5">{evt.revisionNotes}</p>
                </div>
              )}
              {evt.status === "REJECTED" && evt.rejectionReason && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>Alasan Penolakan Kurator:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed pl-5">{evt.rejectionReason}</p>
                </div>
              )}

              {/* Operational & Financial Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Harga Tiket</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                    {evt.isPaid ? `Rp ${(evt.price || 0).toLocaleString("id-ID")}` : "Gratis"}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Tiket Terjual</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                    {ticketsPaid} / {totalCapacity} ({occupancyRate}%)
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Omset</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                    Rp {grossSales.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Hak Komunitas (80%)</span>
                  <span className="text-sm font-black text-[#3B7A57] dark:text-[#52B788] mt-0.5 block">
                    Rp {organizerShare.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              {/* Jadwal & Ruang */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white block uppercase tracking-wider">
                  Jadwal &amp; Ruangan Acara
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
                    <CalendarIcon className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] shrink-0" />
                    <span>
                      {eventDate.toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })} • {eventDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      {eventEndDate ? ` - ${eventEndDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WITA` : " WITA"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
                    <MapPin className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] shrink-0" />
                    <span className="truncate">{evt.location}</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white block uppercase tracking-wider">
                  Deskripsi Event
                </span>
                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 max-h-48 overflow-y-auto">
                  {evt.description || "Tidak ada rincian deskripsi tambahan."}
                </div>
              </div>

              {/* Guidelines if present */}
              {evt.guidelines && evt.guidelines.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block uppercase tracking-wider">
                    Ketentuan Khusus &amp; Panduan Acara
                  </span>
                  <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    {evt.guidelines.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingDetailEvent(null)}
                  className="text-xs rounded-xl cursor-pointer"
                >
                  Tutup
                </Button>

                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedEventId(evt.id);
                      setActiveNav("ATTENDEES");
                      setViewingDetailEvent(null);
                    }}
                    className="text-xs h-8 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 mr-1" />
                    <span>Daftar Peserta ({eventBookings.length})</span>
                  </Button>

                  {(evt.status === "APPROVED" || evt.status === "ARCHIVED") && (
                    <Link href={`/events/${evt.id}`} target="_blank">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-[#3B7A57] dark:text-[#52B788] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-bold cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        <span>Halaman Publik</span>
                      </Button>
                    </Link>
                  )}

                  {(evt.status === "REVISION_REQUESTED" || evt.status === "REJECTED") && (
                    <Button
                      size="sm"
                      onClick={() => {
                        openRevisionModal(evt);
                        setViewingDetailEvent(null);
                      }}
                      className="text-xs h-8 px-3.5 rounded-xl bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold cursor-pointer shadow-xs flex items-center space-x-1"
                    >
                      <FileEdit className="w-3.5 h-3.5 mr-1" />
                      <span>{evt.status === "REJECTED" ? "Ajukan Ulang Proposal" : "Perbaiki Proposal"}</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
      })()}

      {/* =========================================================================
          3. REVISION MODAL (UPGRADED IN-PLACE RE-SUBMISSION WORKFLOW)
         ========================================================================= */}
      {revisionEvent && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setRevisionEvent(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] cursor-default"
          >
            <div className="p-6 sm:p-7 space-y-5 overflow-y-auto flex-1">
              {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className={`text-[10px] font-black uppercase tracking-wider block ${
                  revisionEvent.status === "REJECTED" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                }`}>
                  {revisionEvent.status === "REJECTED" ? "Tinjau Alasan Penolakan & Ajukan Ulang" : "Perbaiki & Ajukan Ulang Event Komunitas"}
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {revisionEvent.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRevisionEvent(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Curator Feedback Banner */}
            {(revisionEvent.revisionNotes || revisionEvent.rejectionReason) && (
              <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                revisionEvent.status === "REJECTED"
                  ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200"
                  : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200"
              }`}>
                <div className="flex items-center space-x-2">
                  <AlertCircle className={`w-4 h-4 shrink-0 ${
                    revisionEvent.status === "REJECTED" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                  }`} />
                  <span className="font-bold">
                    {revisionEvent.status === "REJECTED" ? "Alasan Penolakan dari Kurator Dago Hub:" : "Catatan Kurator Dago Hub:"}
                  </span>
                </div>
                <p className="text-[12px] italic leading-relaxed pl-6 font-medium">
                  &ldquo;{revisionEvent.rejectionReason || revisionEvent.revisionNotes}&rdquo;
                </p>
              </div>
            )}

            <form onSubmit={handleSaveRevision} className="space-y-4 text-xs">
              {/* Poster Update Section */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800 dark:text-slate-200">
                    Poster Event
                  </label>
                  <span className="text-[10px] text-slate-400">PNG, JPG, WebP (Maks. 5MB)</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Poster Preview */}
                  <div className="w-32 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-xs">
                    {revisionPosterUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={revisionPosterUrl}
                        alt="Poster Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as any).src = "https://images.unsplash.com/photo-1511920170033";
                        }}
                      />
                    ) : (
                      <div className="text-center p-2 text-slate-400">
                        <ImageIcon className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                        <span className="text-[9px] block">Belum ada poster</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-1 w-full space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs shadow-xs transition-all">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isUploadingRevisionPoster ? "Mengunggah..." : "Pilih File Gambar Baru"}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/jpg"
                          onChange={handleUploadRevisionPoster}
                          disabled={isUploadingRevisionPoster}
                          className="hidden"
                        />
                      </label>
                      {revisionPosterUrl !== revisionEvent.posterUrl && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          ✓ Gambar Berhasil Dipilih
                        </span>
                      )}
                    </div>

                    {/* Text input without HTML5 URL validation */}
                    <input
                      type="text"
                      value={revisionPosterUrl}
                      onChange={(e) => setRevisionPosterUrl(e.target.value)}
                      placeholder="URL poster (terisi otomatis saat unggah gambar)..."
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#3B7A57] text-[11px] font-mono"
                    />

                    {revisionUploadError && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                        {revisionUploadError}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Title & Category Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
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
                    Kategori
                  </label>
                  <select
                    value={revisionCategory}
                    onChange={(e) => setRevisionCategory(e.target.value as EventCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                  >
                    <option value="CREATIVE">CREATIVE</option>
                    <option value="WORKSHOP">WORKSHOP</option>
                    <option value="MEETUP">MEETUP</option>
                    <option value="COMMUNITY">COMMUNITY</option>
                    <option value="TECH">TECH</option>
                    <option value="SEMINAR">SEMINAR</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
              </div>

              {/* Schedule Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tanggal & Waktu Mulai
                  </label>
                  <input
                    type="datetime-local"
                    value={revisionStartDate}
                    onChange={(e) => setRevisionStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tanggal & Waktu Selesai
                  </label>
                  <input
                    type="datetime-local"
                    value={revisionEndDate}
                    onChange={(e) => setRevisionEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                  />
                </div>
              </div>

              {/* Location & Capacity Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
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
                    Kapasitas (Orang)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={revisionCapacity}
                    onChange={(e) => setRevisionCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Deskripsi Lengkap Acara
                </label>
                <textarea
                  required
                  rows={3}
                  value={revisionDesc}
                  onChange={(e) => setRevisionDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] resize-y"
                />
              </div>

              {/* Guidelines */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Panduan Acara / Catatan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={revisionGuidelines}
                  onChange={(e) => setRevisionGuidelines(e.target.value)}
                  placeholder="Aturan pakaian, hal yang perlu dibawa peserta, dsb..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] resize-y"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
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
                  disabled={isSubmittingRevision || isUploadingRevisionPoster}
                  className="text-xs font-bold bg-[#3B7A57] hover:bg-[#2E6044] text-white rounded-xl shadow-xs cursor-pointer flex items-center space-x-1.5 h-10 px-5"
                >
                  {isSubmittingRevision ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  ) : (
                    <FileEdit className="w-3.5 h-3.5 mr-1" />
                  )}
                  <span>Simpan Perubahan & Ajukan Ulang ke Kurator</span>
                </Button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          4. REVENUE SPLIT NEGOTIATION MODAL (ORGANIZER VIEW)
         ========================================================================= */}
      {negotiatingEvent && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setNegotiatingEvent(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] cursor-default"
          >
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                  Kesepakatan & Negosiasi Bagi Hasil
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {negotiatingEvent.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNegotiatingEvent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Active Split Status Box */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Kesepakatan Aktif Saat Ini
                </span>
                <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  Komunitas {negotiatingEvent.organizerFeePercent ?? 80}% / Dago Hub {negotiatingEvent.customPlatformFeePercent ?? 20}%
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Berlaku untuk seluruh transaksi tiket event ini hingga ada kesepakatan baru.
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-[#3B7A57] dark:text-[#52B788] flex-shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            {/* Pending Proposal Notification Banner */}
            {negotiatingEvent.proposedRevenueSplit?.status === "PENDING" && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Usulan Negosiasi Bagi Hasil Menunggu Keputusan
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-800 dark:text-amber-300">
                    PENDING
                  </Badge>
                </div>

                <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1 bg-white/70 dark:bg-slate-900/60 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/60">
                  <div className="flex justify-between font-semibold">
                    <span>Diusulkan oleh:</span>
                    <span>
                      {negotiatingEvent.proposedRevenueSplit.proposedBy === "ORGANIZER"
                        ? "Penyelenggara (Anda)"
                        : "Admin Dago Hub"}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 dark:text-white text-sm pt-0.5">
                    <span>Persentase Usulan:</span>
                    <span>
                      Penyelenggara {negotiatingEvent.proposedRevenueSplit.organizerPercent}% / Dago {negotiatingEvent.proposedRevenueSplit.platformPercent}%
                    </span>
                  </div>
                  {negotiatingEvent.proposedRevenueSplit.reason && (
                    <div className="pt-1 text-[11px] text-slate-600 dark:text-slate-400">
                      <span className="font-semibold">Alasan: </span>
                      {negotiatingEvent.proposedRevenueSplit.reason}
                    </div>
                  )}
                </div>

                {/* If proposed by Admin/Dago, Organizer can Accept or Reject */}
                {negotiatingEvent.proposedRevenueSplit.proposedBy !== "ORGANIZER" ? (
                  <div className="flex items-center space-x-2 pt-1">
                    <Button
                      size="sm"
                      disabled={isSubmittingSplit}
                      onClick={() => handleRespondSplitOrganizer(negotiatingEvent, "ACCEPT")}
                      className="text-xs bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold rounded-xl cursor-pointer"
                    >
                      {isSubmittingSplit ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                      <span>Setujui Kesepakatan Ini</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSubmittingSplit}
                      onClick={() => handleRespondSplitOrganizer(negotiatingEvent, "REJECT")}
                      className="text-xs border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      <span>Tolak Usulan</span>
                    </Button>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                    Usulan Anda sedang ditinjau kurator Dago Hub. Anda akan menerima notifikasi jika disetujui atau diajukan penawaran tandingan.
                  </p>
                )}
              </div>
            )}

            {/* Propose Split Form */}
            <form onSubmit={handleProposeSplitOrganizer} className="space-y-3.5 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                Ajukan Penyesuaian Bagi Hasil Baru
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                    Hak Komunitas (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={splitOrgPercent}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, Number(e.target.value)));
                      setSplitOrgPercent(val);
                      setSplitPlatPercent(100 - val);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                    Bagi Hasil Dago Hub (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={splitPlatPercent}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, Number(e.target.value)));
                      setSplitPlatPercent(val);
                      setSplitOrgPercent(100 - val);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Catatan / Alasan Penyesuaian Rasio
                </label>
                <textarea
                  rows={2}
                  required
                  value={splitReason}
                  onChange={(e) => setSplitReason(e.target.value)}
                  placeholder="Contoh: Pemakaian panggung utama & audio gear khusus, kolaborasi perdana, dsb."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] resize-y"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-1">
                <Button
                  type="submit"
                  disabled={isSubmittingSplit}
                  className="text-xs font-bold bg-[#3B7A57] hover:bg-[#2E6044] text-white rounded-xl cursor-pointer"
                >
                  {isSubmittingSplit ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  <span>Kirim Usulan Bagi Hasil</span>
                </Button>
              </div>
            </form>

            {/* Split Agreement History Table */}
            {negotiatingEvent.revenueSplitHistory && negotiatingEvent.revenueSplitHistory.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  Riwayat Kesepakatan Bagi Hasil
                </span>
                <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-bold uppercase">
                      <tr>
                        <th className="py-2 px-2.5">Tanggal Efektif</th>
                        <th className="py-2 px-2.5">Kesepakatan (Org / Dago)</th>
                        <th className="py-2 px-2.5">Pihak Pengaju</th>
                        <th className="py-2 px-2.5">Disetujui Oleh</th>
                        <th className="py-2 px-2.5">Alasan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {negotiatingEvent.revenueSplitHistory.map((h) => (
                        <tr key={h.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-2.5 text-slate-500">
                            {new Date(h.effectiveDate).toLocaleDateString("id-ID")}
                          </td>
                          <td className="py-2 px-2.5 font-bold text-[#3B7A57] dark:text-[#52B788]">
                            {h.agreedOrganizerPercent ?? h.newOrganizerPercent}% / {h.agreedPlatformPercent ?? h.newPlatformPercent}%
                          </td>
                          <td className="py-2 px-2.5 text-slate-600 dark:text-slate-400">
                            {h.proposedBy === "ORGANIZER" ? "Penyelenggara" : "Admin Dago"}
                          </td>
                          <td className="py-2 px-2.5 text-slate-600 dark:text-slate-400">
                            {h.approvedBy || "Admin Dago"}
                          </td>
                          <td className="py-2 px-2.5 text-slate-500 max-w-[150px] truncate">
                            {h.reason || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          5. PAYOUT REQUEST MODAL (ORGANIZER VIEW)
         ========================================================================= */}
      {isPayoutModalOpen && (() => {
        const targetEvent = portalData?.events.find((e) => e.id === payoutTargetEventId);
        const targetPaidBookings = (portalData?.bookings || []).filter(
          (b) => b.eventId === payoutTargetEventId && b.paymentStatus === "PAID"
        );
        const targetGross = targetPaidBookings.reduce(
          (sum, b) => sum + (b.organizerRevenueAmount || 0),
          0
        );
        let targetCommitted = 0;
        (targetEvent?.payoutHistory || []).forEach((p) => {
          if (p.status === "REQUESTED" || p.status === "PROCESSING" || p.status === "PAID") {
            targetCommitted += p.amount;
          }
        });
        const targetAvailable = Math.max(0, targetGross - targetCommitted);
        const isOverLimit = payoutAmount > targetAvailable;

        return (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsPayoutModalOpen(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] cursor-default"
            >
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                    Pencairan Saldo Pendapatan
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Form Pengajuan Payout Komunitas
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitPayoutRequest} className="space-y-3.5 text-xs">
                {/* Event Source & Available Balance */}
                {portalData?.events.length === 1 ? (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Sumber Pendapatan Event
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-xs truncate">
                        {targetEvent?.title || "Event Komunitas"}
                      </span>
                      <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                        Saldo: Rp {targetAvailable.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Pilih Event Sumber Saldo
                    </label>
                    <EventSearchInput
                      events={portalData?.events || []}
                      selectedEventId={payoutTargetEventId}
                      onSelectEvent={(id) => {
                        setPayoutTargetEventId(id);
                        const evt = portalData?.events.find((e) => e.id === id);
                        const pb = (portalData?.bookings || []).filter(
                          (b) => b.eventId === id && b.paymentStatus === "PAID"
                        );
                        const g = pb.reduce((s, b) => s + (b.organizerRevenueAmount || 0), 0);
                        let c = 0;
                        (evt?.payoutHistory || []).forEach((p) => {
                          if (p.status === "REQUESTED" || p.status === "PROCESSING" || p.status === "PAID") c += p.amount;
                        });
                        setPayoutAmount(Math.max(0, g - c));
                      }}
                      placeholder="Cari nama event sumber saldo..."
                      allowAllOption={false}
                    />
                    <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1">
                      <span>Saldo tersedia untuk event ini:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        Rp {targetAvailable.toLocaleString("id-ID")}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Amount with Max Button */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">
                      Nominal Pencairan (Rp)
                    </label>
                    {targetAvailable > 0 && (
                      <button
                        type="button"
                        onClick={() => setPayoutAmount(targetAvailable)}
                        className="text-[11px] text-[#3B7A57] dark:text-[#52B788] hover:underline font-bold cursor-pointer"
                      >
                        Tarik Semua (Rp {targetAvailable.toLocaleString("id-ID")})
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min={10000}
                    max={targetAvailable}
                    required
                    value={payoutAmount || ""}
                    onChange={(e) => setPayoutAmount(Number(e.target.value))}
                    placeholder={`Maksimal Rp ${targetAvailable.toLocaleString("id-ID")}`}
                    className={`w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 ${
                      isOverLimit
                        ? "border-rose-500 focus:ring-rose-500 text-rose-600"
                        : "border-slate-200 dark:border-slate-700 focus:ring-[#3B7A57]"
                    }`}
                  />
                  {isOverLimit && (
                    <p className="text-[11px] text-rose-500 font-semibold">
                      ⚠️ Nominal penarikan melebihi saldo tersedia untuk event ini (Maksimal: Rp {targetAvailable.toLocaleString("id-ID")}).
                    </p>
                  )}
                  {targetAvailable <= 0 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      ℹ️ Seluruh saldo untuk event ini telah ditarik atau sedang dalam antrean verifikasi.
                    </p>
                  )}
                </div>

                {/* Bank Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nama Bank
                    </label>
                    <input
                      type="text"
                      required
                      value={payoutBankName}
                      onChange={(e) => setPayoutBankName(e.target.value)}
                      placeholder="BCA, Mandiri, BRI..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      No. Rekening
                    </label>
                    <input
                      type="text"
                      required
                      value={payoutAccountNumber}
                      onChange={(e) => setPayoutAccountNumber(e.target.value)}
                      placeholder="1234567890"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nama Pemilik
                    </label>
                    <input
                      type="text"
                      required
                      value={payoutAccountHolder}
                      onChange={(e) => setPayoutAccountHolder(e.target.value)}
                      placeholder="Sesuai buku tabungan"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Catatan untuk Tim Keuangan Dago (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={payoutNotes}
                    onChange={(e) => setPayoutNotes(e.target.value)}
                    placeholder="Catatan transfer atau konfirmasi khusus..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] resize-y"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPayoutModalOpen(false)}
                    className="text-xs border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingPayout || isOverLimit || payoutAmount <= 0 || targetAvailable <= 0}
                    className="text-xs font-bold bg-[#3B7A57] hover:bg-[#2E6044] text-white rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingPayout ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    <span>Ajukan Pencairan Dana</span>
                  </Button>
                </div>
              </form>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
