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
  formatCoworkingDuration,
  spaceTypeLabel,
} from "@/features/pos/pos-coworking";
import { formatCoworkingTaxLabel } from "@/features/coworking/coworking-domain";
import { useAuth } from "@/contexts/AuthContext";
import { canUserViewFullCustomerContacts, maskCustomerPhone } from "@/features/customers/customers-domain";
import type { POSPaymentMethod } from "@/features/pos/types";
import { getCoworkingStartSlots, isWithinCoworkingHours } from "@/lib/operating-hours";
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
  cwPricing: {
    originalSubtotal: number;
    discountAmount: number;
    tax: number;
    total: number;
    taxType?: string;
    taxRatePercent?: number;
  };
  isTaxEnabled: boolean;
  taxRatePercent: number;
  cwPaymentMethod: POSPaymentMethod;
  onPaymentMethodChange: (method: POSPaymentMethod) => void;
  onCompletePayment: () => void;
  isDateClosed?: boolean;
  closedDateReason?: string;
}

const QUICK_DURATIONS = [
  { hours: 1, label: "1 jam" },
  { hours: 2, label: "2 jam" },
  { hours: 3, label: "3 jam" },
  { hours: 8, label: "Seharian (8 jam)" },
];

const PAYMENT_METHODS: { id: POSPaymentMethod; label: string; desc: string }[] = [
  { id: "QRIS", label: "QRIS", desc: "e-Wallet" },
  { id: "CASH", label: "Tunai", desc: "Kasir" },
  { id: "EDC", label: "Debit / EDC", desc: "Kartu" },
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
  isDateClosed = false,
  closedDateReason,
}: CoworkingBookingPanelProps) {
  const { user } = useAuth();
  const canViewContact = canUserViewFullCustomerContacts(user?.role?.slug);
  const endTime = calculateEndTime(cwStartTime, cwDuration);
  const isPastOperatingHours = !isWithinCoworkingHours(cwStartTime, cwDuration);
  const startSlots = getCoworkingStartSlots(1);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-xs text-card-foreground shadow-xs">
      {/* Panel header */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3">
        <div className="space-y-0.5 min-w-0">
          <span className="text-xs text-muted-foreground">
            {spaceTypeLabel(selectedSpace.type)}
          </span>
          <h4 className="text-sm font-medium text-foreground truncate">
            {selectedSpace.name}
          </h4>
          <p className="font-mono text-xs tabular-nums text-foreground">
            {formatCurrencyIDR(selectedSpace.hourlyRate)} /jam
            {selectedSpace.dailyRate ? (
              <span className="ml-1 text-muted-foreground">
                (Seharian: {formatCurrencyIDR(selectedSpace.dailyRate)})
              </span>
            ) : null}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClosePanel}
          className="shrink-0"
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
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {formatCoworkingDuration(cwDuration)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUICK_DURATIONS.map((item) => {
            const isSelected = cwDuration === item.hours;
            const price =
              item.hours === 8 && selectedSpace.dailyRate
                ? selectedSpace.dailyRate
                : selectedSpace.hourlyRate * item.hours;

            return (
              <button
                key={item.hours}
                type="button"
                onClick={() => onDurationChange(item.hours)}
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border p-2 text-center transition-colors touch-manipulation",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary"
                    : "border-border bg-card hover:bg-muted/40 text-foreground"
                )}
              >
                <span className="text-xs font-medium">{item.label}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatCurrencyIDR(price)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-muted-foreground">Durasi lain</span>
          <NativeSelect
            value={cwDuration}
            onChange={(e) => onDurationChange(Number(e.target.value))}
            className="w-40"
            aria-label="Pilih durasi lain"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((h) => (
              <NativeSelectOption key={h} value={h}>
                {h} jam {h === 4 ? "(setengah hari)" : h === 8 ? "(seharian)" : h === 9 ? "(penuh 09:00–18:00)" : ""}
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
          >
            Waktu saat ini
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Mulai</span>
            <input
              type="time"
              value={cwStartTime}
              min="09:00"
              max="17:00"
              onChange={(e) => onStartTimeChange(e.target.value)}
              className="rounded-md border border-input bg-input/20 px-2 py-0.5 font-mono text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-ring"
              aria-label="Jam mulai sewa"
            />
          </div>
          <div className="font-mono text-xs tabular-nums text-foreground">
            <span className="text-muted-foreground">Selesai: </span>
            <span>{endTime} WITA</span>
          </div>
        </div>

        {isDateClosed && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="size-4 shrink-0" />
            <AlertDescription className="text-xs">
              {closedDateReason || "Co-working tutup pada tanggal ini"}. Operasional reguler Senin sampai Jumat, 09:00–18:00 WITA.
            </AlertDescription>
          </Alert>
        )}

        {isPastOperatingHours && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="size-4 shrink-0" />
            <AlertDescription className="text-xs">
              Waktu sewa ({cwStartTime}–{endTime} WITA) melewati jam kantor Dago Creative Hub (09:00–18:00 WITA).
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-3 gap-1.5 pt-1 sm:grid-cols-5">
          {startSlots.map((slot) => {
            const isAvail = checkSlotAvailable(slot);
            const isSelected = cwStartTime === slot;

            return (
              <button
                key={slot}
                type="button"
                disabled={!isAvail}
                onClick={() => onStartTimeChange(slot)}
                className={cn(
                  "flex flex-col items-center justify-center rounded-md border p-1 text-center transition-colors touch-manipulation",
                  !isAvail && "cursor-not-allowed border-border bg-muted/30 opacity-50",
                  isAvail && isSelected && "border-primary bg-primary text-primary-foreground font-medium",
                  isAvail && !isSelected && "border-border bg-card hover:bg-muted/40 text-foreground"
                )}
              >
                <span className="font-mono text-xs leading-tight">{slot}</span>
                <span className="text-xs">
                  {isAvail ? "Tersedia" : "Terisi"}
                </span>
              </button>
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
            aria-label="Nama instansi atau perusahaan"
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
            aria-label="Pilih member loyalty"
          >
            <NativeSelectOption value="">
              Pilih member ({membersList.length})
            </NativeSelectOption>
            {membersList.map((m) => (
              <NativeSelectOption key={m.id} value={m.id}>
                {m.name} ({m.tier} • {m.points} poin) - {canViewContact ? m.phone : maskCustomerPhone(m.phone)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : (
          <div className="space-y-2">
            <Input
              value={cwGuestName}
              onChange={(e) => onGuestNameChange(e.target.value)}
              placeholder="Nama lengkap tamu"
              aria-label="Nama lengkap tamu"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="tel"
                value={cwGuestPhone}
                onChange={(e) => onGuestPhoneChange(e.target.value)}
                placeholder="Nomor WhatsApp"
                aria-label="Nomor WhatsApp"
              />
              <Input
                type="email"
                value={cwGuestEmail}
                onChange={(e) => onGuestEmailChange(e.target.value)}
                placeholder="Email tamu"
                aria-label="Email tamu"
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
              variant="ghost"
              size="sm"
              onClick={onRemoveVoucher}
              className="text-destructive hover:text-destructive"
            >
              Hapus
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <InputGroup className="flex-1 font-mono">
            <InputGroupInput
              value={cwVoucherCode}
              onChange={(e) => onVoucherCodeChange(e.target.value.toUpperCase())}
              placeholder="Misalnya COWORK50"
              aria-label="Kode voucher promo"
            />
          </InputGroup>
          <Button type="button" variant="secondary" size="lg" onClick={onApplyVoucher}>
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
          <span>Sewa ({formatCoworkingDuration(cwDuration)})</span>
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
        <div className="flex justify-between text-muted-foreground">
          <span>
            {formatCoworkingTaxLabel(cwPricing.tax, cwPricing.taxType, cwPricing.taxRatePercent)}
          </span>
          <span className="font-mono tabular-nums">
            {formatCurrencyIDR(cwPricing.tax)}
          </span>
        </div>
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
                size="lg"
                onClick={() => onPaymentMethodChange(pm.id)}
                className="w-full flex-col gap-0.5"
              >
                <span className="font-medium leading-tight">{pm.label}</span>
                <span className={cn("text-xs font-normal", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
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
        disabled={isPastOperatingHours || isDateClosed}
        onClick={onCompletePayment}
        className="w-full font-medium"
      >
        <ShieldCheck className="size-4" />
        <span>Bayar dan cetak nota ({formatCurrencyIDR(cwPricing.total)})</span>
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
