"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useOutlet } from "@/contexts/OutletContext";
import { useOrders } from "@/contexts/OrderContext";
import { OrderRecord, OrderStatus } from "@/types/order";
import { calculateOrderMetrics, formatMinutesToHuman } from "@/lib/order-analytics";
import { Card } from "@/components/ui/card";
import {
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  Flame,
  AlertTriangle,
  Play,
  Check,
  Volume2,
  VolumeX,
  Bell,
  PlusCircle,
  Filter,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { soundChime } from "@/lib/audio-chime";

export default function KitchenKDSPage() {
  const { activeOutlet, activeOutletId } = useOutlet();
  const { filteredOrders, advanceOrderStatus, createOrder } = useOrders();
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");
  const prevOrderCountRef = useRef<number>(filteredOrders.length);

  // Real-time second tick for active SLA timers
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter kitchen active orders
  const activeOrders = useMemo(() => {
    return filteredOrders
      .filter(
        (o) =>
          o.status === "NEW" ||
          o.status === "CONFIRMED" ||
          o.status === "KITCHEN_RECEIVED" ||
          o.status === "COOKING" ||
          o.status === "READY"
      )
      .filter((o) => {
        if (selectedTypeFilter === "ALL") return true;
        return o.orderType === selectedTypeFilter;
      });
  }, [filteredOrders, selectedTypeFilter]);

  // Ring bell when new ticket arrives
  useEffect(() => {
    if (activeOrders.length > prevOrderCountRef.current) {
      if (isSoundEnabled) {
        soundChime.playKitchenBell();
      }
    }
    prevOrderCountRef.current = activeOrders.length;
  }, [activeOrders.length, isSoundEnabled]);

  const handleAdvance = (orderId: string, nextStatus: OrderStatus) => {
    if (isSoundEnabled) {
      soundChime.playKitchenBell();
    }
    advanceOrderStatus(orderId, nextStatus);
  };

  const handleTestChime = () => {
    soundChime.playKitchenBell();
  };

  // Quick Demo Order Generator for presentation
  const handleQuickDemoOrder = () => {
    const randomTables = ["T-05", "T-08", "VIP-01", "OUT-04", "BAR-02"];
    const randomNames = ["Dimas Pratama", "Sarah Anjani", "Kevin Wijaya", "Lina Marlina", "Rizky Fauzi"];
    const sampleItems = [
      [
        { id: `it-${Date.now()}-1`, productName: "Signature Wagyu Beef Bowl", quantity: 1, unitPrice: 65000, modifiers: ["Onsen Egg", "Pedas Lv.2"] },
        { id: `it-${Date.now()}-2`, productName: "Kopi Senja Aren (Regular)", quantity: 1, unitPrice: 24000, modifiers: ["Less Ice", "Oat Milk"] },
      ],
      [
        { id: `it-${Date.now()}-3`, productName: "Artisan Peach White Tea", quantity: 2, unitPrice: 28000, modifiers: ["Less Sugar (50%)"] },
        { id: `it-${Date.now()}-4`, productName: "Flaky French Butter Croissant", quantity: 2, unitPrice: 20000, modifiers: ["Warm Heat"] },
      ],
      [
        { id: `it-${Date.now()}-5`, productName: "Espresso Double Shot", quantity: 1, unitPrice: 22000 },
        { id: `it-${Date.now()}-6`, productName: "Signature Wagyu Beef Bowl", quantity: 2, unitPrice: 65000, modifiers: ["Extra Sambal Matah"] },
      ],
    ];

    const pickIdx = Math.floor(Math.random() * sampleItems.length);
    const chosenItems = sampleItems[pickIdx];
    const subtotal = chosenItems.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
    const tax = Math.round(subtotal * 0.1);

    const newOrder = createOrder({
      outletId: activeOutletId || "outlet-sgr",
      outletName: activeOutlet?.name || "Singaraja",
      tableNumber: randomTables[Math.floor(Math.random() * randomTables.length)],
      customerName: randomNames[Math.floor(Math.random() * randomNames.length)],
      orderType: Math.random() > 0.3 ? "DINE_IN" : "TAKEAWAY",
      status: "CONFIRMED",
      targetServiceMinutes: 10,
      items: chosenItems,
      subtotal,
      tax,
      total: subtotal + tax,
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
    });

    if (isSoundEnabled) {
      soundChime.playKitchenBell();
    }
  };

  const columnConfig: {
    statusGroup: OrderStatus[];
    title: string;
    color: string;
    headerBg: string;
    nextStatus?: OrderStatus;
    nextLabel?: string;
    nextIcon?: React.ReactNode;
  }[] = [
    {
      statusGroup: ["NEW", "CONFIRMED"],
      title: "1. Antrean Baru (NEW)",
      color: "border-blue-200 bg-blue-50/20",
      headerBg: "bg-blue-600 text-white",
      nextStatus: "KITCHEN_RECEIVED",
      nextLabel: "Terima Tiket",
      nextIcon: <Play className="w-3 h-3 mr-1" />,
    },
    {
      statusGroup: ["KITCHEN_RECEIVED"],
      title: "2. Siap Dimasak (QUEUE)",
      color: "border-amber-200 bg-amber-50/20",
      headerBg: "bg-amber-500 text-white",
      nextStatus: "COOKING",
      nextLabel: "Mulai Masak",
      nextIcon: <Flame className="w-3 h-3 mr-1" />,
    },
    {
      statusGroup: ["COOKING"],
      title: "3. Sedang Dimasak (COOKING)",
      color: "border-orange-200 bg-orange-50/20",
      headerBg: "bg-brand-orange text-white",
      nextStatus: "READY",
      nextLabel: "Selesai (Ready)",
      nextIcon: <Check className="w-3 h-3 mr-1" />,
    },
    {
      statusGroup: ["READY"],
      title: "4. Siap Saji (READY)",
      color: "border-emerald-200 bg-emerald-50/20",
      headerBg: "bg-emerald-600 text-white",
      nextStatus: "SERVED",
      nextLabel: "Sajikan ke Meja",
      nextIcon: <CheckCircle2 className="w-3 h-3 mr-1" />,
    },
  ];

  return (
    <div className="space-y-4">
      {/* KDS Header with Live Controls & SLA Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-200 gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <UtensilsCrossed className="w-5 h-5 text-brand-orange" />
            <span>Kitchen Display System (KDS Live)</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Outlet: {activeOutlet?.name || "Singaraja"}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time visual order pipeline, SLA timer per tiket, dan stasiun persiapan dapur
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {/* Quick Demo Order Spawn */}
          <Button
            size="sm"
            onClick={handleQuickDemoOrder}
            className="h-8 px-3 text-xs font-bold bg-brand-orange hover:bg-orange-600 text-white shadow-xs space-x-1.5"
            title="Kirim pesanan simulasi baru langsung ke antrean dapur"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ Simulasi Pesanan Baru</span>
          </Button>

          {/* Sound Toggle */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            className={`h-8 px-2.5 text-xs font-bold space-x-1 border ${
              isSoundEnabled
                ? "bg-amber-50 text-amber-900 border-amber-300"
                : "bg-slate-100 text-slate-500 border-slate-200"
            }`}
          >
            {isSoundEnabled ? <Volume2 className="w-3.5 h-3.5 text-brand-orange" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{isSoundEnabled ? "Audio On" : "Mute"}</span>
          </Button>

          {/* Test Chime */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleTestChime}
            className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
            title="Klik untuk uji coba suara bell dapur"
          >
            <Bell className="w-3.5 h-3.5 mr-1 text-slate-500" />
            <span>Tes Bell</span>
          </Button>

          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{activeOrders.length} Tiket Aktif</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Target SLA Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
        <div className="flex items-center space-x-1 text-xs">
          <span className="text-slate-400 font-semibold px-2 flex items-center space-x-1">
            <Filter className="w-3 h-3" />
            <span>Tipe:</span>
          </span>
          {["ALL", "DINE_IN", "TAKE_AWAY"].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedTypeFilter(type)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                selectedTypeFilter === type
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {type === "ALL" && "Semua Pesanan"}
              {type === "DINE_IN" && "🍽️ Dine In"}
              {type === "TAKE_AWAY" && "🛍️ Takeaway / Delivery"}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-600 pr-2">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[11px]">&lt;5 mnt (Normal)</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-[11px]">5-10 mnt (At Risk)</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-[11px]">&gt;10 mnt (Delayed)</span>
          </div>
        </div>
      </div>

      {/* 4-Column KDS Live Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {columnConfig.map((col, idx) => {
          const ticketsInCol = activeOrders.filter((o) => col.statusGroup.includes(o.status));
          return (
            <div
              key={idx}
              className={`p-3 rounded-xl border ${col.color} space-y-3 min-h-[520px] flex flex-col justify-between`}
            >
              <div className="space-y-3">
                {/* Column Header */}
                <div className="flex items-center justify-between font-bold text-xs pb-2 border-b border-slate-200">
                  <span className="text-slate-800">{col.title}</span>
                  <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] ${col.headerBg}`}>
                    {ticketsInCol.length}
                  </span>
                </div>

                {/* Ticket Cards */}
                <div className="space-y-3">
                  {ticketsInCol.length === 0 ? (
                    <div className="text-center py-12 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg bg-white/50">
                      Tidak ada tiket antrean
                    </div>
                  ) : (
                    ticketsInCol.map((order) => {
                      const metrics = calculateOrderMetrics(order, currentTime);
                      const isDelayed = metrics.slaStatus === "DELAYED";
                      const isAtRisk = metrics.slaStatus === "AT_RISK";

                      return (
                        <Card
                          key={order.id}
                          className={`p-3.5 shadow-sm bg-white border transition-all ${
                            isDelayed
                              ? "border-red-400 bg-red-50/30 shadow-red-100"
                              : isAtRisk
                              ? "border-amber-400 bg-amber-50/30"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {/* Card Header: Table + Live Timer */}
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div>
                              <span className="font-bold text-xs text-slate-900 block">
                                {order.orderNumber}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {order.customerName || "Customer"}
                              </span>
                            </div>
                            <span className="font-bold text-xs px-2.5 py-0.5 rounded-md bg-brand-orange text-white shadow-xs">
                              Meja {order.tableNumber}
                            </span>
                          </div>

                          {/* SLA Timer Badge */}
                          <div className="py-2 flex items-center justify-between">
                            <span
                              suppressHydrationWarning
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                isDelayed
                                  ? "bg-red-100 text-red-700 animate-pulse border border-red-300"
                                  : isAtRisk
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              <Clock className="w-3 h-3 mr-1" />
                              {formatMinutesToHuman(metrics.totalCustomerWaitingMinutes)}
                              <span className="ml-1 text-[9px] uppercase">
                                ({metrics.slaStatus.replace("_", " ")})
                              </span>
                            </span>

                            <span className="text-[10px] text-slate-500 font-semibold uppercase px-1.5 py-0.5 bg-slate-100 rounded">
                              {order.orderType === "DINE_IN" ? "Dine In" : "Takeaway"}
                            </span>
                          </div>

                          {/* Items List with Modifiers */}
                          <div className="py-2 space-y-1.5 text-xs border-y border-slate-100 max-h-44 overflow-y-auto">
                            {order.items.map((it, itIdx) => (
                              <div key={itIdx} className="flex flex-col bg-slate-50/60 p-1.5 rounded">
                                <div className="flex justify-between font-bold text-slate-800">
                                  <span>{it.quantity}x {it.productName}</span>
                                </div>
                                {it.modifiers && it.modifiers.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {it.modifiers.map((mod, mIdx) => (
                                      <span
                                        key={mIdx}
                                        className="text-[10px] bg-orange-100 text-brand-orange font-semibold px-1 rounded"
                                      >
                                        ↳ {mod}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Action Button to Advance Order */}
                          {col.nextStatus && (
                            <div className="pt-2.5">
                              <Button
                                size="sm"
                                onClick={() => handleAdvance(order.id, col.nextStatus!)}
                                className={`w-full h-8 text-xs font-bold justify-center shadow-xs ${
                                  col.nextStatus === "COOKING"
                                    ? "bg-amber-500 hover:bg-amber-600 text-white"
                                    : col.nextStatus === "READY"
                                    ? "bg-brand-orange hover:bg-orange-600 text-white"
                                    : col.nextStatus === "SERVED"
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    : "bg-slate-900 hover:bg-slate-800 text-white"
                                }`}
                              >
                                {col.nextIcon}
                                <span>{col.nextLabel}</span>
                              </Button>
                            </div>
                          )}
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
