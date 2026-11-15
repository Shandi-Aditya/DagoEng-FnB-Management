"use client";

import React from "react";
import Image from "next/image";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TicketPaymentProofDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
}

export function TicketPaymentProofDialog({
  open,
  onOpenChange,
  imageUrl,
}: TicketPaymentProofDialogProps) {
  if (!imageUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-6 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Bukti transfer terkirim</DialogTitle>
        </DialogHeader>

        <div className="relative mt-2 flex max-h-[70vh] min-h-[250px] items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
          <Image
            src={imageUrl}
            alt="Bukti pembayaran"
            width={600}
            height={800}
            unoptimized
            className="max-h-[65vh] w-auto rounded object-contain"
          />
        </div>

        <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
          <Button
            variant="outline"
            size="lg"
            render={<a href={imageUrl} target="_blank" rel="noopener noreferrer" download="bukti-transfer.png" />}
            nativeButton={false}
          >
            <Download />
            Buka ukuran asli
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
