"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Mail, Check, Copy, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { CommunityEvent, EventTicketOrder } from "@/types/event";
import { notify } from "@/components/app/notify";
import {
  formatSeatsList,
  generateTierSeats,
  getEventOccupiedSeats,
} from "@/lib/event-seating";

interface IssueInvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CommunityEvent | null;
  onInvitationIssued?: (order: EventTicketOrder) => void;
}

export function IssueInvitationDialog({
  open,
  onOpenChange,
  event,
  onInvitationIssued,
}: IssueInvitationDialogProps) {
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [institution, setInstitution] = useState("");
  const [ticketTierId, setTicketTierId] = useState("");
  const [ticketCount, setTicketCount] = useState(1);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [occupiedSeats, setOccupiedSeats] = useState<Set<string>>(new Set());
  const [isLoadingSeats, setIsLoadingSeats] = useState(false);
  const [invitationNote, setInvitationNote] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedOrder, setIssuedOrder] = useState<EventTicketOrder | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const loadOccupiedSeats = React.useCallback(async (eventId: string) => {
    setIsLoadingSeats(true);
    try {
      const res = await fetch(`/api/events/bookings?eventId=${encodeURIComponent(eventId)}`);
      const json = await res.json();
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        throw new Error(json?.error || "Gagal memuat data kursi terisi.");
      }
      const occ = getEventOccupiedSeats(eventId, json.data as EventTicketOrder[], Date.now());
      setOccupiedSeats(occ);
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Gagal memuat data kursi terisi. Muat ulang dialog sebelum memilih kursi.";
      setError(message);
      notify.error("Gagal memuat kursi", message);
    } finally {
      setIsLoadingSeats(false);
    }
  }, []);

  useEffect(() => {
    if (open && event?.id && event.hasSeatingChart) {
      void loadOccupiedSeats(event.id);
    }
  }, [open, event?.id, event?.hasSeatingChart, loadOccupiedSeats]);

  const selectedTier = useMemo(() => {
    if (!event?.ticketTiers?.length || !ticketTierId) return null;
    return event.ticketTiers.find((t) => t.id === ticketTierId) || null;
  }, [event?.ticketTiers, ticketTierId]);

  const availableGridSeats = useMemo(() => {
    if (!event?.hasSeatingChart) return [];
    if (selectedTier) {
      return generateTierSeats(selectedTier);
    }
    if (event.ticketTiers && event.ticketTiers.length > 0) {
      return event.ticketTiers.flatMap((t) => generateTierSeats(t));
    }
    return generateTierSeats({ quota: event.maxCapacity || 20 });
  }, [event, selectedTier]);

  const handleToggleSeat = (seatCode: string) => {
    const clean = seatCode.trim().toUpperCase();
    if (occupiedSeats.has(clean)) return;

    setSelectedSeats((prev) => {
      if (prev.includes(clean)) {
        return prev.filter((s) => s !== clean);
      }
      if (prev.length < ticketCount) {
        return [...prev, clean];
      }
      if (ticketCount === 1) {
        return [clean];
      }
      return [...prev.slice(1), clean];
    });
  };

  const resetForm = () => {
    setGuestName("");
    setGuestEmail("");
    setGuestPhone("");
    setInstitution("");
    setTicketTierId("");
    setTicketCount(1);
    setSelectedSeats([]);
    setInvitationNote("");
    setError(null);
    setIssuedOrder(null);
    setIsCopied(false);
    if (event?.id && event.hasSeatingChart) {
      void loadOccupiedSeats(event.id);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim().toLowerCase(),
        guestPhone: guestPhone.trim(),
        institution: institution.trim() || undefined,
        ticketTierId: ticketTierId || undefined,
        ticketCount: Number(ticketCount) || 1,
        selectedSeats: event.hasSeatingChart ? selectedSeats : undefined,
        invitationNote: invitationNote.trim() || undefined,
      };

      const res = await fetch(`/api/events/${event.id}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (event.hasSeatingChart) {
          void loadOccupiedSeats(event.id);
        }
        throw new Error(data.error || "Gagal menerbitkan tiket undangan.");
      }

      const order: EventTicketOrder = data.booking;
      setIssuedOrder(order);
      if (event.hasSeatingChart) {
        void loadOccupiedSeats(event.id);
      }
      notify.success(
        "Tiket undangan diterbitkan",
        `Tiket ${order.ticketCode} siap dibagikan ke ${order.guestName}.`
      );
      onInvitationIssued?.(order);
    } catch (err: any) {
      setError(err.message || "Gagal menerbitkan tiket undangan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTicketUrl = (order: EventTicketOrder) => {
    if (typeof window === "undefined") return `/events/tickets/${order.guestToken}`;
    return `${window.location.origin}/events/tickets/${order.guestToken}`;
  };

  const handleCopyLink = () => {
    if (!issuedOrder || typeof window === "undefined") return;
    const url = getTicketUrl(issuedOrder);
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    notify.success("Tautan disalin", "Tautan e-tiket privat disalin ke clipboard.");
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden text-xs">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Mail className="size-5 text-primary" />
            <DialogTitle className="text-base font-semibold">
              Terbitkan tiket undangan
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {event.title}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {issuedOrder ? (
            <div className="space-y-4 py-1">
              <div className="rounded-xl border border-success/40 bg-success/10 p-4 space-y-2 text-center">
                <div className="size-10 rounded-full bg-success/20 text-success flex items-center justify-center mx-auto">
                  <Check className="size-5" />
                </div>
                <h4 className="font-semibold text-foreground text-sm">
                  Tiket undangan diterbitkan
                </h4>
                <p className="text-xs text-muted-foreground">
                  Tamu undangan dapat langsung membuka e-tiket dan melakukan check-in di pintu masuk.
                </p>
                <div className="pt-2">
                  <Badge variant="outline" className="font-mono text-xs px-2.5 py-1">
                    {issuedOrder.ticketCode}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Tautan privat e-tiket tamu
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={getTicketUrl(issuedOrder)}
                    className="h-8 text-xs font-mono bg-muted/30"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopyLink}
                    className="shrink-0"
                  >
                    {isCopied ? <Check className="size-3.5 text-success mr-1" /> : <Copy className="size-3.5 mr-1" />}
                    <span>{isCopied ? "Disalin" : "Salin"}</span>
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nama tamu:</span>
                  <span className="font-medium text-foreground">{issuedOrder.guestName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium text-foreground">{issuedOrder.guestEmail}</span>
                </div>
                {issuedOrder.guestPhone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">WhatsApp:</span>
                    <span className="font-mono text-foreground">{issuedOrder.guestPhone}</span>
                  </div>
                )}
                {issuedOrder.institution && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Instansi:</span>
                    <span className="font-medium text-foreground">{issuedOrder.institution}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jumlah kursi:</span>
                  <span className="font-medium text-foreground">{issuedOrder.ticketCount} tiket</span>
                </div>
                {issuedOrder.selectedSeats && issuedOrder.selectedSeats.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nomor kursi:</span>
                    <span className="font-mono font-medium text-primary">
                      {formatSeatsList(issuedOrder.selectedSeats)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetForm}
                >
                  Terbitkan tiket lain
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                >
                  Selesai
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <Label htmlFor="inv-guest-name" className="text-xs">
                  Nama lengkap tamu <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="inv-guest-name"
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Contoh: Dr. Budi Setiawan"
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="inv-guest-email" className="text-xs">
                    Email tamu <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="inv-guest-email"
                    type="email"
                    required
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="budi@instansi.id"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="inv-guest-phone" className="text-xs">
                    Nomor WhatsApp
                  </Label>
                  <Input
                    id="inv-guest-phone"
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="inv-institution" className="text-xs text-muted-foreground">
                  Instansi / komunitas (opsional)
                </Label>
                <Input
                  id="inv-institution"
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Contoh: Media partner, pembicara, atau VIP"
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {event.ticketTiers && event.ticketTiers.length > 0 ? (
                  <div className="space-y-1">
                    <Label htmlFor="inv-tier" className="text-xs text-muted-foreground">
                      Jenis tiket dialokasikan
                    </Label>
                    <NativeSelect
                      id="inv-tier"
                      value={ticketTierId}
                      onChange={(e) => {
                        setTicketTierId(e.target.value);
                        setSelectedSeats([]);
                      }}
                      className="h-8 text-xs"
                    >
                      <NativeSelectOption value="">Tiket undangan umum</NativeSelectOption>
                      {event.ticketTiers.map((t) => (
                        <NativeSelectOption key={t.id} value={t.id}>
                          {t.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                ) : null}

                <div className="space-y-1">
                  <Label htmlFor="inv-ticket-count" className="text-xs">
                    Jumlah tiket / kursi <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="inv-ticket-count"
                    type="number"
                    min={1}
                    max={event.maxTicketsPerBooking || 10}
                    required
                    value={ticketCount}
                    onChange={(e) => {
                      const nextCount = Math.max(1, Number(e.target.value) || 1);
                      setTicketCount(nextCount);
                      setSelectedSeats((prev) => prev.slice(0, nextCount));
                    }}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {event.hasSeatingChart && (
                <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs font-medium text-foreground">
                      Pilih nomor kursi ({selectedSeats.length}/{ticketCount})
                    </Label>
                    {isLoadingSeats ? (
                      <span className="text-xs text-muted-foreground">Memuat kursi...</span>
                    ) : selectedSeats.length === ticketCount ? (
                      <Badge variant="default" className="text-xs">Kursi lengkap</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-warning border-warning/40">
                        Kurang {ticketCount - selectedSeats.length} kursi
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 max-h-36 overflow-y-auto p-1 bg-background rounded border">
                    {availableGridSeats.map((seat) => {
                      const clean = seat.toUpperCase();
                      const isOccupied = occupiedSeats.has(clean);
                      const isSelected = selectedSeats.includes(clean);
                      return (
                        <button
                          key={seat}
                          type="button"
                          disabled={isOccupied}
                          onClick={() => handleToggleSeat(seat)}
                          className={`h-7 rounded text-xs font-mono font-medium transition-colors flex items-center justify-center ${
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : isOccupied
                              ? "bg-muted text-muted-foreground/40 border border-muted cursor-not-allowed line-through"
                              : "bg-card border border-border hover:border-primary/60 text-foreground cursor-pointer"
                          }`}
                        >
                          {seat}
                        </button>
                      );
                    })}
                  </div>

                  {selectedSeats.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Kursi dipilih: <span className="font-mono font-medium text-primary">{formatSeatsList(selectedSeats)}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="inv-note" className="text-xs text-muted-foreground">
                  Catatan undangan (opsional)
                </Label>
                <Input
                  id="inv-note"
                  type="text"
                  value={invitationNote}
                  onChange={(e) => setInvitationNote(e.target.value)}
                  placeholder="Contoh: Tamu kehormatan sesi pembukaan"
                  className="h-8 text-xs"
                />
              </div>

              <DialogFooter className="pt-2 border-t gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    isSubmitting ||
                    !guestName.trim() ||
                    !guestEmail.trim() ||
                    (Boolean(event.hasSeatingChart) && selectedSeats.length !== ticketCount)
                  }
                >
                  {isSubmitting ? "Menerbitkan..." : "Terbitkan tiket undangan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

