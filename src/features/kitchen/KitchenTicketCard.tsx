"use client";

import { Clock, Printer, StickyNote } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { type KdsColumn, orderTypeLabel, slaTone } from "@/features/kitchen/kitchen-board";
import { calculateOrderMetrics, formatMinutesToHuman } from "@/lib/order-analytics";
import { cn } from "@/lib/utils";
import type { OrderItemRecord, OrderRecord } from "@/types/order";

const SLA_LABEL = { ON_TIME: "Tepat waktu", AT_RISK: "Mendekati batas", DELAYED: "Terlambat" } as const;

interface KitchenTicketCardProps {
  order: OrderRecord;
  items: readonly OrderItemRecord[];
  queueNumber: number;
  now: number;
  column: KdsColumn;
  onAdvance: () => void;
  onReprint: () => void;
}

/** One kitchen ticket: reads like the paper slip it backs up. */
export function KitchenTicketCard({ order, items, queueNumber, now, column, onAdvance, onReprint }: KitchenTicketCardProps) {
  const metrics = calculateOrderMetrics(order, now);
  const isDelayed = metrics.slaStatus === "DELAYED";
  const note = order.notes?.trim();

  return (
    <Card size="sm" className={cn("gap-3", isDelayed && "ring-destructive/50")}>
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="font-mono text-lg font-semibold tabular-nums">#{queueNumber}</span>
            <span className="truncate font-mono text-xs text-muted-foreground">{order.orderNumber}</span>
          </div>
          <Badge variant="outline" className="shrink-0 font-mono">
            Meja {order.tableNumber}
          </Badge>
        </div>
        <span className="truncate text-sm">{order.customerName || "Tamu"}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={slaTone(metrics.slaStatus)} className="text-xs">
            <Clock />
            <span className="font-mono tabular-nums" suppressHydrationWarning>
              {formatMinutesToHuman(metrics.totalCustomerWaitingMinutes)}
            </span>
            <span className="sr-only">{SLA_LABEL[metrics.slaStatus]}</span>
          </StatusBadge>
          <StatusBadge status={order.paymentStatus === "PAID" ? "success" : "warning"} className="text-xs">
            {order.paymentStatus === "PAID" ? "Lunas" : "Belum lunas"}
          </StatusBadge>
          <StatusBadge status="neutral" className="text-xs">
            {orderTypeLabel(order.orderType)}
          </StatusBadge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        {note ? (
          <p className="flex gap-1.5 rounded-md bg-warning/10 px-2 py-1.5 text-xs text-foreground">
            <StickyNote className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
            {note}
          </p>
        ) : null}
        <ul className="flex max-h-48 flex-col divide-y overflow-y-auto border-y text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex gap-2 py-1.5">
              <span className="w-6 shrink-0 font-mono font-semibold tabular-nums">{item.quantity}×</span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{item.productName}</span>
                {item.modifiers?.length ? (
                  <span className="text-xs text-muted-foreground">{item.modifiers.join(", ")}</span>
                ) : null}
                {item.notes?.trim() ? <span className="text-xs text-warning">Catatan: {item.notes.trim()}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="gap-1.5">
        <Button variant="outline" size="icon-lg" onClick={onReprint} aria-label="Cetak ulang tiket dapur" title="Cetak ulang tiket dapur">
          <Printer />
        </Button>
        <Button size="lg" className="flex-1" onClick={onAdvance}>
          {column.nextLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
