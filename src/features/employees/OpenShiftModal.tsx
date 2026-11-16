"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
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
import { NativeSelect } from "@/components/ui/native-select";

export interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: { shiftName: string; openingCash: number }) => void;
}

const SHIFT_OPTIONS = [
  "Shift Pagi (08:00 - 16:00)",
  "Shift Siang (12:00 - 20:00)",
  "Shift Sore (16:00 - 24:00)",
  "Full Day General (09:00 - 18:00)",
];

export function OpenShiftModal({
  isOpen,
  onClose,
  onSubmit,
}: OpenShiftModalProps) {
  const [shiftName, setShiftName] = useState(SHIFT_OPTIONS[0]);
  const [openingCash, setOpeningCash] = useState<number | "">("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (openingCash === "" || isNaN(Number(openingCash)) || Number(openingCash) < 0) return;

    onSubmit({
      shiftName,
      openingCash: Number(openingCash),
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <Clock className="size-4 text-primary" />
            <span>Buka shift kasir</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Masukkan saldo awal uang tunai di laci kas untuk memulai shift operasional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <Label htmlFor="open-shift-name" className="text-xs font-medium text-foreground">
              Pilih shift operasional <span className="text-destructive">*</span>
            </Label>
            <NativeSelect
              id="open-shift-name"
              value={shiftName}
              onChange={(e) => setShiftName(e.target.value)}
              className="w-full text-xs font-medium"
            >
              {SHIFT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="open-shift-cash" className="text-xs font-medium text-foreground">
              Kas awal di laci (Rp) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="open-shift-cash"
              type="number"
              min={0}
              step={10000}
              required
              value={openingCash === "" ? "" : openingCash}
              onChange={(e) => {
                const val = e.target.value;
                setOpeningCash(val === "" ? "" : Number(val));
              }}
              placeholder="Wajib diisi, misalnya 200000"
              className="text-xs font-mono font-medium"
            />
            {openingCash !== "" && (
              <p className="font-mono text-xs text-muted-foreground">
                Terbaca: {formatCurrencyIDR(Number(openingCash))}
              </p>
            )}
          </div>

          <DialogFooter className="border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onClose}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={
                openingCash === "" ||
                isNaN(Number(openingCash)) ||
                Number(openingCash) < 0
              }
            >
              Mulai shift
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
