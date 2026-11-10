"use client";

import React from "react";
import Image from "next/image";
import { formatCurrencyIDR } from "@/lib/utils";
import { X, Printer, CheckCircle2, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";

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

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
          {/* Modal Header */}
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 print:hidden">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="font-bold text-xs text-slate-800">
                Bukti Booking Co-working & Transaksi Lunas
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Receipt Body */}
          <div className="p-6 overflow-y-auto flex-1 bg-slate-100/50 flex justify-center">
            <div
              id="coworking-thermal-receipt"
              className="w-full max-w-[340px] bg-white p-5 rounded-lg shadow-sm border border-slate-200 font-mono text-slate-900 text-xs space-y-4 print:w-full print:shadow-none print:border-none"
            >
              {/* Brand & Outlet Header */}
              <div className="text-center space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                <div className="w-8 h-10 relative mx-auto mb-1">
                  <Image
                    src="/logo-dago.png"
                    alt="Dago Logo"
                    width={32}
                    height={40}
                    className="object-contain mx-auto"
                  />
                </div>
                <h2 className="font-black text-sm tracking-wider uppercase text-slate-900">
                  DAGO CREATIVE HUB
                </h2>
                <p className="font-bold text-[11px] text-blue-700 uppercase tracking-wide">
                  CO-WORKING & MEETING SPACES
                </p>
                <p className="font-bold text-xs text-slate-700">
                  Outlet: {receiptData.outletName}
                </p>
                {receiptData.outletAddress && (
                  <p className="text-[10px] text-slate-500 leading-tight">
                    {receiptData.outletAddress}
                  </p>
                )}
                {receiptData.outletPhone && (
                  <p className="text-[10px] text-slate-500">Telp: {receiptData.outletPhone}</p>
                )}
              </div>

              {/* Booking Transaction Meta */}
              <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>No. Booking:</span>
                  <span className="font-bold text-blue-700">{receiptData.bookingCode}</span>
                </div>
                <div className="flex justify-between">
                  <span>Waktu Transaksi:</span>
                  <span>{receiptData.transactionDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tamu / Customer:</span>
                  <span className="font-bold">{receiptData.guestName}</span>
                </div>
                {receiptData.guestPhone && (
                  <div className="flex justify-between">
                    <span>No. Kontak:</span>
                    <span>{receiptData.guestPhone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Tipe Penggunaan:</span>
                  <span className="font-bold">
                    {receiptData.company && receiptData.company !== "Personal" && receiptData.company !== "Member Dago"
                      ? `Group / Company (${receiptData.company})`
                      : "Personal"}
                  </span>
                </div>
              </div>

              {/* Workspace Booking Details */}
              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span className="flex items-center space-x-1">
                    <Laptop className="w-3.5 h-3.5 text-blue-600 inline mr-1" />
                    <span>{receiptData.spaceName}</span>
                  </span>
                  <span>{receiptData.spaceType}</span>
                </div>

                <div className="text-[11px] bg-slate-50 p-2 rounded border border-slate-100 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tanggal Sesi:</span>
                    <span className="font-bold text-slate-800">
                      {receiptData.endDate && receiptData.endDate !== receiptData.bookingDate
                        ? `${receiptData.bookingDate} s/d ${receiptData.endDate}`
                        : receiptData.bookingDate}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Waktu / Jam:</span>
                    <span className="font-bold text-slate-800">
                      {receiptData.startTime} — {receiptData.endTime} WITA
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Durasi:</span>
                    <span className="font-bold text-slate-800">
                      {receiptData.duration} {receiptData.bookingType === "HOURLY" ? "Jam" : "Hari"}
                    </span>
                  </div>
                </div>

                {receiptData.notes && (
                  <p className="text-[10px] italic text-slate-500 pt-0.5">
                    *Catatan: {receiptData.notes}
                  </p>
                )}
              </div>

              {/* Price & Financial Breakdown */}
              <div className="space-y-1 text-xs border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>Tarif Sewa Ruang:</span>
                  <span>{formatCurrencyIDR(receiptData.basePrice)}</span>
                </div>

                {receiptData.discount !== undefined && receiptData.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>
                      Diskon {receiptData.promoTitle ? `(${receiptData.promoTitle})` : ""}:
                    </span>
                    <span>-{formatCurrencyIDR(receiptData.discount)}</span>
                  </div>
                )}

                {receiptData.tax !== undefined && receiptData.tax > 0 && (
                  <div className="flex justify-between">
                    <span>Pajak (PB1):</span>
                    <span>{formatCurrencyIDR(receiptData.tax)}</span>
                  </div>
                )}

                {receiptData.serviceCharge !== undefined && receiptData.serviceCharge > 0 && (
                  <div className="flex justify-between">
                    <span>Service Charge:</span>
                    <span>{formatCurrencyIDR(receiptData.serviceCharge)}</span>
                  </div>
                )}

                <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-200">
                  <span>TOTAL BIAYA:</span>
                  <span>{formatCurrencyIDR(receiptData.totalAmount)}</span>
                </div>
              </div>

              {/* Payment Status */}
              <div className="space-y-1 text-xs border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>Metode Pembayaran:</span>
                  <span className="font-bold">{receiptData.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status Pembayaran:</span>
                  <span className="font-bold text-emerald-600 uppercase">
                    {receiptData.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Amenities & Footer */}
              <div className="text-center text-[10px] text-slate-500 space-y-1 pt-1">
                <p className="font-bold text-slate-700">Fasilitas Termasuk:</p>
                <p>High-Speed Wi-Fi • Free Flow Mineral Water • Power Outlet</p>
                <p>Wi-Fi: DagoCoworking • Pass: dagospace2026</p>
                <p className="text-[9px] text-slate-400 pt-1">
                  Powered by DagoEng Co-Working Management
                </p>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              className="flex-1 text-xs font-bold space-x-1.5"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Cetak Nota Thermal</span>
            </Button>

            <Button
              type="button"
              onClick={onClose}
              className="flex-1 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white"
            >
              <span>Tutup</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
