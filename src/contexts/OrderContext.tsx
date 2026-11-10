"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { OrderRecord, OrderStatus, OrderStatusHistoryItem } from "@/types/order";
import { useAuth } from "./AuthContext";
import { useOutlet } from "./OutletContext";
import { useDateFilter } from "./DateFilterContext";
import { useActivityLog } from "./ActivityLogContext";
import { useNotifications } from "./NotificationContext";
import { syncWithOutbox, flushOutbox } from "@/lib/sync-outbox";

const ORDER_SYNC_ENDPOINT = "/api/orders";
const orderSyncId = (orderId: string) => `order-sync-${orderId}`;

export const INITIAL_ORDERS: OrderRecord[] = [];

interface OrderContextType {
  orders: OrderRecord[];
  filteredOrders: OrderRecord[];
  advanceOrderStatus: (
    orderId: string,
    nextStatus: OrderStatus,
    note?: string,
    paymentUpdate?: {
      paymentStatus?: "PENDING" | "PAID" | "REFUNDED";
      paymentMethod?: "CASH" | "QRIS" | "EDC" | "TRANSFER" | "SPLIT";
      qrisVerification?: OrderRecord["qrisVerification"];
    }
  ) => void;
  createOrder: (order: Partial<OrderRecord>) => OrderRecord;
  createPosOrder: (order: Partial<OrderRecord>) => OrderRecord;
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

