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
        
        const current = settlementMap.get(tenantId) || {
          tenantId,
          tenantName: tenantMap?.[tenantId] || (tenantId === "DAGO_HUB" ? "Dago Hub" : tenantId),
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
