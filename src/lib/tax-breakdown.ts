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

export interface CoworkingIdentifiableItem {
  itemType?: string;
  coworkingMeta?: unknown;
  tenantId?: string;
  category?: string;
  productId?: string;
  id?: string;
  productName?: string;
  name?: string;
}

const TENANT_ID_ALIASES: Record<string, string> = {
  "tenant-kopi-senja": "tenant-ks",
  "tenant-dapur-mama": "tenant-kitchen",
  "tenant-manis-bakery": "tenant-bakery",
  "tenant-teh-nusantara": "tenant-tea",
  "tenant-cowork": "DAGO_HUB",
  "dago-cowork": "DAGO_HUB",
  dago: "DAGO_HUB",
  dago_hub: "DAGO_HUB",
};

export function normalizeTenantId(tenantId?: string | null): string | undefined {
  const trimmed = tenantId?.trim();
  if (!trimmed) return undefined;
  return TENANT_ID_ALIASES[trimmed] ?? TENANT_ID_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

export function hasExplicitCoworkingMarker(item: CoworkingIdentifiableItem): boolean {
  if (item.itemType === "COWORKING" || Boolean(item.coworkingMeta)) {
    return true;
  }
  if (/^co-?working$/i.test((item.category || "").trim())) {
    return true;
  }
  if (item.itemType === "FNB") {
    return false;
  }
  const normalizedTenant = normalizeTenantId(item.tenantId);
  if (normalizedTenant === "DAGO_HUB") {
    return true;
  }
  if (normalizedTenant) {
    return false;
  }
  const idLower = (item.id || "").trim().toLowerCase();
  const prodIdLower = (item.productId || "").trim().toLowerCase();
  return (
    idLower.startsWith("cw-") ||
    idLower.startsWith("sp-") ||
    prodIdLower.startsWith("cw-") ||
    prodIdLower.startsWith("sp-")
  );
}

export function isCoworkingOrderItem(item: CoworkingIdentifiableItem): boolean {
  return hasExplicitCoworkingMarker(item);
}

export interface MixedCartTaxItem extends CoworkingIdentifiableItem {
  price?: number;
  unitPrice?: number;
  quantity: number;
}

export interface MixedCartTaxOptions {
  discount?: number;
  fnbDiscount?: number;
  coworkingDiscount?: number;
  otherDiscount?: number;
  fnbTaxRatePercent?: number;
  isFnbTaxEnabled?: boolean;
  fnbServiceChargePercent?: number;
  coworkingTaxRatePercent?: number;
  isCoworkingTaxEnabled?: boolean;
  coworkingServiceChargePercent?: number;
  orderType?: string;
}

export interface MixedCartTaxCalculationResult {
  fnbSubtotal: number;
  coworkingSubtotal: number;
  subtotal: number;
  fnbDiscount: number;
  coworkingDiscount: number;
  discount: number;
  fnbDpp: number;
  coworkingDpp: number;
  dpp: number;
  fnbPb1: number;
  fnbServiceCharge: number;
  coworkingTax: number;
  coworkingServiceCharge: number;
  pb1: number;
  serviceCharge: number;
  totalTaxAndService: number;
  taxRatePercent: number;
  serviceChargePercent: number;
  total: number;
}

export function allocateIntegerProRata(
  totalAmount: number,
  weights: readonly number[]
): number[] {
  const count = weights.length;
  if (count === 0) return [];
  const safeTotal = Math.max(0, Math.round(totalAmount || 0));
  if (safeTotal === 0) return weights.map(() => 0);

  const positiveWeights = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const totalWeight = positiveWeights.reduce((sum, w) => sum + w, 0);
  const effectiveWeights = totalWeight > 0 ? positiveWeights : weights.map(() => 1);
  const effectiveTotalWeight = effectiveWeights.reduce((sum, w) => sum + w, 0);

  if (effectiveTotalWeight <= 0) {
    return weights.map(() => 0);
  }

  const floors: number[] = [];
  const remainders: Array<{ idx: number; rem: number; weight: number }> = [];

  for (let i = 0; i < count; i++) {
    const w = effectiveWeights[i];
    if (w <= 0) {
      floors.push(0);
      continue;
    }
    const exact = (safeTotal * w) / effectiveTotalWeight;
    const fl = Math.floor(exact);
    floors.push(fl);
    remainders.push({ idx: i, rem: exact - fl, weight: w });
  }

  let left = safeTotal - floors.reduce((sum, v) => sum + v, 0);
  remainders.sort((a, b) => {
    if (b.rem !== a.rem) return b.rem - a.rem;
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.idx - b.idx;
  });

  for (let i = 0; i < remainders.length && left > 0; i++) {
    floors[remainders[i].idx] += 1;
    left -= 1;
  }

  return floors;
}

export interface CategoryTaxSplitHint {
  fnbTax?: number;
  coworkingTax?: number;
  fnbServiceCharge?: number;
  coworkingServiceCharge?: number;
}

export interface CategoryDiscountSplitHint {
  fnbDiscount?: number;
  coworkingDiscount?: number;
}

function allocateCappedTwoWay(amount: number, capA: number, capB: number): [number, number] {
  const safeCapA = Math.max(0, capA);
  const safeCapB = Math.max(0, capB);
  const safeAmount = Math.max(0, Math.min(safeCapA + safeCapB, Math.round(amount || 0)));
  if (safeAmount === 0) return [0, 0];
  if (safeCapA <= 0) return [0, safeAmount];
  if (safeCapB <= 0) return [safeAmount, 0];
  const [rawA] = allocateIntegerProRata(safeAmount, [safeCapA, safeCapB]);
  const a = Math.min(safeCapA, rawA);
  const b = Math.min(safeCapB, safeAmount - a);
  const finalA = a + Math.max(0, safeAmount - a - b);
  return [finalA, safeAmount - finalA];
}

function distributeAmountWithinCategory(
  groups: readonly { isCoworking: boolean; subtotal: number }[],
  amount: number,
  predicate: (g: { isCoworking: boolean; subtotal: number }) => boolean
): number[] {
  const indices: number[] = [];
  const weights: number[] = [];
  groups.forEach((g, idx) => {
    if (predicate(g)) {
      indices.push(idx);
      weights.push(Math.max(0, g.subtotal));
    }
  });
  const out = groups.map(() => 0);
  if (indices.length === 0) return out;
  const allocated = allocateIntegerProRata(amount, weights);
  indices.forEach((origIdx, i) => {
    out[origIdx] = allocated[i] ?? 0;
  });
  return out;
}

export function allocateCategoryDiscounts(
  groups: readonly { isCoworking: boolean; subtotal: number }[],
  totalDiscount: number,
  explicitSplit?: CategoryDiscountSplitHint
): number[] {
  if (groups.length === 0) return [];
  const safeTotalDiscount = Math.max(0, Math.round(totalDiscount || 0));
  if (
    explicitSplit &&
    (explicitSplit.fnbDiscount !== undefined || explicitSplit.coworkingDiscount !== undefined)
  ) {
    const fnbCap = groups
      .filter((g) => !g.isCoworking)
      .reduce((sum, g) => sum + Math.max(0, g.subtotal), 0);
    const cwCap = groups
      .filter((g) => g.isCoworking)
      .reduce((sum, g) => sum + Math.max(0, g.subtotal), 0);

    let fnbTarget: number;
    let cwTarget: number;
    if (explicitSplit.fnbDiscount !== undefined && explicitSplit.coworkingDiscount !== undefined) {
      fnbTarget = Math.min(fnbCap, Math.max(0, Math.round(explicitSplit.fnbDiscount)));
      cwTarget = Math.min(cwCap, Math.max(0, Math.round(explicitSplit.coworkingDiscount)));
    } else if (explicitSplit.fnbDiscount !== undefined) {
      fnbTarget = Math.min(fnbCap, Math.max(0, Math.round(explicitSplit.fnbDiscount)));
      const rem = Math.max(0, safeTotalDiscount - fnbTarget);
      cwTarget = Math.min(cwCap, rem);
      fnbTarget = Math.min(fnbCap, fnbTarget + Math.max(0, rem - cwTarget));
    } else {
      cwTarget = Math.min(cwCap, Math.max(0, Math.round(explicitSplit.coworkingDiscount ?? 0)));
      const rem = Math.max(0, safeTotalDiscount - cwTarget);
      fnbTarget = Math.min(fnbCap, rem);
      cwTarget = Math.min(cwCap, cwTarget + Math.max(0, rem - fnbTarget));
    }

    const fnbAlloc = distributeAmountWithinCategory(groups, fnbTarget, (g) => !g.isCoworking);
    const cwAlloc = distributeAmountWithinCategory(groups, cwTarget, (g) => g.isCoworking);
    return groups.map((_, idx) => (fnbAlloc[idx] ?? 0) + (cwAlloc[idx] ?? 0));
  }

  return allocateIntegerProRata(
    safeTotalDiscount,
    groups.map((g) => Math.max(0, g.subtotal))
  );
}

export function allocateCategoryTaxAndService(
  groups: readonly { isCoworking: boolean; subtotal: number }[],
  totalTax: number,
  totalServiceCharge: number,
  explicitSplit?: CategoryTaxSplitHint
): { tax: number; serviceCharge: number }[] {
  if (groups.length === 0) return [];

  const hasFnbPositive = groups.some((g) => !g.isCoworking && g.subtotal > 0);
  const defaultWeights = groups.map((g) =>
    hasFnbPositive ? (!g.isCoworking ? Math.max(0, g.subtotal) : 0) : Math.max(0, g.subtotal)
  );

  const allocatePair = (
    totalAmount: number,
    explicitFnb?: number,
    explicitCw?: number
  ): number[] => {
    if (explicitFnb !== undefined || explicitCw !== undefined) {
      const safeTotal = Math.max(0, Math.round(totalAmount || 0));
      const fnbTarget =
        explicitFnb !== undefined
          ? Math.max(0, Math.round(explicitFnb))
          : Math.max(0, safeTotal - Math.max(0, Math.round(explicitCw ?? 0)));
      const cwTarget =
        explicitCw !== undefined
          ? Math.max(0, Math.round(explicitCw))
          : Math.max(0, safeTotal - fnbTarget);
      const fnbAlloc = distributeAmountWithinCategory(groups, fnbTarget, (g) => !g.isCoworking);
      const cwAlloc = distributeAmountWithinCategory(groups, cwTarget, (g) => g.isCoworking);
      return groups.map((_, idx) => (fnbAlloc[idx] ?? 0) + (cwAlloc[idx] ?? 0));
    }
    return allocateIntegerProRata(totalAmount, defaultWeights);
  };

  const taxes = allocatePair(totalTax, explicitSplit?.fnbTax, explicitSplit?.coworkingTax);
  const serviceCharges = allocatePair(
    totalServiceCharge,
    explicitSplit?.fnbServiceCharge,
    explicitSplit?.coworkingServiceCharge
  );

  return groups.map((_, idx) => ({
    tax: taxes[idx] ?? 0,
    serviceCharge: serviceCharges[idx] ?? 0,
  }));
}

export function calculateMixedCartTaxAndService(
  items: readonly MixedCartTaxItem[],
  options: MixedCartTaxOptions = {}
): MixedCartTaxCalculationResult {
  let fnbSubtotal = 0;
  let coworkingSubtotal = 0;

  for (const item of items || []) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const unitPrice = Math.max(0, Number(item.price ?? item.unitPrice ?? 0) || 0);
    const lineTotal = Math.round(unitPrice * qty);
    if (lineTotal <= 0) continue;

    if (isCoworkingOrderItem(item)) {
      coworkingSubtotal += lineTotal;
    } else {
      fnbSubtotal += lineTotal;
    }
  }

  const subtotal = fnbSubtotal + coworkingSubtotal;
  let appliedFnbDiscount = 0;
  let appliedCoworkingDiscount = 0;

  if (
    options.fnbDiscount !== undefined ||
    options.coworkingDiscount !== undefined ||
    options.otherDiscount !== undefined
  ) {
    const baseFnb = Math.max(0, Math.min(fnbSubtotal, Math.round(options.fnbDiscount ?? 0)));
    const baseCw = Math.max(
      0,
      Math.min(coworkingSubtotal, Math.round(options.coworkingDiscount ?? 0))
    );
    const remainingFnbCap = Math.max(0, fnbSubtotal - baseFnb);
    const remainingCwCap = Math.max(0, coworkingSubtotal - baseCw);

    if (options.otherDiscount !== undefined) {
      const [extraFnb, extraCw] = allocateCappedTwoWay(
        options.otherDiscount,
        remainingFnbCap,
        remainingCwCap
      );
      appliedFnbDiscount = baseFnb + extraFnb;
      appliedCoworkingDiscount = baseCw + extraCw;
    } else if (options.fnbDiscount !== undefined && options.coworkingDiscount !== undefined) {
      appliedFnbDiscount = baseFnb;
      appliedCoworkingDiscount = baseCw;
    } else if (options.fnbDiscount !== undefined) {
      const rem =
        options.discount !== undefined
          ? Math.max(0, Math.round(options.discount) - baseFnb)
          : 0;
      const cwExtra = Math.min(remainingCwCap, rem);
      const fnbOverflow = Math.min(remainingFnbCap, Math.max(0, rem - cwExtra));
      appliedFnbDiscount = baseFnb + fnbOverflow;
      appliedCoworkingDiscount = cwExtra;
    } else {
      const rem =
        options.discount !== undefined
          ? Math.max(0, Math.round(options.discount) - baseCw)
          : 0;
      const fnbExtra = Math.min(remainingFnbCap, rem);
      const cwOverflow = Math.min(remainingCwCap, Math.max(0, rem - fnbExtra));
      appliedFnbDiscount = fnbExtra;
      appliedCoworkingDiscount = baseCw + cwOverflow;
    }
  } else {
    [appliedFnbDiscount, appliedCoworkingDiscount] = allocateCappedTwoWay(
      options.discount ?? 0,
      fnbSubtotal,
      coworkingSubtotal
    );
  }

  const discount = appliedFnbDiscount + appliedCoworkingDiscount;
  const fnbDpp = Math.max(0, fnbSubtotal - appliedFnbDiscount);
  const coworkingDpp = Math.max(0, coworkingSubtotal - appliedCoworkingDiscount);
  const dpp = fnbDpp + coworkingDpp;

  const fnbTaxRate =
    options.isFnbTaxEnabled !== false
      ? Math.max(0, Number(options.fnbTaxRatePercent ?? 10) || 0)
      : 0;
  const fnbServiceRate =
    options.orderType === "TAKEAWAY"
      ? 0
      : Math.max(0, Number(options.fnbServiceChargePercent ?? 5) || 0);

  const fnbPb1 = fnbDpp > 0 ? Math.round(fnbDpp * (fnbTaxRate / 100)) : 0;
  const fnbServiceCharge = fnbDpp > 0 ? Math.round(fnbDpp * (fnbServiceRate / 100)) : 0;

  const cwTaxRate = options.isCoworkingTaxEnabled
    ? Math.max(0, Number(options.coworkingTaxRatePercent ?? 0) || 0)
    : 0;
  const cwServiceRate =
    options.orderType === "TAKEAWAY"
      ? 0
      : Math.max(0, Number(options.coworkingServiceChargePercent ?? 0) || 0);

  const coworkingTax = coworkingDpp > 0 ? Math.round(coworkingDpp * (cwTaxRate / 100)) : 0;
  const coworkingServiceCharge =
    coworkingDpp > 0 && cwServiceRate > 0
      ? Math.round(coworkingDpp * (cwServiceRate / 100))
      : 0;

  const pb1 = fnbPb1 + coworkingTax;
  const serviceCharge = fnbServiceCharge + coworkingServiceCharge;
  const totalTaxAndService = pb1 + serviceCharge;
  const total = dpp + totalTaxAndService;

  const taxRatePercent = fnbDpp > 0 ? fnbTaxRate : coworkingDpp > 0 ? cwTaxRate : fnbTaxRate;
  const serviceChargePercent = fnbDpp > 0 ? fnbServiceRate : cwServiceRate;

  return {
    fnbSubtotal,
    coworkingSubtotal,
    subtotal,
    fnbDiscount: appliedFnbDiscount,
    coworkingDiscount: appliedCoworkingDiscount,
    discount,
    fnbDpp,
    coworkingDpp,
    dpp,
    fnbPb1,
    fnbServiceCharge,
    coworkingTax,
    coworkingServiceCharge,
    pb1,
    serviceCharge,
    totalTaxAndService,
    taxRatePercent,
    serviceChargePercent,
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
  const validOrders = orders.filter((o) => o.paymentStatus === "PAID" && o.status !== "CANCELLED");

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
