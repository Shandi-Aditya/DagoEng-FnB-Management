"use client";

import { useState } from "react";
import { ChevronDown, Percent, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { PromoConfig } from "@/lib/promo";

export interface PromoMessage {
  type: "SUCCESS" | "ERROR";
  text: string;
}

export interface ManualDiscountState {
  type: "FIXED" | "PERCENT";
  value: number;
  reason: string;
  amount: number;
}

interface CartPromoFieldProps {
  code: string;
  onCodeChange: (code: string) => void;
  onApplyCode: () => void;
  message: PromoMessage | null;
  promos: readonly PromoConfig[];
  selectedPromoId: string;
  onPromoChange: (promoId: string) => void;
  onClear: () => void;
  minimumNotice: string | null;
  manualDiscount?: ManualDiscountState | null;
  requiresSupervisorPin?: boolean;
  onApplyManualDiscount?: (params: {
    type: "FIXED" | "PERCENT";
    value: number;
    reason: string;
    supervisorPin?: string;
  }) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onClearManualDiscount?: () => void;
}

function promoLabel(promo: PromoConfig): string {
  const value =
    promo.discountType === "PERCENTAGE"
      ? `${promo.discountValue}%${promo.maxDiscount ? `, maks Rp ${promo.maxDiscount.toLocaleString("id-ID")}` : ""}`
      : `potongan Rp ${promo.discountValue.toLocaleString("id-ID")}`;
  return `${promo.code ? `${promo.code} · ` : ""}${promo.name} (${value})`;
}

export function CartPromoField({
  code,
  onCodeChange,
  onApplyCode,
  message,
  promos,
  selectedPromoId,
  onPromoChange,
  onClear,
  minimumNotice,
  manualDiscount,
  requiresSupervisorPin = false,
  onApplyManualDiscount,
  onClearManualDiscount,
}: CartPromoFieldProps) {
  const hasPromo = Boolean(selectedPromoId || code);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualType, setManualType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [manualValueRaw, setManualValueRaw] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [supervisorPin, setSupervisorPin] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [isApplyingManual, setIsApplyingManual] = useState(false);

  const handleApplyManual = async () => {
    if (!onApplyManualDiscount || isApplyingManual) return;
    setManualError(null);

    const parsedValue = Number(manualValueRaw);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      setManualError("Isi nominal atau persentase diskon lebih dari 0.");
      return;
    }
    if (manualType === "PERCENT" && parsedValue > 100) {
      setManualError("Persentase diskon maksimal 100%.");
      return;
    }
    if (!manualReason.trim()) {
      setManualError("Alasan diskon wajib diisi.");
      return;
    }
    if (requiresSupervisorPin && !supervisorPin.trim()) {
      setManualError("PIN supervisor wajib diisi untuk diskon manual.");
      return;
    }

    setIsApplyingManual(true);
    try {
      const result = await onApplyManualDiscount({
        type: manualType,
        value: parsedValue,
        reason: manualReason.trim(),
        supervisorPin: supervisorPin.trim() || undefined,
      });
      if (!result.ok) {
        setManualError(result.error || "Gagal menerapkan diskon manual.");
        return;
      }
      setSupervisorPin("");
      setIsManualOpen(false);
    } finally {
      setIsApplyingManual(false);
    }
  };

  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor="pos-promo-code" className="justify-between">
        <span className="flex items-center gap-1.5">
          <Tag className="size-3.5 text-muted-foreground" aria-hidden />
          Promo atau voucher
        </span>
        {hasPromo ? (
          <Button variant="link" size="xs" className="h-auto px-0 text-destructive" onClick={onClear}>
            Hapus
          </Button>
        ) : null}
      </FieldLabel>
      <InputGroup>
        <InputGroupInput
          id="pos-promo-code"
          value={code}
          onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onApplyCode();
            }
          }}
          placeholder="Kode, misalnya DAGO20"
          // lint-ui-ignore: voucher codes are always upper case
          className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
          aria-invalid={message?.type === "ERROR"}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton variant="secondary" onClick={onApplyCode}>
            Terapkan
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {message?.type === "ERROR" ? <FieldError>{message.text}</FieldError> : null}
      {message?.type === "SUCCESS" ? <FieldDescription className="text-success">{message.text}</FieldDescription> : null}
      <NativeSelect className="w-full" value={selectedPromoId} onChange={(e) => onPromoChange(e.target.value)} aria-label="Promo aktif">
        <NativeSelectOption value="">{promos.length > 0 ? `Atau pilih promo aktif (${promos.length})` : "Tidak ada promo aktif"}</NativeSelectOption>
        {promos.map((promo) => (
          <NativeSelectOption key={promo.id} value={promo.id}>
            {promoLabel(promo)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {minimumNotice ? <FieldDescription>{minimumNotice}</FieldDescription> : null}

      {onApplyManualDiscount ? (
        <div className="pt-1">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setIsManualOpen((prev) => !prev)}
            >
              <Percent />
              <span>Diskon manual</span>
              <ChevronDown className={isManualOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            </Button>
            {manualDiscount && onClearManualDiscount ? (
              <Button
                type="button"
                variant="link"
                size="xs"
                className="h-auto px-0 text-destructive"
                onClick={() => {
                  onClearManualDiscount();
                  setManualValueRaw("");
                  setManualReason("");
                  setManualError(null);
                }}
              >
                Hapus diskon manual
              </Button>
            ) : null}
          </div>

          {manualDiscount ? (
            <FieldDescription className="text-success">
              Diskon manual aktif: {manualDiscount.type === "PERCENT" ? `${manualDiscount.value}%` : `Rp ${manualDiscount.value.toLocaleString("id-ID")}`} (−Rp {manualDiscount.amount.toLocaleString("id-ID")}) · {manualDiscount.reason}
            </FieldDescription>
          ) : null}

          {isManualOpen ? (
            <div className="mt-2 space-y-2 rounded-lg border bg-muted/20 p-2.5">
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={manualType === "FIXED" ? "default" : "outline"}
                  onClick={() => setManualType("FIXED")}
                >
                  Nominal (Rp)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={manualType === "PERCENT" ? "default" : "outline"}
                  onClick={() => setManualType("PERCENT")}
                >
                  Persen (%)
                </Button>
              </div>

              <Input
                type="number"
                min={0}
                max={manualType === "PERCENT" ? 100 : undefined}
                value={manualValueRaw}
                onChange={(e) => setManualValueRaw(e.target.value)}
                placeholder={manualType === "PERCENT" ? "Persentase (1-100)" : "Nominal potongan (Rp)"}
                className="font-mono tabular-nums"
                aria-label="Nilai diskon manual"
              />

              <Input
                type="text"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                placeholder="Alasan diskon (wajib)"
                aria-label="Alasan diskon"
              />

              {requiresSupervisorPin ? (
                <Input
                  type="password"
                  maxLength={6}
                  value={supervisorPin}
                  onChange={(e) => setSupervisorPin(e.target.value)}
                  placeholder="PIN supervisor"
                  className="font-mono"
                  aria-label="PIN supervisor"
                />
              ) : null}

              {manualError ? <FieldError>{manualError}</FieldError> : null}

              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full"
                disabled={isApplyingManual}
                onClick={handleApplyManual}
              >
                {isApplyingManual ? "Memverifikasi..." : "Terapkan diskon"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Field>
  );
}
