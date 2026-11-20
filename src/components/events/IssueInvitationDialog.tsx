"use client";

import React, { useState } from "react";
import { Mail, Check, Copy, AlertCircle, ExternalLink, Ticket } from "lucide-react";
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
  const [invitationNote, setInvitationNote] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedOrder, setIssuedOrder] = useState<EventTicketOrder | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const resetForm = () => {
    setGuestName("");
    setGuestEmail("");
    setGuestPhone("");
    setInstitution("");
    setTicketTierId("");
    setTicketCount(1);
    setInvitationNote("");
    setError(null);
    setIssuedOrder(null);
    setIsCopied(false);
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
        invitationNote: invitationNote.trim() || undefined,
      };

      const res = await fetch(`/api/events/${event.id}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menerbitkan tiket undangan.");
      }

      const order: EventTicketOrder = data.booking;
      setIssuedOrder(order);
      notify.success(
        "Tiket undangan berhasil diterbitkan",
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
    notify.success("Tautan disalin", "Tautan e-tiket privat berhasil disalin ke clipboard.");
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-6 text-xs">
        <DialogHeader>
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

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {issuedOrder ? (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-success/40 bg-success/10 p-4 space-y-2 text-center">
              <div className="size-10 rounded-full bg-success/20 text-success flex items-center justify-center mx-auto">
                <Check className="size-5" />
              </div>
              <h4 className="font-semibold text-foreground text-sm">
                Tiket undangan berhasil diterbitkan!
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
                className="h-8 text-xs"
              >
                Selesai
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 py-1">
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
                Instansi / Komunitas (opsional)
              </Label>
              <Input
                id="inv-institution"
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Contoh: Media Partner / Pembicara / VIP"
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
                    onChange={(e) => setTicketTierId(e.target.value)}
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
                  onChange={(e) => setTicketCount(Math.max(1, Number(e.target.value) || 1))}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

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
                disabled={isSubmitting || !guestName.trim() || !guestEmail.trim()}
              >
                {isSubmitting ? "Menerbitkan..." : "Terbitkan tiket undangan"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

