import { useEffect, useState } from "react";

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
import type { IngredientItem, StockAdjustmentLog } from "@/types/inventory";

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: IngredientItem[];
  selectedItem: IngredientItem | null;
  onAdjust: (itemId: string, delta: number, reason: StockAdjustmentLog["reason"]) => void;
}

export function StockAdjustmentModal({
  isOpen,
  onClose,
  ingredients,
  selectedItem,
  onAdjust,
}: StockAdjustmentModalProps) {
  const [itemId, setItemId] = useState(selectedItem?.id || ingredients[0]?.id || "");
  const [type, setType] = useState<"ADD" | "SUBTRACT">("ADD");
  const [amount, setAmount] = useState<number>(5);
  const [reason, setReason] = useState<StockAdjustmentLog["reason"]>("PO_MASUK");

  useEffect(() => {
    if (selectedItem?.id) {
      setItemId(selectedItem.id);
    } else if (ingredients[0]?.id && !itemId) {
      setItemId(ingredients[0].id);
    }
  }, [selectedItem, ingredients, itemId]);

  const currentTarget = ingredients.find((i) => i.id === itemId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || amount <= 0) return;
    const delta = type === "ADD" ? amount : -amount;
    onAdjust(itemId, delta, reason);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Sesuaikan stok</DialogTitle>
          <DialogDescription className="text-xs">
            Catat penambahan atau pengurangan stok bahan baku di luar alur PO otomatis.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Bahan</label>
            <NativeSelect
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="w-full text-xs"
            >
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} (Sisa: {ing.stockNumber} {ing.unit})
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Jenis</label>
              <NativeSelect
                value={type}
                onChange={(e) => setType(e.target.value as "ADD" | "SUBTRACT")}
                className="w-full text-xs font-medium"
              >
                <option value="ADD">Tambah stok</option>
                <option value="SUBTRACT">Kurangi stok</option>
              </NativeSelect>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Jumlah ({currentTarget?.unit || "Unit"})
              </label>
              <Input
                type="number"
                min={0.1}
                step={0.1}
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="text-xs font-mono font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Alasan</label>
            <NativeSelect
              value={reason}
              onChange={(e) => setReason(e.target.value as StockAdjustmentLog["reason"])}
              className="w-full text-xs"
            >
              <option value="PO_MASUK">Barang masuk dari PO</option>
              <option value="PRODUKSI_BOM">Dipakai produksi dapur</option>
              <option value="WASTE_RUSAK">Limbah atau rusak</option>
              <option value="KADALUWARSA">Kedaluwarsa</option>
              <option value="KOREKSI_OPNAME">Koreksi hasil opname</option>
              <option value="LAINNYA">Lainnya</option>
            </NativeSelect>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" size="lg">
              Simpan Penyesuaian
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
