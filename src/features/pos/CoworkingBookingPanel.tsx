"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, Clock, ShieldCheck, Tag, User, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  calculateEndTime,
  COWORKING_TIME_SLOTS,
  parseHour,
} from "@/features/pos/pos-coworking";
import type { POSPaymentMethod } from "@/features/pos/types";
import type { PromoConfig } from "@/lib/promo";
import type { CoworkingSpaceItem } from "@/types/coworking";
import type { LoyaltyMember } from "@/types/loyalty";
import { cn, formatCurrencyIDR } from "@/lib/utils";

interface CoworkingBookingPanelProps {
  selectedSpace: CoworkingSpaceItem;
  onClosePanel: () => void;
  cwDuration: number;
  onDurationChange: (duration: number) => void;
  cwStartTime: string;
  onStartTimeChange: (time: string) => void;
  onResetStartTime: () => void;
  checkSlotAvailable: (slot: string) => boolean;
  cwUsageType: "PERSONAL" | "GROUP";
  onUsageTypeChange: (type: "PERSONAL" | "GROUP") => void;
  cwCompanyName: string;
  onCompanyNameChange: (name: string) => void;
  cwCustomerType: "MEMBER" | "WALK_IN";
  onCustomerTypeChange: (type: "MEMBER" | "WALK_IN") => void;
  membersList: readonly LoyaltyMember[];
  cwMemberId: string;
  onMemberIdChange: (id: string) => void;
  cwGuestName: string;
  onGuestNameChange: (name: string) => void;
  cwGuestPhone: string;
  onGuestPhoneChange: (phone: string) => void;
  cwGuestEmail: string;
  onGuestEmailChange: (email: string) => void;
  cwVoucherCode: string;
  onVoucherCodeChange: (code: string) => void;
  onApplyVoucher: () => void;
  onRemoveVoucher: () => void;
  cwAppliedPromo: PromoConfig | null;
  cwVoucherValidationMsg: { type: "SUCCESS" | "ERROR"; text: string } | null;
  cwPricing: { originalSubtotal: number; discountAmount: number; tax: number; total: number };
  isTaxEnabled: boolean;
  taxRatePercent: number;
  cwPaymentMethod: POSPaymentMethod;
  onPaymentMethodChange: (method: POSPaymentMethod) => void;
  onCompletePayment: () => void;
}

const QUICK_DURATIONS = [
  { hours: 1, label: "1 jam" },
  { hours: 2, label: "2 jam" },
  { hours: 3, label: "3 jam" },
  { hours: 8, label: "Full day" },
];

const PAYMENT_METHODS: { id: POSPaymentMethod; label: string; desc: string }[] = [
  { id: "QRIS", label: "QRIS", desc: "e-Wallet" },
  { id: "CASH", label: "Tunai", desc: "Kasir" },
  { id: "EDC", label: "Debit/EDC", desc: "Kartu" },
];

