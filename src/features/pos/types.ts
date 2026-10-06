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
}

export type POSPaymentMethod = "QRIS" | "CASH" | "EDC" | "SPLIT";

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
  outletName: string;
  outletAddress: string;
  outletPhone: string;
  tableNumber: string;
  customerName: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    tenantId?: string;
    tenantName?: string;
    variantName?: string;
    modifiers?: string[];
    notes?: string;
  }[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  promoName?: string;
  discount: number;
  grandTotal: number;
  paymentMethod: POSPaymentMethod;
  amountPaid: number;
  changeDue: number;
  splitDetails?: SplitGuestBill[];
  loyaltyMember?: {
    name: string;
    tier: string;
    pointsUsed: number;
    pointsRemaining: number;
    voucherTitle?: string;
  };
}
