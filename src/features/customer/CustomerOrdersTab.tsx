"use client";

import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  CreditCard,
  FileText,
  Laptop,
  Receipt,
  RotateCcw,
  Ticket,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrencyIDR } from "@/lib/utils";
import type { OrderRecord } from "@/types/order";
import type { EventTicketOrder } from "@/types/event";

import {
  bookingStatusLabel,
  bookingStatusTone,
  customerOrderStatusLabel,
  customerOrderStatusTone,
} from "./customer-domain";

export interface CustomerOrdersTabProps {
  orders: OrderRecord[];
  coworkingBookings: any[];
  eventTickets: EventTicketOrder[];
  onOpenReceipt: (order: OrderRecord) => void;
  onOpenCoworkingReceipt: (booking: any) => void;
  onOpenTicketPass: (ticket: EventTicketOrder) => void;
  onCancelOrder?: (orderId: string) => void;
  onCancelCoworkingBooking?: (bookingId: string) => void;
  onPayPendingOrder?: (order: OrderRecord) => void;
  onPayPendingCoworking?: (booking: any) => void;
}

export function CustomerOrdersTab({
  orders,
  coworkingBookings,
  eventTickets,
  onOpenReceipt,
  onOpenCoworkingReceipt,
  onOpenTicketPass,
  onCancelOrder,
  onCancelCoworkingBooking,
  onPayPendingOrder,
  onPayPendingCoworking,
}: CustomerOrdersTabProps) {
  const [filterType, setFilterType] = useState<"ALL" | "FNB" | "COWORKING" | "EVENTS">("ALL");

  const activeOrders = orders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED");
  const pastOrders = orders.filter((o) => o.status === "COMPLETED" || o.status === "CANCELLED");

  const activeCoworking = coworkingBookings.filter(
    (b) => b.status === "CONFIRMED" || b.status === "CHECKED_IN" || (b.paymentStatus === "PENDING" && b.status !== "CANCELLED"),
  );
  const pastCoworking = coworkingBookings.filter(
    (b) => b.status === "COMPLETED" || b.status === "CANCELLED",
  );

  const totalActive = activeOrders.length + activeCoworking.length + eventTickets.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Sub-filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-medium text-foreground">Pesanan dan tiket aktif</h2>
          <p className="text-xs text-muted-foreground">
            Pantau status pesanan makanan, reservasi ruang kerja, dan tiket event Anda.
          </p>
        </div>

        <Tabs value={filterType} onValueChange={(v) => setFilterType(v as any)}>
          <TabsList className="overflow-x-auto no-scrollbar gap-1 bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="ALL">Semua</TabsTrigger>
            <TabsTrigger value="FNB">Kuliner ({orders.length})</TabsTrigger>
            <TabsTrigger value="COWORKING">Ruang ({coworkingBookings.length})</TabsTrigger>
            <TabsTrigger value="EVENTS">Event ({eventTickets.length})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 1. TIKET EVENT AKTIF */}
      {(filterType === "ALL" || filterType === "EVENTS") && eventTickets.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Ticket className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Tiket event komunitas ({eventTickets.length})</h3>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {eventTickets.map((t) => (
              <Card key={t.id} className="flex flex-col justify-between">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-medium text-foreground">{t.ticketCode}</span>
                    <Badge variant={t.paymentStatus === "PAID" ? "default" : "secondary"}>
                      {t.paymentStatus === "PAID" ? "Lunas" : "Menunggu verifikasi"}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-medium mt-1">{t.eventTitle}</CardTitle>
                  <CardDescription className="text-xs">
                    {new Date(t.eventDate).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })} · {t.eventLocation}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-1 flex items-center justify-between border-t mt-2">
                  <span className="text-xs text-muted-foreground font-mono tabular-nums">
                    {t.ticketCount || 1} tiket · {formatCurrencyIDR(t.totalPrice)}
                  </span>
                  <Button type="button" size="sm" onClick={() => onOpenTicketPass(t)}>
                    <Ticket />
                    <span>Lihat tiket</span>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {/* 2. BOOKING COWORKING AKTIF */}
      {(filterType === "ALL" || filterType === "COWORKING") && activeCoworking.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Laptop className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Booking ruang kerja aktif ({activeCoworking.length})</h3>
          </div>

          <div className="flex flex-col gap-3">
            {activeCoworking.map((b) => (
              <Card key={b.id}>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-foreground">{b.spaceName}</span>
                      <p className="text-xs text-muted-foreground font-mono tabular-nums">
                        {b.date} · {b.startTime} - {b.endTime} ({b.durationHours} jam)
                      </p>
                    </div>
                    <StatusBadge status={bookingStatusTone(b.status)}>
                      {bookingStatusLabel(b.status)}
                    </StatusBadge>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {formatCurrencyIDR(b.totalPrice)}
                    </span>

                    <div className="flex items-center gap-2">
                      {b.paymentStatus === "PENDING" && onPayPendingCoworking ? (
                        <Button type="button" size="sm" onClick={() => onPayPendingCoworking(b)}>
                          <CreditCard />
                          <span>Bayar</span>
                        </Button>
                      ) : (
                        <Button type="button" size="sm" variant="outline" onClick={() => onOpenCoworkingReceipt(b)}>
                          <Receipt />
                          <span>Struk</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {/* 3. PESANAN F&B AKTIF */}
      {(filterType === "ALL" || filterType === "FNB") && activeOrders.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Coffee className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Pesanan kuliner berjalan ({activeOrders.length})</h3>
          </div>

          <div className="flex flex-col gap-3">
            {activeOrders.map((o) => (
              <Card key={o.id}>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-sm font-medium text-foreground">{o.orderNumber}</span>
                      <p className="text-xs text-muted-foreground">
                        Meja {o.tableNumber} · {new Date(o.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <StatusBadge status={customerOrderStatusTone(o.status)}>
                      {customerOrderStatusLabel(o.status)}
                    </StatusBadge>
                  </div>

                  {/* Ringkasan Item Pesanan */}
                  <ul className="flex flex-col divide-y rounded-lg border bg-muted/20 px-3 py-1 text-xs">
                    {o.items?.map((item: any, idx: number) => (
                      <li key={idx} className="flex justify-between py-1.5 first:pt-1 last:pb-1">
                        <span>
                          {item.quantity}× {item.product?.name || item.name}
                        </span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {formatCurrencyIDR((item.product?.basePrice || item.price || 0) * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {formatCurrencyIDR(o.total)}
                    </span>

                    <div className="flex items-center gap-2">
                      {o.paymentStatus !== "PAID" && onPayPendingOrder ? (
                        <Button type="button" size="sm" onClick={() => onPayPendingOrder(o)}>
                          <CreditCard />
                          <span>Bayar sekarang</span>
                        </Button>
                      ) : (
                        <Button type="button" size="sm" variant="outline" onClick={() => onOpenReceipt(o)}>
                          <Receipt />
                          <span>Lihat nota</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {/* State Kosong jika Tidak Ada Pesanan Aktif */}
      {totalActive === 0 && (
        <EmptyState
          className="border"
          icon={<Clock />}
          title="Tidak ada pesanan aktif"
          description="Pesanan makanan, reservasi ruang kerja, atau tiket event yang sedang berlangsung akan muncul di sini."
        />
      )}

      {/* 4. RIWAYAT PESANAN SELESAI */}
      {pastOrders.length > 0 || pastCoworking.length > 0 ? (
        <div className="flex flex-col gap-3 pt-4 border-t">
          <h3 className="text-sm font-medium text-foreground">Riwayat transaksi selesai</h3>

          <div className="flex flex-col divide-y rounded-lg border bg-card">
            {pastOrders.slice(0, 10).map((o) => (
              <div key={o.id} className="flex items-center justify-between p-3.5 text-xs">
                <div className="flex flex-col">
                  <span className="font-mono font-medium text-foreground">{o.orderNumber}</span>
                  <span className="text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                    })} · Meja {o.tableNumber}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCurrencyIDR(o.total)}
                  </span>
                  <StatusBadge status={customerOrderStatusTone(o.status)}>
                    {customerOrderStatusLabel(o.status)}
                  </StatusBadge>
                  <Button type="button" size="icon-xs" variant="ghost" onClick={() => onOpenReceipt(o)} aria-label="Lihat nota">
                    <Receipt />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
