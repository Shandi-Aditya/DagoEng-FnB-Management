import { OrderRecord } from "@/types/order";

export interface OrderTaxBreakdown {
  subtotal: number;
  discount: number;
  dpp: number;
  pb1: number;
  serviceCharge: number;
  totalTaxAndService: number;
  total: number;
}

/**
 * Single source of truth for resolving an order's subtotal, discount, DPP, PB1 tax,
 * and service charge across POS receipts, order details, financial reports, closing shift reports,
 * and partner revenue settlement (POS-34 / A3).
 */
export function getOrderTaxBreakdown(order: Partial<OrderRecord>): OrderTaxBreakdown {
  const subtotal = Math.round(order.subtotal ?? 0);
  const rawTax = Math.round(order.tax ?? 0);

  let pb1 = 0;
  let serviceCharge = 0;

  if (order.serviceCharge !== undefined && order.serviceCharge !== null) {
    pb1 = rawTax;
    serviceCharge = Math.round(order.serviceCharge);
  } else {
    // Respect 0% rates via nullish coalescing (??) and never assume service charge on TAKEAWAY.
    const taxRate = (order.taxRatePercent ?? 10) / 100;
    const servRate =
      order.orderType === "TAKEAWAY" ? 0 : (order.serviceChargePercent ?? 0) / 100;
    const combinedRate = taxRate + servRate;

    // Split rawTax only when serviceChargePercent was explicitly configured on a legacy combined-tax order
    if (servRate > 0 && combinedRate > 0) {
      pb1 = Math.round(rawTax * (taxRate / combinedRate));
      serviceCharge = Math.max(0, rawTax - pb1);
    } else {
      pb1 = rawTax;
      serviceCharge = 0;
    }
  }

  const totalTaxAndService = pb1 + serviceCharge;
  const rawTotal =
    order.total !== undefined && order.total !== null
      ? Math.round(order.total)
      : subtotal - Math.round(order.discount ?? 0) + totalTaxAndService;

  const discount =
    order.discount !== undefined && order.discount !== null
      ? Math.max(0, Math.round(order.discount))
      : Math.max(0, subtotal + totalTaxAndService - rawTotal);

  const dpp = Math.max(0, subtotal - discount);

  return {
    subtotal,
    discount,
    dpp,
    pb1,
    serviceCharge,
    totalTaxAndService,
    total: rawTotal,
  };
}

export interface AggregatedTaxReport {
  totalRevenue: number;
  totalSubtotal: number;
  totalDiscounts: number;
  totalDpp: number;
  totalTaxPB1: number;
  totalServiceCharge: number;
  totalTaxAndService: number;
  totalNetSales: number;
  orderCount: number;
}

/**
 * Aggregates stored tax (PB1), service charge, discounts, and revenue from non-cancelled orders
 * without recalculating inclusive/exclusive tax from gross totals (POS-34 / TC-K05).
 */
export function aggregateOrdersTaxAndRevenue(orders: OrderRecord[]): AggregatedTaxReport {
  const validOrders = orders.filter((o) => o.status !== "CANCELLED");

  let totalRevenue = 0;
  let totalSubtotal = 0;
  let totalDiscounts = 0;
  let totalDpp = 0;
  let totalTaxPB1 = 0;
  let totalServiceCharge = 0;

  for (const order of validOrders) {
    const b = getOrderTaxBreakdown(order);
    totalRevenue += b.total;
    totalSubtotal += b.subtotal;
    totalDiscounts += b.discount;
    totalDpp += b.dpp;
    totalTaxPB1 += b.pb1;
    totalServiceCharge += b.serviceCharge;
  }

  const totalTaxAndService = totalTaxPB1 + totalServiceCharge;
  const totalNetSales = Math.max(0, totalRevenue - totalTaxAndService);

  return {
    totalRevenue,
    totalSubtotal,
    totalDiscounts,
    totalDpp,
    totalTaxPB1,
    totalServiceCharge,
    totalTaxAndService,
    totalNetSales,
    orderCount: validOrders.length,
  };
}
