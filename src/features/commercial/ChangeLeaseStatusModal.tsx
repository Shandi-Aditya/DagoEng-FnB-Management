"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import type { CommercialLease, LeaseStatus } from "@/types/commercial";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";

export interface ChangeLeaseStatusModalProps {
  lease: CommercialLease | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: {
    leaseId: string;
    newStatus: LeaseStatus;
    reason: string;
  }) => void;
}

export function ChangeLeaseStatusModal({
  lease,
  isOpen,
  onClose,
  onSubmit,
}: ChangeLeaseStatusModalProps) {
  const [status, setStatus] = useState<LeaseStatus>("ACTIVE");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (lease) {
      setStatus(lease.status);
      setReason("");
    }
  }, [lease]);

  if (!lease) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    onSubmit({
      leaseId: lease.id,
      newStatus: status,
      reason: reason.trim(),
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <AlertCircle className="size-4 text-warning" />
            <span>Ubah status kontrak</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Memperbarui status sewa tenant {lease.tenantName} ({lease.unitCode}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="space-y-1.5">
            <Label htmlFor="new-status" className="text-xs font-medium text-foreground">
              Pilih status baru <span className="text-destructive">*</span>
            </Label>
            <NativeSelect
              id="new-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as LeaseStatus)}
              className="w-full text-xs"
            >
              <option value="ACTIVE">Aktif</option>
              <option value="EXPIRING_SOON">Segera berakhir</option>
              <option value="EXPIRED">Berakhir</option>
              <option value="TERMINATED">Diakhiri</option>
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status-reason" className="text-xs font-medium text-foreground">
              Alasan perubahan status <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="status-reason"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Misalnya masa sewa berakhir dan tidak diperpanjang"
              className="text-xs"
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
              Simpan perubahan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
