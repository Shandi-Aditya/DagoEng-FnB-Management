"use client";

import { ReceiptText, Ticket } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  bookingStatusLabel,
  bookingStatusTone,
  customerOrderStatusLabel,
  customerOrderStatusTone,
} from "@/features/customer/customer-domain";
import { cn, formatCurrencyIDR } from "@/lib/utils";
import { getBookingAttendance } from "@/features/events-checkin/events-checkin-domain";
import type { CoworkingBooking } from "@/types/coworking";
import type { EventTicketOrder } from "@/types/event";
import type { OrderRecord } from "@/types/order";

/** Kitchen progress a guest can follow, in order. */
const ORDER_STEPS: readonly { status: OrderRecord["status"][]; label: string }[] = [
  { status: ["NEW", "CONFIRMED"], label: "Diterima" },
  { status: ["KITCHEN_RECEIVED", "COOKING"], label: "Dimasak" },
  { status: ["READY", "SERVED", "COMPLETED"], label: "Siap" },
];

function stepIndex(status: OrderRecord["status"]): number {
  return ORDER_STEPS.findIndex((step) => step.status.includes(status));
}

function OrderProgress({ status }: { status: OrderRecord["status"] }) {
  const current = stepIndex(status);
  return (
    <ol className="grid grid-cols-3 gap-1.5" aria-label="Status pesanan">
      {ORDER_STEPS.map((step, index) => (
        <li key={step.label} className="flex flex-col gap-1">
          <span className={cn("h-1.5 rounded-full", index <= current ? "bg-unit-event" : "bg-muted")} aria-hidden />
          <span className={cn("text-xs", index <= current ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

interface ActivityViewProps {
  hasIdentity: boolean;
  orders: readonly OrderRecord[];
  bookings: readonly CoworkingBooking[];
  tickets: readonly EventTicketOrder[];
  onPayOrder: (order: OrderRecord) => void;
  onPayBooking: (booking: CoworkingBooking) => void;
  onOpenOrderReceipt: (order: OrderRecord) => void;
  onOpenBookingReceipt: (booking: CoworkingBooking) => void;
  onOpenTicket: (ticket: EventTicketOrder) => void;
  onStartOrder: () => void;
}

const isOpenOrder = (order: OrderRecord) => order.status !== "COMPLETED" && order.status !== "CANCELLED";

/** Everything the visitor has going on: live orders first, then room bookings, tickets and history. */
export function ActivityView(props: ActivityViewProps) {
  const liveOrders = props.orders.filter(isOpenOrder);
  const pastOrders = props.orders.filter((order) => !isOpenOrder(order)).slice(0, 10);
  const isEmpty = props.orders.length === 0 && props.bookings.length === 0 && props.tickets.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight">Aktivitas</h1>
        <p className="text-sm text-muted-foreground">Pesanan, booking ruang, dan tiket Anda.</p>
      </div>

      {isEmpty ? (
        <EmptyState
          className="border"
          icon={<ReceiptText />}
          title={props.hasIdentity ? "Belum ada aktivitas" : "Pesanan Anda akan muncul di sini"}
          description={
            props.hasIdentity
              ? "Pesan menu atau ruang kerja, statusnya muncul di sini."
              : "Kami mencocokkan pesanan dengan nomor WhatsApp yang Anda isi saat checkout."
          }
          action={<Button onClick={props.onStartOrder}>Pesan menu</Button>}
        />
      ) : null}

      {liveOrders.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="live-title">
          <h2 id="live-title" className="text-sm font-medium">Sedang berjalan</h2>
          {liveOrders.map((order) => (
            <article key={order.id} className="flex flex-col gap-4 rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <span className="font-medium">
                    Pesanan <span className="font-mono tabular-nums">#{order.orderNumber}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {order.orderType === "TAKEAWAY" ? "Bawa pulang" : `Meja ${order.tableNumber}`}, {order.items.reduce((sum, item) => sum + item.quantity, 0)} item
                  </span>
                </div>
                <span className="font-mono text-sm tabular-nums">{formatCurrencyIDR(order.total)}</span>
              </div>
              <OrderProgress status={order.status} />
              {order.paymentStatus !== "PAID" ? (
                <Button onClick={() => props.onPayOrder(order)}>Bayar sekarang</Button>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      {props.bookings.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="booking-title">
          <h2 id="booking-title" className="text-sm font-medium">Ruang kerja</h2>
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {props.bookings.map((booking) => (
              <li key={booking.id} className="flex items-center gap-3 p-4">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{booking.spaceName}</span>
                  <span className="text-xs text-muted-foreground">
                    {booking.date}, {booking.startTime}
                  </span>
                </div>
                {booking.paymentStatus === "PENDING" ? (
                  <Button size="sm" onClick={() => props.onPayBooking(booking)}>
                    Bayar
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => props.onOpenBookingReceipt(booking)}>
                    Struk
                  </Button>
                )}
                <StatusBadge status={bookingStatusTone(booking.checkInStatus)}>{bookingStatusLabel(booking.checkInStatus)}</StatusBadge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {props.tickets.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="ticket-title">
          <h2 id="ticket-title" className="text-sm font-medium">Tiket event</h2>
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {props.tickets.map((ticket) => {
              const { ticketCount: qty, checkedInQty, isCheckedIn, isPartial } = getBookingAttendance(ticket);
              const unpaidLabel =
                ticket.paymentStatus === "CANCELLED"
                  ? "Dibatalkan"
                  : ticket.paymentStatus === "EXPIRED"
                  ? "Kedaluwarsa"
                  : ticket.paymentStatus === "REFUNDED"
                  ? "Dikembalikan"
                  : "Menunggu bayar";
              const unpaidTone =
                ticket.paymentStatus === "PENDING" ? "warning" : "destructive";

              return (
                <li key={ticket.id}>
                  <button type="button" onClick={() => props.onOpenTicket(ticket)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/50">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-unit-event/15 text-unit-event">
                      <Ticket className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{ticket.eventTitle}</span>
                      <span className="text-xs text-muted-foreground">
                        <span className="font-mono tabular-nums">{ticket.ticketCount}</span> tiket, {ticket.ticketCode}
                      </span>
                    </span>
                    {ticket.paymentStatus !== "PAID" ? (
                      <StatusBadge status={unpaidTone}>{unpaidLabel}</StatusBadge>
                    ) : isCheckedIn ? (
                      <StatusBadge status="success">Hadir</StatusBadge>
                    ) : isPartial ? (
                      <StatusBadge status="info">Hadir {checkedInQty}/{qty}</StatusBadge>
                    ) : (
                      <StatusBadge status="neutral">Belum hadir</StatusBadge>
                    )}
                    <span className="text-xs font-medium text-muted-foreground">Lihat QR</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {pastOrders.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="past-title">
          <h2 id="past-title" className="text-sm font-medium">Riwayat pesanan</h2>
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {pastOrders.map((order) => (
              <li key={order.id} className="flex items-center gap-3 p-4">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">
                    <span className="font-mono tabular-nums">#{order.orderNumber}</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatCurrencyIDR(order.total)}</span>
                </div>
                <StatusBadge status={customerOrderStatusTone(order.status)}>{customerOrderStatusLabel(order.status)}</StatusBadge>
                {order.paymentStatus === "PAID" ? (
                  <Button size="sm" variant="ghost" onClick={() => props.onOpenOrderReceipt(order)}>
                    Struk
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
