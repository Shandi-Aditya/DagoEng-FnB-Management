import React from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { formatCurrencyIDR } from "@/lib/utils";
import type { SplitGuestBill } from "@/features/pos/types";

export interface SplitBalanceState {
  totalAssigned: number;
  remaining: number;
  isBalanced: boolean;
  isValid: boolean;
}

export interface PaymentTabSplitProps {
  grandTotal: number;
  splitGuestCount: number;
  splitGuests: SplitGuestBill[];
  splitBalance: SplitBalanceState;
  hasSplitQris: boolean;
  splitQrisAmount: number;
  onSplitCountChange: (count: number) => void;
  onToggleGuestPaid: (guestId: string) => void;
  onGuestMethodChange: (guestId: string, method: "QRIS" | "CASH" | "EDC") => void;
  onGuestAmountChange: (guestId: string, amount: number) => void;
  renderQrisVerificationBlock: (amount: number, label: string) => React.ReactNode;
}

export function PaymentTabSplit({
  grandTotal,
  splitGuestCount,
  splitGuests,
  splitBalance,
  hasSplitQris,
  splitQrisAmount,
  onSplitCountChange,
  onToggleGuestPaid,
  onGuestMethodChange,
  onGuestAmountChange,
  renderQrisVerificationBlock,
}: PaymentTabSplitProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-xs font-semibold text-foreground">
            Bagi tagihan & metode pembayaran
          </h4>
          <p className="text-xs text-muted-foreground">
            Atur nominal dan metode bayar untuk masing-masing tamu
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Bagi rata:</span>
          <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
            {[2, 3, 4, 5].map((cnt) => (
              <Button
                key={cnt}
                type="button"
                size="icon-sm"
                variant={splitGuestCount === cnt ? "default" : "ghost"}
                onClick={() => onSplitCountChange(cnt)}
                className="font-mono"
              >
                {cnt}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time Allocation Summary Card */}
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/30 p-3 text-center text-xs">
        <div>
          <span className="block text-xs text-muted-foreground">Total tagihan</span>
          <span className="font-mono font-medium text-foreground tabular-nums">
            {formatCurrencyIDR(grandTotal)}
          </span>
        </div>
        <div>
          <span className="block text-xs text-muted-foreground">Total dialokasikan</span>
          <span
            className={cn(
              "font-mono font-medium tabular-nums",
              splitBalance.isBalanced ? "text-success" : "text-warning"
            )}
          >
            {formatCurrencyIDR(splitBalance.totalAssigned)}
          </span>
        </div>
        <div>
          <span className="block text-xs text-muted-foreground">Sisa alokasi</span>
          <span
            className={cn(
              "font-mono font-medium tabular-nums",
              splitBalance.remaining === 0
                ? "text-success"
                : splitBalance.remaining < 0
                ? "text-destructive"
                : "text-warning"
            )}
          >
            {formatCurrencyIDR(splitBalance.remaining)}
          </span>
        </div>
      </div>

      {/* Warning Alert if allocation does not match grand total */}
      {!splitBalance.isBalanced && (
        <Alert className="border-warning/40 bg-warning/10">
          <AlertTriangle className="size-4 text-warning" />
          <AlertDescription className="text-foreground">
            {splitBalance.remaining > 0
              ? `Alokasi pembayaran masih kurang ${formatCurrencyIDR(splitBalance.remaining)}.`
              : `Alokasi pembayaran melebihi total tagihan sebesar ${formatCurrencyIDR(Math.abs(splitBalance.remaining))}.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Guest Rows */}
      <div className="space-y-2.5">
        {splitGuests.map((guest) => (
          <div
            key={guest.id}
            className={cn(
              "space-y-2.5 rounded-xl border p-3.5 transition-colors",
              guest.isPaid
                ? "border-success/30 bg-success/5"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  variant={guest.isPaid ? "default" : "outline"}
                  size="icon-xs"
                  onClick={() => onToggleGuestPaid(guest.id)}
                  aria-label={`Tandai ${guest.guestLabel} lunas`}
                >
                  {guest.isPaid && <Check className="size-3.5" />}
                </Button>
                <span className="text-xs font-semibold text-foreground">
                  {guest.guestLabel}
                </span>
              </div>

              {/* Payment Method Selector */}
              <div className="flex items-center gap-1">
                {(["QRIS", "CASH", "EDC"] as const).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="xs"
                    variant={guest.paymentMethod === m ? "default" : "outline"}
                    onClick={() => onGuestMethodChange(guest.id, m)}
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>

            {/* Assigned Amount Input */}
            <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
              <span className="text-xs text-muted-foreground">Nominal pembayaran:</span>
              <div className="relative w-44">
                <span className="absolute left-2.5 top-2 text-xs font-medium text-muted-foreground">
                  Rp
                </span>
                <Input
                  type="number"
                  value={guest.assignedAmount}
                  onChange={(e) => onGuestAmountChange(guest.id, Number(e.target.value))}
                  className="pl-8 text-right font-mono text-xs font-medium tabular-nums"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasSplitQris ? (
        <div className="border-t border-border pt-3">
          {renderQrisVerificationBlock(
            splitQrisAmount,
            "Verifikasi pembayaran QRIS pada bagi tagihan"
          )}
        </div>
      ) : null}
    </div>
  );
}
