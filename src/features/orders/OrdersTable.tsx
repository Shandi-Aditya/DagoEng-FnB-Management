"use client";

import { ClipboardList, CreditCard, FileText } from "lucide-react";

import { DataPagination } from "@/components/app/data-pagination";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateOrderMetrics, formatMinutesToHuman } from "@/lib/order-analytics";
import { cn, formatCurrencyIDR } from "@/lib/utils";
import type { OrderRecord, SLAStatus } from "@/types/order";

import {
  orderStatusLabel,
  orderStatusTone,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
  slaStatusLabel,
} from "./orders-domain";

const SLA_DOT: Record<SLAStatus, string> = {
  ON_TIME: "bg-success",
  AT_RISK: "bg-warning",
  DELAYED: "bg-destructive",
};

interface OrdersTableProps {
  orders: OrderRecord[];
  totalOrders: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  canViewNominals: boolean;
  canProcessPayment: boolean;
  emptyMessage: { title: string; description: string };
  onViewInvoice?: (order: OrderRecord) => void;
  onOpenPayment: (order: OrderRecord) => void;
  onSelectOrder: (order: OrderRecord) => void;
}

/** Finished or cancelled orders no longer have a waiting time worth tracking. */
function isClosed(order: OrderRecord): boolean {
  return order.status === "COMPLETED" || order.status === "CANCELLED" || order.status === "SERVED";
}

function isPayable(order: OrderRecord, canProcessPayment: boolean): boolean {
  if (!canProcessPayment || order.paymentStatus === "PAID" || order.status === "CANCELLED") {
    return false;
  }
  const isCorporateInvoice =
    (order.paymentMethod === "INVOICE" || order.corporateInfo?.billingType === "INVOICE") &&
    order.paymentStatus !== "REFUNDED";
  return (order.status !== "COMPLETED" && order.paymentStatus !== "REFUNDED") || isCorporateInvoice;
}

export function OrdersTable({
  orders,
  totalOrders,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  canViewNominals,
  canProcessPayment,
  emptyMessage,
  onViewInvoice,
  onOpenPayment,
  onSelectOrder,
}: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <EmptyState
        className="border"
        icon={<ClipboardList />}
        title={emptyMessage.title}
        description={emptyMessage.description}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pesanan</TableHead>
              <TableHead className="hidden sm:table-cell">Meja</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Pembayaran</TableHead>
              <TableHead className="hidden md:table-cell">Waktu tunggu</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">Aksi</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => {
              const metrics = calculateOrderMetrics(o);
              return (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => onSelectOrder(o)}>
                  <TableCell>
                    <button
                      type="button"
                      className="flex flex-col text-left outline-none focus-visible:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectOrder(o);
                      }}
                    >
                      <span className="font-mono font-medium tabular-nums">{o.orderNumber}</span>
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {new Date(o.createdAt).toLocaleTimeString("id-ID", {
                          timeZone: "Asia/Makassar",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        <span className="sm:hidden"> · {o.tableNumber}</span>
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex flex-col">
                      <span>{o.tableNumber}</span>
                      <span className="text-xs text-muted-foreground">{o.customerName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</StatusBadge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-col items-start gap-0.5">
                      <StatusBadge status={paymentStatusTone(o.paymentStatus)}>{paymentStatusLabel(o.paymentStatus)}</StatusBadge>
                      {o.paymentStatus === "PAID" ? (
                        <span className="text-xs text-muted-foreground">{paymentMethodLabel(o.paymentMethod)}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {isClosed(o) ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="flex items-center gap-1.5" title={slaStatusLabel(metrics.slaStatus)}>
                        <span className={cn("size-1.5 rounded-full", SLA_DOT[metrics.slaStatus])} aria-hidden />
                        <span className="font-mono tabular-nums">{formatMinutesToHuman(metrics.totalCustomerWaitingMinutes)}</span>
                        <span className="sr-only">{slaStatusLabel(metrics.slaStatus)}</span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {canViewNominals ? formatCurrencyIDR(o.total) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {isPayable(o, canProcessPayment) ? (
                        <Button
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenPayment(o);
                          }}
                        >
                          <CreditCard />
                          Bayar
                        </Button>
                      ) : null}
                      {Boolean(o.corporateInfo) && onViewInvoice ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onViewInvoice(o);
                          }}
                        >
                          <FileText />
                          Lihat invoice
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <DataPagination
        currentPage={currentPage}
        totalItems={totalOrders}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        itemLabel="pesanan"
      />
    </div>
  );
}
