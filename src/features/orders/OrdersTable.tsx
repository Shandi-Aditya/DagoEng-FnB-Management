import { ChevronLeft, ChevronRight, ClipboardList, CreditCard, History } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { calculateOrderMetrics, formatMinutesToHuman } from "@/lib/order-analytics";
import { formatCurrencyIDR } from "@/lib/utils";
import type { OrderRecord } from "@/types/order";

import {
  orderStatusLabel,
  orderStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
  slaStatusTone,
} from "./orders-domain";

interface OrdersTableProps {
  orders: OrderRecord[];
  totalOrders: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  canViewNominals: boolean;
  canProcessPayment: boolean;
  onOpenPayment: (order: OrderRecord) => void;
  onSelectOrder: (order: OrderRecord) => void;
}

export function OrdersTable({
  orders,
  totalOrders,
  currentPage,
  pageSize,
  onPageChange,
  canViewNominals,
  canProcessPayment,
  onOpenPayment,
  onSelectOrder,
}: OrdersTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));
  const hasOrders = orders.length > 0;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">No. Pesanan</TableHead>
              <TableHead>Meja / Pelanggan</TableHead>
              <TableHead>Status Operasional</TableHead>
              <TableHead>Status Pembayaran</TableHead>
              <TableHead>Waktu Tunggu</TableHead>
              <TableHead>SLA Status</TableHead>
              <TableHead>Total Tagihan</TableHead>
              <TableHead>Metode Bayar</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!hasOrders ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12">
                  <EmptyState
                    icon={<ClipboardList className="size-6 text-muted-foreground" />}
                    title="Belum ada riwayat pesanan"
                    description="Pesanan baru dari POS atau portal pelanggan akan muncul di sini."
                  />
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => {
                const metrics = calculateOrderMetrics(o);
                const isCompleted = o.status === "COMPLETED";
                const isCancelled = o.status === "CANCELLED";
                const isPaid = o.paymentStatus === "PAID";
                const canPayThis = !isCompleted && !isCancelled && !isPaid && canProcessPayment;

                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs font-medium tabular-nums">
                      {o.orderNumber}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{o.tableNumber}</div>
                      <div className="text-xs text-muted-foreground">{o.customerName}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={orderStatusTone(o.status)}>
                        {orderStatusLabel(o.status)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={paymentStatusTone(o.paymentStatus)}>
                        {paymentStatusLabel(o.paymentStatus)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {formatMinutesToHuman(metrics.totalCustomerWaitingMinutes)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={slaStatusTone(metrics.slaStatus)}>
                        {metrics.slaStatus.replace("_", " ")}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums font-medium">
                      {canViewNominals ? formatCurrencyIDR(o.total) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[11px]">
                        {o.paymentMethod || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canPayThis ? (
                          <Button
                            size="sm"
                            onClick={() => onOpenPayment(o)}
                            className="h-8 gap-1 text-xs"
                          >
                            <CreditCard className="size-3.5" />
                            <span>Bayar</span>
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSelectOrder(o)}
                          className="h-8 gap-1 text-xs"
                        >
                          <History className="size-3.5 text-muted-foreground" />
                          <span>Timeline</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {hasOrders ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
          <div>
            Menampilkan{" "}
            <span className="font-mono font-medium text-foreground">
              {(currentPage - 1) * pageSize + 1}
            </span>
            –
            <span className="font-mono font-medium text-foreground">
              {Math.min(currentPage * pageSize, totalOrders)}
            </span>{" "}
            dari <span className="font-mono font-medium text-foreground">{totalOrders}</span> pesanan
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="h-8 gap-1 px-2 text-xs"
            >
              <ChevronLeft className="size-3.5" />
              <span>Sebelumnya</span>
            </Button>
            <span className="px-2 font-mono tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="h-8 gap-1 px-2 text-xs"
            >
              <span>Berikutnya</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
