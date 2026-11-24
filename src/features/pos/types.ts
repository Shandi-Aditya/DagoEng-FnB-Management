import type { QRISVerificationDetail } from "@/lib/qris-verification";
import type { CorporateOrderInfo, CoworkingOrderItemMeta, OrderItemCategoryType } from "@/types/order";

export type { CoworkingOrderItemMeta, OrderItemCategoryType };

export interface POSVariantOption {
  name: string;
  priceAdjustment: number;
}

export interface POSModifierOption {
  name: string;
  price: number;
}

export interface POSModifierGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  options: POSModifierOption[];
}

export interface POSProductItem {
  id: string;
  name: string;
  basePrice: number;
  category: string;
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
  variants?: POSVariantOption[];
  modifierGroups?: POSModifierGroup[];
  tenantId?: string;
}

export interface POSCartItem {
  cartItemId: string;
  productId: string;
  productName: string;
  quantity: number;
  basePrice: number;
  selectedVariant?: POSVariantOption;
  selectedModifiers: POSModifierOption[];
  notes?: string;
  unitFinalPrice: number;
  itemTotal: number;
  tenantId?: string;
  tenantName?: string;
  itemType?: OrderItemCategoryType;
  category?: string;
  coworkingMeta?: CoworkingOrderItemMeta;
}

export type POSPaymentMethod = "QRIS" | "CASH" | "EDC" | "SPLIT" | "INVOICE";

export interface SplitGuestBill {
  id: string;
  guestLabel: string;
  assignedAmount: number;
  paymentMethod: "QRIS" | "CASH" | "EDC";
  isPaid: boolean;
}

export interface LoyaltyMemberProfile {
  id: string;
  name: string;
  phone: string;
  tier: "Gold" | "Silver" | "Bronze" | "Reguler";
  points: number;
}

export interface LoyaltyVoucher {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  discountType: "FIXED" | "PERCENT";
  discountValue: number;
  minTier?: "Gold" | "Silver" | "Bronze";
}

export interface POSReceiptData {
  orderNumber: string;
  date: string;
  cashierName: string;
  tenantId?: string;
  tenantName?: string;
  brandName?: string;
  tagline?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  outletName: string;
  outletAddress?: string;
  outletPhone?: string;
  tableNumber: string;
  customerName: string;
  customerPhone?: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    tenantId?: string;
    tenantName?: string;
    itemType?: OrderItemCategoryType;
    category?: string;
    coworkingMeta?: CoworkingOrderItemMeta;
    variantName?: string;
    modifiers?: string[];
    notes?: string;
  }[];
  subtotal: number;
  tax: number;
  fnbTax?: number;
  coworkingTax?: number;
  serviceCharge: number;
  promoName?: string;
  discount: number;
  fnbDiscount?: number;
  coworkingDiscount?: number;
  grandTotal: number;
  paymentMethod: POSPaymentMethod;
  amountPaid: number;
  changeDue: number;
  splitDetails?: SplitGuestBill[];
  qrisVerification?: QRISVerificationDetail;
  loyaltyMember?: {
    name: string;
    tier: string;
    pointsUsed: number;
    pointsRemaining: number;
    voucherTitle?: string;
  };
  corporateInfo?: CorporateOrderInfo;
}

export type POSReceiptItem = POSReceiptData["items"][number];
export type ReceiptLineItem = POSReceiptData["items"][number];
