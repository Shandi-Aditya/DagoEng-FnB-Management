import { useEffect, useState } from "react";
import { Scale } from "lucide-react";

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
import type { IngredientItem, StockOpnameReason } from "@/types/inventory";

import { OPNAME_REASONS, opnameReasonLabel } from "./inventory-domain";

interface StockOpnameModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: IngredientItem[];
  initialItemId?: string;
  auditedIds: string[];
  onSaveOpname: (data: {
    ingredientId: string;
    physicalStock: number;
    reason: StockOpnameReason;
    notes?: string;
    auditor: string;
  }) => void;
}

export function StockOpnameModal({
  isOpen,
  onClose,
  ingredients,
  initialItemId,
  auditedIds,
  onSaveOpname,
}: StockOpnameModalProps) {
  const [itemId, setItemId] = useState(initialItemId || ingredients[0]?.id || "");
  const [physicalStock, setPhysicalStock] = useState<number>(0);
  const [reason, setReason] = useState<StockOpnameReason>("RECORDING_ERROR");
  const [notes, setNotes] = useState("");
  const [auditor, setAuditor] = useState("Staff Auditor Gudang");
  const [errorMsg, setErrorMsg] = useState("");

  const targetItem = ingredients.find((i) => i.id === itemId);
  const systemStock = targetItem?.stockNumber || 0;
  const variance = physicalStock - systemStock;

  useEffect(() => {
    if (initialItemId) {
      setItemId(initialItemId);
      const target = ingredients.find((i) => i.id === initialItemId);
      if (target) setPhysicalStock(target.stockNumber);
    } else if (ingredients[0]?.id && !itemId) {
      setItemId(ingredients[0].id);
      setPhysicalStock(ingredients[0].stockNumber);
    }
  }, [initialItemId, ingredients, itemId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetItem) return;

    if (auditedIds.includes(targetItem.id)) {
      setErrorMsg(`Bahan "${targetItem.name}" sudah diaudit pada sesi ini.`);
      return;
    }

    if (variance !== 0 && !notes.trim()) {
      setErrorMsg("Catatan alasan wajib diisi jika terdapat selisih antara stok fisik dan sistem.");
      return;
    }

    onSaveOpname({
      ingredientId: targetItem.id,
      physicalStock: Number(physicalStock),
      reason,
      notes: notes.trim() || undefined,
      auditor: auditor.trim() || "Staff Auditor Gudang",
    });

    setErrorMsg("");
    setNotes("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Scale className="size-4 text-primary" />
            <DialogTitle className="text-base font-medium">Catat opname</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Sinkronkan stok fisik hasil hitungan riil di gudang dengan catatan sistem.
          </DialogDescription>
        </DialogHeader>

        {errorMsg ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
            {errorMsg}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Bahan</label>
            <NativeSelect
              value={itemId}
              onChange={(e) => {
                const newId = e.target.value;
                setItemId(newId);
                const match = ingredients.find((i) => i.id === newId);
                if (match) setPhysicalStock(match.stockNumber);
              }}
              className="w-full text-xs"
            >
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({ing.category})
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Stok Sistem Saat Ini
              </label>
              <Input
                readOnly
                disabled
                value={`${systemStock} ${targetItem?.unit || "Unit"}`}
                className="text-xs font-mono font-medium bg-muted"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Hasil Hitung Fisik ({targetItem?.unit || "Unit"})
              </label>
              <Input
                type="number"
                min={0}
                step={0.1}
                required
                value={physicalStock}
                onChange={(e) => {
                  setPhysicalStock(Number(e.target.value));
                  setErrorMsg("");
                }}
                className="text-xs font-mono font-medium"
              />
            </div>
          </div>

          {/* Variance Indicator */}
          <div
            className={`rounded-lg border p-2.5 text-xs ${
              variance === 0
                ? "border-muted bg-muted/20 text-muted-foreground"
                : variance > 0
                  ? "border-success/30 bg-success/10 text-success font-medium"
                  : "border-destructive/30 bg-destructive/10 text-destructive font-medium"
            }`}
          >
            <div className="flex justify-between items-center">
              <span>Selisih</span>
              <span className="font-mono tabular-nums text-sm">
                {variance > 0 ? `+${variance}` : variance} {targetItem?.unit}
              </span>
            </div>
            <p className="mt-0.5 text-xs opacity-80">
              {variance === 0
                ? "Stok fisik cocok dengan sistem."
                : variance > 0
                  ? "Fisik lebih banyak dari catatan sistem."
                  : "Fisik lebih sedikit dari catatan sistem."}
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Alasan selisih</label>
            <NativeSelect
              value={reason}
              onChange={(e) => setReason(e.target.value as StockOpnameReason)}
              className="w-full text-xs"
            >
              {OPNAME_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {opnameReasonLabel(reason)}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">
              Catatan / Bukti Alasan {variance !== 0 ? <span className="text-destructive">*</span> : ""}
            </label>
            <Input
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setErrorMsg("");
              }}
              placeholder="Wajib diisi kalau ada selisih"
              className="text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Petugas</label>
            <Input
              required
              value={auditor}
              onChange={(e) => setAuditor(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="border-t pt-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit">
              Simpan & Selaraskan Stok
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
