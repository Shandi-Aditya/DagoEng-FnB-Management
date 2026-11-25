import type { MasterProduct } from "@/types/product";
import type { PromoConfig } from "@/lib/promo";
import type { OrderRecord } from "@/types/order";
import { normalizeTenantId } from "@/features/orders/orders-domain";
import { POS_PRODUCTS } from "@/features/pos/mock-data";
import type {
  POSCartItem,
  POSModifierGroup,
  POSProductItem,
  POSVariantOption,
} from "@/features/pos/types";
import { resolveProductModifierGroups } from "@/lib/pos-modifiers";

export type CustomerBadgeTone = "success" | "warning" | "info" | "destructive" | "neutral";
export type CustomerPortalTab = "space" | "order" | "activity" | "account";

export interface CustomerCartItem {
  lineKey?: string;
  product: MasterProduct;
  quantity: number;
  selectedVariant?: string;
  selectedModifiers?: string[];
  unitPrice?: number;
  notes?: string;
}

export interface ResolvedCustomerProductOptions {
  variants: POSVariantOption[];
  modifierGroups: POSModifierGroup[];
  hasOptions: boolean;
}

/** Resolves initial `/customer` tab: Coworking (`space`) by default, or F&B (`order`) for table QR links / menu params. */
export function resolveCustomerInitialView(
  rawTab: string | null,
  rawMeja?: string | null,
): CustomerPortalTab {
  switch ((rawTab ?? "").trim().toUpperCase()) {
    case "MENU":
    case "ORDER":
    case "FNB":
      return "order";
    case "COWORKING":
    case "SPACE":
      return "space";
    case "ORDERS":
    case "ACTIVITY":
      return "activity";
    case "LOYALTY":
    case "PROFILE":
    case "ACCOUNT":
      return "account";
    default:
      return rawMeja && rawMeja.trim() ? "order" : "space";
  }
}

/** Resolves product variants and category modifier groups using the exact same rules as POS & self-order API. */
export function resolveCustomerProductOptions(product: MasterProduct): ResolvedCustomerProductOptions {
  const variants: POSVariantOption[] =
    product.variants && product.variants.length > 0
      ? product.variants
      : POS_PRODUCTS.find((p) => p.id === product.id)?.variants ?? [];
  const modifierGroups = resolveProductModifierGroups(product);

  return {
    variants,
    modifierGroups,
    hasOptions: variants.length > 0 || modifierGroups.length > 0,
  };
}

/** Maps a master catalog product into a `POSProductItem` for the shared cashier `ModifierModal`. */
export function toCustomerPosProductItem(product: MasterProduct): POSProductItem {
  const { variants, modifierGroups } = resolveCustomerProductOptions(product);
  return {
    id: product.id,
    name: product.name,
    basePrice: product.basePrice,
    category: product.category,
    description: product.description,
    imageUrl: product.imageUrl,
    isAvailable: product.isAvailable,
    variants,
    modifierGroups,
    tenantId: product.tenantId,
  };
}

/** Builds a deterministic cart line key so distinct variant/modifier/note combinations stay separate lines. */
export function getCustomerCartItemKey(
  item: Pick<CustomerCartItem, "lineKey" | "product" | "selectedVariant" | "selectedModifiers" | "notes">,
): string {
  if (item.lineKey && item.lineKey.trim()) return item.lineKey;
  const variantPart = (item.selectedVariant ?? "").trim();
  const modifiersPart = [...(item.selectedModifiers ?? [])]
    .map((m) => m.trim())
    .filter(Boolean)
    .sort()
    .join("|");
  const notesPart = (item.notes ?? "").trim();
  return `${item.product.id}::${variantPart}::${modifiersPart}::${notesPart}`;
}

/** Returns authoritative per-unit price including selected variant/modifier adjustments. */
export function getCustomerCartItemUnitPrice(
  item: Pick<CustomerCartItem, "product" | "unitPrice">,
): number {
  if (item.unitPrice !== undefined && Number.isFinite(item.unitPrice) && item.unitPrice >= 0) {
    return item.unitPrice;
  }
  return Math.max(0, Number(item.product.basePrice) || 0);
}

