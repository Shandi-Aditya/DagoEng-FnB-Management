"use client";

import React, { useState } from "react";
import {
  Search,
  Ticket,
  Phone,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UnitScope } from "@/components/app/unit-scope";
import {
  TicketRecoveryHeader,
  TicketRecoveryHero,
  TicketRecoveryResultCard,
  TicketRecoverySupportCard,
  TicketRecoveryAccountNote,
  formatTicketCodeInput,
  normalizePhoneNumber,
  buildSupportWhatsAppUrl,
  type RecoveredBookingItem,
} from "@/features/events-tickets-recovery";

export default function TicketRecoveryPage() {
  // Mode: "code" = Cari dengan Kode Booking (Default), "phone" = Lupa Kode Booking (Email + No WhatsApp)
  const [activeTab, setActiveTab] = useState<string>("code");

  // Common email state
  const [email, setEmail] = useState("");

  // Mode 1: Ticket Code + Email
  const [ticketCode, setTicketCode] = useState("");
  const [isSearchingCode, setIsSearchingCode] = useState(false);
  const [codeSearchError, setCodeSearchError] = useState<string | null>(null);
  const [codeRecoveredBooking, setCodeRecoveredBooking] = useState<RecoveredBookingItem | null>(null);

  // Mode 2: Phone + Email (Lupa Kode Booking)
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
  const [phoneSearchError, setPhoneSearchError] = useState<string | null>(null);
  const [phoneRecoveredList, setPhoneRecoveredList] = useState<RecoveredBookingItem[]>([]);

  // CS WhatsApp Contact (configurable via NEXT_PUBLIC_CS_WHATSAPP)
  const csWhatsappNumber = process.env.NEXT_PUBLIC_CS_WHATSAPP || "6281234567890";

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
      setCodeRecoveredBooking(null);

      const query = new URLSearchParams({
        ticketCode: formatTicketCodeInput(ticketCode),
        email: email.trim().toLowerCase(),
      });

      const res = await fetch(`/api/events/bookings/my?${query.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success || !json.data || json.data.length === 0) {
        if (res.status === 403) {
          setCodeSearchError(
            json.error ||
              "Akses ditolak: Anda saat ini masuk dengan sesi akun yang berbeda. Silakan logout terlebih dahulu untuk memulihkan tiket guest ini."
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

      setCodeRecoveredBooking({
        id: match.id || match.ticketCode,
        ticketCode: match.ticketCode,
        eventTitle: match.eventTitle,
        eventDate: match.eventDate,
        eventLocation: match.eventLocation,
        guestName: match.guestName,
        guestEmail: match.guestEmail,
        ticketCount: match.ticketCount || 1,
        paymentStatus: match.paymentStatus,
        guestToken: match.guestToken,
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
        phone: normalizePhoneNumber(phoneNumber),
      });

      const res = await fetch(`/api/events/bookings/my?${query.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        if (res.status === 403) {
          setPhoneSearchError(
            json.error ||
              "Akses ditolak: Anda saat ini masuk dengan sesi akun yang berbeda. Silakan logout terlebih dahulu untuk memulihkan tiket guest ini."
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
    <div
      data-unit="event"
      className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6"
    >
      <UnitScope unit="event" />

      <main className="max-w-xl w-full mx-auto space-y-6">
        {/* Navigation & Header */}
        <TicketRecoveryHeader />

        {/* Hero Title */}
        <TicketRecoveryHero />

        {/* Single Unified Form Card with Semantic Tabs */}
        <Card className="border-border bg-card/70 shadow-xs">
          <CardContent className="p-5 sm:p-6 space-y-5">
            <Tabs
              value={activeTab}
              onValueChange={(val) => {
                setActiveTab(val as string);
                setCodeSearchError(null);
                setPhoneSearchError(null);
              }}
              className="w-full space-y-4"
            >
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="code" className="gap-1.5">
                  <Ticket className="size-4" />
                  <span>Kode Booking</span>
                </TabsTrigger>
                <TabsTrigger value="phone" className="gap-1.5">
                  <Phone className="size-4" />
                  <span>WhatsApp & Email</span>
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: KODE BOOKING & EMAIL */}
              <TabsContent value="code" className="space-y-4 pt-1">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Search className="size-4 text-primary" />
                    <span>Akses Cepat: Kode Booking & Email</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Masukkan kombinasi kode booking (misal: DAGO-EVT-XXXXX) dan alamat email pemesan.
                  </p>
                </div>

                <form onSubmit={handleSearchWithCode} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="ticketCode" className="text-xs">
                      Kode Booking Tiket
                    </Label>
                    <Input
                      id="ticketCode"
                      type="text"
                      value={ticketCode}
                      onChange={(e) => setTicketCode(e.target.value)}
                      placeholder="Contoh: DAGO-EVT-48246"
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="codeEmail" className="text-xs">
                      Alamat Email Pemesan
                    </Label>
                    <Input
                      id="codeEmail"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email.pemesan@example.com"
                      className="text-xs"
                    />
                  </div>

                  {codeSearchError && (
                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertDescription className="text-xs">
                        {codeSearchError}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSearchingCode}
                    className="w-full gap-2"
                  >
                    {isSearchingCode ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <Search className="size-4" />
                    )}
                    <span>Cari & Buka E-Tiket Saya</span>
                  </Button>
                </form>

                {/* Single Ticket Success Result */}
                {codeRecoveredBooking && (
                  <div className="pt-3 border-t border-border space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                      <CheckCircle2 className="size-4" />
                      <span>E-Tiket Ditemukan!</span>
                    </div>

                    <TicketRecoveryResultCard
                      booking={codeRecoveredBooking}
                      buttonLabel="Buka Tautan E-Tiket Privat Sekarang"
                    />
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: WHATSAPP & EMAIL */}
              <TabsContent value="phone" className="space-y-4 pt-1">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Phone className="size-4 text-primary" />
                    <span>Pemulihan Mandiri: Email & No. WhatsApp</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Masukkan email dan nomor WhatsApp yang digunakan saat mendaftar tiket untuk membuka e-tiket Anda seketika.
                  </p>
                </div>

                <form onSubmit={handleSearchWithPhone} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="phoneEmail" className="text-xs">
                      Alamat Email Pemesan
                    </Label>
                    <Input
                      id="phoneEmail"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email.pemesan@example.com"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phoneNumber" className="text-xs">
                      Nomor WhatsApp / HP Terdaftar
                    </Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Contoh: 08123456789 atau 628123456789"
                      className="text-xs"
                    />
                  </div>

                  {phoneSearchError && (
                    <Alert variant="destructive" className="space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="size-4 shrink-0 mt-0.5" />
                        <AlertDescription className="text-xs">
                          {phoneSearchError}
                        </AlertDescription>
                      </div>

                      <div className="pt-2 border-t border-destructive/20 flex items-center justify-between">
                        <span className="text-xs text-destructive">
                          Masih kesulitan menemukan tiket?
                        </span>
                        <a
                          href={buildSupportWhatsAppUrl(csWhatsappNumber, email)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <MessageCircle className="size-3.5" />
                          <span>Chat CS WhatsApp</span>
                        </a>
                      </div>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSearchingPhone}
                    className="w-full gap-2"
                  >
                    {isSearchingPhone ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <Search className="size-4" />
                    )}
                    <span>Cari & Pulihkan Tiket Saya</span>
                  </Button>
                </form>

                {/* Multiple Tickets Success Result */}
                {phoneRecoveredList.length > 0 && (
                  <div className="pt-3 border-t border-border space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-primary flex items-center gap-1.5">
                        <CheckCircle2 className="size-4" />
                        <span>Ditemukan {phoneRecoveredList.length} Tiket Event</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {email}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {phoneRecoveredList.map((bk) => (
                        <TicketRecoveryResultCard
                          key={bk.id}
                          booking={bk}
                          buttonLabel="Buka E-Tiket Saya"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* WhatsApp CS Fast Support Card */}
        <TicketRecoverySupportCard
          csWhatsappNumber={csWhatsappNumber}
          email={email}
        />

        {/* Account User Option */}
        <TicketRecoveryAccountNote />
      </main>
    </div>
  );
}
