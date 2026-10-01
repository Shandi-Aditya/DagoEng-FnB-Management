"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { OrderRecord, OrderStatus, OrderStatusHistoryItem } from "@/types/order";
import { useAuth } from "./AuthContext";
import { useOutlet } from "./OutletContext";
import { useDateFilter } from "./DateFilterContext";
import { useActivityLog } from "./ActivityLogContext";

export const INITIAL_ORDERS: OrderRecord[] = [
  // 1. In Cooking Stage (Singaraja - Table T-01)
  {
    id: "ord-101",
    orderNumber: "ORD-20260914-0101",
    organizationId: "org-dago-hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tableNumber: "T-01",
    customerName: "Budi Santoso",
    orderType: "DINE_IN",
    status: "COOKING",
    targetServiceMinutes: 10,
    items: [
      { id: "it-1", productName: "Signature Wagyu Beef Bowl", quantity: 2, unitPrice: 65000, modifiers: ["Onsen Egg", "No Onion"] },
      { id: "it-2", productName: "Flaky French Butter Croissant", quantity: 1, unitPrice: 20000 },
    ],
    subtotal: 150000,
    tax: 15000,
    total: 165000,
    paymentStatus: "PAID",
    paymentMethod: "QRIS",
    createdAt: "2026-09-14T10:30:00Z",
    confirmedAt: "2026-09-14T10:31:00Z",
    kitchenReceivedAt: "2026-09-14T10:32:00Z",
    cookingStartedAt: "2026-09-14T10:34:00Z",
    statusHistory: [
      { id: "h-1", orderId: "ord-101", fromStatus: null, toStatus: "NEW", timestamp: "2026-09-14T10:30:00Z", actorName: "Ni Kadek Sri (Cashier)" },
      { id: "h-2", orderId: "ord-101", fromStatus: "NEW", toStatus: "CONFIRMED", timestamp: "2026-09-14T10:31:00Z", actorName: "Ni Kadek Sri (Cashier)", note: "Payment QRIS Confirmed" },
      { id: "h-3", orderId: "ord-101", fromStatus: "CONFIRMED", toStatus: "KITCHEN_RECEIVED", timestamp: "2026-09-14T10:32:00Z", actorName: "Gede Agus (Kitchen)", note: "Ticket printed on Kitchen Station" },
      { id: "h-4", orderId: "ord-101", fromStatus: "KITCHEN_RECEIVED", toStatus: "COOKING", timestamp: "2026-09-14T10:34:00Z", actorName: "Gede Agus (Kitchen)", note: "Chef started beef bowl searing" },
    ],
  },

  // 2. New / Kitchen Received Stage (Singaraja - Table T-03)
  {
    id: "ord-102",
    orderNumber: "ORD-20260914-0102",
    organizationId: "org-dago-hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tableNumber: "T-03",
    customerName: "Ketut Dian",
    orderType: "DINE_IN",
    status: "KITCHEN_RECEIVED",
    targetServiceMinutes: 10,
    items: [
      { id: "it-3", productName: "Kopi Senja Aren (Regular)", quantity: 2, unitPrice: 24000, modifiers: ["Less Sugar (50%)", "Oat Milk"] },
      { id: "it-4", productName: "Artisan Peach White Tea", quantity: 1, unitPrice: 28000 },
    ],
    subtotal: 76000,
    tax: 7600,
    total: 83600,
    paymentStatus: "PAID",
    paymentMethod: "QRIS",
    createdAt: "2026-09-14T10:40:00Z",
    confirmedAt: "2026-09-14T10:41:00Z",
    kitchenReceivedAt: "2026-09-14T10:42:00Z",
    statusHistory: [
      { id: "h-5", orderId: "ord-102", fromStatus: null, toStatus: "NEW", timestamp: "2026-09-14T10:40:00Z", actorName: "Ketut Dian (Customer Self-Order)" },
      { id: "h-6", orderId: "ord-102", fromStatus: "NEW", toStatus: "CONFIRMED", timestamp: "2026-09-14T10:41:00Z", actorName: "Ni Kadek Sri (Cashier)" },
      { id: "h-7", orderId: "ord-102", fromStatus: "CONFIRMED", toStatus: "KITCHEN_RECEIVED", timestamp: "2026-09-14T10:42:00Z", actorName: "Gede Agus (Kitchen)" },
    ],
  },

  // 3. Ready at Bar / Pick-up (Singaraja - Table OUT-02)
  {
    id: "ord-103",
    orderNumber: "ORD-20260914-0103",
    organizationId: "org-dago-hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tableNumber: "OUT-02",
    customerName: "Siti Rahma",
    orderType: "DINE_IN",
    status: "READY",
    targetServiceMinutes: 10,
    items: [
      { id: "it-5", productName: "Artisan Peach White Tea", quantity: 2, unitPrice: 28000 },
    ],
    subtotal: 56000,
    tax: 5600,
    total: 61600,
    paymentStatus: "PAID",
    paymentMethod: "CASH",
    createdAt: "2026-09-14T10:15:00Z",
    confirmedAt: "2026-09-14T10:16:00Z",
    kitchenReceivedAt: "2026-09-14T10:17:00Z",
    cookingStartedAt: "2026-09-14T10:18:00Z",
    readyAt: "2026-09-14T10:24:00Z",
    statusHistory: [
      { id: "h-8", orderId: "ord-103", fromStatus: null, toStatus: "NEW", timestamp: "2026-09-14T10:15:00Z" },
      { id: "h-9", orderId: "ord-103", fromStatus: "NEW", toStatus: "CONFIRMED", timestamp: "2026-09-14T10:16:00Z" },
      { id: "h-10", orderId: "ord-103", fromStatus: "CONFIRMED", toStatus: "KITCHEN_RECEIVED", timestamp: "2026-09-14T10:17:00Z" },
      { id: "h-11", orderId: "ord-103", fromStatus: "KITCHEN_RECEIVED", toStatus: "COOKING", timestamp: "2026-09-14T10:18:00Z" },
      { id: "h-12", orderId: "ord-103", fromStatus: "COOKING", toStatus: "READY", timestamp: "2026-09-14T10:24:00Z", note: "Teas assembled and placed on serving pass" },
    ],
  },

  // 4. Fully Completed Order (Singaraja - Table T-02)
  {
    id: "ord-104",
    orderNumber: "ORD-20260914-0104",
    organizationId: "org-dago-hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tableNumber: "T-02",
    customerName: "Ahmad Faisal",
    orderType: "DINE_IN",
    status: "COMPLETED",
    targetServiceMinutes: 10,
    items: [
      { id: "it-6", productName: "Kopi Senja Aren", quantity: 1, unitPrice: 24000 },
      { id: "it-7", productName: "Flaky French Butter Croissant", quantity: 1, unitPrice: 20000 },
    ],
    subtotal: 44000,
    tax: 4400,
    total: 48400,
    paymentStatus: "PAID",
    paymentMethod: "QRIS",
    createdAt: "2026-09-14T09:10:00Z",
    confirmedAt: "2026-09-14T09:11:00Z",
    kitchenReceivedAt: "2026-09-14T09:12:00Z",
    cookingStartedAt: "2026-09-14T09:14:00Z",
    readyAt: "2026-09-14T09:20:00Z",
    servedAt: "2026-09-14T09:22:00Z",
    completedAt: "2026-09-14T09:55:00Z",
    statusHistory: [
      { id: "h-13", orderId: "ord-104", fromStatus: null, toStatus: "NEW", timestamp: "2026-09-14T09:10:00Z" },
      { id: "h-14", orderId: "ord-104", fromStatus: "NEW", toStatus: "CONFIRMED", timestamp: "2026-09-14T09:11:00Z" },
      { id: "h-15", orderId: "ord-104", fromStatus: "CONFIRMED", toStatus: "KITCHEN_RECEIVED", timestamp: "2026-09-14T09:12:00Z" },
      { id: "h-16", orderId: "ord-104", fromStatus: "KITCHEN_RECEIVED", toStatus: "COOKING", timestamp: "2026-09-14T09:14:00Z" },
      { id: "h-17", orderId: "ord-104", fromStatus: "COOKING", toStatus: "READY", timestamp: "2026-09-14T09:20:00Z" },
      { id: "h-18", orderId: "ord-104", fromStatus: "READY", toStatus: "SERVED", timestamp: "2026-09-14T09:22:00Z" },
      { id: "h-19", orderId: "ord-104", fromStatus: "SERVED", toStatus: "COMPLETED", timestamp: "2026-09-14T09:55:00Z" },
    ],
  },

  // 5. Denpasar Order (Strictly Scoped)
  {
    id: "ord-201",
    orderNumber: "ORD-20260914-0201",
    organizationId: "org-dago-hub",
    outletId: "outlet-dps",
    outletName: "Denpasar",
    tableNumber: "DPS-02",
    customerName: "Dewi Lestari",
    orderType: "DINE_IN",
    status: "SERVED",
    targetServiceMinutes: 10,
    items: [
      { id: "it-8", productName: "Signature Wagyu Beef Bowl", quantity: 3, unitPrice: 65000 },
    ],
    subtotal: 195000,
    tax: 19500,
    total: 214500,
    paymentStatus: "PAID",
    paymentMethod: "EDC",
    createdAt: "2026-09-14T08:30:00Z",
    confirmedAt: "2026-09-14T08:32:00Z",
    kitchenReceivedAt: "2026-09-14T08:35:00Z",
    cookingStartedAt: "2026-09-14T08:37:00Z",
    readyAt: "2026-09-14T08:48:00Z",
    servedAt: "2026-09-14T08:52:00Z",
    statusHistory: [],
  },
];

