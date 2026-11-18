import type { BusinessUnit } from "@/components/app/unit-dot";
import {
  formatWitaDateTime,
  getTodayWitaDateString,
  getWitaHour,
  normalizeDateRange,
  toWitaDateKey,
} from "@/contexts/DateFilterContext";
import { calculateSettlement, resolveItemTenantId } from "@/lib/settlement";
import type { OrderRecord } from "@/types/order";

/** Minimal order shape the dashboard metrics need. */
export interface MetricOrder {
  total: number;
  createdAt?: string;
  discount?: number;
  promoId?: string;
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
  }

  return days;
}

export interface HourBucket {
  hour: string;
  revenue: number;
  orders: number;
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

/** Revenue and order counts per two-hour slot in WITA. */
export function bucketHourly(orders: readonly MetricOrder[]): HourBucket[] {
  const slots = new Map<string, HourBucket>(HOUR_SLOTS.map((hour) => [hour, { hour, revenue: 0, orders: 0 }]));
  for (const order of orders) {
    if (!order.createdAt) continue;
    const hour = getWitaHour(order.createdAt);
    if (hour === null) continue;
    const slot = slots.get(slotForHour(hour));
    if (!slot) continue;
    slot.revenue += order.total || 0;
    slot.orders += 1;
  }
  return [...slots.values()];
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

export function computeDashboardFnbRevenue(
  paidOrders: readonly OrderRecord[],
  options: { isTenantOwner?: boolean; tenantId?: string }
): number {
  if (options.isTenantOwner && options.tenantId) {
    const settlements = calculateSettlement(paidOrders as OrderRecord[]);
    return settlements.find((s) => s.tenantId === options.tenantId)?.tenantShareAmount ?? 0;
  }
  return paidOrders.reduce((sum, order) => sum + (order.total || 0), 0);
}

export function projectDashboardOrdersForTenant(
  paidOrders: readonly OrderRecord[],
  tenantId: string
): OrderRecord[] {
  return paidOrders.map((order) => {
    const tenantSettlement = calculateSettlement([order]).find((s) => s.tenantId === tenantId);
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
  if (value >= 1_000_000_000) return `Rp ${compactNumber.format(value / 1_000_000_000)} M`;
  if (value >= 1_000_000) return `Rp ${compactNumber.format(value / 1_000_000)} jt`;
  if (value >= 1_000) return `Rp ${Math.round(value / 1_000)} rb`;
  return `Rp ${value.toLocaleString("id-ID")}`;
}
