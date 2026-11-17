"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Volume2, VolumeX } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useOrders } from "@/contexts/OrderContext";
import { useOutlet } from "@/contexts/OutletContext";
import { KitchenTicketCard } from "@/features/kitchen/KitchenTicketCard";
import { KitchenNewOrderModal } from "@/features/kitchen/KitchenNewOrderModal";
import {
  KDS_COLUMNS,
  type KitchenStation,
  type KitchenTypeFilter,
  STATION_FILTERS,
  TYPE_FILTERS,
  buildReprintTicket,
  effectiveKitchenStatus,
  filterKitchenOrders,
  getNewIncomingKitchenOrders,
  ticketItems,
} from "@/features/kitchen/kitchen-board";
import { KitchenOrderReceiptModal } from "@/features/pos/KitchenOrderReceiptModal";
import { soundChime } from "@/lib/audio-chime";
import { isAddonActive } from "@/lib/subscription";
import { DEFAULT_FNB_TENANTS } from "@/lib/tenant";
import type { OrderStatus } from "@/types/order";
import type { KitchenTicketData } from "@/types/printer";

const CLOCK_TICK_MS = 1000;

// Mirrors calculateOrderMetrics: at risk from 75% of the order's target, delayed past it
const SLA_LEGEND = [
  { tone: "bg-success", label: "Tepat waktu" },
  { tone: "bg-warning", label: "Mendekati target" },
  { tone: "bg-destructive", label: "Lewat target" },
] as const;

