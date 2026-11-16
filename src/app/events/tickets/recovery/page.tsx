"use client";

import React, { useState } from "react";
import {
  Ticket,
  Phone,
  AlertCircle,
  RefreshCw,
  MessageCircle,
  Mail,
  Send,
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
  TicketRecoveryConfirmationCard,
  TicketRecoverySupportCard,
  TicketRecoveryAccountNote,
  formatTicketCodeInput,
  normalizePhoneNumber,
  buildSupportWhatsAppUrl,
  DEFAULT_CS_WHATSAPP_NUMBER,
  type RecoveryChannel,
} from "@/features/events-tickets-recovery";

interface RecoverySuccessState {
  channel: RecoveryChannel;
  target?: string;
  configured: boolean;
  message: string;
}

export default function TicketRecoveryPage() {
  // Mode: "code" = Cari dengan Kode Booking (Default), "phone" = Lupa Kode Booking
  const [activeTab, setActiveTab] = useState<string>("code");

  // Tab 1 (Cari dengan Kode Booking) states
  const [ticketCode, setTicketCode] = useState("");
  const [tab1Channel, setTab1Channel] = useState<RecoveryChannel>("whatsapp");
  const [tab1Phone, setTab1Phone] = useState("");
  const [tab1Email, setTab1Email] = useState("");
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSuccess, setCodeSuccess] = useState<RecoverySuccessState | null>(null);

  // Tab 2 (Lupa Kode Booking) states
  const [tab2Email, setTab2Email] = useState("");
  const [tab2Phone, setTab2Phone] = useState("");
  const [tab2Channel, setTab2Channel] = useState<RecoveryChannel>("whatsapp");
  const [isSubmittingPhone, setIsSubmittingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSuccess, setPhoneSuccess] = useState<RecoverySuccessState | null>(null);

  // CS WhatsApp Contact (configurable via NEXT_PUBLIC_CS_WHATSAPP, fallback to central contact)
  const csWhatsappNumber =
    process.env.NEXT_PUBLIC_CS_WHATSAPP || DEFAULT_CS_WHATSAPP_NUMBER;

  // Handler for Tab 1: Cari dengan Kode Booking
  const handleRecoverWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formatTicketCodeInput(ticketCode);

    if (!cleanCode) {
      setCodeError("Kode booking tiket wajib diisi.");
      return;
    }

    if (tab1Channel === "whatsapp") {
      const cleanPhone = normalizePhoneNumber(tab1Phone);
      if (!cleanPhone || cleanPhone.length < 9) {
        setCodeError("Nomor WhatsApp pemesan wajib diisi (minimal 9 digit).");
        return;
      }
    } else {
      if (!tab1Email.trim()) {
        setCodeError("Alamat email pemesan wajib diisi.");
        return;
      }
    }

    try {
      setIsSubmittingCode(true);
      setCodeError(null);
      setCodeSuccess(null);

      const payload = {
        mode: "code",
        channel: tab1Channel,
        ticketCode: cleanCode,
        phone: tab1Channel === "whatsapp" ? normalizePhoneNumber(tab1Phone) : undefined,
        email: tab1Channel === "email" ? tab1Email.trim().toLowerCase() : undefined,
      };

      const res = await fetch("/api/events/bookings/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setCodeError(
          json.error ||
            "Tiket tidak ditemukan atau kontak tidak sesuai. Pastikan kode booking dan kontak sama dengan data saat pemesanan."
        );
        return;
      }

      setCodeSuccess({
        channel: json.channel || tab1Channel,
        target: json.target,
        configured: json.configured ?? json.emailConfigured ?? true,
        message: json.message,
      });
    } catch (err: any) {
      setCodeError(err.message || "Terjadi kesalahan sistem saat memproses pemulihan tiket.");
    } finally {
      setIsSubmittingCode(false);
    }
  };

  // Handler for Tab 2: Lupa Kode Booking
  const handleRecoverWithPhone = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tab2Email.trim() || !tab2Phone.trim()) {
      setPhoneError("Alamat email dan nomor WhatsApp/HP terdaftar wajib diisi.");
      return;
    }

    const cleanPhone = normalizePhoneNumber(tab2Phone);
    if (cleanPhone.length < 9) {
      setPhoneError("Nomor WhatsApp minimal 9 digit angka.");
      return;
    }

    try {
      setIsSubmittingPhone(true);
      setPhoneError(null);
      setPhoneSuccess(null);

      const payload = {
        mode: "forgot_code",
        channel: tab2Channel,
        email: tab2Email.trim().toLowerCase(),
        phone: cleanPhone,
      };

      const res = await fetch("/api/events/bookings/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setPhoneError(json.error || "Gagal memproses permintaan pemulihan tiket.");
        return;
      }

      setPhoneSuccess({
        channel: json.channel || tab2Channel,
        target: json.target,
        configured: json.configured ?? json.emailConfigured ?? true,
        message: json.message,
      });
    } catch (err: any) {
      setPhoneError(err.message || "Terjadi kesalahan sistem saat memulihkan tiket.");
    } finally {
      setIsSubmittingPhone(false);
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
                setCodeError(null);
                setPhoneError(null);
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
                  <span>Lupa Kode Booking</span>
                </TabsTrigger>
              </TabsList>

              {/* ========================================================= */}
              {/* TAB 1: KODE BOOKING + PILIHAN CHANNEL                     */}
              {/* ========================================================= */}
              <TabsContent value="code" className="space-y-4 pt-1">
                {codeSuccess ? (
                  <TicketRecoveryConfirmationCard
                    channel={codeSuccess.channel}
                    target={codeSuccess.target}
                    configured={codeSuccess.configured}
                    message={codeSuccess.message}
                    csWhatsappNumber={csWhatsappNumber}
                    onReset={() => setCodeSuccess(null)}
                  />
                ) : (
                  <>
                    <div className="space-y-1">
                      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Ticket className="size-4 text-primary" />
                        <span>Kirim Tautan E-Tiket via WhatsApp atau Email</span>
                      </h2>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Masukkan kode booking dan pilih saluran pengiriman untuk menerima tautan akses privat e-tiket Anda.
                      </p>
                    </div>

                    <form onSubmit={handleRecoverWithCode} className="space-y-4">
                      {/* Booking Code Input */}
                      <div className="space-y-1.5">
                        <Label htmlFor="ticketCode" className="text-xs">
                          Kode Booking Tiket
                        </Label>
                        <Input
                          id="ticketCode"
                          type="text"
                          required
                          value={ticketCode}
                          onChange={(e) => setTicketCode(e.target.value)}
                          placeholder="Contoh: DAGO-EVT-48246"
                          className="font-mono text-xs"
                        />
                      </div>

                      {/* Delivery Channel Selector */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Kirim Tautan Akses Melalui</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setTab1Channel("whatsapp");
                              setCodeError(null);
                            }}
                            className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                              tab1Channel === "whatsapp"
                                ? "border-primary bg-primary/10 text-primary shadow-2xs font-semibold"
                                : "border-border bg-card/50 text-muted-foreground hover:bg-muted/50"
                            }`}
                          >
                            <MessageCircle className="size-4 shrink-0" />
                            <span>WhatsApp</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTab1Channel("email");
                              setCodeError(null);
                            }}
                            className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                              tab1Channel === "email"
                                ? "border-primary bg-primary/10 text-primary shadow-2xs font-semibold"
                                : "border-border bg-card/50 text-muted-foreground hover:bg-muted/50"
                            }`}
                          >
                            <Mail className="size-4 shrink-0" />
                            <span>Email</span>
                          </button>
                        </div>
                      </div>

                      {/* Dynamic Contact Input depending on selected channel */}
                      {tab1Channel === "whatsapp" ? (
                        <div className="space-y-1.5">
                          <Label htmlFor="tab1Phone" className="text-xs">
                            Nomor WhatsApp Pemesan (Terdaftar saat Checkout)
                          </Label>
                          <Input
                            id="tab1Phone"
                            type="tel"
                            required
                            value={tab1Phone}
                            onChange={(e) => setTab1Phone(e.target.value)}
                            placeholder="Contoh: 08123456789 atau 628123456789"
                            className="text-xs"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Label htmlFor="tab1Email" className="text-xs">
                            Alamat Email Pemesan (Terdaftar saat Checkout)
                          </Label>
                          <Input
                            id="tab1Email"
                            type="email"
                            required
                            value={tab1Email}
                            onChange={(e) => setTab1Email(e.target.value)}
                            placeholder="email.pemesan@example.com"
                            className="text-xs"
                          />
                        </div>
                      )}

                      {codeError && (
                        <Alert variant="destructive">
                          <AlertCircle className="size-4" />
                          <AlertDescription className="text-xs">
                            {codeError}
                          </AlertDescription>
                        </Alert>
                      )}

                      <Button
                        type="submit"
                        size="lg"
                        disabled={isSubmittingCode}
                        className="w-full gap-2"
                      >
                        {isSubmittingCode ? (
                          <RefreshCw className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                        <span>
                          {tab1Channel === "whatsapp"
                            ? "Kirim Tautan ke WhatsApp"
                            : "Kirim Tautan ke Email"}
                        </span>
                      </Button>
                    </form>
                  </>
                )}
              </TabsContent>

              {/* ========================================================= */}
              {/* TAB 2: LUPA KODE BOOKING + PILIHAN CHANNEL                 */}
              {/* ========================================================= */}
              <TabsContent value="phone" className="space-y-4 pt-1">
                {phoneSuccess ? (
                  <TicketRecoveryConfirmationCard
                    channel={phoneSuccess.channel}
                    target={phoneSuccess.target}
                    configured={phoneSuccess.configured}
                    message={phoneSuccess.message}
                    csWhatsappNumber={csWhatsappNumber}
                    onReset={() => setPhoneSuccess(null)}
                  />
                ) : (
                  <>
                    <div className="space-y-1">
                      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Phone className="size-4 text-primary" />
                        <span>Pemulihan Tiket Tanpa Kode Booking</span>
                      </h2>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Masukkan email dan nomor WhatsApp terdaftar. Kami akan memvalidasi data Anda dan mengirimkan tautan e-tiket ke saluran yang Anda pilih.
                      </p>
                    </div>

                    <form onSubmit={handleRecoverWithPhone} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="tab2Email" className="text-xs">
                          Alamat Email Pemesan
                        </Label>
                        <Input
                          id="tab2Email"
                          type="email"
                          required
                          value={tab2Email}
                          onChange={(e) => setTab2Email(e.target.value)}
                          placeholder="email.pemesan@example.com"
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="tab2Phone" className="text-xs">
                          Nomor WhatsApp / HP Terdaftar
                        </Label>
                        <Input
                          id="tab2Phone"
                          type="tel"
                          required
                          value={tab2Phone}
                          onChange={(e) => setTab2Phone(e.target.value)}
                          placeholder="Contoh: 08123456789 atau 628123456789"
                          className="text-xs"
                        />
                      </div>

                      {/* Delivery Channel Selector */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Kirim Tautan Akses Melalui</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setTab2Channel("whatsapp");
                              setPhoneError(null);
                            }}
                            className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                              tab2Channel === "whatsapp"
                                ? "border-primary bg-primary/10 text-primary shadow-2xs font-semibold"
                                : "border-border bg-card/50 text-muted-foreground hover:bg-muted/50"
                            }`}
                          >
                            <MessageCircle className="size-4 shrink-0" />
                            <span>WhatsApp</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTab2Channel("email");
                              setPhoneError(null);
                            }}
                            className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                              tab2Channel === "email"
                                ? "border-primary bg-primary/10 text-primary shadow-2xs font-semibold"
                                : "border-border bg-card/50 text-muted-foreground hover:bg-muted/50"
                            }`}
                          >
                            <Mail className="size-4 shrink-0" />
                            <span>Email</span>
                          </button>
                        </div>
                      </div>

                      {phoneError && (
                        <Alert variant="destructive" className="space-y-2">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="size-4 shrink-0 mt-0.5" />
                            <AlertDescription className="text-xs">
                              {phoneError}
                            </AlertDescription>
                          </div>

                          <div className="pt-2 border-t border-destructive/20 flex items-center justify-between">
                            <span className="text-xs text-destructive">
                              Masih kesulitan menemukan tiket?
                            </span>
                            <a
                              href={buildSupportWhatsAppUrl(csWhatsappNumber, tab2Email)}
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
                        disabled={isSubmittingPhone}
                        className="w-full gap-2"
                      >
                        {isSubmittingPhone ? (
                          <RefreshCw className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                        <span>
                          {tab2Channel === "whatsapp"
                            ? "Kirim Tautan ke WhatsApp"
                            : "Kirim Tautan ke Email"}
                        </span>
                      </Button>
                    </form>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* WhatsApp CS Fast Support Card */}
        <TicketRecoverySupportCard
          csWhatsappNumber={csWhatsappNumber}
          email={tab1Email || tab2Email}
        />

        {/* Account User Option */}
        <TicketRecoveryAccountNote />
      </main>
    </div>
  );
}
