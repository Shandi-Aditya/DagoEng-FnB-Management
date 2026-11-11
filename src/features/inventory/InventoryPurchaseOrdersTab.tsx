import { Truck } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrencyIDR } from "@/lib/utils";
import type { PurchaseOrder } from "@/types/inventory";

import { poStatusLabel, poStatusTone } from "./inventory-domain";

interface InventoryPurchaseOrdersTabProps {
  purchaseOrders: PurchaseOrder[];
  onReceivePO: (poId: string) => void;
  onPreviewPO: (po: PurchaseOrder) => void;
}

export function InventoryPurchaseOrdersTab({ purchaseOrders, onReceivePO, onPreviewPO }: InventoryPurchaseOrdersTabProps) {
  if (purchaseOrders.length === 0) {
    return (
      <EmptyState
        className="border"
        icon={<Truck />}
        title="Belum ada pesanan pembelian"
        description="Buat PO untuk mencatat pembelian bahan dari pemasok."
      />
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PO</TableHead>
            <TableHead className="hidden md:table-cell">Dipesan</TableHead>
            <TableHead className="hidden md:table-cell">Perkiraan tiba</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-0">
              <span className="sr-only">Aksi</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchaseOrders.map((po) => (
            <TableRow key={po.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{po.supplier}</span>
                  <span className="text-xs text-muted-foreground">
                    <span className="font-mono tabular-nums">{po.poNumber}</span> · {po.items.length} bahan
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">{po.orderDate}</TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">{po.expectedDelivery || "—"}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{formatCurrencyIDR(po.total)}</TableCell>
              <TableCell>
                <StatusBadge status={poStatusTone(po.status)}>{poStatusLabel(po.status)}</StatusBadge>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1.5">
                  {po.status === "SENT" ? (
                    <Button size="sm" onClick={() => onReceivePO(po.id)}>
                      Terima
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => onPreviewPO(po)}>
                    Detail
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
