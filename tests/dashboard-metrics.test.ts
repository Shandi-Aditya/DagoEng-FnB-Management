import { describe, expect, it } from "vitest";

import {
  averageOrderValue,
  bucketDayOfWeekTraffic,
  bucketHourly,
  bucketLastSevenDays,
  buildUnitBreakdown,
  calculatePeriodComparison,
  calculateSalesForecast,
  findPeakAndQuietHours,
  formatCompactIDR,
  getPreviousPeriodRange,
  resolveComparisonRange,
  splitPromoOrders,
} from "@/features/dashboard/dashboard-metrics";

const NOW = new Date("2026-11-11T10:00:00.000Z");

function order(
  total: number,
  createdAt: string,
  extra: { discount?: number; promoId?: string; customerCount?: number } = {},
) {
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
    [-850, "-Rp 850"],
    [12_000, "Rp 12 rb"],
    [-12_000, "-Rp 12 rb"],
    [1_500_000, "Rp 1,5 jt"],
    [-1_500_000, "-Rp 1,5 jt"],
    [2_000_000, "Rp 2 jt"],
    [3_200_000_000, "Rp 3,2 M"],
    [-3_200_000_000, "-Rp 3,2 M"],
  ])("formats %d as %s", (value, expected) => {
    expect(formatCompactIDR(value)).toBe(expected);
  });
});

describe("findPeakAndQuietHours", () => {
  it("identifies busiest and quietest hours based on order count", () => {
    const slots = bucketHourly([
      order(20_000, "2026-11-11T11:30:00", { customerCount: 2 }),
      order(20_000, "2026-11-11T12:00:00", { customerCount: 1 }),
      order(20_000, "2026-11-11T12:30:00", { customerCount: 4 }), // 12:00 has 3 orders
      order(50_000, "2026-11-11T18:00:00", { customerCount: 10 }), // 18:00 has 1 order, 10 customers
    ]);

    const result = findPeakAndQuietHours(slots, "orders");
    expect(result.busiest?.hour).toBe("12:00");
    expect(result.busiest?.orders).toBe(3);
    expect(result.quietest?.hour).toBe("08:00");
    expect(result.quietest?.orders).toBe(0);
  });

  it("identifies busiest and quietest hours based on customer count", () => {
    const slots = bucketHourly([
      order(20_000, "2026-11-11T12:00:00", { customerCount: 2 }),
      order(50_000, "2026-11-11T18:00:00", { customerCount: 15 }),
    ]);

    const result = findPeakAndQuietHours(slots, "customers");
    expect(result.busiest?.hour).toBe("18:00");
    expect(result.busiest?.customers).toBe(15);
  });

  it("returns null for slots with zero total traffic", () => {
    const slots = bucketHourly([]);
    const result = findPeakAndQuietHours(slots, "orders");
    expect(result.busiest).toBeNull();
    expect(result.quietest).toBeNull();
  });
});

describe("bucketDayOfWeekTraffic", () => {
  it("aggregates traffic and sales starting with Senin and ending with Minggu", () => {
    // 2026-11-09 is Monday, 2026-11-14 is Saturday
    const dow = bucketDayOfWeekTraffic([
      order(100_000, "2026-11-09T10:00:00", { customerCount: 3 }),
      order(250_000, "2026-11-14T15:00:00", { customerCount: 5 }),
    ]);

    expect(dow).toHaveLength(7);
    expect(dow.map((d) => d.dayName)).toEqual([
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
      "Minggu",
    ]);

    const monday = dow.find((d) => d.dayName === "Senin");
    expect(monday).toMatchObject({ revenue: 100_000, orders: 1, customers: 3 });

    const saturday = dow.find((d) => d.dayName === "Sabtu");
    expect(saturday).toMatchObject({ revenue: 250_000, orders: 1, customers: 5 });

    const sunday = dow.find((d) => d.dayName === "Minggu");
    expect(sunday).toMatchObject({ revenue: 0, orders: 0, customers: 0 });
  });
});

