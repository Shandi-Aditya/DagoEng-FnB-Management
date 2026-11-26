import type { MasterProduct } from "@/types/product";
import type { PromoConfig } from "@/lib/promo";
import type { OrderRecord } from "@/types/order";
import { normalizeTenantId } from "@/features/orders/orders-domain";

export type CustomerBadgeTone = "success" | "warning" | "info" | "destructive" | "neutral";

export interface CustomerCartItem {
  product: MasterProduct;
  quantity: number;
  selectedVariant?: string;
  notes?: string;
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
    case "OPEN_SPACE":
      return "Open space";
    case "SPACE_MONITOR":
      return "Space monitor";
    case "SMALL_MEETING_ROOM":
      return "Small meeting room";
    case "LARGE_MEETING_ROOM":
      return "Large meeting room";
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
    const base = item.product.basePrice;
    return acc + base * item.quantity;
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
