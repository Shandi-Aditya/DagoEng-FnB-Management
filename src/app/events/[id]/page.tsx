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
  Lock,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicCommunityEvent, EventTicketOrder } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();

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

  // Prefill booking form from authenticated unified session
  useEffect(() => {
    if (user && isBookingModalOpen) {
      setBookingForm((prev) => ({
        ...prev,
        guestName: prev.guestName || user.name || "",
        guestEmail: prev.guestEmail || user.email || "",
        guestPhone: prev.guestPhone || user.phone || "",
      }));
    }
  }, [user, isBookingModalOpen]);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Payment Instruction State for Paid Events
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [pendingTicket, setPendingTicket] = useState<EventTicketOrder | null>(null);

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

      // Save to customer's personal ticket list for Customer Portal integration
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("dago_my_event_tickets");
          const existingList: EventTicketOrder[] = stored ? JSON.parse(stored) : [];
          const updated = [orderData, ...existingList.filter((t) => t.id !== orderData.id)];
          localStorage.setItem("dago_my_event_tickets", JSON.stringify(updated));
        } catch (e) {
          console.error("Failed to store ticket in local history", e);
        }
      }

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

  const handleProceedToTicketView = () => {
    if (!pendingTicket) return;
    setIsPaymentModalOpen(false);
    setIssuedTicket(pendingTicket);
    setIsTicketModalOpen(true);
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
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/events"
            className="inline-flex items-center text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-[#3B7A57] dark:hover:text-[#52B788] transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5 transition-transform group-hover:-translate-x-1" />
            <span>Katalog Event</span>
          </Link>

          <div className="flex items-center space-x-2 sm:space-x-2.5">
            <Link href="/customer?tab=PROFILE">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 px-2.5 sm:px-3 font-bold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#3B7A57] hover:text-[#3B7A57] rounded-xl transition-all"
              >
                <Ticket className="w-3.5 h-3.5 mr-1 text-[#3B7A57] dark:text-[#52B788]" />
                <span className="hidden sm:inline">Tiket Saya</span>
                <span className="sm:hidden">Tiket</span>
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="text-xs font-semibold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl"
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 lg:pb-12">
        {/* Breadcrumbs */}
        <nav className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">
          <Link href="/" className="hover:text-slate-800 dark:hover:text-white transition-colors">
            Beranda
          </Link>
          <span className="text-slate-400">/</span>
          <Link href="/events" className="hover:text-slate-800 dark:hover:text-white transition-colors">
            Event Komunitas
          </Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-800 dark:text-slate-200 font-bold truncate max-w-xs sm:max-w-md">
            {event.title}
          </span>
        </nav>

        {/* Poster Showcase Container with Cinematic Blur Backdrop */}
        <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-200/80 dark:border-slate-800 aspect-[16/9] sm:aspect-[21/9] mb-8 shadow-lg group">
          {/* Blurred Background Glow */}
          <div
            className="absolute inset-0 bg-cover bg-center filter blur-2xl opacity-40 scale-110"
            style={{ backgroundImage: `url(${event.posterUrl})` }}
          />

          {/* Sharp Foreground Poster */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.posterUrl}
            alt={event.title}
            className="relative z-10 w-full h-full object-cover sm:object-contain object-center"
          />
          <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Badges Floating over poster */}
          <div className="absolute top-4 left-4 z-30 flex items-center space-x-2">
            <Badge className="bg-slate-950/85 backdrop-blur-md text-white border-0 text-xs font-bold px-3 py-1 shadow-xs">
              {event.category}
            </Badge>
            {isPast ? (
              <Badge variant="outline" className="bg-rose-950/85 text-rose-300 border-rose-800 text-xs px-2.5 py-1">
                Event Telah Berlalu
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-[#3B7A57]/90 text-white border-emerald-600 text-xs px-2.5 py-1">
                Event Mendatang
              </Badge>
            )}
          </div>

          <div className="absolute bottom-4 left-4 right-4 z-30 text-white">
            <div className="flex items-center space-x-2 mb-1.5 text-xs text-emerald-300 font-bold drop-shadow-xs">
              <Users className="w-3.5 h-3.5" />
              <span>Komunitas: {event.organizerName}</span>
            </div>
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight drop-shadow-md">
              {event.title}
            </h1>
          </div>
        </div>

        {/* Content Layout: 2-Column Eventbrite Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Details, Highlights, About & Guidelines (Col 8) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Quick Highlights Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-slate-800 shadow-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Waktu Acara</span>
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <Clock className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788] shrink-0" />
                  <span className="truncate">WIB</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                  {new Date(event.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lokasi Venue</span>
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{event.location.split(",")[0] || event.location}</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                  Dago Creative Hub
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kategori</span>
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{event.category}</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                  Kegiatan Publik
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tiket Masuk</span>
                <div className="flex items-center space-x-1.5 text-xs font-black text-[#3B7A57] dark:text-[#52B788]">
                  <Ticket className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{event.isPaid ? formatCurrencyIDR(event.price) : "GRATIS"}</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                  {event.isPaid ? "Per Tiket Peserta" : "RSVP Terbuka"}
                </span>
              </div>
            </div>

            {/* About Event Card */}
            <Card className="p-6 sm:p-7 bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788]" />
                <span>Tentang Acara Ini</span>
              </h2>
              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line space-y-4">
                {event.description}
              </div>
            </Card>

            {/* Guidelines Card */}
            <Card className="p-6 sm:p-7 bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788]" />
                <span>Panduan & Fasilitas Acara</span>
              </h2>
              <ul className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-3">
                {event.guidelines && event.guidelines.length > 0 ? (
                  event.guidelines.map((guide, idx) => (
                    <li key={idx} className="flex items-start space-x-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0 mt-0.5" />
                      <span>{guide}</span>
                    </li>
                  ))
                ) : (
                  <>
                    <li className="flex items-start space-x-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0 mt-0.5" />
                      <span>Harap hadir 15 menit sebelum acara dimulai untuk registrasi ulang tiket QR di venue.</span>
                    </li>
                    <li className="flex items-start space-x-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0 mt-0.5" />
                      <span>Koneksi Wi-Fi publik berkecepatan tinggi gratis untuk seluruh peserta acara di area hub.</span>
                    </li>
                    <li className="flex items-start space-x-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0 mt-0.5" />
                      <span>Tersedia aneka pilihan kopi spesialti dan menu makanan dari tenant F&B di lokasi.</span>
                    </li>
                  </>
                )}
              </ul>
            </Card>

            {/* Organizer Profile Card */}
            <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center font-black text-lg border border-emerald-200 dark:border-emerald-800">
                  {event.organizerName.charAt(0)}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Penyelenggara Resmi</span>
                  <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">{event.organizerName}</h4>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Komunitas Terverifikasi Dago Hub</span>
                </div>
              </div>

              <Link href="/events">
                <Button variant="outline" size="sm" className="text-xs font-bold rounded-xl border-slate-200 dark:border-slate-700">
                  Lihat Acara Lainnya
                </Button>
              </Link>
            </Card>
          </div>

          {/* Right Column: Sticky Eventbrite-Style Ticket Box (Col 4) */}
          <div className="lg:col-span-4 lg:sticky lg:top-20 space-y-4 self-start lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto pr-1 pb-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
            <Card className="p-5 sm:p-6 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-md space-y-4">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Tiket Masuk
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl sm:text-3xl font-black text-[#3B7A57] dark:text-[#52B788]">
                    {event.isPaid ? formatCurrencyIDR(event.price) : "GRATIS"}
                  </span>
                  {event.isPaid && <span className="text-xs text-slate-400 font-medium">/ orang</span>}
                </div>
              </div>

              {/* Public Ticket Availability Progress Bar */}
              {event.availability ? (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <Ticket className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Ketersediaan Kuota
                      </span>
                    </div>
                    {event.availability.isSoldOut ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                        Tiket Habis
                      </span>
                    ) : event.availability.occupancyRate >= 80 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
                        Sisa Sedikit
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
                        Tersedia
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      <strong className="text-slate-900 dark:text-slate-100 font-bold">{event.availability.ticketsReserved}</strong> dari{" "}
                      <strong className="text-slate-900 dark:text-slate-100 font-bold">{event.availability.totalCapacity}</strong> tiket terisi
                    </span>
                    <span className="font-bold text-[#3B7A57] dark:text-[#52B788]">
                      {event.availability.occupancyRate}%
                    </span>
                  </div>

                  <div
                    className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={event.availability.occupancyRate}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Progres Ketersediaan Tiket"
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        event.availability.isSoldOut
                          ? "bg-rose-500"
                          : event.availability.occupancyRate >= 80
                          ? "bg-amber-500"
                          : "bg-[#3B7A57] dark:bg-[#52B788]"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, event.availability.occupancyRate))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
                    <span>
                      {event.availability.isSoldOut ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">Semua tiket telah dipesan</span>
                      ) : (
                        <span>
                          <strong className="text-slate-800 dark:text-slate-200 font-semibold">{event.availability.ticketsRemaining}</strong> tiket tersisa
                        </span>
                      )}
                    </span>
                    <span className="italic text-[9.5px]">
                      {event.availability.isConfirmed ? "Kapasitas Resmi" : "Estimasi Venue"}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Schedule Info */}
              <div className="space-y-2.5 text-xs pt-0.5">
                <div className="flex items-start space-x-3">
                  <Calendar className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">Jadwal Acara</span>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] leading-snug">
                      {formatDateRange(event.startDate, event.endDate)}
                    </span>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">Lokasi Acara</span>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] leading-snug">
                      {event.location}
                    </span>
                  </div>
                </div>
              </div>

              {/* Primary Action Button */}
              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2">
                {isPast ? (
                  <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Acara ini telah selesai dilaksanakan.
                  </div>
                ) : event.availability?.isSoldOut ? (
                  <Button
                    disabled
                    className="w-full bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-xs py-3.5 rounded-2xl cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    <Ticket className="w-4 h-4" />
                    <span>Tiket Habis Terjual (Sold Out)</span>
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        setBookingError(null);
                        setIsBookingModalOpen(true);
                      }}
                      className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-sm py-3.5 rounded-2xl shadow-lg shadow-[#3B7A57]/25 flex items-center justify-center space-x-2 transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer touch-manipulation"
                    >
                      <Ticket className="w-4 h-4" />
                      <span>{event.isPaid ? "Pesan Tiket Sekarang" : "Daftar Tiket Gratis (RSVP)"}</span>
                    </Button>

                    {hasValidExternalUrl && (
                      <a
                        href={event.externalRegistrationUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center text-[11px] text-slate-500 dark:text-slate-400 hover:text-[#3B7A57] dark:hover:text-[#52B788] transition-colors py-1 flex items-center justify-center space-x-1 font-medium"
                      >
                        <span>Pendaftaran eksternal penyelenggara</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    )}
                  </>
                )}
              </div>

              {/* Trust Signals */}
              <div className="pt-2 text-[10.5px] text-slate-500 dark:text-slate-400 space-y-1.5 border-t border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788] shrink-0" />
                  <span>Konfirmasi instan & penerbitan e-tiket otomatis</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788] shrink-0" />
                  <span>QR Code check-in resmi Dago Creative Hub</span>
                </div>
              </div>
            </Card>

            {/* Host an Event Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-slate-100 dark:from-[#1E293B] dark:to-[#161F31] border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Ingin Mengadakan Event Komunitas?
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Jangkau audiens di Singaraja & manfaatkan fasilitas amphitheater, meeting room, dan lab Dago Hub.
              </p>
              <Link href="/events/submit" className="block pt-0.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-bold text-[#3B7A57] dark:text-[#52B788] border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl"
                >
                  Ajukan Event Komunitas
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sticky Bottom CTA Bar (Eventbrite-style for mobile screens) */}
      {!isPast && !event.availability?.isSoldOut && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3.5 px-4 flex items-center justify-between shadow-xl">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block leading-none">Harga</span>
            <span className="text-base font-black text-[#3B7A57] dark:text-[#52B788]">
              {event.isPaid ? formatCurrencyIDR(event.price) : "GRATIS"}
            </span>
          </div>

          <Button
            onClick={() => {
              setBookingError(null);
              setIsBookingModalOpen(true);
            }}
            className="bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md cursor-pointer"
          >
            <Ticket className="w-3.5 h-3.5 mr-1.5" />
            <span>{event.isPaid ? "Pesan Tiket" : "Daftar RSVP"}</span>
          </Button>
        </div>
      )}

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
      {/* 2. MODAL INSTRUKSI PEMBAYARAN TIKET BERBAYAR */}
      {/* ===================================================================== */}
      {isPaymentModalOpen && pendingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Instruksi Pembayaran Tiket</span>
              <span className="text-[10px] font-mono bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                MENUNGGU VERIFIKASI
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-slate-400">Total Nominal Pembayaran:</span>
              <h2 className="text-2xl font-black text-[#3B7A57] dark:text-[#52B788]">
                {formatCurrencyIDR(pendingTicket.totalPrice)}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                {pendingTicket.ticketCount}x Tiket • {pendingTicket.eventTitle}
              </p>
            </div>

            {/* Booking Code Banner */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
                Kode Booking Registrasi:
              </span>
              <span className="font-mono font-bold text-base text-slate-900 dark:text-white">
                {pendingTicket.ticketCode}
              </span>
            </div>

            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/50 rounded-xl text-[11px] text-amber-800 dark:text-amber-200 text-left leading-relaxed space-y-1.5">
              <div className="flex items-center space-x-1.5 font-bold text-amber-900 dark:text-amber-100">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Status Pemesanan: Menunggu Verifikasi</span>
              </div>
              <p>
                Pemesanan tiket Anda telah tersimpan di sistem. Selesaikan pembayaran nominal tepat melalui transfer bank atau kasir operasional DAGO Creative Hub.
              </p>
              <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                Tiket akan diverifikasi dan disahkan oleh panitia/administrator sebelum acara berlangsung.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <Button
                onClick={handleProceedToTicketView}
                className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs py-2.5 rounded-xl shadow-md cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>Lihat E-Tiket (Menunggu Verifikasi)</span>
              </Button>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 py-1 font-medium transition-colors cursor-pointer"
              >
                Tutup Panduan Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. MODAL DIGITAL E-TIKET RESMI (DATA LANGSUNG DARI SERVER) */}
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
              <Badge className={`border-0 text-[10px] font-black tracking-wide ${
                issuedTicket.paymentStatus === "PAID"
                  ? "bg-emerald-400 text-slate-900"
                  : "bg-amber-400 text-slate-900"
              }`}>
                {issuedTicket.paymentStatus === "PAID" ? "TERKONFIRMASI (LUNAS)" : "MENUNGGU VERIFIKASI PEMBAYARAN"}
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

              {/* QR Code Bar with Status Enforcement */}
              {issuedTicket.paymentStatus === "PAID" ? (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center space-x-3">
                  <div className="w-12 h-12 bg-slate-900 rounded-xl p-1 text-white flex items-center justify-center shrink-0">
                    <QrCode className="w-9 h-9" />
                  </div>
                  <div className="text-[11px] text-emerald-900 dark:text-emerald-200 leading-snug">
                    <span className="font-bold block text-emerald-800 dark:text-emerald-300">QR Check-in Aktif</span>
                    Tunjukkan e-tiket atau kode booking ini kepada panitia acara di venue saat registrasi ulang.
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/30 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 flex items-center space-x-3 text-left">
                  <div className="w-12 h-12 bg-slate-900 rounded-xl p-1 text-amber-400 flex items-center justify-center shrink-0 relative overflow-hidden">
                    <QrCode className="w-8 h-8 opacity-30" />
                    <Lock className="w-4 h-4 text-amber-400 absolute" />
                  </div>
                  <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
                    <span className="font-bold block text-amber-800 dark:text-amber-300 mb-0.5">
                      QR Check-in Belum Aktif
                    </span>
                    Tiket berstatus <span className="font-semibold underline">Menunggu Verifikasi Pembayaran</span>. Selesaikan pembayaran sebelum acara agar diverifikasi lunas dan dapat digunakan untuk check-in.
                  </div>
                </div>
              )}

              {issuedTicket.paymentStatus === "PENDING" && issuedTicket.dokuPaymentUrl && (
                <a
                  href={issuedTicket.dokuPaymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center space-x-2 bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs py-2.5 rounded-xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Bayar Sekarang via DOKU Checkout</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

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

              <div className="text-center pt-1 border-t border-slate-100 dark:border-slate-800">
                <Link
                  href="/customer?tab=PROFILE"
                  className="inline-flex items-center space-x-1 text-xs font-bold text-[#3B7A57] dark:text-[#52B788] hover:underline"
                >
                  <Ticket className="w-3.5 h-3.5 mr-1" />
                  <span>Lihat Seluruh Tiket di Portal Saya &rarr;</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

