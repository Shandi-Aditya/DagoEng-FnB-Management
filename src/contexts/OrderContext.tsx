"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { OrderRecord, OrderStatus, OrderStatusHistoryItem } from "@/types/order";
import { useAuth } from "./AuthContext";
import { useOutlet } from "./OutletContext";
import { useDateFilter } from "./DateFilterContext";
import { useActivityLog } from "./ActivityLogContext";
import { useNotifications } from "./NotificationContext";
import {
  ensureGlobalOutboxAutoFlush,
  flushOutbox,
  getOutboxItems,
  OUTBOX_FLUSHED_EVENT,
  reconcileCollectionWithOutbox,
  syncWithOutbox,
} from "@/lib/sync-outbox";
import { getOrderTaxBreakdown } from "@/lib/tax-breakdown";
import {
  generateSequentialReceiptNumber,
  resolvePosReceiptPublisher,
  resolvePublisherCode,
} from "@/lib/receipt-publisher";
import {
  normalizeTenantId,
  resolveNormalizedItemTenantId,
} from "@/features/orders/orders-domain";

const ORDER_SYNC_ENDPOINT = "/api/orders";
const SELF_ORDER_SYNC_ENDPOINT = "/api/orders/self-order";
const orderSyncId = (orderId: string) => `order-sync-${orderId}`;

function isSelfOrderRole(roleSlug?: string | null): boolean {
  return !roleSlug || roleSlug === "CUSTOMER";
}

function hasOrderStateChanged(prev: OrderRecord, next: OrderRecord): boolean {
  return (
    prev.status !== next.status ||
    prev.paymentStatus !== next.paymentStatus ||
    prev.total !== next.total ||
    (prev.statusHistory?.length ?? 0) !== (next.statusHistory?.length ?? 0) ||
    JSON.stringify(prev.tenantStatuses) !== JSON.stringify(next.tenantStatuses)
  );
}

const KITCHEN_STAGE_RANK: Record<OrderStatus, number> = {
  NEW: 0,
  CONFIRMED: 1,
  KITCHEN_RECEIVED: 2,
  COOKING: 3,
  READY: 4,
  SERVED: 5,
  COMPLETED: 6,
  CANCELLED: 7,
};

function computeMultiTenantOverallStatus(
  itemTenants: string[],
  tenantStatuses: Record<string, OrderStatus>,
  fallbackStatus: OrderStatus
): OrderStatus {
  if (itemTenants.length <= 1) {
    return (itemTenants[0] && tenantStatuses[itemTenants[0]]) || fallbackStatus;
  }
  let earliest = fallbackStatus;
  let minRank = KITCHEN_STAGE_RANK[earliest] ?? 0;
  let hasRank = false;
  for (const tid of itemTenants) {
    const stage = tenantStatuses[tid] ?? fallbackStatus;
    const rank = KITCHEN_STAGE_RANK[stage] ?? 0;
    if (!hasRank || rank < minRank) {
      earliest = stage;
      minRank = rank;
      hasRank = true;
    }
  }
  return earliest;
}

export const INITIAL_ORDERS: OrderRecord[] = [];

export interface OrderActionServerSyncResult {
  synced: boolean;
  rejected: boolean;
  error?: string;
}

export interface OrderMutationResult {
  success: boolean;
  error?: string;
  order?: OrderRecord;
  serverSync?: Promise<OrderActionServerSyncResult>;
}

interface OrderContextType {
  orders: OrderRecord[];
  filteredOrders: OrderRecord[];
  advanceOrderStatus: (
    orderId: string,
    nextStatus: OrderStatus,
    note?: string,
    paymentUpdate?: {
      paymentStatus?: "PENDING" | "PAID" | "REFUNDED";
      paymentMethod?: OrderRecord["paymentMethod"];
      qrisVerification?: OrderRecord["qrisVerification"];
      splitDetails?: OrderRecord["splitDetails"];
      cashierName?: string;
      tenantId?: string;
      tax?: number;
      serviceCharge?: number;
    }
  ) => void;
  createOrder: (order: Partial<OrderRecord>) => OrderRecord;
  createPosOrder: (order: Partial<OrderRecord>) => OrderRecord;
  refundOrder: (
    orderId: string,
    params: {
      reason: string;
      supervisorName: string;
      supervisorRole?: string;
      supervisorPin?: string;
      refundMethod?: "CASH";
    }
  ) => OrderMutationResult;
  voidOrder: (
    orderId: string,
    params: {
      reason: string;
      supervisorName: string;
      supervisorRole?: string;
      supervisorPin?: string;
    }
  ) => OrderMutationResult;
  getOrderById: (orderId: string) => OrderRecord | undefined;
  resetOrderData: () => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);
