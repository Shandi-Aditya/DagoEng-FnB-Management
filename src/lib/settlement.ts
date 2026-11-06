import { OrderRecord } from "@/types/order";

export interface SettlementSummary {
  tenantId: string | "DAGO_HUB";
  tenantName: string;
  grossRevenue: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  paymentFee: number;
  netRevenue: number;
  transactionCount: number;
  itemCount: number;
  tenantSharePercent?: number; // e.g. 85 or 90
  dagoSharePercent?: number;   // e.g. 15 or 10
  tenantShareAmount?: number;  // e.g. netRevenue * (tenantSharePercent / 100)
  dagoShareAmount?: number;    // e.g. netRevenue * (dagoSharePercent / 100)
}

export const REVENUE_SPLIT_STORAGE_KEY = "dagoeng_tenant_revenue_splits_v1";

export interface TenantRevenueSplitConfig {
  tenantId: string;
  tenantName: string;
  tenantSharePercent: number; // e.g. 85.0
  dagoSharePercent: number;   // e.g. 15.0
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
    const raw = localStorage.getItem(REVENUE_SPLIT_STORAGE_KEY);
    if (!raw) return DEFAULT_TENANT_REVENUE_SPLITS;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return { ...DEFAULT_TENANT_REVENUE_SPLITS, ...parsed };
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
    localStorage.setItem(REVENUE_SPLIT_STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new Event("tenant_revenue_split_updated"));
    return { success: true };
  } catch (e) {
    console.error("Failed to save tenant revenue split", e);
    return { success: false, error: "Gagal menyimpan konfigurasi ke localStorage." };
  }
}

export function calculateSettlement(
  orders: OrderRecord[],
  tenantMap?: Record<string, string>,
  customSplits?: Record<string, { tenantSharePercent: number; dagoSharePercent: number }>
): SettlementSummary[] {
  const settlementMap = new Map<string, SettlementSummary>();
  const activeSplits = customSplits || getAllTenantRevenueSplits();

  orders.forEach((order) => {
    // Only process valid paid non-cancelled orders
    if (order.paymentStatus === "PAID" && order.status !== "CANCELLED") {
      // Step 1: Calculate total valid gross for this order to use as prorata base
      let orderValidGross = 0;
      const tenantGrosses = new Map<string, { gross: number; qty: number }>();

      order.items.forEach((item) => {
        const qty = typeof item.quantity === "number" ? item.quantity : Number(item.quantity);
        const price = typeof item.unitPrice === "number" ? item.unitPrice : Number(item.unitPrice);

        if (isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) {
          return;
        }

        const ownerId = item.tenantId || "DAGO_HUB";
        const itemGross = qty * price;

        orderValidGross += itemGross;

        const current = tenantGrosses.get(ownerId) || { gross: 0, qty: 0 };
        tenantGrosses.set(ownerId, {
          gross: current.gross + itemGross,
          qty: current.qty + qty,
        });
      });

      // Step 2: Allocate order level discount and tax based on prorata
      const computedDiscount = Math.max(0, order.subtotal + order.tax - order.total);

      tenantGrosses.forEach((data, tenantId) => {
        const ratio = orderValidGross > 0 ? data.gross / orderValidGross : 0;

        const allocatedDiscount = computedDiscount * ratio;
        const allocatedTax = order.tax * ratio;
        const allocatedServiceCharge = 0;
        const allocatedPaymentFee = 0;

        const netRevenue = data.gross - allocatedDiscount + allocatedTax;

        const defaultTenantNames: Record<string, string> = {
          "tenant-ks": "Kopi Senja",
          "tenant-kitchen": "Dapur Mama",
          "tenant-bakery": "Manis Bakery",
          "tenant-tea": "Warung Bu Narti",
          DAGO_HUB: "Dago Hub",
        };

        // Determine tenant revenue sharing configuration
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
          tax: 0,
          serviceCharge: 0,
          paymentFee: 0,
          netRevenue: 0,
          transactionCount: 0,
          itemCount: 0,
          tenantSharePercent: tenantSharePct,
          dagoSharePercent: dagoSharePct,
          tenantShareAmount: 0,
          dagoShareAmount: 0,
        };

        const addedTenantShare = Math.round(netRevenue * (tenantSharePct / 100));
        const addedDagoShare = netRevenue - addedTenantShare;

        settlementMap.set(tenantId, {
          ...current,
          grossRevenue: current.grossRevenue + data.gross,
          discount: current.discount + allocatedDiscount,
          tax: current.tax + allocatedTax,
          netRevenue: current.netRevenue + netRevenue,
          itemCount: current.itemCount + data.qty,
          transactionCount: current.transactionCount + 1,
          tenantShareAmount: (current.tenantShareAmount || 0) + addedTenantShare,
          dagoShareAmount: (current.dagoShareAmount || 0) + addedDagoShare,
        });
      });
    }
  });

  const result: SettlementSummary[] = Array.from(settlementMap.values());

  // Handle rounding to avoid floating point errors
  result.forEach((r) => {
    r.grossRevenue = Math.round(r.grossRevenue);
    r.discount = Math.round(r.discount);
    r.tax = Math.round(r.tax);
    r.netRevenue = Math.round(r.netRevenue);
    if (r.tenantShareAmount !== undefined) r.tenantShareAmount = Math.round(r.tenantShareAmount);
    if (r.dagoShareAmount !== undefined) r.dagoShareAmount = Math.round(r.dagoShareAmount);
  });

  // Sort descending by netRevenue
  return result.sort((a, b) => b.netRevenue - a.netRevenue);
}

export interface TenantProfitSharing {
  tenantId: string;
  tenantName: string;
  grossSales: number;
  platformFee: number; // DAGO Platform Fee (Configurable %)
  qrisMdr: number;     // 0.7% Bank Indonesia QRIS MDR
  netPayout: number;   // Net Payout to Tenant
  orderCount: number;
  commissionPercent: number;
  tenantSharePercent: number;
}

/**
 * Calculates profit-sharing breakdown for a tenant based on dynamic configurable commission %
 */
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
      if (item.tenantId === tenantId) {
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

/**
 * Masks account number for secure operational display (e.g. "•••• •••• 7890")
 */
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

/**
 * Resolves tenant payout account info with fallback to default demo data.
 */
export function getTenantPayoutAccount(
  tenantId: string,
  customMap?: Record<string, any>
): TenantPayoutAccount {
  if (customMap && customMap[tenantId]?.bankAccountNumber) {
    const item = customMap[tenantId];
    return {
      tenantId,
      bankName: item.bankName || "BCA",
      accountNumber: item.bankAccountNumber,
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
