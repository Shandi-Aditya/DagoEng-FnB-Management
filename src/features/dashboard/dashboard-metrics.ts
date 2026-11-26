import type { BusinessUnit } from "@/components/app/unit-dot";
import {
  formatWitaDateTime,
  getTodayWitaDateString,
  getWitaHour,
  normalizeDateRange,
  toWitaDateKey,
} from "@/lib/date-utils";
import { calculateSettlement, resolveItemTenantId } from "@/lib/settlement";
import {
  allocateCategoryDiscounts,
  allocateCategoryTaxAndService,
  getOrderTaxBreakdown,
  isCoworkingOrderItem,
} from "@/lib/tax-breakdown";
import type { OrderRecord } from "@/types/order";

/** Minimal order shape the dashboard metrics need. */
export interface MetricOrder {
  total: number;
  createdAt?: string;
  discount?: number;
  promoId?: string;
  customerCount?: number;
  customerName?: string;
  customerPhone?: string;
  corporateInfo?: {
    headcount?: number;
  };
}

export function extractOrderCustomerCount(order: MetricOrder): number {
  if (typeof order.customerCount === "number" && order.customerCount > 0) {
    return order.customerCount;
  }
  if (order.corporateInfo?.headcount && order.corporateInfo.headcount > 0) {
    return order.corporateInfo.headcount;
  }
  return 1;
}

/** Estimated cost of goods sold until real recipe costs are wired in. */
export const ESTIMATED_COST_RATIO = 0.38;

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;
const HOUR_SLOTS = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"] as const;

export interface UnitBreakdownInput {
  fnbRevenue: number;
  coworkingRevenue: number;
  eventRevenue: number;
  coworkingBookings: number;
  ticketsSold: number;
  isCoworkingActive: boolean;
}

export interface UnitBreakdownItem {
  unit: BusinessUnit;
  name: string;
  revenue: number;
  sharePercent: number;
  detail: string;
  isActive: boolean;
}

/** Revenue per business unit with proportional shares of the consolidated total. */
export function buildUnitBreakdown(input: UnitBreakdownInput): UnitBreakdownItem[] {
  const total = input.fnbRevenue + input.coworkingRevenue + input.eventRevenue;
  const share = (revenue: number) => (total > 0 ? Math.round((revenue / total) * 100) : 0);

  return [
    {
      unit: "fnb",
      name: "F&B",
      revenue: input.fnbRevenue,
      sharePercent: share(input.fnbRevenue),
      detail: "Kopi Senja, Dapur Mama, Manis Bakery, Warung Bu Narti",
      isActive: true,
    },
    {
      unit: "coworking",
      name: "Co-working",
      revenue: input.coworkingRevenue,
      sharePercent: share(input.coworkingRevenue),
      detail: `${input.coworkingBookings} booking`,
      isActive: input.isCoworkingActive,
    },
    {
      unit: "event",
      name: "Event komunitas",
      revenue: input.eventRevenue,
      sharePercent: share(input.eventRevenue),
      detail: `${input.ticketsSold} tiket terjual · biaya platform 20%`,
      isActive: true,
    },
  ];
}

export function averageOrderValue(revenue: number, transactions: number): number {
  return transactions > 0 ? Math.round(revenue / transactions) : 0;
}

export interface DayBucket {
  date: string;
  day: string;
  isToday: boolean;
  revenue: number;
  cost: number;
  discount: number;
  orders: number;
  customers: number;
}

/** Seven daily buckets ending today in WITA. Orders outside the window are ignored. */
export function bucketLastSevenDays(orders: readonly MetricOrder[], now: Date = new Date()): DayBucket[] {
  const todayKey = getTodayWitaDateString(now);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const days: DayBucket[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(ty, tm - 1, td - offset));
    days.push({
      date: date.toISOString().slice(0, 10),
      day: DAY_NAMES[date.getUTCDay()],
      isToday: offset === 0,
      revenue: 0,
      cost: 0,
      discount: 0,
      orders: 0,
      customers: 0,
    });
  }

  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const order of orders) {
    const dateKey = order.createdAt ? toWitaDateKey(order.createdAt) : "";
    const bucket = dateKey ? byDate.get(dateKey) : undefined;
    if (!bucket) continue;
    bucket.revenue += order.total || 0;
    bucket.discount += order.discount || 0;
    bucket.cost += Math.round((order.total || 0) * ESTIMATED_COST_RATIO);
    bucket.orders += 1;
    bucket.customers += extractOrderCustomerCount(order);
  }

  return days;
}

