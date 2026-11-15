"use client";

import type React from "react";
import { Check, Clock, Laptop, Users, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatCurrencyIDR } from "@/lib/utils";
import type { CoworkingSpaceItem } from "@/types/coworking";
import type { PromoConfig } from "@/lib/promo";

import {
  calculateEndTime,
  getAvailableTimeSlots,
  spaceTypeLabel,
} from "./customer-domain";

export interface CustomerBookingModalProps {
  space: CoworkingSpaceItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Form fields
  bookingDate: string;
  onBookingDateChange: (val: string) => void;
  bookingDurationMode: "HOURLY" | "DAILY";
  onBookingDurationModeChange: (mode: "HOURLY" | "DAILY") => void;
  bookingStartTime: string;
  onBookingStartTimeChange: (val: string) => void;
  bookingDurationHours: number;
  onBookingDurationHoursChange: (val: number) => void;
  bookingUsageType: "INDIVIDUAL" | "TEAM";
  onBookingUsageTypeChange: (val: "INDIVIDUAL" | "TEAM") => void;
  bookingGuestCount: number;
  onBookingGuestCountChange: (val: number) => void;
  bookingNotes: string;
  onBookingNotesChange: (val: string) => void;
  paymentMethod: "QRIS" | "CASHIER";
  onPaymentMethodChange: (val: "QRIS" | "CASHIER") => void;
  // Voucher
  voucherInput: string;
  onVoucherInputChange: (val: string) => void;
  activePromo: PromoConfig | null;
  onApplyVoucher: (code: string) => void;
  onRemovePromo: () => void;
  voucherMessage: string | null;
  voucherSuccess: boolean;
  // Submit
  isSubmitting: boolean;
  onSubmitBooking: (e: React.FormEvent) => void;
}

