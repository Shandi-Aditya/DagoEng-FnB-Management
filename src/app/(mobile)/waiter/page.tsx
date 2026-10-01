"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTables, TableItem } from "@/contexts/TableContext";
import { useOrders } from "@/contexts/OrderContext";
import { useOutlet } from "@/contexts/OutletContext";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  Grid,
  Plus,
  Users,
  UtensilsCrossed,
  CheckCircle2,
  RotateCcw,
  Store,
  Clock,
  Receipt,
  Sparkles,
  ArrowLeft,
  ChevronDown,
  Flame,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function WaiterMobilePage() {
  const { activeOutlet, activeOutletId } = useOutlet();
  const { areas, filteredAreas, updateTableStatus, releaseTableToAvailable } = useTables();
  const { orders, advanceOrderStatus } = useOrders();
  const [filterArea, setFilterArea] = useState<string>("ALL");

  // Filter tables strictly for active outlet
  const currentOutletAreas = areas.filter((a) => a.outletId === (activeOutletId || "outlet-sgr"));
  const allOutletTables = currentOutletAreas.flatMap((a) => a.tables);

  const displayedTables = currentOutletAreas
    .filter((a) => filterArea === "ALL" || a.id === filterArea)
    .flatMap((a) => a.tables);

  const handleToggleTableAction = (table: TableItem) => {
    if (table.status === "OCCUPIED") {
      // Step 1: Customer requests bill -> mark as BILLING
      updateTableStatus(table.id, "BILLING");
    } else if (table.status === "BILLING") {
      // Step 2: Bill settled & guest left -> mark as CLEANING
      updateTableStatus(table.id, "CLEANING");
    } else if (table.status === "CLEANING") {
      // Step 3: Waiter cleaned table -> reset completely to AVAILABLE with Rp 0
      releaseTableToAvailable(table.id);
    } else if (table.status === "AVAILABLE") {
      // Step 4: Seat walk-in guest
      updateTableStatus(table.id, "OCCUPIED", "Tamu Walk-in Waiter", "Rp 0");
    } else if (table.status === "RESERVED") {
      updateTableStatus(table.id, "OCCUPIED", table.customer || "Tamu Reservasi", "Rp 0");
    }
  };

  const handleForceReset = (tableId: string) => {
    releaseTableToAvailable(tableId);
  };

  return (
    <div className="min-h-screen bg-slate-100 max-w-lg mx-auto flex flex-col justify-between border-x border-slate-200 shadow-xl font-sans">
      <div>
        {/* Sticky Header */}
        <div className="p-4 bg-slate-900 text-white sticky top-0 z-30 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-orange text-white flex items-center justify-center font-bold">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-xs leading-none text-white flex items-center space-x-1.5">
                <span>Pramusaji / Waiter Floor</span>
                <span className="text-[9px] bg-brand-orange/30 text-brand-orange border border-brand-orange/40 px-1.5 py-0.2 rounded font-mono">
                  LIVE
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 mt-0.5 flex items-center space-x-1">
                <Store className="w-3 h-3 text-brand-orange" />
                <span>Outlet: <strong>{activeOutlet?.name || "Singaraja"}</strong></span>
              </p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="text-[11px] text-slate-300 hover:text-white font-semibold flex items-center space-x-1 bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Dashboard</span>
          </Link>
        </div>

        {/* Filter Area Tabs */}
        <div className="p-3 bg-white border-b border-slate-200 flex items-center space-x-1.5 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setFilterArea("ALL")}
            className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
              filterArea === "ALL"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Semua Area ({allOutletTables.length})
          </button>
          {currentOutletAreas.map((a) => (
            <button
              key={a.id}
              onClick={() => setFilterArea(a.id)}
              className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
                filterArea === a.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {a.name} ({a.tables.length})
            </button>
          ))}
        </div>

        {/* Floor Tables Grid */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Denah Meja Outlet Terhubung</span>
            <span className="text-[11px] font-bold text-slate-700">
              {allOutletTables.filter((t) => t.status === "OCCUPIED").length} Meja Terisi
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayedTables.map((t) => {
              const isOccupied = t.status === "OCCUPIED";
              const isReserved = t.status === "RESERVED";
              const isBilling = t.status === "BILLING";
              const isCleaning = t.status === "CLEANING";
              const isAvailable = t.status === "AVAILABLE";

              // Find active order attached to this table
              const activeOrder = orders.find(
                (o) =>
                  (o.tableNumber === t.number || o.tableNumber === t.id) &&
                  o.outletId === (activeOutletId || "outlet-sgr") &&
                  o.status !== "COMPLETED" &&
                  o.status !== "CANCELLED"
              );

              const badgeColor = isOccupied
                ? "bg-rose-500 text-white"
                : isReserved
                ? "bg-amber-500 text-white"
                : isBilling
                ? "bg-blue-600 text-white animate-pulse"
                : isCleaning
                ? "bg-purple-600 text-white"
                : "bg-emerald-100 text-emerald-800 border border-emerald-300";

              return (
                <div
                  key={t.id}
                  className={`p-3.5 rounded-2xl border text-xs flex flex-col justify-between space-y-2.5 transition-all shadow-xs ${
                    isOccupied
                      ? "bg-white border-rose-200"
                      : isBilling
                      ? "bg-blue-50/50 border-blue-300 ring-1 ring-blue-400"
                      : isReserved
                      ? "bg-amber-50/40 border-amber-300"
                      : isCleaning
                      ? "bg-purple-50/40 border-purple-300"
                      : "bg-white border-slate-200"
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-sm text-slate-900">{t.number}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        ({t.cap} Pax)
                      </span>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${badgeColor}`}>
                      {isBilling ? "Tagihan (Bill)" : t.status}
                    </span>
                  </div>

                  {/* Customer & Bill Info */}
                  <div className="space-y-1">
                    {t.customer ? (
                      <p className="font-bold text-slate-800 text-xs truncate">
                        👤 {t.customer}
                      </p>
                    ) : (
                      <p className="text-slate-400 text-[11px] italic">Meja kosong / belum ada tamu</p>
                    )}

                    {t.total && (
                      <p className="text-brand-orange font-black text-xs">
                        Tagihan: {t.total}
                      </p>
                    )}
                  </div>

                  {/* Ordered Items Breakdown (What is ordered & preparation status) */}
                  {activeOrder && activeOrder.items.length > 0 && (
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between font-bold text-slate-700 text-[10px] pb-1 border-b border-slate-200/60">
                        <span>Pesanan Menu ({activeOrder.items.length} item):</span>
                        <span className={`font-mono ${activeOrder.status === "READY" ? "text-emerald-600 font-bold" : "text-slate-500"}`}>
                          {activeOrder.status === "COOKING" ? "🍳 Dimasak" : activeOrder.status === "READY" ? "✅ Siap Saji" : "⏳ Antre"}
                        </span>
                      </div>
                      <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                        {activeOrder.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between text-slate-800 font-medium">
                            <span className="truncate">{it.quantity}x {it.productName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-1.5 space-y-1.5">
                    <Button
                      size="sm"
                      onClick={() => handleToggleTableAction(t)}
                      className={`w-full h-8 text-xs font-bold justify-center shadow-xs ${
                        isOccupied
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : isBilling
                          ? "bg-purple-600 hover:bg-purple-700 text-white"
                          : isCleaning
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : isReserved
                          ? "bg-amber-600 hover:bg-amber-700 text-white"
                          : "bg-brand-orange hover:bg-orange-600 text-white"
                      }`}
                    >
                      {isOccupied && "Minta Bill / Tagihan"}
                      {isBilling && "Tamu Bayar ➔ Bersihkan Meja"}
                      {isCleaning && "Selesai Bersihkan (Reset Meja)"}
                      {isReserved && "Dudukkan Tamu Reservasi"}
                      {isAvailable && "+ Dudukkan Tamu Baru"}
                    </Button>

                    {/* Secondary Quick Reset Button if needed */}
                    {!isAvailable && (
                      <button
                        onClick={() => handleForceReset(t.id)}
                        className="w-full text-[10px] text-slate-400 hover:text-red-600 font-semibold py-0.5 transition-colors flex items-center justify-center space-x-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Paksa Kosongkan / Reset Rp 0</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
