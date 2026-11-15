"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Download, Layers, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TicketActionsBarProps {
  eventId: string;
  totalTickets: number;
  activeIndex: number;
  activeTicketCode: string;
  downloading: boolean;
  onDownloadActive: () => void;
  onDownloadAll: () => void;
  isPaidOrFree: boolean;
}

export function TicketActionsBar({
  eventId,
  totalTickets,
  activeIndex,
  activeTicketCode,
  downloading,
  onDownloadActive,
  onDownloadAll,
  isPaidOrFree,
}: TicketActionsBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {isPaidOrFree ? (
            <span>
              Simpan tiket ke galeri untuk kemudahan registrasi offline tanpa koneksi internet.
            </span>
          ) : (
            <span>
              Selesaikan instruksi pembayaran di atas agar QR tiket aktif untuk check-in.
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <Button
          type="button"
          size="lg"
          className="w-full sm:flex-1 py-3 sm:py-2.5 font-medium"
          disabled={downloading}
          onClick={onDownloadActive}
        >
          {downloading ? (
            <>
              <Loader2 className="animate-spin" />
              Menyiapkan tiket...
            </>
          ) : (
            <>
              <Download />
              Unduh tiket {totalTickets > 1 ? `#${activeIndex + 1}` : ""} (PNG)
            </>
          )}
        </Button>

        {totalTickets > 1 && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full sm:w-auto py-3 sm:py-2.5 font-medium"
            disabled={downloading}
            onClick={onDownloadAll}
          >
            <Layers />
            Unduh semua tiket ({totalTickets})
          </Button>
        )}

        <Button
          variant="outline"
          size="lg"
          className="w-full sm:w-auto py-3 sm:py-2.5 font-medium"
          render={<Link href={`/events/${eventId}`} />}
          nativeButton={false}
        >
          <ArrowLeft />
          Kembali ke event
        </Button>
      </div>
    </div>
  );
}
