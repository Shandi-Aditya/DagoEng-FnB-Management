import type { BusinessUnit } from "@/components/app/unit-dot";

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

/** Seven daily buckets ending today (UTC dates). Orders outside the window are ignored. */
export function bucketLastSevenDays(orders: readonly MetricOrder[], now: Date = new Date()): DayBucket[] {
  const days: DayBucket[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - offset);
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
    const bucket = order.createdAt ? byDate.get(order.createdAt.slice(0, 10)) : undefined;
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

/** Revenue and order counts per two-hour slot (local time). */
export function bucketHourly(orders: readonly MetricOrder[]): HourBucket[] {
  const slots = new Map<string, HourBucket>(HOUR_SLOTS.map((hour) => [hour, { hour, revenue: 0, orders: 0 }]));
  for (const order of orders) {
    if (!order.createdAt) continue;
    const slot = slots.get(slotForHour(new Date(order.createdAt).getHours()));
    if (!slot) continue;
    slot.revenue += order.total || 0;
    slot.orders += 1;
  }
  return [...slots.values()];
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