export function bucketOrdersByDateRange(
  orders: readonly MetricOrder[],
  startDate: string,
  endDate: string,
  now: Date = new Date()
): DayBucket[] {
  const todayKey = getTodayWitaDateString(now);
  const normalized = normalizeDateRange(startDate, endDate, todayKey);
  const [sy, sm, sd] = normalized.startDate.split("-").map(Number);
  const [ey, em, ed] = normalized.endDate.split("-").map(Number);
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);
  const spanDays = Math.max(1, Math.min(366, Math.round((endUtc - startUtc) / 86_400_000) + 1));

  const days: DayBucket[] = [];
  for (let offset = 0; offset < spanDays; offset += 1) {
    const date = new Date(Date.UTC(sy, sm - 1, sd + offset));
    const dateKey = date.toISOString().slice(0, 10);
    days.push({
      date: dateKey,
      day: spanDays <= 7 ? DAY_NAMES[date.getUTCDay()] : formatWitaDateTime(dateKey, "dd MMM"),
      isToday: dateKey === todayKey,
      revenue: 0,
      cost: 0,
      discount: 0,
      orders: 0,
      customers: 0,
    });
  }

  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const order of orders) {
    const dateKey = order.createdAt ? toWitaDateKey(order.createdAt) : "";
    const bucket = dateKey ? byDate.get(dateKey) : undefined;
    if (!bucket) continue;
    bucket.revenue += order.total || 0;
    bucket.discount += order.discount || 0;
    bucket.cost += Math.round((order.total || 0) * ESTIMATED_COST_RATIO);
    bucket.orders += 1;
    bucket.customers += extractOrderCustomerCount(order);
  }

  return days;
}

export interface HourBucket {
  hour: string;
  revenue: number;
  orders: number;
  customers: number;
}

function slotForHour(hour: number): string {
  if (hour >= 21) return "22:00";
  if (hour >= 19) return "20:00";
  if (hour >= 17) return "18:00";
  if (hour >= 15) return "16:00";
  if (hour >= 13) return "14:00";
  if (hour >= 11) return "12:00";
  if (hour >= 9) return "10:00";
  return "08:00";
}

/** Revenue, order, and customer counts per two-hour slot in WITA. */
export function bucketHourly(orders: readonly MetricOrder[]): HourBucket[] {
  const slots = new Map<string, HourBucket>(
    HOUR_SLOTS.map((hour) => [hour, { hour, revenue: 0, orders: 0, customers: 0 }])
  );
  for (const order of orders) {
    if (!order.createdAt) continue;
    const hour = getWitaHour(order.createdAt);
    if (hour === null) continue;
    const slot = slots.get(slotForHour(hour));
    if (!slot) continue;
    slot.revenue += order.total || 0;
    slot.orders += 1;
    slot.customers += extractOrderCustomerCount(order);
  }
  return [...slots.values()];
}

export type TrafficMetric = "orders" | "customers";

export interface PeakAndQuietHours {
  busiest: HourBucket | null;
  quietest: HourBucket | null;
  metric: TrafficMetric;
}

/** Finds the busiest and quietest operational hour slots based on traffic. */
export function findPeakAndQuietHours(
  hourlyBuckets: readonly HourBucket[],
  metric: TrafficMetric = "orders"
): PeakAndQuietHours {
  if (!hourlyBuckets || hourlyBuckets.length === 0) {
    return { busiest: null, quietest: null, metric };
  }

  const hasTraffic = hourlyBuckets.some((slot) => (slot[metric] || 0) > 0);
  if (!hasTraffic) {
    return { busiest: null, quietest: null, metric };
  }

  let busiest = hourlyBuckets[0];
  let quietest = hourlyBuckets[0];

  for (const slot of hourlyBuckets) {
    if (slot[metric] > busiest[metric]) {
      busiest = slot;
    }
    if (slot[metric] < quietest[metric]) {
      quietest = slot;
    }
  }

  return { busiest, quietest, metric };
}

export interface DayOfWeekBucket {
  dayIndex: number;
  dayKey: string;
  dayName: string;
  revenue: number;
  orders: number;
  customers: number;
  averageOrderValue: number;
}

