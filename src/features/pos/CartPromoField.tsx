"use client";

import { Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { PromoConfig } from "@/lib/promo";

export interface PromoMessage {
  type: "SUCCESS" | "ERROR";
  text: string;
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
}

function promoLabel(promo: PromoConfig): string {
  const value =
    promo.discountType === "PERCENTAGE"
      ? `${promo.discountValue}%${promo.maxDiscount ? `, maks Rp ${promo.maxDiscount.toLocaleString("id-ID")}` : ""}`
      : `potongan Rp ${promo.discountValue.toLocaleString("id-ID")}`;
  return `${promo.code ? `${promo.code} · ` : ""}${promo.name} (${value})`;
}

/** Voucher code entry or a pick from active promos. */
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
}: CartPromoFieldProps) {
  const hasPromo = Boolean(selectedPromoId || code);

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
    </Field>
  );
}
