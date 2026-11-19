import { OrderRecord } from "@/types/order";
import { getOrderTaxBreakdown } from "@/lib/tax-breakdown";
import { INITIAL_PRODUCTS } from "@/lib/master-data-defaults";
import {
  getStoredSettlementReceiptPolicy,
  saveStoredSettlementReceiptPolicy,
  syncSettlementReceiptPolicyToServer,
  type SettlementBasisMode,
} from "@/lib/settlement-receipt-policy";

export interface SettlementSummary {
  tenantId: string | "DAGO_HUB";
  tenantName: string;
  grossRevenue: number;
  discount: number;
  dpp?: number;
  netSales?: number;
  tax: number;
  serviceCharge: number;
  paymentFee: number;
  netRevenue: number;
  transactionCount: number;
  itemCount: number;
  settlementBasis?: SettlementBasisMode;
  settlementBasisAmount?: number;
  tenantSharePercent?: number;
  dagoSharePercent?: number;
  tenantShareAmount?: number;
  dagoShareAmount?: number;
}

export const REVENUE_SPLIT_STORAGE_KEY = "dagoeng_tenant_revenue_splits_v1";

export interface TenantRevenueSplitConfig {
  tenantId: string;
  tenantName: string;
  tenantSharePercent: number;
  dagoSharePercent: number;
  status: "ACTIVE" | "INACTIVE";
  updatedAt?: string;
}

export const DEFAULT_TENANT_REVENUE_SPLITS: Record<string, TenantRevenueSplitConfig> = {
  "tenant-ks": { tenantId: "tenant-ks", tenantName: "Kopi Senja", tenantSharePercent: 85, dagoSharePercent: 15, status: "ACTIVE" },
  "tenant-kitchen": { tenantId: "tenant-kitchen", tenantName: "Dapur Mama", tenantSharePercent: 85, dagoSharePercent: 15, status: "ACTIVE" },
  "tenant-bakery": { tenantId: "tenant-bakery", tenantName: "Manis Bakery", tenantSharePercent: 85, dagoSharePercent: 15, status: "ACTIVE" },
  "tenant-tea": { tenantId: "tenant-tea", tenantName: "Warung Bu Narti", tenantSharePercent: 85, dagoSharePercent: 15, status: "ACTIVE" },
};

export function getAllTenantRevenueSplits(): Record<string, TenantRevenueSplitConfig> {
  if (typeof window === "undefined") return DEFAULT_TENANT_REVENUE_SPLITS;
  try {
    const raw = window.localStorage?.getItem(REVENUE_SPLIT_STORAGE_KEY) ?? null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { ...DEFAULT_TENANT_REVENUE_SPLITS, ...parsed };
      }
    }
    const policySplits = getStoredSettlementReceiptPolicy().revenueSplits;
    if (policySplits && typeof policySplits === "object") {
      return { ...DEFAULT_TENANT_REVENUE_SPLITS, ...policySplits };
    }
  } catch (e) {
    console.error("Failed to read revenue splits from localStorage", e);
  }
  return DEFAULT_TENANT_REVENUE_SPLITS;
}

export function getTenantRevenueSplit(tenantId: string): TenantRevenueSplitConfig {
  const all = getAllTenantRevenueSplits();
  if (all[tenantId]) return all[tenantId];
  return {
    tenantId,
    tenantName: tenantId,
    tenantSharePercent: 85,
    dagoSharePercent: 15,
    status: "ACTIVE",
  };
}

export function setTenantRevenueSplit(
  tenantId: string,
  tenantSharePercent: number,
  dagoSharePercent?: number
): { success: boolean; error?: string } {
  if (tenantSharePercent < 0 || tenantSharePercent > 100) {
    return { success: false, error: "Persentase bagian tenant harus antara 0% hingga 100%." };
  }
  const calcDago = dagoSharePercent !== undefined ? dagoSharePercent : 100 - tenantSharePercent;
  if (calcDago < 0 || calcDago > 100) {
    return { success: false, error: "Persentase bagian DAGO harus antara 0% hingga 100%." };
  }
  if (Math.round(tenantSharePercent + calcDago) !== 100) {
    return { success: false, error: "Total persentase pembagian (Tenant + DAGO) harus berjumlah 100%." };
  }

  if (typeof window === "undefined") return { success: true };

  try {
    const all = getAllTenantRevenueSplits();
    const existing = all[tenantId] || { tenantId, tenantName: tenantId, status: "ACTIVE" };
    all[tenantId] = {
      ...existing,
      tenantId,
      tenantSharePercent,
      dagoSharePercent: calcDago,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage?.setItem(REVENUE_SPLIT_STORAGE_KEY, JSON.stringify(all));
    const nextPolicy = saveStoredSettlementReceiptPolicy({ revenueSplits: all });
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "test") {
      syncSettlementReceiptPolicyToServer(nextPolicy);
    }
    return { success: true };
  } catch (e) {
    console.error("Failed to save tenant revenue split", e);
    return { success: false, error: "Gagal menyimpan konfigurasi ke localStorage." };
  }
}

