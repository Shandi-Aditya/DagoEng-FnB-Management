"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Calendar,
  Clock,
  MapPin,
  Tag,
  Ticket,
  Users,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  LogIn,
  Search,
  Share2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { useAuth } from "@/contexts/AuthContext";
import { HomeNav } from "@/features/landing/home/HomeNav";
import { formatCurrencyIDR } from "@/lib/utils";
import type { AuthenticatedUser } from "@/types/auth";
import type { PublicCommunityEvent, EventTicketOrder } from "@/types/event";

import { EventDetailSidebar } from "@/features/event-detail/EventDetailSidebar";
import { EventBookingDialog, type BookingFormData } from "@/features/event-detail/EventBookingDialog";
import { EventPaymentGuideDialog } from "@/features/event-detail/EventPaymentGuideDialog";
import { EventTicketPassDialog } from "@/features/event-detail/EventTicketPassDialog";
import { EventShareDialog } from "@/features/event-detail/EventShareDialog";
import {
  formatDetailSchedule,
  validateBookingInput,
} from "@/features/event-detail/event-detail-domain";
import { eventCategoryLabel } from "@/features/landing/landing-logic";

function MyTicketsNavAction({ user }: { user: AuthenticatedUser | null }) {
  if (user) {
    return (
      <Button
        variant="ghost"
        render={<Link href="/customer?tab=PROFILE" />}
        nativeButton={false}
      >
        <Ticket className="size-4" />
        <span className="hidden sm:inline">Tiket saya</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost">
            <Ticket className="size-4" />
            <span className="hidden sm:inline">Tiket saya</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          render={
            <Link
              href={`/login?returnTo=${encodeURIComponent("/customer?tab=PROFILE")}&from=events&mode=customer`}
            />
          }
        >
          <LogIn />
          <span>Masuk dengan akun</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/events/tickets/recovery" />}>
          <Search />
          <span>Cari e-tiket tamu</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function EventDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuth();

  const [event, setEvent] = useState<PublicCommunityEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  // Booking Form State
  const [bookingForm, setBookingForm] = useState<BookingFormData>({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    institution: "",
    ticketCount: 1,
  });
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Tickets
  const [pendingTicket, setPendingTicket] = useState<EventTicketOrder | null>(null);
  const [issuedTicket, setIssuedTicket] = useState<EventTicketOrder | null>(null);

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

  const fetchEventDetail = useCallback(async (eventId: string) => {
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat informasi event.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      fetchEventDetail(id);
    }
  }, [id, fetchEventDetail]);

  const isPast = useMemo(() => {
    if (!event) return false;
    return new Date(event.endDate).getTime() < Date.now();
  }, [event]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    const maxTickets = event.maxTicketsPerBooking || 5;
    const validation = validateBookingInput({
      ...bookingForm,
      maxTickets,
    });

    if (!validation.isValid) {
      setBookingError(validation.error);
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

      // Save to customer's personal ticket list in localStorage
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("dago_my_event_tickets");
          const existingList: EventTicketOrder[] = stored ? JSON.parse(stored) : [];
          const updated = [orderData, ...existingList.filter((t) => t.id !== orderData.id)];
          localStorage.setItem("dago_my_event_tickets", JSON.stringify(updated));
        } catch {
          // localStorage failure fallback
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
    } catch (err: unknown) {
      setBookingError(err instanceof Error ? err.message : "Terjadi kesalahan jaringan.");
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <HomeNav showLinks={false} showCta={false} />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
          <div className="aspect-video w-full rounded-xl bg-muted/40 animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-4">
              <div className="h-28 rounded-xl bg-muted/40 animate-pulse" />
              <div className="h-44 rounded-xl bg-muted/40 animate-pulse" />
            </div>
            <div className="lg:col-span-4 h-64 rounded-xl bg-muted/40 animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <HomeNav showLinks={false} showCta={false} />
        <main className="flex-1 flex items-center justify-center p-4">
          <EmptyState
            className="border max-w-md w-full"
            icon={<AlertCircle className="size-8 text-destructive" />}
            title="Event tidak tersedia"
            description={error || "Acara ini mungkin belum dipublikasikan atau telah dihapus."}
            action={
              <Button variant="outline" size="lg" render={<Link href="/events" />}>
                <ArrowLeft />
                <span>Kembali ke katalog event</span>
              </Button>
            }
          />
        </main>
      </div>
    );
  }

  const scheduleFormatted = formatDetailSchedule(event.startDate, event.endDate);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground pb-20 lg:pb-8">
      {/* 1. Header (consistent HomeNav layout: ModeToggle on the left, ghost actions, and blue Portal Mitra button) */}
      <HomeNav
        showLinks={false}
        action={
          <>
            <Button
              variant="ghost"
              onClick={() => setIsShareModalOpen(true)}
            >
              <Share2 className="size-4" />
              <span className="hidden sm:inline">Bagikan</span>
            </Button>
            <MyTicketsNavAction user={user} />
          </>
        }
        cta={{ href: "/events/portal", label: "Portal mitra" }}
      />

      {/* 2. Main Content */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* Back Link to Catalog */}
        <div className="-mb-2">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/events" />}
            nativeButton={false}
            className="-ml-2.5"
          >
            <ArrowLeft className="size-4" />
            <span>Semua event</span>
          </Button>
        </div>
        {/* Poster Showcase Container */}
        <div className="relative aspect-video max-h-[460px] w-full overflow-hidden rounded-xl border bg-muted">
          {event.posterUrl ? (
            <Image
              src={event.posterUrl}
              alt={event.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1152px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Calendar className="size-12" />
            </div>
          )}

          {/* Badges Overlay */}
          <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="backdrop-blur-md bg-background/85 text-xs">
              {eventCategoryLabel(event.category)}
            </Badge>
            {isPast ? (
              <Badge variant="outline" className="backdrop-blur-md bg-background/85 text-xs">
                Event telah selesai
              </Badge>
            ) : (
              <Badge variant="default" className="backdrop-blur-md text-xs">
                Event mendatang
              </Badge>
            )}
          </div>
        </div>

        {/* 2-Column Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
          {/* Left Column (8 cols): Info, About, Guidelines, Organizer */}
          <div className="lg:col-span-8 space-y-6">
            {/* Title & Quick Metadata */}
            <div className="space-y-3">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-medium tracking-tight text-foreground leading-tight">
                {event.title}
              </h1>

              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5 text-foreground font-medium">
                  <Users className="size-3.5 text-primary" />
                  <span>{event.organizerName}</span>
                </span>
                <span>&bull;</span>
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  <span>{scheduleFormatted}</span>
                </span>
              </div>
            </div>

            {/* Quick Highlights Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border bg-card text-xs">
              <div className="space-y-0.5">
                <span className="text-muted-foreground block text-xs">Waktu acara</span>
                <span className="font-medium text-foreground block truncate">
                  {new Date(event.startDate).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" })} WITA
                </span>
                <span className="text-muted-foreground block text-xs truncate">
                  {new Date(event.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Makassar" })}
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-muted-foreground block text-xs">Lokasi venue</span>
                <span className="font-medium text-foreground block truncate">
                  {event.location.split(",")[0] || event.location}
                </span>
                <span className="text-muted-foreground block text-xs truncate">
                  Dago Creative Hub
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-muted-foreground block text-xs">Kategori</span>
                <span className="font-medium text-foreground block truncate">
                  {eventCategoryLabel(event.category)}
                </span>
                <span className="text-muted-foreground block text-xs truncate">
                  Kegiatan publik
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-muted-foreground block text-xs">Tiket masuk</span>
                <span className="font-mono tabular-nums font-medium text-foreground block truncate">
                  {event.isPaid ? formatCurrencyIDR(event.price) : "Gratis"}
                </span>
                <span className="text-muted-foreground block text-xs truncate">
                  {event.isPaid ? "Per tiket peserta" : "Registrasi terbuka"}
                </span>
              </div>
            </div>

            {/* About Event Card */}
            <Card className="rounded-xl border bg-card p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Sparkles className="size-4 text-primary" />
                <h2 className="text-sm font-medium">Tentang Acara Ini</h2>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line space-y-3">
                {event.description}
              </div>
            </Card>

            {/* Guidelines Card (if available) */}
            {event.guidelines && event.guidelines.length > 0 && (
              <Card className="rounded-xl border bg-card p-5 sm:p-6 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <ShieldCheck className="size-4 text-primary" />
                  <h2 className="text-sm font-medium">Panduan & Ketentuan Acara</h2>
                </div>
                <ul className="text-xs text-muted-foreground space-y-2.5">
                  {event.guidelines.map((guide, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="size-3.5 text-success shrink-0 mt-0.5" />
                      <span>{guide}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Organizer Profile Card */}
            <Card className="rounded-xl border bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-medium text-sm border shrink-0">
                  {event.organizerName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="text-xs text-muted-foreground block">Penyelenggara resmi</span>
                  <h3 className="font-medium text-sm text-foreground truncate">{event.organizerName}</h3>
                  <span className="text-xs text-muted-foreground">Komunitas terdaftar Dago Hub</span>
                </div>
              </div>

              <Button variant="outline" size="lg" render={<Link href="/events" />}>
                <span>Lihat event lainnya</span>
              </Button>
            </Card>
          </div>

          {/* Right Column (4 cols, sticky): Ticket Box & Host Card */}
          <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-20 self-start">
            <EventDetailSidebar
              event={event}
              isPast={isPast}
              onOpenBooking={() => {
                setBookingError(null);
                setIsBookingModalOpen(true);
              }}
            />
          </div>
        </div>
      </main>

      {/* Mobile Sticky Bottom CTA Bar */}
      {!isPast && !event.availability?.isSoldOut && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t p-3.5 px-4 flex items-center justify-between gap-4 shadow-lg">
          <div>
            <span className="text-xs text-muted-foreground block">Harga tiket</span>
            <span className="font-mono tabular-nums font-medium text-sm text-foreground">
              {event.isPaid ? formatCurrencyIDR(event.price) : "Gratis"}
            </span>
          </div>

          <Button
            size="lg"
            onClick={() => {
              setBookingError(null);
              setIsBookingModalOpen(true);
            }}
          >
            <Ticket className="size-3.5" />
            <span>{event.isPaid ? "Pesan tiket" : "Daftar gratis"}</span>
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <EventBookingDialog
        open={isBookingModalOpen}
        onOpenChange={setIsBookingModalOpen}
        event={event}
        form={bookingForm}
        setForm={setBookingForm}
        onSubmit={handleBookingSubmit}
        isSubmitting={isSubmittingBooking}
        error={bookingError}
      />

      <EventPaymentGuideDialog
        open={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
        ticket={pendingTicket}
        event={event}
        onViewTicket={handleProceedToTicketView}
      />

      <EventTicketPassDialog
        open={isTicketModalOpen}
        onOpenChange={setIsTicketModalOpen}
        ticket={issuedTicket}
        onDone={() => setIsTicketModalOpen(false)}
      />

      <EventShareDialog
        open={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
        event={event}
      />
    </div>
  );
}
