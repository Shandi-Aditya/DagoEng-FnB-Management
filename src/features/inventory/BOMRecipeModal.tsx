"use client";

import React, { useState } from "react";
import { formatCurrencyIDR } from "@/lib/utils";
import { RecipeBOM, IngredientItem } from "@/types/inventory";
import { MasterProduct } from "@/types/product";
import {
  X,
  Sparkles,
  Plus,
  Trash2,
  Utensils,
  Calculator,
  CheckCircle2,
  Info,
  DollarSign,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface BOMRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: MasterProduct[];
  ingredients: IngredientItem[];
  onSaveRecipe: (recipe: RecipeBOM) => void;
  initialRecipe?: RecipeBOM | null;
}

interface IngredientLine {
  ingredientId: string;
  ingredientName: string;
  quantityRequired: number;
  unit: string;
  costEstimate: number;
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
    initialRecipe?.menuId || products[0]?.id || "prod-101"
  );
  const [sellingPrice, setSellingPrice] = useState<number>(
    initialRecipe?.sellingPrice || 25000
  );
  const [recipeLines, setRecipeLines] = useState<IngredientLine[]>(
    initialRecipe?.ingredients || [
      {
        ingredientId: ingredients[0]?.id || "ing-1",
        ingredientName: ingredients[0]?.name || "Biji Kopi Arabica Blend",
        quantityRequired: 18,
        unit: "gram",
        costEstimate: 4500,
      },
    ]
  );
  const [isAIGenerating, setIsAIGenerating] = useState<boolean>(false);
  const [aiNotice, setAiNotice] = useState<string>("");

  if (!isOpen) return null;

  const currentProduct = products.find((p) => p.id === selectedProductId) || products[0];

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
        costEstimate: Math.round(defaultIng.costPerUnit * 0.1),
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
      const quantityRequired = next[index].quantityRequired || 10;
      next[index] = {
        ingredientId: targetIng.id,
        ingredientName: targetIng.name,
        quantityRequired,
        unit: targetIng.unit,
        costEstimate: Math.round(targetIng.costPerUnit * (quantityRequired / 100)),
      };
      return next;
    });
  };

  const handleAmountChange = (index: number, quantityRequired: number) => {
    setRecipeLines((prev) => {
      const next = [...prev];
      const targetIng = ingredients.find((i) => i.id === next[index].ingredientId);
      const unitCost = targetIng ? targetIng.costPerUnit : 100;
      next[index] = {
        ...next[index],
        quantityRequired,
        costEstimate: Math.max(100, Math.round(unitCost * (quantityRequired / 50))),
      };
      return next;
    });
  };

  // AI Recipe Auto Generator
  const handleAIGenerate = () => {
    setIsAIGenerating(true);
    setAiNotice("Sedang menganalisis nama menu, kategori F&B, dan rasio bahan baku optimal...");

    setTimeout(() => {
      const prodName = currentProduct?.name?.toLowerCase() || "";
      let generated: IngredientLine[] = [];

      if (prodName.includes("kopi") || prodName.includes("coffee") || prodName.includes("espresso")) {
        generated = [
          { ingredientId: "ing-1", ingredientName: "Biji Kopi Arabica Blend", quantityRequired: 18, unit: "gram", costEstimate: 4500 },
          { ingredientId: "ing-2", ingredientName: "Fresh Milk UHT Barista", quantityRequired: 150, unit: "ml", costEstimate: 3600 },
          { ingredientId: "ing-3", ingredientName: "Gula Aren Organik Cair", quantityRequired: 20, unit: "ml", costEstimate: 1200 },
        ];
      } else if (prodName.includes("tea") || prodName.includes("teh") || prodName.includes("peach")) {
        generated = [
          { ingredientId: "ing-4", ingredientName: "Daun Teh Artisan Peach", quantityRequired: 10, unit: "gram", costEstimate: 3500 },
          { ingredientId: "ing-5", ingredientName: "Simple Syrup Premium", quantityRequired: 25, unit: "ml", costEstimate: 800 },
        ];
      } else if (prodName.includes("beef") || prodName.includes("wagyu") || prodName.includes("bowl")) {
        generated = [
          { ingredientId: "ing-6", ingredientName: "Daging Sapi Wagyu Slice", quantityRequired: 100, unit: "gram", costEstimate: 24000 },
          { ingredientId: "ing-7", ingredientName: "Beras Organik Bali", quantityRequired: 150, unit: "gram", costEstimate: 3000 },
          { ingredientId: "ing-8", ingredientName: "Saus Teriyaki House Blend", quantityRequired: 30, unit: "ml", costEstimate: 2500 },
        ];
      } else {
        generated = [
          { ingredientId: ingredients[0]?.id || "ing-1", ingredientName: ingredients[0]?.name || "Bahan Baku Utama", quantityRequired: 50, unit: ingredients[0]?.unit || "gram", costEstimate: 5000 },
          { ingredientId: ingredients[1]?.id || "ing-2", ingredientName: ingredients[1]?.name || "Bahan Pelengkap", quantityRequired: 20, unit: ingredients[1]?.unit || "ml", costEstimate: 2000 },
        ];
      }

      setRecipeLines(generated);
      setIsAIGenerating(false);
      setAiNotice(`✨ AI Berhasil menyusun ${generated.length} takaran bahan baku presisi untuk "${currentProduct?.name}"!`);
      setTimeout(() => setAiNotice(""), 5000);
    }, 600);
  };

  const totalCOGS = recipeLines.reduce((sum, line) => sum + (line.costEstimate || 0), 0);
  const grossProfit = Math.max(0, sellingPrice - totalCOGS);
  const grossMarginPercent = sellingPrice > 0 ? ((grossProfit / sellingPrice) * 100).toFixed(1) : "0";

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct || recipeLines.length === 0) return;

    const newRecipe: RecipeBOM = {
      menuId: currentProduct.id,
      menuName: currentProduct.name,
      category: currentProduct.category,
      sellingPrice,
      totalCOGS,
      grossMarginPercent: Number(grossMarginPercent),
      ingredients: recipeLines,
    };

    onSaveRecipe(newRecipe);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Formulasi Resep BOM & Kalkulasi COGS</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Hubungkan menu katalog dengan bahan baku gudang untuk auto-deduction
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* AI Banner / Notice */}
          {aiNotice && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 font-bold flex items-center space-x-2 animate-in fade-in">
              <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
              <span>{aiNotice}</span>
            </div>
          )}

          {/* Menu Selection & Selling Price */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Pilih Menu Produk:</label>
              <select
                value={selectedProductId}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 outline-none"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Harga Jual Menu (Rp):</label>
              <input
                type="number"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-900 outline-none"
                placeholder="25000"
                required
              />
            </div>
          </div>

          {/* AI Assistant Button */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-orange-50 rounded-xl border border-purple-200">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <div>
                <span className="font-bold text-slate-900 block">AI Smart Recipe Assistant</span>
                <span className="text-[10px] text-slate-500">
                  Generate formula takaran bahan baku & estimasi HPP otomatis berdasarkan nama menu
                </span>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={isAIGenerating}
              onClick={handleAIGenerate}
              className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold space-x-1.5 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAIGenerating ? "Memproses..." : "✨ AI Generate"}</span>
            </Button>
          </div>

          {/* Ingredient Lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-brand-orange" />
                <span>Komposisi Bahan Baku (BOM Ingredients):</span>
              </label>
              <button
                type="button"
                onClick={handleAddLine}
                className="text-xs text-brand-orange hover:underline font-bold flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Bahan</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {recipeLines.map((line, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center space-x-2"
                >
                  <div className="flex-1">
                    <select
                      value={line.ingredientId}
                      onChange={(e) => handleIngredientChange(idx, e.target.value)}
                      className="w-full p-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                    >
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({ing.unit}) — Rp {ing.costPerUnit.toLocaleString()}/{ing.unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <input
                      type="number"
                      value={line.quantityRequired}
                      onChange={(e) => handleAmountChange(idx, Number(e.target.value))}
                      placeholder="Takaran"
                      className="w-full p-1.5 text-xs text-center border border-slate-200 rounded-lg font-mono font-bold"
                    />
                  </div>

                  <div className="w-24 text-right">
                    <span className="font-mono font-bold text-slate-800 text-xs block">
                      {formatCurrencyIDR(line.costEstimate)}
                    </span>
                    <span className="text-[10px] text-slate-400">Est. HPP</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                    title="Hapus baris"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* COGS & Margin Summary */}
          <div className="p-3.5 bg-slate-900 text-white rounded-xl grid grid-cols-3 gap-3 text-center">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Total HPP / COGS</span>
              <span className="text-sm font-black font-mono text-amber-400">
                {formatCurrencyIDR(totalCOGS)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Laba Kotor (Gross Profit)</span>
              <span className="text-sm font-black font-mono text-emerald-400">
                {formatCurrencyIDR(grossProfit)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Gross Margin</span>
              <span className="text-sm font-black font-mono text-brand-orange">
                {grossMarginPercent}%
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs font-semibold">
              Batal
            </Button>
            <Button
              type="submit"
              className="flex-1 text-xs font-bold bg-brand-orange hover:bg-orange-600 text-white shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              <span>Simpan Formula Resep BOM</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