/** Converts a `POSCartItem` produced by `ModifierModal` into a `CustomerCartItem`. */
export function buildCustomerCartItemFromPos(
  product: MasterProduct,
  posItem: POSCartItem,
): CustomerCartItem {
  const selectedVariant = posItem.selectedVariant?.name?.trim() || undefined;
  const selectedModifiers = posItem.selectedModifiers
    .map((m) => m.name.trim())
    .filter(Boolean);
  const notes = posItem.notes?.trim() || undefined;
  const unitPrice = Math.max(0, Number(posItem.unitFinalPrice) || Number(product.basePrice) || 0);
  const quantity = Math.max(1, Math.floor(Number(posItem.quantity) || 1));
  const lineKey = getCustomerCartItemKey({
    product,
    selectedVariant,
    selectedModifiers,
    notes,
  });

  return {
    lineKey,
    product,
    quantity,
    ...(selectedVariant ? { selectedVariant } : {}),
    ...(selectedModifiers.length > 0 ? { selectedModifiers } : {}),
    unitPrice,
    ...(notes ? { notes } : {}),
  };
}

/** Merges an incoming cart item into the cart by canonical line key. */
export function upsertCustomerCartItem(
  cart: readonly CustomerCartItem[],
  incoming: CustomerCartItem,
): CustomerCartItem[] {
  const key = getCustomerCartItemKey(incoming);
  const qty = Math.max(1, Math.floor(Number(incoming.quantity) || 1));
  const normalized: CustomerCartItem = {
    ...incoming,
    lineKey: key,
    quantity: qty,
  };
  const existingIdx = cart.findIndex((entry) => getCustomerCartItemKey(entry) === key);
  if (existingIdx === -1) {
    return [...cart, normalized];
  }
  return cart.map((entry, idx) =>
    idx === existingIdx ? { ...entry, lineKey: key, quantity: entry.quantity + qty } : entry,
  );
}

/** Increments quantity of a single cart line identified by `lineKey`. */
export function incrementCustomerCartLine(
  cart: readonly CustomerCartItem[],
  lineKey: string,
): CustomerCartItem[] {
  return cart.map((item) => {
    const key = getCustomerCartItemKey(item);
    return key === lineKey ? { ...item, lineKey: key, quantity: item.quantity + 1 } : item;
  });
}

/** Decrements quantity (or removes when 1) of a single cart line identified by `lineKey`. */
export function decrementCustomerCartLine(
  cart: readonly CustomerCartItem[],
  lineKey: string,
): CustomerCartItem[] {
  return cart.flatMap((item) => {
    const key = getCustomerCartItemKey(item);
    if (key !== lineKey) return [item];
    return item.quantity > 1 ? [{ ...item, lineKey: key, quantity: item.quantity - 1 }] : [];
  });
}

/** Decrements the most recently added cart line for `productId` from the menu catalog stepper. */
export function decrementCustomerCartByProduct(
  cart: readonly CustomerCartItem[],
  productId: string,
): CustomerCartItem[] {
  let targetIdx = -1;
  for (let i = cart.length - 1; i >= 0; i--) {
    if (cart[i].product.id === productId) {
      targetIdx = i;
      break;
    }
  }
  if (targetIdx === -1) return [...cart];
  return cart.flatMap((item, idx) => {
    if (idx !== targetIdx) return [item];
    return item.quantity > 1 ? [{ ...item, quantity: item.quantity - 1 }] : [];
  });
}

/** Formats selected variant and modifier names for compact display inside checkout rows. */
export function formatCustomerCartItemOptions(
  item: Pick<CustomerCartItem, "selectedVariant" | "selectedModifiers">,
): string {
  return [item.selectedVariant, ...(item.selectedModifiers ?? [])]
    .map((entry) => entry?.trim())
    .filter((entry): entry is string => Boolean(entry))
    .join(" · ");
}

export interface CustomerCartTotals {
  subtotal: number;
  discountAmount: number;
  serviceChargeAmount: number;
  taxAmount: number;
  finalTotal: number;
}

export interface CalculateCartTotalsOptions {
  activePromo?: PromoConfig | null;
  taxRatePercent?: number;
  serviceChargePercent?: number;
  isDineIn?: boolean;
}

export function customerOrderStatusLabel(status: OrderRecord["status"] | string): string {
  switch (status) {
    case "NEW":
      return "Menunggu konfirmasi";
    case "CONFIRMED":
      return "Diterima kasir";
    case "KITCHEN_RECEIVED":
      return "Diterima dapur";
    case "COOKING":
      return "Sedang dimasak";
    case "READY":
      return "Siap diambil";
    case "SERVED":
      return "Sudah disajikan";
    case "COMPLETED":
      return "Selesai";
    case "CANCELLED":
      return "Dibatalkan";
    default:
      return status || "—";
  }
}

export function customerOrderStatusTone(status: OrderRecord["status"] | string): CustomerBadgeTone {
  switch (status) {
    case "NEW":
      return "warning";
    case "CONFIRMED":
    case "KITCHEN_RECEIVED":
    case "COOKING":
      return "info";
    case "READY":
    case "SERVED":
      return "success";
    case "CANCELLED":
      return "destructive";
    case "COMPLETED":
    default:
      return "neutral";
  }
}

