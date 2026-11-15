"use client";

import React, { useState, useEffect } from "react";
import { formatCurrencyIDR } from "@/lib/utils";
import type { RecipeBOM, IngredientItem } from "@/types/inventory";
import type { MasterProduct } from "@/types/product";
import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/app/status-badge";
import { ProFeatureBadge } from "@/components/premium";
import {
  calculateRecipeCOGS,
  calculateGrossProfit,
  calculateGrossMargin,
  getMarginStatusTone,
  calculateLineCostEstimate,
  generateSuggestedIngredients,
  type RecipeIngredientLine,
} from "./bom-recipe-domain";

interface BOMRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: MasterProduct[];
  ingredients: IngredientItem[];
  onSaveRecipe: (recipe: RecipeBOM) => void;
  initialRecipe?: RecipeBOM | null;
}

export function BOMRecipeModal({
  isOpen,
  onClose,
  products,
  ingredients,
  onSaveRecipe,
  initialRecipe,
}: BOMRecipeModalProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialRecipe?.menuId || products[0]?.id || ""
  );
  const [sellingPrice, setSellingPrice] = useState<number>(
    initialRecipe?.sellingPrice || 25000
  );
  const [recipeLines, setRecipeLines] = useState<RecipeIngredientLine[]>(
    initialRecipe?.ingredients || []
  );

  useEffect(() => {
    if (initialRecipe) {
      setSelectedProductId(initialRecipe.menuId);
      setSellingPrice(initialRecipe.sellingPrice);
      setRecipeLines(initialRecipe.ingredients);
    } else if (products.length > 0) {
      setSelectedProductId(products[0].id);
      setSellingPrice(products[0].basePrice || 25000);
      if (ingredients.length > 0) {
        setRecipeLines([
          {
            ingredientId: ingredients[0].id,
            ingredientName: ingredients[0].name,
            quantityRequired: 18,
            unit: ingredients[0].unit,
            costEstimate: calculateLineCostEstimate(ingredients[0], 18),
          },
        ]);
      } else {
        setRecipeLines([]);
      }
    }
  }, [initialRecipe, products, ingredients, isOpen]);

  const currentProduct =
    products.find((p) => p.id === selectedProductId) || products[0];

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setSellingPrice(prod.basePrice);
    }
  };

  const handleAddLine = () => {
    const defaultIng = ingredients[0];
    if (!defaultIng) return;
    setRecipeLines((prev) => [
      ...prev,
      {
        ingredientId: defaultIng.id,
        ingredientName: defaultIng.name,
        quantityRequired: 10,
        unit: defaultIng.unit,
        costEstimate: calculateLineCostEstimate(defaultIng, 10),
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    setRecipeLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (index: number, ingId: string) => {
    const targetIng = ingredients.find((i) => i.id === ingId);
    if (!targetIng) return;
    setRecipeLines((prev) => {
      const next = [...prev];
      const quantityRequired = next[index]?.quantityRequired || 10;
      next[index] = {
        ingredientId: targetIng.id,
        ingredientName: targetIng.name,
        quantityRequired,
        unit: targetIng.unit,
        costEstimate: calculateLineCostEstimate(targetIng, quantityRequired),
      };
      return next;
    });
  };

  const handleAmountChange = (index: number, quantityRequired: number) => {
    setRecipeLines((prev) => {
      const next = [...prev];
      const targetIng = ingredients.find(
        (i) => i.id === next[index]?.ingredientId
      );
      next[index] = {
        ...next[index],
        quantityRequired,
        costEstimate: calculateLineCostEstimate(targetIng, quantityRequired),
      };
      return next;
    });
  };

  const handleApplySuggestions = () => {
    if (!currentProduct) return;
    const suggested = generateSuggestedIngredients(
      currentProduct.name,
      ingredients
    );
    if (suggested.length > 0) {
      setRecipeLines(suggested);
    }
  };

  const totalCOGS = calculateRecipeCOGS(recipeLines);
  const grossProfit = calculateGrossProfit(sellingPrice, totalCOGS);
  const grossMarginPercent = calculateGrossMargin(sellingPrice, totalCOGS);
  const marginTone = getMarginStatusTone(grossMarginPercent);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct || recipeLines.length === 0) return;

    const newRecipe: RecipeBOM = {
      menuId: currentProduct.id,
      menuName: currentProduct.name,
      category: currentProduct.category,
      sellingPrice,
      totalCOGS,
      grossMarginPercent,
      ingredients: recipeLines,
    };

    onSaveRecipe(newRecipe);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base font-semibold">
              Resep Menu
            </DialogTitle>
            <ProFeatureBadge label="ADD-ON" variant="addon" size="xs" />
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Tentukan takaran bahan baku gudang untuk menghitung HPP otomatis saat penjualan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* Menu Selection & Selling Price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-muted/40 rounded-lg border">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Pilih menu
                </Label>
                <NativeSelect
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                >
                  {products.map((p) => (
                    <NativeSelectOption key={p.id} value={p.id}>
                      {p.name} ({p.category})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Harga jual (Rp)
                </Label>
                <Input
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(Number(e.target.value))}
                  placeholder="25000"
                  required
                  min={0}
                  className="font-mono tabular-nums"
                />
              </div>
            </div>

            {/* Smart Recipe Suggestion */}
            <div className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg border">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">
                  Saran komposisi bahan
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  Isi otomatis takaran awal dari bahan baku yang tersedia di gudang.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleApplySuggestions}
                className="shrink-0 gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Saran resep</span>
              </Button>
            </div>

            {/* Ingredient Lines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-foreground">
                  Komposisi bahan baku ({recipeLines.length})
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddLine}
                  className="gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah bahan</span>
                </Button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {recipeLines.map((line, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-background rounded-lg border flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <NativeSelect
                        value={line.ingredientId}
                        onChange={(e) =>
                          handleIngredientChange(idx, e.target.value)
                        }
                      >
                        {ingredients.map((ing) => (
                          <NativeSelectOption key={ing.id} value={ing.id}>
                            {ing.name} ({ing.unit}) — Rp{" "}
                            {ing.costPerUnit.toLocaleString()}/{ing.unit}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-24">
                        <Input
                          type="number"
                          value={line.quantityRequired}
                          onChange={(e) =>
                            handleAmountChange(idx, Number(e.target.value))
                          }
                          placeholder="Takaran"
                          min={0}
                          className="text-center font-mono tabular-nums text-xs"
                        />
                      </div>

                      <div className="w-28 text-right pr-1">
                        <span className="font-mono text-xs tabular-nums font-medium text-foreground block">
                          {formatCurrencyIDR(line.costEstimate)}
                        </span>
                        <span className="text-xs text-muted-foreground block">
                          Est. HPP
                        </span>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveLine(idx)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        title="Hapus baris bahan"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* COGS & Margin Summary */}
            <div className="p-3.5 bg-muted/40 rounded-lg border grid grid-cols-3 gap-3 text-center">
              <div>
                <span className="text-xs text-muted-foreground block">
                  Total HPP
                </span>
                <span className="text-sm font-semibold font-mono tabular-nums text-foreground">
                  {formatCurrencyIDR(totalCOGS)}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">
                  Laba kotor
                </span>
                <span className="text-sm font-semibold font-mono tabular-nums text-foreground">
                  {formatCurrencyIDR(grossProfit)}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-0.5">
                  Margin
                </span>
                <StatusBadge status={marginTone}>
                  {grossMarginPercent}%
                </StatusBadge>
              </div>
            </div>
          </div>

          {/* Footer Actions with size="lg" */}
          <DialogFooter className="p-4 border-t bg-muted/20 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onClose}
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="lg"
              className="w-full sm:w-auto gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Simpan resep</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