const ORDERED_DAYS = [
  { index: 1, key: "Sen", name: "Senin", utcDay: 1 },
  { index: 2, key: "Sel", name: "Selasa", utcDay: 2 },
  { index: 3, key: "Rab", name: "Rabu", utcDay: 3 },
  { index: 4, key: "Kam", name: "Kamis", utcDay: 4 },
  { index: 5, key: "Jum", name: "Jumat", utcDay: 5 },
  { index: 6, key: "Sab", name: "Sabtu", utcDay: 6 },
  { index: 7, key: "Min", name: "Minggu", utcDay: 0 },
] as const;

/** Aggregates traffic and sales across Monday through Sunday. */
export function bucketDayOfWeekTraffic(orders: readonly MetricOrder[]): DayOfWeekBucket[] {
  const buckets = new Map<number, DayOfWeekBucket>(
    ORDERED_DAYS.map((d) => [
      d.utcDay,
      {
        dayIndex: d.index,
        dayKey: d.key,
        dayName: d.name,
        revenue: 0,
        orders: 0,
        customers: 0,
        averageOrderValue: 0,
      },
    ])
  );

  for (const order of orders) {
    if (!order.createdAt) continue;
    const dateKey = toWitaDateKey(order.createdAt);
    if (!dateKey) continue;
    const [y, m, d] = dateKey.split("-").map(Number);
    const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const bucket = buckets.get(dayOfWeek);
    if (!bucket) continue;

    bucket.revenue += order.total || 0;
    bucket.orders += 1;
    bucket.customers += extractOrderCustomerCount(order);
  }

  return ORDERED_DAYS.map((d) => {
    const b = buckets.get(d.utcDay)!;
    return {
      ...b,
      averageOrderValue: b.orders > 0 ? Math.round(b.revenue / b.orders) : 0,
    };
  });
}

/** Computes the equivalent previous period date range ending the day before current range start. */
export function getPreviousPeriodRange(
  startDate: string,
  endDate: string
): { startDate: string; endDate: string } {
  if (
    !startDate ||
    !endDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
  ) {
    const today = new Date().toISOString().slice(0, 10);
    return { startDate: today, endDate: today };
  }

  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);

  if (Number.isNaN(startUtc) || Number.isNaN(endUtc)) {
    const today = new Date().toISOString().slice(0, 10);
    return { startDate: today, endDate: today };
  }

  const spanDays = Math.max(1, Math.round((endUtc - startUtc) / 86_400_000) + 1);

  const prevEndUtc = startUtc - 86_400_000;
  const prevStartUtc = prevEndUtc - (spanDays - 1) * 86_400_000;

  return {
    startDate: new Date(prevStartUtc).toISOString().slice(0, 10),
    endDate: new Date(prevEndUtc).toISOString().slice(0, 10),
  };
}

export type ComparisonMode = "PREVIOUS_PERIOD" | "LAST_WEEK" | "LAST_MONTH" | "CUSTOM";

/** Resolves comparison date range based on the selected mode. */
export function resolveComparisonRange(
  startDate: string,
  endDate: string,
  mode: ComparisonMode = "PREVIOUS_PERIOD",
  customRange?: { startDate: string; endDate: string }
): { startDate: string; endDate: string; label: string } {
  if (mode === "CUSTOM" && customRange?.startDate && customRange?.endDate) {
    return {
      startDate: customRange.startDate,
      endDate: customRange.endDate,
      label: "Periode kustom",
    };
  }

  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);

  if (mode === "LAST_WEEK") {
    const prevStartUtc = startUtc - 7 * 86_400_000;
    const prevEndUtc = endUtc - 7 * 86_400_000;
    return {
      startDate: new Date(prevStartUtc).toISOString().slice(0, 10),
      endDate: new Date(prevEndUtc).toISOString().slice(0, 10),
      label: "Minggu lalu",
    };
  }

  if (mode === "LAST_MONTH") {
    const prevStart = new Date(Date.UTC(sy, sm - 2, sd));
    const prevEnd = new Date(Date.UTC(ey, em - 2, ed));
    return {
      startDate: prevStart.toISOString().slice(0, 10),
      endDate: prevEnd.toISOString().slice(0, 10),
      label: "Bulan lalu",
    };
  }

  const prev = getPreviousPeriodRange(startDate, endDate);
  return {
    ...prev,
    label: "Periode sebelumnya",
  };
}

