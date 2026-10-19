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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { PublicCommunityEvent } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [event, setEvent] = useState<PublicCommunityEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

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

              {/* External Registration Action */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                {isPast ? (
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Acara ini telah selesai dilaksanakan.
                  </div>
                ) : hasValidExternalUrl ? (
                  <a
                    href={event.externalRegistrationUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs py-2.5 rounded-xl shadow-md shadow-emerald-900/10 flex items-center justify-center space-x-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]">
                      <span>Daftar Sekarang (Link Eksternal)</span>
                      <ExternalLink className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </a>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-center text-xs text-emerald-800 dark:text-emerald-300">
                    <span className="font-bold block">Tanpa Registrasi Awal</span>
                    Peserta dipersilakan langsung hadir di lokasi (walk-in).
                  </div>
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
    </div>
  );
}
