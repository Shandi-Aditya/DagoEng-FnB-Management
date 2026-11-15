"use client";

import React from "react";
import { MoreVertical, RotateCcw, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TableItem } from "@/contexts/TableContext";
import type { OrderRecord } from "@/types/order";
import {
  getTableStatusDisplay,
  getTableLifecycleAction,
  formatKitchenPrepStatus,
} from "./waiter-domain";

interface WaiterTableCardProps {
  table: TableItem;
  activeOrder?: OrderRecord;
  onAction: (table: TableItem) => void;
  onRequestForceReset: (table: TableItem) => void;
}

export function WaiterTableCard({
  table,
  activeOrder,
  onAction,
  onRequestForceReset,
}: WaiterTableCardProps) {
  const statusDisplay = getTableStatusDisplay(table.status);
  const action = getTableLifecycleAction(table.status);
  const isAvailable = table.status === "AVAILABLE";

  const prepStatus = activeOrder ? formatKitchenPrepStatus(activeOrder.status) : null;
  const orderItems = activeOrder?.items || [];
  const visibleItems = orderItems.slice(0, 2);
  const remainingItemsCount = Math.max(0, orderItems.length - 2);

  return (
    <Card className="rounded-xl border bg-card p-3.5 flex flex-col justify-between gap-3 text-xs shadow-xs">
      {/* 1. Header: Table number, capacity, status badge, and optional dropdown */}
      <div className="flex items-center justify-between pb-2 border-b gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm text-foreground truncate">
            {table.number}
          </span>
          <span className="text-muted-foreground text-xs shrink-0">
            ({table.cap} pax)
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <StatusBadge status={statusDisplay.tone}>
            {statusDisplay.label}
          </StatusBadge>

          {!isAvailable && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="Opsi meja">
                    <MoreVertical className="size-3.5" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onRequestForceReset(table)}
                >
                  <RotateCcw />
                  <span>Kosongkan meja</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* 2. Customer & Bill Info */}
      <div className="space-y-1">
        {table.customer ? (
          <p className="font-medium text-foreground truncate">
            Pelanggan: {table.customer}
          </p>
        ) : (
          <p className="text-muted-foreground italic text-xs">
            Meja kosong
          </p>
        )}

        {table.total && (
          <p className="font-mono tabular-nums font-medium text-foreground">
            Tagihan: {table.total}
          </p>
        )}
      </div>

      {/* 3. Ordered Items Breakdown (if active order present) */}
      {orderItems.length > 0 && prepStatus && (
        <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between pb-1 border-b text-xs">
            <span className="font-medium text-muted-foreground flex items-center gap-1">
              <UtensilsCrossed className="size-3" />
              <span>Pesanan ({orderItems.length} menu)</span>
            </span>
            <StatusBadge status={prepStatus.tone} className="text-xs h-5 px-1.5">
              {prepStatus.label}
            </StatusBadge>
          </div>

          <div className="space-y-1">
            {visibleItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-foreground truncate">
                <span className="truncate">
                  {item.quantity}x {item.productName}
                </span>
              </div>
            ))}
            {remainingItemsCount > 0 && (
              <span className="text-muted-foreground text-xs block pt-0.5">
                +{remainingItemsCount} menu lainnya
              </span>
            )}
          </div>
        </div>
      )}

      {/* 4. Action Button */}
      <div className="pt-1">
        <Button
          variant={action.variant}
          size="lg"
          onClick={() => onAction(table)}
          className="w-full"
        >
          {action.label}
        </Button>
      </div>
    </Card>
  );
}
