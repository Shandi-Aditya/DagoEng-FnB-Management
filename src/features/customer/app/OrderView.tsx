"use client";

import { Minus, Plus, Search, ShoppingBag, UtensilsCrossed } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import type { CustomerCartItem } from "@/features/customer/customer-domain";
import { cn, formatCurrencyIDR } from "@/lib/utils";
import type { MasterProduct } from "@/types/product";

export interface PartnerOption {
  id: string;
  name: string;
  tagline: string;
  isOpen: boolean;
}

const CHIP = cn(buttonVariants({ variant: "outline", size: "lg" }), "h-9 shrink-0 px-3 text-sm text-muted-foreground");
const CHIP_ACTIVE = "border-foreground/25 bg-secondary text-foreground";
const CART_BAR = "mx-auto flex h-12 w-full max-w-2xl justify-between px-4 text-sm shadow-lg";

interface OrderViewProps {
  partners: readonly PartnerOption[];
  activePartnerId: string;
  onPartnerChange: (id: string) => void;
  categories: readonly string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  products: readonly MasterProduct[];
  cart: readonly CustomerCartItem[];
  onAdd: (product: MasterProduct) => void;
  onRemove: (productId: string) => void;
  cartCount: number;
  cartSubtotal: number;
  onOpenCheckout: () => void;
}

function Stepper({ quantity, onAdd, onRemove, name }: { quantity: number; onAdd: () => void; onRemove: () => void; name: string }) {
  if (quantity === 0) {
    return (
      <Button variant="outline" size="icon-lg" onClick={onAdd} aria-label={`Tambah ${name}`}>
        <Plus />
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon-lg" onClick={onRemove} aria-label={`Kurangi ${name}`}>
        <Minus />
      </Button>
      <span className="w-5 text-center font-mono text-sm tabular-nums">{quantity}</span>
      <Button size="icon-lg" onClick={onAdd} aria-label={`Tambah ${name}`}>
        <Plus />
      </Button>
    </div>
  );
}

/** Menu of one partner kitchen at a time, with a floating cart bar once something is picked. */
export function OrderView(props: OrderViewProps) {
  const { partners, activePartnerId, products, cart } = props;
  const activePartner = partners.find((partner) => partner.id === activePartnerId);
  const quantityOf = (id: string) => cart.find((item) => item.product.id === id)?.quantity ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight">Mau makan apa?</h1>
        <p className="text-sm text-muted-foreground">Pilih dapur, tambah menu, lalu bayar dari sini.</p>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar" role="tablist" aria-label="Dapur mitra">
        {partners.map((partner) => (
          <button
            key={partner.id}
            type="button"
            role="tab"
            aria-selected={partner.id === activePartnerId}
            onClick={() => props.onPartnerChange(partner.id)}
            className={cn(CHIP, partner.id === activePartnerId && CHIP_ACTIVE)}
          >
            {partner.name}
          </button>
        ))}
      </div>

      {activePartner && !activePartner.isOpen ? (
        <p className="rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {activePartner.name} sedang tidak menerima pesanan. Coba dapur lain.
        </p>
      ) : null}

      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={props.searchQuery}
          onChange={(event) => props.onSearchChange(event.target.value)}
          placeholder="Cari menu"
          aria-label="Cari menu"
        />
      </InputGroup>

      {props.categories.length > 1 ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar" aria-label="Kategori">
          {["ALL", ...props.categories].map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => props.onCategoryChange(category)}
              className={cn(CHIP, "h-8", category === props.activeCategory && CHIP_ACTIVE)}
            >
              {category === "ALL" ? "Semua" : category}
            </button>
          ))}
        </div>
      ) : null}

      {products.length === 0 ? (
        <EmptyState
          className="border"
          icon={<UtensilsCrossed />}
          title={props.searchQuery ? "Menu tidak ditemukan" : "Belum ada menu"}
          description={props.searchQuery ? "Coba kata lain atau dapur lain." : "Dapur ini belum menambahkan menu."}
        />
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {products.map((product) => (
            <li key={product.id} className={cn("flex items-center gap-4 p-4", !product.isAvailable && "opacity-50")}>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-medium">{product.name}</span>
                {product.description ? <span className="line-clamp-2 text-xs text-muted-foreground">{product.description}</span> : null}
                <span className="font-mono text-sm tabular-nums">{formatCurrencyIDR(product.basePrice)}</span>
              </div>
              {product.isAvailable ? (
                <Stepper
                  name={product.name}
                  quantity={quantityOf(product.id)}
                  onAdd={() => props.onAdd(product)}
                  onRemove={() => props.onRemove(product.id)}
                />
              ) : (
                <span className="text-xs text-muted-foreground">Habis</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {props.cartCount > 0 ? (
        <div className="fixed inset-x-0 bottom-20 z-20 px-4">
          <button
            type="button"
            onClick={props.onOpenCheckout}
            className={cn(buttonVariants({ size: "lg" }), CART_BAR)}
          >
            <span className="flex items-center gap-2">
              <ShoppingBag />
              <span className="font-mono tabular-nums">{props.cartCount}</span> item
            </span>
            <span className="font-mono tabular-nums">{formatCurrencyIDR(props.cartSubtotal)}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