export interface PeriodTrafficComparison {
  current: {
    startDate: string;
    endDate: string;
    revenue: number;
    orders: number;
    customers: number;
  };
  previous: {
    startDate: string;
    endDate: string;
    revenue: number;
    orders: number;
    customers: number;
  };
  deltas: {
    revenueAmount: number;
    revenuePercent: number;
    ordersCount: number;
    ordersPercent: number;
    customersCount: number;
    customersPercent: number;
  };
}

export function calculatePeriodComparison(
  currentOrders: readonly MetricOrder[],
  previousOrders: readonly MetricOrder[],
  currentRange: { startDate: string; endDate: string },
  previousRange: { startDate: string; endDate: string }
): PeriodTrafficComparison {
  const sumMetrics = (list: readonly MetricOrder[]) => {
    let revenue = 0;
    let orders = 0;
    let customers = 0;
    for (const o of list) {
      revenue += o.total || 0;
      orders += 1;
      customers += extractOrderCustomerCount(o);
    }
    return { revenue, orders, customers };
  };

  const curr = sumMetrics(currentOrders);
  const prev = sumMetrics(previousOrders);

  const calcPercent = (c: number, p: number): number => {
    if (p === 0) return c > 0 ? 100 : 0;
    return Number((((c - p) / p) * 100).toFixed(1));
  };

  return {
    current: {
      startDate: currentRange.startDate,
      endDate: currentRange.endDate,
      ...curr,
    },
    previous: {
      startDate: previousRange.startDate,
      endDate: previousRange.endDate,
      ...prev,
    },
    deltas: {
      revenueAmount: curr.revenue - prev.revenue,
      revenuePercent: calcPercent(curr.revenue, prev.revenue),
      ordersCount: curr.orders - prev.orders,
      ordersPercent: calcPercent(curr.orders, prev.orders),
      customersCount: curr.customers - prev.customers,
      customersPercent: calcPercent(curr.customers, prev.customers),
    },
  };
}

export interface ForecastDayItem {
  date: string;
  day: string;
  dayName: string;
  projectedRevenue: number;
  projectedOrders: number;
  projectedCustomers: number;
  lowerBoundRevenue: number;
  upperBoundRevenue: number;
}

export type ForecastMethod = "WEIGHTED_MOVING_AVERAGE" | "LINEAR_REGRESSION";

export interface SalesForecastResult {
  forecastDays: ForecastDayItem[];
  totalProjectedRevenue: number;
  totalProjectedOrders: number;
  totalProjectedCustomers: number;
  dailyAverageProjectedRevenue: number;
  hasSufficientData: boolean;
  methodology: string;
}