function getOrderFallbackTenantId(
  order: OrderRecord & { tenantId?: unknown }
): string | undefined {
  return typeof order.tenantId === "string" ? order.tenantId : undefined;
}

export function resolveItemTenantId(
  item: { tenantId?: string; productId?: string; productName?: string },
  orderFallbackTenantId?: string
): string {
  if (item.tenantId && item.tenantId.trim()) {
    return item.tenantId.trim();
  }

  if (item.productId) {
    const productById = INITIAL_PRODUCTS.find((p) => p.id === item.productId);
    if (productById?.tenantId) {
      return productById.tenantId;
    }
  }

  if (item.productName) {
    const cleanName = item.productName.trim().toLowerCase();

    const productByExactName = INITIAL_PRODUCTS.find(
      (p) => p.name.trim().toLowerCase() === cleanName
    );
    if (productByExactName?.tenantId) {
      return productByExactName.tenantId;
    }

    const productBySubstring = INITIAL_PRODUCTS.find(
      (p) =>
        p.name.toLowerCase().includes(cleanName) ||
        cleanName.includes(p.name.toLowerCase())
    );
    if (productBySubstring?.tenantId) {
      return productBySubstring.tenantId;
    }

    if (/kopi|coffee|espresso|americano|matcha|latte|cappuccino|fries/i.test(cleanName)) {
      return "tenant-ks";
    }
    if (/beef|nasi|goreng|mie|ayam|kitchen|sambal|sate|tahu|bakso|bowl/i.test(cleanName)) {
      return "tenant-kitchen";
    }
    if (/croissant|bakery|roti|bread|pastry|cinnamon|sourdough|chocolat/i.test(cleanName)) {
      return "tenant-bakery";
    }
    if (/teh|tea|jamu|pisang|narti|warung/i.test(cleanName)) {
      return "tenant-tea";
    }
  }

  if (orderFallbackTenantId && orderFallbackTenantId.trim()) {
    return orderFallbackTenantId.trim();
  }

  if (item.tenantId && item.tenantId.trim()) {
    return item.tenantId.trim();
  }

  return "DAGO_HUB";
}

function resolveSettlementBasisAmount(
  basis: SettlementBasisMode,
  amounts: { dpp: number; gross: number; totalWithTax: number }
): number {
  switch (basis) {
    case "RECEIPT_NET_BEFORE_TAX":
      return amounts.dpp;
    case "RECEIPT_GROSS_SUBTOTAL":
      return amounts.gross;
    case "RECEIPT_TOTAL_WITH_TAX":
      return amounts.totalWithTax;
    default: {
      const _exhaustive: never = basis;
      return _exhaustive;
    }
  }
}

