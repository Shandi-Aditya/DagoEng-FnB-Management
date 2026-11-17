"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, Printer } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { extractShiftStartTimeMs } from "@/lib/shift-management";
import { aggregateShiftOrdersTaxAndRevenue } from "@/lib/tax-breakdown";
import { formatCurrencyIDR } from "@/lib/utils";
import type { OrderRecord } from "@/types/order";
import type { ShiftRecord } from "@/types/shift";

export interface CashDrawerShiftSummary {
  initialCash: number;
  cashSales: number;
  qrisSales: number;
  edcSales: number;
  nonCashSales: number;
  transactionsCount: number;
  discounts: number;
  refundAmount: number;
  storedTax: number;
  storedServiceCharge: number;
}

export function buildCashDrawerShiftSummary(
  orders: OrderRecord[],
  activeShift?: ShiftRecord | null
): CashDrawerShiftSummary {
  if (!activeShift) {
    return {
      initialCash: 0,
      cashSales: 0,
      qrisSales: 0,
      edcSales: 0,
      nonCashSales: 0,
      transactionsCount: 0,
      discounts: 0,
      refundAmount: 0,
      storedTax: 0,
      storedServiceCharge: 0,
    };
  }

  const taxAgg = aggregateShiftOrdersTaxAndRevenue(orders, activeShift);
  const startMs =
    extractShiftStartTimeMs(activeShift) ||
    (activeShift.startTime ? Date.parse(activeShift.startTime) : 0);
  const rawEnd = activeShift.closedAt || activeShift.endTime;
  const parsedEndMs = rawEnd ? Date.parse(rawEnd) : NaN;
  const endMs = !Number.isNaN(parsedEndMs) && parsedEndMs > 0 ? parsedEndMs : Infinity;

  const shiftPaidOrders = orders.filter((order) => {
    if (order.paymentStatus !== "PAID" || order.status === "CANCELLED") return false;
    if (
      activeShift.outletId &&
      activeShift.outletId !== "ALL" &&
      order.outletId &&
      order.outletId !== activeShift.outletId
    ) {
      return false;
    }
    if (startMs > 0 && order.createdAt) {
      const orderMs = Date.parse(order.createdAt);
      if (!Number.isNaN(orderMs) && (orderMs < startMs || orderMs > endMs)) {
        return false;
      }
    }
    return true;
  });

  let edcSalesFromOrders = 0;
  for (const order of shiftPaidOrders) {
    if (order.paymentMethod === "EDC") {
      edcSalesFromOrders += order.total || 0;
    } else if (order.paymentMethod === "SPLIT" && order.splitDetails) {
      edcSalesFromOrders += order.splitDetails
        .filter((g) => g.method === "EDC")
        .reduce((sum, g) => sum + (g.amount || 0), 0);
    }
  }

  const cashSales = activeShift.cashSales || 0;
  const nonCashSales = activeShift.nonCashSales || 0;
  const edcSales = Math.min(nonCashSales, edcSalesFromOrders);
  const qrisSales = Math.max(0, nonCashSales - edcSales);

  return {
    initialCash: activeShift.openingCash ?? 0,
    cashSales,
    qrisSales,
    edcSales,
    nonCashSales,
    transactionsCount: taxAgg.orderCount,
    discounts: taxAgg.totalDiscounts,
    refundAmount: activeShift.refundAmount || 0,
    storedTax: taxAgg.totalTaxPB1,
    storedServiceCharge: taxAgg.totalServiceCharge,
  };
}

interface CashDrawerShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId?: string;
  cashierName: string;
  outletName: string;
  initialCash: number;
  totalCashSales: number;
  totalNonCashSales: number;
  totalTransactionsCount: number;
  qrisSales?: number;
  edcSales?: number;
  totalDiscounts?: number;
  refundAmount?: number;
  storedTax?: number;
  storedServiceCharge?: number;
  isTaxEnabled?: boolean;
  taxRatePercent?: number;
  tenantName?: string;
  tenantPhone?: string;
  onConfirmClose?: (actualCash: number, notes?: string) => void;
}

