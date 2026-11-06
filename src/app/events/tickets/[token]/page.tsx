"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Ticket,
  Printer,
  Download,
  ShieldCheck,
  CreditCard,
  ExternalLink,
  ArrowLeft,
  Lock,
  Share2,
  RefreshCw,
  Sparkles,
  Users,
  Info,
  Upload,
  ImageIcon,
  Building2,
  Eye,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { formatCurrencyIDR } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { downloadTicketAsImage } from "@/lib/ticket-download";

interface TicketDetails {
  id: string;
  ticketCode: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  institution?: string | null;
  ticketCount: number;
  unitPrice: number;
  totalPrice: number;
  paymentMethod: string;
  paymentStatus: "PENDING" | "PAID" | "CANCELLED";
  paymentProofUrl?: string | null;
  paymentProofUploadedAt?: string | null;
  paymentProofNote?: string | null;
  checkInStatus: "REGISTERED" | "PARTIALLY_CHECKED_IN" | "CHECKED_IN";
  checkedInQty?: number;
  checkedInSeats?: number[];
  checkInTime?: string | null;
  dokuInvoiceNumber?: string | null;
  dokuPaymentUrl?: string | null;
  destinationBankSnapshot?: {
    bankId: string;
    label?: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    branch?: string;
    badge?: string;
  } | null;
  activeDestinationBank?: {
    bankId?: string;
    label?: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    branch?: string;
    badge?: string;
    accountType?: string;
  } | null;
  isOriginalBankDeactivated?: boolean;
  activeBankAccounts?: Array<{
    bankId: string;
    label?: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    branch?: string;
    badge?: string;
    accountType?: string;
  }>;
  paymentRejectionReason?: string | null;
  paymentVerificationNote?: string | null;
  paymentVerifiedAt?: string | null;
  paymentVerifiedBy?: string | null;
  createdAt: string;
  eventDetails?: {
    id: string;
    title: string;
    category: string;
    posterUrl: string;
    organizerName: string;
    startDate: string;
    endDate: string;
    location: string;
    guidelines?: string[];
  } | null;
}


