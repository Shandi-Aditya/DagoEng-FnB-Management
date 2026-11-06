"use client";

import React, { useState } from "react";
import { KitchenTicketData, PrintPurpose } from "@/types/printer";
import { usePrinter } from "@/contexts/PrinterContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  UtensilsCrossed,
  Printer,
  RotateCcw,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Hash,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface KitchenOrderReceiptModalProps {
  isOpen: boolean;
  ticketData: KitchenTicketData | null;
  onClose: () => void;
  onPrintSuccess?: () => void;
}

export function KitchenOrderReceiptModal({
  isOpen,
  ticketData,
  onClose,
  onPrintSuccess,
}: KitchenOrderReceiptModalProps) {
  const { user } = useAuth();
  const { activeKitchenPrinter, printKitchenOrder, settings } = usePrinter();
  const [isPrinting, setIsPrinting] = useState(false);
  const [printFeedback, setPrintFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  if (!isOpen || !ticketData) return null;

  const currentPurpose = ticketData.purpose || "NEW_ORDER";

  const getPurposeBadge = (purpose: PrintPurpose, seq?: number) => {
    switch (purpose) {
      case "ADDITIONAL_ORDER":
        return {
          title: `PESANAN TAMBAHAN #${seq || 1}`,
          bg: "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700",
        };
      case "REPRINT":
        return {
          title: "SALINAN / REPRINT",
          bg: "bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700",
        };
      case "CANCELLATION":
        return {
          title: "PEMBATALAN PESANAN",
          bg: "bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-700",
        };
      default:
        return {
          title: "NOTA PESANAN DAPUR",
          bg: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700",
        };
    }
  };

  const badge = getPurposeBadge(currentPurpose, ticketData.sequenceNumber);

  const handlePrint = async (isReprint = false) => {
    setIsPrinting(true);
    setPrintFeedback(null);
    try {
      const purposeToUse: PrintPurpose = isReprint ? "REPRINT" : currentPurpose;
      const res = await printKitchenOrder(ticketData, purposeToUse, {
        isManualReprint: isReprint,
        reprintedBy: isReprint ? user?.name || "Kasir" : undefined,
      });

      if (res.success) {
        setPrintFeedback({
          type: "success",
          text: res.message,
        });
        if (onPrintSuccess) onPrintSuccess();
      } else {
        setPrintFeedback({
          type: "error",
          text: res.message,
        });
      }
    } catch (err: any) {
      setPrintFeedback({
        type: "error",
        text: err?.message || "Gagal memproses pencetakan nota dapur.",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                Nota Pesanan Dapur
              </h3>
              <p className="text-[10px] text-slate-400">
                Pratinjau fisik tiket dapur (Thermal {activeKitchenPrinter?.paperWidth || "80mm"})
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Feedback Banner if any */}
        {printFeedback && (
          <div
            className={`px-4 py-2.5 text-xs font-semibold flex items-center space-x-2 border-b ${
              printFeedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
            }`}
          >
            {printFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="flex-1">{printFeedback.text}</span>
          </div>
        )}

        {/* Physical Thermal Ticket Preview */}
        <div className="overflow-y-auto p-4 bg-slate-100 dark:bg-slate-950/80 flex justify-center">
          <div className="w-full max-w-[340px] bg-white text-slate-950 p-5 rounded-lg shadow-sm border border-slate-200 font-mono text-xs space-y-3">
            {/* Header Nota */}
            <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
              <p className="font-black text-sm tracking-wider uppercase">DagoEng F&B</p>
              <p className="text-[10px] text-slate-600 uppercase font-semibold">
                {ticketData.outletName || "Outlet Singaraja"}
              </p>
              <div
                className={`inline-block my-1 px-3 py-1 rounded-md border font-black text-xs uppercase tracking-wider ${badge.bg}`}
              >
                {badge.title}
              </div>
            </div>

            {/* Order Details */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2.5">
              <div className="flex justify-between">
                <span className="text-slate-500">No. Pesanan:</span>
                <span className="font-black">{ticketData.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Waktu:</span>
                <span>{ticketData.timestamp}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500">Nomor Meja:</span>
                <span className="font-black text-sm px-1.5 py-0.5 bg-slate-100 rounded border border-slate-300">
                  {ticketData.tableNumber || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tipe Pesanan:</span>
                <span className="font-bold">{ticketData.orderType.replace("_", " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Pelanggan:</span>
                <span className="font-semibold">{ticketData.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kasir / Petugas:</span>
                <span>{ticketData.cashierName}</span>
              </div>
              {ticketData.reprintedBy && (
                <div className="flex justify-between text-purple-700 font-bold text-[10px] pt-1">
                  <span>Dicetak Ulang Oleh:</span>
                  <span>{ticketData.reprintedBy}</span>
                </div>
              )}
            </div>

            {/* Items List (Strictly NO prices, NO subtotals, NO totals) */}
            <div className="space-y-2 border-b border-dashed border-slate-300 pb-3">
              <p className="font-bold text-[10px] text-slate-500 uppercase tracking-wider">
                Menu Yang Perlu Dimasak / Disiapkan:
              </p>
              {ticketData.items && ticketData.items.length > 0 ? (
                ticketData.items.map((item, idx) => (
                  <div key={item.id || idx} className="space-y-0.5">
                    <div className="flex items-baseline space-x-1.5 font-black text-xs text-slate-900">
                      <span className="text-sm bg-slate-100 px-1 rounded">{item.quantity}x</span>
                      <span className="uppercase">{item.productName}</span>
                    </div>

                    {item.variantName && (
                      <p className="text-[10px] text-slate-600 pl-6">
                        • Varian: <strong>{item.variantName}</strong>
                      </p>
                    )}

                    {item.modifiers && item.modifiers.length > 0 && (
                      <p className="text-[10px] text-slate-600 pl-6">
                        • Tambahan: <strong>{item.modifiers.join(", ")}</strong>
                      </p>
                    )}

                    {item.notes && item.notes.trim() && (
                      <p className="text-[10px] text-amber-900 bg-amber-50 p-1 rounded font-bold pl-2 border-l-2 border-amber-500 mt-0.5">
                        *Catatan: {item.notes.trim()}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-slate-400 italic text-[11px]">(Tidak ada item pesanan)</p>
              )}
            </div>

            {/* Kitchen Instructions / Footer */}
            <div className="text-center pt-1 text-[11px] font-black uppercase text-slate-700 tracking-wider">
              {settings.kitchenFooterNote || "MOHON DIPROSES"}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-850 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="text-[10px] text-slate-400 w-full sm:w-auto text-center sm:text-left">
            <span>Printer Dapur: </span>
            <strong className="text-slate-600 dark:text-slate-300">
              {activeKitchenPrinter?.name || "Printer Dapur Thermal (Default)"}
            </strong>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            {currentPurpose !== "REPRINT" ? (
              <Button
                type="button"
                disabled={isPrinting}
                onClick={() => handlePrint(false)}
                className="flex-1 sm:flex-none text-xs font-bold space-x-1.5 bg-[#3B7A57] hover:bg-[#2E6044] text-white shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 mr-1" />
                <span>{isPrinting ? "Mengirim..." : "Cetak Tiket Dapur"}</span>
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              disabled={isPrinting}
              onClick={() => handlePrint(true)}
              className="flex-1 sm:flex-none text-xs font-bold space-x-1.5 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Cetak Salinan dengan penanda REPRINT"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              <span>Cetak Salinan (Reprint)</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Tutup
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