  const markOrderSync = (
    orderId: string,
    syncStatus: NonNullable<OrderRecord["syncStatus"]>,
    syncError?: string
  ) => {
    setOrders((prev) =>
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

  const syncOrderToServer = (order: OrderRecord, extraPayload: Record<string, unknown> = {}) => {
    if (typeof window === "undefined") return;
    // Customer self-order devices have no POS write permission; their orders stay local by design.
    if (user?.role?.slug === "CUSTOMER") return;
    syncWithOutbox({
      id: orderSyncId(order.id),
      endpoint: ORDER_SYNC_ENDPOINT,
      method: "POST",
      payload: { order, ...extraPayload },
    }).then((result) => {
      if (result.synced) {
        markOrderSync(order.id, "SYNCED");
      } else if (result.rejected) {
        markOrderSync(order.id, "REJECTED", result.error);
        notifyOrderRejected(order, result.error || "Ditolak server.");
      } else {
        markOrderSync(order.id, "PENDING", result.error);
      }
    });
  };
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ORDERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setOrders(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load orders", e);
    } finally {
      setIsInitialized(true);
    }

    // Flush pending outbox orders first, then hydrate orders from persistent server storage (POS-33 / R9)
    if (typeof window !== "undefined") {
      flushOutbox()
        .then(({ rejected }) => {
          for (const { item, error } of rejected) {
            const rejectedOrder = item.payload.order as OrderRecord | undefined;
            if (item.endpoint !== ORDER_SYNC_ENDPOINT || !rejectedOrder?.id) continue;
            markOrderSync(rejectedOrder.id, "REJECTED", error);
            notifyOrderRejected(rejectedOrder, error);
          }
        })
        .catch(() => {})
        .finally(() => {
          fetch("/api/orders")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data && Array.isArray(data.orders) && data.orders.length > 0) {
                setOrders((prev) => {
                  const merged = new Map(prev.map((o) => [o.id, o]));
                  for (const srvOrder of data.orders) {
                    merged.set(srvOrder.id, srvOrder);
                  }
                  return Array.from(merged.values());
                });
              }
            })
            .catch(() => {});
        });
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
    } catch (e) {
      console.error("Failed to save orders", e);
    }
  }, [orders, isInitialized]);

  // Strict outlet scope and date filter
  const filteredOrders = orders.filter((o) => {
    const matchOutlet = isAllOutlets || o.outletId === activeOutletId;
    const isActiveOrder =
      o.status !== "SERVED" && o.status !== "COMPLETED" && o.status !== "CANCELLED";
    const matchDate = isDateInRange(o.createdAt);
    return matchOutlet && (isActiveOrder || matchDate);
  });

  const advanceOrderStatus = (
    orderId: string,
    nextStatus: OrderStatus,
    note?: string,
    paymentUpdate?: {
      paymentStatus?: "PENDING" | "PAID" | "REFUNDED";
      paymentMethod?: "CASH" | "QRIS" | "EDC" | "TRANSFER" | "SPLIT";
      qrisVerification?: OrderRecord["qrisVerification"];
    }
  ) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;

    const nowIso = new Date().toISOString();
    const actorName = user?.name || "Staf Operasional";

    const historyItem: OrderStatusHistoryItem = {
      id: `h-${Date.now()}`,
      orderId: target.id,
      fromStatus: target.status,
      toStatus: nextStatus,
      timestamp: nowIso,
      actorName,
      note: note || `Status diubah menjadi ${nextStatus}`,
    };

    const updated: OrderRecord = {
      ...target,
      status: nextStatus,
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
      updated.paymentStatus = paymentUpdate?.paymentStatus || "PAID";
      if (paymentUpdate?.paymentMethod) {
        updated.paymentMethod = paymentUpdate.paymentMethod;
      }
      if (paymentUpdate?.qrisVerification) {
        updated.qrisVerification = paymentUpdate.qrisVerification;
      }
    } else if (nextStatus === "CANCELLED") {
      updated.paymentStatus =
        paymentUpdate?.paymentStatus || (target.paymentStatus === "PAID" ? "REFUNDED" : "PENDING");
    } else if (paymentUpdate) {
      if (paymentUpdate.paymentStatus) updated.paymentStatus = paymentUpdate.paymentStatus;
      if (paymentUpdate.paymentMethod) updated.paymentMethod = paymentUpdate.paymentMethod;
    }

    // R9: Pure state updater without network side effects inside setOrders
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));

    syncOrderToServer(updated);

    logActivity({
      module: "POS",
      action: "ADVANCE_ORDER_STATUS",
      recordId: target.orderNumber,
      previousValue: `Status: ${target.status}`,
      newValue: `Status: ${nextStatus}`,
      description: `Perubahan status pesanan ${target.orderNumber} (Meja ${target.tableNumber}) ➔ ${nextStatus}`,
      reason: note || "Update status progres dapur/waiter",
      status: "SUCCESS",
      outletId: target.outletId,
      outletName: target.outletName,
    });
  };

  const createOrder = (newOrderData: Partial<OrderRecord>): OrderRecord => {
    const nowIso = new Date().toISOString();
    const newId = `ord-${Date.now()}`;
    const newNo = `ORD-${Date.now().toString().slice(-6)}`;
    const targetOutletId = activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr";
    const targetOutletName = activeOutlet?.name || "Singaraja";

    const newOrder: OrderRecord = {
      id: newId,
      orderNumber: newNo,
      organizationId: user?.organization?.id || "org-dago-hub",
      outletId: targetOutletId,
      outletName: targetOutletName,
      tableNumber: newOrderData.tableNumber || "T-01",
      customerName: newOrderData.customerName || "Pelanggan Meja",
      orderType: newOrderData.orderType || "DINE_IN",
      status: "NEW",
      targetServiceMinutes: 10,
      items: newOrderData.items || [],
      subtotal: newOrderData.subtotal || 0,
      tax: newOrderData.tax || 0,
      serviceCharge: newOrderData.serviceCharge || 0,
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

    setOrders((prev) => [newOrder, ...prev]);

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
    const newNo = `ORD-POS-${Date.now().toString().slice(-4)}`;
    const targetOutletId = activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr";
    const targetOutletName = activeOutlet?.name || "Singaraja";

    const newOrder: OrderRecord = {
      id: newId,
      orderNumber: newNo,
      organizationId: user?.organization?.id || "org-dago-hub",
      outletId: targetOutletId,
      outletName: targetOutletName,
      tableNumber: newOrderData.tableNumber || "T-01",
      customerName: newOrderData.customerName || "Pelanggan Kasir",
      orderType: newOrderData.orderType || "DINE_IN",
      status: "CONFIRMED",
      targetServiceMinutes: 10,
      items: newOrderData.items || [],
      subtotal: newOrderData.subtotal || 0,
      discount: newOrderData.discount,
      promoId: newOrderData.promoId,
      tax: newOrderData.tax || 0,
      serviceCharge: newOrderData.serviceCharge || 0,
      taxRatePercent: newOrderData.taxRatePercent,
      serviceChargePercent: newOrderData.serviceChargePercent,
      total: newOrderData.total || 0,
      paymentStatus: "PAID",
      paymentMethod: newOrderData.paymentMethod || "QRIS",
      paymentReference: newOrderData.paymentReference,
      qrisVerification: newOrderData.qrisVerification,
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
          note: `Pembayaran lunas via ${newOrderData.paymentMethod || "QRIS"}`,
        },
      ],
      ...newOrderData,
    };

    setOrders((prev) => [newOrder, ...prev]);

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
    setOrders(INITIAL_ORDERS);
    try {
      localStorage.removeItem(STORAGE_KEY_ORDERS);
    } catch (e) {
      console.error(e);
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
