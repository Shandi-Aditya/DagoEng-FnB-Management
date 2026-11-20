"use client";

import React, { useState } from "react";
import { RotateCcw, Clock, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { formatCurrencyIDR } from "@/lib/utils";
import type { EventRefundPolicy, TicketRefundRequest } from "@/types/event";
import { TicketRefundRequestDialog } from "./TicketRefundRequestDialog";

interface TicketRefundSectionProps {
  bookingId: string;
  guestToken: string;
  totalPrice: number;
  paymentStatus: string;
  refundStatus?: string | null;
  refundRequest?: TicketRefundRequest | null;
  refundPolicy?: EventRefundPolicy | null;
  refundEligibility?: {
    eligible: boolean;
    error?: string;
    calculatedRefundAmount: number;
    feeDeducted: number;
    deadlineDate?: string | Date;
  } | null;
  onRefundSubmitted: () => void;
}

export function TicketRefundSection({
  bookingId,
  guestToken,
  totalPrice,
  paymentStatus,
  refundStatus,
  refundRequest,
  refundPolicy,
  refundEligibility,
  onRefundSubmitted,
}: TicketRefundSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 1. Status: Refund Sedang Diproses
  if (refundStatus === "REQUESTED") {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-warning" />
            <h4 className="font-semibold text-xs text-foreground">
              Pengajuan refund sedang diproses
            </h4>
          </div>
          <StatusBadge status="warning">Menunggu verifikasi admin</StatusBadge>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Permintaan pengembalian dana tiket Anda telah tercatat dan sedang diverifikasi oleh tim keuangan Dago Creative Hub.
        </p>

        {refundRequest && (
          <div className="rounded-lg border bg-card p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nominal pengembalian:</span>
              <span className="font-semibold text-foreground font-mono tabular-nums">
                {formatCurrencyIDR(refundRequest.refundAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rekening tujuan:</span>
              <span className="font-medium text-foreground">
                {refundRequest.bankName} - {refundRequest.accountNumber} ({refundRequest.accountHolder})
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-border/60">
              <span className="text-muted-foreground">Alasan:</span>
              <span className="font-medium text-foreground text-right">{refundRequest.reason}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Status: Refund Disetujui / Selesai
  if (refundStatus === "APPROVED" || paymentStatus === "REFUNDED") {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success" />
            <h4 className="font-semibold text-xs text-foreground">
              Dana tiket telah dikembalikan
            </h4>
          </div>
          <StatusBadge status="neutral">Refund selesai</StatusBadge>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Pengembalian dana telah selesai diproses. Transfer telah dikirimkan ke rekening yang Anda ajukan. Hak akses tiket dinonaktifkan.
        </p>

        {refundRequest && (
          <div className="rounded-lg border bg-card p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nominal yang dikembalikan:</span>
              <span className="font-semibold text-foreground font-mono tabular-nums">
                {formatCurrencyIDR(refundRequest.refundAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rekening tujuan:</span>
              <span className="font-medium text-foreground">
                {refundRequest.bankName} - {refundRequest.accountNumber}
              </span>
            </div>
            {refundRequest.adminNote && (
              <div className="flex justify-between pt-1 border-t border-border/60">
                <span className="text-muted-foreground">Catatan admin:</span>
                <span className="font-medium text-foreground">{refundRequest.adminNote}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 3. Status: Refund Ditolak
  if (refundStatus === "REJECTED") {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <h4 className="font-semibold text-xs text-destructive">
              Pengajuan refund ditolak
            </h4>
          </div>
          <StatusBadge status="destructive">Ditolak</StatusBadge>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Pengajuan pengembalian dana tiket Anda tidak dapat disetujui. Tiket Anda tetap berlaku normal untuk menghadiri acara.
        </p>

        {refundRequest?.rejectionReason && (
          <div className="rounded-lg border border-destructive/20 bg-card p-3 text-xs space-y-1">
            <span className="font-medium text-foreground block">Alasan penolakan:</span>
            <p className="text-muted-foreground">{refundRequest.rejectionReason}</p>
          </div>
        )}
      </div>
    );
  }

  // 4. Default: Belum Mengajukan Refund
  // Hanya tampilkan opsi refund jika event berbayar dan tiket sudah lunas
  if (paymentStatus !== "PAID" || totalPrice <= 0) {
    return null;
  }

  const isEligible = refundEligibility?.eligible === true;
  const netRefund = refundEligibility?.calculatedRefundAmount ?? totalPrice;
  const feeDeducted = refundEligibility?.feeDeducted ?? 0;

  const deadlineWita = React.useMemo(() => {
    if (!refundEligibility?.deadlineDate) return null;
    try {
      const d = new Date(refundEligibility.deadlineDate);
      if (isNaN(d.getTime())) return null;
      return (
        new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Makassar",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(d) + " WITA"
      );
    } catch {
      return null;
    }
  }, [refundEligibility?.deadlineDate]);

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw className="size-4 text-primary" />
            <h4 className="font-semibold text-xs text-foreground">
              Ketentuan dan pengajuan refund tiket
            </h4>
          </div>
          <span className="text-xs text-muted-foreground">
            {refundPolicy?.policyType === "REFUNDABLE_UNTIL_H_MINUS"
              ? `Bisa refund (H-${refundPolicy.hMinusDays ?? 0})`
              : "Tanpa refund"}
          </span>
        </div>

        {refundPolicy?.policyType === "REFUNDABLE_UNTIL_H_MINUS" ? (
          <div className="space-y-2 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              Event ini memperbolehkan pembatalan tiket hingga H-{refundPolicy.hMinusDays ?? 0} sebelum tanggal pelaksanaan acara
              {Boolean(refundPolicy.refundFeePercent) && ` dengan potongan biaya admin ${refundPolicy.refundFeePercent}%`}.
            </p>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimasi dana kembali:</span>
                <span className="font-semibold text-foreground font-mono tabular-nums">
                  {formatCurrencyIDR(netRefund)}
                </span>
              </div>
              {feeDeducted > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Potongan biaya:</span>
                  <span className="font-mono tabular-nums">-{formatCurrencyIDR(feeDeducted)}</span>
                </div>
              )}
              {deadlineWita && (
                <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/40">
                  <span>Batas pengajuan:</span>
                  <span className="font-medium text-foreground">{deadlineWita}</span>
                </div>
              )}
            </div>

            {isEligible ? (
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => setIsDialogOpen(true)}
                className="w-full"
              >
                <RotateCcw className="size-3.5" />
                <span>Ajukan refund tiket</span>
                <ArrowRight className="size-3.5 ml-auto" />
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {refundEligibility?.error || "Tiket saat ini sudah melewati batas waktu pengajuan refund."}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Tiket event ini tidak memberlakukan opsi pengembalian dana (tanpa refund).
          </p>
        )}
      </div>

      {isEligible && (
        <TicketRefundRequestDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          bookingId={bookingId}
          guestToken={guestToken}
          calculatedRefundAmount={netRefund}
          feeDeducted={feeDeducted}
          totalPrice={totalPrice}
          onSuccess={onRefundSubmitted}
        />
      )}
    </>
  );
}
