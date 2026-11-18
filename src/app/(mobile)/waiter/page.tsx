"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { UtensilsCrossed, Bell } from "lucide-react";
import { useTables, type TableItem } from "@/contexts/TableContext";
import { useOrders } from "@/contexts/OrderContext";
import { useOutlet } from "@/contexts/OutletContext";
import { EmptyState } from "@/components/app/empty-state";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { UnitScope } from "@/components/app/unit-scope";
import { Button } from "@/components/ui/button";
import { soundChime } from "@/lib/audio-chime";

import {
  calculateWaiterFloorSummary,
  findActiveOrderForTable,
  getReadyWaiterOrders,
} from "@/features/waiter/waiter-domain";
import { WaiterHeader } from "@/features/waiter/WaiterHeader";
import { WaiterSummaryBar } from "@/features/waiter/WaiterSummaryBar";
import { WaiterAreaTabs } from "@/features/waiter/WaiterAreaTabs";
import { WaiterTableCard } from "@/features/waiter/WaiterTableCard";
import { WaiterOrderReadyModal } from "@/features/waiter/WaiterOrderReadyModal";

export default function WaiterMobilePage() {
  const { activeOutlet, activeOutletId } = useOutlet();
  const { areas, updateTableStatus, releaseTableToAvailable } = useTables();
  const { orders, advanceOrderStatus } = useOrders();

  const [filterArea, setFilterArea] = useState<string>("ALL");
  const [tableToReset, setTableToReset] = useState<TableItem | null>(null);
  const [dismissedReadyOrderIds, setDismissedReadyOrderIds] = useState<Set<string>>(new Set());
  const [isReadyModalOpen, setIsReadyModalOpen] = useState(false);

  // V-14: Detect orders ready from kitchen for this outlet
  const readyOrders = useMemo(() => {
    return getReadyWaiterOrders(orders, activeOutletId || "outlet-sgr", dismissedReadyOrderIds);
  }, [orders, activeOutletId, dismissedReadyOrderIds]);

  const previousReadyCountRef = useRef(0);
  useEffect(() => {
    if (readyOrders.length > previousReadyCountRef.current) {
      soundChime.playKitchenBell();
      setIsReadyModalOpen(true);
    }
    previousReadyCountRef.current = readyOrders.length;
  }, [readyOrders.length]);

  const handleServeOrder = (orderId: string) => {
    soundChime.playKitchenBell();
    advanceOrderStatus(orderId, "SERVED");
    setDismissedReadyOrderIds((prev) => new Set([...prev, orderId]));
    if (readyOrders.length <= 1) {
      setIsReadyModalOpen(false);
    }
  };

  const handleDismissReadyOrder = (orderId: string) => {
    setDismissedReadyOrderIds((prev) => new Set([...prev, orderId]));
    if (readyOrders.length <= 1) {
      setIsReadyModalOpen(false);
    }
  };

  const currentOutletAreas = useMemo(() => {
    return areas.filter((a) => a.outletId === (activeOutletId || "outlet-sgr"));
  }, [areas, activeOutletId]);

  useEffect(() => {
    if (filterArea !== "ALL" && !currentOutletAreas.some((a) => a.id === filterArea)) {
      setFilterArea("ALL");
    }
  }, [currentOutletAreas, filterArea]);

  const allOutletTables = useMemo(() => {
    return currentOutletAreas.flatMap((a) => a.tables);
  }, [currentOutletAreas]);

  const displayedTables = useMemo(() => {
    return currentOutletAreas
      .filter((a) => filterArea === "ALL" || a.id === filterArea)
      .flatMap((a) => a.tables);
  }, [currentOutletAreas, filterArea]);

  const floorSummary = useMemo(() => {
    return calculateWaiterFloorSummary(allOutletTables);
  }, [allOutletTables]);

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

  const handleConfirmForceReset = () => {
    if (tableToReset) {
      releaseTableToAvailable(tableToReset.id);
      setTableToReset(null);
    }
  };

  return (
    <div
      data-unit="fnb"
      className="min-h-screen bg-background text-foreground flex flex-col justify-between font-sans"
    >
      <UnitScope unit="fnb" />
      <div className="flex-1 flex flex-col">
        {/* 1. Sticky Mobile & Tablet Header */}
        <WaiterHeader outletName={activeOutlet?.name || "Singaraja"} />

        {/* 2. Responsive Content Container */}
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
          {/* Floor Occupancy & Status Summary */}
          <WaiterSummaryBar summary={floorSummary} />

          {/* V-14: Banner pemberitahuan pesanan siap disajikan */}
          {readyOrders.length > 0 ? (
            <div className="mx-4 sm:mx-6 mt-3 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Bell className="size-3.5" />
                </span>
                <span className="font-medium">
                  {readyOrders.length} pesanan siap disajikan dari dapur
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => setIsReadyModalOpen(true)}
              >
                Lihat pesanan siap
              </Button>
            </div>
          ) : null}

          {/* Filter Area Tabs */}
          <WaiterAreaTabs
            areas={currentOutletAreas}
            selectedArea={filterArea}
            onSelectArea={setFilterArea}
            totalTablesCount={allOutletTables.length}
          />

          {/* Floor Tables Grid: 1 col on mobile, 2 cols on small tablet, 3 on tablet, 4 on wide tablet */}
          <main className="flex-1 p-4 sm:p-6">
            {displayedTables.length === 0 ? (
              <EmptyState
                className="border py-12"
                icon={<UtensilsCrossed className="size-8 text-muted-foreground" />}
                title="Tidak ada meja di area ini"
                description="Pilih area lain atau tampilkan seluruh area meja outlet."
                action={
                  filterArea !== "ALL" ? (
                    <Button variant="outline" size="lg" onClick={() => setFilterArea("ALL")}>
                      Tampilkan semua area
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {displayedTables.map((t) => {
                  const activeOrder = findActiveOrderForTable(
                    orders,
                    t.number,
                    t.id,
                    activeOutletId || "outlet-sgr"
                  );

                  return (
                    <WaiterTableCard
                      key={t.id}
                      table={t}
                      activeOrder={activeOrder}
                      onAction={handleToggleTableAction}
                      onRequestForceReset={(table) => setTableToReset(table)}
                    />
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* 5. Safe Reset Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(tableToReset)}
        onOpenChange={(open) => !open && setTableToReset(null)}
        title="Kosongkan Meja"
        description={`Apakah Anda yakin ingin mengosongkan ${tableToReset?.number}? Data tamu dan rincian tagihan akan di-reset ke status tersedia.`}
        confirmLabel="Kosongkan meja"
        destructive
        onConfirm={handleConfirmForceReset}
      />

      {/* V-14: Waiter Order Ready Modal */}
      <WaiterOrderReadyModal
        open={isReadyModalOpen && readyOrders.length > 0}
        orders={readyOrders}
        onServe={handleServeOrder}
        onDismiss={handleDismissReadyOrder}
        onClose={() => setIsReadyModalOpen(false)}
      />
    </div>
  );
}
