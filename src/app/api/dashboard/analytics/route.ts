import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getPersistentOrders } from "@/lib/persistent-storage";
import { getRequestAuthUser } from "@/lib/server-auth";
import { normalizeTenantId } from "@/features/orders/orders-domain";
import { toWitaDateKey } from "@/lib/date-utils";
import {
  averageOrderValue,
  bucketDayOfWeekTraffic,
  bucketHourly,
  bucketOrdersByDateRange,
  calculatePeriodComparison,
  calculateSalesForecast,
  extractOrderCustomerCount,
  findPeakAndQuietHours,
  resolveComparisonRange,
  type ComparisonMode,
  type ForecastMethod,
  type MetricOrder,
  type TrafficMetric,
} from "@/features/dashboard/dashboard-metrics";

export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    // Allow dashboard access for authenticated managerial and staff roles, or fallback for internal dev
    if (auth.isAuthenticated && auth.role && ["WAITER", "CUSTOMER"].includes(auth.role)) {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN: Peran ini tidak memiliki akses ke metrik analitik dashboard." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const today = new Date().toISOString().slice(0, 10);
    const startDate = searchParams.get("startDate") || `${today.slice(0, 8)}01`;
    const endDate = searchParams.get("endDate") || today;
    const outletId = searchParams.get("outletId");
    const compareMode = (searchParams.get("compareMode") as ComparisonMode) || "PREVIOUS_PERIOD";
    const compareStartDate = searchParams.get("compareStartDate") || undefined;
    const compareEndDate = searchParams.get("compareEndDate") || undefined;
    const metric = (searchParams.get("metric") as TrafficMetric) || "orders";
    const forecastMethod =
      (searchParams.get("forecastMethod") as ForecastMethod) || "WEIGHTED_MOVING_AVERAGE";

    const scopedTenantId =
      (auth.scopeLevel === "TENANT" || auth.role === "KITCHEN_STAFF") && auth.tenantId
        ? normalizeTenantId(auth.tenantId)
        : searchParams.get("tenantId") || undefined;

    const compareRange = resolveComparisonRange(
      startDate,
      endDate,
      compareMode,
      compareStartDate && compareEndDate
        ? { startDate: compareStartDate, endDate: compareEndDate }
        : undefined
    );

    // 1. Efficient Prisma database query
    let allOrders: MetricOrder[] = [];
    try {
      const minDate = compareRange.startDate < startDate ? compareRange.startDate : startDate;
      const prismaOrders = await db.order.findMany({
        where: {
          paymentStatus: "PAID",
          createdAt: {
            gte: new Date(`${minDate}T00:00:00.000Z`),
            lte: new Date(`${endDate}T23:59:59.999Z`),
          },
          ...(outletId && outletId !== "ALL" ? { outletId } : {}),
        },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          discountAmount: true,
          createdAt: true,
          customerName: true,
          outletId: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      if (prismaOrders.length > 0) {
        allOrders = prismaOrders.map((o) => ({
          total: o.totalAmount,
          createdAt: o.createdAt.toISOString(),
          discount: o.discountAmount,
          customerCount: 1,
          customerName: o.customerName,
        }));
      }
    } catch {
      // Prisma table may be unmigrated or empty, proceed to persistent fallback
    }

    // 2. Persistent storage fallback (Single Source of Truth for local POS sync)
    if (allOrders.length === 0) {
      const stored = await getPersistentOrders();
      allOrders = stored
        .filter((o) => {
          if (o.status === "CANCELLED" || o.paymentStatus !== "PAID") return false;
          if (outletId && outletId !== "ALL" && o.outletId && o.outletId !== outletId) return false;
          if (scopedTenantId && o.tenantId && o.tenantId !== scopedTenantId) return false;
          return true;
        })
        .map((o) => ({
          total: o.total || 0,
          createdAt: o.createdAt,
          discount: o.discount || 0,
          promoId: o.promoId,
          customerCount: extractOrderCustomerCount(o),
          customerName: o.customerName,
          corporateInfo: o.corporateInfo,
        }));
    }

    // 3. Filter orders into current and comparison periods
    const currentOrders = allOrders.filter((o) => {
      if (!o.createdAt) return false;
      const dKey = toWitaDateKey(o.createdAt);
      return Boolean(dKey) && dKey >= startDate && dKey <= endDate;
    });

    const compareOrders = allOrders.filter((o) => {
      if (!o.createdAt) return false;
      const dKey = toWitaDateKey(o.createdAt);
      return Boolean(dKey) && dKey >= compareRange.startDate && dKey <= compareRange.endDate;
    });

    // 4. Compute domain analytics
    const hourly = bucketHourly(currentOrders);
    const peakAndQuiet = findPeakAndQuietHours(hourly, metric);
    const dayOfWeek = bucketDayOfWeekTraffic(currentOrders);
    const daily = bucketOrdersByDateRange(currentOrders, startDate, endDate);
    const comparison = calculatePeriodComparison(
      currentOrders,
      compareOrders,
      { startDate, endDate },
      compareRange
    );
    const forecast = calculateSalesForecast(daily, 7, forecastMethod);

    const totalRevenue = daily.reduce((sum, d) => sum + d.revenue, 0);
    const totalOrders = daily.reduce((sum, d) => sum + d.orders, 0);
    const totalCustomers = currentOrders.reduce((sum, o) => sum + extractOrderCustomerCount(o), 0);

    return NextResponse.json({
      success: true,
      data: {
        period: {
          startDate,
          endDate,
          compareMode,
          compareStartDate: compareRange.startDate,
          compareEndDate: compareRange.endDate,
          compareLabel: compareRange.label,
        },
        summary: {
          revenue: totalRevenue,
          orders: totalOrders,
          customers: totalCustomers,
          averageOrderValue: averageOrderValue(totalRevenue, totalOrders),
        },
        peakHours: {
          slots: hourly,
          busiest: peakAndQuiet.busiest,
          quietest: peakAndQuiet.quietest,
          metric,
        },
        dayOfWeek,
        daily,
        comparison,
        forecast,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan internal pada server analitik.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
