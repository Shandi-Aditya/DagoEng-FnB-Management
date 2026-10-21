"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  ArrowLeft,
  Share2,
  Tag,
  User,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  DollarSign,
  Copy,
  Check,
  Ticket,
  QrCode,
  Printer,
  ShieldCheck,
  X,
  CreditCard,
  Building,
  Phone,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { PublicCommunityEvent, EventTicketOrder } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [event, setEvent] = useState<PublicCommunityEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Booking & Ticketing States
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    institution: "",
    ticketCount: 1,
  });
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Payment Simulation State for Paid Events
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [pendingTicket, setPendingTicket] = useState<EventTicketOrder | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  // Issued Digital E-Ticket State
  const [issuedTicket, setIssuedTicket] = useState<EventTicketOrder | null>(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [copiedTicketCode, setCopiedTicketCode] = useState(false);

  useEffect(() => {
    if (id) {
      fetchEventDetail(id);
    }
  }, [id]);

  const fetchEventDetail = async (eventId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/events/${eventId}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error || "Event tidak ditemukan atau belum dipublikasikan.");
        return;
      }

      setEvent(json.data);
    } catch (err: any) {
      setError(err.message || "Gagal memuat informasi event.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const formatDateRange = (startIso: string, endIso: string) => {
    try {
      const s = new Date(startIso);
      const e = new Date(endIso);

      const startDateStr = s.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const startTimeStr = s.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const endTimeStr = e.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });

      return `${startDateStr} • ${startTimeStr} - ${endTimeStr} WIB`;
    } catch {
      return `${startIso} - ${endIso}`;
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    if (!bookingForm.guestName.trim()) {
      setBookingError("Nama lengkap pemesan wajib diisi.");
      return;
    }
    if (!bookingForm.guestEmail.trim()) {
      setBookingError("Alamat email wajib diisi.");
      return;
    }
    if (!bookingForm.guestPhone.trim()) {
      setBookingError("Nomor WhatsApp wajib diisi.");
      return;
    }

    try {
      setIsSubmittingBooking(true);
      setBookingError(null);

      const res = await fetch(`/api/events/${event.id}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingForm),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setBookingError(json.error || "Gagal memproses pendaftaran tiket.");
        return;
      }

      const orderData: EventTicketOrder = json.data;

      setIsBookingModalOpen(false);

      if (event.isPaid && orderData.totalPrice > 0) {
        setPendingTicket(orderData);
        setIsPaymentModalOpen(true);
      } else {
        setIssuedTicket(orderData);
        setIsTicketModalOpen(true);
      }
    } catch (err: any) {
      setBookingError(err.message || "Terjadi kesalahan jaringan.");
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const handleConfirmPayment = () => {
    if (!pendingTicket) return;
    setIsVerifyingPayment(true);
    setTimeout(() => {
      setIsVerifyingPayment(false);
      setIsPaymentModalOpen(false);
      setIssuedTicket(pendingTicket);
      setIsTicketModalOpen(true);
    }, 1200);
  };

  const handleCopyTicketCode = () => {
    if (issuedTicket && typeof window !== "undefined") {
      navigator.clipboard.writeText(issuedTicket.ticketCode);
      setCopiedTicketCode(true);
      setTimeout(() => setCopiedTicketCode(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-[#3B7A57] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 dark:text-slate-400">Memuat detail event...</span>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-[#1E293B] dark:text-[#E2E8F0] flex flex-col justify-center items-center px-4">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
          <AlertCircle className="w-8 h-8 text-rose-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Event Tidak Tersedia</h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm text-center mb-6">
          {error || "Acara ini mungkin belum disetujui kurator atau telah dihapus."}
        </p>
        <Link href="/events">
          <Button className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold px-4 py-2 rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Kembali ke Daftar Event
          </Button>
        </Link>
      </div>
    );
  }

  const isPast = new Date(event.endDate).getTime() < Date.now();
  const hasValidExternalUrl =
    event.externalRegistrationUrl &&
    event.externalRegistrationUrl.trim().length > 0 &&
    (event.externalRegistrationUrl.startsWith("http://") ||
      event.externalRegistrationUrl.startsWith("https://"));

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-[#1E293B] dark:text-[#E2E8F0] transition-colors duration-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-[#0F172A]/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/events"
            className="inline-flex items-center text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#3B7A57] dark:hover:text-[#52B788] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Semua Event Komunitas
          </Link>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="text-xs font-medium border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  <span>Tautan Disalin!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 mr-1" />
                  <span>Bagikan</span>
                </>
              )}
            </Button>
            <ThemeToggle variant="pill" />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Poster Banner */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 aspect-[16/9] sm:aspect-[21/9] mb-8 shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.posterUrl}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Badges Floating over poster */}
          <div className="absolute top-4 left-4 flex items-center space-x-2">
            <Badge className="bg-slate-950/80 backdrop-blur-md text-white border-0 text-xs font-bold px-3 py-1">
              {event.category}
            </Badge>
            {isPast ? (
              <Badge variant="outline" className="bg-rose-950/80 text-rose-300 border-rose-800 text-xs px-2.5">
                Event Telah Berlalu
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-emerald-950/80 text-emerald-300 border-emerald-800 text-xs px-2.5">
                Event Mendatang
              </Badge>
            )}
          </div>

          <div className="absolute bottom-4 left-4 right-4 text-white">
            <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold block mb-1">
              Penyelenggara: {event.organizerName}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight drop-shadow-md">
              {event.title}
            </h1>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Description & Program */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                Tentang Acara Ini
              </h2>
              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {event.description}
              </div>
            </Card>

            <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                Panduan Menghadiri Acara
              </h2>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2.5">
                {event.guidelines && event.guidelines.length > 0 ? (
                  event.guidelines.map((guide, idx) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0 mt-0.5" />
                      <span>{guide}</span>
                    </li>
                  ))
                ) : (
                  <>
                    <li className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0 mt-0.5" />
                      <span>Harap hadir 15 menit sebelum acara dimulai untuk registrasi ulang di venue.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0 mt-0.5" />
                      <span>Koneksi Wi-Fi publik berkecepatan tinggi tersedia gratis untuk seluruh peserta acara.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0 mt-0.5" />
                      <span>Tersedia aneka menu makanan, kopi, dan minuman pendamping di sekitar lokasi acara.</span>
                    </li>
                  </>
                )}
              </ul>
            </Card>
          </div>

          {/* Right Column: Key Details & CTA Action */}
          <div className="space-y-6">
            <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Rincian Pelaksanaan
              </h3>

              {/* Price Row */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Biaya Masuk / Tiket:
                </span>
                <span className="text-xl font-black text-[#3B7A57] dark:text-[#52B788]">
                  {event.isPaid ? formatCurrencyIDR(event.price) : "GRATIS / FREE ENTRY"}
                </span>
              </div>

              {/* Schedule Row */}
              <div className="flex items-start space-x-3 text-xs">
                <Calendar className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">Jadwal Acara</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] leading-snug">
                    {formatDateRange(event.startDate, event.endDate)}
                  </span>
                </div>
              </div>

              {/* Location Row */}
              <div className="flex items-start space-x-3 text-xs">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">Lokasi & Ruangan</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] leading-snug">
                    {event.location}
                  </span>
                </div>
              </div>

              {/* Organizer Row */}
              <div className="flex items-start space-x-3 text-xs">
                <User className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">Komunitas Penyelenggara</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    {event.organizerName}
                  </span>
                </div>
              </div>

              {/* Interactive Booking & Registration Action */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                {isPast ? (
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Acara ini telah selesai dilaksanakan.
                  </div>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        setBookingError(null);
                        setIsBookingModalOpen(true);
                      }}
                      className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs py-3 rounded-xl shadow-md shadow-[#3B7A57]/20 flex items-center justify-center space-x-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer touch-manipulation"
                    >
                      <Ticket className="w-4 h-4" />
                      <span>{event.isPaid ? "Daftar & Pesan Tiket Sekarang" : "Daftar Tiket Gratis (RSVP)"}</span>
                    </Button>

                    {hasValidExternalUrl && (
                      <a
                        href={event.externalRegistrationUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center text-[11px] text-slate-500 dark:text-slate-400 hover:text-[#3B7A57] dark:hover:text-[#52B788] transition-colors py-1 flex items-center justify-center space-x-1"
                      >
                        <span>Atau via link eksternal penyelenggara</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    )}
                  </>
                )}
              </div>
            </Card>

            {/* Host your event CTA */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-slate-100 dark:from-[#1E293B] dark:to-[#161F31] border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Punya Komunitas atau Acara Sendiri?
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Publikasikan agenda acaramu dan jangkau audiens komunitas di kawasan Singaraja dan sekitarnya.
              </p>
              <Link href="/events/submit" className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-bold text-[#3B7A57] dark:text-[#52B788] border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl"
                >
                  Pasang Event Komunitas
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ===================================================================== */}
      {/* 1. MODAL REGISTRASI TIKET GUEST */}
      {/* ===================================================================== */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-[#3B7A57]/15 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Pendaftaran Tiket Event</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs">{event.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBookingModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBookingSubmit} className="p-5 space-y-4">
              {bookingError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-400 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{bookingError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={bookingForm.guestName}
                  onChange={(e) => setBookingForm({ ...bookingForm, guestName: e.target.value })}
                  placeholder="Contoh: Rian Pratama"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#3B7A57]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Alamat Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={bookingForm.guestEmail}
                    onChange={(e) => setBookingForm({ ...bookingForm, guestEmail: e.target.value })}
                    placeholder="nama@email.com"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#3B7A57]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    No. WhatsApp / HP <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={bookingForm.guestPhone}
                    onChange={(e) => setBookingForm({ ...bookingForm, guestPhone: e.target.value })}
                    placeholder="08123456789"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#3B7A57]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Institusi / Komunitas (Opsional)
                </label>
                <input
                  type="text"
                  value={bookingForm.institution}
                  onChange={(e) => setBookingForm({ ...bookingForm, institution: e.target.value })}
                  placeholder="Contoh: Barista Bali / ITB / Freelancer"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#3B7A57]"
                />
              </div>

              {/* Ticket Quantity Stepper */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Jumlah Tiket</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {event.isPaid ? `${formatCurrencyIDR(event.price)} / tiket` : "Tiket Gratis"}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setBookingForm({ ...bookingForm, ticketCount: Math.max(1, bookingForm.ticketCount - 1) })}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-bold text-xs text-slate-900 dark:text-white">
                    {bookingForm.ticketCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBookingForm({ ...bookingForm, ticketCount: Math.min(5, bookingForm.ticketCount + 1) })}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Total Calculation */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Total Biaya Tiket:</span>
                  <span className="text-lg font-black text-[#3B7A57] dark:text-[#52B788]">
                    {event.isPaid
                      ? formatCurrencyIDR(event.price * bookingForm.ticketCount)
                      : "GRATIS"}
                  </span>
                </div>
                <Button
                  type="submit"
                  disabled={isSubmittingBooking}
                  className="bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md cursor-pointer"
                >
                  {isSubmittingBooking ? "Memproses..." : event.isPaid ? "Lanjut Pembayaran" : "Dapatkan Tiket"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ===================================================================== */}
      {/* 2. MODAL PEMBAYARAN QRIS UNTUK EVENT BERBAYAR */}
      {/* ===================================================================== */}
      {isPaymentModalOpen && pendingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Pembayaran QRIS Dago Hub</span>
              <span className="text-[10px] font-mono bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                SIMULASI SISTEM
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-slate-400">Total Nominal Tiket:</span>
              <h2 className="text-2xl font-black text-[#3B7A57] dark:text-[#52B788]">
                {formatCurrencyIDR(pendingTicket.totalPrice)}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">{pendingTicket.ticketCount}x Tiket • {pendingTicket.eventTitle}</p>
            </div>

            {/* Simulated QR Code Canvas */}
            <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 inline-block shadow-inner">
              <div className="w-44 h-44 bg-slate-900 rounded-xl p-2 flex flex-col items-center justify-center relative overflow-hidden">
                <QrCode className="w-36 h-36 text-white" />
                <div className="absolute inset-0 bg-amber-500/10 pointer-events-none" />
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-2">NMID: SIMULASI-DAGO-QRIS-2026</p>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 rounded-xl text-[11px] text-amber-800 dark:text-amber-200 text-left leading-relaxed">
              <span className="font-bold block mb-0.5">ℹ️ Mode Simulasi Pembayaran DAGO:</span>
              Layar ini adalah simulasi QRIS terintegrasi sistem DAGO Creative Hub. Tiket Anda disimpan dengan status <span className="font-bold underline">MENUNGGU VERIFIKASI</span> hingga diverifikasi oleh tim kurator/admin.
            </div>

            <Button
              onClick={handleConfirmPayment}
              disabled={isVerifyingPayment}
              className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs py-2.5 rounded-xl shadow-md cursor-pointer"
            >
              {isVerifyingPayment ? (
                <div className="flex items-center space-x-2">
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Merekam Konfirmasi Simulasi...</span>
                </div>
              ) : (
                "Konfirmasi Bukti Pembayaran Simulasi"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. MODAL DIGITAL E-TIKET RESMI (KONFIRMASI PENDAFTARAN) */}
      {/* ===================================================================== */}
      {isTicketModalOpen && issuedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header Voucher */}
            <div className="bg-gradient-to-r from-[#3B7A57] to-[#2E6044] p-5 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-black tracking-widest text-emerald-200 block">
                  E-Tiket Komunitas Resmi
                </span>
                <h3 className="text-base font-black">DAGO Creative Hub</h3>
              </div>
              <Badge className={`border-0 text-[10px] font-bold ${
                issuedTicket.paymentStatus === "PAID"
                  ? "bg-white/20 text-white"
                  : "bg-amber-400 text-slate-900"
              }`}>
                {issuedTicket.paymentStatus === "PAID" ? "TERKONFIRMASI" : "MENUNGGU VERIFIKASI"}
              </Badge>
            </div>

            {/* Ticket Card Details */}
            <div className="p-6 space-y-5">
              <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Kode Booking Tiket:</span>
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-2xl font-mono font-black text-slate-900 dark:text-white tracking-wider">
                    {issuedTicket.ticketCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyTicketCode}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    title="Salin Kode Tiket"
                  >
                    {copiedTicketCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Event Info */}
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Nama Acara:</span>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{issuedTicket.eventTitle}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Nama Peserta:</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{issuedTicket.guestName}</p>
                    <p className="text-[10px] text-slate-400">{issuedTicket.guestEmail}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Jumlah & Biaya:</span>
                    <p className="font-bold text-[#3B7A57] dark:text-[#52B788]">
                      {issuedTicket.ticketCount} Tiket • {issuedTicket.totalPrice > 0 ? formatCurrencyIDR(issuedTicket.totalPrice) : "GRATIS"}
                    </p>
                    <p className="text-[10px] text-slate-400">{issuedTicket.paymentMethod}</p>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Lokasi Venue:</span>
                  <p className="text-slate-700 dark:text-slate-300 text-[11px]">{issuedTicket.eventLocation}</p>
                </div>
              </div>

              {/* Visual Simulated Check-In QR Bar */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-center space-x-3">
                <div className="w-12 h-12 bg-slate-900 rounded-xl p-1 text-white flex items-center justify-center shrink-0">
                  <QrCode className="w-9 h-9" />
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Tunjukkan e-tiket atau kode booking ini kepada panitia acara di venue saat registrasi ulang.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3 pt-2">
                <Button
                  type="button"
                  onClick={() => window.print()}
                  variant="outline"
                  className="flex-1 text-xs font-bold border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  <span>Cetak Tiket</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => setIsTicketModalOpen(false)}
                  className="flex-1 bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Selesai
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

