"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Minus, Plus, Ticket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrencyIDR } from "@/lib/utils";
import type { PublicCommunityEvent } from "@/types/event";

export interface BookingFormData {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  institution: string;
  ticketCount: number;
  ticketTierId?: string;
  promoCode?: string;
}

interface EventBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: PublicCommunityEvent | null;
  form: BookingFormData;
  setForm: React.Dispatch<React.SetStateAction<BookingFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  error: string | null;
}

export function EventBookingDialog({
  open,
  onOpenChange,
  event,
  form,
  setForm,
  onSubmit,
  isSubmitting,
  error,
}: EventBookingDialogProps) {
  if (!event) return null;

  const tiers = event.ticketTiers || [];
  const hasTiers = tiers.length > 0;
  const tierAvailabilities = event.availability?.tiers || event.tierAvailability || [];

  const selectedTier = hasTiers
    ? tiers.find((t) => t.id === form.ticketTierId) || null
    : null;
  const selectedTierAvail =
    hasTiers && selectedTier
      ? tierAvailabilities.find((t) => t.tierId === selectedTier.id) || null
      : null;

  // Auto-select first available tier on open
  React.useEffect(() => {
    if (open && hasTiers && (!form.ticketTierId || !tiers.some((t) => t.id === form.ticketTierId))) {
      const firstAvailable =
        tiers.find((t) => {
          const a = tierAvailabilities.find((ta) => ta.tierId === t.id);
          return a ? !a.isSoldOut && a.salesStatus === "ON_SALE" : t.isActive !== false;
        });
      if (firstAvailable) {
        setForm((prev) => ({ ...prev, ticketTierId: firstAvailable.id }));
      } else {
        setForm((prev) => ({ ...prev, ticketTierId: "" }));
      }
    }
  }, [open, hasTiers, tiers, tierAvailabilities, form.ticketTierId, setForm]);

  const maxAllowedPerTx = event.maxTicketsPerBooking || 5;
  const overallRemainingTickets = event.availability?.ticketsRemaining ?? maxAllowedPerTx;
  const tierRemaining = selectedTierAvail
    ? selectedTierAvail.remaining
    : selectedTier
      ? selectedTier.quota
      : overallRemainingTickets;

  const effectiveMaxTickets = Math.min(
    maxAllowedPerTx,
    Math.max(1, hasTiers ? tierRemaining : overallRemainingTickets)
  );

  const unitPrice = selectedTier
    ? Number(selectedTier.price || 0)
    : event.isPaid
      ? Number(event.price || 0)
      : 0;

  const subtotalPrice = unitPrice * form.ticketCount;

  // Promo code validation via secure server endpoint
  const cleanPromoInput = (form.promoCode || "").trim().toUpperCase();
  const [promoValidation, setPromoValidation] = React.useState<{
    valid: boolean;
    discountAmount: number;
    error?: string;
  } | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = React.useState(false);

  React.useEffect(() => {
    if (!cleanPromoInput || subtotalPrice <= 0) {
      setPromoValidation(null);
      return;
    }
    const timer = setTimeout(async () => {
      setIsValidatingPromo(true);
      try {
        const res = await fetch(
          `/api/events/${event.id}/promos?code=${encodeURIComponent(cleanPromoInput)}&subtotal=${subtotalPrice}&tierId=${form.ticketTierId || ""}`
        );
        const data = await res.json();
        if (data.success && data.promo) {
          setPromoValidation({
            valid: true,
            discountAmount: data.promo.discountAmount || 0,
          });
        } else {
          setPromoValidation({
            valid: false,
            discountAmount: 0,
            error: data.error || "Kode promo tidak valid.",
          });
        }
      } catch {
        setPromoValidation({
          valid: false,
          discountAmount: 0,
          error: "Gagal memvalidasi kode promo.",
        });
      } finally {
        setIsValidatingPromo(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [event.id, cleanPromoInput, subtotalPrice, form.ticketTierId]);

  const appliedDiscount = promoValidation?.valid ? promoValidation.discountAmount : 0;
  const totalPrice = Math.max(0, subtotalPrice - appliedDiscount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-unit="event" className="max-w-md max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Ticket className="size-5 text-primary" />
            <DialogTitle className="text-base font-medium">
              Pendaftaran Tiket Acara
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground truncate">
            {event.title}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 text-xs">
          {/* Ticket Tier Selection */}
          {hasTiers && (
            <div className="space-y-2">
              <label className="font-medium text-foreground block">
                Pilih jenis tiket <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-1 gap-2">
                {tiers.map((tier) => {
                  const avail = tierAvailabilities.find((a) => a.tierId === tier.id);
                  const isSoldOut = avail ? avail.isSoldOut : false;
                  const isUpcoming = avail?.salesStatus === "UPCOMING";
                  const isEnded = avail?.salesStatus === "ENDED";
                  const isUnavailable = isSoldOut || isUpcoming || isEnded;
                  const isSelected = form.ticketTierId === tier.id;

                  return (
                    <button
                      key={tier.id}
                      type="button"
                      disabled={isUnavailable}
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          ticketTierId: tier.id,
                          ticketCount: 1,
                        }));
                      }}
                      className={`w-full text-left p-3 rounded-lg border transition-colors flex flex-col gap-1.5 ${isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : isUnavailable
                          ? "border-muted bg-muted/40 opacity-60 cursor-not-allowed"
                          : "border-border hover:border-primary/50 bg-card hover:bg-muted/10 cursor-pointer"
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground text-xs">{tier.name}</span>
                        <span className="font-mono font-medium text-foreground text-xs">
                          {tier.price > 0 ? formatCurrencyIDR(tier.price) : "Gratis"}
                        </span>
                      </div>
                      {tier.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {tier.description}
                        </p>
                      )}
                      {(tier.salesStartDate || tier.salesEndDate) && (
                        <p className="text-[10px] text-muted-foreground/80">
                          {tier.salesStartDate ? new Date(tier.salesStartDate).toLocaleDateString("id-ID", { timeZone: "Asia/Makassar", day: "numeric", month: "short" }) : ""} – {tier.salesEndDate ? new Date(tier.salesEndDate).toLocaleDateString("id-ID", { timeZone: "Asia/Makassar", day: "numeric", month: "short" }) : ""} WITA
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                        <span className="text-muted-foreground">
                          {isSoldOut
                            ? "Habis terjual"
                            : isUpcoming
                              ? "Penjualan belum dibuka"
                              : isEnded
                                ? "Penjualan telah berakhir"
                                : avail
                                  ? `Sisa ${avail.remaining} tiket`
                                  : `Kuota ${tier.quota} tiket`}
                        </span>
                        {isSelected && (
                          <span className="text-primary font-medium text-xs">Dipilih</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Guest Name */}
          <div className="space-y-1.5">
            <label className="font-medium text-foreground">
              Nama lengkap <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={form.guestName}
              onChange={(e) => setForm((prev) => ({ ...prev, guestName: e.target.value }))}
              placeholder="Contoh: Rian Pratama"
              className="w-full h-9 rounded-md border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-medium text-foreground">
                Alamat email <span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                required
                value={form.guestEmail}
                onChange={(e) => setForm((prev) => ({ ...prev, guestEmail: e.target.value }))}
                placeholder="nama@email.com"
                className="w-full h-9 rounded-md border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-foreground">
                No. WhatsApp <span className="text-destructive">*</span>
              </label>
              <input
                type="tel"
                required
                value={form.guestPhone}
                onChange={(e) => setForm((prev) => ({ ...prev, guestPhone: e.target.value }))}
                placeholder="08123456789"
                className="w-full h-9 rounded-md border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Institution */}
          <div className="space-y-1.5">
            <label className="font-medium text-foreground">
              Institusi / Komunitas (opsional)
            </label>
            <input
              type="text"
              value={form.institution}
              onChange={(e) => setForm((prev) => ({ ...prev, institution: e.target.value }))}
              placeholder="Contoh: Komunitas Barista / Mahasiswa / Umum"
              className="w-full h-9 rounded-md border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Ticket Count Stepper */}
          <div className="rounded-lg border bg-muted/20 p-3.5 flex items-center justify-between gap-3">
            <div>
              <span className="font-medium text-foreground block">Jumlah tiket</span>
              <span className="text-xs text-muted-foreground block mt-0.5">
                {unitPrice > 0 ? `${formatCurrencyIDR(unitPrice)} / tiket` : "Tiket gratis"}{" "}
                (maks. {effectiveMaxTickets} tiket)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                onClick={() => setForm((prev) => ({ ...prev, ticketCount: Math.max(1, prev.ticketCount - 1) }))}
                disabled={form.ticketCount <= 1}
                aria-label="Kurangi jumlah tiket"
              >
                <Minus />
              </Button>
              <span className="w-5 text-center font-mono font-medium text-sm tabular-nums text-foreground">
                {form.ticketCount}
              </span>
              <Button
                type="button"
                size="icon-lg"
                onClick={() => setForm((prev) => ({ ...prev, ticketCount: Math.min(effectiveMaxTickets, prev.ticketCount + 1) }))}
                disabled={form.ticketCount >= effectiveMaxTickets}
                aria-label="Tambah jumlah tiket"
              >
                <Plus />
              </Button>
            </div>
          </div>

          {/* Promo Code Input (for paid bookings) */}
          {subtotalPrice > 0 && (
            <div className="space-y-1.5">
              <label className="font-medium text-foreground block">
                Kode promo (opsional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.promoCode || ""}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setForm((prev) => ({ ...prev, promoCode: val }));
                  }}
                  placeholder="Contoh: DISKON10 / VIPGUEST"
                  className="w-full h-9 rounded-md border bg-background px-3 text-xs font-mono text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                />
              </div>
              {isValidatingPromo ? (
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                  <span>Memeriksa kode promo...</span>
                </span>
              ) : promoValidation?.valid && appliedDiscount > 0 ? (
                <span className="text-xs text-success flex items-center gap-1 font-medium">
                  <CheckCircle2 className="size-3.5" />
                  <span>Hemat {formatCurrencyIDR(appliedDiscount)} ({cleanPromoInput})</span>
                </span>
              ) : promoValidation?.error ? (
                <span className="text-xs text-destructive flex items-center gap-1 font-medium">
                  <AlertCircle className="size-3.5" />
                  <span>{promoValidation.error}</span>
                </span>
              ) : form.promoCode && cleanPromoInput !== "" ? (
                <span className="text-xs text-muted-foreground block">
                  Kode promo akan divalidasi saat pemrosesan tiket.
                </span>
              ) : null}
            </div>
          )}

          {/* Total Price */}
          <div className="pt-2 border-t flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground block">Total biaya tiket</span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono tabular-nums font-medium text-base text-foreground">
                  {totalPrice > 0 ? formatCurrencyIDR(totalPrice) : "Gratis"}
                </span>
                {appliedDiscount > 0 && (
                  <span className="font-mono text-xs text-muted-foreground line-through">
                    {formatCurrencyIDR(subtotalPrice)}
                  </span>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={
                  isSubmitting ||
                  (hasTiers &&
                    (!form.ticketTierId ||
                      !selectedTier ||
                      Boolean(selectedTierAvail?.isSoldOut) ||
                      selectedTierAvail?.salesStatus === "UPCOMING" ||
                      selectedTierAvail?.salesStatus === "ENDED"))
                }
              >
                {isSubmitting
                  ? "Memproses..."
                  : totalPrice > 0
                    ? "Lanjut ke pembayaran"
                    : "Dapatkan tiket"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