describe("getPreviousPeriodRange", () => {
  it("calculates preceding equivalent period for a 7-day range", () => {
    const prev = getPreviousPeriodRange("2026-11-08", "2026-11-14");
    expect(prev).toEqual({
      startDate: "2026-11-01",
      endDate: "2026-11-07",
    });
  });

  it("calculates preceding single day for a 1-day range", () => {
    const prev = getPreviousPeriodRange("2026-11-10", "2026-11-10");
    expect(prev).toEqual({
      startDate: "2026-11-09",
      endDate: "2026-11-09",
    });
  });

  it("safely handles empty or malformed dates without throwing RangeError", () => {
    const prev = getPreviousPeriodRange("", "invalid");
    expect(prev).toHaveProperty("startDate");
    expect(prev).toHaveProperty("endDate");
    expect(/^\d{4}-\d{2}-\d{2}$/.test(prev.startDate)).toBe(true);
    expect(/^\d{4}-\d{2}-\d{2}$/.test(prev.endDate)).toBe(true);
  });
});

describe("calculatePeriodComparison", () => {
  it("computes accurate percentage and nominal deltas between two periods", () => {
    const currentOrders = [
      order(120_000, "2026-11-10T10:00:00", { customerCount: 4 }),
      order(80_000, "2026-11-11T12:00:00", { customerCount: 2 }),
    ]; // Current: 200_000 rev, 2 orders, 6 customers

    const previousOrders = [
      order(100_000, "2026-11-03T10:00:00", { customerCount: 3 }),
    ]; // Previous: 100_000 rev, 1 order, 3 customers

    const comparison = calculatePeriodComparison(
      currentOrders,
      previousOrders,
      { startDate: "2026-11-08", endDate: "2026-11-14" },
      { startDate: "2026-11-01", endDate: "2026-11-07" },
    );

    expect(comparison.current.revenue).toBe(200_000);
    expect(comparison.current.orders).toBe(2);
    expect(comparison.current.customers).toBe(6);

    expect(comparison.previous.revenue).toBe(100_000);
    expect(comparison.previous.orders).toBe(1);
    expect(comparison.previous.customers).toBe(3);

    expect(comparison.deltas.revenueAmount).toBe(100_000);
    expect(comparison.deltas.revenuePercent).toBe(100);
    expect(comparison.deltas.ordersCount).toBe(1);
    expect(comparison.deltas.ordersPercent).toBe(100);
    expect(comparison.deltas.customersCount).toBe(3);
    expect(comparison.deltas.customersPercent).toBe(100);
  });
});

