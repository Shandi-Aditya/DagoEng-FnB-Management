"use client";

import React from "react";
import Image from "next/image";
import { formatCurrencyIDR } from "@/lib/utils";
import { X, Printer, CheckCircle2, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface CoworkingReceiptData {
  bookingCode: string;
  transactionDate: string;
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  company?: string;
  spaceName: string;
  spaceType: string;
  outletName: string;
  outletAddress?: string;
  outletPhone?: string;
  bookingDate: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  duration: number;
  bookingType: "HOURLY" | "DAILY" | "MONTHLY" | string;
  basePrice: number;
  discount?: number;
  promoTitle?: string;
  tax?: number;
  taxType?: "PB1" | "PPN" | "NON_TAX" | string;
  taxRatePercent?: number;
  serviceCharge?: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  notes?: string;
}

interface CoworkingReceiptModalProps {
  isOpen?: boolean;
  receiptData?: CoworkingReceiptData | null;
  booking?: CoworkingReceiptData | null;
  onClose: () => void;
}

export function CoworkingReceiptModal({
  isOpen = true,
  receiptData: rawReceiptData,
  booking,
  onClose,
}: CoworkingReceiptModalProps) {
  const receiptData = rawReceiptData || booking;
  if (!isOpen || !receiptData) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          html,
          body {
            background: #ffffff !important;
            height: auto !important;
            overflow: visible !important;
          }
          body * {
            visibility: hidden !important;
          }
          #coworking-thermal-receipt,
          #coworking-thermal-receipt * {
            visibility: visible !important;
          }
          #coworking-thermal-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 8px !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md gap-0 p-0 overflow-hidden flex flex-col max-h-[90vh]">
          {/* Modal Header */}
          <DialogHeader className="px-5 py-3 border-b border-border flex flex-row items-center justify-between bg-muted/40 print:hidden">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" />
              <DialogTitle className="text-xs font-medium text-foreground">
                Bukti booking co-working dan transaksi lunas
              </DialogTitle>
              <DialogDescription className="sr-only">
                Nota pembayaran sewa ruang co-working
              </DialogDescription>
            </div>
          </DialogHeader>

          {/* Scrollable Receipt Body */}
          <div className="p-6 overflow-y-auto flex-1 bg-muted/30 flex justify-center">
            <div
              id="coworking-thermal-receipt"
              className="w-full max-w-[340px] bg-card p-5 rounded-lg border border-border font-mono text-foreground text-xs space-y-4 print:w-full print:shadow-none print:border-none"
            >
              {/* Brand & Outlet Header */}
              <div className="text-center space-y-1.5 border-b border-dashed border-border pb-3">
                <div className="w-8 h-10 relative mx-auto mb-1">
                  <Image
                    src="/logo-dago.png"
                    alt="Dago Logo"
                    width={32}
                    height={40}
                    className="object-contain mx-auto"
                  />
                </div>
                <h2 className="font-semibold text-sm text-foreground">
                  Dago Creative Hub
                </h2>
                <p className="font-medium text-xs text-primary">
                  Ruang kerja dan meeting
                </p>
                <p className="text-xs text-muted-foreground">
                  Outlet: {receiptData.outletName}
                </p>
                {receiptData.outletAddress && (
                  <p className="text-xs text-muted-foreground leading-tight">
                    {receiptData.outletAddress}
                  </p>
                )}
                {receiptData.outletPhone && (
                  <p className="text-xs text-muted-foreground">Telp: {receiptData.outletPhone}</p>
                )}
              </div>

              {/* Booking Transaction Meta */}
              <div className="text-xs space-y-1 border-b border-dashed border-border pb-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No. booking:</span>
                  <span className="font-medium text-primary">{receiptData.bookingCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Waktu transaksi:</span>
                  <span>{receiptData.transactionDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tamu:</span>
                  <span className="font-medium">{receiptData.guestName}</span>
                </div>
                {receiptData.guestPhone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">No. kontak:</span>
                    <span>{receiptData.guestPhone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipe penggunaan:</span>
                  <span className="font-medium">
                    {receiptData.company && receiptData.company !== "Personal" && receiptData.company !== "Member Dago"
                      ? `Perusahaan (${receiptData.company})`
                      : "Personal"}
                  </span>
                </div>
              </div>

              {/* Workspace Booking Details */}
              <div className="space-y-1.5 border-b border-dashed border-border pb-3 text-xs">
                <div className="flex items-center justify-between font-medium text-foreground">
                  <span className="flex items-center space-x-1">
                    <Laptop className="size-3.5 text-primary inline mr-1" />
                    <span>{receiptData.spaceName}</span>
                  </span>
                  <span className="text-muted-foreground">{receiptData.spaceType}</span>
                </div>

                <div className="text-xs bg-muted/40 p-2.5 rounded-lg border border-border space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tanggal sesi:</span>
                    <span className="font-medium text-foreground">
                      {receiptData.endDate && receiptData.endDate !== receiptData.bookingDate
                        ? `${receiptData.bookingDate} s/d ${receiptData.endDate}`
                        : receiptData.bookingDate}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Waktu:</span>
                    <span className="font-medium text-foreground">
                      {receiptData.startTime} s/d {receiptData.endTime} WITA
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total durasi:</span>
                    <span className="font-medium text-foreground">
                      {receiptData.duration} {receiptData.bookingType === "HOURLY" ? "jam" : "hari"}
                    </span>
                  </div>
                </div>

                {receiptData.notes && (
                  <p className="text-xs italic text-muted-foreground pt-0.5">
                    *Catatan: {receiptData.notes}
                  </p>
                )}
              </div>

              {/* Price & Financial Breakdown */}
              <div className="space-y-1 text-xs border-b border-dashed border-border pb-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tarif sewa ruang:</span>
                  <span className="tabular-nums">{formatCurrencyIDR(receiptData.basePrice)}</span>
                </div>

                {receiptData.discount !== undefined && receiptData.discount > 0 && (
                  <div className="flex justify-between text-success font-medium">
                    <span>
                      Diskon {receiptData.promoTitle ? `(${receiptData.promoTitle})` : ""}:
                    </span>
                    <span className="tabular-nums">-{formatCurrencyIDR(receiptData.discount)}</span>
                  </div>
                )}

                {receiptData.tax !== undefined && receiptData.tax > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Pajak ({receiptData.taxType || "PPN"}
                      {receiptData.taxRatePercent !== undefined ? ` ${receiptData.taxRatePercent}%` : ""}):
                    </span>
                    <span className="tabular-nums">{formatCurrencyIDR(receiptData.tax)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Pajak (bebas PB1 / non-pajak):</span>
                    <span className="tabular-nums">Rp 0</span>
                  </div>
                )}

                {receiptData.serviceCharge !== undefined && receiptData.serviceCharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Biaya layanan:</span>
                    <span className="tabular-nums">{formatCurrencyIDR(receiptData.serviceCharge)}</span>
                  </div>
                )}

                <div className="flex justify-between font-semibold text-sm pt-1 border-t border-border text-foreground">
                  <span>Total biaya:</span>
                  <span className="tabular-nums">{formatCurrencyIDR(receiptData.totalAmount)}</span>
                </div>
              </div>

              {/* Payment Status */}
              <div className="space-y-1 text-xs border-b border-dashed border-border pb-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Metode pembayaran:</span>
                  <span className="font-medium text-foreground">{receiptData.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status pembayaran:</span>
                  <span className="font-medium text-success">
                    {receiptData.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Amenities & Footer */}
              <div className="text-center text-xs text-muted-foreground space-y-1 pt-1">
                <p className="font-medium text-foreground">Fasilitas termasuk:</p>
                <p>Koneksi internet cepat &bull; Air mineral &bull; Stopkontak</p>
                <p className="text-xs text-muted-foreground/70 pt-1">
                  Dago Creative Hub Co-Working
                </p>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="p-4 border-t border-border bg-card flex items-center justify-between gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="flex-1"
            >
              <Printer className="size-4" />
              <span>Cetak nota thermal</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={onClose}
              className="flex-1"
            >
              <span>Tutup</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
