"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, RefreshCw, Search } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { UnitScope } from "@/components/app/unit-scope";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { downloadTicketAsImage } from "@/lib/ticket-download";
import { buildOfficialCsWhatsAppUrl } from "@/lib/contact-config";

import {
  TicketPassHeader,
  TicketEventMeta,
  TicketQRSection,
  TicketOrderSummary,
  TicketSubTicketsList,
  TicketPaymentTransferSection,
  TicketPaymentProofDialog,
  TicketActionsBar,
  TicketRefundSection,
  calculatePaymentDeadline,
  getSubTicketDetails,
  type TicketPassData,
} from "@/features/events-tickets";

export default function PrivateTicketViewPage() {
  const params = useParams();
  const token = (params?.token as string) || "";

  const [ticket, setTicket] = useState<TicketPassData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedTicketIndex, setSelectedTicketIndex] = useState<number>(1);
  const [isDownloadingTicket, setIsDownloadingTicket] = useState(false);

  // 60-Minute Payment Deadline Countdown Timer
  const [timeLeft, setTimeLeft] = useState<{ minutes: number; seconds: number; isExpired: boolean } | null>(null);

  useEffect(() => {
    if (!ticket || ticket.paymentStatus !== "PENDING" || !ticket.createdAt) return;

    const tick = () => {
      setTimeLeft(calculatePaymentDeadline(ticket.createdAt));
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [ticket?.paymentStatus, ticket?.createdAt]);

  useEffect(() => {
    if (token) {
      fetchTicket();
    }
  }, [token]);

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
      const subLabel = isMulti
        ? (index > 1 ? `Tamu Pax #${index}` : `${ticket.guestName} (Pemesan Utama)`)
        : ticket.guestName;
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

  const handleUploadProof = async (file: File, note: string) => {
    try {
      setIsUploadingProof(true);

      const formData = new FormData();
      formData.append("file", file);
      if (note.trim()) {
        formData.append("note", note.trim());
      }

      const res = await fetch(`/api/events/tickets/${encodeURIComponent(token)}`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengunggah bukti transfer.");
      }

      await fetchTicket();
    } finally {
      setIsUploadingProof(false);
    }
  };

  if (isLoading) {
    return (
      <div data-unit="event" className="min-h-screen bg-background flex items-center justify-center p-4">
        <UnitScope unit="event" />
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="size-8 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground font-medium">
            Mengambil tiket...
          </span>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div data-unit="event" className="min-h-screen bg-background flex items-center justify-center p-4">
        <UnitScope unit="event" />
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 sm:p-8 shadow-xl">
          <EmptyState
            icon={<AlertCircle className="size-8 text-destructive" />}
            title="Tiket tidak ditemukan"
            description={error || "Tautan privat e-tiket ini tidak valid atau telah dibatalkan."}
            action={
              <div className="flex flex-col gap-2 w-full mt-2">
                <Button
                  variant="outline"
                  size="lg"
                  render={<Link href="/events/tickets/recovery" />}
                  nativeButton={false}
                >
                  <Search />
                  Cari tiket pesanan
                </Button>
                <Button
                  size="lg"
                  render={<Link href="/events" />}
                  nativeButton={false}
                >
                  Kembali ke katalog event
                </Button>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  const isPaidOrFree = ticket.paymentStatus === "PAID" || ticket.totalPrice === 0;
  const isMultiTicket = (ticket.ticketCount || 1) > 1;

  const activeSubInfo = getSubTicketDetails(
    {
      ticketCode: ticket.ticketCode,
      guestName: ticket.guestName,
      ticketCount: ticket.ticketCount,
      checkedInSeats: ticket.checkedInSeats,
      checkedInQty: ticket.checkedInQty,
      checkInStatus: ticket.checkInStatus,
      eventId: ticket.eventId,
    },
    selectedTicketIndex
  );

  const bankAccounts =
    ticket.paymentStatus === "PAID" && ticket.destinationBankSnapshot
      ? [ticket.destinationBankSnapshot]
      : ticket.activeBankAccounts && ticket.activeBankAccounts.length > 0
      ? ticket.activeBankAccounts
      : ticket.destinationBankSnapshot
      ? [ticket.destinationBankSnapshot]
      : [];

  return (
    <div data-unit="event" className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <UnitScope unit="event" />

      {/* Hidden QR SVGs for high-res PNG export of every seat */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", top: "-9999px", pointerEvents: "none" }}
      >
        {Array.from({ length: ticket.ticketCount || 1 }, (_, i) => i + 1).map((seatNum) => {
          const subCode =
            (ticket.ticketCount || 1) > 1
              ? `${ticket.ticketCode}-${String(seatNum).padStart(2, "0")}`
              : ticket.ticketCode;
          const subPayload = JSON.stringify({
            ticketCode: subCode,
            eventId: ticket.eventId,
            seat: seatNum,
          });
          return (
            <div key={seatNum} id={`sub-qr-svg-${seatNum}`}>
              <QRCodeSVG value={subPayload} size={240} level="M" includeMargin />
            </div>
          );
        })}
      </div>

      <div>
        <TicketPassHeader eventId={ticket.eventId} />

        <main className="mx-auto max-w-2xl px-4 sm:px-6 py-6 space-y-6">
          {/* Main Pass Card */}
          <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
            <div className="p-5 sm:p-6 space-y-6">
              <TicketEventMeta
                title={ticket.eventTitle}
                category={ticket.eventDetails?.category}
                organizerName={ticket.eventDetails?.organizerName}
                eventDate={ticket.eventDate}
                location={ticket.eventLocation}
                paymentStatus={ticket.paymentStatus}
                ticketTierName={ticket.ticketTierName}
                isInvitation={ticket.isInvitation}
              />

              <TicketQRSection
                paymentStatus={ticket.paymentStatus}
                refundStatus={ticket.refundStatus}
                isMultiTicket={isMultiTicket}
                ticketCount={ticket.ticketCount || 1}
                selectedTicketIndex={selectedTicketIndex}
                onSelectTicketIndex={setSelectedTicketIndex}
                activeSubInfo={activeSubInfo}
                isSeatCheckedIn={isSeatCheckedIn}
                timeLeft={timeLeft}
                createdAtIso={ticket.createdAt}
                checkedInQty={ticket.checkedInQty}
              />

              <TicketOrderSummary
                ticketCode={ticket.ticketCode}
                guestName={ticket.guestName}
                guestEmail={ticket.guestEmail}
                guestPhone={ticket.guestPhone}
                institution={ticket.institution}
                ticketCount={ticket.ticketCount}
                totalPrice={ticket.totalPrice}
                ticketTierName={ticket.ticketTierName}
                isInvitation={ticket.isInvitation}
                invitationNote={ticket.invitationNote}
                promoCode={ticket.promoCode}
                discountAmount={ticket.discountAmount}
                subtotalPrice={ticket.subtotalPrice}
              />

              <TicketRefundSection
                bookingId={ticket.id}
                guestToken={token}
                totalPrice={ticket.totalPrice}
                paymentStatus={ticket.paymentStatus}
                refundStatus={ticket.refundStatus}
                refundRequest={ticket.refundRequest}
                refundPolicy={ticket.refundPolicy}
                refundEligibility={ticket.refundEligibility}
                onRefundSubmitted={fetchTicket}
              />

              {isMultiTicket && (
                <TicketSubTicketsList
                  ticket={ticket}
                  isPaid={ticket.paymentStatus === "PAID"}
                  selectedTicketIndex={selectedTicketIndex}
                  onSelectTicketIndex={setSelectedTicketIndex}
                  onDownloadSubTicket={handleDownloadSubTicket}
                  isDownloading={isDownloadingTicket}
                />
              )}

              {ticket.paymentStatus === "PENDING" && ticket.totalPrice > 0 && (
                <TicketPaymentTransferSection
                  totalPrice={ticket.totalPrice}
                  banks={bankAccounts}
                  isOriginalBankDeactivated={ticket.isOriginalBankDeactivated}
                  paymentRejectionReason={ticket.paymentRejectionReason}
                  paymentProofUrl={ticket.paymentProofUrl}
                  paymentProofUploadedAt={ticket.paymentProofUploadedAt}
                  paymentProofNote={ticket.paymentProofNote}
                  onUploadProof={handleUploadProof}
                  isUploading={isUploadingProof}
                  onViewProof={() => setIsPreviewModalOpen(true)}
                />
              )}
            </div>
          </div>

          <TicketActionsBar
            eventId={ticket.eventId}
            totalTickets={ticket.ticketCount || 1}
            activeIndex={selectedTicketIndex - 1}
            activeTicketCode={ticket.ticketCode}
            downloading={isDownloadingTicket}
            onDownloadActive={handleDownloadActiveTicket}
            onDownloadAll={handleDownloadAllTickets}
            isPaidOrFree={isPaidOrFree}
          />

          <div className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3">
            <span>Butuh bantuan pembayaran atau mengalami kendala tiket?</span>
            <Button
              variant="outline"
              size="sm"
              render={
                <a
                  href={buildOfficialCsWhatsAppUrl(`Halo CS Dago Creative Hub, saya butuh bantuan untuk tiket ${ticket.ticketCode}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              nativeButton={false}
            >
              Hubungi CS via WhatsApp
            </Button>
          </div>
        </main>
      </div>

      <TicketPaymentProofDialog
        open={isPreviewModalOpen}
        onOpenChange={setIsPreviewModalOpen}
        imageUrl={ticket.paymentProofUrl || null}
      />

      <footer className="border-t bg-muted/20 py-4 text-center text-xs text-muted-foreground">
        Dago Creative Hub • Modul Tiket & Registrasi Event
      </footer>
    </div>
  );
}
