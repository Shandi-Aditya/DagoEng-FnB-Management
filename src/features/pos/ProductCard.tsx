"use client";

import { useCallback, useState } from "react";
import { Plus, Utensils } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import {
  type ProductAvailability,
  type StockStatus,
  type TenantOpenState,
  productAvailability,
  tenantClosedMessage,
} from "@/features/pos/pos-catalog";
import { cn, formatCurrencyIDR } from "@/lib/utils";

export interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  imageUrl?: string;
  isAvailable: boolean;
  stockStatus: StockStatus;
  tenantId?: string;
}

const AVAILABILITY_BADGE: Partial<Record<ProductAvailability, { tone: "warning" | "destructive"; label: string }>> = {
  closed: { tone: "warning", label: "Tutup sementara" },
  soldOut: { tone: "destructive", label: "Habis" },
  lowStock: { tone: "warning", label: "Stok tipis" },
};

interface ProductCardProps {
  product: CatalogProduct;
  tenant: TenantOpenState;
  onSelect: () => void;
}

/** Catalog tile. A closed tenant stays clickable so the cashier sees why; sold out is disabled. */
export function ProductCard({ product, tenant, onSelect }: ProductCardProps) {
  const availability = productAvailability(product, tenant);
  const badge = AVAILABILITY_BADGE[availability];
  const isBlocked = availability === "closed" || availability === "soldOut";
  const [imageFailed, setImageFailed] = useState(false);
  // An image can fail before hydration attaches onError, so also check it once mounted
  const imageRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth === 0) setImageFailed(true);
  }, []);

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={availability === "soldOut"}
      aria-disabled={isBlocked}
      className={cn(
        "group flex flex-col gap-2 rounded-lg bg-card p-2 text-left ring-1 ring-foreground/10 transition-[box-shadow,background-color] outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isBlocked ? "cursor-not-allowed opacity-60" : "hover:ring-primary/40 hover:shadow-sm",
      )}
    >
      <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-md bg-muted">
        {product.imageUrl && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- menu photos come from arbitrary tenant hosts
          <img
            ref={imageRef}
            src={product.imageUrl}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              setImageFailed(true);
            }}
            className="size-full object-cover"
          />
        ) : (
          <div className="product-fallback-placeholder flex size-full items-center justify-center text-muted-foreground">
            <Utensils className="size-6 opacity-40" aria-hidden />
          </div>
        )}
        {badge ? (
          <StatusBadge status={badge.tone} className="absolute top-1.5 right-1.5 bg-card text-xs">
            {badge.label}
          </StatusBadge>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 px-0.5">
        <span className="text-xs text-muted-foreground">{product.category}</span>
        <span className="line-clamp-2 text-sm font-medium">{product.name}</span>
        {availability === "closed" ? (
          <span className="line-clamp-2 text-xs text-warning" title={tenantClosedMessage(tenant)}>
            {tenantClosedMessage(tenant)}
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t px-0.5 pt-2">
        <span className="font-mono text-sm font-medium tabular-nums">{formatCurrencyIDR(product.basePrice)}</span>
        {!isBlocked ? (
          <span className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Plus className="size-3.5" aria-hidden />
          </span>
        ) : null}
      </div>
    </button>
  );
}
