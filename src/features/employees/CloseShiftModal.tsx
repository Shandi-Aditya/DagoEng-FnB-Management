import { useState, useMemo } from "react";
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
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <span>Tutup shift</span>
          </DialogTitle>
          <DialogDescription>
            Pencocokan saldo uang tunai fisik di laci kas dengan kalkulasi sistem.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Shift Summary Breakdown */}
          <div className="p-3.5 rounded-lg border bg-muted/30 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modal awal</span>
              <span className="font-mono font-medium text-foreground">
                {formatCurrencyIDR(shift.openingCash)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Penjualan tunai</span>
              <span className="font-mono font-medium text-foreground">
                {formatCurrencyIDR(shift.cashSales)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Penjualan nontunai</span>
              <span className="font-mono text-muted-foreground">
                {formatCurrencyIDR(shift.nonCashSales)}
              </span>
            </div>
            <div className="flex justify-between pt-1.5 border-t">
              <span className="font-medium text-foreground">Kas seharusnya</span>
              <span className="font-mono font-bold text-foreground">
                {formatCurrencyIDR(expectedCash)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="actual-cash" className="text-xs">
              Uang Tunai Fisik Aktual di Laci (Rp) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="actual-cash"
              type="number"
              min={0}
              required
              value={actualCash}
              onChange={(e) => setActualCash(Number(e.target.value))}
              className="text-xs font-mono font-medium"
            />
            <p className="text-[11px] text-muted-foreground font-mono">
              Terbaca: {formatCurrencyIDR(actualCash)}
            </p>
          </div>

          {/* Variance Indicator */}
          <div
            className={`p-3 rounded-lg border text-xs flex items-center justify-between font-mono ${
              variance === 0
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : variance < 0
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
            }`}
          >
            <span className="font-medium">
              {variance === 0
                ? "Kas Seimbang (Match)"
                : variance < 0
                ? "Selisih Kurang (Shortage)"
                : "Selisih Lebih (Overage)"}
            </span>
            <span className="font-bold tabular-nums">
              {variance > 0 ? `+${formatCurrencyIDR(variance)}` : formatCurrencyIDR(variance)}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="close-notes" className="text-xs">Catatan (opsional)</Label>
            <Textarea
              id="close-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jelaskan selisih kas atau kejadian selama shift"
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Batal
            </Button>
            <Button type="submit" size="sm" className="text-xs font-medium">
              Tutup Shift Sekarang
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