export function CashDrawerShiftModal({
  isOpen,
  onClose,
  shiftId,
  cashierName,
  outletName,
  initialCash,
  totalCashSales,
  totalNonCashSales,
  totalTransactionsCount,
  qrisSales,
  edcSales,
  refundAmount = 0,
  storedTax,
  storedServiceCharge,
  isTaxEnabled = true,
  taxRatePercent = 10,
  onConfirmClose,
}: CashDrawerShiftModalProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [confirmCashierName, setConfirmCashierName] = useState<string>(cashierName || user?.name || "");
  const [cashInDrawer, setCashInDrawer] = useState<number>(initialCash + totalCashSales - refundAmount);
  const [cashInputDisplay, setCashInputDisplay] = useState<string>(
    (initialCash + totalCashSales - refundAmount).toLocaleString("id-ID")
  );
  const [varianceNotes, setVarianceNotes] = useState<string>("");
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");

  useEffect(() => {
    setConfirmCashierName(cashierName || user?.name || "");
    const expected = initialCash + totalCashSales - refundAmount;
    setCashInDrawer(expected);
    setCashInputDisplay(expected.toLocaleString("id-ID"));
    if (isOpen) {
      setVarianceNotes("");
    }
  }, [cashierName, user?.name, initialCash, totalCashSales, refundAmount, isOpen]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      const day = now.getDate().toString().padStart(2, "0");
      const month = months[now.getMonth()];
      const year = now.getFullYear();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const seconds = now.getSeconds().toString().padStart(2, "0");
      setCurrentTimeStr(`${day} ${month} ${year} ${hours}.${minutes}.${seconds}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen) return null;

  const totalGrossSales = totalCashSales + totalNonCashSales;
  const finalTax =
    storedTax !== undefined
      ? storedTax
      : isTaxEnabled
        ? Math.round(totalGrossSales * (taxRatePercent / (100 + taxRatePercent)))
        : 0;
  const finalServiceCharge = storedServiceCharge ?? 0;
  const totalNetSales = Math.max(0, totalGrossSales - finalTax - finalServiceCharge);

  const finalQrisSales = qrisSales !== undefined ? qrisSales : Math.round(totalNonCashSales * 0.85);
  const finalEdcSales = edcSales !== undefined ? edcSales : totalNonCashSales - finalQrisSales;

  const tenantSharePercent = 85;
  const tenantTotalShare = Math.round((totalNetSales * tenantSharePercent) / 100);
  const dagoTotalShare = totalNetSales - tenantTotalShare;

  const expectedCash = initialCash + totalCashSales - refundAmount;
  const cashVariance = cashInDrawer - expectedCash;
  const hasCashVariance = cashVariance !== 0;
  const isVarianceReasonMissing = hasCashVariance && !varianceNotes.trim();

  const dateNow = new Date();
  const docNo = `EOD-${dateNow.getFullYear()}${(dateNow.getMonth() + 1)
    .toString()
    .padStart(2, "0")}${dateNow.getDate().toString().padStart(2, "0")}-${Math.floor(
    100 + Math.random() * 900
  )}`;

  const handleCashInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, "");
    const num = parseInt(rawVal, 10) || 0;
    setCashInDrawer(num);
    setCashInputDisplay(num > 0 ? num.toLocaleString("id-ID") : "0");
  };

  const resolvedClosingNote = varianceNotes.trim() || `Tutup Sesi Kasir (${docNo})`;

  const getClosingPdfUrl = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";

    return `${origin}/api/reports/closing/pdf?outlet=${encodeURIComponent(
      outletName
    )}&cashier=${encodeURIComponent(confirmCashierName || cashierName)}&transactions=${totalTransactionsCount}&gross=${totalGrossSales}&tax=${finalTax}&service=${finalServiceCharge}&net=${totalNetSales}&qris=${finalQrisSales}&cash=${totalCashSales}&edc=${finalEdcSales}&mitra=${tenantTotalShare}&dago=${dagoTotalShare}&docNo=${encodeURIComponent(
      docNo
    )}&initialCash=${initialCash}&expectedCash=${expectedCash}&actualCash=${cashInDrawer}&variance=${cashVariance}&notes=${encodeURIComponent(
      resolvedClosingNote
    )}`;
  };

  const handleConfirmCloseSession = async () => {
    if (isClosing || isVarianceReasonMissing) return;
    setIsClosing(true);

    const closingNote = resolvedClosingNote;

    if (onConfirmClose) {
      onConfirmClose(cashInDrawer, closingNote);
    } else {
      try {
        await fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "CLOSE",
            shiftId,
            cashierName: confirmCashierName || cashierName,
            outletId: outletName,
            actualCash: cashInDrawer,
            notes: closingNote,
          }),
        });
      } catch (e) {
        console.warn("Shift lock sync:", e);
      }
    }

    setTimeout(async () => {
      try {
        await logout();
      } catch (err) {
        console.error("Logout error:", err);
      } finally {
        onClose();
        router.push("/login");
      }
    }, 800);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isClosing && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {/* Header */}
        <DialogHeader className="border-b border-border bg-muted/30 px-6 py-4">
          <DialogTitle className="text-sm font-medium text-foreground">
            Tutup sesi kasir
          </DialogTitle>
          <DialogDescription className="sr-only">
            Konfirmasi penutupan sesi kasir dan hitung uang fisik
          </DialogDescription>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6 text-xs text-foreground">
          {/* Warning Banner */}
          <Alert className="border-warning/40 bg-warning/10 text-xs">
            <AlertTriangle className="size-4 text-warning shrink-0" />
            <AlertDescription className="text-foreground">
              Pastikan semua transaksi sudah selesai. Anda tidak dapat mengubah transaksi yang sudah dicatat setelah menutup sesi kasir.
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modal awal</span>
              <span className="font-mono tabular-nums text-foreground">
                {formatCurrencyIDR(initialCash)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Penjualan tunai</span>
              <span className="font-mono tabular-nums text-foreground">
                {formatCurrencyIDR(totalCashSales)}
              </span>
            </div>
            {refundAmount > 0 ? (
              <div className="flex justify-between text-destructive">
                <span>Refund tunai</span>
                <span className="font-mono tabular-nums">-{formatCurrencyIDR(refundAmount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t pt-1.5 font-medium">
              <span className="text-foreground">Kas seharusnya</span>
              <span className="font-mono tabular-nums text-foreground">
                {formatCurrencyIDR(expectedCash)}
              </span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-muted-foreground">Selisih kas</span>
              <span
                className={
                  cashVariance === 0
                    ? "font-mono tabular-nums text-success"
                    : cashVariance < 0
                      ? "font-mono tabular-nums text-destructive"
                      : "font-mono tabular-nums text-warning"
                }
              >
                {cashVariance === 0
                  ? "Sesuai (Rp 0)"
                  : `${cashVariance > 0 ? "+" : "-"}${formatCurrencyIDR(Math.abs(cashVariance))}`}
              </span>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3 pt-1">
            {/* Cashier Name Confirmation */}
            <div className="space-y-1.5">
              <Label htmlFor="close-cashier-name" className="text-xs font-medium text-foreground">
                Konfirmasi nama kasir
              </Label>
              <Input
                id="close-cashier-name"
                type="text"
                value={confirmCashierName}
                onChange={(e) => setConfirmCashierName(e.target.value)}
                placeholder="Nama kasir yang menutup sesi"
                disabled={isClosing}
              />
            </div>

            {/* Cash in Drawer */}
            <div className="space-y-1.5">
              <Label htmlFor="close-cash-drawer" className="text-xs font-medium text-foreground">
                Uang tunai fisik di laci
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 font-mono text-xs text-muted-foreground">
                  Rp
                </span>
                <Input
                  id="close-cash-drawer"
                  type="text"
                  value={cashInputDisplay}
                  onChange={handleCashInputChange}
                  placeholder="0"
                  disabled={isClosing}
                  className="pl-9 font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="close-variance-notes" className="text-xs font-medium text-foreground">
                Alasan selisih kas
                {hasCashVariance ? <span className="text-destructive"> *</span> : " (opsional)"}
              </Label>
              <Textarea
                id="close-variance-notes"
                rows={2}
                value={varianceNotes}
                onChange={(e) => setVarianceNotes(e.target.value)}
                placeholder="Jelaskan penyebab selisih uang fisik atau catatan tutup shift"
                disabled={isClosing}
                aria-invalid={isVarianceReasonMissing}
                className="text-xs"
              />
              {isVarianceReasonMissing ? (
                <p className="text-xs text-destructive">
                  Isi alasan selisih kas sebelum menutup sesi.
                </p>
              ) : null}
            </div>
          </div>

          {/* Server Timestamp */}
          <div className="space-y-0.5 pt-1 text-center text-xs text-muted-foreground">
            <p>
              Kasir ditutup pada{" "}
              <strong className="font-mono font-medium text-foreground tabular-nums">
                {currentTimeStr || "Waktu server"}
              </strong>
            </p>
            <p className="text-xs text-muted-foreground/70">Waktu server</p>
          </div>

          {/* Confirm Button */}
          <div className="space-y-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isClosing}
              onClick={() => {
                const printUrl = getClosingPdfUrl();
                window.open(printUrl, "_blank");
              }}
              className="w-full"
            >
              <Printer className="size-4" />
              <span>Cetak / pratinjau laporan FO</span>
            </Button>

            <Button
              type="button"
              size="lg"
              disabled={isClosing || !confirmCashierName.trim() || isVarianceReasonMissing}
              onClick={handleConfirmCloseSession}
              className="w-full"
            >
              {isClosing ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner className="size-4" />
                  <span>Menutup sesi dan mengirim laporan...</span>
                </span>
              ) : (
                <span>Konfirmasi tutup sesi</span>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Ringkasan otomatis ke Ka Ari dan mitra
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