describe("calculateSalesForecast", () => {
  it("projects next 7 days based on historical daily data", () => {
    const historical = [
      { date: "2026-11-01", day: "Min", isToday: false, revenue: 100_000, cost: 38_000, discount: 0, orders: 5, customers: 10 },
      { date: "2026-11-02", day: "Sen", isToday: false, revenue: 100_000, cost: 38_000, discount: 0, orders: 5, customers: 10 },
      { date: "2026-11-03", day: "Sel", isToday: false, revenue: 100_000, cost: 38_000, discount: 0, orders: 5, customers: 10 },
      { date: "2026-11-04", day: "Rab", isToday: false, revenue: 100_000, cost: 38_000, discount: 0, orders: 5, customers: 10 },
      { date: "2026-11-05", day: "Kam", isToday: false, revenue: 100_000, cost: 38_000, discount: 0, orders: 5, customers: 10 },
      { date: "2026-11-06", day: "Jum", isToday: false, revenue: 100_000, cost: 38_000, discount: 0, orders: 5, customers: 10 },
      { date: "2026-11-07", day: "Sab", isToday: false, revenue: 100_000, cost: 38_000, discount: 0, orders: 5, customers: 10 },
    ];

    const forecast = calculateSalesForecast(historical, 7);
    expect(forecast.hasSufficientData).toBe(true);
    expect(forecast.forecastDays).toHaveLength(7);
    expect(forecast.forecastDays[0].date).toBe("2026-11-08");
    expect(forecast.totalProjectedRevenue).toBe(700_000);
    expect(forecast.dailyAverageProjectedRevenue).toBe(100_000);
    expect(forecast.forecastDays[0].lowerBoundRevenue).toBeLessThan(forecast.forecastDays[0].projectedRevenue);
    expect(forecast.forecastDays[0].upperBoundRevenue).toBeGreaterThan(forecast.forecastDays[0].projectedRevenue);
  });

  it("projects weighted moving average giving more weight to recent spikes than flat mean", () => {
    const historical = [
      { date: "2026-11-01", day: "Min", isToday: false, revenue: 100_000, cost: 38_000, discount: 0, orders: 2, customers: 2 },
      { date: "2026-11-02", day: "Sen", isToday: false, revenue: 100_000, cost: 38_000, discount: 0, orders: 2, customers: 2 },
      { date: "2026-11-03", day: "Sel", isToday: false, revenue: 100_000, cost: 38_000, discount: 0, orders: 2, customers: 2 },
      { date: "2026-11-04", day: "Rab", isToday: false, revenue: 100_000, cost: 38_000, discount: 0, orders: 2, customers: 2 },
      { date: "2026-11-05", day: "Kam", isToday: false, revenue: 100_000, cost: 38_000, discount: 0, orders: 2, customers: 2 },
      { date: "2026-11-06", day: "Jum", isToday: false, revenue: 100_000, cost: 38_000, discount: 0, orders: 2, customers: 2 },
      { date: "2026-11-07", day: "Sab", isToday: false, revenue: 280_000, cost: 106_400, discount: 0, orders: 7, customers: 7 },
    ];
    const flatMean = (100_000 * 6 + 280_000) / 7;

    const forecast = calculateSalesForecast(historical, 7, "WEIGHTED_MOVING_AVERAGE");
    expect(forecast.hasSufficientData).toBe(true);
    expect(forecast.dailyAverageProjectedRevenue).toBeGreaterThan(flatMean);
    // On a 7-day cycle with normalized DOW multipliers, the average projected day equals the WMA (~145k)
    expect(forecast.dailyAverageProjectedRevenue).toBeGreaterThan(140_000);
  });

  it("projects linear upward trend for revenue and orders with LINEAR_REGRESSION method", () => {
    const historical = [
      { date: "2026-11-01", day: "Min", isToday: false, revenue: 100_000, cost: 38_000, discount: 0, orders: 1, customers: 1 },
      { date: "2026-11-02", day: "Sen", isToday: false, revenue: 200_000, cost: 76_000, discount: 0, orders: 2, customers: 2 },
      { date: "2026-11-03", day: "Sel", isToday: false, revenue: 300_000, cost: 114_000, discount: 0, orders: 3, customers: 3 },
      { date: "2026-11-04", day: "Rab", isToday: false, revenue: 400_000, cost: 152_000, discount: 0, orders: 4, customers: 4 },
      { date: "2026-11-05", day: "Kam", isToday: false, revenue: 500_000, cost: 190_000, discount: 0, orders: 5, customers: 5 },
    ];

    const forecast = calculateSalesForecast(historical, 3, "LINEAR_REGRESSION");
    expect(forecast.hasSufficientData).toBe(true);
    expect(forecast.methodology).toContain("Linear regression");
    expect(forecast.forecastDays).toHaveLength(3);
    expect(forecast.forecastDays[0].projectedRevenue).toBe(600_000);
    expect(forecast.forecastDays[1].projectedRevenue).toBe(700_000);
    expect(forecast.forecastDays[2].projectedRevenue).toBe(800_000);
    expect(forecast.forecastDays[0].projectedOrders).toBe(6);
    expect(forecast.forecastDays[1].projectedOrders).toBe(7);
    expect(forecast.forecastDays[2].projectedOrders).toBe(8);
  });

  it("marks single-day historical data as insufficient and avoids claiming regression/WMA", () => {
    const forecast = calculateSalesForecast(
      [{ date: "2026-11-01", day: "Min", isToday: false, revenue: 150_000, cost: 57_000, discount: 0, orders: 3, customers: 4 }],
      7,
      "LINEAR_REGRESSION"
    );
    expect(forecast.hasSufficientData).toBe(false);
    expect(forecast.methodology).not.toContain("Linear regression");
    expect(forecast.methodology).toContain("kurang dari 3 hari");
  });

  it("handles empty historical series without crashing", () => {
    const forecast = calculateSalesForecast([], 7);
    expect(forecast.hasSufficientData).toBe(false);
    expect(forecast.forecastDays).toHaveLength(0);
    expect(forecast.totalProjectedRevenue).toBe(0);
  });
});