export default function PrivateTicketViewPage() {
  const params = useParams();
  const router = useRouter();
  const token = (params?.token as string) || "";

  const [ticket, setTicket] = useState<TicketDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopiedCode, setIsCopiedCode] = useState(false);
  const [isCopiedLink, setIsCopiedLink] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);
  const [isCopiedTotal, setIsCopiedTotal] = useState(false);

  // Payment proof upload states
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofNote, setProofNote] = useState("");
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [isReuploading, setIsReuploading] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isSubTicketsOpen, setIsSubTicketsOpen] = useState(true);
  const [selectedTicketIndex, setSelectedTicketIndex] = useState<number>(1);

  // 60-Minute Payment Deadline Countdown Timer
  const [timeLeft, setTimeLeft] = useState<{ minutes: number; seconds: number; isExpired: boolean } | null>(null);

  useEffect(() => {
    if (!ticket || ticket.paymentStatus !== "PENDING" || !ticket.createdAt) return;

    const calculateTimeLeft = () => {
      const created = new Date(ticket.createdAt).getTime();
      const deadlineMs = created + 60 * 60 * 1000;
      const diff = deadlineMs - Date.now();

      if (diff <= 0) {
        setTimeLeft({ minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const totalSec = Math.floor(diff / 1000);
      const minutes = Math.floor(totalSec / 60);
      const seconds = totalSec % 60;
      setTimeLeft({ minutes, seconds, isExpired: false });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [ticket?.paymentStatus, ticket?.createdAt]);

  useEffect(() => {
    if (token) {
      fetchTicket();
    }
  }, [token]);

  // Auto-dismiss upload notification
  useEffect(() => {
    if (uploadSuccessMessage) {
      const timer = setTimeout(() => {
        setUploadSuccessMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [uploadSuccessMessage]);

  const fetchTicket = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/events/tickets/${encodeURIComponent(token)}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat e-tiket.");
      }

      setTicket(json.data);
    } catch (err: any) {
      setError(err.message || "Tautan e-tiket tidak valid atau telah kedaluwarsa.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyTicketCode = () => {
    if (!ticket || typeof window === "undefined") return;
    navigator.clipboard.writeText(ticket.ticketCode);
    setIsCopiedCode(true);
    setTimeout(() => setIsCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    setIsCopiedLink(true);
    setTimeout(() => setIsCopiedLink(false), 2000);
  };

  const handleCopyAccount = (accNumber: string) => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(accNumber);
    setCopiedAccount(accNumber);
    setTimeout(() => setCopiedAccount(null), 2000);
  };

  const handleCopyTotal = (amount: number) => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(amount.toString());
    setIsCopiedTotal(true);
    setTimeout(() => setIsCopiedTotal(false), 2000);
  };

  const [isDownloadingTicket, setIsDownloadingTicket] = useState(false);

  const isSeatCheckedIn = (seatNum: number) => {
    if (!ticket) return false;
    if (Array.isArray(ticket.checkedInSeats)) {
      return ticket.checkedInSeats.includes(seatNum);
    }
    return (ticket.checkedInQty ?? (ticket.checkInStatus === "CHECKED_IN" ? ticket.ticketCount : 0)) >= seatNum;
  };

  const handleDownloadSubTicket = async (index: number) => {
    if (!ticket) return;
    setIsDownloadingTicket(true);
    try {
      const isMulti = (ticket.ticketCount || 1) > 1;
      const subCode = isMulti ? `${ticket.ticketCode}-${String(index).padStart(2, "0")}` : ticket.ticketCode;
      const isSubDone = isMulti ? isSeatCheckedIn(index) : ticket.checkInStatus === "CHECKED_IN";
      const subLabel = isMulti && index > 1 ? `Tamu Pax #${index}` : `${ticket.guestName} (Pemesan Utama)`;
      const svgEl =
        (document.querySelector(`#sub-qr-svg-${index} svg`) as SVGElement | null) ||
        (document.querySelector("#ticket-qr-container svg") as SVGElement | null);

      await downloadTicketAsImage(
        {
          ticketCode: ticket.ticketCode,
          eventTitle: ticket.eventTitle,
          guestName: ticket.guestName,
          guestEmail: ticket.guestEmail,
          ticketCount: ticket.ticketCount,
          totalPrice: ticket.totalPrice,
          paymentMethod: ticket.paymentMethod,
          paymentStatus: ticket.paymentStatus,
          eventLocation: ticket.eventLocation,
          eventDate: ticket.eventDate,
          subTicketIndex: isMulti ? index : undefined,
          subTicketCode: subCode,
          subGuestLabel: subLabel,
          subCheckedIn: isSubDone,
        },
        svgEl
      );
    } finally {
      setIsDownloadingTicket(false);
    }
  };

  const handleDownloadActiveTicket = async () => {
    if (!ticket) return;
    await handleDownloadSubTicket(selectedTicketIndex);
  };

  const handleDownloadAllTickets = async () => {
    if (!ticket) return;
    setIsDownloadingTicket(true);
    try {
      if ((ticket.ticketCount || 1) <= 1) {
        await handleDownloadSubTicket(1);
        return;
      }
      for (let i = 1; i <= ticket.ticketCount; i++) {
        await handleDownloadSubTicket(i);
        await new Promise((res) => setTimeout(res, 350));
      }
    } finally {
      setIsDownloadingTicket(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadErrorMessage("Harap pilih file gambar (JPG, PNG, atau WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadErrorMessage("Ukuran gambar maksimal 5MB.");
      return;
    }

    setProofFile(file);
    setUploadErrorMessage(null);

    const reader = new FileReader();
    reader.onload = () => {
      setProofPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofFile) {
      setUploadErrorMessage("Silakan pilih file bukti transfer terlebih dahulu.");
      return;
    }

    try {
      setIsUploadingProof(true);
      setUploadErrorMessage(null);

      const formData = new FormData();
      formData.append("file", proofFile);
      if (proofNote.trim()) {
        formData.append("note", proofNote.trim());
      }

      const res = await fetch(`/api/events/tickets/${encodeURIComponent(token)}`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengunggah bukti transfer.");
      }

      setUploadSuccessMessage("Bukti transfer berhasil dikirim! Menunggu verifikasi admin.");
      setProofFile(null);
      setProofPreview(null);
      setIsReuploading(false);
      // Refresh ticket data
      await fetchTicket();
    } catch (err: any) {
      setUploadErrorMessage(err.message || "Gagal mengirim bukti pembayaran.");
    } finally {
      setIsUploadingProof(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#3B7A57] animate-spin" />
          <span className="text-xs text-slate-500 font-semibold tracking-wide">
            Mengambil E-Tiket Resmi...
          </span>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Tiket Tidak Ditemukan
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {error || "Tautan privat e-tiket ini tidak valid atau telah dibatalkan."}
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Link href="/events/tickets/recovery">
              <Button
                variant="outline"
                className="w-full text-xs font-bold border-slate-200 dark:border-slate-700 rounded-xl"
              >
                Cari Tiket Pesanan Guest
              </Button>
            </Link>
            <Link href="/events">
              <Button className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold rounded-xl shadow-xs">
                Kembali ke Daftar Event
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isPaid = ticket.paymentStatus === "PAID";
  const isPending = ticket.paymentStatus === "PENDING";
  const isCancelled = ticket.paymentStatus === "CANCELLED";
  const isCheckedIn = ticket.checkInStatus === "CHECKED_IN";
  const isPartiallyCheckedIn = ticket.checkInStatus === "PARTIALLY_CHECKED_IN";

  const isMultiTicket = (ticket.ticketCount || 1) > 1;
  const activeSubIndex = isMultiTicket ? selectedTicketIndex : 1;
  const activeSubCode = isMultiTicket
    ? `${ticket.ticketCode}-${String(activeSubIndex).padStart(2, "0")}`
    : ticket.ticketCode;
  const isCurrentSubDone = isMultiTicket ? isSeatCheckedIn(activeSubIndex) : isCheckedIn;
  const activeGuestLabel =
    isMultiTicket && activeSubIndex > 1
      ? `Tamu Pax #${activeSubIndex}`
      : `${ticket.guestName} (Pemesan Utama)`;
  const activeQrPayload = JSON.stringify({
    ticketCode: activeSubCode,
    eventId: ticket.eventId,
    seat: activeSubIndex,
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 py-6 px-4 sm:px-6">
      {/* Top Header Navigation */}
      <div className="max-w-xl w-full mx-auto flex items-center justify-between pb-5 border-b border-slate-200/80 dark:border-slate-800/80">
        <Link
          href={`/events/${ticket.eventId}`}
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#3B7A57] dark:hover:text-[#52B788] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Detail Event</span>
        </Link>

        <div className="flex items-center space-x-2">
          <ThemeToggle variant="pill" />
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyLink}
            className="text-xs h-8 px-2.5 font-bold border-slate-200 dark:border-slate-700 rounded-xl"
          >
            {isCopiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                <span>Tautan Disalin!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                <span>Bagikan</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main E-Ticket Container */}
      <div className="max-w-xl w-full mx-auto my-6 pb-12 space-y-4">
        {/* Ticket Header Voucher Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          {/* Top Banner Ribbon */}
          <div className="bg-gradient-to-r from-[#3B7A57] to-[#2E6044] p-5 sm:p-6 text-white flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-black tracking-widest text-emerald-200 block">
                E-Tiket Komunitas Resmi
              </span>
              <h3 className="text-base sm:text-lg font-black leading-tight">
                DAGO Creative Hub
              </h3>
            </div>
            <Badge
              className={`border-0 text-[10px] font-black tracking-wide px-3 py-1 ${
                isPaid
                  ? "bg-emerald-400 text-slate-900"
                  : isPending
                  ? "bg-amber-400 text-slate-900"
                  : "bg-rose-400 text-white"
              }`}
            >
              {isPaid
                ? "TERKONFIRMASI (LUNAS)"
                : isPending
                ? "MENUNGGU PEMBAYARAN"
                : "DIBATALKAN"}
            </Badge>
          </div>

          {/* Ticket Body Content */}
          <div className="p-5 sm:p-7 pb-8 sm:pb-12 space-y-5">
            {/* Event Overview */}
            <div className="space-y-1">
              {ticket.eventDetails?.category && (
                <span className="text-[10px] font-black uppercase text-[#3B7A57] dark:text-[#52B788] tracking-wider block">
                  {ticket.eventDetails.category}
                </span>
              )}
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
                {ticket.eventTitle}
              </h1>
              {ticket.eventDetails?.organizerName && (
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Diselenggarakan oleh{" "}
                  <strong className="text-slate-700 dark:text-slate-300">
                    {ticket.eventDetails.organizerName}
                  </strong>
                </p>
              )}
            </div>

            {/* Key Event Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-start space-x-2.5">
                <Calendar className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Waktu Acara</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 leading-snug block">
                    {formatDate(ticket.eventDate)}
                  </span>
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <MapPin className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Lokasi Venue</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 leading-snug block">
                    {ticket.eventLocation}
                  </span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ticket.eventLocation)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-[11px] text-[#3B7A57] dark:text-[#52B788] hover:underline font-bold mt-1"
                  >
                    <span>Buka Rute Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Multi-Ticket Selector Tabs */}
            {isPaid && isMultiTicket && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                    <Ticket className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
                    <span>Pilih QR Tiket ({activeSubIndex} dari {ticket.ticketCount}):</span>
                  </span>
                  <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                    Kehadiran: <strong>{ticket.checkedInQty || (isCheckedIn ? ticket.ticketCount : 0)}/{ticket.ticketCount}</strong>
                  </span>
                </div>

                <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                  {Array.from({ length: ticket.ticketCount }).map((_, idx) => {
                    const seatNum = idx + 1;
                    const isSelected = activeSubIndex === seatNum;
                    const isDone = isSeatCheckedIn(seatNum);
                    return (
                      <button
                        key={seatNum}
                        type="button"
                        onClick={() => setSelectedTicketIndex(seatNum)}
                        className={`flex-1 min-w-[95px] py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center border cursor-pointer ${
                          isSelected
                            ? "bg-[#3B7A57] text-white border-[#3B7A57] shadow-sm scale-[1.02]"
                            : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#3B7A57]/50"
                        }`}
                      >
                        <div className="flex items-center justify-center space-x-1">
                          <span>Tiket #${seatNum}</span>
                          {isDone && <Check className="w-3 h-3 text-emerald-400 inline" />}
                        </div>
                        <span className={`text-[9.5px] block truncate font-normal ${isSelected ? "text-emerald-100" : "text-slate-400"}`}>
                          {seatNum === 1 ? "Pemesan" : `Tamu #${seatNum}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* QR Code Presentation Section */}
            <div className="space-y-2">
              {isPaid ? (
                isCurrentSubDone ? (
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center space-y-2.5">
                    <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                      <Check className="w-8 h-8 stroke-[3]" />
                    </div>
                    <Badge className="bg-slate-800 text-white dark:bg-slate-700 text-xs font-bold">
                      {isMultiTicket ? `TIKET #${activeSubIndex} SELESAI CHECK-IN` : "SELESAI CHECK-IN (SUDAH DIGUNAKAN)"}
                    </Badge>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                      {isMultiTicket
                        ? `Tiket #${activeSubIndex} (${activeSubCode}) milik ${activeGuestLabel} telah diverifikasi hadir di venue.`
                        : `Seluruh ${ticket.ticketCount} tiket dalam pemesanan ini telah diverifikasi hadir oleh panitia di venue.`}
                    </p>
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200/60 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300 max-w-sm text-left">
                      🛡️ <strong>Keamanan Tiket:</strong> Tiket ini sudah digunakan untuk akses masuk. Sistem gerbang resmi Dago Creative Hub secara otomatis menolak pemindaian ulang jika tautan atau QR code ini ditunjukkan kembali oleh pihak lain.
                    </div>
                  </div>
                ) : (
                  <div id="ticket-qr-container" className="p-6 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="p-3.5 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center">
                      <QRCodeSVG
                        value={activeQrPayload}
                        size={170}
                        level="M"
                        includeMargin
                      />
                    </div>

                    {isPartiallyCheckedIn && (
                      <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-bold">
                        Check-in Sebagian: {ticket.checkedInQty || 1} dari {ticket.ticketCount} Tiket Hadir
                      </Badge>
                    )}

                    <div className="space-y-1">
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">
                        {isMultiTicket
                          ? `QR Check-in Tiket #${activeSubIndex} (${activeGuestLabel}) Aktif`
                          : "QR Check-in Aktif & Valid"}
                      </span>
                      <div className="font-mono font-black text-sm text-slate-900 dark:text-white tracking-wider">
                        {activeSubCode}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                        {isMultiTicket
                          ? `Tunjukkan QR Code ini kepada panitia saat Tiket #${activeSubIndex} masuk ke lokasi acara.`
                          : "Tunjukkan QR Code ini kepada panitia saat registrasi ulang di venue acara."}
                      </p>
                    </div>
                  </div>
                )
              ) : isPending ? (
                <div className="space-y-3">
                  {/* Lock Warning */}
                  <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 flex items-start space-x-3 text-left">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-700 dark:text-amber-300 shrink-0">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <h5 className="font-bold text-xs text-amber-900 dark:text-amber-100">
                        QR Check-in Menunggu Pembayaran
                      </h5>
                      <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                        Silakan lakukan <strong>Transfer Bank Manual</strong> sesuai nominal di bawah, lalu <strong>unggah bukti transfer</strong> agar e-tiket dan QR Code Anda segera aktif.
                      </p>
                    </div>
                  </div>

                  {/* 60-Minute Payment Deadline Countdown */}
                  {timeLeft && (
                    <div
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                        timeLeft.isExpired
                          ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                          : "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Clock
                          className={`w-5 h-5 shrink-0 ${
                            timeLeft.isExpired ? "text-rose-500" : "text-[#3B7A57] dark:text-[#52B788] animate-pulse"
                          }`}
                        />
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-500 dark:text-slate-400">
                            Batas Waktu Pembayaran (Tenggat 60 Menit)
                          </span>
                          <span className="text-xs font-semibold">
                            {timeLeft.isExpired
                              ? "Tenggat waktu transfer 60 menit telah berakhir."
                              : `Selesaikan pembayaran sebelum pukul ${new Intl.DateTimeFormat("id-ID", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "Asia/Makassar",
                                }).format(new Date(new Date(ticket.createdAt).getTime() + 60 * 60 * 1000))} WITA`}
                          </span>
                        </div>
                      </div>
                      {!timeLeft.isExpired && (
                        <div className="font-mono font-black text-base sm:text-lg text-[#3B7A57] dark:text-[#52B788] bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800/80 shadow-2xs shrink-0">
                          {String(timeLeft.minutes).padStart(2, "0")}:{String(timeLeft.seconds).padStart(2, "0")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-800 text-center space-y-1.5">
                  <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
                  <h5 className="font-bold text-sm text-rose-900 dark:text-rose-200">Tiket Dibatalkan</h5>
                  <p className="text-xs text-rose-700 dark:text-rose-300 max-w-xs mx-auto">
                    Pemesanan tiket ini telah dibatalkan atau kedaluwarsa, sehingga hak hadir tidak berlaku.
                  </p>
                </div>
              )}
            </div>

            {/* Booking Code Banner */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Kode Booking Manual
                </span>
                <span className="font-mono font-black text-base text-slate-900 dark:text-white">
                  {ticket.ticketCode}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyTicketCode}
                className="text-xs h-8 px-2.5 rounded-xl border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                {isCopiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    <span>Disalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    <span>Salin</span>
                  </>
                )}
              </Button>
            </div>

            {/* Order Details Breakdown */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block border-b border-slate-200/60 dark:border-slate-700/60 pb-1.5">
                Rincian Pesanan
              </span>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Nama Pemesan:</span>
                <span className="font-bold text-slate-900 dark:text-white">{ticket.guestName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Email Pemesan:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{ticket.guestEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Jumlah Tiket:</span>
                <span className="font-bold text-slate-900 dark:text-white">{ticket.ticketCount} Tiket</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="font-bold text-slate-700 dark:text-slate-300">Total Nominal:</span>
                <span className="font-black text-[#3B7A57] dark:text-[#52B788] text-sm">
                  {ticket.totalPrice > 0 ? formatCurrencyIDR(ticket.totalPrice) : "Gratis (RSVP)"}
                </span>
              </div>
            </div>

            {/* Sub-tickets Breakdown for Multiple Tickets */}
            {ticket.ticketCount > 1 && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
                <button
                  type="button"
                  onClick={() => setIsSubTicketsOpen(!isSubTicketsOpen)}
                  className="w-full flex items-center justify-between font-bold text-slate-900 dark:text-white cursor-pointer"
                >
                  <span className="flex items-center space-x-1.5">
                    <Ticket className="w-4 h-4 text-[#3B7A57]" />
                    <span>
                      Daftar {ticket.ticketCount} Tiket Anda ({ticket.checkedInQty || (isCheckedIn ? ticket.ticketCount : 0)}/{ticket.ticketCount} Hadir)
                    </span>
                  </span>
                  {isSubTicketsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isSubTicketsOpen && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-150">
                    {Array.from({ length: ticket.ticketCount }).map((_, idx) => {
                      const ticketIndex = idx + 1;
                      const subTicketCode = `${ticket.ticketCode}-${String(ticketIndex).padStart(2, "0")}`;
                      const isSubCheckedIn = isSeatCheckedIn(ticketIndex);
                      const isCurrentlySelected = activeSubIndex === ticketIndex;
                      const subQrData = JSON.stringify({
                        ticketCode: subTicketCode,
                        eventId: ticket.eventId,
                        seat: ticketIndex,
                      });

                      return (
                        <div
                          key={subTicketCode}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isCurrentlySelected
                              ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-[#3B7A57] ring-1 ring-[#3B7A57]"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-[10px] text-slate-400 uppercase">Tiket #${ticketIndex}</span>
                                <span
                                  className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full ${
                                    isSubCheckedIn
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                  }`}
                                >
                                  {isSubCheckedIn ? "Hadir" : "Belum Hadir"}
                                </span>
                              </div>
                              <div className="font-mono text-xs font-black text-slate-900 dark:text-white">
                                {subTicketCode}
                              </div>
                              <span className="text-[10.5px] text-slate-600 dark:text-slate-400 block truncate">
                                {ticketIndex === 1 ? `${ticket.guestName} (Pemesan Utama)` : `Tamu Pax #${ticketIndex}`}
                              </span>
                            </div>

                            {/* Mini QR code for quick glance */}
                            {isPaid && (
                              <div
                                id={`sub-qr-svg-${ticketIndex}`}
                                className="p-1 bg-white rounded-lg shadow-2xs border border-slate-200 shrink-0"
                                title={`QR Tiket #${ticketIndex}`}
                              >
                                <QRCodeSVG
                                  value={subQrData}
                                  size={64}
                                  level="M"
                                />
                              </div>
                            )}
                          </div>

                          {/* Quick Actions for this sub-ticket */}
                          <div className="flex items-center space-x-2 pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTicketIndex(ticketIndex);
                                if (typeof window !== "undefined") {
                                  window.scrollTo({ top: 380, behavior: "smooth" });
                                }
                              }}
                              className={`flex-1 py-1 px-2 rounded-lg text-[10.5px] font-bold transition-colors cursor-pointer text-center ${
                                isCurrentlySelected
                                  ? "bg-[#3B7A57] text-white"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                              }`}
                            >
                              {isCurrentlySelected ? "QR Sedang Tampil" : "Tampilkan QR"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadSubTicket(ticketIndex)}
                              disabled={isDownloadingTicket}
                              className="py-1 px-2 rounded-lg text-[10.5px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-[#3B7A57] dark:text-[#52B788] hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 cursor-pointer flex items-center space-x-1"
                              title="Download e-tiket PNG untuk tiket ini"
                            >
                              <Download className="w-3 h-3" />
                              <span>Unduh PNG</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Payment Transfer & Proof Upload Section */}
            {isPending && (
              <div className="space-y-4 pt-1">

                  {/* Transfer Amount Card */}
                  <div className="p-4 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-slate-50 dark:to-slate-800/40 rounded-2xl border border-emerald-500/20 text-left space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Total Nominal Transfer Pas
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-black text-[#3B7A57] dark:text-[#52B788]">
                        {formatCurrencyIDR(ticket.totalPrice)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyTotal(ticket.totalPrice)}
                        className="text-xs h-7 px-2.5 rounded-lg border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 cursor-pointer"
                      >
                        {isCopiedTotal ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            <span>Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" />
                            <span>Salin Nominal</span>
                          </>
                        )}
                      </Button>
                    </div>
                    <span className="text-[10px] text-slate-500 block italic">
                      *Pastikan nominal transfer pas hingga digit terakhir untuk kemudahan verifikasi.
                    </span>
                  </div>

                  {/* Destination Bank Accounts */}
                  <div className="space-y-2 text-left">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#3B7A57]" />
                      <span>{isPaid ? "Rekening Tujuan Pembayaran Tiket Ini:" : "Rekening Resmi Tujuan Transfer Aktif:"}</span>
                    </span>

                    {ticket.isOriginalBankDeactivated && isPending && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <div>
                          <p className="font-bold text-[11px]">Pembaruan Rekening Pembayaran:</p>
                          <p className="text-[10.5px] leading-snug">
                            Rekening tujuan yang tertera saat pemesanan awal telah dinonaktifkan oleh administrator. Harap lakukan pembayaran ke rekening resmi yang sedang aktif di bawah ini.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {(() => {
                        let displayBanks: any[] = [];
                        if (isPaid) {
                          // Paid: Show historical destination where funds were sent
                          displayBanks = ticket.destinationBankSnapshot ? [ticket.destinationBankSnapshot] : [];
                        } else {
                          // Pending: If original bank is deactivated, use activeDestinationBank; otherwise active snapshot or activeBankAccounts
                          if (ticket.activeDestinationBank) {
                            displayBanks = [ticket.activeDestinationBank];
                          } else if (ticket.destinationBankSnapshot && !ticket.isOriginalBankDeactivated) {
                            displayBanks = [ticket.destinationBankSnapshot];
                          } else if (ticket.activeBankAccounts && ticket.activeBankAccounts.length > 0) {
                            displayBanks = ticket.activeBankAccounts;
                          }
                        }

                        if (displayBanks.length === 0) {
                          return (
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 text-center">
                              Belum ada rekening bank pembayaran aktif yang ditetapkan pada sistem. Silakan hubungi admin platform.
                            </div>
                          );
                        }

                        const hasDemoBank = displayBanks.some((b) => String(b.accountHolder || "").includes("DEMO"));

                        return (
                          <div className="space-y-3">
                            {hasDemoBank && (
                              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-xl text-[10.5px] text-amber-800 dark:text-amber-300 font-bold leading-relaxed">
                                ⚠️ PERHATIAN (MODE PENGUJIAN/DEMO): Rekening berikut adalah placeholder demo sistem. Jangan lakukan transfer uang sungguhan.
                              </div>
                            )}
                            {displayBanks.map((bank) => (
                              <div
                                key={bank.accountNumber}
                                className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 flex items-center justify-between shadow-2xs hover:border-[#3B7A57] transition-colors"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                      {bank.bankName}
                                    </span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                      {bank.label || bank.badge || "Rekening Resmi"}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono font-bold text-sm text-[#3B7A57] dark:text-[#52B788]">
                                      {bank.accountNumber}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      a.n. {bank.accountHolder}
                                    </span>
                                  </div>
                                  {bank.branch && (
                                    <span className="text-[9.5px] text-slate-400 block">
                                      Cabang: {bank.branch}
                                    </span>
                                  )}
                                </div>

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCopyAccount(bank.accountNumber)}
                                  className="h-7 px-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#3B7A57] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg cursor-pointer"
                                >
                                  {copiedAccount === bank.accountNumber ? (
                                    <>
                                      <Check className="w-3 h-3 mr-1 text-emerald-600" />
                                      <span className="text-emerald-600">Disalin</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 mr-1" />
                                      <span>Salin</span>
                                    </>
                                  )}
                                </Button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Payment Rejection Alert Banner */}
                  {ticket.paymentRejectionReason && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1 text-left">
                      <div className="flex items-center space-x-1.5 font-bold text-amber-800 dark:text-amber-300">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Bukti Pembayaran Perlu Diperbaiki:</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        {ticket.paymentRejectionReason}
                      </p>
                      <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80 italic pt-0.5">
                        Silakan unggah ulang foto bukti transfer baru yang jelas dan valid di bawah ini.
                      </p>
                    </div>
                  )}

                  {/* Upload Bukti Transfer Box */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-left">
                    {uploadSuccessMessage && (
                      <div className="mb-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between animate-in fade-in">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>{uploadSuccessMessage}</span>
                        </div>
                        <button
                          onClick={() => setUploadSuccessMessage(null)}
                          className="text-[10px] underline font-bold cursor-pointer"
                        >
                          Tutup
                        </button>
                      </div>
                    )}

                    {uploadErrorMessage && (
                      <div className="mb-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between animate-in fade-in">
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                          <span>{uploadErrorMessage}</span>
                        </div>
                        <button
                          onClick={() => setUploadErrorMessage(null)}
                          className="text-[10px] underline font-bold cursor-pointer"
                        >
                          Tutup
                        </button>
                      </div>
                    )}

                    {ticket.paymentProofUrl && !isReuploading ? (
                      /* Bukti Transfer Telah Diunggah */
                      <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                              Bukti Transfer Berhasil Diunggah
                            </span>
                          </div>
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-0 text-[10px] font-bold">
                            Menunggu Verifikasi
                          </Badge>
                        </div>

                        <div className="flex items-center space-x-3 p-2 bg-white dark:bg-slate-800 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                          <div
                            onClick={() => setIsPreviewModalOpen(true)}
                            className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 shrink-0 cursor-pointer group"
                            title="Klik untuk melihat bukti ukuran penuh"
                          >
                            <img
                              src={ticket.paymentProofUrl}
                              alt="Bukti Transfer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                              <Eye className="w-4 h-4" />
                            </div>
                          </div>

                          <div className="space-y-0.5 min-w-0 flex-1">
                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block truncate">
                              Foto Struk / Tangkapan Layar
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Diunggah:{" "}
                              {ticket.paymentProofUploadedAt
                                ? formatDate(ticket.paymentProofUploadedAt)
                                : "Baru saja"}
                            </span>
                            {ticket.paymentProofNote && (
                              <p className="text-[10px] text-slate-500 italic truncate">
                                Catatan: &quot;{ticket.paymentProofNote}&quot;
                              </p>
                            )}
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsPreviewModalOpen(true)}
                            className="text-[11px] h-7 px-2 font-bold border-slate-200 dark:border-slate-700 cursor-pointer"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            <span>Lihat</span>
                          </Button>
                        </div>

                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Admin kami sedang memverifikasi transaksi Anda. Anda akan menerima notifikasi dan QR Code akan aktif otomatis setelah diverifikasi.
                        </p>

                        <div className="pt-1 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setIsReuploading(true)}
                            className="text-[11px] font-bold text-[#3B7A57] hover:underline cursor-pointer"
                          >
                            Unggah Ulang Bukti Lain &rarr;
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Form Upload Bukti Transfer */
                      <form onSubmit={handleUploadProof} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                            <Upload className="w-3.5 h-3.5 text-[#3B7A57]" />
                            <span>Unggah Bukti Transfer Pembayaran:</span>
                          </span>
                          {isReuploading && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsReuploading(false);
                                setProofFile(null);
                                setProofPreview(null);
                              }}
                              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline cursor-pointer"
                            >
                              Batal
                            </button>
                          )}
                        </div>

                        {/* File Dropzone */}
                        <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#3B7A57] dark:hover:border-[#52B788] rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 cursor-pointer transition-colors group">
                          {proofPreview ? (
                            <div className="space-y-2 text-center">
                              <img
                                src={proofPreview}
                                alt="Preview Bukti"
                                className="max-h-36 mx-auto rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 object-contain"
                              />
                              <span className="text-[11px] font-semibold text-[#3B7A57] block">
                                Ganti Foto / File Bukti
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-1 text-center py-2">
                              <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center mx-auto">
                                <ImageIcon className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                                Klik untuk memilih foto bukti transfer
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                Format JPG, PNG, atau WEBP (Maksimal 5MB)
                              </span>
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>

                        {/* Note Input */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            Nama Pengirim / Catatan Rekening (Opsional):
                          </label>
                          <input
                            type="text"
                            value={proofNote}
                            onChange={(e) => setProofNote(e.target.value)}
                            placeholder="Contoh: Transfer via m-BCA a.n. Budi Santoso"
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#3B7A57]"
                          />
                        </div>

                        {/* Submit Button */}
                        <Button
                          type="submit"
                          disabled={!proofFile || isUploadingProof}
                          className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs py-2.5 rounded-xl shadow-md cursor-pointer flex items-center justify-center space-x-2"
                        >
                          {isUploadingProof ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Mengunggah Bukti Pembayaran...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5" />
                              <span>Kirim Bukti Pembayaran &rarr;</span>
                            </>
                          )}
                        </Button>
                      </form>
                    )}
                  </div>
              </div>
            )}

            {/* Private Access Notice */}
            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/60 dark:border-emerald-800/50 flex items-start space-x-2 text-[11px] text-emerald-900 dark:text-emerald-200">
              <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Tautan halaman ini bersifat privat dan terenkripsi. Anda dapat menyimpan atau menandai (*bookmark*) halaman ini di browser Anda untuk membuka e-tiket kembali kapan saja tanpa perlu login.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 pb-6 space-y-3">
              {isPaid && (
                <div className={`grid ${isMultiTicket ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"} gap-2.5`}>
                  <Button
                    type="button"
                    onClick={handleDownloadActiveTicket}
                    disabled={isDownloadingTicket}
                    variant="outline"
                    className="w-full text-xs font-bold border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer h-10 py-2.5"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    <span>
                      {isDownloadingTicket
                        ? "Mengunduh..."
                        : isMultiTicket
                        ? `Download Tiket #${activeSubIndex} (PNG)`
                        : "Download Tiket"}
                    </span>
                  </Button>

                  {isMultiTicket && (
                    <Button
                      type="button"
                      onClick={handleDownloadAllTickets}
                      disabled={isDownloadingTicket}
                      className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold rounded-xl h-10 py-2.5 cursor-pointer shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      <span>Download Semua ({ticket.ticketCount} Tiket)</span>
                    </Button>
                  )}
                </div>
              )}

              <Link href="/events" className="block w-full">
                <Button
                  variant="outline"
                  className="w-full text-xs font-bold rounded-xl h-10 py-2.5 cursor-pointer border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span>Kembali ke Daftar Event</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bukti Transfer Full Size Modal */}
      {isPreviewModalOpen && ticket?.paymentProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Bukti Transfer: {ticket.ticketCode}
              </span>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2 py-1 rounded-lg cursor-pointer"
              >
                ✕ Tutup
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={ticket.paymentProofUrl}
                alt="Bukti Transfer"
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between text-xs text-slate-500">
              <span>{ticket.guestName} ({ticket.guestEmail})</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsPreviewModalOpen(false)}
                className="text-xs h-7 px-3 font-bold cursor-pointer"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="max-w-xl w-full mx-auto text-center text-[11px] text-slate-400 pt-4">
        DAGO Creative Hub • Event Marketplace Private E-Ticket System
      </div>
    </div>
  );
}
