import { CheckCircle2, Eye, Truck } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyIDR } from "@/lib/utils";
import type { PurchaseOrder } from "@/types/inventory";

import { poStatusLabel, poStatusTone } from "./inventory-domain";

interface InventoryPurchaseOrdersTabProps {
  purchaseOrders: PurchaseOrder[];
  onReceivePO: (poId: string) => void;
  onPreviewPO: (po: PurchaseOrder) => void;
}

export function InventoryPurchaseOrdersTab({
  purchaseOrders,
  onReceivePO,
  onPreviewPO,
}: InventoryPurchaseOrdersTabProps) {
  const hasOrders = purchaseOrders.length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">No. PO</TableHead>
              <TableHead>Supplier Utama</TableHead>
              <TableHead>Tanggal Pesan</TableHead>
              <TableHead>Estimasi Tiba</TableHead>
              <TableHead>Rincian Item</TableHead>
              <TableHead>Total Tagihan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!hasOrders ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12">
                  <EmptyState
                    icon={<Truck className="size-6 text-muted-foreground" />}
                    title="Belum ada riwayat Purchase Order"
                    description="Buat PO baru untuk mencatat pengadaan bahan baku ke supplier resmi."
                  />
                </TableCell>
              </TableRow>
            ) : (
              purchaseOrders.map((po) => {
                const isSent = po.status === "SENT";

                return (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-xs font-medium tabular-nums text-foreground">
                      {po.poNumber}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{po.supplier}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{po.orderDate}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {po.expectedDelivery || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {po.items.length} Macam Bahan
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium tabular-nums text-foreground">
                      {formatCurrencyIDR(po.total)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={poStatusTone(po.status)}>
                        {poStatusLabel(po.status)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isSent ? (
                          <Button
                            size="sm"
                            onClick={() => onReceivePO(po.id)}
                            className="h-8 gap-1 text-xs"
                          >
                            <CheckCircle2 className="size-3.5" />
                            <span>Terima</span>
                          </Button>
                        ) : null}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onPreviewPO(po)}
                          className="h-8 gap-1 text-xs"
                        >
                          <Eye className="size-3.5 text-muted-foreground" />
                          <span>Detail</span>
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
    </div>
  );
}
