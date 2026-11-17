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
  isTaxEnabled = true,
  taxRatePercent = 10,
  onConfirmClose,
}: CashDrawerShiftModalProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [confirmCashierName, setConfirmCashierName] = useState<string>(cashierName || user?.name || "");
  const [cashInDrawer, setCashInDrawer] = useState<number>(initialCash + totalCashSales);
  const [cashInputDisplay, setCashInputDisplay] = useState<string>(
    (initialCash + totalCashSales).toLocaleString("id-ID")
  );
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");

  useEffect(() => {
    setConfirmCashierName(cashierName || user?.name || "");
    const expected = initialCash + totalCashSales;
    setCashInDrawer(expected);
    setCashInputDisplay(expected.toLocaleString("id-ID"));
  }, [cashierName, user?.name, initialCash, totalCashSales, isOpen]);

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

  // 1. Calculations
  const totalGrossSales = totalCashSales + totalNonCashSales;
  const estimatedTax = isTaxEnabled
    ? Math.round(totalGrossSales * (taxRatePercent / (100 + taxRatePercent)))
    : 0;
  const totalNetSales = totalGrossSales - estimatedTax;

  const finalQrisSales = qrisSales !== undefined ? qrisSales : Math.round(totalNonCashSales * 0.85);
  const finalEdcSales = edcSales !== undefined ? edcSales : totalNonCashSales - finalQrisSales;

  // Revenue Sharing (Fixed 85% Mitra, 15% Dago Hub Platform)
  const tenantSharePercent = 85;
  const dagoSharePercent = 15;
  const tenantTotalShare = Math.round((totalNetSales * tenantSharePercent) / 100);
  const dagoTotalShare = totalNetSales - tenantTotalShare;

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
    setCashInputDisplay(num > 0 ? num.toLocaleString("id-ID") : "");
  };

  const getClosingPdfUrl = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const expectedCash = initialCash + totalCashSales;
    const cashVariance = cashInDrawer - expectedCash;

    return `${origin}/api/reports/closing/pdf?outlet=${encodeURIComponent(
      outletName
    )}&cashier=${encodeURIComponent(confirmCashierName || cashierName)}&transactions=${totalTransactionsCount}&gross=${totalGrossSales}&tax=${estimatedTax}&net=${totalNetSales}&qris=${finalQrisSales}&cash=${totalCashSales}&edc=${finalEdcSales}&mitra=${tenantTotalShare}&dago=${dagoTotalShare}&docNo=${encodeURIComponent(
      docNo
    )}&initialCash=${initialCash}&expectedCash=${expectedCash}&actualCash=${cashInDrawer}&variance=${cashVariance}&notes=${encodeURIComponent(
      `Tutup Sesi Kasir (${docNo})`
    )}`;
  };

  const handleConfirmCloseSession = async () => {
    if (isClosing) return;
    setIsClosing(true);

    const closingNote = `Tutup Sesi Kasir (${docNo})`;

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
        <div className="space-y-4 p-6 text-xs text-foreground">
          {/* Warning Banner */}
          <Alert className="border-warning/40 bg-warning/10 text-xs">
            <AlertTriangle className="size-4 text-warning shrink-0" />
            <AlertDescription className="text-foreground">
              Pastikan semua transaksi sudah selesai. Anda tidak dapat mengubah transaksi yang sudah dicatat setelah menutup sesi kasir.
            </AlertDescription>
          </Alert>

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
              disabled={isClosing || !confirmCashierName.trim()}
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
