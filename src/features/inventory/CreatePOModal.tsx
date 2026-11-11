import { useEffect, useState } from "react";
import { Plus, Truck } from "lucide-react";

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
import { formatCurrencyIDR } from "@/lib/utils";
import type { IngredientItem } from "@/types/inventory";

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: IngredientItem[];
  initialItem?: IngredientItem | null;
  onCreatePO: (supplier: string, itemId: string, quantity: number, notes: string) => void;
}

export function CreatePOModal({
  isOpen,
  onClose,
  ingredients,
  initialItem,
  onCreatePO,
}: CreatePOModalProps) {
  const [itemId, setItemId] = useState(initialItem?.id || ingredients[0]?.id || "");
  const [supplier, setSupplier] = useState(
    initialItem?.supplier || ingredients[0]?.supplier || "Bali Dairy Fresh"
  );
  const [quantity, setQuantity] = useState<number>(20);
  const [notes, setNotes] = useState("Kebutuhan stok operasional mingguan.");

  useEffect(() => {
    if (initialItem) {
      setItemId(initialItem.id);
      setSupplier(initialItem.supplier);
      const suggested = Math.max(initialItem.min, initialItem.min * 2 - initialItem.stockNumber);
      setQuantity(suggested);
    } else if (ingredients[0]?.id && !itemId) {
      setItemId(ingredients[0].id);
      setSupplier(ingredients[0].supplier);
    }
  }, [initialItem, ingredients, itemId]);

  const selectedItem = ingredients.find((i) => i.id === itemId);
  const unitPrice = selectedItem?.costPerUnit || 0;
  const subtotal = unitPrice * quantity;
  const tax = Math.round(subtotal * 0.11);
  const total = subtotal + tax;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || quantity <= 0) return;
    onCreatePO(supplier, itemId, quantity, notes);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Truck className="size-4 text-primary" />
            <DialogTitle className="text-base font-medium">Buat PO</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Terbitkan surat pesanan resmi pengadaan bahan baku ke supplier rekanan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Pemasok</label>
            <Input
              required
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Bahan</label>
              <NativeSelect
                value={itemId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setItemId(newId);
                  const matched = ingredients.find((i) => i.id === newId);
                  if (matched?.supplier) setSupplier(matched.supplier);
                }}
                className="w-full text-xs"
              >
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({ing.unit})
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Jumlah Pesan ({selectedItem?.unit || "Unit"})
              </label>
              <Input
                type="number"
                min={1}
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="text-xs font-mono font-medium"
              />
            </div>
          </div>

          {/* Cost Summary Box */}
          <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
            <div className="flex justify-between text-muted-foreground">
              <span>Harga satuan</span>
              <span className="font-mono tabular-nums text-foreground">
                {formatCurrencyIDR(unitPrice)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums text-foreground">
                {formatCurrencyIDR(subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>PPN 11%</span>
              <span className="font-mono tabular-nums text-foreground">
                +{formatCurrencyIDR(tax)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-1 font-medium text-foreground">
              <span>Perkiraan total</span>
              <span className="font-mono text-primary tabular-nums">
                {formatCurrencyIDR(total)}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Catatan</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="border-t pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
              Batal
            </Button>
            <Button type="submit" size="sm" className="text-xs">
              Terbitkan PO
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
