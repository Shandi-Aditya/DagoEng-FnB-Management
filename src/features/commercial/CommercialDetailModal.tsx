"use client";

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
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            <div className="space-y-0.5">
              <span className="font-mono text-xs font-medium text-primary">
                {lease.leaseNumber}
              </span>
              <DialogTitle className="text-base font-medium">{lease.tenantName}</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs">
            Detail kontrak unit retail dan riwayat pembayaran sewa tenant.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-1 pr-1 text-xs">
          {/* Overview Grid */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3.5 text-xs sm:grid-cols-3">
            <div>
              <span className="block text-xs text-muted-foreground">Unit</span>
              <span className="font-medium text-foreground">{lease.unitCode}</span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Luas</span>
              <span className="font-medium text-foreground">{lease.areaSquareMeters} m²</span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Sewa per bulan</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatCurrencyIDR(lease.monthlyRent)}
              </span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Deposit</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatCurrencyIDR(lease.depositAmount)}
              </span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Masa sewa</span>
              <span className="font-medium text-foreground">
                {lease.startDate} — {lease.endDate}
              </span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Status</span>
              <StatusBadge status={tone} className="mt-0.5">
                {label}
              </StatusBadge>
            </div>
          </div>

          {/* Payment History */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <CreditCard className="size-4 text-primary" />
                <span>Riwayat pembayaran</span>
              </h4>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenPaymentModal(lease)}
              >
                <Plus />
                <span>Catat pembayaran</span>
              </Button>
            </div>

            <div className="overflow-hidden rounded-lg border">
              {lease.paymentHistory.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  Belum ada riwayat pembayaran tercatat.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Periode</TableHead>
                      <TableHead>Nominal</TableHead>
                      <TableHead>Dibayar</TableHead>
                      <TableHead>Metode</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lease.paymentHistory.map((pm) => (
                      <TableRow key={pm.id}>
                        <TableCell className="font-medium text-foreground">
                          {pm.periodLabel}
                        </TableCell>
                        <TableCell className="font-mono font-medium tabular-nums text-foreground">
                          {formatCurrencyIDR(pm.amount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {pm.paidDate}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {pm.paymentMethod} {pm.referenceNo ? `(${pm.referenceNo})` : ""}
                        </TableCell>
                        <TableCell className="text-right">
                          <StatusBadge status="success">
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

        <DialogFooter className="flex-row items-center justify-between border-t pt-3 sm:justify-between">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChangeStatusModal(lease)}
          >
            Ubah status
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
