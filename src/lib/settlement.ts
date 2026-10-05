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
}

export function calculateSettlement(
  orders: OrderRecord[],
  tenantMap?: Record<string, string>
): SettlementSummary[] {
  const settlementMap = new Map<string, SettlementSummary>();

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
          qty: current.qty + qty
        });
      });

      // Step 2: Allocate order level discount and tax based on prorata
      // We assume order.subtotal is the gross, and order.total = subtotal - discount + tax
      // Therefore, discount = order.subtotal + order.tax - order.total
      // If order.subtotal is somehow completely different, fallback safely.
      const computedDiscount = Math.max(0, order.subtotal + order.tax - order.total);
      
      tenantGrosses.forEach((data, tenantId) => {
        const ratio = orderValidGross > 0 ? data.gross / orderValidGross : 0;
        
        const allocatedDiscount = computedDiscount * ratio;
        const allocatedTax = order.tax * ratio;
        const allocatedServiceCharge = 0; // Existing tax in POS already includes service charge inside order.tax
        const allocatedPaymentFee = 0; // Not available yet
        
        const netRevenue = data.gross - allocatedDiscount + allocatedTax;
        
        const defaultTenantNames: Record<string, string> = {
          "tenant-ks": "Kopi Senja",
          "tenant-kitchen": "Dapur Mama",
          "tenant-bakery": "Manis Bakery",
          "tenant-tea": "Warung Bu Narti",
          "DAGO_HUB": "Dago Hub",
        };

        const current = settlementMap.get(tenantId) || {
          tenantId,
          tenantName: tenantMap?.[tenantId] || defaultTenantNames[tenantId] || (tenantId === "DAGO_HUB" ? "Dago Hub" : tenantId),
          grossRevenue: 0,
          discount: 0,
          tax: 0,
          serviceCharge: 0,
          paymentFee: 0,
          netRevenue: 0,
          transactionCount: 0,
          itemCount: 0,
        };
        
        settlementMap.set(tenantId, {
          ...current,
          grossRevenue: current.grossRevenue + data.gross,
          discount: current.discount + allocatedDiscount,
          tax: current.tax + allocatedTax,
          netRevenue: current.netRevenue + netRevenue,
          itemCount: current.itemCount + data.qty,
          transactionCount: current.transactionCount + 1,
        });
      });
    }
  });

  const result: SettlementSummary[] = Array.from(settlementMap.values());

  // Handle rounding to avoid floating point errors
  result.forEach(r => {
    r.grossRevenue = Math.round(r.grossRevenue);
    r.discount = Math.round(r.discount);
    r.tax = Math.round(r.tax);
    r.netRevenue = Math.round(r.netRevenue);
  });

  // Sort descending by netRevenue
  return result.sort((a, b) => b.netRevenue - a.netRevenue);
}

export interface TenantProfitSharing {
  tenantId: string;
  tenantName: string;
  grossSales: number;
  platformFee: number; // 15% DAGO Platform Fee
  qrisMdr: number;     // 0.7% Bank Indonesia QRIS MDR
  netPayout: number;   // 84.3% Net Payout
  orderCount: number;
}

/**
 * Calculates profit-sharing breakdown for a tenant (Gross - 15% Platform Fee - 0.7% QRIS MDR)
 */
export function calculateTenantProfitSharing(
  orders: OrderRecord[],
  tenantId: string,
  tenantName: string,
  commissionPercent: number = 15.0
): TenantProfitSharing {
  const tenantOrders = orders.filter(
    (o) => o.paymentStatus === "PAID" && o.status !== "CANCELLED"
  );

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

export const DEFAULT_TENANT_PAYOUT_ACCOUNTS: Record<string, { bankName: string; accountNumber: string; accountHolder: string }> = {
  "tenant-ks": { bankName: "BCA", accountNumber: "8830192841", accountHolder: "Kopi Senja Utama" },
  "tenant-kitchen": { bankName: "Mandiri", accountNumber: "1420019283741", accountHolder: "Dapur Mama Kuliner" },
  "tenant-bakery": { bankName: "BCA", accountNumber: "7720194821", accountHolder: "Manis Bakery Artisan" },
  "tenant-tea": { bankName: "BRI", accountNumber: "002101928374501", accountHolder: "Warung Bu Narti" },
};

/**
 * Resolves tenant payout account info with fallback to default demo data.
 */
export function getTenantPayoutAccount(tenantId: string, customMap?: Record<string, any>): TenantPayoutAccount {
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