export function calculateSettlement(
  orders: OrderRecord[],
  tenantMap?: Record<string, string>,
  customSplits?: Record<string, { tenantSharePercent: number; dagoSharePercent: number }>,
  options?: { settlementBasis?: SettlementBasisMode }
): SettlementSummary[] {
  const settlementMap = new Map<string, SettlementSummary>();
  const activeSplits = customSplits || getAllTenantRevenueSplits();
  const basis: SettlementBasisMode =
    options?.settlementBasis ?? getStoredSettlementReceiptPolicy().settlementBasis;

  orders.forEach((order) => {
    if (order.paymentStatus === "PAID" && order.status !== "CANCELLED") {
      let orderValidGross = 0;
      const tenantGrosses = new Map<string, { gross: number; qty: number }>();

      order.items.forEach((item) => {
        const qty = typeof item.quantity === "number" ? item.quantity : Number(item.quantity);
        const price = typeof item.unitPrice === "number" ? item.unitPrice : Number(item.unitPrice);

        if (isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) {
          return;
        }

        const ownerId = resolveItemTenantId(item, getOrderFallbackTenantId(order));
        const itemGross = qty * price;

        orderValidGross += itemGross;

        const current = tenantGrosses.get(ownerId) || { gross: 0, qty: 0 };
        tenantGrosses.set(ownerId, {
          gross: current.gross + itemGross,
          qty: current.qty + qty,
        });
      });

      const breakdown = getOrderTaxBreakdown(order);
      const computedDiscount = breakdown.discount;

      tenantGrosses.forEach((data, tenantId) => {
        const ratio = orderValidGross > 0 ? data.gross / orderValidGross : 0;

        const allocatedDiscount = computedDiscount * ratio;
        const allocatedTax = breakdown.pb1 * ratio;
        const allocatedServiceCharge = breakdown.serviceCharge * ratio;
        const tenantDpp = Math.max(0, data.gross - allocatedDiscount);

        const netRevenue =
          data.gross - allocatedDiscount + allocatedTax + allocatedServiceCharge;

        const basisAmount = resolveSettlementBasisAmount(basis, {
          dpp: tenantDpp,
          gross: data.gross,
          totalWithTax: netRevenue,
        });

        const defaultTenantNames: Record<string, string> = {
          "tenant-ks": "Kopi Senja",
          "tenant-kitchen": "Dapur Mama",
          "tenant-bakery": "Manis Bakery",
          "tenant-tea": "Warung Bu Narti",
          DAGO_HUB: "Dago Hub",
        };

        const splitConfig = activeSplits[tenantId] || { tenantSharePercent: 85, dagoSharePercent: 15 };
        const tenantSharePct = tenantId === "DAGO_HUB" ? 0 : splitConfig.tenantSharePercent;
        const dagoSharePct = tenantId === "DAGO_HUB" ? 100 : splitConfig.dagoSharePercent;

        const current = settlementMap.get(tenantId) || {
          tenantId,
          tenantName:
            tenantMap?.[tenantId] ||
            defaultTenantNames[tenantId] ||
            (tenantId === "DAGO_HUB" ? "Dago Hub" : tenantId),
          grossRevenue: 0,
          discount: 0,
          dpp: 0,
          tax: 0,
          serviceCharge: 0,
          paymentFee: 0,
          netRevenue: 0,
          transactionCount: 0,
          itemCount: 0,
          settlementBasis: basis,
          settlementBasisAmount: 0,
          tenantSharePercent: tenantSharePct,
          dagoSharePercent: dagoSharePct,
          tenantShareAmount: 0,
          dagoShareAmount: 0,
        };

        const addedTenantShare = Math.round(basisAmount * (tenantSharePct / 100));
        const addedDagoShare = basisAmount - addedTenantShare;

        settlementMap.set(tenantId, {
          ...current,
          grossRevenue: current.grossRevenue + data.gross,
          discount: current.discount + allocatedDiscount,
          dpp: (current.dpp || 0) + tenantDpp,
          netSales: (current.netSales || 0) + tenantDpp,
          tax: current.tax + allocatedTax,
          serviceCharge: current.serviceCharge + allocatedServiceCharge,
          netRevenue: current.netRevenue + netRevenue,
          itemCount: current.itemCount + data.qty,
          transactionCount: current.transactionCount + 1,
          settlementBasis: basis,
          settlementBasisAmount: (current.settlementBasisAmount || 0) + basisAmount,
          tenantShareAmount: (current.tenantShareAmount || 0) + addedTenantShare,
          dagoShareAmount: (current.dagoShareAmount || 0) + addedDagoShare,
        });
      });
    }
  });

  const result: SettlementSummary[] = Array.from(settlementMap.values());

  result.forEach((r) => {
    r.grossRevenue = Math.round(r.grossRevenue);
    r.discount = Math.round(r.discount);
    if (r.dpp !== undefined) r.dpp = Math.round(r.dpp);
    if (r.netSales !== undefined) r.netSales = Math.round(r.netSales);
    r.tax = Math.round(r.tax);
    r.serviceCharge = Math.round(r.serviceCharge);
    r.netRevenue = Math.round(r.netRevenue);
    if (r.settlementBasisAmount !== undefined) {
      r.settlementBasisAmount = Math.round(r.settlementBasisAmount);
    }
    if (r.tenantShareAmount !== undefined) r.tenantShareAmount = Math.round(r.tenantShareAmount);
    if (r.dagoShareAmount !== undefined) r.dagoShareAmount = Math.round(r.dagoShareAmount);
  });

  return result.sort((a, b) => b.netRevenue - a.netRevenue);
}

