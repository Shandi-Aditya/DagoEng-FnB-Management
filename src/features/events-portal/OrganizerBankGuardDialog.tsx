"use client";

import React from "react";
import { Landmark, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface OrganizerBankGuardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingBankErrors: Array<{ field: string; message: string }>;
  onGoToBankSettings: () => void;
}

export function OrganizerBankGuardDialog({
  open,
  onOpenChange,
  missingBankErrors,
  onGoToBankSettings,
}: OrganizerBankGuardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader className="space-y-2">
          <div className="size-10 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
            <Landmark className="size-5" />
          </div>
          <DialogTitle className="text-base font-medium">
            Lengkapi data rekening terlebih dahulu
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Untuk keamanan dan kelancaran pencairan bagi hasil tiket (payout), Anda wajib melengkapi data rekening bank penampung pada pengaturan akun.
          </DialogDescription>
        </DialogHeader>

        {missingBankErrors.length > 0 && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs space-y-1.5">
            <span className="font-medium text-warning block">
              Data rekening yang belum lengkap:
            </span>
            <ul className="space-y-1 text-muted-foreground list-disc list-inside">
              {missingBankErrors.map((err, idx) => (
                <li key={idx}>
                  <span className="font-medium text-foreground">
                    {err.field === "bankName"
                      ? "Nama bank"
                      : err.field === "accountNumber"
                      ? "Nomor rekening"
                      : err.field === "accountHolder"
                      ? "Nama pemilik"
                      : err.field}
                  </span>
                  : {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onGoToBankSettings}
          >
            <span>Ke pengaturan rekening</span>
            <ArrowRight />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
