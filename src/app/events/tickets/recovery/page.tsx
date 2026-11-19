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
import { OFFICIAL_CS_WHATSAPP_NUMBER } from "@/lib/contact-config";

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
  const [tab1Email, setTab1Email] = useState("");
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSuccess, setCodeSuccess] = useState<RecoverySuccessState | null>(null);

  // Tab 2 (Lupa Kode Booking) states
  const [tab2Email, setTab2Email] = useState("");
  const [tab2Phone, setTab2Phone] = useState("");
  const [isSubmittingPhone, setIsSubmittingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSuccess, setPhoneSuccess] = useState<RecoverySuccessState | null>(null);

  // CS WhatsApp Contact (central contact configuration)
  const csWhatsappNumber = OFFICIAL_CS_WHATSAPP_NUMBER;

  // Handler for Tab 1: Cari dengan Kode Booking
  const handleRecoverWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formatTicketCodeInput(ticketCode);

    if (!cleanCode) {
      setCodeError("Kode booking tiket wajib diisi.");
      return;
    }

    if (!tab1Email.trim()) {
      setCodeError("Alamat email pemesan wajib diisi.");
      return;
    }

    try {
      setIsSubmittingCode(true);
      setCodeError(null);
      setCodeSuccess(null);

      const payload = {
        mode: "code",
        channel: "email",
        ticketCode: cleanCode,
        email: tab1Email.trim().toLowerCase(),
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
            "Tiket tidak ditemukan atau kontak tidak sesuai. Pastikan kode booking dan alamat email sama dengan data saat pemesanan."
        );
        return;
      }

      setCodeSuccess({
        channel: "email",
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
      setPhoneError("Alamat email dan nomor telepon terdaftar wajib diisi.");
      return;
    }

    const cleanPhone = normalizePhoneNumber(tab2Phone);
    if (cleanPhone.length < 9) {
      setPhoneError("Nomor telepon minimal 9 digit angka.");
      return;
    }

    try {
      setIsSubmittingPhone(true);
      setPhoneError(null);
      setPhoneSuccess(null);

      const payload = {
        mode: "forgot_code",
        channel: "email",
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
        channel: "email",
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
              {/* TAB 1: KODE BOOKING + EMAIL                               */}
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
                        <span>Kirim tautan e-tiket ke email</span>
                      </h2>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Masukkan kode booking dan alamat email pemesan untuk menerima tautan akses privat e-tiket Anda.
                      </p>
                    </div>

                    <form onSubmit={handleRecoverWithCode} className="space-y-4">
                      {/* Booking Code Input */}
                      <div className="space-y-1.5">
                        <Label htmlFor="ticketCode" className="text-xs">
                          Kode booking tiket
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

                      {/* Email Input */}
                      <div className="space-y-1.5">
                        <Label htmlFor="tab1Email" className="text-xs">
                          Alamat email pemesan (terdaftar saat checkout)
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
                        <span>Kirim tautan ke email</span>
                      </Button>
                    </form>
                  </>
                )}
              </TabsContent>

              {/* ========================================================= */}
              {/* TAB 2: LUPA KODE BOOKING (EMAIL + TELEPON)                 */}
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
                        <span>Pemulihan tiket tanpa kode booking</span>
                      </h2>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Masukkan alamat email dan nomor telepon terdaftar. Kami akan memvalidasi data Anda dan mengirimkan tautan e-tiket ke email Anda.
                      </p>
                    </div>

                    <form onSubmit={handleRecoverWithPhone} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="tab2Email" className="text-xs">
                          Alamat email pemesan
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
                          Nomor telepon / WhatsApp terdaftar
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
                        <span>Kirim tautan ke email</span>
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
