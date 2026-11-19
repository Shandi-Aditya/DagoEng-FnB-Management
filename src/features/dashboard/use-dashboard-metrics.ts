"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useCoworking } from "@/contexts/CoworkingContext";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { useOrders } from "@/contexts/OrderContext";
import { useOutlet } from "@/contexts/OutletContext";

import {
  averageOrderValue,
  buildUnitBreakdown,
  computeDashboardFnbRevenue,
  scopeDashboardOrders,
} from "./dashboard-metrics";

export interface PendingActions {
  moderation: number;
  payouts: number;
  revenueSplits: number;
  manualPayments: number;
}

interface EventStats {
  totalRevenue: number;
  ticketsSold: number;
  paidBookingsCount: number;
  platformRevenue: number;
}

const EMPTY_EVENT_STATS: EventStats = {
  totalRevenue: 0,
  ticketsSold: 0,
  paidBookingsCount: 0,
  platformRevenue: 0,
};
const EMPTY_ACTIONS: PendingActions = { moderation: 0, payouts: 0, revenueSplits: 0, manualPayments: 0 };

/* eslint-disable @typescript-eslint/no-explicit-any -- event API payloads are untyped JSON */
function useEventAdminData(enabled: boolean) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [hasLoadedBookings, setHasLoadedBookings] = useState(false);
  const [fallbackStats, setFallbackStats] = useState<EventStats>(EMPTY_EVENT_STATS);
  const [actions, setActions] = useState<PendingActions>(EMPTY_ACTIONS);

  useEffect(() => {
    if (!enabled) return;

    fetch("/api/events/bookings?includeStats=true&unmasked=true")
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) return;
        if (json.stats) {
          setFallbackStats({
            totalRevenue: json.stats.totalTicketRevenue || 0,
            ticketsSold: json.stats.totalTicketsSold || 0,
            paidBookingsCount: json.stats.totalAttendees || 0,
            platformRevenue: json.stats.platformCommissionRevenue || 0,
          });
        }
        if (Array.isArray(json.data)) {
          setBookings(json.data);
          setHasLoadedBookings(true);
          const manualPayments = json.data.filter(
            (b: any) =>
              b.totalPrice > 0 &&
              b.paymentStatus === "PENDING" &&
              (b.paymentMethod === "MANUAL_TRANSFER" || Boolean(b.paymentProofUrl)),
          ).length;
          setActions((prev) => ({ ...prev, manualPayments }));
        }
      })
      .catch(() => {});

    fetch("/api/events/admin")
      .then((res) => res.json())
      .then((json) => {
        if (!json.success || !Array.isArray(json.data)) return;
        const events = json.data;
        const payouts = events.reduce(
          (sum: number, e: any) =>
            sum + (Array.isArray(e.payoutHistory) ? e.payoutHistory.filter((p: any) => p.status === "REQUESTED").length : 0),
          0,
        );
        setActions((prev) => ({
          ...prev,
          moderation: events.filter((e: any) => e.status === "PENDING").length,
          revenueSplits: events.filter((e: any) => e.proposedRevenueSplit?.status === "PENDING").length,
          payouts,
        }));
      })
      .catch(() => {});
  }, [enabled]);

  return { bookings, hasLoadedBookings, fallbackStats, actions };
}

