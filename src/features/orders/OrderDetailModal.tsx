import { CreditCard, Printer } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { calculateOrderMetrics, formatMinutesToHuman } from "@/lib/order-analytics";
import { getOrderTaxBreakdown } from "@/lib/tax-breakdown";
import { formatCurrencyIDR } from "@/lib/utils";
import type { OrderRecord } from "@/types/order";

import { orderStatusLabel, orderStatusTone } from "./orders-domain";

interface OrderDetailModalProps {
  order: OrderRecord | null;
  isOpen: boolean;
  onClose: () => void;
  canViewNominals: boolean;
  canProcessPayment: boolean;
  promos?: Array<{ id: string; name?: string }>;
  onOpenPayment: (order: OrderRecord) => void;
  onPrintReceipt: (order: OrderRecord) => void;
  onPrintKitchenTicket: (order: OrderRecord, purpose: "REPRINT" | "CANCELLATION") => void;
}

export function OrderDetailModal({
  order,
  isOpen,
  onClose,
  canViewNominals,
  canProcessPayment,
  promos = [],
  onOpenPayment,
  onPrintReceipt,
  onPrintKitchenTicket,
}: OrderDetailModalProps) {
  if (!order) return null;

  const selectedOrder = order;
  const metrics = calculateOrderMetrics(selectedOrder);
  const isCompleted = selectedOrder.status === "COMPLETED";
  const isCancelled = selectedOrder.status === "CANCELLED";
  const isPaid = selectedOrder.paymentStatus === "PAID";
  const canPayThis = !isCompleted && !isCancelled && !isPaid && canProcessPayment;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-base font-medium">
              Pesanan {selectedOrder.orderNumber}
            </DialogTitle>
            <StatusBadge status={orderStatusTone(selectedOrder.status)}>
              {orderStatusLabel(selectedOrder.status)}
            </StatusBadge>
          </div>
          <DialogDescription className="text-xs">
            Meja {selectedOrder.tableNumber} • {selectedOrder.customerName} • Total:{" "}
            <strong className="text-foreground">
              {canViewNominals ? formatCurrencyIDR(selectedOrder.total) : "—"}
            </strong>
          </DialogDescription>
        </DialogHeader>

        {/* Time breakdown cards */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border bg-muted/40 p-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">Antrean Dapur</p>
            <p className="mt-0.5 font-mono text-sm font-medium tabular-nums text-foreground">
              {formatMinutesToHuman(metrics.kitchenQueueMinutes)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">Waktu Masak</p>
            <p className="mt-0.5 font-mono text-sm font-medium tabular-nums text-foreground">
              {formatMinutesToHuman(metrics.cookingMinutes)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">Waktu Saji</p>
            <p className="mt-0.5 font-mono text-sm font-medium tabular-nums text-foreground">
              {formatMinutesToHuman(metrics.servingMinutes)}
            </p>
          </div>
        </div>

        {/* Ordered Items Summary & Financial Breakdown */}
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <div>
            <h4 className="mb-2 text-xs font-medium text-foreground">
              Item Pesanan ({selectedOrder.items.length})
            </h4>
            <div className="space-y-1.5">
              {selectedOrder.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-medium text-foreground">
                      {item.quantity}x
                    </span>{" "}
                    <span>{item.productName}</span>
                    {item.modifiers && item.modifiers.length > 0 ? (
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        ({item.modifiers.join(", ")})
                      </span>
                    ) : null}
                  </div>
                  <span className="font-mono tabular-nums text-foreground">
                    {canViewNominals ? formatCurrencyIDR(item.unitPrice * item.quantity) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Calculation (Subtotal, Promo, Discount, PB1, Service Charge, Total) */}
          {canViewNominals && (() => {
            const promoName =
              promos.find((p) => p.id === selectedOrder.promoId)?.name || selectedOrder.promoId;
            const breakdown = getOrderTaxBreakdown(selectedOrder);
            const discountAmount = breakdown.discount;

            return (
              <div className="space-y-1 border-t pt-2.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCurrencyIDR(selectedOrder.subtotal)}
                  </span>
                </div>
                {promoName ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Promo</span>
                    <span className="font-medium text-foreground">{promoName}</span>
                  </div>
                ) : null}
                {discountAmount > 0 ? (
                  <div className="flex justify-between text-success">
                    <span>Diskon</span>
                    <span className="font-mono tabular-nums">
                      -{formatCurrencyIDR(discountAmount)}
                    </span>
                  </div>
                ) : null}
                {breakdown.pb1 > 0 ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Pajak PB1</span>
                    <span className="font-mono tabular-nums">
                      +{formatCurrencyIDR(breakdown.pb1)}
                    </span>
                  </div>
                ) : null}
                {breakdown.serviceCharge > 0 ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Service Charge</span>
                    <span className="font-mono tabular-nums">
                      +{formatCurrencyIDR(breakdown.serviceCharge)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t pt-1 font-medium text-foreground">
                  <span>Total</span>
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCurrencyIDR(selectedOrder.total)}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Step Timeline */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-foreground">Riwayat Perubahan Status</h4>
          <div className="relative space-y-3 pl-4 before:absolute before:bottom-1 before:left-1.5 before:top-1 before:w-px before:bg-border">
            {selectedOrder.statusHistory.map((item, idx) => (
              <div key={idx} className="relative pl-3 text-xs">
                <span className="absolute -left-[5px] top-1 size-2 rounded-full bg-primary" />
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {orderStatusLabel(item.toStatus as any)}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {new Date(item.timestamp).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
                {item.actorName ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Oleh <span className="text-foreground">{item.actorName}</span>
                  </p>
                ) : null}
                {item.note ? (
                  <p className="mt-1 rounded bg-muted/40 p-1.5 text-[11px] text-muted-foreground">
                    Catatan: {item.note}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {canPayThis ? (
              <Button
                size="sm"
                onClick={() => onOpenPayment(selectedOrder)}
                className="gap-1.5 text-xs"
              >
                <CreditCard className="size-3.5" />
                <span>Bayar</span>
              </Button>
            ) : null}

            {isPaid ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPrintReceipt(selectedOrder)}
                className="gap-1.5 text-xs"
              >
                <Printer className="size-3.5 text-muted-foreground" />
                <span>Struk Kasir</span>
              </Button>
            ) : null}

            {!isCancelled ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPrintKitchenTicket(selectedOrder, "REPRINT")}
                className="gap-1.5 text-xs"
              >
                <Printer className="size-3.5 text-muted-foreground" />
                <span>Nota Dapur</span>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPrintKitchenTicket(selectedOrder, "CANCELLATION")}
                className="gap-1.5 text-xs text-destructive hover:text-destructive"
              >
                <Printer className="size-3.5" />
                <span>Slip Pembatalan</span>
              </Button>
            )}
          </div>

          <Button size="sm" variant="outline" onClick={onClose} className="text-xs">
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
