"use client";

import React, { useState, useEffect } from "react";
import { POSProductItem, POSVariantOption, POSModifierOption, POSCartItem } from "./types";
import { formatCurrencyIDR } from "@/lib/utils";
import { X, Plus, Minus, Check, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModifierModalProps {
  product: POSProductItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: POSCartItem) => void;
}

export function ModifierModal({ product, isOpen, onClose, onAddToCart }: ModifierModalProps) {
  const [selectedVariant, setSelectedVariant] = useState<POSVariantOption | undefined>(undefined);
  const [selectedModifiers, setSelectedModifiers] = useState<POSModifierOption[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (product) {
      setQuantity(1);
      setNotes("");
      // Default select first variant if available
      if (product.variants && product.variants.length > 0) {
        setSelectedVariant(product.variants[0]);
      } else {
        setSelectedVariant(undefined);
      }

      // Default select required modifiers
      const defaults: POSModifierOption[] = [];
      product.modifierGroups?.forEach((group) => {
        if (group.isRequired && group.options.length > 0) {
          defaults.push(group.options[0]);
        }
      });
      setSelectedModifiers(defaults);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const variantAdjustment = Number(selectedVariant?.priceAdjustment) || 0;
  const modifiersTotal = selectedModifiers.reduce(
    (sum, mod) => sum + (Number(mod.price) || Number((mod as any).priceAdjustment) || 0),
    0
  );
  const unitFinalPrice = (Number(product.basePrice) || 0) + variantAdjustment + modifiersTotal;
  const itemGrandTotal = unitFinalPrice * (Number(quantity) || 1);

  const handleToggleModifier = (groupMax: number, isGroupReq: boolean, opt: POSModifierOption) => {
    const isAlreadySelected = selectedModifiers.some((m) => m.name === opt.name);

    if (groupMax === 1) {
      // Radio-like behavior
      const otherModifiers = selectedModifiers.filter((m) => {
        const groupOptions = product.modifierGroups?.find((g) => g.options.some((o) => o.name === m.name))?.options || [];
        return !groupOptions.some((o) => o.name === opt.name);
      });

      if (isAlreadySelected && !isGroupReq) {
        setSelectedModifiers(otherModifiers);
      } else {
        setSelectedModifiers([...otherModifiers, opt]);
      }
    } else {
      // Checkbox-like behavior
      if (isAlreadySelected) {
        setSelectedModifiers(selectedModifiers.filter((m) => m.name !== opt.name));
      } else {
        setSelectedModifiers([...selectedModifiers, opt]);
      }
    }
  };

  const handleConfirmAdd = () => {
    const cartItem: POSCartItem = {
      cartItemId: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: product.id,
      productName: product.name,
      quantity,
      basePrice: product.basePrice,
      selectedVariant,
      selectedModifiers,
      notes: notes.trim() || undefined,
      unitFinalPrice,
      itemTotal: itemGrandTotal,
      tenantId: product.tenantId,
    };
    onAddToCart(cartItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Coffee className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{product.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Kustomisasi Varian & Tambahan Resep
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 divide-y divide-slate-100 dark:divide-slate-800">
          {/* Base Product Price & Description */}
          <div className="pb-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {product.category}
              </span>
              <span className="text-base font-bold text-primary font-mono">
                {formatCurrencyIDR(product.basePrice)}
              </span>
            </div>
            {product.description && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{product.description}</p>
            )}
          </div>

          {/* 1. Variants Selection (if any) */}
          {product.variants && product.variants.length > 0 && (
            <div className="pt-4 space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>Pilih Ukuran / Varian:</span>
                <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded font-medium">
                  Wajib 1 Pilihan
                </span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {product.variants.map((v, i) => {
                  const isSelected = selectedVariant?.name === v.name;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 text-slate-900 dark:text-slate-100 ring-1 ring-primary"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span className="text-xs font-semibold">{v.name}</span>
                      <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                        {v.priceAdjustment > 0 ? `+${formatCurrencyIDR(v.priceAdjustment)}` : "Include"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Modifier Groups (Temperature, Sugar, Addons) */}
          {product.modifierGroups?.map((group) => (
            <div key={group.id} className="pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">{group.name}</label>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    group.isRequired
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {group.isRequired ? "Wajib" : "Opsional"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.options.map((opt, optIdx) => {
                  const isChecked = selectedModifiers.some((m) => m.name === opt.name);
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() =>
                        handleToggleModifier(group.maxSelect, group.isRequired, opt)
                      }
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        isChecked
                          ? "border-primary bg-primary/10 text-slate-900 dark:text-slate-100 ring-1 ring-primary"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                            isChecked
                              ? "bg-primary border-primary text-white"
                              : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="text-xs font-medium">{opt.name}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                        {((Number(opt.price) || Number((opt as any).priceAdjustment) || 0) > 0)
                          ? `+${formatCurrencyIDR(Number(opt.price) || Number((opt as any).priceAdjustment) || 0)}`
                          : "Gratis"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* 3. Special Notes for Kitchen */}
          <div className="pt-4 space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Catatan Khusus Barista / Dapur:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Pisahkan es batu, sambal dipisah..."
              className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {/* Footer: Quantity Stepper & Add Button */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button
            type="button"
            onClick={handleConfirmAdd}
            className="flex-1 text-xs font-bold h-10 space-x-2 shadow-md bg-primary hover:bg-primary/90 text-white"
          >
            <span>Tambahkan ke Keranjang</span>
            <span className="font-mono bg-black/15 px-2 py-0.5 rounded">
              {formatCurrencyIDR(itemGrandTotal)}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
