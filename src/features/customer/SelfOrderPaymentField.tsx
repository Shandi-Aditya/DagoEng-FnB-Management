"use client";

import { Button } from "@/components/ui/button";
import {
  getAllowedSelfOrderPayments,
  isQrSelfOrderQrisOnly,
  type SelfOrderPaymentChoice,
} from "@/lib/self-order-policy";
import { cn } from "@/lib/utils";
import type { PlatformSettings } from "@/types/settings";

export interface SelfOrderPaymentFieldProps {
  value: SelfOrderPaymentChoice;
  onChange: (method: SelfOrderPaymentChoice) => void;
  qrisOnly?: boolean;
  settings?: Pick<PlatformSettings, "qrSelfOrderQrisOnly"> | null;
  qrisLabel?: string;
  cashierLabel?: string;
  compact?: boolean;
}

export function SelfOrderPaymentField({
  value,
  onChange,
  qrisOnly,
  settings,
  qrisLabel = "QRIS",
  cashierLabel = "Di kasir",
  compact = false,
}: SelfOrderPaymentFieldProps) {
  const effectiveSettings =
    qrisOnly !== undefined ? { qrSelfOrderQrisOnly: qrisOnly } : settings;
  const resolvedQrisOnly = isQrSelfOrderQrisOnly(effectiveSettings);
  const allowedPayments = getAllowedSelfOrderPayments(effectiveSettings);

  if (resolvedQrisOnly) {
    return (
      <div
        className={cn(
          "flex flex-col gap-1 border bg-muted/40",
          compact ? "rounded-md p-2.5 text-xs" : "rounded-xl p-3 text-sm"
        )}
      >
        <span className="font-medium text-foreground">{qrisLabel}</span>
        <span className="text-xs text-muted-foreground">
          Pembayaran diproses lewat QRIS. Status lunas diperbarui otomatis setelah verifikasi.
        </span>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Metode bayar"
      className={compact ? "grid grid-cols-2 gap-2" : "flex gap-2"}
    >
      {allowedPayments.map((method) => (
        <Button
          key={method}
          type="button"
          size={compact ? "sm" : "lg"}
          variant={value === method ? "default" : "outline"}
          aria-pressed={value === method}
          onClick={() => onChange(method)}
          className={compact ? undefined : "h-10 flex-1 text-sm"}
        >
          {method === "QRIS" ? qrisLabel : cashierLabel}
        </Button>
      ))}
    </div>
  );
}
