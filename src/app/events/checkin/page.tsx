"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { UnitScope } from "@/components/app/unit-scope";
import { notify } from "@/components/app/notify";
import { useAuth } from "@/contexts/AuthContext";
import type { CommunityEvent, EventTicketOrder, AttendeeCheckInStatus } from "@/types/event";
import { canAccessEventCheckIn, getRoleSlug } from "@/lib/rbac";
import {
  CheckInHeader,
  CheckInActionToolbar,
  CheckInStatsBar,
  CheckInTabs,
  CheckInAttendeeCard,
  CheckInAttendeesTable,
  EventCheckInScannerDialog,
  EventCheckInQRDialog,
  EventGroupCheckInDialog,
  parseTicketScanCode,
  validateTicketCheckIn,
  calculateCheckInStats,
  filterCheckInTickets,
  filterTodayEventsWita,
} from "@/features/events-checkin";

export default function EventCheckInDashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [bookings, setBookings] = useState<EventTicketOrder[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [ticketSearch, setTicketSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"UNCHECKED" | "CHECKED" | "ALL">("UNCHECKED");
  const [quickBarcodeInput, setQuickBarcodeInput] = useState("");
  const [isQuickScanning, setIsQuickScanning] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [viewQRBooking, setViewQRBooking] = useState<EventTicketOrder | null>(null);
  const [groupCheckInBooking, setGroupCheckInBooking] = useState<EventTicketOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  const lastScanRef = useRef<{ code: string; timestamp: number } | null>(null);

  const isAuthorized = canAccessEventCheckIn(user);
  const roleSlug = getRoleSlug(user);
  const isHubAdmin =
    roleSlug === "SUPER_ADMIN" ||
    ((roleSlug === "OWNER" || roleSlug === "MANAGER") &&
      (user?.scopeLevel === "ORGANIZATION" || user?.scopeLevel === "PLATFORM"));
  const isEventStaff = Boolean(user?.permissions?.includes("events:checkin"));

  // Load events and bookings concurrently
  const loadData = async () => {
    if (!canAccessEventCheckIn(user)) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [evtRes, bRes] = await Promise.all([
        fetch("/api/events"),
        fetch("/api/events/bookings"),
      ]);

      const [evtJson, bJson] = await Promise.all([evtRes.json(), bRes.json()]);
      const allEvents: CommunityEvent[] = evtJson.success ? evtJson.data : [];
      const allBookings: EventTicketOrder[] = bJson.success && Array.isArray(bJson.data) ? bJson.data : [];
      setBookings(allBookings);

      const userEmail = (user?.email || "").toLowerCase();
      const accessibleEvents =
        isHubAdmin || isEventStaff
          ? allEvents.filter((e) => e.status === "APPROVED")
          : allEvents.filter(
              (e) => e.status === "APPROVED" && (e.organizerEmail || "").toLowerCase() === userEmail
            );

      // S-06: Meja check-in hanya untuk event hari ini (WITA). Event lampau dan mendatang tidak dapat dipilih.
      const todayEvents = filterTodayEventsWita(accessibleEvents);
      setEvents(todayEvents);

      // Prioritize selecting an event that has registered attendee bookings or is currently ongoing today
      if (todayEvents.length > 0) {
        setSelectedEventId((prev) => {
          if (prev && todayEvents.some((e) => e.id === prev)) {
            return prev;
          }
          const eventWithBookings =
            todayEvents.find((e) => allBookings.some((b) => b.eventId === e.id)) ||
            todayEvents[0];
          return eventWithBookings.id;
        });
      } else {
        setSelectedEventId("");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat data check-in event.";
      notify.error("Gagal memuat data", msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Selected event object
  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return events.find((e) => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // Tickets for selected event
  const eventTickets = useMemo(() => {
    if (!selectedEventId) return [];
    return bookings.filter((b) => b.eventId === selectedEventId);
  }, [bookings, selectedEventId]);

  // Calculated attendance stats
  const stats = useMemo(() => {
    return calculateCheckInStats(eventTickets);
  }, [eventTickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return filterCheckInTickets(eventTickets, activeTab, ticketSearch);
  }, [eventTickets, activeTab, ticketSearch]);

  // Server-side Check-In Handler
  const handleCheckIn = async (
    booking: EventTicketOrder,
    newStatus: AttendeeCheckInStatus,
    options?: {
      incrementQty?: number;
      targetQty?: number;
      reset?: boolean;
      ticketCode?: string;
      seatNumber?: number;
    }
  ) => {
    setIsProcessingId(booking.id);

    try {
      const res = await fetch(`/api/events/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkInStatus: newStatus,
          reset: options?.reset || newStatus === "REGISTERED",
          incrementQty: options?.incrementQty,
          targetQty: options?.targetQty,
          ticketCode: options?.ticketCode,
          seatNumber: options?.seatNumber,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memproses check-in tiket.");
      }

      const updated = json.data as EventTicketOrder;

      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, ...updated } : b))
      );

      const count =
        updated.checkedInQty ??
        (updated.checkInStatus === "CHECKED_IN" ? updated.ticketCount : 0);
      const isComplete = count >= updated.ticketCount;

      if (newStatus === "REGISTERED" || options?.reset) {
        notify.success(
          "Status kehadiran direset",
          `Tiket ${booking.ticketCode} (${booking.guestName}) kembali ke status belum hadir.`
        );
      } else if (options?.seatNumber !== undefined) {
        notify.success(
          "Check-in dicatat",
          `Tiket #${options.seatNumber} [${options.ticketCode || booking.ticketCode}] (${booking.guestName}): ${count}/${updated.ticketCount} hadir.`
        );
      } else if (updated.ticketCount > 1) {
        notify.success(
          "Check-in rombongan dicatat",
          `Tiket [${booking.ticketCode}] (${booking.guestName}): ${count}/${updated.ticketCount} hadir ${
            isComplete ? "(lengkap)" : `(sisa ${updated.ticketCount - count} tiket)`
          }.`
        );
      } else {
        notify.success(
          "Check-in dicatat",
          `Tiket [${booking.ticketCode}] atas nama ${booking.guestName} berhasil dicatat.`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memproses check-in.";
      notify.error("Gagal memproses check-in", msg);
    } finally {
      setIsProcessingId(null);
    }
  };

  // Hardware scanner gun or manual Enter submission
  const handleQuickBarcodeSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isQuickScanning) return;

    const rawInput = quickBarcodeInput.trim();
    setQuickBarcodeInput("");

    if (!rawInput) return;

    const { cleanCode, baseCode, seatNumber } = parseTicketScanCode(rawInput);
    if (!cleanCode) return;

    // Deduplication guard against rapid multi-scan events
    const now = Date.now();
    if (
      lastScanRef.current &&
      lastScanRef.current.code === cleanCode &&
      now - lastScanRef.current.timestamp < 1200
    ) {
      return;
    }
    lastScanRef.current = { code: cleanCode, timestamp: now };

    setIsQuickScanning(true);

    try {
      const booking = eventTickets.find((b) => {
        const bCode = (b.ticketCode || "").trim().toUpperCase();
        const bId = (b.id || "").trim().toUpperCase();
        return (
          (bCode && (bCode === cleanCode || bCode === baseCode)) ||
          (bId && (bId === cleanCode || bId === baseCode))
        );
      });

      const validation = validateTicketCheckIn(
        booking || null,
        selectedEventId,
        seatNumber
      );

      if (!validation.valid) {
        notify.error("Pemeriksaan tiket gagal", validation.message || "Tiket tidak valid.");
        return;
      }

      if (!booking) return;

      const targetStatus = validation.targetStatus || "CHECKED_IN";
      await handleCheckIn(booking, targetStatus, {
        ticketCode: cleanCode,
        seatNumber,
        incrementQty: 1,
      });
    } finally {
      setIsQuickScanning(false);
      setQuickBarcodeInput("");
    }
  };

  // Logout handler
  const handleOfficerLogout = async () => {
    await logout();
    router.push("/login");
  };

  // Unauthorized access guard
  if (!isLoading && !isAuthorized) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <EmptyState
          icon={<ShieldAlert />}
          title="Akses terbatas"
          description={`Akun Anda (${user?.email || "Tamu"}) tidak memiliki otorisasi petugas lapangan untuk check-in event.`}
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="default"
                render={<Link href="/" />}
                nativeButton={false}
              >
                <span>Beranda</span>
              </Button>
              <Button
                size="default"
                render={<Link href={roleSlug === "CUSTOMER" ? "/customer" : "/dashboard"} />}
                nativeButton={false}
              >
                <span>Workspace</span>
              </Button>
            </div>
          }
          className="max-w-md border"
        />
      </div>
    );
  }

  return (
    <div data-unit="event" className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <UnitScope unit="event" />

      {/* Header */}
      <CheckInHeader
        officerName={user?.name}
        officerEmail={user?.email}
        isHubAdmin={isHubAdmin}
        isLoading={isLoading}
        onRefresh={loadData}
        onLogout={handleOfficerLogout}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 w-full flex-1">
        {events.length === 0 && !isLoading ? (
          <EmptyState
            icon={<Calendar />}
            title="Tidak ada event hari ini"
            description="Meja check-in hanya melayani event yang berlangsung hari ini (WITA). Event lampau atau mendatang tidak dapat diproses."
            className="border"
          />
        ) : selectedEvent ? (
          <div className="space-y-6">
            {/* Toolbar Action Banner */}
            <CheckInActionToolbar
              event={selectedEvent}
              events={events}
              selectedEventId={selectedEventId}
              onSelectEvent={(id) => setSelectedEventId(id)}
              barcodeInput={quickBarcodeInput}
              onChangeBarcodeInput={setQuickBarcodeInput}
              onSubmitBarcode={handleQuickBarcodeSubmit}
              isQuickScanning={isQuickScanning}
              onOpenScanner={() => setIsScannerOpen(true)}
            />

            {/* Attendance KPI Stats */}
            <CheckInStatsBar stats={stats} />

            {/* Tabs & Search */}
            <CheckInTabs
              activeTab={activeTab}
              onChangeTab={setActiveTab}
              searchQuery={ticketSearch}
              onChangeSearchQuery={setTicketSearch}
              stats={stats}
            />

            {/* Mobile Cards (sm:hidden) */}
            <div className="block sm:hidden space-y-3">
              {filteredTickets.length > 0 ? (
                filteredTickets.map((ticket) => (
                  <CheckInAttendeeCard
                    key={ticket.id}
                    ticket={ticket}
                    isProcessing={isProcessingId === ticket.id}
                    onCheckIn={(t) => {
                      if ((t.ticketCount || 1) > 1) {
                        setGroupCheckInBooking(t);
                      } else {
                        handleCheckIn(t, "CHECKED_IN");
                      }
                    }}
                    onReset={(t) => handleCheckIn(t, "REGISTERED", { reset: true })}
                    onViewQR={(t) => setViewQRBooking(t)}
                  />
                ))
              ) : (
                <EmptyState
                  icon={<Calendar />}
                  title="Tidak ada tiket"
                  description="Tidak ditemukan tiket yang cocok dengan filter atau pencarian."
                  className="border"
                />
              )}
            </div>

            {/* Desktop / Tablet Table (hidden sm:block) */}
            <div className="hidden sm:block">
              <CheckInAttendeesTable
                tickets={filteredTickets}
                isProcessingId={isProcessingId}
                onCheckIn={(ticket) => {
                  if ((ticket.ticketCount || 1) > 1) {
                    setGroupCheckInBooking(ticket);
                  } else {
                    handleCheckIn(ticket, "CHECKED_IN");
                  }
                }}
                onReset={(ticket) => handleCheckIn(ticket, "REGISTERED", { reset: true })}
                onViewQR={(ticket) => setViewQRBooking(ticket)}
                onSwitchToCheckedTab={() => setActiveTab("CHECKED")}
                activeTab={activeTab}
                totalUnfilteredCount={eventTickets.length}
              />
            </div>
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-muted-foreground w-full border-t border-border">
        Dago Creative Hub &bull; Modul Registrasi & Check-in Event
      </footer>

      {/* Dialogs */}
      <EventCheckInQRDialog
        booking={viewQRBooking}
        onClose={() => setViewQRBooking(null)}
        onSimulateCheckIn={(booking) => {
          setViewQRBooking(null);
          if ((booking.ticketCount || 1) > 1) {
            setGroupCheckInBooking(booking);
          } else {
            handleCheckIn(booking, "CHECKED_IN");
          }
        }}
      />

      <EventGroupCheckInDialog
        booking={groupCheckInBooking}
        onClose={() => setGroupCheckInBooking(null)}
        isProcessing={isProcessingId === groupCheckInBooking?.id}
        onCheckInPartial={async (booking) => {
          const count = booking.ticketCount || 1;
          const currentChecked = booking.checkedInQty || 0;
          const isComplete = currentChecked + 1 >= count;
          await handleCheckIn(booking, isComplete ? "CHECKED_IN" : "PARTIALLY_CHECKED_IN", {
            incrementQty: 1,
          });
          if (isComplete) {
            setGroupCheckInBooking(null);
          }
        }}
        onCheckInAll={async (booking) => {
          await handleCheckIn(booking, "CHECKED_IN", {
            targetQty: booking.ticketCount || 1,
          });
          setGroupCheckInBooking(null);
        }}
        onReset={async (booking) => {
          await handleCheckIn(booking, "REGISTERED", { reset: true });
          setGroupCheckInBooking(null);
        }}
      />

      <EventCheckInScannerDialog
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        selectedEvent={selectedEvent}
        bookings={bookings}
        onCheckIn={handleCheckIn}
      />
    </div>
  );
}
