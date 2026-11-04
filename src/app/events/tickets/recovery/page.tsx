"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Ticket,
  Search,
  Mail,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function TicketRecoveryPage() {
  const [ticketCode, setTicketCode] = useState("");
  const [email, setEmail] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [recoveredToken, setRecoveredToken] = useState<string | null>(null);
  const [recoveredTicketInfo, setRecoveredTicketInfo] = useState<{
    ticketCode: string;
    eventTitle: string;
    paymentStatus: string;
  } | null>(null);

  // Email recovery request form state
  const [requestEmail, setRequestEmail] = useState("");
  const [isRequestingEmail, setIsRequestingEmail] = useState(false);
  const [emailRequestSuccess, setEmailRequestSuccess] = useState(false);
  const [emailRecoveryFeedback, setEmailRecoveryFeedback] = useState<string | null>(null);
  const [recoveredEmailTickets, setRecoveredEmailTickets] = useState<any[]>([]);

  const handleSearchWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketCode.trim() || !email.trim()) {
      setSearchError("Kode tiket dan alamat email wajib diisi.");
      return;
    }

    try {
      setIsSearching(true);
      setSearchError(null);
      setRecoveredToken(null);
      setRecoveredTicketInfo(null);

      const query = new URLSearchParams({
        ticketCode: ticketCode.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
      });

      const res = await fetch(`/api/events/bookings/my?${query.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success || !json.data || json.data.length === 0) {
        setSearchError(
          "Tiket dengan kombinasi kode booking dan email tersebut tidak ditemukan. Periksa kembali ejaan Anda."
        );
        return;
      }

      const match = json.data[0];
      if (!match.guestToken) {
        setSearchError(
          "Tiket ini adalah tiket warisan (legacy) tanpa token tautan privat langsung. Silakan tunjukkan kode booking ini kepada panitia saat registrasi di venue atau hubungi admin DagoEng."
        );
        return;
      }

      setRecoveredToken(match.guestToken);
      setRecoveredTicketInfo({
        ticketCode: match.ticketCode,
        eventTitle: match.eventTitle,
        paymentStatus: match.paymentStatus,
      });
    } catch (err: any) {
      setSearchError(err.message || "Terjadi kesalahan saat memulihkan tiket.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleRequestEmailLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestEmail.trim()) return;

    try {
      setIsRequestingEmail(true);
      setEmailRequestSuccess(false);
      setEmailRecoveryFeedback(null);
      setRecoveredEmailTickets([]);

      const res = await fetch("/api/events/bookings/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: requestEmail.trim().toLowerCase() }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setEmailRecoveryFeedback(json.error || "Gagal memproses permintaan pemulihan tiket.");
        return;
      }

      setEmailRequestSuccess(true);
      setEmailRecoveryFeedback(
        json.message ||
          "Permintaan pemulihan tiket telah dikirim. Demi keamanan dan privasi data kepemilikan tiket Anda, tautan akses dikirimkan ke kotak masuk email terdaftar."
      );
    } catch (err: any) {
      setEmailRecoveryFeedback(err.message || "Terjadi kesalahan pada sistem.");
    } finally {
      setIsRequestingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 py-8 px-4 sm:px-6">
      <div className="max-w-xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <Link
            href="/events"
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-[#3B7A57] dark:hover:text-[#52B788]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Daftar Event</span>
          </Link>
          <ThemeToggle variant="pill" />
        </div>

        {/* Page Title Card */}
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center mx-auto mb-2">
            <Ticket className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Pusat Pemulihan Akses Tiket
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Kehilangan tautan e-tiket atau lupa menyimpannya? Cari kembali tiket Anda di sini secara aman.
          </p>
        </div>

        {/* Option 1: Instant Lookup with Ticket Code + Email */}
        <Card className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Search className="w-4 h-4 text-[#3B7A57]" />
              <span>Akses Cepat: Kode Booking & Email</span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Masukkan kombinasi kode booking (misal: DAGO-EVT-XXXXX) dan alamat email pemesan.
            </p>
          </div>

          <form onSubmit={handleSearchWithCode} className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Kode Booking Tiket
              </label>
              <input
                type="text"
                value={ticketCode}
                onChange={(e) => setTicketCode(e.target.value)}
                placeholder="Contoh: DAGO-EVT-48246"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Alamat Email Pemesan
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email.pemesan@example.com"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
              />
            </div>

            {searchError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <p className="leading-snug">{searchError}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isSearching}
              className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer shadow-xs flex items-center justify-center space-x-1.5"
            >
              {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Cari & Buka E-Tiket Saya</span>
            </Button>
          </form>

          {/* Recovery Success Result */}
          {recoveredToken && recoveredTicketInfo && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-950 dark:text-emerald-100 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>E-Tiket Ditemukan!</span>
                </div>
                <div className="space-y-0.5 text-[11px]">
                  <p className="font-bold">{recoveredTicketInfo.eventTitle}</p>
                  <p className="font-mono text-slate-600 dark:text-slate-300">
                    Kode: {recoveredTicketInfo.ticketCode} • Status: {recoveredTicketInfo.paymentStatus}
                  </p>
                </div>
                <Link href={`/events/tickets/${recoveredToken}`}>
                  <Button className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold py-2 rounded-xl mt-1 cursor-pointer">
                    <span>Buka Tautan E-Tiket Privat Sekarang</span>
                    <ExternalLink className="w-3 h-3 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Card>

        {/* Option 2: Request Ticket Recovery Link via Email */}
        <Card className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Mail className="w-4 h-4 text-[#3B7A57]" />
              <span>Lupa Kode Booking? Cari Tiket via Email</span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Masukkan alamat email Anda yang digunakan saat mendaftar event untuk memulihkan seluruh tiket pesanan Anda.
            </p>
          </div>

          {emailRequestSuccess ? (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-950 dark:text-emerald-100 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-bold">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span className="text-sm">Permintaan Berhasil Diproses</span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-900/90 dark:text-emerald-200/90">
                  {emailRecoveryFeedback}
                </p>
                <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 flex items-start space-x-2 text-[10.5px] text-emerald-800/80 dark:text-emerald-300/80">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    Demi mencegah pembajakan tiket dan penyalahgunaan QR Code oleh pihak lain, tautan akses tiket tidak ditampilkan langsung di peramban publik.
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p className="font-bold text-[11px] text-slate-800 dark:text-slate-200">
                  Punya Kode Booking (Contoh: DAGO-EVT-XXXXX)?
                </p>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  Jika Anda masih menyimpan kode booking dari bukti konfirmasi atau pesan chat, Anda dapat menggunakan formulir di atas untuk langsung membuka tiket Anda.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmailRequestSuccess(false);
                  setRequestEmail("");
                }}
                className="w-full text-xs font-bold rounded-xl border-slate-200 dark:border-slate-700 cursor-pointer mt-2"
              >
                Kirim Permintaan untuk Email Lain
              </Button>
            </div>
          ) : (
            <form onSubmit={handleRequestEmailLinks} className="space-y-3">
              {emailRecoveryFeedback && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <p className="leading-snug">{emailRecoveryFeedback}</p>
                </div>
              )}

              <input
                type="email"
                required
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
                placeholder="Masukkan alamat email pemesan..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
              />

              <Button
                type="submit"
                disabled={isRequestingEmail || !requestEmail.trim()}
                className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer shadow-xs flex items-center justify-center space-x-1.5"
              >
                {isRequestingEmail ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Mail className="w-3.5 h-3.5 mr-1.5" />
                )}
                <span>Cari Tiket Saya</span>
              </Button>
            </form>
          )}
        </Card>

        {/* Account User Option */}
        <div className="text-center p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-400 space-y-1">
          <p>Sudah memiliki akun DagoEng?</p>
          <Link
            href={`/login?returnTo=${encodeURIComponent("/customer?tab=PROFILE")}&from=events&mode=customer`}
            className="font-bold text-[#3B7A57] dark:text-[#52B788] hover:underline inline-flex items-center"
          >
            <span>Masuk ke Akun DagoEng</span>
            <ExternalLink className="w-3 h-3 ml-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}
