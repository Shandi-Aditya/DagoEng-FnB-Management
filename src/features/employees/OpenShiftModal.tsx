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
  const [openingCash, setOpeningCash] = useState<number>(500000);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (openingCash < 0) return;

    onSubmit({
      shiftName,
      openingCash: Math.max(0, openingCash),
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <span>Buka Shift Kasir Baru</span>
          </DialogTitle>
          <DialogDescription>
            Masukkan saldo awal uang tunai di laci kas (cash drawer) untuk memulai shift operasional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="open-shift-name" className="text-xs">
              Pilih Shift Operasional <span className="text-destructive">*</span>
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
            <Label htmlFor="open-shift-cash" className="text-xs">
              Kas Awal di Laci (Rp) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="open-shift-cash"
              type="number"
              min={0}
              step={10000}
              required
              value={openingCash}
              onChange={(e) => setOpeningCash(Number(e.target.value))}
              className="text-xs font-mono font-medium"
            />
            <p className="text-[11px] text-muted-foreground font-mono">
              Terbaca: {formatCurrencyIDR(openingCash)}
            </p>
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
              Buka Shift Kasir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
