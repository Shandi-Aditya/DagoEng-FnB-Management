import { AlertTriangle, Plus } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { IngredientItem } from "@/types/inventory";

import { stockStatusLabel, stockStatusTone } from "./inventory-domain";

interface RestockAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  criticalItems: IngredientItem[];
  onTriggerPO: (item: IngredientItem) => void;
}

export function RestockAlertModal({
  isOpen,
  onClose,
  criticalItems,
  onTriggerPO,
}: RestockAlertModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <DialogTitle className="text-base font-medium">
              Rekomendasi Restock Bahan Baku Kritis
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Daftar bahan yang telah habis atau berada di bawah batas minimum operasional.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-2.5 overflow-y-auto pr-1">
          {criticalItems.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Semua bahan baku saat ini berada dalam kondisi stok aman.
            </p>
          ) : (
            criticalItems.map((item) => {
              const suggestedRestock = Math.max(item.min, item.min * 2 - item.stockNumber);

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{item.name}</span>
                      <StatusBadge status={stockStatusTone(item.status)}>
                        {stockStatusLabel(item.status)}
                      </StatusBadge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Sisa:{" "}
                      <strong className="font-mono text-destructive">
                        {item.stockNumber} {item.unit}
                      </strong>{" "}
                      • Min: {item.min} {item.unit} • Supplier: {item.supplier}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Saran Pesan:{" "}
                      <strong className="font-mono text-foreground">
                        {suggestedRestock} {item.unit}
                      </strong>
                    </p>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => {
                      onClose();
                      onTriggerPO(item);
                    }}
                    className="h-8 gap-1 text-xs shrink-0"
                  >
                    <Plus className="size-3.5" />
                    <span>Buat PO</span>
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          <Button size="sm" variant="outline" onClick={onClose} className="text-xs">
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
