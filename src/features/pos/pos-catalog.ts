export type StockStatus = "SAFE" | "CRITICAL" | "OUT_OF_STOCK";
export type ProductAvailability = "closed" | "soldOut" | "lowStock" | "available";

export interface TenantOpenState {
  isOpen: boolean;
  reason?: string;
  estimatedReopenTime?: string;
}

/** What a cashier can do with a product right now. A closed tenant outranks stock. */
export function productAvailability(
  product: { isAvailable: boolean; stockStatus: StockStatus },
  tenant: TenantOpenState,
): ProductAvailability {
  if (!tenant.isOpen) return "closed";
  if (!product.isAvailable || product.stockStatus === "OUT_OF_STOCK") return "soldOut";
  if (product.stockStatus === "CRITICAL") return "lowStock";
  return "available";
}

/** "reason · reopen estimate", for the closed-tenant label and toast. */
export function tenantClosedMessage(tenant: TenantOpenState): string {
  return [tenant.reason, tenant.estimatedReopenTime].filter(Boolean).join(" · ");
}

export function cartItemCount(items: readonly { quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
