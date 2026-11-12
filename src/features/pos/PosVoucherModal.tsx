"use client";

import { Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LoyaltyVoucher } from "@/features/pos/types";
import { cn } from "@/lib/utils";

interface PosVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberName?: string;
  memberPoints: number;
  vouchers: readonly LoyaltyVoucher[];
  appliedVoucherId?: string;
  onApplyVoucher: (voucher: LoyaltyVoucher) => void;
}

/** Modal to claim and apply loyalty vouchers against member points. */
export function PosVoucherModal({
  isOpen,
  onClose,
  memberName,
  memberPoints,
  vouchers,
  appliedVoucherId,
  onApplyVoucher,
}: PosVoucherModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md gap-4 p-5">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Ticket className="size-4 text-primary" />
            <DialogTitle className="text-sm font-medium text-foreground">
              Tukar poin dengan voucher
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {memberName ? (
              <span>
                Poin member <strong className="text-foreground">{memberName}</strong>:{" "}
                <span className="font-mono font-medium tabular-nums text-foreground">{memberPoints} pts</span>
              </span>
            ) : (
              <span>Pilih voucher yang ingin digunakan</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {vouchers.map((voucher) => {
            const canAfford = memberPoints >= voucher.pointsCost;
            const isSelected = appliedVoucherId === voucher.id;

            return (
              <div
                key={voucher.id}
                onClick={() => canAfford && onApplyVoucher(voucher)}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3 text-xs transition-colors",
                  !canAfford && "cursor-not-allowed border-border bg-muted/40 opacity-50",
                  canAfford && !isSelected && "cursor-pointer border-border bg-card hover:bg-accent/40",
                  canAfford && isSelected && "cursor-pointer border-primary bg-primary/5 ring-1 ring-primary"
                )}
              >
                <div className="space-y-0.5">
                  <p className="font-medium text-foreground">{voucher.title}</p>
                  <p className="text-muted-foreground">{voucher.description}</p>
                  <p className="font-mono text-muted-foreground">
                    Biaya: {voucher.pointsCost} poin
                  </p>
                </div>

                <Button
                  size="xs"
                  disabled={!canAfford}
                  variant={isSelected ? "default" : "outline"}
                >
                  {isSelected ? "Terpasang" : "Gunakan"}
                </Button>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
