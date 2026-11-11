"use client";

import { CreditCard, Printer } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { calculateOrderMetrics, formatMinutesToHuman } from "@/lib/order-analytics";
import { getOrderTaxBreakdown } from "@/lib/tax-breakdown";
import { formatCurrencyIDR } from "@/lib/utils";
import type { OrderRecord } from "@/types/order";

import { orderStatusLabel, orderStatusTone, paymentMethodLabel, paymentStatusLabel, paymentStatusTone } from "./orders-domain";

interface OrderDetailSheetProps {
  order: OrderRecord | null;
  onClose: () => void;
  canViewNominals: boolean;
  canProcessPayment: boolean;
  promos?: Array<{ id: string; name?: string }>;
  onOpenPayment: (order: OrderRecord) => void;
  onPrintReceipt: (order: OrderRecord) => void;
  onPrintKitchenTicket: (order: OrderRecord, purpose: "REPRINT" | "CANCELLATION") => void;
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "discount" | "total" }) {
  return (
    <div className={tone === "total" ? "flex justify-between border-t pt-2 font-medium text-foreground" : "flex justify-between"}>
      <dt className={tone === "discount" ? "text-success" : undefined}>{label}</dt>
      <dd className={tone === "discount" ? "font-mono text-success tabular-nums" : "font-mono tabular-nums"}>{value}</dd>
    </div>
  );
}

/** Order detail in a side panel so the list stays visible behind it. */
export function OrderDetailSheet({
  order,
  onClose,
  canViewNominals,
  canProcessPayment,
  promos = [],
  onOpenPayment,
  onPrintReceipt,
  onPrintKitchenTicket,
}: OrderDetailSheetProps) {
  return (
    <Sheet open={order !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        {order ? (
          <OrderDetailBody
            selectedOrder={order}
            canViewNominals={canViewNominals}
            canProcessPayment={canProcessPayment}
            promos={promos}
            onOpenPayment={onOpenPayment}
            onPrintReceipt={onPrintReceipt}
            onPrintKitchenTicket={onPrintKitchenTicket}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function OrderDetailBody({
  selectedOrder,
  canViewNominals,
  canProcessPayment,
  promos,
  onOpenPayment,
  onPrintReceipt,
  onPrintKitchenTicket,
}: Omit<OrderDetailSheetProps, "order" | "onClose" | "promos"> & { selectedOrder: OrderRecord; promos: Array<{ id: string; name?: string }> }) {
  const metrics = calculateOrderMetrics(selectedOrder);
  const isCancelled = selectedOrder.status === "CANCELLED";
  const isPaid = selectedOrder.paymentStatus === "PAID";
  const canPayThis = selectedOrder.status !== "COMPLETED" && !isCancelled && !isPaid && canProcessPayment;
  const timing = [
    { label: "Antre di dapur", minutes: metrics.kitchenQueueMinutes },
    { label: "Dimasak", minutes: metrics.cookingMinutes },
    { label: "Disajikan", minutes: metrics.servingMinutes },
  ];

  return (
    <>
      <SheetHeader className="gap-2 border-b">
        <div className="flex items-center gap-2 pr-8">
          <SheetTitle className="font-mono text-base tabular-nums">{selectedOrder.orderNumber}</SheetTitle>
          <StatusBadge status={orderStatusTone(selectedOrder.status)}>{orderStatusLabel(selectedOrder.status)}</StatusBadge>
        </div>
        <SheetDescription className="text-sm">
          Meja {selectedOrder.tableNumber} · {selectedOrder.customerName}
        </SheetDescription>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {canViewNominals ? formatCurrencyIDR(selectedOrder.total) : "—"}
          </span>
          <span className="flex items-center gap-1.5 text-sm">
            <StatusBadge status={paymentStatusTone(selectedOrder.paymentStatus)}>
              {paymentStatusLabel(selectedOrder.paymentStatus)}
            </StatusBadge>
            {isPaid ? <span className="text-muted-foreground">{paymentMethodLabel(selectedOrder.paymentMethod)}</span> : null}
          </span>
        </div>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6 text-sm">
        <dl className="grid grid-cols-3 gap-2">
          {timing.map((step) => (
            <div key={step.label} className="flex flex-col gap-0.5 rounded-md bg-muted/50 p-2">
              <dt className="text-xs text-muted-foreground">{step.label}</dt>
              <dd className="font-mono tabular-nums">{formatMinutesToHuman(step.minutes)}</dd>
            </div>
          ))}
        </dl>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs text-muted-foreground">Item ({selectedOrder.items.length})</h3>
          <ul className="flex flex-col divide-y">
            {selectedOrder.items.map((item, idx) => (
              <li key={item.id || idx} className="flex justify-between gap-3 py-1.5">
                <span className="flex gap-2">
                  <span className="w-6 shrink-0 font-mono tabular-nums">{item.quantity}×</span>
                  <span className="flex flex-col">
                    {item.productName}
                    {item.modifiers?.length ? <span className="text-xs text-muted-foreground">{item.modifiers.join(", ")}</span> : null}
                  </span>
                </span>
                <span className="font-mono tabular-nums">
                  {canViewNominals ? formatCurrencyIDR(item.unitPrice * item.quantity) : "—"}
                </span>
              </li>
            ))}
          </ul>

          {canViewNominals && (() => {
            const breakdown = getOrderTaxBreakdown(selectedOrder);
            const promoName = promos.find((p) => p.id === selectedOrder.promoId)?.name || selectedOrder.promoId;
            return (
              <dl className="flex flex-col gap-1 border-t pt-2 text-muted-foreground">
                <Row label="Subtotal" value={formatCurrencyIDR(selectedOrder.subtotal)} />
                {breakdown.discount > 0 ? (
                  <Row label={promoName ? `Diskon ${promoName}` : "Diskon"} value={`−${formatCurrencyIDR(breakdown.discount)}`} tone="discount" />
                ) : null}
                {breakdown.pb1 > 0 ? <Row label="PB1" value={formatCurrencyIDR(breakdown.pb1)} /> : null}
                {breakdown.serviceCharge > 0 ? <Row label="Service charge" value={formatCurrencyIDR(breakdown.serviceCharge)} /> : null}
                <Row label="Total" value={formatCurrencyIDR(selectedOrder.total)} tone="total" />
              </dl>
            );
          })()}
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <h3 className="text-xs text-muted-foreground">Riwayat status</h3>
          <ol className="flex flex-col gap-3 border-l pl-4">
            {selectedOrder.statusHistory.map((step, idx) => (
              <li key={idx} className="relative flex flex-col gap-0.5">
                <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-muted-foreground" aria-hidden />
                <span className="flex items-baseline gap-2">
                  <span className="font-medium">{orderStatusLabel(step.toStatus as OrderRecord["status"])}</span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {new Date(step.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
                {step.actorName ? <span className="text-xs text-muted-foreground">oleh {step.actorName}</span> : null}
                {step.note ? <span className="text-xs text-muted-foreground">{step.note}</span> : null}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <SheetFooter className="flex-row flex-wrap border-t">
        {canPayThis ? (
          <Button className="flex-1" onClick={() => onOpenPayment(selectedOrder)}>
            <CreditCard />
            Bayar
          </Button>
        ) : null}
        {isPaid ? (
          <Button variant="outline" onClick={() => onPrintReceipt(selectedOrder)}>
            <Printer />
            Struk
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={() => onPrintKitchenTicket(selectedOrder, isCancelled ? "CANCELLATION" : "REPRINT")}
        >
          <Printer />
          {isCancelled ? "Slip batal" : "Nota dapur"}
        </Button>
      </SheetFooter>
    </>
  );
}
