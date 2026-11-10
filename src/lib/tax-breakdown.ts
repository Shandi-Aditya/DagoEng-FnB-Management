import { OrderRecord } from "@/types/order";
import { ShiftRecord } from "@/types/shift";
import { extractShiftStartTimeMs } from "@/lib/shift-management";
import { hmacSha256Hex } from "@/lib/edge-session";

export interface OrderTaxBreakdown {
  subtotal: number;
  discount: number;
  dpp: number;
  pb1: number;
  serviceCharge: number;
  totalTaxAndService: number;
  total: number;
}

export interface CartTaxCalculationInput {
  subtotal: number;
  discount?: number;
  taxRatePercent?: number;
  serviceChargePercent?: number;
  isTaxEnabled?: boolean;
  orderType?: "DINE_IN" | "TAKEAWAY";
}

export interface CartTaxCalculationResult {
  subtotal: number;
  discount: number;
  dpp: number;
  pb1: number;
  serviceCharge: number;
  totalTaxAndService: number;
  total: number;
}

/**
 * Centralized calculation helper for live POS carts, bill modals, and checkout previews (POS-11, POS-27 / B2).
 * Guarantees that cart calculations align down to the rupiah with stored order records and reports.
 */
export function calculateCartTaxAndService(input: CartTaxCalculationInput): CartTaxCalculationResult {
  const subtotal = Math.max(0, Math.round(input.subtotal || 0));
  const discount = Math.max(0, Math.min(subtotal, Math.round(input.discount ?? 0)));
  const dpp = Math.max(0, subtotal - discount);

  const isTaxEnabled = input.isTaxEnabled !== false;
  const taxRate = isTaxEnabled ? (Number(input.taxRatePercent) || 0) / 100 : 0;
  const serviceRate =
    input.orderType === "TAKEAWAY" ? 0 : (Number(input.serviceChargePercent) || 0) / 100;

  const pb1 = Math.round(dpp * taxRate);
  const serviceCharge = Math.round(dpp * serviceRate);
  const totalTaxAndService = pb1 + serviceCharge;
  const total = dpp + totalTaxAndService;

  return {
    subtotal,
    discount,
    dpp,
    pb1,
    serviceCharge,
    totalTaxAndService,
    total,
  };
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

/**
 * R10: Filters orders strictly to the given shift's outlet and [startTime, endTime/closedAt] window
 * before aggregating revenue, discounts, PB1 tax, and service charge.
 */
export function aggregateShiftOrdersTaxAndRevenue(
  orders: OrderRecord[],
  shift?: Partial<ShiftRecord> | null
): AggregatedTaxReport {
  if (!shift) {
    return aggregateOrdersTaxAndRevenue(orders);
  }

  const startMs =
    extractShiftStartTimeMs(shift as ShiftRecord) ||
    (shift.startTime ? Date.parse(shift.startTime) : 0);

  const rawEnd = shift.closedAt || shift.endTime;
  const parsedEndMs = rawEnd ? Date.parse(rawEnd) : NaN;
  const endMs = !isNaN(parsedEndMs) && parsedEndMs > 0 ? parsedEndMs : Infinity;

  const scopedOrders = orders.filter((order) => {
    if (shift.outletId && shift.outletId !== "ALL" && order.outletId && order.outletId !== shift.outletId) {
      return false;
    }

    if (startMs > 0 && order.createdAt) {
      const orderMs = Date.parse(order.createdAt);
      if (!isNaN(orderMs)) {
        if (orderMs < startMs || orderMs > endMs) {
          return false;
        }
      }
    }

    return true;
  });

  return aggregateOrdersTaxAndRevenue(scopedOrders);
}

/**
 * R10: Computes a deterministic SHA-256 verification hash from the shift and closing tax aggregation.
 */
export function computeClosingVerificationHash(
  shift?: Partial<ShiftRecord> | null,
  agg?: AggregatedTaxReport
): string {
  const payload = [
    shift?.id || "no-shift",
    shift?.outletId || "outlet-sgr",
    Math.round(shift?.openingCash || 0),
    Math.round(shift?.cashSales || 0),
    Math.round(shift?.nonCashSales || 0),
    Math.round(agg?.totalRevenue || 0),
    Math.round(agg?.totalTaxPB1 || 0),
    Math.round(agg?.totalServiceCharge || 0),
    agg?.orderCount || 0,
  ].join(":");
  const digest = hmacSha256Hex("dagoeng-closing-report-v1", payload);
  return `SHA256-${digest.slice(0, 16).toUpperCase()}`;
}
