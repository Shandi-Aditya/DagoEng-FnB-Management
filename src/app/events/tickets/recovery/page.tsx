"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Ticket,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Phone,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface RecoveredBooking {
  id: string;
  ticketCode: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  guestName: string;
  guestEmail: string;
  ticketCount: number;
  paymentStatus: string;
  guestToken?: string;
}

export default function TicketRecoveryPage() {
  // Mode: false = Cari dengan Kode Booking (Default), true = Lupa Kode Booking (Email + No WhatsApp)
  const [isForgotCode, setIsForgotCode] = useState(false);

  // Common email state
  const [email, setEmail] = useState("");

  // Mode 1 (Default): Ticket Code + Email
  const [ticketCode, setTicketCode] = useState("");
  const [isSearchingCode, setIsSearchingCode] = useState(false);
  const [codeSearchError, setCodeSearchError] = useState<string | null>(null);
  const [codeRecoveredToken, setCodeRecoveredToken] = useState<string | null>(null);
  const [codeRecoveredInfo, setCodeRecoveredInfo] = useState<{
    ticketCode: string;
    eventTitle: string;
    paymentStatus: string;
  } | null>(null);

  // Mode 2: Phone + Email (Lupa Kode Booking)
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
  const [phoneSearchError, setPhoneSearchError] = useState<string | null>(null);
  const [phoneRecoveredList, setPhoneRecoveredList] = useState<RecoveredBooking[]>([]);

  // CS WhatsApp Contact (configurable via NEXT_PUBLIC_CS_WHATSAPP)
  const CS_WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_CS_WHATSAPP || "6281234567890";
  const getWhatsAppLink = (customEmail?: string) => {
    const em = customEmail || email || "";
    const msg = em
      ? `Halo Admin Dago Hub, saya lupa kode booking tiket event saya untuk email (${em}). Mohon bantu verifikasi dan kirimkan e-tiket saya. Terima kasih!`
      : `Halo Admin Dago Hub, saya lupa kode booking tiket event saya di DagoEng. Mohon bantu verifikasi e-tiket saya. Terima kasih!`;
    return `https://wa.me/${CS_WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  };

  // Handler for Mode 1: Cari dengan Kode Booking
  const handleSearchWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketCode.trim() || !email.trim()) {
      setCodeSearchError("Kode booking tiket dan alamat email wajib diisi.");
      return;
    }

    try {
      setIsSearchingCode(true);
      setCodeSearchError(null);
      setCodeRecoveredToken(null);
      setCodeRecoveredInfo(null);

      const query = new URLSearchParams({
        ticketCode: ticketCode.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
      });

      const res = await fetch(`/api/events/bookings/my?${query.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success || !json.data || json.data.length === 0) {
        if (res.status === 403) {
          setCodeSearchError(
            json.error || "Akses ditolak: Anda saat ini masuk dengan sesi akun yang berbeda. Silakan logout terlebih dahulu untuk memulihkan tiket guest ini."
          );
          return;
        }
        setCodeSearchError(
          "Tiket dengan kombinasi kode booking dan email tersebut tidak ditemukan. Periksa kembali ejaan Anda atau gunakan tombol 'Lupa kode booking?' di atas."
        );
        return;
      }

      const match = json.data[0];
      if (!match.guestToken) {
        setCodeSearchError(
          "Tiket ini adalah tiket warisan (legacy) tanpa token tautan privat langsung. Silakan tunjukkan kode booking ini kepada panitia saat registrasi di venue atau hubungi admin DagoEng."
        );
        return;
      }

      setCodeRecoveredToken(match.guestToken);
      setCodeRecoveredInfo({
        ticketCode: match.ticketCode,
        eventTitle: match.eventTitle,
        paymentStatus: match.paymentStatus,
      });
    } catch (err: any) {
      setCodeSearchError(err.message || "Terjadi kesalahan saat memulihkan tiket.");
    } finally {
      setIsSearchingCode(false);
    }
  };

  // Handler for Mode 2: Lupa Kode Booking (Email + No WhatsApp)
  const handleSearchWithPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !phoneNumber.trim()) {
      setPhoneSearchError("Alamat email dan nomor WhatsApp/HP wajib diisi.");
      return;
    }

    try {
      setIsSearchingPhone(true);
      setPhoneSearchError(null);
      setPhoneRecoveredList([]);

      const query = new URLSearchParams({
        email: email.trim().toLowerCase(),
        phone: phoneNumber.trim(),
      });

      const res = await fetch(`/api/events/bookings/my?${query.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        if (res.status === 403) {
          setPhoneSearchError(
            json.error || "Akses ditolak: Anda saat ini masuk dengan sesi akun yang berbeda. Silakan logout terlebih dahulu untuk memulihkan tiket guest ini."
          );
          return;
        }
        setPhoneSearchError(
          json.error || "Gagal melakukan pencarian tiket. Harap periksa koneksi Anda."
        );
        return;
      }

      if (!json.data || json.data.length === 0) {
        setPhoneSearchError(
          "Tidak ditemukan tiket dengan kombinasi Email dan Nomor WhatsApp tersebut. Pastikan nomor WhatsApp yang Anda masukkan sama dengan data saat registrasi checkout."
        );
        return;
      }

      setPhoneRecoveredList(json.data);
    } catch (err: any) {
      setPhoneSearchError(err.message || "Terjadi kesalahan saat memulihkan tiket.");
    } finally {
      setIsSearchingPhone(false);
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

        {/* SINGLE UNIFIED CARD */}
        <Card className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
          {!isForgotCode ? (
            /* DEFAULT FORM: KODE BOOKING & EMAIL */
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Search className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788]" />
                  <span>Akses Cepat: Kode Booking & Email</span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Masukkan kombinasi kode booking (misal: DAGO-EVT-XXXXX) dan alamat email pemesan.
                </p>
              </div>

              <form onSubmit={handleSearchWithCode} className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Kode Booking Tiket
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotCode(true);
                        setCodeSearchError(null);
                        setPhoneSearchError(null);
                      }}
                      className="text-[11px] font-semibold text-[#3B7A57] dark:text-[#52B788] hover:underline cursor-pointer"
                    >
                      Lupa kode booking? Klik di sini
                    </button>
                  </div>
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
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email.pemesan@example.com"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                  />
                </div>

                {codeSearchError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                    <p className="leading-snug">{codeSearchError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSearchingCode}
                  className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer shadow-xs flex items-center justify-center space-x-1.5"
                >
                  {isSearchingCode ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>Cari & Buka E-Tiket Saya</span>
                </Button>
              </form>

              {/* Code Lookup Success Result */}
              {codeRecoveredToken && codeRecoveredInfo && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                  <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-950 dark:text-emerald-100 space-y-2">
                    <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>E-Tiket Ditemukan!</span>
                    </div>
                    <div className="space-y-0.5 text-[11px]">
                      <p className="font-bold">{codeRecoveredInfo.eventTitle}</p>
                      <p className="font-mono text-slate-600 dark:text-slate-300">
                        Kode: {codeRecoveredInfo.ticketCode} • Status: {codeRecoveredInfo.paymentStatus}
                      </p>
                    </div>
                    <Link href={`/events/tickets/${codeRecoveredToken}`}>
                      <Button className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold py-2 rounded-xl mt-1 cursor-pointer">
                        <span>Buka Tautan E-Tiket Privat Sekarang</span>
                        <ExternalLink className="w-3 h-3 ml-1.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* RECOVERY FORM: EMAIL & NO WHATSAPP (LUPA KODE BOOKING) */
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788]" />
                  <span>Pemulihan Mandiri: Email & No. WhatsApp</span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Masukkan email dan nomor WhatsApp yang digunakan saat mendaftar tiket untuk membuka e-tiket Anda seketika.
                </p>
              </div>

              <form onSubmit={handleSearchWithPhone} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Alamat Email Pemesan
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email.pemesan@example.com"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Nomor WhatsApp / HP Terdaftar
                  </label>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Contoh: 08123456789 atau 628123456789"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                  />
                </div>

                {phoneSearchError && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 space-y-2">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                      <p className="leading-snug">{phoneSearchError}</p>
                    </div>
                    <div className="pt-2 border-t border-rose-200/60 dark:border-rose-800/60 flex items-center justify-between">
                      <span className="text-[10.5px] text-rose-700 dark:text-rose-300">
                        Masih kesulitan menemukan tiket?
                      </span>
                      <a
                        href={getWhatsAppLink(email)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Chat CS WhatsApp</span>
                      </a>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSearchingPhone}
                  className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer shadow-xs flex items-center justify-center space-x-1.5"
                >
                  {isSearchingPhone ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>Cari & Pulihkan Tiket Saya</span>
                </Button>

                {/* Back to Code search link */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotCode(false);
                      setCodeSearchError(null);
                      setPhoneSearchError(null);
                    }}
                    className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-[#3B7A57] dark:hover:text-[#52B788] hover:underline cursor-pointer"
                  >
                    ← Ingat Kode Booking? Masukkan kode booking di sini
                  </button>
                </div>
              </form>

              {/* Phone Lookup Success List */}
              {phoneRecoveredList.length > 0 && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ditemukan {phoneRecoveredList.length} Tiket Event</span>
                    </span>
                    <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
                      {email}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {phoneRecoveredList.map((bk) => (
                      <div
                        key={bk.id}
                        className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/80 text-xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white line-clamp-1">
                              {bk.eventTitle}
                            </p>
                            <div className="flex items-center space-x-3 text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                              <span className="font-mono font-semibold text-[#3B7A57] dark:text-[#52B788]">
                                {bk.ticketCode}
                              </span>
                              <span>•</span>
                              <span>{bk.ticketCount} Tiket</span>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              bk.paymentStatus === "PAID"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                                : bk.paymentStatus === "PENDING"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {bk.paymentStatus}
                          </span>
                        </div>

                        {bk.guestToken ? (
                          <Link href={`/events/tickets/${bk.guestToken}`} className="block">
                            <Button className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold py-2 rounded-xl cursor-pointer flex items-center justify-center space-x-1">
                              <span>Buka E-Tiket Saya</span>
                              <ExternalLink className="w-3.5 h-3.5 ml-1" />
                            </Button>
                          </Link>
                        ) : (
                          <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-[10.5px] text-amber-800 dark:text-amber-300">
                            Tunjukkan Kode Booking <span className="font-mono font-bold">{bk.ticketCode}</span> saat registrasi di lokasi event.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* WhatsApp CS Fast Support Card */}
        <Card className="p-4 sm:p-5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Butuh Bantuan Langsung dari Admin Acara?
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Hubungi Customer Service Dago Hub via WhatsApp untuk verifikasi manual tiket Anda.
              </p>
            </div>
          </div>
          <a
            href={getWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto shrink-0"
          >
            <Button
              type="button"
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3.5 rounded-xl cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Chat WhatsApp Hub</span>
            </Button>
          </a>
        </Card>

        {/* Account User Option */}
        <div className="text-center p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-400 space-y-1">
          <p>Sudah memiliki akun DagoEng?</p>
          <Link
            href={`/login?returnTo=${encodeURIComponent("/customer?tab=PROFILE")}&from=events&mode=customer`}
            className="font-bold text-[#3B7A57] dark:text-[#52B788] hover:underline inline-flex items-center"
          >
            <span>Masuk ke Akun DagoEng (Tiket Otomatis Muncul di Tiket Saya)</span>
            <ExternalLink className="w-3 h-3 ml-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}
