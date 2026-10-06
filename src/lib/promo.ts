export type PromoType = "PERCENTAGE" | "FIXED";
export type TargetType = "ALL" | "PRODUCT" | "CATEGORY" | "TENANT";
export type PromoScope = "ALL" | "FNB" | "COWORKING";

export interface PromoConfig {
  id: string;
  code?: string; // e.g. "DAGO20", "COWORK50"
  name: string;
  description?: string;
  discountType: PromoType;
  discountValue: number; 
  targetType: TargetType;
  targetId?: string;
  scope?: PromoScope; // "ALL" | "FNB" | "COWORKING" (Defaults to "ALL" if undefined)
  minimumAmount?: number;
  maxDiscount?: number; // Capped discount amount for PERCENTAGE
  validFrom?: string; // ISO String (Start Date)
  validUntil?: string; // ISO String (End Date)
  quota?: number; // Maximum times this promo can be used across all users
  usageCount?: number; // Number of times used
  claimedBy?: string[]; // List of customer identifiers (phone/id) who claimed
  usedBy?: string[]; // List of customer identifiers who used (single-use enforcement)
  requiresClaim?: boolean; // If true, customer must claim before use
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

export interface VoucherValidationResult {
  isValid: boolean;
  promo?: PromoConfig;
  discountAmount: number;
  reason?: string;
}

export function isPromoEligibleForItem(item: OrderItemInput, promo: PromoConfig): boolean {
  if (promo.scope === "COWORKING") return false; // F&B item is not eligible for coworking-only promo
  if (promo.targetType === "ALL") return true;
  if (promo.targetType === "PRODUCT" && promo.targetId && item.productId === promo.targetId) return true;
  if (promo.targetType === "CATEGORY" && promo.targetId && item.category === promo.targetId) return true;
  if (promo.targetType === "TENANT" && promo.targetId && item.tenantId === promo.targetId) return true;
  return false;
}

export function checkPromoValidity(
  promo: PromoConfig,
  originalSubtotal: number,
  context?: {
    customerId?: string;
    scope?: PromoScope;
    tenantId?: string;
  }
): { isValid: boolean; reason?: string } {
  if (!promo.isActive) {
    return { isValid: false, reason: "Promo / voucher saat ini sedang tidak aktif." };
  }
  
  const now = new Date().toISOString();
  if (promo.validUntil && promo.validUntil < now) {
    return { isValid: false, reason: "Masa berlaku voucher sudah berakhir (Expired)." };
  }
  if (promo.validFrom && promo.validFrom > now) {
    return { isValid: false, reason: "Promo voucher belum dimulai." };
  }
  
  if (promo.minimumAmount && originalSubtotal < promo.minimumAmount) {
    return {
      isValid: false,
      reason: `Voucher hanya berlaku untuk minimal transaksi Rp ${promo.minimumAmount.toLocaleString("id-ID")}.`,
    };
  }

  // Quota check
  if (promo.quota !== undefined && promo.quota > 0 && (promo.usageCount || 0) >= promo.quota) {
    return { isValid: false, reason: "Kuota pemakaian voucher ini sudah habis." };
  }

  // Scope check (FNB vs COWORKING)
  if (context?.scope && promo.scope && promo.scope !== "ALL" && promo.scope !== context.scope) {
    return {
      isValid: false,
      reason: `Voucher ini hanya berlaku khusus untuk ${promo.scope === "COWORKING" ? "Co-Working & Ruang Kerja" : "Kuliner F&B"}.`,
    };
  }

  // Single-use per customer check
  if (context?.customerId && promo.usedBy && promo.usedBy.includes(context.customerId)) {
    return { isValid: false, reason: "Anda sudah pernah menggunakan voucher ini sebelumnya." };
  }
  
  return { isValid: true };
}

export function validateVoucherCode(
  rawCode: string,
  promosList: PromoConfig[],
  subtotal: number,
  context?: {
    customerId?: string;
    scope?: PromoScope;
    tenantId?: string;
  }
): VoucherValidationResult {
  const cleanCode = (rawCode || "").trim().toUpperCase();
  if (!cleanCode) {
    return { isValid: false, discountAmount: 0, reason: "Silakan masukkan kode voucher." };
  }

  const foundPromo = promosList.find(
    (p) => (p.code && p.code.trim().toUpperCase() === cleanCode) || p.name.trim().toUpperCase() === cleanCode
  );

  if (!foundPromo) {
    return { isValid: false, discountAmount: 0, reason: `Kode voucher "${cleanCode}" tidak ditemukan atau tidak valid.` };
  }

  const validity = checkPromoValidity(foundPromo, subtotal, context);
  if (!validity.isValid) {
    return { isValid: false, promo: foundPromo, discountAmount: 0, reason: validity.reason };
  }

  // Calculate discount estimate
  let discount = 0;
  if (foundPromo.discountType === "PERCENTAGE") {
    discount = (subtotal * foundPromo.discountValue) / 100;
    if (foundPromo.maxDiscount && discount > foundPromo.maxDiscount) {
      discount = foundPromo.maxDiscount;
    }
  } else {
    discount = foundPromo.discountValue;
  }

  if (discount > subtotal) discount = subtotal;
  if (discount < 0) discount = 0;

  return {
    isValid: true,
    promo: foundPromo,
    discountAmount: Math.round(discount),
  };
}

export function calculateOrderPricing(
  items: OrderItemInput[],
  promo?: PromoConfig,
  taxRate: number = 0.1 // Default PB1 10%
): OrderCalculationResult {
  const originalSubtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  let discountAmount = 0;

  if (promo && checkPromoValidity(promo, originalSubtotal, { scope: "FNB" }).isValid) {
    const eligibleSubtotal = items
      .filter((item) => isPromoEligibleForItem(item, promo))
      .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    if (eligibleSubtotal > 0) {
      if (promo.discountType === "PERCENTAGE") {
        discountAmount = (eligibleSubtotal * promo.discountValue) / 100;
        if (promo.maxDiscount && discountAmount > promo.maxDiscount) {
          discountAmount = promo.maxDiscount;
        }
      } else if (promo.discountType === "FIXED") {
        discountAmount = promo.discountValue;
        if (discountAmount > eligibleSubtotal) {
          discountAmount = eligibleSubtotal;
        }
      }
    }
  }

  // Discount cannot exceed subtotal
  if (discountAmount > originalSubtotal) {
    discountAmount = originalSubtotal;
  }

  // Discount cannot be negative
  if (discountAmount < 0) {
    discountAmount = 0;
  }

  const subtotalAfterDiscount = originalSubtotal - discountAmount;
  const tax = subtotalAfterDiscount * taxRate;
  const total = subtotalAfterDiscount + tax;

  return {
    originalSubtotal,
    discountAmount: Math.round(discountAmount),
    subtotalAfterDiscount: Math.round(subtotalAfterDiscount),
    tax: Math.round(tax),
    total: Math.round(total),
  };
}

export function calculateCoworkingPricing(
  basePrice: number,
  promo?: PromoConfig,
  taxRate: number = 0.1
): OrderCalculationResult {
  const originalSubtotal = basePrice;
  let discountAmount = 0;

  if (promo && checkPromoValidity(promo, originalSubtotal, { scope: "COWORKING" }).isValid) {
    if (promo.discountType === "PERCENTAGE") {
      discountAmount = (originalSubtotal * promo.discountValue) / 100;
      if (promo.maxDiscount && discountAmount > promo.maxDiscount) {
        discountAmount = promo.maxDiscount;
      }
    } else if (promo.discountType === "FIXED") {
      discountAmount = promo.discountValue;
      if (discountAmount > originalSubtotal) {
        discountAmount = originalSubtotal;
      }
    }
  }

  if (discountAmount > originalSubtotal) discountAmount = originalSubtotal;
  if (discountAmount < 0) discountAmount = 0;

  const subtotalAfterDiscount = originalSubtotal - discountAmount;
  const tax = subtotalAfterDiscount * taxRate;
  const total = subtotalAfterDiscount + tax;

  return {
    originalSubtotal,
    discountAmount: Math.round(discountAmount),
    subtotalAfterDiscount: Math.round(subtotalAfterDiscount),
    tax: Math.round(tax),
    total: Math.round(total),
  };
}

