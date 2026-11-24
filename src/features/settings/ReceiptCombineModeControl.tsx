"use client";

import { Button } from "@/components/ui/button";
import type { OutletReceiptCombineMode } from "@/types/settings";

export interface ReceiptCombineModeControlProps {
  value: OutletReceiptCombineMode;
  onChange: (mode: OutletReceiptCombineMode) => void;
  disabled?: boolean;
  helperText?: string;
}

export function ReceiptCombineModeControl({
  value,
  onChange,
  disabled = false,
  helperText,
}: ReceiptCombineModeControlProps) {
  const defaultHelper =
    value === "COMBINED"
      ? "Kasir mencetak 1 struk berisi bagian Dago Creative Hub (Co-Working) dan mitra F&B."
      : "Kasir mencetak struk co-working (0% PB1) terpisah dari struk pesanan F&B.";

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label="Mode struk co-working dan F&B (gabung / pisah)"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <Button
          type="button"
          size="lg"
          disabled={disabled}
          variant={value === "COMBINED" ? "default" : "outline"}
          aria-pressed={value === "COMBINED"}
          onClick={() => onChange("COMBINED")}
          className="w-full justify-start"
        >
          Gabung (1 struk: Dago & mitra)
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={disabled}
          variant={value === "SEPARATE" ? "default" : "outline"}
          aria-pressed={value === "SEPARATE"}
          onClick={() => onChange("SEPARATE")}
          className="w-full justify-start"
        >
          Pisah (struk co-working & F&B terpisah)
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{helperText ?? defaultHelper}</p>
    </div>
  );
}