export function spaceTypeLabel(type: string): string {
  switch (type) {
    case "HOT_DESK":
      return "Hot desk";
    case "DEDICATED_DESK":
      return "Dedicated desk";
    case "MEETING_ROOM":
      return "Ruang rapat";
    case "PRIVATE_POD":
      return "Private pod";
    case "PRIVATE_OFFICE":
      return "Kantor privat";
    default:
      return type || "Ruang kerja";
  }
}

export function bookingStatusLabel(status: string): string {
  switch (status) {
    case "RESERVED":
      return "Dipesan";
    case "CONFIRMED":
      return "Terkonfirmasi";
    case "CHECKED_IN":
      return "Sedang digunakan";
    case "COMPLETED":
      return "Selesai";
    case "CANCELLED":
      return "Dibatalkan";
    default:
      return status || "—";
  }
}

export function bookingStatusTone(status: string): CustomerBadgeTone {
  switch (status) {
    case "RESERVED":
      return "info";
    case "CONFIRMED":
    case "CHECKED_IN":
      return "success";
    case "CANCELLED":
      return "destructive";
    case "COMPLETED":
    default:
      return "neutral";
  }
}

export function filterCustomerProducts(
  products: readonly MasterProduct[],
  options: {
    partnerId?: string;
    category?: string;
    searchQuery?: string;
  } = {},
): MasterProduct[] {
  const { partnerId = "ALL", category = "ALL", searchQuery = "" } = options;
  const needle = searchQuery.trim().toLowerCase();
  const normalizedPartner = partnerId !== "ALL" ? normalizeTenantId(partnerId) : "ALL";

  return products.filter((p) => {
    if (p.status && p.status !== "ACTIVE") return false;
    if (normalizedPartner !== "ALL") {
      const productTenant = normalizeTenantId(p.tenantId || "tenant-ks");
      if (productTenant !== normalizedPartner) return false;
    }
    if (category !== "ALL" && p.category !== category) return false;
    if (needle) {
      const matchName = p.name.toLowerCase().includes(needle);
      const matchCat = p.category.toLowerCase().includes(needle);
      const matchDesc = p.description?.toLowerCase().includes(needle) ?? false;
      if (!matchName && !matchCat && !matchDesc) return false;
    }
    return true;
  });
}

export function calculateCartTotals(
  cartItems: readonly CustomerCartItem[],
  options: CalculateCartTotalsOptions = {},
): CustomerCartTotals {
  const {
    activePromo = null,
    taxRatePercent = 0,
    serviceChargePercent = 0,
    isDineIn = false,
  } = options;

  const subtotal = cartItems.reduce((acc, item) => {
    return acc + getCustomerCartItemUnitPrice(item) * item.quantity;
  }, 0);

  let discountAmount = 0;
  if (activePromo && activePromo.isActive) {
    if (activePromo.discountType === "PERCENTAGE") {
      const calculated = (subtotal * activePromo.discountValue) / 100;
      discountAmount = activePromo.maxDiscount
        ? Math.min(calculated, activePromo.maxDiscount)
        : calculated;
    } else if (activePromo.discountType === "FIXED") {
      discountAmount = Math.min(subtotal, activePromo.discountValue);
    }
  }

  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);

  // Service charge applies to dine-in
  const serviceChargeAmount = isDineIn
    ? Math.round((subtotalAfterDiscount * serviceChargePercent) / 100)
    : 0;

  // Tax (PB1) calculated on subtotal after discount
  const taxAmount = Math.round((subtotalAfterDiscount * taxRatePercent) / 100);

  const finalTotal = subtotalAfterDiscount + serviceChargeAmount + taxAmount;

  return {
    subtotal,
    discountAmount,
    serviceChargeAmount,
    taxAmount,
    finalTotal,
  };
}

import { getCoworkingStartSlots } from "@/lib/operating-hours";

export const COWORKING_TIME_SLOTS = getCoworkingStartSlots(1);

export function getAvailableTimeSlots(): string[] {
  return [...COWORKING_TIME_SLOTS];
}

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 9 * 60;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }
  return 9 * 60;
}

export function formatMinutesToTime(totalMinutes: number): string {
  const norm = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(norm / 60);
  const mins = norm % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

export function calculateEndTime(startTime: string, durationHours: number): string {
  if (!startTime) return "11:00";
  const startMins = parseTimeToMinutes(startTime);
  const endMins = startMins + durationHours * 60;
  return formatMinutesToTime(endMins);
}
