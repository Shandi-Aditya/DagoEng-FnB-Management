"use client";

import { CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCurrencyIDR } from "@/lib/utils";

interface CartSummaryProps {
  subtotal: number;
  voucherDiscount: number;
  promoDiscount: number;
  promoName?: string;
  isTaxEnabled: boolean;
  taxRatePercent: number;
  tax: number;
  serviceCharge: number;
  serviceChargePercent: number;
  grandTotal: number;
  canPay: boolean;
  onPay: () => void;
}

function Line({ label, value, tone }: { label: string; value: string; tone?: "discount" }) {
  return (
    <div className={tone === "discount" ? "flex justify-between text-success" : "flex justify-between"}>
      <dt>{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}

/** Price breakdown and the pay action. Numbers are monospaced so columns line up. */
export function CartSummary({
  subtotal,
  voucherDiscount,
  promoDiscount,
  promoName,
  isTaxEnabled,
  taxRatePercent,
  tax,
  serviceCharge,
  serviceChargePercent,
  grandTotal,
  canPay,
  onPay,
}: CartSummaryProps) {
  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-1 text-sm text-muted-foreground">
        <Line label="Subtotal" value={formatCurrencyIDR(subtotal)} />
        {voucherDiscount > 0 ? <Line label="Voucher poin" value={`−${formatCurrencyIDR(voucherDiscount)}`} tone="discount" /> : null}
        {promoDiscount > 0 ? (
          <Line label={promoName ? `Promo ${promoName}` : "Promo"} value={`−${formatCurrencyIDR(promoDiscount)}`} tone="discount" />
        ) : null}
        <Line label={isTaxEnabled ? `PB1 ${taxRatePercent}%` : "PB1 (nonaktif)"} value={formatCurrencyIDR(isTaxEnabled ? tax : 0)} />
        {serviceCharge > 0 ? <Line label={`Service charge ${serviceChargePercent}%`} value={formatCurrencyIDR(serviceCharge)} /> : null}
        <div className="mt-1 flex items-baseline justify-between border-t pt-2 text-foreground">
          <dt className="font-medium">Total</dt>
          <dd className="font-mono text-xl font-semibold tabular-nums">{formatCurrencyIDR(grandTotal)}</dd>
        </div>
      </dl>
      <Button size="lg" className="w-full" disabled={!canPay} onClick={onPay}>
        <CreditCard />
        Bayar {formatCurrencyIDR(grandTotal)}
      </Button>
    </div>
  );
}