interface OrderContextType {
  orders: OrderRecord[];
  filteredOrders: OrderRecord[];
  advanceOrderStatus: (
    orderId: string,
    nextStatus: OrderStatus,
    note?: string,
    paymentUpdate?: { paymentStatus?: "PENDING" | "PAID" | "REFUNDED"; paymentMethod?: "CASH" | "QRIS" | "EDC" | "TRANSFER" }
  ) => void;
  createOrder: (order: Partial<OrderRecord>) => OrderRecord;
  createPosOrder: (order: Partial<OrderRecord>) => OrderRecord;
  getOrderById: (orderId: string) => OrderRecord | undefined;
  resetOrderData: () => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);
const STORAGE_KEY_ORDERS = "dagoeng_orders_v2";

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeOutletId, activeOutlet, isAllOutlets } = useOutlet();
  const { isDateInRange } = useDateFilter();
  const { logActivity } = useActivityLog();

  const [orders, setOrders] = useState<OrderRecord[]>(INITIAL_ORDERS);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ORDERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrders(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load orders", e);
    } finally {
      setIsInitialized(true);
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
    const isActiveOrder = o.status !== "SERVED" && o.status !== "COMPLETED" && o.status !== "CANCELLED";
    const matchDate = isDateInRange(o.createdAt);
    return matchOutlet && (isActiveOrder || matchDate);
  });

  const advanceOrderStatus = (
    orderId: string,
    nextStatus: OrderStatus,
    note?: string,
    paymentUpdate?: { paymentStatus?: "PENDING" | "PAID" | "REFUNDED"; paymentMethod?: "CASH" | "QRIS" | "EDC" | "TRANSFER" }
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

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;

        const updated: OrderRecord = {
          ...o,
          status: nextStatus,
          statusHistory: [...o.statusHistory, historyItem],
        };

        if (nextStatus === "CONFIRMED" && !o.confirmedAt) updated.confirmedAt = nowIso;
        if (nextStatus === "KITCHEN_RECEIVED" && !o.kitchenReceivedAt) updated.kitchenReceivedAt = nowIso;
        if (nextStatus === "COOKING" && !o.cookingStartedAt) updated.cookingStartedAt = nowIso;
        if (nextStatus === "READY" && !o.readyAt) {
          updated.readyAt = nowIso;
          updated.cookingFinishedAt = nowIso;
        }
        if (nextStatus === "SERVED" && !o.servedAt) updated.servedAt = nowIso;
        if (nextStatus === "COMPLETED") {
          if (!o.completedAt) updated.completedAt = nowIso;
          updated.paymentStatus = paymentUpdate?.paymentStatus || "PAID";
          if (paymentUpdate?.paymentMethod) {
            updated.paymentMethod = paymentUpdate.paymentMethod;
          }
        } else if (nextStatus === "CANCELLED") {
          updated.paymentStatus = paymentUpdate?.paymentStatus || (o.paymentStatus === "PAID" ? "REFUNDED" : "PENDING");
        } else if (paymentUpdate) {
          if (paymentUpdate.paymentStatus) updated.paymentStatus = paymentUpdate.paymentStatus;
          if (paymentUpdate.paymentMethod) updated.paymentMethod = paymentUpdate.paymentMethod;
        }

        return updated;
      })
    );

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
      total: newOrderData.total || 0,
      paymentStatus: "PAID",
      paymentMethod: newOrderData.paymentMethod || "QRIS",
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
