import type { POSReceiptData } from "@/features/pos/types";
import { DEFAULT_FNB_TENANTS, getTenantName } from "@/lib/tenant";

export type POSReceiptItem = POSReceiptData["items"][number];

export interface TenantReceiptGroup {
  tenantId: string;
  tenantName: string;
  items: POSReceiptItem[];
  subtotal: number;
}

/**
 * Group receipt items by tenant for clear multi-mitra breakdown without mutating input.
 */
export function calculateTenantReceiptGroups(
  items: readonly POSReceiptItem[] = []
): TenantReceiptGroup[] {
  const map = new Map<string, TenantReceiptGroup>();

  for (const item of items) {
    let tId = item.tenantId;
    if (!tId && item.tenantName) {
      const match = DEFAULT_FNB_TENANTS.find(
        (t) => t.name.toLowerCase() === item.tenantName?.toLowerCase()
      );
      tId = match?.id;
    }
    const tenantId = tId || "tenant-ks";
    const tenantName =
      item.tenantName || getTenantName(tenantId) || "Kopi Senja";

    const existing = map.get(tenantId) || {
      tenantId,
      tenantName,
      items: [],
      subtotal: 0,
    };

    existing.items.push(item);
    existing.subtotal += item.subtotal;
    map.set(tenantId, existing);
  }

  return Array.from(map.values());
}

/**
 * Format loyalty points value according to glosarium ("poin" instead of "Pts").
 */
export function formatReceiptLoyaltyPoints(points: number): string {
  return `${points} poin`;
}

/**
 * Format payment status enum into sentence-case Indonesian.
 */
export function formatReceiptPaymentStatus(status: string): string {
  switch (status) {
    case "PAID":
      return "Lunas";
    case "REFUNDED":
      return "Dikembalikan";
    case "CANCELLED":
      return "Dibatalkan";
    case "PENDING":
      return "Menunggu pembayaran";
    default:
      return status;
  }
}

/**
 * Format order type into standard sentence case.
 */
export function formatReceiptOrderType(orderType?: string): string {
  switch (orderType) {
    case "TAKEAWAY":
      return "Takeaway";
    case "DELIVERY":
      return "Delivery";
    case "DINE_IN":
    default:
      return "Dine in";
  }
}

/**
 * Format service charge label without hardcoded 5%.
 */
export function formatReceiptServiceChargeLabel(serviceChargePercent?: number): string {
  if (serviceChargePercent && serviceChargePercent > 0) {
    return `Biaya layanan (${serviceChargePercent}%)`;
  }
  return "Biaya layanan";
}

export interface KitchenTicketPurposeMeta {
  title: string;
  tone: "neutral" | "warning" | "destructive" | "info" | "success";
}

/**
 * Format kitchen order ticket purpose into sentence case Indonesian and status tone.
 */
export function formatKitchenTicketPurpose(
  purpose: string = "NEW_ORDER",
  seq?: number
): KitchenTicketPurposeMeta {
  switch (purpose) {
    case "ADDITIONAL_ORDER":
      return {
        title: `Pesanan tambahan #${seq || 1}`,
        tone: "warning",
      };
    case "REPRINT":
      return {
        title: "Salinan (reprint)",
        tone: "info",
      };
    case "CANCELLATION":
      return {
        title: "Pembatalan pesanan",
        tone: "destructive",
      };
    case "NEW_ORDER":
    default:
      return {
        title: "Nota pesanan dapur",
        tone: "neutral",
      };
  }
}
