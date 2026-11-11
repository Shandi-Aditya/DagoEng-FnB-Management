import { describe, expect, it } from "vitest";

import {
  averageOrderValue,
  bucketHourly,
  bucketLastSevenDays,
  buildUnitBreakdown,
  formatCompactIDR,
  splitPromoOrders,
} from "@/features/dashboard/dashboard-metrics";

const NOW = new Date("2026-11-11T10:00:00.000Z");

function order(total: number, createdAt: string, extra: { discount?: number; promoId?: string } = {}) {
  return { total, createdAt, ...extra };
}

describe("buildUnitBreakdown", () => {
  it("computes proportional shares that add up to 100", () => {
    const units = buildUnitBreakdown({
      fnbRevenue: 600_000,
      coworkingRevenue: 300_000,
      eventRevenue: 100_000,
      coworkingBookings: 3,
      ticketsSold: 5,
      isCoworkingActive: true,
    });

    expect(units.map((unit) => [unit.unit, unit.sharePercent])).toEqual([
      ["fnb", 60],
      ["coworking", 30],
      ["event", 10],
    ]);
  });

  it("returns zero shares when there is no revenue", () => {
    const units = buildUnitBreakdown({
      fnbRevenue: 0,
      coworkingRevenue: 0,
      eventRevenue: 0,
      coworkingBookings: 0,
      ticketsSold: 0,
      isCoworkingActive: true,
    });

    expect(units.every((unit) => unit.sharePercent === 0)).toBe(true);
  });

  it("marks co-working inactive when the module is off", () => {
    const units = buildUnitBreakdown({
      fnbRevenue: 1,
      coworkingRevenue: 0,
      eventRevenue: 0,
      coworkingBookings: 0,
      ticketsSold: 0,
      isCoworkingActive: false,
    });

    expect(units.find((unit) => unit.unit === "coworking")?.isActive).toBe(false);
    expect(units.find((unit) => unit.unit === "fnb")?.isActive).toBe(true);
  });

  it("describes bookings and tickets in plain words", () => {
    const units = buildUnitBreakdown({
      fnbRevenue: 0,
      coworkingRevenue: 0,
      eventRevenue: 0,
      coworkingBookings: 4,
      ticketsSold: 12,
      isCoworkingActive: true,
    });

    expect(units.find((unit) => unit.unit === "coworking")?.detail).toBe("4 booking");
    expect(units.find((unit) => unit.unit === "event")?.detail).toBe("12 tiket terjual · biaya platform 20%");
  });
});

describe("averageOrderValue", () => {
  it("divides revenue by transactions and rounds", () => {
    expect(averageOrderValue(100_000, 3)).toBe(33_333);
  });

  it("returns zero without transactions", () => {
    expect(averageOrderValue(50_000, 0)).toBe(0);
  });
});

describe("bucketLastSevenDays", () => {
  it("returns seven days ending today with Indonesian short day names", () => {
    const days = bucketLastSevenDays([], NOW);

    expect(days).toHaveLength(7);
    expect(days[6]).toMatchObject({ date: "2026-11-11", isToday: true });
    expect(days[0].date).toBe("2026-11-05");
    expect(days.map((day) => day.day)).toEqual(["Kam", "Jum", "Sab", "Min", "Sen", "Sel", "Rab"]);
  });

  it("sums revenue, discount and estimated cost per day", () => {
    const days = bucketLastSevenDays(
      [order(100_000, "2026-11-10T08:00:00.000Z", { discount: 5_000 }), order(50_000, "2026-11-10T09:00:00.000Z")],
      NOW,
    );
    const monday = days.find((day) => day.date === "2026-11-10");

    expect(monday).toMatchObject({ revenue: 150_000, discount: 5_000, cost: 57_000, orders: 2 });
  });

  it("ignores orders outside the seven-day window instead of counting them as today", () => {
    const days = bucketLastSevenDays([order(80_000, "2026-10-01T08:00:00.000Z")], NOW);

    expect(days.reduce((sum, day) => sum + day.revenue, 0)).toBe(0);
  });
});

describe("bucketHourly", () => {
  it("groups orders into two-hour slots from 08:00 to 22:00", () => {
    const slots = bucketHourly(
      [order(10_000, "2026-11-11T11:40:00"), order(20_000, "2026-11-11T12:30:00"), order(5_000, "2026-11-11T23:00:00")],
    );

    expect(slots.map((slot) => slot.hour)).toEqual(["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"]);
    expect(slots.find((slot) => slot.hour === "12:00")).toMatchObject({ revenue: 30_000, orders: 2 });
    expect(slots.find((slot) => slot.hour === "22:00")).toMatchObject({ revenue: 5_000, orders: 1 });
  });
});

describe("splitPromoOrders", () => {
  it("separates promo and regular revenue", () => {
    const [promo, regular] = splitPromoOrders([
      order(90_000, "2026-11-11T08:00:00.000Z", { discount: 10_000 }),
      order(40_000, "2026-11-11T08:00:00.000Z", { promoId: "p1" }),
      order(60_000, "2026-11-11T08:00:00.000Z"),
    ]);

    expect(promo).toMatchObject({ name: "Promo", revenue: 130_000, discount: 10_000, orders: 2 });
    expect(regular).toMatchObject({ name: "Reguler", revenue: 60_000, discount: 0, orders: 1 });
  });
});

describe("formatCompactIDR", () => {
  it.each([
    [0, "Rp 0"],
    [850, "Rp 850"],
    [12_000, "Rp 12 rb"],
    [1_500_000, "Rp 1,5 jt"],
    [2_000_000, "Rp 2 jt"],
    [3_200_000_000, "Rp 3,2 M"],
  ])("formats %d as %s", (value, expected) => {
    expect(formatCompactIDR(value)).toBe(expected);
  });
});
