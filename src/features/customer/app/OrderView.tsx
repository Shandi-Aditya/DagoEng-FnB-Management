"use client";

import { useCallback, useState } from "react";
import { Minus, Plus, Search, ShoppingBag, UtensilsCrossed } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resolveCustomerProductOptions, type CustomerCartItem } from "@/features/customer/customer-domain";
import { cn, formatCurrencyIDR } from "@/lib/utils";
import type { MasterProduct } from "@/types/product";

export interface PartnerOption {
  id: string;
  name: string;
  tagline: string;
  isOpen: boolean;
}

// Phone-sized touch targets for the filter rows
const TAB_LIST = "max-w-full justify-start overflow-x-auto no-scrollbar group-data-horizontal/tabs:h-10";
const TAB_TRIGGER = "flex-none px-3 text-sm";
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

function ProductThumbnail({ src, name }: { src?: string; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (src && node?.complete && node.naturalWidth === 0) {
        setFailedSrc(src);
      }
    },
    [src],
  );
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-border/60 sm:size-20">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- menu photos come from arbitrary tenant hosts
        <img
          ref={imageRef}
          src={src}
          alt={name}
          loading="lazy"
          onError={() => src && setFailedSrc(src)}
          className="size-full object-cover"
        />
      ) : (
        <UtensilsCrossed className="size-5 text-muted-foreground/50" aria-hidden />
      )}
    </div>
  );
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
  const quantityOf = (id: string) =>
    cart.filter((item) => item.product.id === id).reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight">Mau makan apa?</h1>
        <p className="text-sm text-muted-foreground">Pilih dapur, tambah menu, lalu bayar dari sini.</p>
      </div>

      <Tabs value={activePartnerId} onValueChange={(value) => props.onPartnerChange(String(value))}>
        <TabsList aria-label="Dapur mitra" className={TAB_LIST}>
          {partners.map((partner) => (
            <TabsTrigger key={partner.id} value={partner.id} className={TAB_TRIGGER}>
              {partner.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

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
        <Tabs value={props.activeCategory} onValueChange={(value) => props.onCategoryChange(String(value))}>
          <TabsList variant="line" aria-label="Kategori" className={TAB_LIST}>
            {["ALL", ...props.categories].map((category) => (
              <TabsTrigger key={category} value={category} className={TAB_TRIGGER}>
                {category === "ALL" ? "Semua" : category}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
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
          {products.map((product) => {
            const { hasOptions } = resolveCustomerProductOptions(product);
            const qty = quantityOf(product.id);
            return (
              <li key={product.id} className={cn("flex items-center gap-3.5 p-3.5 sm:gap-4 sm:p-4", !product.isAvailable && "opacity-50")}>
                <ProductThumbnail src={product.imageUrl} name={product.name} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-medium leading-snug">{product.name}</span>
                  {product.description ? <span className="line-clamp-2 text-xs text-muted-foreground">{product.description}</span> : null}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-mono text-sm tabular-nums">{formatCurrencyIDR(product.basePrice)}</span>
                    {hasOptions ? (
                      <span className="text-xs text-muted-foreground">Tersedia pilihan</span>
                    ) : null}
                  </div>
                </div>
                {product.isAvailable ? (
                  hasOptions && qty === 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => props.onAdd(product)}
                      aria-label={`Pilih opsi ${product.name}`}
                      className="shrink-0"
                    >
                      Pilih
                    </Button>
                  ) : (
                    <Stepper
                      name={product.name}
                      quantity={qty}
                      onAdd={() => props.onAdd(product)}
                      onRemove={() => props.onRemove(product.id)}
                    />
                  )
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">Habis</span>
                )}
              </li>
            );
          })}
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
