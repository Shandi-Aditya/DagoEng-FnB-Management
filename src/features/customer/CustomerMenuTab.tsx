"use client";

import { useState } from "react";
import { Minus, Plus, Search, ShoppingBag, Store, UtensilsCrossed } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { formatCurrencyIDR } from "@/lib/utils";
import type { MasterProduct } from "@/types/product";
import type { CustomerCartItem } from "./customer-domain";

interface FnbPartnerInfo {
  id: string;
  name: string;
  badge: string;
  tagline: string;
}

export interface CustomerMenuTabProps {
  products: MasterProduct[];
  partners: FnbPartnerInfo[];
  activePartnerId: string;
  onSelectPartner: (id: string) => void;
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  cart: CustomerCartItem[];
  onAddToCart: (product: MasterProduct) => void;
  onRemoveFromCart: (productId: string) => void;
  onOpenCheckout: () => void;
  cartTotalCount: number;
  cartTotalPrice: number;
}

/**
 * Komponen gambar menu dengan penanganan error/fallback anggun.
 * Jika URL foto rusak atau tidak dapat dimuat, otomatis menampilkan placeholder netral.
 */
function ProductCardImage({
  src,
  alt,
  category,
}: {
  src?: string;
  alt: string;
  category: string;
}) {
  const [hasError, setHasError] = useState(!src);

  if (hasError || !src) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-muted/40 text-muted-foreground p-4">
        <UtensilsCrossed className="size-6 opacity-35" />
        <span className="text-xs text-muted-foreground/60">{category}</span>
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className="size-full object-cover"
      loading="lazy"
    />
  );
}

export function CustomerMenuTab({
  products,
  partners,
  activePartnerId,
  onSelectPartner,
  categories,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  cart,
  onAddToCart,
  onRemoveFromCart,
  onOpenCheckout,
  cartTotalCount,
  cartTotalPrice,
}: CustomerMenuTabProps) {
  const getProductCartQty = (productId: string) => {
    return cart.find((item) => item.product.id === productId)?.quantity || 0;
  };

  const activePartner = partners.find((p) => p.id === activePartnerId);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Baris Pemilih Mitra Kuliner */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Pilih dapur mitra</span>
          {activePartner?.tagline ? (
            <span className="text-xs text-muted-foreground hidden sm:inline">{activePartner.tagline}</span>
          ) : null}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {partners.map((partner) => {
            const isSelected = partner.id === activePartnerId;
            return (
              <button
                key={partner.id}
                type="button"
                onClick={() => onSelectPartner(partner.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? "border-foreground/30 bg-secondary text-foreground font-medium shadow-xs"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <span className="size-2 rounded-full bg-unit-fnb shrink-0" aria-hidden />
                <span className="font-medium text-foreground">{partner.name}</span>
                <span className="text-muted-foreground">({partner.badge})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Filter Kategori & Pencarian */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-sm flex-1">
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="Cari makanan atau minuman…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Cari menu"
            />
          </InputGroup>
        </div>

        {/* Chips Kategori */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={selectedCategory === "ALL" ? "secondary" : "outline"}
            onClick={() => onSelectCategory("ALL")}
            className={selectedCategory === "ALL" ? "border-foreground/20 font-medium" : "text-muted-foreground"}
          >
            Semua kategori
          </Button>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <Button
                key={cat}
                type="button"
                size="sm"
                variant={isSelected ? "secondary" : "outline"}
                onClick={() => onSelectCategory(cat)}
                className={isSelected ? "border-foreground/20 font-medium" : "text-muted-foreground"}
              >
                {cat}
              </Button>
            );
          })}
        </div>
      </div>

      {/* 3. Grid Menu Produk (Kaya Visual, Bebas Broken Image) */}
      {products.length === 0 ? (
        <EmptyState
          className="border"
          icon={<UtensilsCrossed />}
          title="Menu tidak ditemukan"
          description={
            searchQuery.trim()
              ? `Tidak ada menu yang sesuai dengan kata kunci "${searchQuery}".`
              : "Belum ada menu yang terdaftar untuk dapur mitra ini."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const qty = getProductCartQty(product.id);
            const isOutOfStock = product.status === "INACTIVE" || !product.isAvailable;

            return (
              <Card
                key={product.id}
                className="flex flex-col justify-between overflow-hidden shadow-xs hover:border-foreground/25 transition-colors"
              >
                <div className="flex flex-col">
                  {/* Foto Produk */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted border-b">
                    <ProductCardImage
                      src={product.imageUrl}
                      alt={product.name}
                      category={product.category}
                    />
                    <div className="absolute top-2.5 right-2.5">
                      <Badge variant="secondary" className="backdrop-blur-md bg-background/80 shadow-xs font-normal">
                        {product.category}
                      </Badge>
                    </div>
                  </div>

                  {/* Keterangan Menu */}
                  <div className="flex flex-col p-4 gap-1">
                    <span className="text-base font-medium text-foreground leading-snug">
                      {product.name}
                    </span>
                    {product.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                        {product.description}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic">Sajian segar dari dapur mitra.</p>
                    )}
                  </div>
                </div>

                {/* Harga & Tombol Tambah */}
                <div className="flex items-center justify-between border-t p-4 pt-3 bg-muted/10 text-xs">
                  <span className="font-mono text-base font-medium text-foreground tabular-nums">
                    {formatCurrencyIDR(product.basePrice)}
                  </span>

                  {isOutOfStock ? (
                    <Badge variant="secondary">Habis</Badge>
                  ) : qty > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="outline"
                        onClick={() => onRemoveFromCart(product.id)}
                        aria-label={`Kurangi ${product.name}`}
                      >
                        <Minus />
                      </Button>
                      <span className="font-mono text-sm font-medium text-foreground px-1.5 tabular-nums">
                        {qty}
                      </span>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="outline"
                        onClick={() => onAddToCart(product)}
                        aria-label={`Tambah ${product.name}`}
                      >
                        <Plus />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onAddToCart(product)}
                      aria-label={`Tambah ${product.name} ke keranjang`}
                    >
                      <Plus />
                      <span>Tambah</span>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 4. Tombol Floating Checkout jika Keranjang Terisi */}
      {cartTotalCount > 0 ? (
        <div className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4">
          <Button
            size="lg"
            className="w-full justify-between shadow-xl"
            onClick={onOpenCheckout}
          >
            <div className="flex items-center gap-2">
              <ShoppingBag />
              <span>Lihat keranjang ({cartTotalCount} item)</span>
            </div>
            <span className="font-mono font-medium tabular-nums">
              {formatCurrencyIDR(cartTotalPrice)}
            </span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
