import { useState } from "react";
import { RefreshCw, Utensils } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { IngredientItem, RecipeBOM } from "@/types/inventory";

interface BOMSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: RecipeBOM[];
  ingredients: IngredientItem[];
  onSimulate: (menuId: string, qty: number) => void;
}

export function BOMSimulatorModal({
  isOpen,
  onClose,
  recipes,
  ingredients,
  onSimulate,
}: BOMSimulatorModalProps) {
  const [menuId, setMenuId] = useState(recipes[0]?.menuId || "m-1");
  const [qty, setQty] = useState<number>(5);

  const selectedRecipe = recipes.find((r) => r.menuId === menuId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuId || qty <= 0) return;
    onSimulate(menuId, qty);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="size-4 text-primary" />
            <DialogTitle className="text-base font-medium">
              Simulasi Pengurangan Stok BOM
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Uji coba simulasi pemotongan bahan baku formula resep seperti saat transaksi kasir.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Pilih Menu</label>
            <NativeSelect
              value={menuId}
              onChange={(e) => setMenuId(e.target.value)}
              className="w-full text-xs"
            >
              {recipes.map((r) => (
                <option key={r.menuId} value={r.menuId}>
                  {r.menuName} ({r.ingredients.length} Bahan Baku)
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Jumlah Porsi Pesanan</label>
            <Input
              type="number"
              min={1}
              max={100}
              required
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="text-xs font-mono font-medium"
            />
          </div>

          {selectedRecipe ? (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <span className="block text-[11px] font-medium text-foreground">
                Estimasi Bahan Yang Akan Dipotong ({qty} Porsi):
              </span>
              <div className="space-y-1">
                {selectedRecipe.ingredients.map((ing, idx) => {
                  const currentStock =
                    ingredients.find((i) => i.id === ing.ingredientId)?.stockNumber || 0;
                  const needed = ing.quantityRequired * qty;
                  const isShortage = currentStock < needed;

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-[11px] text-muted-foreground"
                    >
                      <span>
                        {ing.ingredientName} ({needed} {ing.unit})
                      </span>
                      <span
                        className={`font-mono tabular-nums ${
                          isShortage ? "text-destructive font-medium" : "text-foreground"
                        }`}
                      >
                        Sisa: {currentStock} {ing.unit} {isShortage ? "(Kurang!)" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <DialogFooter className="border-t pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
              Batal
            </Button>
            <Button type="submit" size="sm" className="text-xs">
              Jalankan Simulasi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
