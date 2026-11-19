"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/app/notify";
import { formatCurrencyIDR } from "@/lib/utils";
import type { EventTicketOrder } from "@/types/event";

interface RefundActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: EventTicketOrder | null;
  onSuccess: () => void;
}

export function RefundActionDialog({
  open,
  onOpenChange,
  booking,
  onSuccess,
}: RefundActionDialogProps) {
  const [decision, setDecision] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [forceApproveDeficit, setForceApproveDeficit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!booking) return null;

  const refundReq = booking.refundRequest;
  const refundAmount = refundReq?.refundAmount ?? booking.totalPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (decision === "REJECT" && (!rejectionReason.trim() || rejectionReason.trim().length < 5)) {
      notify.error("Alasan penolakan wajib diisi", "Tuliskan alasan penolakan refund minimal 5 karakter.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/events/admin/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          decision,
          adminNotes: adminNotes.trim() || undefined,
          rejectionReason: decision === "REJECT" ? rejectionReason.trim() : undefined,
          forceApproveDeficit: decision === "APPROVE" ? forceApproveDeficit : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memproses keputusan refund tiket.");
      }

      notify.success(
        decision === "APPROVE" ? "Refund disetujui" : "Refund ditolak",
        data.message || "Keputusan refund tiket berhasil disimpan."
      );
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      notify.error("Gagal memproses refund", err.message || "Terjadi kesalahan pada sistem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tinjau pengajuan refund tiket</DialogTitle>
          <DialogDescription>
            Periksa rincian permohonan pengembalian dana tiket peserta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Summary Box */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kode tiket:</span>
              <span className="font-mono font-medium text-foreground">{booking.ticketCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nama pemesan:</span>
              <span className="font-medium text-foreground">{booking.guestName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total pembayaran:</span>
              <span className="font-mono text-foreground">{formatCurrencyIDR(booking.totalPrice)}</span>
            </div>
            <div className="flex justify-between font-semibold text-primary pt-1 border-t border-border/60">
              <span>Nominal refund diajukan:</span>
              <span className="font-mono">{formatCurrencyIDR(refundAmount)}</span>
            </div>
            {refundReq && (
              <>
                <div className="flex justify-between pt-1 border-t border-border/60">
                  <span className="text-muted-foreground">Rekening tujuan:</span>
                  <span className="font-medium text-foreground">
                    {refundReq.bankName} - {refundReq.accountNumber} ({refundReq.accountHolder})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alasan:</span>
                  <span className="font-medium text-foreground text-right">{refundReq.reason}</span>
                </div>
              </>
            )}
          </div>

          {/* Decision Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Keputusan admin</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={decision === "APPROVE" ? "default" : "outline"}
                size="default"
                onClick={() => setDecision("APPROVE")}
              >
                Setujui refund
              </Button>
              <Button
                type="button"
                variant={decision === "REJECT" ? "destructive" : "outline"}
                size="default"
                onClick={() => setDecision("REJECT")}
              >
                Tolak refund
              </Button>
            </div>
          </div>

          {decision === "APPROVE" && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <Label htmlFor="admin-notes" className="text-xs">
                  Catatan admin (opsional)
                </Label>
                <Input
                  id="admin-notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Contoh: Transfer BCA ref #123456"
                  className="text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                <input
                  id="force-approve"
                  type="checkbox"
                  checked={forceApproveDeficit}
                  onChange={(e) => setForceApproveDeficit(e.target.checked)}
                  className="rounded border-border text-primary size-3.5"
                />
                <Label htmlFor="force-approve" className="text-xs cursor-pointer">
                  Paksa setujui jika terjadi defisit saldo penyelenggara (Super Admin)
                </Label>
              </div>
            </div>
          )}

          {decision === "REJECT" && (
            <div className="space-y-1 pt-1">
              <Label htmlFor="rejection-reason" className="text-xs">
                Alasan penolakan <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="rejection-reason"
                required
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Tuliskan alasan penolakan agar peserta memahami penolakan ini (minimal 5 karakter)"
                className="text-xs"
              />
            </div>
          )}

          <DialogFooter className="pt-2 border-t gap-2">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant={decision === "APPROVE" ? "default" : "destructive"}
              size="default"
              disabled={isSubmitting || (decision === "REJECT" && rejectionReason.trim().length < 5)}
            >
              {isSubmitting ? "Menyimpan..." : decision === "APPROVE" ? "Konfirmasi persetujuan" : "Konfirmasi penolakan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