describe("resolveComparisonRange", () => {
  it("resolves PREVIOUS_PERIOD shifting backward by period length", () => {
    const range = resolveComparisonRange("2026-11-10", "2026-11-16", "PREVIOUS_PERIOD");
    expect(range.startDate).toBe("2026-11-03");
    expect(range.endDate).toBe("2026-11-09");
    expect(range.label).toBe("Periode sebelumnya");
  });

  it("resolves LAST_WEEK shifting backward by 7 days", () => {
    const range = resolveComparisonRange("2026-11-10", "2026-11-16", "LAST_WEEK");
    expect(range.startDate).toBe("2026-11-03");
    expect(range.endDate).toBe("2026-11-09");
    expect(range.label).toBe("Minggu lalu");
  });

  it("resolves LAST_MONTH shifting backward by one month and clamping month-end dates", () => {
    const range = resolveComparisonRange("2026-11-10", "2026-11-16", "LAST_MONTH");
    expect(range.startDate).toBe("2026-10-10");
    expect(range.endDate).toBe("2026-10-16");
    expect(range.label).toBe("Bulan lalu");

    const marRange = resolveComparisonRange("2026-03-01", "2026-03-31", "LAST_MONTH");
    expect(marRange.startDate).toBe("2026-02-01");
    expect(marRange.endDate).toBe("2026-02-28");

    const mayRange = resolveComparisonRange("2026-05-31", "2026-05-31", "LAST_MONTH");
    expect(mayRange.startDate).toBe("2026-04-30");
    expect(mayRange.endDate).toBe("2026-04-30");
  });

  it("resolves CUSTOM range when provided and handles malformed inputs safely", () => {
    const range = resolveComparisonRange("2026-11-10", "2026-11-16", "CUSTOM", {
      startDate: "2026-10-01",
      endDate: "2026-10-07",
    });
    expect(range.startDate).toBe("2026-10-01");
    expect(range.endDate).toBe("2026-10-07");
    expect(range.label).toBe("Periode kustom");

    const bad = resolveComparisonRange("2026-99-99", "not-a-date", "LAST_MONTH");
    expect(/^\d{4}-\d{2}-\d{2}$/.test(bad.startDate)).toBe(true);
    expect(/^\d{4}-\d{2}-\d{2}$/.test(bad.endDate)).toBe(true);
  });
});

describe("WITA midnight boundary & zero-baseline comparison", () => {
  it("maps UTC 17:00:00Z into the next WITA calendar day and 01:00 hour slot", () => {
    // 2026-11-11T17:00:00.000Z === 2026-11-12T01:00:00+08:00 (WITA)
    const utcEveningOrder = order(75_000, "2026-11-11T17:00:00.000Z", { customerCount: 2 });
    const days = bucketLastSevenDays([utcEveningOrder], new Date("2026-11-12T04:00:00.000Z"));
    expect(days.find((d) => d.date === "2026-11-12")?.revenue).toBe(75_000);
    expect(days.find((d) => d.date === "2026-11-11")?.revenue).toBe(0);

    const hourly = bucketHourly([utcEveningOrder]);
    expect(hourly.find((h) => h.hour === "08:00")?.orders).toBe(1);
  });

  it("returns null percentages and false baseline flags when previous period is zero", () => {
    const comparison = calculatePeriodComparison(
      [order(120_000, "2026-11-10T10:00:00", { customerCount: 2 })],
      [],
      { startDate: "2026-11-08", endDate: "2026-11-14" },
      { startDate: "2026-11-01", endDate: "2026-11-07" }
    );
    expect(comparison.deltas.hasRevenueBaseline).toBe(false);
    expect(comparison.deltas.revenuePercent).toBeNull();
    expect(comparison.deltas.hasOrdersBaseline).toBe(false);
    expect(comparison.deltas.ordersPercent).toBeNull();
    expect(comparison.deltas.hasCustomersBaseline).toBe(false);
    expect(comparison.deltas.customersPercent).toBeNull();
    expect(comparison.deltas.revenueAmount).toBe(120_000);
  });
});
