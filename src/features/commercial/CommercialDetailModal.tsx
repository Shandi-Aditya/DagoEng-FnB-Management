import { Building2, CreditCard, Plus } from "lucide-react";
import type { CommercialLease } from "@/types/commercial";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLeaseStatusTone, getLeaseStatusLabel } from "./commercial-domain";

export interface CommercialDetailModalProps {
  lease: CommercialLease | null;
  onClose: () => void;
  onOpenPaymentModal: (lease: CommercialLease) => void;
  onOpenChangeStatusModal: (lease: CommercialLease) => void;
}

export function CommercialDetailModal({
  lease,
  onClose,
  onOpenPaymentModal,
  onOpenChangeStatusModal,
}: CommercialDetailModalProps) {
  if (!lease) return null;

  const tone = getLeaseStatusTone(lease.status);
  const label = getLeaseStatusLabel(lease.status);

  return (
    <Dialog open={Boolean(lease)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <div className="space-y-0.5">
              <span className="font-mono text-xs text-primary font-medium">
                {lease.leaseNumber}
              </span>
              <DialogTitle className="text-base">{lease.tenantName}</DialogTitle>
            </div>
          </div>
          <DialogDescription>
            Detail kontrak unit retail dan riwayat pembayaran sewa tenant.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-1">
          {/* Overview Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-lg border bg-muted/30 text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px]">Unit</span>
              <span className="font-medium text-foreground">{lease.unitCode}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Luas</span>
              <span className="font-medium text-foreground">{lease.areaSquareMeters} m²</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Sewa per bulan</span>
              <span className="font-mono font-medium text-foreground">
                {formatCurrencyIDR(lease.monthlyRent)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Deposit</span>
              <span className="font-mono font-medium text-foreground">
                {formatCurrencyIDR(lease.depositAmount)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Masa sewa</span>
              <span className="font-medium text-foreground">
                {lease.startDate} — {lease.endDate}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Status</span>
              <StatusBadge status={tone} className="text-[11px] mt-0.5">
                {label}
              </StatusBadge>
            </div>
          </div>

          {/* Payment History */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-primary" />
                <span>Riwayat pembayaran</span>
              </h4>
              <Button
                size="sm"
                onClick={() => onOpenPaymentModal(lease)}
                className="text-xs h-7 gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Catat pembayaran</span>
              </Button>
            </div>

            <div className="rounded-lg border overflow-hidden">
              {lease.paymentHistory.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  Belum ada riwayat pembayaran tercatat.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Periode</TableHead>
                      <TableHead className="text-xs">Nominal</TableHead>
                      <TableHead className="text-xs">Dibayar</TableHead>
                      <TableHead className="text-xs">Metode</TableHead>
                      <TableHead className="text-xs text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lease.paymentHistory.map((pm) => (
                      <TableRow key={pm.id}>
                        <TableCell className="text-xs font-medium text-foreground">
                          {pm.periodLabel}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-medium tabular-nums text-foreground">
                          {formatCurrencyIDR(pm.amount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {pm.paidDate}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {pm.paymentMethod} {pm.referenceNo ? `(${pm.referenceNo})` : ""}
                        </TableCell>
                        <TableCell className="text-right">
                          <StatusBadge status="success" className="text-[10px]">
                            {pm.status}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between pt-3 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChangeStatusModal(lease)}
            className="text-xs text-amber-700 dark:text-amber-400"
          >
            Ubah Status
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            className="text-xs"
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
