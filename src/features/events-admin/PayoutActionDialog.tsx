"use client";

import { CheckCircle2, XCircle } from "lucide-react";
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
import { formatCurrencyIDR } from "@/lib/utils";

export interface PayoutTarget {
  id: string;
  eventId?: string;
  status: "PROCESSING" | "PAID" | "REJECTED";
  amount?: number;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  organizerName?: string;
  eventTitle?: string;
}

export interface PayoutActionDialogProps {
  target: PayoutTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inputText: string;
  onInputTextChange: (val: string) => void;
  onConfirm: () => void;
  isProcessing?: boolean;
}

export function PayoutActionDialog({
  target,
  open,
  onOpenChange,
  inputText,
  onInputTextChange,
  onConfirm,
  isProcessing,
}: PayoutActionDialogProps) {
  if (!target) return null;

  const isPaid = target.status === "PAID";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isPaid ? "Konfirmasi transfer saldo mitra" : "Tolak permohonan pencairan"}
          </DialogTitle>
          <DialogDescription>
            {isPaid
              ? `Tandai permohonan pencairan dana sebesar ${formatCurrencyIDR(target.amount || 0)} ke rekening ${target.bankName} ${target.accountNumber} (a.n. ${target.accountHolder}) sebagai selesai ditransfer.`
              : `Masukkan alasan penolakan pencairan saldo untuk ${target.organizerName}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Event:</span>
              <span className="font-medium text-foreground">{target.eventTitle || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Penyelenggara:</span>
              <span className="font-medium text-foreground">{target.organizerName || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nominal:</span>
              <span className="font-mono font-medium text-foreground">
                {formatCurrencyIDR(target.amount || 0)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payoutInput">
              {isPaid ? "Nomor referensi / mutasi bank (opsional)" : "Alasan penolakan"}
            </Label>
            <Input
              id="payoutInput"
              type="text"
              placeholder={
                isPaid
                  ? "Contoh: TRX-BCA-20261112-0091"
                  : "Contoh: Nomor rekening bank tidak valid…"
              }
              value={inputText}
              onChange={(e) => onInputTextChange(e.target.value)}
              required={!isPaid}
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Batal
          </Button>
          <Button
            type="button"
            size="lg"
            variant={isPaid ? "default" : "destructive"}
            onClick={onConfirm}
            disabled={(!isPaid && !inputText.trim()) || isProcessing}
          >
            {isProcessing ? (
              "Menyimpan…"
            ) : isPaid ? (
              <>
                <CheckCircle2 />
                <span>Konfirmasi bayar</span>
              </>
            ) : (
              <>
                <XCircle />
                <span>Tolak pencairan</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
