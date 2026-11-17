"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Banknote, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrencyIDR } from "@/lib/utils";
import type { OrderRecord } from "@/types/order";

import { paymentMethodLabel } from "./orders-domain";

interface RefundOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderRecord | null;
  currentUserName?: string;
  currentUserRole?: string;
  isSupervisor?: boolean;
  onConfirmRefund: (params: {
    reason: string;
    supervisorName: string;
    supervisorRole?: string;
  }) => void;
}

export function RefundOrderModal({
  isOpen,
  onClose,
  order,
  currentUserName,
  currentUserRole,
  isSupervisor = false,
  onConfirmRefund,
}: RefundOrderModalProps) {
  const [reason, setReason] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setSupervisorName(isSupervisor && currentUserName ? currentUserName : "");
      setValidationError(null);
    }
  }, [isOpen, isSupervisor, currentUserName]);

  if (!order) return null;

  const isQris = order.paymentMethod === "QRIS";

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanReason = reason.trim();
    const cleanSupervisor = supervisorName.trim();

    if (!cleanReason) {
      setValidationError("Alasan refund wajib diisi.");
      return;
    }
    if (!cleanSupervisor) {
      setValidationError("Nama supervisor yang menyetujui wajib diisi.");
      return;
    }

    setValidationError(null);
    onConfirmRefund({
      reason: cleanReason,
      supervisorName: cleanSupervisor,
      supervisorRole: isSupervisor ? currentUserRole : "SUPERVISOR",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader className="gap-1.5">
          <DialogTitle className="flex items-center gap-2 text-base text-destructive">
            <ShieldAlert className="size-4" />
            Refund pesanan
          </DialogTitle>
          <DialogDescription>
            Pengembalian dana tunai dari laci kasir dan pembatalan transaksi pesanan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {/* Detail Ringkasan Pesanan */}
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono font-medium text-foreground tabular-nums">{order.orderNumber}</span>
              <span className="text-muted-foreground">Meja {order.tableNumber} · {order.customerName}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-muted-foreground">Metode bayar asal</span>
              <span className="font-medium text-foreground">{paymentMethodLabel(order.paymentMethod)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total pengembalian dana</span>
              <span className="font-mono text-sm font-semibold text-destructive tabular-nums">
                {formatCurrencyIDR(order.total)}
              </span>
            </div>
          </div>

          {/* Banner Info Pengembalian Tunai */}
          <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-foreground">
            <Banknote className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="flex flex-col gap-1">
              <span className="font-medium">
                {isQris ? "QRIS dikembalikan tunai" : "Pengembalian tunai dari laci"}
              </span>
              <p className="text-muted-foreground">
                {isQris
                  ? "Transaksi awal dibayar QRIS. Sesuai kebijakan POS, kas fisik sebesar total pesanan harus dikeluarkan secara tunai dari laci kasir kepada pelanggan."
                  : "Uang kas fisik sebesar total pesanan dikeluarkan dari laci kasir. Saldo kas shift akan berkurang otomatis."}
              </p>
            </div>
          </div>

          {/* Form Input Alasan */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="refund-reason" className="text-xs">
              Alasan refund <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="refund-reason"
              placeholder="Contoh: Kesalahan input menu / Komplain tamu / Menu habis..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (validationError) setValidationError(null);
              }}
              rows={2}
              required
            />
          </div>

          {/* Form Input Supervisor */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="refund-supervisor" className="text-xs">
              Persetujuan supervisor <span className="text-destructive">*</span>
            </Label>
            {isSupervisor && currentUserName ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                <span className="text-muted-foreground">Otorisasi saat ini</span>
                <span className="font-medium text-foreground">
                  {currentUserName} {currentUserRole ? `(${currentUserRole})` : ""}
                </span>
              </div>
            ) : (
              <Input
                id="refund-supervisor"
                placeholder="Nama supervisor yang menyetujui..."
                value={supervisorName}
                onChange={(e) => {
                  setSupervisorName(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                required
              />
            )}
            <span className="text-xs text-muted-foreground">
              Aksi refund wajib mendapat persetujuan dan akan tercatat permanen di audit log.
            </span>
          </div>

          {validationError && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="size-3.5" />
              <span>{validationError}</span>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!reason.trim() || !supervisorName.trim()}
            >
              Konfirmasi refund ({formatCurrencyIDR(order.total)})
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
