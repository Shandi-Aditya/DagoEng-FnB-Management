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

/**
 * Calculates unit final price and total price for a product item
 * with its selected variant, modifier options, and quantity.
 */
export function calculateItemFinalPrice(
  basePrice: number,
  variantAdjustment: number = 0,
  modifiersTotal: number = 0,
  quantity: number = 1
): { unitFinalPrice: number; itemGrandTotal: number } {
  const safeBase = Math.max(0, Number(basePrice) || 0);
  const safeVariant = Number(variantAdjustment) || 0;
  const safeModifiers = Math.max(0, Number(modifiersTotal) || 0);
  const safeQty = Math.max(1, Number(quantity) || 1);

  const unitFinalPrice = Math.max(0, safeBase + safeVariant + safeModifiers);
  const itemGrandTotal = unitFinalPrice * safeQty;

  return { unitFinalPrice, itemGrandTotal };
}