/** All numbers shown on the executive dashboard, scoped to the signed-in user. */
export function useDashboardMetrics() {
  const { user, activeOrgModules } = useAuth();
  const { isDateInRange } = useDateFilter();
  const { filteredOrders } = useOrders();
  const { activeOutletId, isAllOutlets } = useOutlet();
  const { bookings: coworkingBookings } = useCoworking();

  const isDagoOwner =
    (user?.role?.slug === "OWNER" || user?.role?.slug === "SUPER_ADMIN") &&
    (user?.scopeLevel === "ORGANIZATION" || user?.scopeLevel === "PLATFORM");
  const isTenantOwner = user?.scopeLevel === "TENANT" && Boolean(user?.tenant?.id);
  const tenantId = user?.tenant?.id;

  const { bookings: eventBookings, hasLoadedBookings, fallbackStats, actions } = useEventAdminData(isDagoOwner);

  const eventStats = useMemo<EventStats>(() => {
    if (!hasLoadedBookings) return fallbackStats;
    const paidInRange = eventBookings.filter(
      (b: any) => b.paymentStatus === "PAID" && isDateInRange(b.createdAt)
    );
    const paidRevenueBookings = paidInRange.filter(
      (b: any) => (b.totalPrice || 0) > 0 && b.paymentMethod !== "FREE"
    );
    return {
      totalRevenue: paidRevenueBookings.reduce((sum: number, b: any) => sum + (b.totalPrice || 0), 0),
      ticketsSold: paidInRange.reduce((sum: number, b: any) => sum + (b.ticketCount || 1), 0),
      paidBookingsCount: paidRevenueBookings.length,
      platformRevenue: paidRevenueBookings.reduce((sum: number, b: any) => sum + (b.platformFeeAmount || 0), 0),
    };
  }, [eventBookings, hasLoadedBookings, fallbackStats, isDateInRange]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const scopedOrders = useMemo(
    () =>
      scopeDashboardOrders(filteredOrders, {
        tenantId,
        isTenantOwner,
        isDateInRange,
        requirePaid: true,
      }),
    [filteredOrders, isTenantOwner, tenantId, isDateInRange],
  );

  const fnbRevenue = useMemo(
    () => computeDashboardFnbRevenue(scopedOrders, { isTenantOwner, tenantId }),
    [scopedOrders, isTenantOwner, tenantId],
  );

  const paidCoworkingBookings = useMemo(
    () =>
      coworkingBookings.filter(
        (booking) =>
          (isAllOutlets || !booking.outletId || booking.outletId === activeOutletId) &&
          booking.paymentStatus === "PAID" &&
          booking.checkInStatus !== "CANCELLED" &&
          isDateInRange(booking.createdAt || booking.date),
      ),
    [coworkingBookings, isAllOutlets, activeOutletId, isDateInRange],
  );

  const coworkingRevenue = isTenantOwner
    ? 0
    : paidCoworkingBookings.reduce((sum, booking) => sum + (booking.paidAmount || booking.totalAmount || 0), 0);

  const eventRevenue = isDagoOwner ? eventStats.platformRevenue : 0;
  const consolidatedRevenue = fnbRevenue + coworkingRevenue + eventRevenue;
  const revenue = isDagoOwner ? consolidatedRevenue : fnbRevenue;

  const transactions =
    scopedOrders.length + (isDagoOwner ? paidCoworkingBookings.length + eventStats.paidBookingsCount : 0);
  const completedOrders = scopedOrders.filter((order) => order.status === "COMPLETED" || order.status === "SERVED").length;
  const liveTenantOrders = useMemo(
    () =>
      scopeDashboardOrders(filteredOrders, {
        tenantId,
        isTenantOwner,
        requirePaid: false,
      }),
    [filteredOrders, isTenantOwner, tenantId],
  );
  const preparingOrders = liveTenantOrders.filter((order) => {
    const effectiveStatus = (isTenantOwner && tenantId && order.tenantStatuses?.[tenantId]) || order.status;
    return (
      effectiveStatus === "NEW" ||
      effectiveStatus === "CONFIRMED" ||
      effectiveStatus === "KITCHEN_RECEIVED" ||
      effectiveStatus === "COOKING"
    );
  }).length;

  return {
    isDagoOwner,
    isTenantOwner,
    revenue,
    transactions,
    averageOrderValue: averageOrderValue(revenue, transactions),
    activeUnits: activeOrgModules.filter((module) => module !== "CORE").length + 1,
    completedOrders,
    totalOrders: scopedOrders.length,
    preparingOrders,
    pendingActions: actions,
    unitBreakdown: buildUnitBreakdown({
      fnbRevenue,
      coworkingRevenue,
      eventRevenue,
      coworkingBookings: paidCoworkingBookings.length,
      ticketsSold: eventStats.ticketsSold,
      isCoworkingActive: activeOrgModules.includes("CO_WORKING"),
    }),
  };
}