export interface TenantProfitSharing {
  tenantId: string;
  tenantName: string;
  grossSales: number;
  platformFee: number;
  qrisMdr: number;
  netPayout: number;
  orderCount: number;
  commissionPercent: number;
  tenantSharePercent: number;
}

export function calculateTenantProfitSharing(
  orders: OrderRecord[],
  tenantId: string,
  tenantName: string,
  customCommissionPercent?: number
): TenantProfitSharing {
  const tenantOrders = orders.filter(
    (o) => o.paymentStatus === "PAID" && o.status !== "CANCELLED"
  );

  const configuredSplit = getTenantRevenueSplit(tenantId);
  const commissionPercent =
    customCommissionPercent !== undefined ? customCommissionPercent : configuredSplit.dagoSharePercent;
  const tenantSharePercent = 100 - commissionPercent;

  let grossSales = 0;
  let orderCount = 0;

  tenantOrders.forEach((order) => {
    let hasTenantItem = false;
    order.items.forEach((item) => {
      const resolvedTenant = resolveItemTenantId(item, getOrderFallbackTenantId(order));
      if (resolvedTenant === tenantId) {
        hasTenantItem = true;
        grossSales += (item.unitPrice || 0) * (item.quantity || 1);
      }
    });
    if (hasTenantItem) orderCount++;
  });

  const platformFee = Math.round(grossSales * (commissionPercent / 100));
  const qrisMdr = Math.round(grossSales * 0.007);
  const netPayout = grossSales - platformFee - qrisMdr;

  return {
    tenantId,
    tenantName,
    grossSales,
    platformFee,
    qrisMdr,
    netPayout,
    orderCount,
    commissionPercent,
    tenantSharePercent,
  };
}

export interface TenantPayoutAccount {
  tenantId: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isConfigured: boolean;
}

export function maskAccountNumber(accountNumber: string): string {
  const clean = (accountNumber || "").replace(/\s+/g, "");
  if (!clean) return "-";
  if (clean.length <= 4) return clean;
  const last4 = clean.slice(-4);
  return `•••• •••• ${last4}`;
}

export const DEFAULT_TENANT_PAYOUT_ACCOUNTS: Record<
  string,
  { bankName: string; accountNumber: string; accountHolder: string }
> = {
  "tenant-ks": { bankName: "BCA", accountNumber: "8830192841", accountHolder: "Kopi Senja Utama" },
  "tenant-kitchen": { bankName: "Mandiri", accountNumber: "1420019283741", accountHolder: "Dapur Mama Kuliner" },
  "tenant-bakery": { bankName: "BCA", accountNumber: "7720194821", accountHolder: "Manis Bakery Artisan" },
  "tenant-tea": { bankName: "BRI", accountNumber: "002101928374501", accountHolder: "Warung Bu Narti" },
};

export function getTenantPayoutAccount(
  tenantId: string,
  customMap?: Record<string, { bankName?: string; bankAccountNumber?: string; bankAccountHolder?: string }>
): TenantPayoutAccount {
  if (customMap && customMap[tenantId]?.bankAccountNumber) {
    const item = customMap[tenantId];
    return {
      tenantId,
      bankName: item.bankName || "BCA",
      accountNumber: item.bankAccountNumber || "-",
      accountHolder: item.bankAccountHolder || "-",
      isConfigured: true,
    };
  }

  const def = DEFAULT_TENANT_PAYOUT_ACCOUNTS[tenantId];
  if (def) {
    return {
      tenantId,
      bankName: def.bankName,
      accountNumber: def.accountNumber,
      accountHolder: def.accountHolder,
      isConfigured: true,
    };
  }

  return {
    tenantId,
    bankName: "BCA",
    accountNumber: "-",
    accountHolder: "-",
    isConfigured: false,
  };
}
