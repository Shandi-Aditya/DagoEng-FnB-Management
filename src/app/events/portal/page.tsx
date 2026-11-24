"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  AlertCircle,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { notify } from "@/components/app/notify";
import { useAuth } from "@/contexts/AuthContext";
import { downloadCSV } from "@/lib/export-utils";
import { getMissingPayoutFields } from "@/lib/payout";
import type {
  CommunityEvent,
  EventCategory,
  EventTicketOrder,
  OrganizerPortalData,
  PayoutRecord,
} from "@/types/event";
import type { DateRange } from "@/components/events/EventDateRangeFilter";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { OrganizerSidebar } from "@/features/events-portal/OrganizerSidebar";
import { OrganizerSiteHeader } from "@/features/events-portal/OrganizerSiteHeader";
import type { OrganizerNavView } from "@/features/events-portal/OrganizerTabs";
import { OrganizerHomeTab } from "@/features/events-portal/OrganizerHomeTab";
import { OrganizerEventsTab } from "@/features/events-portal/OrganizerEventsTab";
import { OrganizerAttendeesTab } from "@/features/events-portal/OrganizerAttendeesTab";
import { OrganizerFinanceTab } from "@/features/events-portal/OrganizerFinanceTab";
import { OrganizerSettingsTab } from "@/features/events-portal/OrganizerSettingsTab";
import { OrganizerEventDetailModal } from "@/features/events-portal/OrganizerEventDetailModal";
import { OrganizerRevisionDialog } from "@/features/events-portal/OrganizerRevisionDialog";
import { OrganizerRevenueSplitDialog } from "@/features/events-portal/OrganizerRevenueSplitDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrganizerPayoutDialog } from "@/features/events-portal/OrganizerPayoutDialog";
import { OrganizerBankGuardDialog } from "@/features/events-portal/OrganizerBankGuardDialog";
import { OrganizerQRScannerDialog } from "@/features/events-portal/OrganizerQRScannerDialog";
import { validateEventCapacity, validateEventTicketTiers } from "@/lib/event-validation";
import { OrganizerSignedOut } from "@/features/events-portal/OrganizerSignedOut";
import { EventSubmissionForm } from "@/features/events-portal/EventSubmissionForm";
import { EventPromosDialog } from "@/components/events/EventPromosDialog";
import type { EventTicketTier, EventRefundPolicy } from "@/types/event";
import type { SectionId } from "@/features/events-portal/OrganizerEventsTab";
import { eventBalances, groupOrganizerEvents } from "@/features/events-portal/events-portal-groups";
import { buildAttendeesExportRows } from "@/features/events-portal/events-portal-domain";
import { isCheckInStaffRole, CHECKIN_STAFF_SUBMISSION_BLOCKED_MESSAGE } from "@/lib/event-validation";

const ALL_COMMUNITIES_VALUE = "all_admin";

const SHELL_STYLE = {
  "--sidebar-width": "calc(var(--spacing) * 64)",
  "--header-height": "calc(var(--spacing) * 12)",
} as React.CSSProperties;

export default function CommunityOrganizerPortalPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [organizerEmail, setOrganizerEmail] = useState("");
  const [activeEmail, setActiveEmail] = useState("");
  const [portalData, setPortalData] = useState<OrganizerPortalData | null>(null);
  // Starts true so the signed-out screen does not flash before the first load.
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Tab
  const [activeNav, setActiveNav] = useState<OrganizerNavView>("HOME");
  // Which event group the Event tab opens on; set to "inReview" right after a submission.
  const [eventsSection, setEventsSection] = useState<SectionId | undefined>(undefined);

  // `/events/portal?view=submit` opens the submission form directly (old /events/submit links land here).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") === "submit") setActiveNav("SUBMIT");
  }, []);

  // Attendees Tab Filter States
  const [selectedEventId, setSelectedEventId] = useState<string>("ALL");
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [attendeeDateRange, setAttendeeDateRange] = useState<DateRange | null>(null);

  // Modals & Sheets
  const [viewingDetailEvent, setViewingDetailEvent] = useState<CommunityEvent | null>(null);
  const [revisionEvent, setRevisionEvent] = useState<CommunityEvent | null>(null);
  const [negotiatingEvent, setNegotiatingEvent] = useState<CommunityEvent | null>(null);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [isBankIncompleteModalOpen, setIsBankIncompleteModalOpen] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);

  // Revision Form State
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
  const [revisionTiers, setRevisionTiers] = useState<EventTicketTier[]>([]);
  const [revisionRefundPolicy, setRevisionRefundPolicy] = useState<EventRefundPolicy>({ policyType: "NO_REFUND" });
  const [promoEvent, setPromoEvent] = useState<CommunityEvent | null>(null);

  // Revenue Split Negotiation Form State
  const [splitOrgPercent, setSplitOrgPercent] = useState<number>(80);
  const [splitPlatPercent, setSplitPlatPercent] = useState<number>(20);
  const [splitReason, setSplitReason] = useState("");
  const [isSubmittingSplit, setIsSubmittingSplit] = useState(false);

  // Payout Form State
  const [payoutTargetEventId, setPayoutTargetEventId] = useState<string>("");
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [payoutBankName, setPayoutBankName] = useState("");
  const [payoutAccountNumber, setPayoutAccountNumber] = useState("");
  const [payoutAccountHolder, setPayoutAccountHolder] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);
  const [missingBankErrors, setMissingBankErrors] = useState<Array<{ field: string; message: string }>>([]);

  // Settings State (Bank, Profile, Notifications)
  const [bankSettings, setBankSettings] = useState({
    bankName: "",
    accountNumber: "",
    accountHolder: "",
    branch: "",
  });

  const loadPortalData = useCallback(async (email?: string) => {
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
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Terjadi kesalahan jaringan.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const isAdminUser =
      user?.role?.slug === "OWNER" ||
      user?.role?.slug === "SUPER_ADMIN" ||
      user?.role?.slug === "MANAGER";
    const savedEmail = typeof window !== "undefined" ? localStorage.getItem("dago_organizer_email") : null;
    const targetEmail = isAdminUser && !savedEmail ? "ALL_ADMIN" : (savedEmail || user?.email);
    loadPortalData(targetEmail || undefined);
  }, [user?.email, user?.role?.slug, loadPortalData]);

  // Sync bank & profile settings
  useEffect(() => {
    if (activeEmail) {
      try {
        if (portalData?.registeredBankAccount) {
          setBankSettings({
            bankName: portalData.registeredBankAccount.bankName || "",
            accountNumber: portalData.registeredBankAccount.accountNumber || "",
            accountHolder: portalData.registeredBankAccount.accountHolder || "",
            branch: portalData.registeredBankAccount.branch || "",
          });
          localStorage.removeItem(`dago_org_bank_${activeEmail}`);
        } else {
          setBankSettings({
            bankName: "",
            accountNumber: "",
            accountHolder: "",
            branch: "",
          });
        }
      } catch (_) {}
    }
  }, [activeEmail, portalData?.registeredBankAccount]);

  useEffect(() => {
    if (
      selectedEventId !== "ALL" &&
      portalData &&
      !portalData.events.some((evt) => evt.id === selectedEventId)
    ) {
      setSelectedEventId("ALL");
    }
  }, [portalData, selectedEventId]);

  const handleSelectCommunity = async (comm: { id: string; name: string; email: string }) => {
    setSelectedEventId("ALL");
    setAttendeeSearch("");
    setAttendeeDateRange(null);
    setOrganizerEmail(comm.email);
    await loadPortalData(comm.email);
  };

  const handleOrganizerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedEventId("ALL");
    loadPortalData(organizerEmail);
  };

  const toDateTimeLocal = (isoString?: string) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
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
    setRevisionTiers(evt.ticketTiers || []);
    setRevisionRefundPolicy(evt.refundPolicy || { policyType: "NO_REFUND" });
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
      notify.success("Poster berhasil diunggah");
    } catch (err: unknown) {
      setRevisionUploadError(err instanceof Error ? err.message : "Gagal mengunggah gambar poster.");
    } finally {
      setIsUploadingRevisionPoster(false);
    }
  };

  const handleSaveRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = activeEmail || organizerEmail || user?.email || "";
    if (!revisionEvent || !targetEmail) return;

    const capNum = Number(revisionCapacity);
    const capCheck = validateEventCapacity(capNum, false);
    if (!capCheck.valid) {
      setErrorMessage(capCheck.error || "Kapasitas kuota event tidak valid.");
      notify.error("Validasi gagal", capCheck.error);
      return;
    }
    if (revisionTiers && revisionTiers.length > 0) {
      const tierCheck = validateEventTicketTiers(revisionTiers, { maxCapacity: capNum });
      if (!tierCheck.valid) {
        setErrorMessage(tierCheck.error || "Format jenis tiket tidak valid.");
        notify.error("Validasi gagal", tierCheck.error);
        return;
      }
    }

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
            startDate: revisionStartDate
              ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(revisionStartDate.trim())
                ? `${revisionStartDate.trim()}:00+08:00`
                : new Date(revisionStartDate).toISOString()
              : revisionEvent.startDate,
            endDate: revisionEndDate
              ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(revisionEndDate.trim())
                ? `${revisionEndDate.trim()}:00+08:00`
                : new Date(revisionEndDate).toISOString()
              : revisionEvent.endDate,
            guidelines: revisionGuidelines,
            ticketTiers: revisionTiers,
            refundPolicy: revisionRefundPolicy,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error || "Gagal menyimpan revisi.");
        notify.error("Gagal mengirim revisi", json.error);
        return;
      }
      notify.success("Event diajukan ulang", "Status event kini kembali dalam antrean kurasi");
      setRevisionEvent(null);
      await loadPortalData(activeEmail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengirim revisi.";
      setErrorMessage(msg);
      notify.error("Gagal mengirim revisi", msg);
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
      notify.success("Usulan bagi hasil diajukan");
      setNegotiatingEvent(null);
      setSplitReason("");
      await loadPortalData(activeEmail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setErrorMessage(msg);
      notify.error("Gagal mengajukan usulan", msg);
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
      if (data.data) {
        setNegotiatingEvent(data.data);
        if (viewingDetailEvent?.id === data.data.id) {
          setViewingDetailEvent(data.data);
        }
      }
      notify.success("Keputusan tersimpan", decision === "ACCEPT" ? "Kesepakatan bagi hasil disetujui" : "Tawaran bagi hasil ditolak");
      await loadPortalData(activeEmail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setErrorMessage(msg);
      notify.error("Gagal merespons", msg);
    } finally {
      setIsSubmittingSplit(false);
    }
  };

  const handleOpenPayout = () => {
    if (!portalData || portalData.events.length === 0) {
      setErrorMessage("Belum ada event untuk diajukan pencairan.");
      return;
    }

    const currentBank = portalData.registeredBankAccount || bankSettings;
    const missingCheck = getMissingPayoutFields(currentBank);
    if (!missingCheck.isValid) {
      setMissingBankErrors(missingCheck.errors);
      setIsBankIncompleteModalOpen(true);
      return;
    }

    const firstWithBalance = balances.rows.find((item) => item.available > 0);
    const targetId = firstWithBalance ? firstWithBalance.eventId : portalData.events[0].id;
    const initialAmount = firstWithBalance ? firstWithBalance.available : 0;

    setPayoutTargetEventId(targetId);
    setPayoutAmount(initialAmount);
    setPayoutBankName(currentBank.bankName || "");
    setPayoutAccountNumber(currentBank.accountNumber || "");
    setPayoutAccountHolder(currentBank.accountHolder || "");
    setIsPayoutModalOpen(true);
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
        if (data.code === "PAYOUT_BANK_INCOMPLETE") {
          setIsPayoutModalOpen(false);
          setMissingBankErrors(data.errors || [{ field: "rekening", message: data.error }]);
          setIsBankIncompleteModalOpen(true);
          return;
        }
        throw new Error(data.error || "Gagal mengajukan pencairan dana.");
      }
      notify.success("Pencairan diajukan", "Verifikasi transfer akan diproses tim finance");
      setIsPayoutModalOpen(false);
      setPayoutAmount(0);
      setPayoutNotes("");
      await loadPortalData(activeEmail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setErrorMessage(msg);
      notify.error("Gagal mengajukan pencairan", msg);
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  const handleSaveBankSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: `Rekening Mitra ${portalData?.summary?.organizerName || "Komunitas"}`,
          bankName: bankSettings.bankName,
          accountNumber: bankSettings.accountNumber,
          accountHolder: bankSettings.accountHolder,
          branch: bankSettings.branch,
          accountType: "ORGANIZER",
          organizerEmail: activeEmail,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) {
        notify.error("Rekening belum tersimpan", json?.error || "Periksa data rekening lalu coba lagi.");
        return;
      }

      if (typeof window !== "undefined") {
        localStorage.removeItem(`dago_org_bank_${activeEmail}`);
      }

      notify.success("Rekening disimpan", "Data rekening resmi siap digunakan untuk pencairan");
      await loadPortalData(activeEmail);
    } catch {
      notify.error("Rekening belum tersimpan", "Koneksi terputus. Coba lagi.");
    }
  };



  const handleCheckInSuccess = (updatedBooking: EventTicketOrder, message: string) => {
    notify.success("Check-in berhasil", message);
    if (portalData) {
      const nextBookings = portalData.bookings.map((b) =>
        b.id === updatedBooking.id ? updatedBooking : b
      );
      setPortalData({ ...portalData, bookings: nextBookings });
    }
  };

  const handleExportCSV = (rowsToExport: EventTicketOrder[]) => {
    if (rowsToExport.length === 0) return;
    const headers = [
      "Kode Tiket",
      "Nama Event",
      "Jenis Tiket",
      "Nama Peserta",
      "No HP",
      "Instansi",
      "Qty Tiket",
      "Status Bayar",
      "Check In",
      "Waktu Check In",
      "Petugas Check In",
    ];
    const rows = buildAttendeesExportRows(rowsToExport);

    downloadCSV(`peserta-komunitas-${Date.now()}.csv`, headers, rows);
    notify.info("File CSV diunduh");
  };

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("dago_organizer_email");
    }
    await logout();
    router.push("/login");
  };

  const balances = useMemo(
    () => eventBalances(portalData?.events ?? [], portalData?.bookings ?? []),
    [portalData?.events, portalData?.bookings],
  );

  const eventGroups = useMemo(
    () => groupOrganizerEvents(portalData?.events ?? [], new Date()),
    [portalData?.events],
  );

  const userInitial = useMemo(() => {
    const name = portalData?.summary?.organizerName || user?.name || "M";
    return name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("");
  }, [portalData?.summary?.organizerName, user?.name]);

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

  const currentTargetAvailable =
    balances.rows.find((row) => row.eventId === payoutTargetEventId)?.available ?? 0;

  if (isCheckInStaffRole(user?.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-4 p-6 border rounded-xl bg-card shadow-sm">
          <div className="mx-auto size-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <AlertCircle className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Akses ditolak</h2>
          <p className="text-sm text-muted-foreground">{CHECKIN_STAFF_SUBMISSION_BLOCKED_MESSAGE}</p>
          <div className="pt-2">
            <Link href="/events/checkin" className={buttonVariants({ variant: "outline" })}>
              Kembali ke meja check-in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!portalData && !isLoading) {
    return <OrganizerSignedOut signedInEmail={user?.email} />;
  }

  return (
    <SidebarProvider style={SHELL_STYLE}>
      <OrganizerSidebar
        variant="inset"
        activeNav={activeNav}
        onNavChange={setActiveNav}
        actionCount={eventGroups.needsAction.length}
        bookingCount={portalData?.bookings?.length}
        organizerName={portalData?.summary?.organizerName || ""}
        organizerEmail={activeEmail || organizerEmail || user?.email || ""}
        userInitial={userInitial}
        onLogout={handleLogout}
      />

      <SidebarInset className="min-w-0 max-w-full overflow-x-hidden">
        <OrganizerSiteHeader activeNav={activeNav} onOpenCheckIn={() => setIsQRScannerOpen(true)} onSubmitEvent={portalData?.isAdmin ? undefined : () => setActiveNav("SUBMIT")} />

        <div className="flex w-full min-w-0 flex-1 flex-col p-4 lg:p-6 mx-auto max-w-7xl space-y-6">
        {/* Inline Feedback Alerts */}
        {errorMessage && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="hover:opacity-75 cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && !portalData && (
          <div className="space-y-4 py-8">
            <div className="h-8 bg-muted rounded-md w-48 animate-pulse" />
            <div className="h-32 bg-muted rounded-md animate-pulse" />
            <div className="h-64 bg-muted rounded-md animate-pulse" />
          </div>
        )}

        {/* Authenticated Workspace */}
        {portalData && (
          <>
            {/* Admin Supervisor Switcher */}
            {portalData.isAdmin && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-warning shrink-0" />
                    <span className="text-xs font-medium text-warning">
                      Mode pengawasan admin
                    </span>
                  </div>
                  <form onSubmit={handleOrganizerSubmit} className="flex items-center gap-2">
                    <input
                      type="email"
                      value={organizerEmail}
                      onChange={(e) => setOrganizerEmail(e.target.value)}
                      placeholder="Email komunitas..."
                      className="h-8 rounded-md border bg-background px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                    />
                    <Button type="submit" size="sm" variant="outline">
                      Supervisi
                    </Button>
                  </form>
                </div>

                {portalData.accessibleCommunities && portalData.accessibleCommunities.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-warning/20">
                    <span className="text-xs text-muted-foreground mr-1">Pilih komunitas:</span>
                    <Tabs
                      value={activeEmail.toLowerCase() === "all_admin" ? ALL_COMMUNITIES_VALUE : activeEmail}
                      onValueChange={(value) => {
                        const community =
                          value === ALL_COMMUNITIES_VALUE
                            ? { id: "all_admin", name: "Semua Komunitas", email: "ALL_ADMIN" }
                            : portalData.accessibleCommunities?.find((c) => c.email === value);
                        if (community) handleSelectCommunity(community);
                      }}
                    >
                      <TabsList aria-label="Komunitas" className="h-auto max-w-full flex-wrap justify-start">
                        <TabsTrigger value={ALL_COMMUNITIES_VALUE}>Semua komunitas</TabsTrigger>
                        {portalData.accessibleCommunities.map((c) => (
                          <TabsTrigger key={c.email} value={c.email}>
                            {c.name}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </div>
                )}
              </div>
            )}

            {/* TAB 1: EVENTS */}
            {activeNav === "EVENTS" && (
              <OrganizerEventsTab
                groups={eventGroups}
                bookings={portalData.bookings}
                onSelectEvent={(evt) => setViewingDetailEvent(evt)}
                onEditRevision={openRevisionModal}
                onReviewSplit={(evt) => setNegotiatingEvent(evt)}
                onManagePromos={(evt) => setPromoEvent(evt)}
                initialSection={eventsSection}
                onShowAttendees={(eventId) => {
                  setSelectedEventId(eventId);
                  setActiveNav("ATTENDEES");
                }}
              />
            )}

            {/* TAB 2: ATTENDEES */}
            {activeNav === "ATTENDEES" && (
              <OrganizerAttendeesTab
                bookings={portalData.bookings}
                events={portalData.events}
                selectedEventId={selectedEventId}
                onSelectEventId={setSelectedEventId}
                searchQuery={attendeeSearch}
                onSearchChange={setAttendeeSearch}
                dateRange={attendeeDateRange}
                onDateRangeChange={setAttendeeDateRange}
                onExportCSV={handleExportCSV}
                onInvitationIssued={() => loadPortalData(activeEmail)}
              />
            )}

            {/* TAB 3: FINANCE */}
            {activeNav === "FINANCE" && (
              <OrganizerFinanceTab
                rows={balances.rows}
                totals={balances.totals}
                payouts={allPayouts}
                bankSettings={bankSettings}
                onOpenPayout={handleOpenPayout}
                onGoToSettings={() => setActiveNav("SETTINGS")}
              />
            )}

            {/* TAB 4: SETTINGS */}
            {activeNav === "SETTINGS" && (
              <OrganizerSettingsTab
                organizerName={portalData.summary?.organizerName || ""}
                organizerEmail={activeEmail}
                bankSettings={bankSettings}
                setBankSettings={setBankSettings}
                onSaveBank={handleSaveBankSettings}
                onLogout={handleLogout}
              />
            )}

            {activeNav === "SUBMIT" && portalData.isAdmin && (
              <p className="text-sm text-muted-foreground">
                Admin tidak mengajukan event sebagai penyelenggara. Kelola event dari halaman admin event.
              </p>
            )}

            {activeNav === "SUBMIT" && !portalData.isAdmin && (
              <EventSubmissionForm
                mode="portal"
                organizer={{
                  name: portalData.summary?.organizerName || user?.name,
                  email: activeEmail || user?.email,
                  phone: user?.phone ?? undefined,
                }}
                onCancel={() => setActiveNav("HOME")}
                onSubmitted={async () => {
                  notify.success("Event diajukan", "Admin akan meninjaunya dalam 1 sampai 2 hari kerja");
                  await loadPortalData(activeEmail);
                  setEventsSection("inReview");
                  setActiveNav("EVENTS");
                }}
              />
            )}

            {/* TAB 5: HOME */}
            {activeNav === "HOME" && (
              <OrganizerHomeTab
                groups={eventGroups}
                bookings={portalData.bookings}
                totals={balances.totals}
                onSelectEvent={(evt) => setViewingDetailEvent(evt)}
                onEditRevision={openRevisionModal}
                onReviewSplit={(evt) => setNegotiatingEvent(evt)}
                onOpenCheckIn={() => setIsQRScannerOpen(true)}
                onGoToEvents={() => setActiveNav("EVENTS")}
                onGoToAttendees={() => setActiveNav("ATTENDEES")}
                onGoToFinance={() => setActiveNav("FINANCE")}
                onSubmitEvent={() => setActiveNav("SUBMIT")}
              />
            )}
          </>
        )}
        </div>
      </SidebarInset>

      {/* 3. Dialogs & Modals */}
      <OrganizerEventDetailModal
        event={viewingDetailEvent}
        open={Boolean(viewingDetailEvent)}
        onOpenChange={(open) => {
          if (!open) setViewingDetailEvent(null);
        }}
        bookings={portalData?.bookings || []}
        onEditRevision={openRevisionModal}
        onReviewSplit={(evt) => setNegotiatingEvent(evt)}
        onManagePromos={(evt) => setPromoEvent(evt)}
      />

      <OrganizerRevisionDialog
        event={revisionEvent}
        open={Boolean(revisionEvent)}
        onOpenChange={(open) => {
          if (!open) setRevisionEvent(null);
        }}
        title={revisionTitle}
        setTitle={setRevisionTitle}
        category={revisionCategory}
        setCategory={setRevisionCategory}
        description={revisionDesc}
        setDescription={setRevisionDesc}
        location={revisionLocation}
        setLocation={setRevisionLocation}
        capacity={revisionCapacity}
        setCapacity={setRevisionCapacity}
        guidelines={revisionGuidelines}
        setGuidelines={setRevisionGuidelines}
        posterUrl={revisionPosterUrl}
        setPosterUrl={setRevisionPosterUrl}
        startDate={revisionStartDate}
        setStartDate={setRevisionStartDate}
        endDate={revisionEndDate}
        setEndDate={setRevisionEndDate}
        isUploadingPoster={isUploadingRevisionPoster}
        uploadError={revisionUploadError}
        onUploadPoster={handleUploadRevisionPoster}
        onSubmitRevision={handleSaveRevision}
        isSubmitting={isSubmittingRevision}
        ticketTiers={revisionTiers}
        setTicketTiers={setRevisionTiers}
        refundPolicy={revisionRefundPolicy}
        setRefundPolicy={setRevisionRefundPolicy}
        hasPaidTickets={Boolean(
          revisionEvent &&
            (portalData?.bookings || []).some(
              (b) => b.eventId === revisionEvent.id && b.paymentStatus === "PAID"
            )
        )}
      />

      <EventPromosDialog
        open={Boolean(promoEvent)}
        onOpenChange={(open) => {
          if (!open) setPromoEvent(null);
        }}
        event={promoEvent}
        onPromoUpdated={() => loadPortalData(activeEmail)}
      />

      <OrganizerRevenueSplitDialog
        event={negotiatingEvent}
        open={Boolean(negotiatingEvent)}
        onOpenChange={(open) => {
          if (!open) setNegotiatingEvent(null);
        }}
        splitOrgPercent={splitOrgPercent}
        setSplitOrgPercent={setSplitOrgPercent}
        splitPlatPercent={splitPlatPercent}
        setSplitPlatPercent={setSplitPlatPercent}
        splitReason={splitReason}
        setSplitReason={setSplitReason}
        onRespondSplit={handleRespondSplitOrganizer}
        onProposeSplit={handleProposeSplitOrganizer}
        isSubmitting={isSubmittingSplit}
      />

      <OrganizerPayoutDialog
        open={isPayoutModalOpen}
        onOpenChange={setIsPayoutModalOpen}
        events={portalData?.events || []}
        targetEventId={payoutTargetEventId}
        onSelectTargetEvent={(id) => {
          setPayoutTargetEventId(id);
          setPayoutAmount(balances.rows.find((row) => row.eventId === id)?.available ?? 0);
        }}
        targetAvailable={currentTargetAvailable}
        amount={payoutAmount}
        setAmount={setPayoutAmount}
        bankName={payoutBankName}
        setBankName={setPayoutBankName}
        accountNumber={payoutAccountNumber}
        setAccountNumber={setPayoutAccountNumber}
        accountHolder={payoutAccountHolder}
        setAccountHolder={setPayoutAccountHolder}
        notes={payoutNotes}
        setNotes={setPayoutNotes}
        onSubmitPayout={handleSubmitPayoutRequest}
        isSubmitting={isSubmittingPayout}
      />

      <OrganizerBankGuardDialog
        open={isBankIncompleteModalOpen}
        onOpenChange={setIsBankIncompleteModalOpen}
        missingBankErrors={missingBankErrors}
        onGoToBankSettings={() => {
          setIsBankIncompleteModalOpen(false);
          setActiveNav("SETTINGS");
        }}
      />

      <OrganizerQRScannerDialog
        open={isQRScannerOpen}
        onOpenChange={setIsQRScannerOpen}
        organizerEmail={activeEmail || organizerEmail || user?.email || ""}
        selectedEventId={selectedEventId}
        events={portalData?.events || []}
        bookings={portalData?.bookings || []}
        onCheckInSuccess={handleCheckInSuccess}
      />
    </SidebarProvider>
  );
}
