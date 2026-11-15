"use client";

import { Check, Coffee, Minus, Plus } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

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
import { FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn, formatCurrencyIDR } from "@/lib/utils";

import { calculateItemFinalPrice } from "./pos-catalog";
import type { POSCartItem, POSModifierOption, POSProductItem, POSVariantOption } from "./types";

interface ModifierModalProps {
  product: POSProductItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: POSCartItem) => void;
}

/** Customization modal for variants, recipe modifiers, and notes. */
export function ModifierModal({ product, isOpen, onClose, onAddToCart }: ModifierModalProps) {
  const [selectedVariant, setSelectedVariant] = useState<POSVariantOption | undefined>(undefined);
  const [selectedModifiers, setSelectedModifiers] = useState<POSModifierOption[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (product) {
      setQuantity(1);
      setNotes("");
      if (product.variants && product.variants.length > 0) {
        setSelectedVariant(product.variants[0]);
      } else {
        setSelectedVariant(undefined);
      }

      const defaults: POSModifierOption[] = [];
      product.modifierGroups?.forEach((group) => {
        if (group.isRequired && group.options.length > 0) {
          defaults.push(group.options[0]);
        }
      });
      setSelectedModifiers(defaults);
    }
  }, [product]);

  const variantAdjustment = Number(selectedVariant?.priceAdjustment) || 0;
  const modifiersTotal = selectedModifiers.reduce(
    (sum, mod) => sum + (Number(mod.price) || Number((mod as any).priceAdjustment) || 0),
    0
  );

  const { unitFinalPrice, itemGrandTotal } = useMemo(() => {
    if (!product) return { unitFinalPrice: 0, itemGrandTotal: 0 };
    return calculateItemFinalPrice(product.basePrice, variantAdjustment, modifiersTotal, quantity);
  }, [product, variantAdjustment, modifiersTotal, quantity]);

  if (!product) return null;

  const handleToggleModifier = (groupMax: number, isGroupReq: boolean, opt: POSModifierOption) => {
    const isAlreadySelected = selectedModifiers.some((m) => m.name === opt.name);

    if (groupMax === 1) {
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {/* Header */}
        <DialogHeader className="shrink-0 border-b border-border bg-muted/20 p-4">
          <div className="flex items-center gap-2.5 pr-8">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Coffee className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-medium text-foreground">
                {product.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Kustomisasi varian dan tambahan resep
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs text-foreground">
          {/* Base price & description */}
          <div className="flex items-baseline justify-between border-b border-border pb-3">
            <span className="text-xs text-muted-foreground">
              {product.category}
            </span>
            <span className="font-mono text-base font-medium tabular-nums text-foreground">
              {formatCurrencyIDR(product.basePrice)}
            </span>
          </div>
          {product.description && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          )}

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FieldLabel>Pilih ukuran atau varian</FieldLabel>
                <StatusBadge status="neutral">Wajib 1 pilihan</StatusBadge>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {product.variants.map((v, i) => {
                  const isSelected = selectedVariant?.name === v.name;
                  return (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedVariant(v)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-2.5 text-left transition-colors touch-manipulation",
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary text-foreground"
                          : "border-border bg-card hover:bg-accent/40 text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background"
                          )}
                        >
                          {isSelected && (
                            <div className="size-1.5 shrink-0 rounded-full bg-primary-foreground" />
                          )}
                        </div>
                        <span className="text-xs font-medium">{v.name}</span>
                      </div>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {v.priceAdjustment > 0 ? `+${formatCurrencyIDR(v.priceAdjustment)}` : "Termasuk"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Modifier Groups */}
          {product.modifierGroups?.map((group) => (
            <div key={group.id} className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <FieldLabel>{group.name}</FieldLabel>
                <StatusBadge status={group.isRequired ? "info" : "neutral"}>
                  {group.isRequired ? "Wajib" : "Opsional"}
                </StatusBadge>
              </div>

              <div
                role={group.maxSelect === 1 ? "radiogroup" : "group"}
                aria-label={group.name}
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                {group.options.map((opt, optIdx) => {
                  const isChecked = selectedModifiers.some((m) => m.name === opt.name);
                  const price = Number(opt.price) || Number((opt as any).priceAdjustment) || 0;

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      role={group.maxSelect === 1 ? "radio" : "checkbox"}
                      aria-checked={isChecked}
                      onClick={() =>
                        handleToggleModifier(group.maxSelect, group.isRequired, opt)
                      }
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-2.5 text-left transition-colors touch-manipulation",
                        isChecked
                          ? "border-primary bg-primary/5 ring-1 ring-primary text-foreground"
                          : "border-border bg-card hover:bg-accent/40 text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center border transition-colors",
                            group.maxSelect === 1 ? "rounded-full" : "rounded",
                            isChecked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background"
                          )}
                        >
                          {isChecked && (
                            group.maxSelect === 1 ? (
                              <div className="size-1.5 shrink-0 rounded-full bg-primary-foreground" />
                            ) : (
                              <Check className="size-3" />
                            )
                          )}
                        </div>
                        <span className="text-xs font-medium">{opt.name}</span>
                      </div>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {price > 0 ? `+${formatCurrencyIDR(price)}` : "Gratis"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Notes */}
          <div className="space-y-1.5 border-t border-border pt-3">
            <FieldLabel>Catatan khusus barista / dapur</FieldLabel>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Pisahkan es batu, sambal dipisah"
            />
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-border bg-muted/20 p-4 shrink-0 sm:space-x-0">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              disabled={quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Kurangi jumlah"
            >
              <Minus />
            </Button>
            <span className="w-6 text-center font-mono text-sm font-medium tabular-nums text-foreground">
              {quantity}
            </span>
            <Button
              type="button"
              variant="default"
              size="icon-lg"
              onClick={() => setQuantity((q) => q + 1)}
              aria-label="Tambah jumlah"
            >
              <Plus />
            </Button>
          </div>

          <Button
            type="button"
            size="lg"
            onClick={handleConfirmAdd}
            className="flex-1"
          >
            <span>Tambahkan ke keranjang</span>
            <span className="font-mono tabular-nums opacity-90">
              ({formatCurrencyIDR(itemGrandTotal)})
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