/** Projects sales and traffic for the upcoming period using weighted average or linear regression with day-of-week seasonality. */
export function calculateSalesForecast(
  historicalDaily: readonly DayBucket[],
  horizonDays: number = 7,
  method: ForecastMethod = "WEIGHTED_MOVING_AVERAGE"
): SalesForecastResult {
  if (historicalDaily.length === 0) {
    return {
      forecastDays: [],
      totalProjectedRevenue: 0,
      totalProjectedOrders: 0,
      totalProjectedCustomers: 0,
      dailyAverageProjectedRevenue: 0,
      hasSufficientData: false,
      methodology: "Tidak ada data historis yang memadai",
    };
  }

  const totalRev = historicalDaily.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrd = historicalDaily.reduce((sum, d) => sum + d.orders, 0);
  const totalCust = historicalDaily.reduce((sum, d) => sum + d.customers, 0);
  const dayCount = historicalDaily.length;

  const baseDailyRev = dayCount > 0 ? totalRev / dayCount : 0;
  const baseDailyOrd = dayCount > 0 ? totalOrd / dayCount : 0;
  const baseDailyCust = dayCount > 0 ? totalCust / dayCount : 0;

  const dowSums = new Map<number, { rev: number; count: number }>();
  for (const d of historicalDaily) {
    const [y, m, day] = d.date.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
    const existing = dowSums.get(dow) || { rev: 0, count: 0 };
    dowSums.set(dow, { rev: existing.rev + d.revenue, count: existing.count + 1 });
  }

  const dowMultiplier = (dow: number): number => {
    const entry = dowSums.get(dow);
    if (!entry || entry.count === 0 || baseDailyRev <= 0) return 1.0;
    const dowAvg = entry.rev / entry.count;
    const factor = dowAvg / baseDailyRev;
    return Math.max(0.5, Math.min(2.0, factor));
  };

  let slope = 0;
  let intercept = baseDailyRev;
  if (method === "LINEAR_REGRESSION" && dayCount >= 2) {
    const xMean = (dayCount - 1) / 2;
    const yMean = baseDailyRev;
    let num = 0;
    let den = 0;
    for (let i = 0; i < dayCount; i += 1) {
      const xDiff = i - xMean;
      num += xDiff * (historicalDaily[i].revenue - yMean);
      den += xDiff * xDiff;
    }
    if (den > 0) {
      slope = num / den;
      intercept = yMean - slope * xMean;
    }
  }

  const lastDateKey = historicalDaily[historicalDaily.length - 1].date;
  const [ly, lm, ld] = lastDateKey.split("-").map(Number);

  const forecastDays: ForecastDayItem[] = [];
  let totalProjectedRevenue = 0;
  let totalProjectedOrders = 0;
  let totalProjectedCustomers = 0;

  for (let offset = 1; offset <= horizonDays; offset += 1) {
    const nextDate = new Date(Date.UTC(ly, lm - 1, ld + offset));
    const nextDateKey = nextDate.toISOString().slice(0, 10);
    const dow = nextDate.getUTCDay();
    const multiplier = dowMultiplier(dow);

    let projectedRevenue: number;
    if (method === "LINEAR_REGRESSION" && dayCount >= 2) {
      const trendValue = Math.max(0, slope * (dayCount - 1 + offset) + intercept);
      projectedRevenue = Math.round(trendValue * multiplier);
    } else {
      projectedRevenue = Math.round(baseDailyRev * multiplier);
    }

    const projectedOrders = Math.max(0, Math.round(baseDailyOrd * multiplier));
    const projectedCustomers = Math.max(0, Math.round(baseDailyCust * multiplier));

    const lowerBoundRevenue = Math.max(0, Math.round(projectedRevenue * 0.88));
    const upperBoundRevenue = Math.round(projectedRevenue * 1.12);

    totalProjectedRevenue += projectedRevenue;
    totalProjectedOrders += projectedOrders;
    totalProjectedCustomers += projectedCustomers;

    forecastDays.push({
      date: nextDateKey,
      day: DAY_NAMES[dow],
      dayName: ORDERED_DAYS.find((o) => o.utcDay === dow)?.name ?? DAY_NAMES[dow],
      projectedRevenue,
      projectedOrders,
      projectedCustomers,
      lowerBoundRevenue,
      upperBoundRevenue,
    });
  }

  return {
    forecastDays,
    totalProjectedRevenue,
    totalProjectedOrders,
    totalProjectedCustomers,
    dailyAverageProjectedRevenue: horizonDays > 0 ? Math.round(totalProjectedRevenue / horizonDays) : 0,
    hasSufficientData: totalRev > 0,
    methodology:
      method === "LINEAR_REGRESSION"
        ? "Linear regression dengan pembobotan faktor musiman hari"
        : "Weighted moving average dengan pembobotan faktor musiman hari",
  };
}

export interface DashboardOrderScopeOptions {
  tenantId?: string;
  isTenantOwner?: boolean;
  isDateInRange?: (dateStr: string) => boolean;
  requirePaid?: boolean;
}

export function scopeDashboardOrders(
  orders: readonly OrderRecord[],
  options: DashboardOrderScopeOptions
): OrderRecord[] {
  const { tenantId, isTenantOwner, isDateInRange, requirePaid = true } = options;
  return orders.filter((order) => {
    if (order.status === "CANCELLED") return false;
    if (requirePaid && order.paymentStatus !== "PAID") return false;
    if (isDateInRange && !isDateInRange(order.createdAt)) return false;
    if (isTenantOwner && tenantId) {
      const fallbackTenantId = (order as { tenantId?: string }).tenantId;
      return order.items.some((item) => resolveItemTenantId(item, fallbackTenantId) === tenantId);
    }
    return true;
  });
}