const STORAGE_KEY_ORDERS = "dagoeng_orders_v3";

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeOutletId, activeOutlet, isAllOutlets } = useOutlet();
  const { isDateInRange } = useDateFilter();
  const { logActivity } = useActivityLog();
  const { addNotification } = useNotifications();

  const [orders, setOrders] = useState<OrderRecord[]>(INITIAL_ORDERS);
  const ordersRef = useRef<OrderRecord[]>(INITIAL_ORDERS);
  const pendingSyncOrderIdsRef = useRef<Set<string>>(new Set());
  const userRef = useRef(user);
  userRef.current = user;

  const updateOrdersState = (updater: (prev: OrderRecord[]) => OrderRecord[]) => {
    const next = updater(ordersRef.current);
    ordersRef.current = next;
    setOrders(next);
  };

  const markOrderSync = (
    orderId: string,
    syncStatus: NonNullable<OrderRecord["syncStatus"]>,
    syncError?: string
  ) => {
    updateOrdersState((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, syncStatus, syncError } : o))
    );
  };

  const notifyOrderRejected = (
    order: Pick<OrderRecord, "id" | "orderNumber" | "outletId" | "outletName">,
    error: string
  ) => {
    addNotification({
      type: "SYSTEM_ALERT",
      title: `Transaksi ${order.orderNumber || order.id} ditolak server`,
      detail: error,
      relatedModule: "POS",
      relatedRecordId: order.id,
      actionUrl: "/orders",
      outletId: order.outletId,
      outletName: order.outletName || "",
    });
  };

  const syncOrderToServer = async (
    order: OrderRecord,
    extraPayload: Record<string, unknown> = {},
    rollbackSnapshot?: OrderRecord
  ): Promise<OrderActionServerSyncResult> => {
    if (typeof window === "undefined") return { synced: true, rejected: false };

    const targetEndpoint = isSelfOrderRole(userRef.current?.role?.slug)
      ? SELF_ORDER_SYNC_ENDPOINT
      : ORDER_SYNC_ENDPOINT;

    pendingSyncOrderIdsRef.current.add(order.id);
    try {
      const result = await syncWithOutbox({
        id: orderSyncId(order.id),
        endpoint: targetEndpoint,
        method: "POST",
        payload: { id: order.id, order, ...extraPayload },
      });

      if (result.synced) {
        const serverOrder = result.data?.order as OrderRecord | undefined;
        if (serverOrder?.id) {
          updateOrdersState((prev) =>
            prev.map((o) =>
              o.id === serverOrder.id ? { ...serverOrder, syncStatus: "SYNCED" } : o
            )
          );
        } else {
          markOrderSync(order.id, "SYNCED");
        }
        return { synced: true, rejected: false };
      }

      if (result.rejected) {
        if (rollbackSnapshot) {
          updateOrdersState((prev) =>
            prev.map((o) => (o.id === order.id ? rollbackSnapshot : o))
          );
        } else {
          markOrderSync(order.id, "REJECTED", result.error);
        }
        notifyOrderRejected(order, result.error || "Ditolak server.");
        return { synced: false, rejected: true, error: result.error };
      }

      markOrderSync(order.id, "PENDING", result.error);
      return { synced: false, rejected: false, error: result.error };
    } finally {
      pendingSyncOrderIdsRef.current.delete(order.id);
    }
  };
  const [isInitialized, setIsInitialized] = useState(false);

  const getPendingOutboxOrderIds = (): Set<string> => {
    return new Set(
      getOutboxItems()
        .filter(
          (item) =>
            item.endpoint === ORDER_SYNC_ENDPOINT ||
            item.endpoint === SELF_ORDER_SYNC_ENDPOINT
        )
        .map((item) =>
          String(
            item.payload?.id ||
              (item.payload?.order as OrderRecord | undefined)?.id ||
              ""
          )
        )
        .filter(Boolean)
    );
  };

  const reconcileStaffServerOrders = (
    serverOrders: readonly OrderRecord[],
    localOrders: readonly OrderRecord[]
  ): OrderRecord[] => {
    const outboxItems = getOutboxItems();
    const hasPendingReset = outboxItems.some(
      (item) =>
        item.id === "orders-reset" &&
        item.endpoint === ORDER_SYNC_ENDPOINT &&
        item.method === "DELETE"
    );
    const effectiveBase = hasPendingReset ? [] : serverOrders;
    const pendingOutbox = getPendingOutboxOrderIds();
    const localMap = new Map(localOrders.map((o) => [o.id, o]));

    const adjustedServer = effectiveBase.map((srvOrder) => {
      if (
        (pendingSyncOrderIdsRef.current.has(srvOrder.id) ||
          pendingOutbox.has(srvOrder.id)) &&
        localMap.has(srvOrder.id)
      ) {
        return localMap.get(srvOrder.id)!;
      }
      return srvOrder;
    });

    const reconciled = reconcileCollectionWithOutbox<OrderRecord>({
      serverItems: adjustedServer,
      localItems: localOrders,
      endpoint: ORDER_SYNC_ENDPOINT,
      getId: (o) => o.id,
    });

    const reconciledIds = new Set(reconciled.map((o) => o.id));
    const pendingSelfOrders = reconcileCollectionWithOutbox<OrderRecord>({
      serverItems: [],
      localItems: localOrders,
      endpoint: SELF_ORDER_SYNC_ENDPOINT,
      getId: (o) => o.id,
    }).filter((o) => !reconciledIds.has(o.id));

    const inFlightExtras = localOrders.filter(
      (o) =>
        pendingSyncOrderIdsRef.current.has(o.id) &&
        !reconciledIds.has(o.id) &&
        !pendingSelfOrders.some((p) => p.id === o.id)
    );

    return [...inFlightExtras, ...pendingSelfOrders, ...reconciled];
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ORDERS);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          ordersRef.current = parsed;
          setOrders(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load orders", e);
    } finally {
      setIsInitialized(true);
    }
    ensureGlobalOutboxAutoFlush();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const hydrateStaffOrders = () => {
      fetch("/api/orders")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data || !Array.isArray(data.orders)) return;
          updateOrdersState((prev) => {
            const next = reconcileStaffServerOrders(data.orders, prev);
            if (
              next.length === prev.length &&
              next.every((item, idx) => prev[idx] && !hasOrderStateChanged(prev[idx], item))
            ) {
              return prev;
            }
            return next;
          });
        })
        .catch(() => {});
    };

    const pollSelfOrders = () => {
      const activeIds = ordersRef.current
        .filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED")
        .slice(0, 20)
        .map((o) => o.id);
      if (activeIds.length === 0) return;

      fetch(`/api/orders/self-order?ids=${encodeURIComponent(activeIds.join(","))}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data || !Array.isArray(data.orders) || data.orders.length === 0) {
            return;
          }
          const pendingOutbox = getPendingOutboxOrderIds();
          updateOrdersState((prev) => {
            const srvMap = new Map<string, OrderRecord>(
              (data.orders as OrderRecord[]).map((o) => [o.id, o])
            );
            let changed = false;
            const next = prev.map((localOrder) => {
              if (
                pendingSyncOrderIdsRef.current.has(localOrder.id) ||
                pendingOutbox.has(localOrder.id)
              ) {
                return localOrder;
              }
              const srvOrder = srvMap.get(localOrder.id);
              if (srvOrder && hasOrderStateChanged(localOrder, srvOrder)) {
                changed = true;
                return { ...srvOrder, syncStatus: "SYNCED" as const };
              }
              return localOrder;
            });
            return changed ? next : prev;
          });
        })
        .catch(() => {});
    };

    const runSyncPass = () => {
      if (isSelfOrderRole(userRef.current?.role?.slug)) {
        pollSelfOrders();
      } else {
        hydrateStaffOrders();
      }
    };

    flushOutbox()
      .then(({ rejected }) => {
        if (cancelled) return;
        for (const { item, error } of rejected) {
          const rejectedOrder = item.payload.order as OrderRecord | undefined;
          const isOrderEndpoint =
            item.endpoint === ORDER_SYNC_ENDPOINT ||
            item.endpoint === SELF_ORDER_SYNC_ENDPOINT;
          if (!isOrderEndpoint || !rejectedOrder?.id) continue;
          markOrderSync(rejectedOrder.id, "REJECTED", error);
          notifyOrderRejected(rejectedOrder, error);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          runSyncPass();
        }
      });

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY_ORDERS) return;
      if (event.newValue === null) {
        updateOrdersState(() => []);
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue);
        if (Array.isArray(parsed)) {
          const pendingOutbox = getPendingOutboxOrderIds();
          updateOrdersState((prev) => {
            if (parsed.length === 0 && pendingOutbox.size === 0) {
              return prev.length === 0 ? prev : [];
            }
            const merged = new Map(prev.map((o) => [o.id, o]));
            let changed = false;
            for (const o of parsed as OrderRecord[]) {
              if (pendingSyncOrderIdsRef.current.has(o.id) || pendingOutbox.has(o.id)) {
                continue;
              }
              const existing = merged.get(o.id);
              if (!existing || hasOrderStateChanged(existing, o)) {
                merged.set(o.id, o);
                changed = true;
              }
            }
            return changed ? Array.from(merged.values()) : prev;
          });
        }
      } catch (e) {
        console.error("Failed to parse storage update", e);
      }
    };

    const handleOutboxFlushed = () => {
      runSyncPass();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(OUTBOX_FLUSHED_EVENT, handleOutboxFlushed);

    const pollInterval = setInterval(runSyncPass, 5000);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(OUTBOX_FLUSHED_EVENT, handleOutboxFlushed);
      clearInterval(pollInterval);
    };
  }, [user?.id, user?.role?.slug]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
    } catch (e) {
      console.error("Failed to save orders", e);
    }
  }, [orders, isInitialized]);

  const filteredOrders = orders.filter((o) => {
    const matchOutlet = isAllOutlets || !o.outletId || o.outletId === activeOutletId;
    const isUnpaidOpenBill =
      o.paymentStatus !== "PAID" && o.paymentStatus !== "REFUNDED" && o.status !== "CANCELLED";
    const isActiveOrder =
      isUnpaidOpenBill ||
      (o.status !== "SERVED" && o.status !== "COMPLETED" && o.status !== "CANCELLED");
    const matchDate = isDateInRange(o.createdAt);
    return matchOutlet && (isActiveOrder || matchDate);
  });

  const advanceOrderStatus = (
    orderId: string,
    nextStatus: OrderStatus,
    note?: string,
    paymentUpdate?: {
      paymentStatus?: "PENDING" | "PAID" | "REFUNDED";
      paymentMethod?: OrderRecord["paymentMethod"];
      qrisVerification?: OrderRecord["qrisVerification"];
      splitDetails?: OrderRecord["splitDetails"];
      cashierName?: string;
      tenantId?: string;
      tax?: number;
      serviceCharge?: number;
    }
  ) => {
    const target = ordersRef.current.find((o) => o.id === orderId);
    if (!target) return;

    const nowIso = new Date().toISOString();
    const actorName = user?.name || "Staf Operasional";

    const normTenant = normalizeTenantId(paymentUpdate?.tenantId);
    const orderFallback = (target as { tenantId?: string }).tenantId;
    const itemTenants = Array.from(
      new Set(target.items.map((it) => resolveNormalizedItemTenantId(it, orderFallback)))
    );

    let nextTenantStatuses = target.tenantStatuses ? { ...target.tenantStatuses } : undefined;
    let resolvedOverallStatus: OrderStatus = nextStatus;

    if (normTenant) {
      nextTenantStatuses = nextTenantStatuses || {};
      for (const tid of itemTenants) {
        if (!nextTenantStatuses[tid]) {
          nextTenantStatuses[tid] = target.status;
        }
      }
      nextTenantStatuses[normTenant] = nextStatus;

      if (itemTenants.length > 1 && nextStatus !== "CANCELLED" && nextStatus !== "COMPLETED") {
        resolvedOverallStatus = computeMultiTenantOverallStatus(
          itemTenants,
          nextTenantStatuses,
          target.status
        );
      }
    }

    const historyItem: OrderStatusHistoryItem = {
      id: `h-${Date.now()}`,
      orderId: target.id,
      fromStatus: normTenant ? (target.tenantStatuses?.[normTenant] || target.status) : target.status,
      toStatus: nextStatus,
      timestamp: nowIso,
      actorName,
      note: note || (normTenant ? `[${normTenant}] Status diubah menjadi ${nextStatus}` : `Status diubah menjadi ${nextStatus}`),
    };

    const updated: OrderRecord = {
      ...target,
      status: resolvedOverallStatus,
      ...(nextTenantStatuses ? { tenantStatuses: nextTenantStatuses } : {}),
      statusHistory: [...target.statusHistory, historyItem],
    };

    if (nextStatus === "CONFIRMED" && !target.confirmedAt) updated.confirmedAt = nowIso;
    if (nextStatus === "KITCHEN_RECEIVED" && !target.kitchenReceivedAt)
      updated.kitchenReceivedAt = nowIso;
    if (nextStatus === "COOKING" && !target.cookingStartedAt) updated.cookingStartedAt = nowIso;
    if (nextStatus === "READY" && !target.readyAt) {
      updated.readyAt = nowIso;
      updated.cookingFinishedAt = nowIso;
    }
    if (nextStatus === "SERVED" && !target.servedAt) updated.servedAt = nowIso;
    if (nextStatus === "COMPLETED") {
      if (!target.completedAt) updated.completedAt = nowIso;
      if (target.paymentStatus !== "PAID") {
        updated.paymentStatus = paymentUpdate?.paymentStatus || "PAID";
        if (paymentUpdate?.paymentMethod) {
          updated.paymentMethod = paymentUpdate.paymentMethod;
        }
        if (paymentUpdate?.qrisVerification) {
          updated.qrisVerification = paymentUpdate.qrisVerification;
          if (paymentUpdate.qrisVerification.referenceNumber) {
            updated.paymentReference = paymentUpdate.qrisVerification.referenceNumber;
          }
        }
        if (paymentUpdate?.splitDetails) {
          updated.splitDetails = paymentUpdate.splitDetails;
        }
        if (paymentUpdate?.cashierName || user?.name) {
          updated.cashierName = paymentUpdate?.cashierName || user?.name;
        }
        const breakdown = getOrderTaxBreakdown(target);
        updated.tax = Math.round(
          paymentUpdate?.tax !== undefined ? paymentUpdate.tax : (target.tax ?? breakdown.pb1)
        );
        updated.serviceCharge = Math.round(
          paymentUpdate?.serviceCharge !== undefined
            ? paymentUpdate.serviceCharge
            : (target.serviceCharge ?? breakdown.serviceCharge)
        );
      }
    } else if (nextStatus === "CANCELLED") {
      updated.paymentStatus =
        paymentUpdate?.paymentStatus || (target.paymentStatus === "PAID" ? "REFUNDED" : "PENDING");
    } else if (paymentUpdate && target.paymentStatus !== "PAID") {
      if (paymentUpdate.paymentStatus) updated.paymentStatus = paymentUpdate.paymentStatus;
      if (paymentUpdate.paymentMethod) updated.paymentMethod = paymentUpdate.paymentMethod;
      if (paymentUpdate.qrisVerification) {
        updated.qrisVerification = paymentUpdate.qrisVerification;
      }
      if (paymentUpdate.splitDetails) {
        updated.splitDetails = paymentUpdate.splitDetails;
      }
      if (paymentUpdate.cashierName) {
        updated.cashierName = paymentUpdate.cashierName;
      }
    }

    updateOrdersState((prev) => prev.map((o) => (o.id === orderId ? updated : o)));

    syncOrderToServer(updated);

    const isRefund =
      nextStatus === "CANCELLED" &&
      (target.paymentStatus === "PAID" || updated.paymentStatus === "REFUNDED");
    const isVoid = nextStatus === "CANCELLED" && !isRefund;
    const auditAction = isRefund ? "REFUND_ORDER" : isVoid ? "VOID_ORDER" : "ADVANCE_ORDER_STATUS";

    logActivity({
      module: "POS",
      action: auditAction,
      recordId: target.orderNumber,
      previousValue: `Status: ${target.status}, Payment: ${target.paymentStatus}`,
      newValue: `Status: ${resolvedOverallStatus}, Payment: ${updated.paymentStatus}`,
      description: isRefund
        ? `Refund transaksi ${target.orderNumber} (Meja ${target.tableNumber}) sebesar Rp ${target.total.toLocaleString("id-ID")}`
        : isVoid
        ? `Pembatalan (Void) pesanan ${target.orderNumber} (Meja ${target.tableNumber})`
        : `Perubahan status pesanan ${target.orderNumber} (Meja ${target.tableNumber}) ➔ ${nextStatus}`,
      reason:
        note ||
        (isRefund
          ? "Refund transaksi pelanggan"
          : isVoid
          ? "Void pesanan kasir"
          : "Update status progres dapur/waiter"),
      status: "SUCCESS",
      outletId: target.outletId,
      outletName: target.outletName,
    });
  };

  const refundOrder = (
    orderId: string,
    params: {
      reason: string;
      supervisorName: string;
      supervisorRole?: string;
      supervisorPin?: string;
      refundMethod?: "CASH";
    }
  ): OrderMutationResult => {
    const target = ordersRef.current.find((o) => o.id === orderId);
    if (!target) {
      return { success: false, error: "Pesanan tidak ditemukan." };
    }

    if (target.paymentStatus === "REFUNDED") {
      return { success: false, error: "Pesanan sudah berstatus REFUNDED." };
    }

    if (target.paymentStatus !== "PAID") {
      return { success: false, error: "Hanya pesanan yang sudah lunas yang dapat di-refund." };
    }

    const cleanReason = (params.reason || "").trim();
    if (!cleanReason) {
      return { success: false, error: "Alasan refund wajib diisi." };
    }

    const cleanSupervisor = (params.supervisorName || "").trim();
    if (!cleanSupervisor) {
      return { success: false, error: "Persetujuan supervisor wajib disertakan." };
    }

    const nowIso = new Date().toISOString();
    const updatedOrder: OrderRecord = {
      ...target,
      status: "CANCELLED",
      paymentStatus: "REFUNDED",
      refundReason: cleanReason,
      refundApprovedBy: cleanSupervisor,
      refundedAt: nowIso,
      refundMethod: params.refundMethod || "CASH",
      supervisorPinVerified: Boolean(params.supervisorPin?.trim()) || target.supervisorPinVerified,
      statusHistory: [
        ...target.statusHistory,
        {
          id: `hist-${Date.now()}`,
          orderId: target.id,
          fromStatus: target.status,
          toStatus: "CANCELLED",
          timestamp: nowIso,
          actorName: cleanSupervisor,
          note: `[REFUND ${target.paymentMethod || "CASH"} -> CASH] ${cleanReason}`,
        },
      ],
    };

    updateOrdersState((prev) => prev.map((o) => (o.id === orderId ? updatedOrder : o)));
    const serverSync = syncOrderToServer(
      updatedOrder,
      params.supervisorPin ? { supervisorPin: params.supervisorPin } : {},
      target
    );

    serverSync.then((syncRes) => {
      if (!syncRes.rejected) {
        logActivity({
          module: "POS",
          action: "REFUND_ORDER",
          recordId: target.orderNumber,
          previousValue: `Status: ${target.status}, Payment: ${target.paymentStatus}`,
          newValue: "Status: CANCELLED, Payment: REFUNDED (via CASH)",
          description: `Refund transaksi ${target.orderNumber} (Meja ${target.tableNumber}) sebesar Rp ${target.total.toLocaleString("id-ID")} dikembalikan tunai. Disetujui supervisor: ${cleanSupervisor}`,
          reason: cleanReason,
          status: "SUCCESS",
          outletId: target.outletId,
          outletName: target.outletName,
        });
      }
    });

    return { success: true, order: updatedOrder, serverSync };
  };

  const voidOrder = (
    orderId: string,
    params: {
      reason: string;
      supervisorName: string;
      supervisorRole?: string;
      supervisorPin?: string;
    }
  ): OrderMutationResult => {
    const target = ordersRef.current.find((o) => o.id === orderId);
    if (!target) {
      return { success: false, error: "Pesanan tidak ditemukan." };
    }

    if (target.status === "CANCELLED") {
      return { success: false, error: "Pesanan sudah dibatalkan." };
    }

    if (target.paymentStatus === "PAID") {
      return {
        success: false,
        error: "Pesanan yang sudah lunas harus melalui proses refund, bukan pembatalan.",
      };
    }

    const cleanReason = (params.reason || "").trim();
    if (!cleanReason) {
      return { success: false, error: "Alasan pembatalan wajib diisi." };
    }

    const cleanSupervisor = (params.supervisorName || "").trim();
    if (!cleanSupervisor) {
      return { success: false, error: "Persetujuan supervisor wajib disertakan." };
    }

    const nowIso = new Date().toISOString();
    const updatedOrder: OrderRecord = {
      ...target,
      status: "CANCELLED",
      voidReason: cleanReason,
      voidApprovedBy: cleanSupervisor,
      voidedAt: nowIso,
      supervisorPinVerified: Boolean(params.supervisorPin?.trim()) || target.supervisorPinVerified,
      statusHistory: [
        ...target.statusHistory,
        {
          id: `hist-${Date.now()}`,
          orderId: target.id,
          fromStatus: target.status,
          toStatus: "CANCELLED",
          timestamp: nowIso,
          actorName: cleanSupervisor,
          note: `[VOID] ${cleanReason}`,
        },
      ],
    };

    updateOrdersState((prev) => prev.map((o) => (o.id === orderId ? updatedOrder : o)));
    const serverSync = syncOrderToServer(
      updatedOrder,
      params.supervisorPin ? { supervisorPin: params.supervisorPin } : {},
      target
    );

    serverSync.then((syncRes) => {
      if (!syncRes.rejected) {
        logActivity({
          module: "POS",
          action: "VOID_ORDER",
          recordId: target.orderNumber,
          previousValue: `Status: ${target.status}, Payment: ${target.paymentStatus}`,
          newValue: `Status: CANCELLED, Payment: ${updatedOrder.paymentStatus}`,
          description: `Pembatalan (void) pesanan ${target.orderNumber} (Meja ${target.tableNumber}). Disetujui supervisor: ${cleanSupervisor}`,
          reason: cleanReason,
          status: "SUCCESS",
          outletId: target.outletId,
          outletName: target.outletName,
        });
      }
    });

    return { success: true, order: updatedOrder, serverSync };
  };

  const resolveOrderNumber = (
    items: OrderRecord["items"],
    explicitNumber?: string,
    prefix: "ORD" | "INV" = "INV"
  ): string => {
    if (explicitNumber && explicitNumber.trim()) return explicitNumber.trim();
    const publisher = resolvePosReceiptPublisher(items, activeOutlet);
    const publisherCode = publisher.isMultiTenant
      ? "DAGO"
      : resolvePublisherCode(publisher.tenantId);
    return generateSequentialReceiptNumber({
      prefix,
      publisherCode,
      existingNumbers: ordersRef.current.map((o) => o.orderNumber),
    });
  };

  const createOrder = (newOrderData: Partial<OrderRecord>): OrderRecord => {
    const nowIso = new Date().toISOString();
    const newId = `ord-${Date.now()}`;
    const newNo = resolveOrderNumber(newOrderData.items || [], newOrderData.orderNumber, "ORD");
    const targetOutletId = activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr";
    const targetOutletName = activeOutlet?.name || "Singaraja";

    const breakdown = getOrderTaxBreakdown(newOrderData);
    const finalTax = Math.round(newOrderData.tax !== undefined ? newOrderData.tax : breakdown.pb1);
    const finalService = Math.round(
      newOrderData.serviceCharge !== undefined ? newOrderData.serviceCharge : breakdown.serviceCharge
    );

    const newOrder: OrderRecord = {
      id: newId,
      orderNumber: newNo,
      organizationId: user?.organization?.id || "org-dago-hub",
      outletId: targetOutletId,
      outletName: targetOutletName,
      tableNumber: newOrderData.tableNumber || (newOrderData.orderType === "TAKEAWAY" ? "TAKEAWAY" : "-"),
      customerName: newOrderData.customerName || "Pelanggan Meja",
      orderType: newOrderData.orderType || "DINE_IN",
      status: "NEW",
      targetServiceMinutes: 10,
      items: newOrderData.items || [],
      subtotal: newOrderData.subtotal || 0,
      tax: finalTax,
      serviceCharge: finalService,
      taxRatePercent: newOrderData.taxRatePercent,
      serviceChargePercent: newOrderData.serviceChargePercent,
      total: newOrderData.total || 0,
      paymentStatus: "PENDING",
      createdAt: nowIso,
      statusHistory: [
        {
          id: `h-${Date.now()}`,
          orderId: newId,
          fromStatus: null,
          toStatus: "NEW",
          timestamp: nowIso,
          actorName: user?.name || "Self-Order Customer",
        },
      ],
      ...newOrderData,
    };

    updateOrdersState((prev) => [newOrder, ...prev]);

    syncOrderToServer(newOrder);

    logActivity({
      module: "POS",
      action: "CREATE_ORDER",
      recordId: newOrder.orderNumber,
      newValue: `${newOrder.customerName} - ${newOrder.items.length} Menu (Rp ${newOrder.total.toLocaleString()})`,
      description: `Order baru dibuat via QR Meja ${newOrder.tableNumber}`,
      reason: "Self-Order Tamu",
      status: "SUCCESS",
      outletId: targetOutletId,
      outletName: targetOutletName,
    });

    return newOrder;
  };

  const createPosOrder = (newOrderData: Partial<OrderRecord>): OrderRecord => {
    const nowIso = new Date().toISOString();
    const newId = `ord-pos-${Date.now()}`;
    const newNo = resolveOrderNumber(newOrderData.items || [], newOrderData.orderNumber, "INV");
    const targetOutletId = activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr";
    const targetOutletName = activeOutlet?.name || "Singaraja";

    const breakdown = getOrderTaxBreakdown(newOrderData);
    const finalTax = Math.round(newOrderData.tax !== undefined ? newOrderData.tax : breakdown.pb1);
    const finalService = Math.round(
      newOrderData.serviceCharge !== undefined ? newOrderData.serviceCharge : breakdown.serviceCharge
    );

    const newOrder: OrderRecord = {
      id: newId,
      orderNumber: newNo,
      organizationId: user?.organization?.id || "org-dago-hub",
      outletId: targetOutletId,
      outletName: targetOutletName,
      tableNumber: newOrderData.tableNumber || (newOrderData.orderType === "TAKEAWAY" ? "TAKEAWAY" : "-"),
      customerName: newOrderData.customerName || "Pelanggan Kasir",
      orderType: newOrderData.orderType || "DINE_IN",
      status: "CONFIRMED",
      targetServiceMinutes: 10,
      items: newOrderData.items || [],
      subtotal: newOrderData.subtotal || 0,
      discount: newOrderData.discount,
      promoId: newOrderData.promoId,
      tax: finalTax,
      serviceCharge: finalService,
      taxRatePercent: newOrderData.taxRatePercent,
      serviceChargePercent: newOrderData.serviceChargePercent,
      total: newOrderData.total || 0,
      paymentStatus: newOrderData.paymentStatus || "PAID",
      paymentMethod: newOrderData.paymentMethod || "QRIS",
      paymentReference: newOrderData.paymentReference,
      cashierName: newOrderData.cashierName || user?.name || "Kasir POS",
      qrisVerification: newOrderData.qrisVerification,
      corporateInfo: newOrderData.corporateInfo,
      createdAt: nowIso,
      confirmedAt: nowIso,
      statusHistory: [
        {
          id: `h-pos-1-${Date.now()}`,
          orderId: newId,
          fromStatus: null,
          toStatus: "NEW",
          timestamp: nowIso,
          actorName: user?.name || "Kasir POS",
          note: "Transaksi dibuat di kasir",
        },
        {
          id: `h-pos-2-${Date.now()}`,
          orderId: newId,
          fromStatus: "NEW",
          toStatus: "CONFIRMED",
          timestamp: nowIso,
          actorName: user?.name || "Kasir POS",
          note:
            newOrderData.paymentStatus === "PENDING"
              ? `Pesanan tagihan bertempo via ${newOrderData.paymentMethod || "INVOICE"}`
              : `Pembayaran lunas via ${newOrderData.paymentMethod || "QRIS"}`,
        },
      ],
      ...newOrderData,
    };

    updateOrdersState((prev) => [newOrder, ...prev]);

    syncOrderToServer(newOrder, { customerKey: newOrder.customerName });

    logActivity({
      module: "POS",
      action: "POS_TRANSACTION",
      recordId: newOrder.orderNumber,
      newValue: `Total: Rp ${newOrder.total.toLocaleString()} (${newOrder.paymentMethod} - LUNAS)`,
      description: `Transaksi kasir POS selesai: ${newOrder.orderNumber} (Meja ${newOrder.tableNumber})`,
      reason: "Pembayaran kasir berhasil",
      status: "SUCCESS",
      outletId: targetOutletId,
      outletName: targetOutletName,
    });

    return newOrder;
  };

  const getOrderById = (orderId: string) => {
    return orders.find((o) => o.id === orderId);
  };

  const resetOrderData = () => {
    ordersRef.current = INITIAL_ORDERS;
    setOrders(INITIAL_ORDERS);
    try {
      localStorage.removeItem(STORAGE_KEY_ORDERS);
    } catch (e) {
      console.error(e);
    }
    if (typeof window !== "undefined") {
      syncWithOutbox({
        id: "orders-reset",
        endpoint: "/api/orders",
        method: "DELETE",
        payload: { action: "RESET" },
      }).catch(() => {});
    }
  };

  return (
    <OrderContext.Provider
      value={{
        orders,
        filteredOrders,
        advanceOrderStatus,
        createOrder,
        createPosOrder,
        refundOrder,
        voidOrder,
        getOrderById,
        resetOrderData,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrderContext);
  if (!context) throw new Error("useOrders must be used within an OrderProvider");
  return context;
}
