import React from "react";
import { Building2, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrencyIDR } from "@/lib/utils";

export interface PaymentTabInvoiceProps {
  corporateCompany?: string;
  customerName?: string;
  grandTotal: number;
}

export function PaymentTabInvoice({
  corporateCompany,
  customerName,
  grandTotal,
}: PaymentTabInvoiceProps) {
  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Building2 className="size-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">Tagihan Bertempo Perusahaan (Corporate Invoice)</h4>
          <p className="text-xs text-muted-foreground">
            Pesanan akan diterbitkan sebagai tagihan resmi atas nama perusahaan dengan termin pembayaran 14 hari kerja.
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-md border bg-background p-3 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Instansi / Perusahaan:</span>
          <span className="font-semibold text-foreground">{corporateCompany || customerName || "-"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status Pembayaran:</span>
          <span className="font-semibold text-foreground">Pending (Tagihan Bertempo)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Jatuh Tempo:</span>
          <span className="font-medium text-foreground">14 Hari dari Pemesanan</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2">
          <span className="font-semibold text-muted-foreground">Total Tagihan:</span>
          <span className="font-semibold text-foreground text-sm">{formatCurrencyIDR(grandTotal)}</span>
        </div>
      </div>

      <Alert className="py-2 text-xs">
        <ShieldCheck className="size-4" />
        <AlertDescription className="text-muted-foreground">
          Invoice PDF resmi berkop Dago Creative Hub akan otomatis tersedia untuk dicetak atau diunduh setelah konfirmasi.
        </AlertDescription>
      </Alert>
    </div>
  );
}