export default function KitchenKDSPage() {
  const { user } = useAuth();
  const { activeOutlet } = useOutlet();
  const { filteredOrders, advanceOrderStatus } = useOrders();
  const [ticketToPrint, setTicketToPrint] = useState<KitchenTicketData | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [typeFilter, setTypeFilter] = useState<KitchenTypeFilter>("ALL");
  const [station, setStation] = useState<KitchenStation>("ALL");
  const isMultiStation = isAddonActive("KDS_MULTI_STATION");

  // Live clock for the SLA timers
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const isTenantLocked =
    Boolean(user?.tenant?.id) &&
    (user?.scopeLevel === "TENANT" || user?.role?.slug === "KITCHEN_STAFF");
  const [selectedTenant, setSelectedTenant] = useState<string>(
    isTenantLocked ? user?.tenant?.id || "ALL" : "ALL"
  );

  useEffect(() => {
    if (isTenantLocked && user?.tenant?.id) {
      setSelectedTenant(user.tenant.id);
    } else if (!isTenantLocked) {
      setSelectedTenant("ALL");
    }
  }, [isTenantLocked, user?.tenant?.id]);

  const effectiveTenantId = isTenantLocked
    ? user?.tenant?.id
    : selectedTenant === "ALL"
    ? undefined
    : selectedTenant;

  const activeOrders = useMemo(
    () =>
      filterKitchenOrders(filteredOrders, {
        tenantId: effectiveTenantId,
        type: typeFilter,
        station,
        multiStation: isMultiStation,
      }),
    [filteredOrders, effectiveTenantId, typeFilter, station, isMultiStation],
  );

  // V-14: Track and detect incoming unaccepted new orders for real-time popup
  const [dismissedNewOrderIds, setDismissedNewOrderIds] = useState<Set<string>>(new Set());
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);

  const incomingNewOrders = useMemo(() => {
    return getNewIncomingKitchenOrders(filteredOrders, effectiveTenantId, dismissedNewOrderIds);
  }, [filteredOrders, effectiveTenantId, dismissedNewOrderIds]);

  const previousIncomingCountRef = useRef(0);
  useEffect(() => {
    if (incomingNewOrders.length > previousIncomingCountRef.current) {
      if (isSoundEnabled) soundChime.playKitchenBell();
      setIsNewOrderModalOpen(true);
    }
    previousIncomingCountRef.current = incomingNewOrders.length;
  }, [incomingNewOrders.length, isSoundEnabled]);

  // Ring the bell when a new ticket arrives on the board
  const previousCountRef = useRef(activeOrders.length);
  useEffect(() => {
    if (activeOrders.length > previousCountRef.current && isSoundEnabled && !isNewOrderModalOpen) {
      soundChime.playKitchenBell();
    }
    previousCountRef.current = activeOrders.length;
  }, [activeOrders.length, isSoundEnabled, isNewOrderModalOpen]);

  const tenantUpdatePayload = effectiveTenantId ? { tenantId: effectiveTenantId } : undefined;

  const handleAdvance = (orderId: string, nextStatus: OrderStatus) => {
    if (isSoundEnabled) soundChime.playKitchenBell();
    advanceOrderStatus(orderId, nextStatus, undefined, tenantUpdatePayload);
  };

  const handleAcceptNewOrder = (orderId: string) => {
    if (isSoundEnabled) soundChime.playKitchenBell();
    advanceOrderStatus(orderId, "KITCHEN_RECEIVED", undefined, tenantUpdatePayload);
    setDismissedNewOrderIds((prev) => new Set([...prev, orderId]));
    if (incomingNewOrders.length <= 1) {
      setIsNewOrderModalOpen(false);
    }
  };

  const handleAcceptAllNewOrders = (orderIds: string[]) => {
    if (isSoundEnabled) soundChime.playKitchenBell();
    for (const id of orderIds) {
      advanceOrderStatus(id, "KITCHEN_RECEIVED", undefined, tenantUpdatePayload);
    }
    setDismissedNewOrderIds((prev) => new Set([...prev, ...orderIds]));
    setIsNewOrderModalOpen(false);
  };

  const handleDismissNewOrder = (orderId: string) => {
    setDismissedNewOrderIds((prev) => new Set([...prev, orderId]));
    if (incomingNewOrders.length <= 1) {
      setIsNewOrderModalOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dapur"
        description={`${activeOutlet?.name ?? "Singaraja"} · Pesanan juga dicetak ke printer dapur, layar ini cadangan visualnya.`}
        actions={
          <>
            {incomingNewOrders.length > 0 ? (
              <Button
                variant="default"
                size="sm"
                className="animate-pulse"
                onClick={() => setIsNewOrderModalOpen(true)}
              >
                <Bell />
                {incomingNewOrders.length} pesanan baru
              </Button>
            ) : null}
            <Badge variant="secondary" className="tabular-nums">
              {activeOrders.length} tiket aktif
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => soundChime.playKitchenBell()}>
              <Bell />
              Tes bel
            </Button>
            <Button variant="outline" size="sm" aria-pressed={isSoundEnabled} onClick={() => setIsSoundEnabled((on) => !on)}>
              {isSoundEnabled ? <Volume2 /> : <VolumeX />}
              {isSoundEnabled ? "Suara aktif" : "Suara mati"}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {!isTenantLocked ? (
            <Tabs value={selectedTenant} onValueChange={setSelectedTenant}>
              <TabsList>
                <TabsTrigger value="ALL">Semua mitra</TabsTrigger>
                {DEFAULT_FNB_TENANTS.map((t) => (
                  <TabsTrigger key={t.id} value={t.id}>
                    {t.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : (
            <Badge variant="outline" className="text-xs">
              {user?.tenant?.name || "Dapur Mitra"}
            </Badge>
          )}
          <Tabs value={typeFilter} onValueChange={(value) => setTypeFilter(value as KitchenTypeFilter)}>
            <TabsList>
              {TYPE_FILTERS.map((filter) => (
                <TabsTrigger key={filter.value} value={filter.value}>
                  {filter.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {isMultiStation ? (
            <Tabs value={station} onValueChange={(value) => setStation(value as KitchenStation)}>
              <TabsList>
                {STATION_FILTERS.map((filter) => (
                  <TabsTrigger key={filter.value} value={filter.value}>
                    {filter.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : (
            <span className="text-xs text-muted-foreground">Satu jalur dapur</span>
          )}
        </div>
        <ul className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" aria-label="Status waktu tunggu terhadap target pesanan">
          {SLA_LEGEND.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${item.tone}`} aria-hidden />
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KDS_COLUMNS.map((column) => {
          const tickets = activeOrders.filter((order) =>
            column.statuses.includes(effectiveKitchenStatus(order, effectiveTenantId))
          );
          return (
            <section key={column.title} className="flex min-h-[480px] flex-col gap-3 rounded-xl bg-muted/50 p-3" aria-label={column.title}>
              <header className="flex items-center justify-between">
                <h2 className="text-sm font-medium">{column.title}</h2>
                <StatusBadge status={column.tone} className="tabular-nums">
                  {tickets.length}
                </StatusBadge>
              </header>
              {tickets.length === 0 ? (
                <p className="rounded-lg border border-dashed py-10 text-center text-xs text-muted-foreground">Tidak ada tiket</p>
              ) : (
                tickets.map((order, ticketIdx) => {
                  const items = ticketItems(order, effectiveTenantId);
                  const queueNumber = ticketIdx + 1;
                  return (
                    <KitchenTicketCard
                      key={order.id}
                      order={order}
                      items={items}
                      queueNumber={queueNumber}
                      now={now}
                      column={column}
                      onAdvance={() => handleAdvance(order.id, column.nextStatus)}
                      onReprint={() =>
                        setTicketToPrint(
                          buildReprintTicket(
                            order,
                            items,
                            queueNumber,
                            `${new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Makassar" })} WITA`,
                          ),
                        )
                      }
                    />
                  );
                })
              )}
            </section>
          );
        })}
      </div>

      <KitchenOrderReceiptModal isOpen={ticketToPrint !== null} ticketData={ticketToPrint} onClose={() => setTicketToPrint(null)} />

      <KitchenNewOrderModal
        open={isNewOrderModalOpen && incomingNewOrders.length > 0}
        orders={incomingNewOrders}
        tenantId={effectiveTenantId}
        onAccept={handleAcceptNewOrder}
        onAcceptAll={handleAcceptAllNewOrders}
        onDismiss={handleDismissNewOrder}
        onClose={() => setIsNewOrderModalOpen(false)}
      />
    </div>
  );
}
