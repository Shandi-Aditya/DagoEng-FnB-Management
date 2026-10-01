export type PromoType = "PERCENTAGE" | "FIXED";
export type TargetType = "ALL" | "PRODUCT" | "CATEGORY" | "TENANT";

export interface PromoConfig {
  id: string;
  name: string;
  discountType: PromoType;
  discountValue: number; 
  targetType: TargetType;
  targetId?: string;
  minimumAmount?: number;
  validFrom?: string; // ISO String
  validUntil?: string; // ISO String
  isActive: boolean;
}

export interface OrderItemInput {
  productId?: string;
  category?: string;
  tenantId?: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderCalculationResult {
  originalSubtotal: number;
  discountAmount: number;
  subtotalAfterDiscount: number;
  tax: number; 
  total: number;
}

export function isPromoEligibleForItem(item: OrderItemInput, promo: PromoConfig): boolean {
  if (promo.targetType === "ALL") return true;
  if (promo.targetType === "PRODUCT" && promo.targetId && item.productId === promo.targetId) return true;
  if (promo.targetType === "CATEGORY" && promo.targetId && item.category === promo.targetId) return true;
  if (promo.targetType === "TENANT" && promo.targetId && item.tenantId === promo.targetId) return true;
  return false;
}

export function checkPromoValidity(promo: PromoConfig, originalSubtotal: number): boolean {
  if (!promo.isActive) return false;
  
  const now = new Date().toISOString();
  if (promo.validUntil && promo.validUntil < now) return false;
  if (promo.validFrom && promo.validFrom > now) return false;
  
  if (promo.minimumAmount && originalSubtotal < promo.minimumAmount) return false;
  
  return true;
}

export function calculateOrderPricing(
  items: OrderItemInput[],
  promo?: PromoConfig,
  taxRate: number = 0.1 // Default PB1 10%
): OrderCalculationResult {
  const originalSubtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  let discountAmount = 0;

  if (promo && checkPromoValidity(promo, originalSubtotal)) {
    const eligibleSubtotal = items
      .filter(item => isPromoEligibleForItem(item, promo))
      .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    if (eligibleSubtotal > 0) {
      if (promo.discountType === "PERCENTAGE") {
        discountAmount = (eligibleSubtotal * promo.discountValue) / 100;
      } else if (promo.discountType === "FIXED") {
        discountAmount = promo.discountValue;
        if (discountAmount > eligibleSubtotal) {
          discountAmount = eligibleSubtotal;
        }
      }
    }
  }

  // Discount tidak boleh melebihi subtotal
  if (discountAmount > originalSubtotal) {
    discountAmount = originalSubtotal;
  }

  // Discount tidak boleh negatif
  if (discountAmount < 0) {
    discountAmount = 0;
  }

  const subtotalAfterDiscount = originalSubtotal - discountAmount;
  const tax = subtotalAfterDiscount * taxRate;
  const total = subtotalAfterDiscount + tax;

  return {
    originalSubtotal,
    discountAmount,
    subtotalAfterDiscount,
    tax,
    total,
  };
}