export function CustomerBookingModal({
  space,
  open,
  onOpenChange,
  bookingDate,
  onBookingDateChange,
  bookingDurationMode,
  onBookingDurationModeChange,
  bookingStartTime,
  onBookingStartTimeChange,
  bookingDurationHours,
  onBookingDurationHoursChange,
  bookingUsageType,
  onBookingUsageTypeChange,
  bookingGuestCount,
  onBookingGuestCountChange,
  bookingNotes,
  onBookingNotesChange,
  paymentMethod,
  onPaymentMethodChange,
  voucherInput,
  onVoucherInputChange,
  activePromo,
  onApplyVoucher,
  onRemovePromo,
  voucherMessage,
  voucherSuccess,
  isSubmitting,
  onSubmitBooking,
}: CustomerBookingModalProps) {
  if (!space) return null;

  const isHourly = bookingDurationMode === "HOURLY";
  const rate = isHourly ? space.hourlyRate : (space.dailyRate || space.hourlyRate * 8);
  const baseCost = isHourly ? rate * bookingDurationHours : rate;

  let discount = 0;
  if (activePromo && activePromo.isActive) {
    if (activePromo.discountType === "PERCENTAGE") {
      const calc = (baseCost * activePromo.discountValue) / 100;
      discount = activePromo.maxDiscount ? Math.min(calc, activePromo.maxDiscount) : calc;
    } else if (activePromo.discountType === "FIXED") {
      discount = Math.min(baseCost, activePromo.discountValue);
    }
  }

  const finalCost = Math.max(0, baseCost - discount);
  const endTime = calculateEndTime(bookingStartTime, bookingDurationHours);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{spaceTypeLabel(space.type)}</Badge>
          </div>
          <DialogTitle className="text-lg font-medium">{space.name}</DialogTitle>
          <DialogDescription className="text-xs">
            Kapasitas maksimal {space.capacity} orang · {space.area || "Area Utama"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmitBooking} className="flex flex-col gap-4 py-2 text-xs">
          {/* 1. Mode Durasi: Per Jam vs Harian */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="sm"
              variant={isHourly ? "default" : "outline"}
              onClick={() => onBookingDurationModeChange("HOURLY")}
            >
              Sewa per jam
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!isHourly ? "default" : "outline"}
              onClick={() => onBookingDurationModeChange("DAILY")}
            >
              Sewa harian penuh
            </Button>
          </div>

          {/* 2. Tanggal & Jam */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bookDate">Tanggal sewa</Label>
              <Input
                id="bookDate"
                type="date"
                required
                value={bookingDate}
                onChange={(e) => onBookingDateChange(e.target.value)}
              />
            </div>

            {isHourly ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bookStartTime">Jam mulai</Label>
                <NativeSelect
                  id="bookStartTime"
                  value={bookingStartTime}
                  onChange={(e) => onBookingStartTimeChange(e.target.value)}
                >
                  {getAvailableTimeSlots().map((slot) => (
                    <NativeSelectOption key={slot} value={slot}>
                      {slot} WITA
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            ) : null}
          </div>

          {isHourly ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-muted-foreground">
                <Label>Durasi sewa: {bookingDurationHours} jam</Label>
                <span className="font-mono tabular-nums">
                  Selesai pukul {endTime} WITA
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 4, 8].map((hrs) => (
                  <Button
                    key={hrs}
                    type="button"
                    size="sm"
                    variant={bookingDurationHours === hrs ? "default" : "outline"}
                    onClick={() => onBookingDurationHoursChange(hrs)}
                  >
                    {hrs} jam
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {/* 3. Jumlah Tamu & Catatan */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bookGuests">Jumlah tamu</Label>
              <Input
                id="bookGuests"
                type="number"
                min={1}
                max={space.capacity}
                value={bookingGuestCount}
                onChange={(e) => onBookingGuestCountChange(Number(e.target.value))}
                className="font-mono tabular-nums"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bookUsageType">Tipe penggunaan</Label>
              <NativeSelect
                id="bookUsageType"
                value={bookingUsageType}
                onChange={(e) => onBookingUsageTypeChange(e.target.value as any)}
              >
                <NativeSelectOption value="INDIVIDUAL">Individu / Pribadi</NativeSelectOption>
                <NativeSelectOption value="TEAM">Tim / Perusahaan</NativeSelectOption>
              </NativeSelect>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bookNotes">Catatan khusus (opsional)</Label>
            <Input
              id="bookNotes"
              type="text"
              placeholder="Contoh: Butuh proyektor dan kabel HDMI"
              value={bookingNotes}
              onChange={(e) => onBookingNotesChange(e.target.value)}
            />
          </div>

          {/* 4. Voucher / Promo */}
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <Label className="text-xs">Kode kupon / promo</Label>
            {activePromo ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 p-2">
                <div className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-success" />
                  <span className="font-mono font-medium text-foreground">{activePromo.code}</span>
                  <span className="text-muted-foreground">({activePromo.name})</span>
                </div>
                <Button type="button" size="icon-xs" variant="ghost" onClick={onRemovePromo} aria-label="Hapus promo">
                  <X />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Contoh: COWORK50"
                  value={voucherInput}
                  onChange={(e) => onVoucherInputChange(e.target.value.toUpperCase())}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!voucherInput.trim()}
                  onClick={() => onApplyVoucher(voucherInput.trim())}
                >
                  Gunakan
                </Button>
              </div>
            )}

            {voucherMessage ? (
              <p className={`text-xs ${voucherSuccess ? "text-success" : "text-destructive"}`}>
                {voucherMessage}
              </p>
            ) : null}
          </div>

          {/* 5. Metode Bayar */}
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <Label className="text-xs">Metode pembayaran</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={paymentMethod === "QRIS" ? "default" : "outline"}
                onClick={() => onPaymentMethodChange("QRIS")}
              >
                QRIS otomatis
              </Button>
              <Button
                type="button"
                size="sm"
                variant={paymentMethod === "CASHIER" ? "default" : "outline"}
                onClick={() => onPaymentMethodChange("CASHIER")}
              >
                Bayar di resepsionis
              </Button>
            </div>
          </div>

          {/* 6. Rincian Biaya */}
          <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/20 p-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tarif sewa dasar</span>
              <span className="font-mono tabular-nums text-foreground">{formatCurrencyIDR(baseCost)}</span>
            </div>

            {discount > 0 ? (
              <div className="flex justify-between text-success">
                <span>Diskon promo</span>
                <span className="font-mono tabular-nums">-{formatCurrencyIDR(discount)}</span>
              </div>
            ) : null}

            <div className="flex justify-between border-t pt-1.5 font-medium text-sm text-foreground">
              <span>Total sewa</span>
              <span className="font-mono text-base tabular-nums">{formatCurrencyIDR(finalCost)}</span>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Memproses..." : `Konfirmasi sewa (${formatCurrencyIDR(finalCost)})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