/** Side panel for booking configuration, duration, guest, and payment in co-working mode. */
export function CoworkingBookingPanel({
  selectedSpace,
  onClosePanel,
  cwDuration,
  onDurationChange,
  cwStartTime,
  onStartTimeChange,
  onResetStartTime,
  checkSlotAvailable,
  cwUsageType,
  onUsageTypeChange,
  cwCompanyName,
  onCompanyNameChange,
  cwCustomerType,
  onCustomerTypeChange,
  membersList,
  cwMemberId,
  onMemberIdChange,
  cwGuestName,
  onGuestNameChange,
  cwGuestPhone,
  onGuestPhoneChange,
  cwGuestEmail,
  onGuestEmailChange,
  cwVoucherCode,
  onVoucherCodeChange,
  onApplyVoucher,
  onRemoveVoucher,
  cwAppliedPromo,
  cwVoucherValidationMsg,
  cwPricing,
  isTaxEnabled,
  taxRatePercent,
  cwPaymentMethod,
  onPaymentMethodChange,
  onCompletePayment,
}: CoworkingBookingPanelProps) {
  const endTime = calculateEndTime(cwStartTime, cwDuration);
  const isPastOperatingHours = parseHour(cwStartTime) + cwDuration > 18;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-xs text-card-foreground shadow-xs">
      {/* Panel header */}
      <div className="flex items-start justify-between rounded-lg border border-border bg-muted/40 p-3">
        <div className="space-y-0.5">
          <span className="text-xs text-muted-foreground">
            {selectedSpace.type.replace("_", " ").toLowerCase()}
          </span>
          <h4 className="text-sm font-medium text-foreground">
            {selectedSpace.name}
          </h4>
          <p className="font-mono text-xs tabular-nums text-foreground">
            {formatCurrencyIDR(selectedSpace.hourlyRate)} /jam
            {selectedSpace.dailyRate ? (
              <span className="ml-1 text-muted-foreground">
                (Full day: {formatCurrencyIDR(selectedSpace.dailyRate)})
              </span>
            ) : null}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClosePanel}
          className="text-xs"
        >
          <X className="size-3.5" />
          <span>Ganti ruang</span>
        </Button>
      </div>

      {/* Duration selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <FieldLabel className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-muted-foreground" />
            <span>Pilihan durasi sewa</span>
          </FieldLabel>
          <span className="font-mono text-xs text-muted-foreground">
            {cwDuration} jam terpilih
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {QUICK_DURATIONS.map((item) => {
            const isSelected = cwDuration === item.hours;
            const price = item.hours === 8 && selectedSpace.dailyRate
              ? selectedSpace.dailyRate
              : selectedSpace.hourlyRate * item.hours;

            return (
              <Button
                key={item.hours}
                type="button"
                variant={isSelected ? "default" : "outline"}
                onClick={() => onDurationChange(item.hours)}
                className="h-auto min-h-[46px] flex-col gap-0 p-1.5 touch-manipulation"
              >
                <span className="text-xs font-medium">{item.label}</span>
                <span className={cn("font-mono text-[11px] tabular-nums", isSelected ? "text-primary-foreground/90" : "text-muted-foreground")}>
                  {formatCurrencyIDR(price)}
                </span>
              </Button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-muted-foreground">Durasi lain</span>
          <NativeSelect
            value={cwDuration}
            onChange={(e) => onDurationChange(Number(e.target.value))}
            className="w-36"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((h) => (
              <NativeSelectOption key={h} value={h}>
                {h} jam {h === 4 ? "(setengah hari)" : h === 8 ? "(full day)" : h === 12 ? "(maksimal)" : ""}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      {/* Start time */}
      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <FieldLabel className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-muted-foreground" />
            <span>Jam mulai (09:00–18:00 WITA)</span>
          </FieldLabel>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={onResetStartTime}
            className="h-auto p-0 text-xs"
          >
            Auto waktu terdekat
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Mulai</span>
            <input
              type="time"
              value={cwStartTime}
              min="09:00"
              max="18:00"
              onChange={(e) => onStartTimeChange(e.target.value)}
              className="rounded-md border border-input bg-input/20 px-2 py-0.5 font-mono text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="font-mono text-xs tabular-nums text-foreground">
            <span className="text-muted-foreground">Selesai: </span>
            <span>{endTime} WITA</span>
          </div>
        </div>

        {isPastOperatingHours && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="size-4 shrink-0" />
            <AlertDescription className="text-xs">
              Waktu selesai ({endTime} WITA) melewati jam operasional co-working (tutup 18:00 WITA).
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-5 gap-1 pt-1">
          {COWORKING_TIME_SLOTS.slice(0, 9).map((slot) => {
            const isAvail = checkSlotAvailable(slot);
            const isSelected = cwStartTime === slot;

            return (
              <Button
                key={slot}
                type="button"
                variant={isSelected ? "default" : "outline"}
                disabled={!isAvail}
                onClick={() => onStartTimeChange(slot)}
                className={cn("h-auto min-h-[38px] flex-col gap-0 p-1 touch-manipulation", !isAvail && "line-through")}
              >
                <span className="font-mono text-xs leading-tight">{slot}</span>
                <span
                  className={cn(
                    "text-[10px] no-underline",
                    !isAvail && "text-destructive",
                    isAvail && (isSelected ? "text-primary-foreground/90" : "text-muted-foreground"),
                  )}
                >
                  {isAvail ? "Tersedia" : "Terisi"}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Usage type */}
      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <FieldLabel>Tipe penggunaan</FieldLabel>
          <Tabs
            value={cwUsageType}
            onValueChange={(val) => onUsageTypeChange(val as "PERSONAL" | "GROUP")}
          >
            <TabsList>
              <TabsTrigger value="PERSONAL">Pribadi</TabsTrigger>
              <TabsTrigger value="GROUP">Grup atau perusahaan</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {cwUsageType === "GROUP" && (
          <Input
            value={cwCompanyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            placeholder="Nama instansi atau perusahaan"
          />
        )}
      </div>

      {/* Customer identity */}
      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <FieldLabel className="flex items-center gap-1.5">
            <User className="size-3.5 text-muted-foreground" />
            <span>Identitas tamu</span>
          </FieldLabel>
          <Tabs
            value={cwCustomerType}
            onValueChange={(val) => onCustomerTypeChange(val as "MEMBER" | "WALK_IN")}
          >
            <TabsList>
              <TabsTrigger value="MEMBER">Member</TabsTrigger>
              <TabsTrigger value="WALK_IN">Walk-in</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {cwCustomerType === "MEMBER" ? (
          <NativeSelect
            value={cwMemberId}
            onChange={(e) => onMemberIdChange(e.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="">
              Pilih member ({membersList.length})
            </NativeSelectOption>
            {membersList.map((m) => (
              <NativeSelectOption key={m.id} value={m.id}>
                {m.name} ({m.tier} • {m.points} pts) - {m.phone}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : (
          <div className="space-y-2">
            <Input
              value={cwGuestName}
              onChange={(e) => onGuestNameChange(e.target.value)}
              placeholder="Nama lengkap tamu"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="tel"
                value={cwGuestPhone}
                onChange={(e) => onGuestPhoneChange(e.target.value)}
                placeholder="Nomor WhatsApp"
              />
              <Input
                type="email"
                value={cwGuestEmail}
                onChange={(e) => onGuestEmailChange(e.target.value)}
                placeholder="Email tamu"
              />
            </div>
          </div>
        )}
      </div>

      {/* Promo voucher */}
      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <FieldLabel className="flex items-center gap-1.5">
            <Tag className="size-3.5 text-muted-foreground" />
            <span>Voucher promo co-working</span>
          </FieldLabel>
          {cwAppliedPromo && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={onRemoveVoucher}
              className="h-auto p-0 text-xs text-destructive"
            >
              Hapus
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <InputGroup className="flex-1 font-mono uppercase">
            <InputGroupInput
              value={cwVoucherCode}
              onChange={(e) => onVoucherCodeChange(e.target.value.toUpperCase())}
              placeholder="Misalnya COWORK50"
            />
          </InputGroup>
          <Button type="button" variant="secondary" onClick={onApplyVoucher}>
            Terapkan
          </Button>
        </div>

        {cwVoucherValidationMsg && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-md border p-2 text-xs",
              cwVoucherValidationMsg.type === "SUCCESS"
                ? "border-success/30 bg-success/10 text-success"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            )}
          >
            {cwVoucherValidationMsg.type === "SUCCESS" ? (
              <CheckCircle2 className="size-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="size-3.5 shrink-0" />
            )}
            <span>{cwVoucherValidationMsg.text}</span>
          </div>
        )}
      </div>

      {/* Price breakdown */}
      <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex justify-between text-muted-foreground">
          <span>Sewa ({cwDuration} jam)</span>
          <span className="font-mono tabular-nums">
            {formatCurrencyIDR(cwPricing.originalSubtotal)}
          </span>
        </div>
        {cwPricing.discountAmount > 0 && (
          <div className="flex justify-between text-success">
            <span>
              Diskon promo {cwAppliedPromo ? `(${cwAppliedPromo.code || cwAppliedPromo.name})` : ""}
            </span>
            <span className="font-mono tabular-nums">
              -{formatCurrencyIDR(cwPricing.discountAmount)}
            </span>
          </div>
        )}
        {isTaxEnabled && (
          <div className="flex justify-between text-muted-foreground">
            <span>Pajak PB1 ({taxRatePercent}%)</span>
            <span className="font-mono tabular-nums">
              {formatCurrencyIDR(cwPricing.tax)}
            </span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-1.5 text-sm font-medium text-foreground">
          <span>Total tagihan</span>
          <span className="font-mono tabular-nums text-foreground">
            {formatCurrencyIDR(cwPricing.total)}
          </span>
        </div>
      </div>

      {/* Payment methods */}
      <div className="space-y-2">
        <FieldLabel>Metode pembayaran kasir</FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((pm) => {
            const isSelected = cwPaymentMethod === pm.id;
            return (
              <Button
                key={pm.id}
                type="button"
                variant={isSelected ? "default" : "outline"}
                onClick={() => onPaymentMethodChange(pm.id)}
                className="h-auto min-h-[44px] flex-col gap-0 p-1.5 text-center touch-manipulation"
              >
                <span className="text-xs font-medium leading-tight">{pm.label}</span>
                <span className={cn("text-[10px]", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {pm.desc}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Checkout action */}
      <Button
        type="button"
        size="lg"
        onClick={onCompletePayment}
        className="w-full text-xs font-medium"
      >
        <ShieldCheck className="size-4" />
        <span>Bayar dan cetak nota ({formatCurrencyIDR(cwPricing.total)})</span>
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
