"use client";

import { Clock } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

const OPEN_SHIFT_PRESETS = [0, 100000, 200000, 500000];

interface PosOpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSubmitting: boolean;
  shiftName: string;
  onShiftNameChange: (name: string) => void;
  openingCash: number;
  onOpeningCashChange: (cash: number) => void;
  onSubmit: (e: React.FormEvent) => void;
}

/** Quick modal to open a new cashier shift session directly from POS. */
export function PosOpenShiftModal({
  isOpen,
  onClose,
  isSubmitting,
  shiftName,
  onShiftNameChange,
  openingCash,
  onOpeningCashChange,
  onSubmit,
}: PosOpenShiftModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-w-md gap-4 p-5">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            <DialogTitle className="text-sm font-medium text-foreground">
              Buka shift kasir baru
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Tentukan sesi kerja dan modal kas awal di laci kasir
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <FieldLabel>Nama sesi shift</FieldLabel>
            <NativeSelect
              value={shiftName}
              onChange={(e) => onShiftNameChange(e.target.value)}
              disabled={isSubmitting}
              className="w-full"
            >
              <NativeSelectOption value="Shift Pagi (08:00 - 16:00)">
                Shift Pagi (08:00 - 16:00)
              </NativeSelectOption>
              <NativeSelectOption value="Shift Sore (14:00 - 22:00)">
                Shift Sore (14:00 - 22:00)
              </NativeSelectOption>
              <NativeSelectOption value="Shift Malam (16:00 - 23:00)">
                Shift Malam (16:00 - 23:00)
              </NativeSelectOption>
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Modal kas awal di laci kasir (Rp) *</FieldLabel>
            <Input
              type="number"
              required
              min={0}
              step={10000}
              value={openingCash || ""}
              onChange={(e) => onOpeningCashChange(Number(e.target.value))}
              disabled={isSubmitting}
              placeholder="Contoh: 500000"
              className="font-mono tabular-nums"
            />

            <div className="pt-1 space-y-1">
              <span className="text-[11px] text-muted-foreground">Preset cepat:</span>
              <div className="grid grid-cols-4 gap-1.5">
                {OPEN_SHIFT_PRESETS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => onOpeningCashChange(amt)}
                    disabled={isSubmitting}
                    className={cn(
                      "rounded-md border p-1.5 text-center font-mono text-xs tabular-nums transition-colors touch-manipulation",
                      openingCash === amt
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-border bg-card hover:bg-accent/40 text-foreground"
                    )}
                  >
                    {amt === 0 ? "Rp 0" : `${amt / 1000}k`}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground pt-0.5">
              Uang pecahan fisik di laci kasir untuk modal uang kembalian transaksi tunai.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <span>Membuka sesi...</span>
              ) : (
                <span>Buka shift dan mulai transaksi</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
