"use client";

import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock, UtensilsCrossed } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OrderRecord } from "@/types/order";

interface WaiterOrderReadyModalProps {
  open: boolean;
  orders: OrderRecord[];
  onServe: (orderId: string) => void;
  onDismiss: (orderId: string) => void;
  onClose: () => void;
}

export function WaiterOrderReadyModal({
  open,
  orders,
  onServe,
  onDismiss,
  onClose,
}: WaiterOrderReadyModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex >= orders.length && orders.length > 0) {
      setCurrentIndex(orders.length - 1);
    }
  }, [orders.length, currentIndex]);

  if (orders.length === 0) return null;

  const currentOrder = orders[currentIndex] ?? orders[0];
  const items = currentOrder.items;
  const totalItemsCount = items.reduce((sum, it) => sum + it.quantity, 0);

  const handlePrev = () => {
    setCurrentIndex((idx) => (idx > 0 ? idx - 1 : orders.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((idx) => (idx < orders.length - 1 ? idx + 1 : 0));
  };

  const handleServeCurrent = () => {
    onServe(currentOrder.id);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? onClose() : undefined)}>
      <DialogContent className="w-full sm:max-w-lg">
        <DialogHeader className="gap-1.5 border-b pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UtensilsCrossed className="size-4 animate-bounce" />
              </span>
              <DialogTitle className="text-base font-semibold">Pesanan siap disajikan</DialogTitle>
            </div>
            {orders.length > 1 ? (
              <Badge variant="secondary" className="font-mono text-xs tabular-nums">
                {currentIndex + 1} dari {orders.length} pesanan siap
              </Badge>
            ) : null}
          </div>
          <DialogDescription className="text-xs">
            Dapur telah menyelesaikan pesanan ini. Segera antarkan ke meja tamu.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-xs">
          {/* Header Ringkasan Meja */}
          <div className="flex items-start justify-between rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="font-mono text-xs">
                  Meja {currentOrder.tableNumber}
                </Badge>
                <span className="font-mono font-medium text-foreground tabular-nums">
                  {currentOrder.orderNumber}
                </span>
              </div>
              <span className="text-muted-foreground">
                {currentOrder.customerName || "Tamu"} · {currentOrder.orderType === "DINE_IN" ? "Dine in" : "Takeaway"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3.5" />
              <span className="font-mono tabular-nums">
                {new Date(currentOrder.createdAt).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          {/* Daftar Item Siap Saji */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Item yang siap diantar</span>
              <span className="font-mono tabular-nums">{totalItemsCount} item</span>
            </div>
            <ul className="flex max-h-56 flex-col divide-y rounded-lg border bg-card overflow-y-auto">
              {items.map((item, idx) => (
                <li key={item.id || idx} className="flex items-start justify-between gap-3 p-2.5">
                  <div className="flex items-start gap-2">
                    <span className="w-6 shrink-0 font-mono text-sm font-semibold text-primary tabular-nums">
                      {item.quantity}×
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-foreground">{item.productName}</span>
                      {item.modifiers?.length ? (
                        <span className="text-muted-foreground">{item.modifiers.join(", ")}</span>
                      ) : null}
                      {item.notes?.trim() ? (
                        <span className="text-warning">Catatan: {item.notes.trim()}</span>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Navigasi multi pesanan */}
          {orders.length > 1 ? (
            <div className="flex items-center justify-between border-t pt-2">
              <Button variant="ghost" size="sm" onClick={handlePrev}>
                <ChevronLeft className="size-4" />
                Sebelumnya
              </Button>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {currentIndex + 1} / {orders.length}
              </span>
              <Button variant="ghost" size="sm" onClick={handleNext}>
                Berikutnya
                <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-row flex-wrap gap-2 border-t pt-3 sm:justify-between">
          <Button variant="outline" size="lg" onClick={() => onDismiss(currentOrder.id)}>
            Lihat meja
          </Button>
          <Button size="lg" onClick={handleServeCurrent}>
            <Check className="size-4" />
            Tandai disajikan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
