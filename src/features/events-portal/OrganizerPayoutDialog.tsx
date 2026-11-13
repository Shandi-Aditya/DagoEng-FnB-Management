"use client";

import React from "react";
import { RefreshCw, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatCurrencyIDR } from "@/lib/utils";
import type { CommunityEvent } from "@/types/event";

interface OrganizerPayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: CommunityEvent[];
  targetEventId: string;
  onSelectTargetEvent: (id: string) => void;
  targetAvailable: number;
  amount: number;
  setAmount: (v: number) => void;
  bankName: string;
  setBankName: (v: string) => void;
  accountNumber: string;
  setAccountNumber: (v: string) => void;
  accountHolder: string;
  setAccountHolder: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  onSubmitPayout: (e: React.FormEvent) => void;
  isSubmitting: boolean;
}

export function OrganizerPayoutDialog({
  open,
  onOpenChange,
  events,
  targetEventId,
  onSelectTargetEvent,
  targetAvailable,
  amount,
  setAmount,
  bankName,
  setBankName,
  accountNumber,
  setAccountNumber,
  accountHolder,
  setAccountHolder,
  notes,
  setNotes,
  onSubmitPayout,
  isSubmitting,
}: OrganizerPayoutDialogProps) {
  const isOverLimit = amount > targetAvailable;
  const isInvalid = amount <= 0 || isOverLimit || targetAvailable <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">
            Form Pengajuan Pencairan Saldo (Payout)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Tarik pendapatan bagi hasil event langsung ke rekening bank penampung resmi Anda.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmitPayout} className="space-y-4 text-xs pt-1">
          {/* Source Event Selector */}
          <div className="space-y-1">
            <label className="font-medium text-foreground">Sumber event</label>
            <NativeSelect
              value={targetEventId}
              onChange={(e) => onSelectTargetEvent(e.target.value)}
              aria-label="Pilih event sumber saldo"
            >
              {events.map((e) => (
                <NativeSelectOption key={e.id} value={e.id}>
                  {e.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>Saldo tersedia untuk event ini:</span>
              <span className="font-mono font-medium text-success">
                {formatCurrencyIDR(targetAvailable)}
              </span>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-1">
            <label className="font-medium text-foreground">Nominal pencairan (Rp)</label>
            <input
              type="number"
              min={10000}
              max={targetAvailable}
              required
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Minimal Rp 10.000"
              className="w-full h-9 rounded-md border bg-background px-3 text-xs font-mono font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
            />
            {isOverLimit && (
              <p className="text-xs text-destructive">
                Nominal melebihi saldo yang tersedia ({formatCurrencyIDR(targetAvailable)}).
              </p>
            )}
          </div>

          {/* Bank Destination Fields */}
          <div className="rounded-lg border p-3.5 space-y-3 bg-muted/20">
            <span className="font-medium text-foreground block">Rekening bank tujuan</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-muted-foreground">Nama bank</label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Contoh: BCA / Mandiri"
                  className="w-full h-8 rounded-md border bg-background px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">Nomor rekening</label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Nomor rekening"
                  className="w-full h-8 rounded-md border bg-background px-2.5 text-xs text-foreground font-mono focus:outline-hidden focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-muted-foreground">Nama pemilik rekening</label>
              <input
                type="text"
                required
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                placeholder="Harus sesuai buku tabungan"
                className="w-full h-8 rounded-md border bg-background px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="font-medium text-foreground">
              Catatan untuk tim keuangan Dago (opsional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan transfer atau konfirmasi khusus..."
              className="w-full rounded-md border bg-background p-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring resize-y"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || isInvalid}
            >
              {isSubmitting ? <RefreshCw className="size-3.5 animate-spin" /> : null}
              <span>Ajukan pencairan dana</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
