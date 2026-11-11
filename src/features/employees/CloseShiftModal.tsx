"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import type { ShiftRecord } from "@/types/shift";
import { formatCurrencyIDR } from "@/lib/utils";
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
import { Textarea } from "@/components/ui/textarea";

export interface CloseShiftModalProps {
  shift: ShiftRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: { actualCash: number; closingNotes?: string }) => void;
}

export function CloseShiftModal({
  shift,
  isOpen,
  onClose,
  onSubmit,
}: CloseShiftModalProps) {
  const [actualCash, setActualCash] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const expectedCash = useMemo(() => {
    if (!shift) return 0;
    return (shift.openingCash || 0) + (shift.cashSales || 0) - (shift.refundAmount || 0);
  }, [shift]);

  const variance = actualCash - expectedCash;

  if (!shift) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      actualCash: Math.max(0, actualCash),
      closingNotes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <Clock className="size-4 text-primary" />
            <span>Tutup shift</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pencocokan saldo uang tunai fisik di laci kas dengan kalkulasi sistem.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Shift Summary Breakdown */}
          <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modal awal</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatCurrencyIDR(shift.openingCash)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Penjualan tunai</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatCurrencyIDR(shift.cashSales)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Penjualan nontunai</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {formatCurrencyIDR(shift.nonCashSales)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-1.5">
              <span className="font-medium text-foreground">Kas seharusnya</span>
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {formatCurrencyIDR(expectedCash)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="actual-cash" className="text-xs font-medium text-foreground">
              Uang tunai fisik di laci (Rp) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="actual-cash"
              type="number"
              min={0}
              step={1000}
              required
              value={actualCash}
              onChange={(e) => setActualCash(Number(e.target.value))}
              className="text-xs font-mono font-medium"
            />
          </div>

          {/* Variance Indicator */}
          {actualCash > 0 && (
            <div
              className={`flex items-center justify-between rounded-lg border p-3 text-xs ${
                variance === 0
                  ? "border-success/30 bg-success/10 text-success"
                  : variance < 0
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-warning/30 bg-warning/10 text-warning"
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span className="font-medium">
                  {variance === 0
                    ? "Kas fisik cocok sempurna"
                    : variance < 0
                    ? "Selisih kurang (kas tekor)"
                    : "Selisih lebih (kas berlebih)"}
                </span>
              </div>
              <span className="font-mono font-semibold tabular-nums">
                {formatCurrencyIDR(Math.abs(variance))}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="closing-notes" className="text-xs font-medium text-foreground">
              Catatan closing
            </Label>
            <Textarea
              id="closing-notes"
              rows={2}
              placeholder="Catatan kendala shift atau penjelasan selisih..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 border-t pt-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Batal
            </Button>
            <Button type="submit" size="sm">
              Tutup shift
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
