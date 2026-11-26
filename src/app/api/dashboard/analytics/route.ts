import { NextRequest, NextResponse } from "next/server";

import { getPersistentOrders } from "@/lib/persistent-storage";
import { getRequestAuthUser } from "@/lib/server-auth";
import { normalizeTenantId } from "@/features/orders/orders-domain";
import { getTodayWitaDateString, normalizeDateRange, toWitaDateKey } from "@/lib/date-utils";
import {
  averageOrderValue,
  bucketDayOfWeekTraffic,
  bucketHourly,
  bucketOrdersByDateRange,
  calculatePeriodComparison,
  calculateSalesForecast,
  extractOrderCustomerCount,
  findPeakAndQuietHours,
  projectDashboardOrdersForTenant,
  resolveComparisonRange,
  scopeDashboardOrders,
  type ComparisonMode,
  type ForecastMethod,
  type TrafficMetric,
} from "@/features/dashboard/dashboard-metrics";

const ANALYTICS_ALLOWED_ROLES: ReadonlySet<string> = new Set([
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "TENANT_OWNER",
]);

function parseComparisonMode(raw: string | null): ComparisonMode {
  if (
    raw === "PREVIOUS_PERIOD" ||
    raw === "LAST_WEEK" ||
    raw === "LAST_MONTH" ||
    raw === "CUSTOM"
  ) {
    return raw;
  }
  return "PREVIOUS_PERIOD";
}

function parseTrafficMetric(raw: string | null): TrafficMetric {
  return raw === "customers" ? "customers" : "orders";
}

function parseForecastMethod(raw: string | null): ForecastMethod {
  return raw === "LINEAR_REGRESSION" ? "LINEAR_REGRESSION" : "WEIGHTED_MOVING_AVERAGE";
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { success: false, error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    if (!ANALYTICS_ALLOWED_ROLES.has(auth.role)) {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN: Peran ini tidak memiliki akses ke metrik analitik dashboard." },
        { status: 403 }
      );
    }

    const isTenantScoped = auth.scopeLevel === "TENANT" || String(auth.role) === "TENANT_OWNER";
    const normalizedAuthTenant = auth.tenantId ? normalizeTenantId(auth.tenantId) : undefined;
    if (isTenantScoped && !normalizedAuthTenant) {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN: Akun tenant tidak memiliki identitas tenant yang valid." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const today = getTodayWitaDateString();
    const rawStartDate = searchParams.get("startDate") || `${today.slice(0, 8)}01`;
    const rawEndDate = searchParams.get("endDate") || today;
    const { startDate, endDate } = normalizeDateRange(rawStartDate, rawEndDate, today);

    const outletId = searchParams.get("outletId");
    const compareMode = parseComparisonMode(searchParams.get("compareMode"));
    const rawCompareStartDate = searchParams.get("compareStartDate") || undefined;
    const rawCompareEndDate = searchParams.get("compareEndDate") || undefined;
    const customCompareRange =
      rawCompareStartDate && rawCompareEndDate
        ? normalizeDateRange(rawCompareStartDate, rawCompareEndDate, today)
        : undefined;
    const effectiveCompareMode: ComparisonMode =
      compareMode === "CUSTOM" && !customCompareRange ? "PREVIOUS_PERIOD" : compareMode;
    const metric = parseTrafficMetric(searchParams.get("metric"));
    const forecastMethod = parseForecastMethod(searchParams.get("forecastMethod"));

    const requestedTenantId = isTenantScoped ? null : searchParams.get("tenantId");
    const scopedTenantId = isTenantScoped
      ? normalizedAuthTenant
      : normalizedAuthTenant || (requestedTenantId ? normalizeTenantId(requestedTenantId) : undefined);

    const compareRange = resolveComparisonRange(
      startDate,
      endDate,
      effectiveCompareMode,
      customCompareRange
    );

    // Single authoritative source aligned with GET /api/orders
    const storedOrders = await getPersistentOrders();
    const outletScopedOrders =
      outletId && outletId !== "ALL"
        ? storedOrders.filter((o) => o.outletId === outletId)
        : storedOrders;

    const paidScopedOrders = scopeDashboardOrders(outletScopedOrders, {
      tenantId: scopedTenantId,
      isTenantOwner: Boolean(scopedTenantId),
      requirePaid: true,
    });

    const allOrders = scopedTenantId
      ? projectDashboardOrdersForTenant(paidScopedOrders, scopedTenantId)
      : paidScopedOrders;

    // Filter orders into current and comparison periods using WITA calendar day keys
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

    // Compute domain analytics
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

    const totalRevenue = currentOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalOrders = currentOrders.length;
    const totalCustomers = currentOrders.reduce((sum, o) => sum + extractOrderCustomerCount(o), 0);

    return NextResponse.json({
      success: true,
      data: {
        period: {
          startDate,
          endDate,
          compareMode: effectiveCompareMode,
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
    console.error("[/api/dashboard/analytics]", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan internal pada server analitik." },
      { status: 500 }
    );
  }
}
