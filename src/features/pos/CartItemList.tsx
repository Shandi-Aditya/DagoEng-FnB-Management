"use client";

import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import type { POSCartItem } from "@/features/pos/types";
import { formatCurrencyIDR } from "@/lib/utils";

interface CartItemListProps {
  items: readonly POSCartItem[];
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onRemove: (cartItemId: string) => void;
}

export function CartItemList({ items, onUpdateQuantity, onRemove }: CartItemListProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart />}
        title="Keranjang kosong"
        description="Pilih menu di katalog untuk menambahkan pesanan."
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y">
      {items.map((item) => {
        const details = [item.selectedVariant?.name, ...item.selectedModifiers.map((modifier) => modifier.name)].filter(Boolean);
        return (
          <li key={item.cartItemId} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">{item.productName}</span>
                {details.length > 0 ? <span className="text-xs text-muted-foreground">{details.join(", ")}</span> : null}
                {item.notes ? <span className="text-xs text-muted-foreground">Catatan: {item.notes}</span> : null}
              </div>
              <span className="shrink-0 font-mono text-sm tabular-nums">{formatCurrencyIDR(item.itemTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon-sm" onClick={() => onRemove(item.cartItemId)} aria-label={`Hapus ${item.productName}`}>
                <Trash2 />
              </Button>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon-sm" onClick={() => onUpdateQuantity(item.cartItemId, -1)} aria-label="Kurangi jumlah">
                  <Minus />
                </Button>
                <span className="w-7 text-center font-mono text-sm tabular-nums" aria-live="polite">
                  {item.quantity}
                </span>
                <Button variant="outline" size="icon-sm" onClick={() => onUpdateQuantity(item.cartItemId, 1)} aria-label="Tambah jumlah">
                  <Plus />
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
