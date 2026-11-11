import { useState, useEffect } from "react";
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
  const [period, setPeriod] = useState("Oktober 2026");
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("Transfer BCA");
  const [referenceNo, setReferenceNo] = useState("");

  useEffect(() => {
    if (lease) {
      setAmount(lease.monthlyRent || 0);
      setReferenceNo(`TRF-${Date.now().toString().slice(-5)}`);
    }
  }, [lease]);

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
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <span>Catat pembayaran sewa</span>
          </DialogTitle>
          <DialogDescription>
            Mencatat pembayaran untuk tenant{" "}
            <strong className="text-foreground">{lease.tenantName}</strong> ({lease.unitCode}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="pay-period" className="text-xs">
              Periode Pembayaran <span className="text-destructive">*</span>
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
            <Label htmlFor="pay-amount" className="text-xs">
              Nominal Pembayaran (Rp) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pay-amount"
              type="number"
              required
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="text-xs font-mono font-medium"
            />
            <p className="text-[11px] text-muted-foreground font-mono">
              Terbaca: {formatCurrencyIDR(amount)}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-method" className="text-xs">Metode bayar</Label>
            <NativeSelect
              id="pay-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full text-xs font-medium"
            >
              <option value="Transfer BCA">Transfer BCA</option>
              <option value="Transfer Mandiri">Transfer Mandiri</option>
              <option value="QRIS">QRIS</option>
              <option value="Tunai">Tunai</option>
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-ref" className="text-xs">Nomor referensi</Label>
            <Input
              id="pay-ref"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Batal
            </Button>
            <Button type="submit" size="sm" className="text-xs font-medium">
              Konfirmasi Pembayaran
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
