"use client";

import { useMemo, useState, useEffect } from "react";
import { CreditCard } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export interface RecordPaymentModalProps {
  lease: CommercialLease | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: {
    leaseId: string;
    periodLabel: string;
    amount: number;
    paymentMethod: string;
    referenceNo?: string;
  }) => void;
}

export function RecordPaymentModal({
  lease,
  isOpen,
  onClose,
  onSubmit,
}: RecordPaymentModalProps) {
  const currentPeriod = useMemo(() => {
    return new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  }, []);

  const [period, setPeriod] = useState(currentPeriod);
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("Transfer BCA");
  const [referenceNo, setReferenceNo] = useState("");

  useEffect(() => {
    if (lease) {
      setAmount(lease.monthlyRent || 0);
      setReferenceNo(`TRF-${Date.now().toString().slice(-5)}`);
      setPeriod(currentPeriod);
    }
  }, [lease, currentPeriod]);

  if (!lease) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    onSubmit({
      leaseId: lease.id,
      periodLabel: period.trim(),
      amount,
      paymentMethod,
      referenceNo: referenceNo.trim() || undefined,
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <CreditCard className="size-4 text-primary" />
            <span>Catat pembayaran sewa</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Mencatat pembayaran untuk tenant{" "}
            <strong className="text-foreground">{lease.tenantName}</strong> ({lease.unitCode}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="space-y-1.5">
            <Label htmlFor="pay-period" className="text-xs font-medium text-foreground">
              Periode pembayaran <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pay-period"
              required
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-amount" className="text-xs font-medium text-foreground">
              Nominal pembayaran (Rp) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pay-amount"
              type="number"
              min={1}
              required
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="text-xs font-mono font-medium"
            />
            {amount > 0 && (
              <p className="font-mono text-xs text-muted-foreground">
                Terbaca: {formatCurrencyIDR(amount)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-method" className="text-xs font-medium text-foreground">
              Metode bayar
            </Label>
            <NativeSelect
              id="pay-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full text-xs"
            >
              <option value="Transfer BCA">Transfer BCA</option>
              <option value="Transfer Mandiri">Transfer Mandiri</option>
              <option value="QRIS">QRIS</option>
              <option value="Tunai">Tunai</option>
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-ref" className="text-xs font-medium text-foreground">
              Nomor referensi / mutasi (opsional)
            </Label>
            <Input
              id="pay-ref"
              placeholder="Contoh: TRF-98231"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          <DialogFooter className="gap-2 border-t pt-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Batal
            </Button>
            <Button type="submit" size="sm">
              Simpan pembayaran
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
