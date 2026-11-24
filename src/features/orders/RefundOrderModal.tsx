"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Banknote, KeyRound, ShieldAlert } from "lucide-react";

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
  mode?: "REFUND" | "VOID";
  currentUserName?: string;
  currentUserRole?: string;
  isSupervisor?: boolean;
  requiresPin?: boolean;
  onConfirmRefund: (params: {
    reason: string;
    supervisorName: string;
    supervisorRole?: string;
    supervisorPin?: string;
  }) => Promise<{ ok: boolean; error?: string } | void> | { ok: boolean; error?: string } | void;
}

export function RefundOrderModal({
  isOpen,
  onClose,
  order,
  mode = "REFUND",
  currentUserName,
  currentUserRole,
  isSupervisor = false,
  requiresPin = false,
  onConfirmRefund,
}: RefundOrderModalProps) {
  const [reason, setReason] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [supervisorPin, setSupervisorPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const canDirectAuthorize = isSupervisor && !requiresPin && Boolean(currentUserName);

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setSupervisorName(isSupervisor && currentUserName ? currentUserName : "");
      setSupervisorPin("");
      setIsSubmitting(false);
      setValidationError(null);
    }
  }, [isOpen, mode, isSupervisor, currentUserName]);

  if (!order) return null;

  const isVoid = mode === "VOID";
  const isQris = order.paymentMethod === "QRIS";
  const alreadyCooking =
    Boolean(order.cookingStartedAt) ||
    ["COOKING", "READY", "SERVED", "COMPLETED"].includes(order.status);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    const cleanReason = reason.trim();
    const cleanSupervisor = supervisorName.trim();
    const cleanPin = supervisorPin.trim();

    if (!cleanReason) {
      setValidationError(isVoid ? "Alasan pembatalan wajib diisi." : "Alasan refund wajib diisi.");
      return;
    }
    if (!cleanSupervisor) {
      setValidationError("Nama supervisor yang menyetujui wajib diisi.");
      return;
    }
    if (requiresPin && !cleanPin) {
      setValidationError("PIN supervisor wajib diisi untuk otorisasi.");
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);
    try {
      const result = await onConfirmRefund({
        reason: cleanReason,
        supervisorName: cleanSupervisor,
        supervisorRole: canDirectAuthorize ? currentUserRole : "SUPERVISOR",
        supervisorPin: requiresPin ? cleanPin : undefined,
      });
      if (result && result.ok === false) {
        setValidationError(result.error || "Otorisasi ditolak oleh server.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open && !isSubmitting ? onClose() : undefined)}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader className="gap-1.5">
          <DialogTitle className="flex items-center gap-2 text-base text-destructive">
            <ShieldAlert className="size-4" />
            {isVoid ? "Batalkan pesanan" : "Refund pesanan"}
          </DialogTitle>
          <DialogDescription>
            {isVoid
              ? "Pembatalan pesanan aktif dengan otorisasi supervisor dan pencatatan audit."
              : "Pengembalian dana tunai dari laci kasir dan pembatalan transaksi pesanan."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono font-medium text-foreground tabular-nums">{order.orderNumber}</span>
              <span className="text-muted-foreground">Meja {order.tableNumber} · {order.customerName}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-muted-foreground">
                {isVoid ? "Status bayar" : "Metode bayar asal"}
              </span>
              <span className="font-medium text-foreground">
                {isVoid ? "Belum bayar" : paymentMethodLabel(order.paymentMethod)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {isVoid ? "Total pesanan" : "Total pengembalian dana"}
              </span>
              <span className="font-mono text-sm font-semibold text-destructive tabular-nums">
                {formatCurrencyIDR(order.total)}
              </span>
            </div>
          </div>

          {isVoid ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
              <div className="flex flex-col gap-1">
                <span className="font-medium">
                  {alreadyCooking ? "Pesanan sudah diproses dapur" : "Pesanan belum dimasak"}
                </span>
                <p className="text-muted-foreground">
                  {alreadyCooking
                    ? "Karena dapur sudah mulai memasak, pembatalan akan mencatat bahan sebagai limbah dan stok tidak dikembalikan ke etalase."
                    : "Pesanan yang dibatalkan sebelum dimasak tidak mengubah saldo kas shift dan melepaskan status meja."}
                </p>
              </div>
            </div>
          ) : (
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
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="refund-reason" className="text-xs">
              {isVoid ? "Alasan pembatalan" : "Alasan refund"} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="refund-reason"
              placeholder={
                isVoid
                  ? "Contoh: Tamu membatalkan pesanan / Salah input menu..."
                  : "Contoh: Kesalahan input menu / Komplain tamu / Menu habis..."
              }
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (validationError) setValidationError(null);
              }}
              rows={2}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="refund-supervisor" className="text-xs">
              Persetujuan supervisor <span className="text-destructive">*</span>
            </Label>
            {canDirectAuthorize && currentUserName ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                <span className="text-muted-foreground">Otorisasi saat ini</span>
                <span className="font-medium text-foreground">
                  {currentUserName} {currentUserRole ? `(${currentUserRole})` : ""}
                </span>
              </div>
            ) : (
              <Input
                id="refund-supervisor"
                placeholder="Nama supervisor yang menyetujui"
                value={supervisorName}
                onChange={(e) => {
                  setSupervisorName(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                required
              />
            )}

            {requiresPin ? (
              <div className="flex flex-col gap-1.5 pt-1">
                <Label htmlFor="refund-supervisor-pin" className="flex items-center gap-1.5 text-xs">
                  <KeyRound className="size-3.5 text-muted-foreground" />
                  PIN supervisor <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="refund-supervisor-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Masukkan PIN supervisor"
                  value={supervisorPin}
                  onChange={(e) => {
                    setSupervisorPin(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  required
                />
              </div>
            ) : null}

            <span className="text-xs text-muted-foreground">
              {isVoid
                ? "Aksi pembatalan wajib disetujui supervisor dan tercatat permanen di audit log."
                : "Aksi refund wajib mendapat persetujuan dan akan tercatat permanen di audit log."}
            </span>
          </div>

          {validationError ? (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>{validationError}</span>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Tutup
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={
                isSubmitting ||
                !reason.trim() ||
                !supervisorName.trim() ||
                (requiresPin && !supervisorPin.trim())
              }
            >
              {isSubmitting
                ? "Memproses..."
                : isVoid
                  ? `Konfirmasi pembatalan (${formatCurrencyIDR(order.total)})`
                  : `Konfirmasi refund (${formatCurrencyIDR(order.total)})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
