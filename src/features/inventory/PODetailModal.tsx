import { CheckCircle2, Truck } from "lucide-react";

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
import { formatCurrencyIDR } from "@/lib/utils";
import type { PurchaseOrder } from "@/types/inventory";

import { poStatusLabel, poStatusTone } from "./inventory-domain";

interface PODetailModalProps {
  po: PurchaseOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onReceivePO: (poId: string) => void;
}

export function PODetailModal({ po, isOpen, onClose, onReceivePO }: PODetailModalProps) {
  if (!po) return null;

  const isSent = po.status === "SENT";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2">
              <Truck className="size-4 text-primary" />
              <DialogTitle className="text-base font-medium">Detail {po.poNumber}</DialogTitle>
            </div>
            <StatusBadge status={poStatusTone(po.status)}>{poStatusLabel(po.status)}</StatusBadge>
          </div>
          <DialogDescription className="text-xs">
            Supplier: <strong className="text-foreground">{po.supplier}</strong> • Tanggal:{" "}
            {po.orderDate}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-2.5">
            <div>
              <span className="text-xs text-muted-foreground">Perkiraan tiba</span>
              <p className="font-medium text-foreground">{po.expectedDelivery || "-"}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Catatan</span>
              <p className="text-muted-foreground">{po.notes || "-"}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-left">
              <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2">Bahan</th>
                  <th className="p-2 text-right">Jumlah</th>
                  <th className="p-2 text-right">Harga satuan</th>
                  <th className="p-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y text-foreground">
                {po.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="p-2 font-medium">{it.name}</td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {it.quantity} {it.unit}
                    </td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {formatCurrencyIDR(it.unitPrice)}
                    </td>
                    <td className="p-2 text-right font-mono font-medium tabular-nums">
                      {formatCurrencyIDR(it.totalPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="space-y-1 rounded-lg border bg-muted/20 p-2.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums text-foreground">
                {formatCurrencyIDR(po.subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>PPN (11%)</span>
              <span className="font-mono tabular-nums text-foreground">
                +{formatCurrencyIDR(po.tax)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-1 font-medium text-foreground">
              <span>Total</span>
              <span className="font-mono text-primary tabular-nums">
                {formatCurrencyIDR(po.total)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 sm:justify-between">
          <Button variant="outline" size="lg" onClick={onClose}>
            Tutup
          </Button>

          {isSent ? (
            <Button
              size="lg"
              onClick={() => {
                onReceivePO(po.id);
                onClose();
              }}
            >
              <CheckCircle2 />
              Tandai diterima
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
