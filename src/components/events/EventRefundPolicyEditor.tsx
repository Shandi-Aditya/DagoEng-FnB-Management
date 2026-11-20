"use client";

import React from "react";
import { RotateCcw, AlertTriangle, ShieldCheck } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { EventRefundPolicy, EventRefundPolicyType } from "@/types/event";

interface EventRefundPolicyEditorProps {
  value?: EventRefundPolicy;
  onChange: (policy: EventRefundPolicy) => void;
  disabled?: boolean;
  hasPaidTickets?: boolean;
}

export function EventRefundPolicyEditor({
  value = { policyType: "NO_REFUND" },
  onChange,
  disabled = false,
  hasPaidTickets = false,
}: EventRefundPolicyEditorProps) {
  const isLocked = disabled || hasPaidTickets;
  const policyType = value.policyType || "NO_REFUND";
  const hMinusDays = typeof value.hMinusDays === "number" ? value.hMinusDays : 3;
  const refundFeePercent = typeof value.refundFeePercent === "number" ? value.refundFeePercent : 10;

  const handlePolicyTypeChange = (newType: EventRefundPolicyType) => {
    if (newType === "NO_REFUND") {
      onChange({ policyType: "NO_REFUND" });
    } else {
      onChange({
        policyType: "REFUNDABLE_UNTIL_H_MINUS",
        hMinusDays,
        refundFeePercent,
      });
    }
  };

  const handleHMinusDaysChange = (days: number) => {
    const safeDays = Math.max(1, Math.min(30, Math.floor(days || 1)));
    onChange({
      ...value,
      policyType: "REFUNDABLE_UNTIL_H_MINUS",
      hMinusDays: safeDays,
      refundFeePercent,
    });
  };

  const handleFeePercentChange = (fee: number) => {
    const safeFee = Math.max(0, Math.min(100, Math.floor(fee || 0)));
    onChange({
      ...value,
      policyType: "REFUNDABLE_UNTIL_H_MINUS",
      hMinusDays,
      refundFeePercent: safeFee,
    });
  };

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <RotateCcw className="size-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            Kebijakan refund dan pembatalan tiket
          </span>
        </div>
        {hasPaidTickets && (
          <div className="flex items-center gap-1 text-xs text-warning font-medium">
            <ShieldCheck className="size-3.5" />
            <span>Terkunci (ada tiket aktif)</span>
          </div>
        )}
      </div>

      {hasPaidTickets && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>
            Kebijakan pembatalan dan refund dikunci karena event ini sudah memiliki tiket lunas aktif demi melindungi hak peserta.
          </span>
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="refund-policy-type" className="text-xs">
            Ketentuan pembatalan tiket <span className="text-destructive">*</span>
          </Label>
          <NativeSelect
            id="refund-policy-type"
            value={policyType}
            disabled={isLocked}
            onChange={(e) => handlePolicyTypeChange(e.target.value as EventRefundPolicyType)}
            className="text-xs"
          >
            <NativeSelectOption value="NO_REFUND">Tidak bisa refund (tiket tidak dapat dibatalkan)</NativeSelectOption>
            <NativeSelectOption value="REFUNDABLE_UNTIL_H_MINUS">Bisa refund sampai H-x sebelum acara</NativeSelectOption>
          </NativeSelect>
        </div>

        {policyType === "REFUNDABLE_UNTIL_H_MINUS" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label htmlFor="refund-h-minus" className="text-xs">
                Batas hari pengajuan (H-x) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="refund-h-minus"
                type="number"
                min={0}
                max={60}
                disabled={isLocked}
                value={hMinusDays}
                onChange={(e) => handleHMinusDaysChange(Number(e.target.value))}
                placeholder="Contoh: 3 (H-3)"
                className="text-xs font-mono"
              />
              <span className="text-xs text-muted-foreground block">
                Maksimal pengajuan pembatalan {hMinusDays} hari sebelum acara.
              </span>
            </div>

            <div className="space-y-1">
              <Label htmlFor="refund-fee-percent" className="text-xs">
                Potongan biaya admin (%)
              </Label>
              <Input
                id="refund-fee-percent"
                type="number"
                min={0}
                max={100}
                disabled={isLocked}
                value={refundFeePercent}
                onChange={(e) => handleFeePercentChange(Number(e.target.value))}
                placeholder="Contoh: 10 (%)"
                className="text-xs font-mono"
              />
              <span className="text-xs text-muted-foreground block">
                Biaya admin dipotong dari total refund ({refundFeePercent}%).
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