export function partitionOrderRevenueByUnit(paidOrders: readonly OrderRecord[]): {
  fnbRevenue: number;
  coworkingRevenue: number;
} {
  let fnbRevenue = 0;
  let coworkingRevenue = 0;

  for (const order of paidOrders) {
    const orderTotal = order.total || 0;
    const items = order.items || [];
    if (items.length === 0) {
      fnbRevenue += orderTotal;
      continue;
    }

    let fnbGross = 0;
    let cwGross = 0;
    for (const item of items) {
      const lineTotal = Math.round((Number(item.unitPrice) || 0) * (Number(item.quantity) || 0));
      if (lineTotal <= 0) continue;
      if (isCoworkingOrderItem(item)) cwGross += lineTotal;
      else fnbGross += lineTotal;
    }

    if (cwGross <= 0) {
      fnbRevenue += orderTotal;
    } else if (fnbGross <= 0) {
      coworkingRevenue += orderTotal;
    } else {
      const breakdown = getOrderTaxBreakdown(order);
      const groups = [
        { isCoworking: false, subtotal: fnbGross },
        { isCoworking: true, subtotal: cwGross },
      ];
      const [, cwDiscount] = allocateCategoryDiscounts(
        groups,
        breakdown.discount,
        order.fnbDiscount !== undefined || order.coworkingDiscount !== undefined
          ? { fnbDiscount: order.fnbDiscount, coworkingDiscount: order.coworkingDiscount }
          : undefined
      );
      const [, cwTaxAlloc] = allocateCategoryTaxAndService(
        groups,
        breakdown.pb1,
        breakdown.serviceCharge,
        order.fnbTax !== undefined || order.coworkingTax !== undefined
          ? { fnbTax: order.fnbTax, coworkingTax: order.coworkingTax }
          : undefined
      );
      const cwPortion = Math.min(
        orderTotal,
        Math.max(0, cwGross - cwDiscount) + cwTaxAlloc.tax + cwTaxAlloc.serviceCharge
      );
      coworkingRevenue += cwPortion;
      fnbRevenue += Math.max(0, orderTotal - cwPortion);
    }
  }

  return { fnbRevenue, coworkingRevenue };
}

export function computeDashboardFnbRevenue(
  paidOrders: readonly OrderRecord[],
  options: { isTenantOwner?: boolean; tenantId?: string }
): number {
  if (options.isTenantOwner && options.tenantId) {
    const settlements = calculateSettlement(
      paidOrders as OrderRecord[],
      undefined,
      undefined,
      { includeInternal: true }
    );
    return settlements.find((s) => s.tenantId === options.tenantId)?.tenantShareAmount ?? 0;
  }
  return partitionOrderRevenueByUnit(paidOrders).fnbRevenue;
}

export function projectDashboardOrdersForTenant(
  paidOrders: readonly OrderRecord[],
  tenantId: string
): OrderRecord[] {
  return paidOrders.map((order) => {
    const tenantSettlement = calculateSettlement(
      [order],
      undefined,
      undefined,
      { includeInternal: true }
    ).find((s) => s.tenantId === tenantId);
    return {
      ...order,
      total: tenantSettlement?.tenantShareAmount ?? 0,
      discount: Math.round(tenantSettlement?.discount ?? 0),
    };
  });
}

export interface PromoBucket {
  name: "Promo" | "Reguler";
  revenue: number;
  discount: number;
  orders: number;
}

export function splitPromoOrders(orders: readonly MetricOrder[]): [PromoBucket, PromoBucket] {
  const isPromo = (order: MetricOrder) => (order.discount ?? 0) > 0 || Boolean(order.promoId);
  const promo = orders.filter(isPromo);
  const regular = orders.filter((order) => !isPromo(order));
  const sum = (list: MetricOrder[], pick: (order: MetricOrder) => number) =>
    list.reduce((total, order) => total + pick(order), 0);

  return [
    { name: "Promo", revenue: sum(promo, (o) => o.total), discount: sum(promo, (o) => o.discount ?? 0), orders: promo.length },
    { name: "Reguler", revenue: sum(regular, (o) => o.total), discount: 0, orders: regular.length },
  ];
}

const compactNumber = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

/** Short Rupiah labels for chart axes, e.g. 1_500_000 -> "Rp 1,5 jt". */
export function formatCompactIDR(value: number): string {
  if (!value) return "Rp 0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}Rp ${compactNumber.format(abs / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${sign}Rp ${compactNumber.format(abs / 1_000_000)} jt`;
  if (abs >= 1_000) return `${sign}Rp ${Math.round(abs / 1_000)} rb`;
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
}
