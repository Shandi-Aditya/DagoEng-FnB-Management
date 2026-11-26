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

function parseValidYmd(dateStr: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function normalizeValidDateRange(
  startDate: string,
  endDate: string,
  fallback: string = getTodayWitaDateString()
): { startDate: string; endDate: string } {
  const norm = normalizeDateRange(startDate, endDate, fallback);
  const s = parseValidYmd(norm.startDate) ? norm.startDate : fallback;
  const e = parseValidYmd(norm.endDate) ? norm.endDate : fallback;
  return s <= e ? { startDate: s, endDate: e } : { startDate: e, endDate: s };
}

function shiftMonthClamped(year: number, month: number, day: number, deltaMonths: number = -1): string {
  const totalMonths = year * 12 + (month - 1) + deltaMonths;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth0 = ((totalMonths % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth0 + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);
  return new Date(Date.UTC(targetYear, targetMonth0, clampedDay)).toISOString().slice(0, 10);
}

export function bucketOrdersByDateRange(
  orders: readonly MetricOrder[],
  startDate: string,
  endDate: string,
  now: Date = new Date()
): DayBucket[] {
  const todayKey = getTodayWitaDateString(now);
  const normalized = normalizeValidDateRange(startDate, endDate, todayKey);
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
  const parsedStart = parseValidYmd(startDate);
  const parsedEnd = parseValidYmd(endDate);
  if (!parsedStart || !parsedEnd) {
    const today = getTodayWitaDateString();
    return { startDate: today, endDate: today };
  }

  const startUtc = Date.UTC(parsedStart.year, parsedStart.month - 1, parsedStart.day);
  const endUtc = Date.UTC(parsedEnd.year, parsedEnd.month - 1, parsedEnd.day);
  const orderedStartUtc = Math.min(startUtc, endUtc);
  const orderedEndUtc = Math.max(startUtc, endUtc);

  const spanDays = Math.max(1, Math.round((orderedEndUtc - orderedStartUtc) / 86_400_000) + 1);

  const prevEndUtc = orderedStartUtc - 86_400_000;
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
  const today = getTodayWitaDateString();
  const normalized = normalizeValidDateRange(startDate, endDate, today);

  if (mode === "CUSTOM" && customRange?.startDate && customRange?.endDate) {
    const normalizedCustom = normalizeValidDateRange(
      customRange.startDate,
      customRange.endDate,
      normalized.startDate
    );
    return {
      startDate: normalizedCustom.startDate,
      endDate: normalizedCustom.endDate,
      label: "Periode kustom",
    };
  }

  const [sy, sm, sd] = normalized.startDate.split("-").map(Number);
  const [ey, em, ed] = normalized.endDate.split("-").map(Number);
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
    return {
      startDate: shiftMonthClamped(sy, sm, sd, -1),
      endDate: shiftMonthClamped(ey, em, ed, -1),
      label: "Bulan lalu",
    };
  }

  const prev = getPreviousPeriodRange(normalized.startDate, normalized.endDate);
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
    revenuePercent: number | null;
    hasRevenueBaseline: boolean;
    ordersCount: number;
    ordersPercent: number | null;
    hasOrdersBaseline: boolean;
    customersCount: number;
    customersPercent: number | null;
    hasCustomersBaseline: boolean;
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

  const calcPercent = (c: number, p: number): number | null => {
    if (p === 0) return c > 0 ? null : 0;
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
      hasRevenueBaseline: prev.revenue > 0,
      ordersCount: curr.orders - prev.orders,
      ordersPercent: calcPercent(curr.orders, prev.orders),
      hasOrdersBaseline: prev.orders > 0,
      customersCount: curr.customers - prev.customers,
      customersPercent: calcPercent(curr.customers, prev.customers),
      hasCustomersBaseline: prev.customers > 0,
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

function fitLinearTrend(values: readonly number[]): {
  at: (x: number) => number;
} {
  const n = values.length;
  if (n === 0) return { at: () => 0 };
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  if (n < 2) return { at: () => Math.max(0, mean) };

  const xMean = (n - 1) / 2;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    const xDiff = i - xMean;
    num += xDiff * (values[i] - mean);
    den += xDiff * xDiff;
  }
  const slope = den > 0 ? num / den : 0;
  const intercept = mean - slope * xMean;
  return {
    at: (x: number) => Math.max(0, slope * x + intercept),
  };
}

function computeNormalizedDowMultipliers(
  historicalDaily: readonly DayBucket[],
  expectedRevAt: (index: number) => number
): Map<number, number> {
  const multipliers = new Map<number, number>();
  if (historicalDaily.length < 7) return multipliers;

  const dowRatios = new Map<number, { sum: number; count: number }>();
  for (let i = 0; i < historicalDaily.length; i += 1) {
    const d = historicalDaily[i];
    const parsed = parseValidYmd(d.date);
    if (!parsed) continue;
    const expected = expectedRevAt(i);
    if (expected <= 0) continue;

    const dow = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
    const rawRatio = Math.max(0.5, Math.min(2.0, d.revenue / expected));
    const prev = dowRatios.get(dow) ?? { sum: 0, count: 0 };
    dowRatios.set(dow, { sum: prev.sum + rawRatio, count: prev.count + 1 });
  }

  if (dowRatios.size === 0) return multipliers;

  const rawByDow = new Map<number, number>();
  let rawSum = 0;
  for (const [dow, entry] of dowRatios.entries()) {
    const avg = Math.max(0.5, Math.min(2.0, entry.sum / entry.count));
    rawByDow.set(dow, avg);
    rawSum += avg;
  }

  const meanRaw = rawSum / rawByDow.size;
  for (const [dow, raw] of rawByDow.entries()) {
    multipliers.set(dow, meanRaw > 0 ? raw / meanRaw : 1.0);
  }
  return multipliers;
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

  const dayCount = historicalDaily.length;
  const totalRev = historicalDaily.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrd = historicalDaily.reduce((sum, d) => sum + d.orders, 0);
  const totalCust = historicalDaily.reduce((sum, d) => sum + d.customers, 0);

  const overallMeanRev = totalRev / dayCount;
  const overallMeanOrd = totalOrd / dayCount;
  const overallMeanCust = totalCust / dayCount;
  const hasSufficientData = dayCount >= 3 && totalRev > 0;

  // Weighted Moving Average over trailing window W = min(7, dayCount) with weights 1..W
  const windowSize = Math.min(7, dayCount);
  const recentWindow = historicalDaily.slice(dayCount - windowSize);
  const weightSum = (windowSize * (windowSize + 1)) / 2;
  let wmaRev = 0;
  let wmaOrd = 0;
  let wmaCust = 0;
  for (let i = 0; i < windowSize; i += 1) {
    const weight = i + 1;
    wmaRev += recentWindow[i].revenue * weight;
    wmaOrd += recentWindow[i].orders * weight;
    wmaCust += recentWindow[i].customers * weight;
  }
  wmaRev /= weightSum;
  wmaOrd /= weightSum;
  wmaCust /= weightSum;

  const useRegression = dayCount >= 3 && method === "LINEAR_REGRESSION";
  const revTrend = fitLinearTrend(historicalDaily.map((d) => d.revenue));
  const ordTrend = fitLinearTrend(historicalDaily.map((d) => d.orders));
  const custTrend = fitLinearTrend(historicalDaily.map((d) => d.customers));

  const dowMultipliers =
    dayCount >= 7
      ? computeNormalizedDowMultipliers(historicalDaily, (i) =>
          useRegression ? revTrend.at(i) : overallMeanRev
        )
      : new Map<number, number>();

  const lastDateKey = historicalDaily[dayCount - 1].date;
  const parsedLast = parseValidYmd(lastDateKey);
  const [ly, lm, ld] = parsedLast
    ? [parsedLast.year, parsedLast.month, parsedLast.day]
    : getTodayWitaDateString().split("-").map(Number);

  const forecastDays: ForecastDayItem[] = [];
  let totalProjectedRevenue = 0;
  let totalProjectedOrders = 0;
  let totalProjectedCustomers = 0;

  for (let offset = 1; offset <= horizonDays; offset += 1) {
    const nextDate = new Date(Date.UTC(ly, lm - 1, ld + offset));
    const nextDateKey = nextDate.toISOString().slice(0, 10);
    const dow = nextDate.getUTCDay();
    const multiplier = dayCount >= 7 ? (dowMultipliers.get(dow) ?? 1.0) : 1.0;

    let baseRev: number;
    let baseOrd: number;
    let baseCust: number;
    if (dayCount < 3) {
      baseRev = overallMeanRev;
      baseOrd = overallMeanOrd;
      baseCust = overallMeanCust;
    } else if (useRegression) {
      const targetIndex = dayCount - 1 + offset;
      baseRev = revTrend.at(targetIndex);
      baseOrd = ordTrend.at(targetIndex);
      baseCust = custTrend.at(targetIndex);
    } else {
      baseRev = wmaRev;
      baseOrd = wmaOrd;
      baseCust = wmaCust;
    }

    const projectedRevenue = Math.max(0, Math.round(baseRev * multiplier));
    const projectedOrders = Math.max(0, Math.round(baseOrd * multiplier));
    const projectedCustomers = Math.max(0, Math.round(baseCust * multiplier));

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

  let methodology: string;
  if (totalRev <= 0) {
    methodology = "Belum ada transaksi penjualan pada periode historis";
  } else if (dayCount < 3) {
    methodology = "Data historis kurang dari 3 hari (rata-rata sederhana sebagai estimasi awal)";
  } else if (method === "LINEAR_REGRESSION") {
    methodology =
      dayCount >= 7
        ? "Linear regression dengan pembobotan faktor musiman hari"
        : "Linear regression (tanpa faktor musiman karena data kurang dari 7 hari)";
  } else {
    methodology =
      dayCount >= 7
        ? "Weighted moving average dengan pembobotan faktor musiman hari"
        : "Weighted moving average (tanpa faktor musiman karena data kurang dari 7 hari)";
  }

  return {
    forecastDays,
    totalProjectedRevenue,
    totalProjectedOrders,
    totalProjectedCustomers,
    dailyAverageProjectedRevenue: horizonDays > 0 ? Math.round(totalProjectedRevenue / horizonDays) : 0,
    hasSufficientData,
    methodology,
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
