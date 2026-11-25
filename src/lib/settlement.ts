import { OrderRecord } from "@/types/order";
import {
  allocateCategoryDiscounts,
  allocateCategoryTaxAndService,
  allocateIntegerProRata,
  getOrderTaxBreakdown,
  isCoworkingOrderItem,
  normalizeTenantId,
} from "@/lib/tax-breakdown";
import { INITIAL_PRODUCTS } from "@/lib/master-data-defaults";
import {
  getStoredSettlementReceiptPolicy,
  saveStoredSettlementReceiptPolicy,
  syncSettlementReceiptPolicyToServer,
  type SettlementBasisMode,
} from "@/lib/settlement-receipt-policy";
import {
  tenantsSyncClient,
  tenantsStorageMirror,
  applyTenantsCommand,
  mutateConfigDomain,
} from "@/lib/sync-domains/config-spec";
import type { TenantsDomainState } from "@/lib/domain-sync-types";
import { getTenantProfile } from "@/lib/tenant";

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
  const syncedSplits = tenantsSyncClient.getSnapshot().revenueSplits;
  if (syncedSplits && Object.keys(syncedSplits).length > 0) {
    return { ...DEFAULT_TENANT_REVENUE_SPLITS, ...syncedSplits };
  }
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

  const all = getAllTenantRevenueSplits();
  const existing = all[tenantId] || { tenantId, tenantName: tenantId, status: "ACTIVE" };
  const updatedEntry: TenantRevenueSplitConfig = {
    ...existing,
    tenantId,
    tenantSharePercent,
    dagoSharePercent: calcDago,
    updatedAt: new Date().toISOString(),
  };

  try {
    const command = {
      op: "SET_REVENUE_SPLIT" as const,
      tenantId,
      split: updatedEntry,
    };
    mutateConfigDomain(
      tenantsSyncClient,
      tenantsStorageMirror,
      (prev: TenantsDomainState) => applyTenantsCommand(prev, command),
      {
        id: `tenant-split-${tenantId}`,
        command,
      }
    );
  } catch (e) {
    console.warn("Could not mutate tenantsSyncClient for revenue split", e);
  }

  if (typeof window === "undefined") return { success: true };

  try {
    all[tenantId] = updatedEntry;
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
  item: {
    tenantId?: string;
    productId?: string;
    productName?: string;
    itemType?: string;
    category?: string;
    coworkingMeta?: unknown;
    id?: string;
    name?: string;
  },
  orderFallbackTenantId?: string
): string {
  if (isCoworkingOrderItem(item)) {
    return "DAGO_HUB";
  }

  if (item.tenantId && item.tenantId.trim()) {
    return normalizeTenantId(item.tenantId) ?? item.tenantId.trim();
  }

  if (item.productId) {
    const productById = INITIAL_PRODUCTS.find((p) => p.id === item.productId);
    if (productById?.tenantId) {
      return productById.tenantId;
    }
  }

  const rawName = item.productName || item.name;
  if (rawName) {
    const cleanName = rawName.trim().toLowerCase();

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
    return normalizeTenantId(orderFallbackTenantId) ?? orderFallbackTenantId.trim();
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
  options?: { settlementBasis?: SettlementBasisMode; includeInternal?: boolean }
): SettlementSummary[] {
  const settlementMap = new Map<string, SettlementSummary>();
  const activeSplits = customSplits || getAllTenantRevenueSplits();
  const basis: SettlementBasisMode =
    options?.settlementBasis ?? getStoredSettlementReceiptPolicy().settlementBasis;

  orders.forEach((order) => {
    if (order.paymentStatus === "PAID" && order.status !== "CANCELLED") {
      let orderValidGross = 0;
      const tenantGrosses = new Map<
        string,
        {
          gross: number;
          qty: number;
          explicitCoworkingGross: number;
          implicitDagoGross: number;
          fnbGross: number;
        }
      >();

      order.items.forEach((item) => {
        const qty = typeof item.quantity === "number" ? item.quantity : Number(item.quantity);
        const price = typeof item.unitPrice === "number" ? item.unitPrice : Number(item.unitPrice);

        if (isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) {
          return;
        }

        const ownerId = resolveItemTenantId(item, getOrderFallbackTenantId(order));
        const itemGross = qty * price;

        orderValidGross += itemGross;

        const current = tenantGrosses.get(ownerId) || {
          gross: 0,
          qty: 0,
          explicitCoworkingGross: 0,
          implicitDagoGross: 0,
          fnbGross: 0,
        };
        const rawTenantLower = (item.tenantId || "").trim().toLowerCase();
        const isCw = isCoworkingOrderItem(item);
        const isExplicitCw =
          item.itemType === "COWORKING" ||
          Boolean(item.coworkingMeta) ||
          /^co-?working$/i.test((item.category || "").trim()) ||
          rawTenantLower === "tenant-cowork" ||
          rawTenantLower === "dago-cowork" ||
          (isCw && !rawTenantLower);
        tenantGrosses.set(ownerId, {
          gross: current.gross + itemGross,
          qty: current.qty + qty,
          explicitCoworkingGross: current.explicitCoworkingGross + (isExplicitCw ? itemGross : 0),
          implicitDagoGross:
            current.implicitDagoGross + (!isExplicitCw && isCw ? itemGross : 0),
          fnbGross: current.fnbGross + (!isCw ? itemGross : 0),
        });
      });

      const breakdown = getOrderTaxBreakdown(order);
      const computedDiscount = breakdown.discount;

      const totalExplicitFnbGross = Array.from(tenantGrosses.values()).reduce(
        (sum, d) => sum + d.fnbGross,
        0
      );
      const totalImplicitDagoGross = Array.from(tenantGrosses.values()).reduce(
        (sum, d) => sum + d.implicitDagoGross,
        0
      );

      let treatImplicitDagoAsTaxedFnb = false;
      if (totalExplicitFnbGross > 0 && totalImplicitDagoGross > 0 && orderValidGross > 0) {
        const otherDpp = Math.max(
          0,
          totalExplicitFnbGross - computedDiscount * (totalExplicitFnbGross / orderValidGross)
        );
        const taxRate = (order.taxRatePercent ?? 10) / 100;
        const servRate =
          order.orderType === "TAKEAWAY" ? 0 : (order.serviceChargePercent ?? 5) / 100;
        treatImplicitDagoAsTaxedFnb =
          breakdown.pb1 > Math.round(otherDpp * taxRate) + 1 ||
          (servRate > 0 && breakdown.serviceCharge > Math.round(otherDpp * servRate) + 1);
      }

      const allocationBuckets: Array<{
        tenantId: string;
        isCoworking: boolean;
        subtotal: number;
      }> = [];

      tenantGrosses.forEach((data, tenantId) => {
        const cwSub =
          data.explicitCoworkingGross +
          (treatImplicitDagoAsTaxedFnb ? 0 : data.implicitDagoGross);
        const fnbSub =
          data.fnbGross + (treatImplicitDagoAsTaxedFnb ? data.implicitDagoGross : 0);
        if (cwSub > 0) {
          allocationBuckets.push({ tenantId, isCoworking: true, subtotal: cwSub });
        }
        if (fnbSub > 0) {
          allocationBuckets.push({ tenantId, isCoworking: false, subtotal: fnbSub });
        }
      });

      const explicitTaxSplit =
        order.fnbTax !== undefined || order.coworkingTax !== undefined
          ? { fnbTax: order.fnbTax, coworkingTax: order.coworkingTax }
          : undefined;
      const allocatedTaxes = allocateCategoryTaxAndService(
        allocationBuckets,
        breakdown.pb1,
        breakdown.serviceCharge,
        explicitTaxSplit
      );
      const taxByTenant = new Map<string, { tax: number; serviceCharge: number }>();
      allocationBuckets.forEach((bucket, idx) => {
        const prev = taxByTenant.get(bucket.tenantId) || { tax: 0, serviceCharge: 0 };
        const alloc = allocatedTaxes[idx] || { tax: 0, serviceCharge: 0 };
        taxByTenant.set(bucket.tenantId, {
          tax: prev.tax + alloc.tax,
          serviceCharge: prev.serviceCharge + alloc.serviceCharge,
        });
      });

      const explicitDiscountSplit =
        order.fnbDiscount !== undefined || order.coworkingDiscount !== undefined
          ? { fnbDiscount: order.fnbDiscount, coworkingDiscount: order.coworkingDiscount }
          : undefined;
      const allocatedBucketDiscounts = allocateCategoryDiscounts(
        allocationBuckets,
        computedDiscount,
        explicitDiscountSplit
      );
      const discountByTenant = new Map<string, number>();
      allocationBuckets.forEach((bucket, idx) => {
        discountByTenant.set(
          bucket.tenantId,
          (discountByTenant.get(bucket.tenantId) || 0) + (allocatedBucketDiscounts[idx] ?? 0)
        );
      });

      const tenantEntries = Array.from(tenantGrosses.entries());

      tenantEntries.forEach(([tenantId, data]) => {
        // Requirement S-38: Mitra internal dilewati saat settlement tetapi tetap muncul di laporan penjualan
        if (tenantId !== "DAGO_HUB") {
          try {
            const profile = getTenantProfile(tenantId);
            if (profile?.partnerType === "INTERNAL" && !options?.includeInternal) {
              return;
            }
          } catch {}
        }

        const allocatedDiscount = discountByTenant.get(tenantId) ?? 0;
        const allocated = taxByTenant.get(tenantId) || { tax: 0, serviceCharge: 0 };
        const allocatedTax = allocated.tax;
        const allocatedServiceCharge = allocated.serviceCharge;
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
  discount?: number;
  dpp?: number;
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

  const targetTenantId = normalizeTenantId(tenantId) ?? tenantId;
  const isDagoHub = targetTenantId === "DAGO_HUB";
  const configuredSplit = getTenantRevenueSplit(targetTenantId);
  const commissionPercent = isDagoHub
    ? 100
    : customCommissionPercent !== undefined
    ? customCommissionPercent
    : configuredSplit.dagoSharePercent;
  const tenantSharePercent = isDagoHub ? 0 : 100 - commissionPercent;

  let grossSales = 0;
  let totalDiscount = 0;
  let totalDpp = 0;
  let qrisDpp = 0;
  let orderCount = 0;

  tenantOrders.forEach((order) => {
    let tenantGross = 0;
    let hasTenantItem = false;
    const fallbackTenantId = getOrderFallbackTenantId(order);

    const itemBuckets = order.items.map((item) => {
      const itemGross = Math.max(0, (item.unitPrice || 0) * (item.quantity || 1));
      const resolvedTenant =
        normalizeTenantId(resolveItemTenantId(item, fallbackTenantId)) ??
        resolveItemTenantId(item, fallbackTenantId);
      const isMatch = resolvedTenant === targetTenantId;
      if (isMatch) {
        hasTenantItem = true;
        tenantGross += itemGross;
      }
      return {
        isCoworking: isCoworkingOrderItem(item),
        subtotal: itemGross,
        isMatch,
      };
    });

    if (hasTenantItem) {
      orderCount++;
      grossSales += tenantGross;
      const breakdown = getOrderTaxBreakdown(order);
      const explicitDiscountSplit =
        order.fnbDiscount !== undefined || order.coworkingDiscount !== undefined
          ? { fnbDiscount: order.fnbDiscount, coworkingDiscount: order.coworkingDiscount }
          : undefined;
      const itemDiscounts = allocateCategoryDiscounts(
        itemBuckets,
        breakdown.discount,
        explicitDiscountSplit
      );
      const allocatedDiscount = itemBuckets.reduce(
        (sum, bucket, idx) => sum + (bucket.isMatch ? itemDiscounts[idx] ?? 0 : 0),
        0
      );
      const tenantDpp = Math.max(0, tenantGross - allocatedDiscount);
      totalDiscount += allocatedDiscount;
      totalDpp += tenantDpp;
      const method = (order.paymentMethod || "").toUpperCase();
      if (method === "QRIS") {
        qrisDpp += tenantDpp;
      } else if (
        method === "SPLIT" &&
        Array.isArray(order.splitDetails) &&
        order.splitDetails.length > 0
      ) {
        const weights = order.splitDetails.map((s) => Math.max(0, Number(s.amount) || 0));
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        if (totalWeight > 0) {
          const allocatedBySplit = allocateIntegerProRata(Math.round(tenantDpp), weights);
          order.splitDetails.forEach((s, idx) => {
            if ((s.method || "").toUpperCase() === "QRIS") {
              qrisDpp += allocatedBySplit[idx] ?? 0;
            }
          });
        }
      }
    }
  });

  const roundedGross = Math.round(grossSales);
  const roundedDiscount = Math.round(totalDiscount);
  const roundedDpp = Math.round(totalDpp);
  const platformFee = Math.round(roundedDpp * (commissionPercent / 100));
  const qrisMdr = isDagoHub ? 0 : Math.round(qrisDpp * 0.007);
  const netPayout = isDagoHub ? 0 : roundedDpp - platformFee - qrisMdr;

  return {
    tenantId,
    tenantName,
    grossSales: roundedGross,
    discount: roundedDiscount,
    dpp: roundedDpp,
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
