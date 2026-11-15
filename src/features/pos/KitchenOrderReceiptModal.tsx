"use client";

import React, { useState } from "react";
import type { KitchenTicketData, PrintPurpose } from "@/types/printer";
import { usePrinter } from "@/contexts/PrinterContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  UtensilsCrossed,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/app";
import { formatKitchenTicketPurpose, formatReceiptOrderType } from "@/features/pos/pos-receipt";

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
  const purposeMeta = formatKitchenTicketPurpose(currentPurpose, ticketData.sequenceNumber);

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memproses pencetakan nota dapur.";
      setPrintFeedback({
        type: "error",
        text: message,
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <DialogHeader className="px-5 py-3 border-b border-border flex flex-row items-center justify-between bg-muted/40 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UtensilsCrossed className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-xs font-medium text-foreground">
                Nota pesanan dapur
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Pratinjau fisik tiket dapur (Thermal {activeKitchenPrinter?.paperWidth || "80mm"})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Feedback Banner if any */}
        {printFeedback && (
          <div
            className={`px-4 py-2 text-xs flex items-center gap-2 border-b print:hidden ${
              printFeedback.type === "success"
                ? "bg-muted text-foreground border-border"
                : "bg-destructive/10 text-destructive border-destructive/20"
            }`}
          >
            {printFeedback.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0 text-primary" />
            ) : (
              <AlertTriangle className="size-4 shrink-0 text-destructive" />
            )}
            <span className="flex-1">{printFeedback.text}</span>
          </div>
        )}

        {/* Physical Thermal Ticket Preview */}
        <div className="overflow-y-auto overflow-x-hidden p-4 sm:p-5 bg-muted/30 flex justify-center flex-1">
          <div
            id="kitchen-thermal-ticket"
            className="w-full max-w-[340px] bg-card text-card-foreground p-5 rounded-lg shadow-xs border border-border font-mono text-xs space-y-3 mb-2 break-words overflow-hidden print:w-full print:shadow-none print:border-none print:bg-white print:text-black"
          >
            {/* Header Nota */}
            <div className="text-center space-y-1 border-b border-dashed border-border pb-3">
              <p className="font-semibold text-sm text-foreground">DagoEng F&B</p>
              <p className="text-xs text-muted-foreground">
                {ticketData.outletName || "Outlet Singaraja"}
              </p>
              <div className="pt-1">
                <StatusBadge status={purposeMeta.tone}>
                  {purposeMeta.title}
                </StatusBadge>
              </div>
            </div>

            {/* Order Details */}
            <div className="space-y-1 border-b border-dashed border-border pb-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">No. pesanan:</span>
                <span className="font-medium text-foreground">{ticketData.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Waktu:</span>
                <span className="text-foreground">{ticketData.timestamp}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-muted-foreground">Nomor meja:</span>
                <span className="font-medium text-xs px-2 py-0.5 bg-muted rounded border border-border text-foreground">
                  {ticketData.tableNumber || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipe pesanan:</span>
                <span className="font-medium text-foreground">
                  {formatReceiptOrderType(ticketData.orderType)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nama pelanggan:</span>
                <span className="text-foreground">{ticketData.customerName || "Tamu"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kasir / petugas:</span>
                <span className="text-foreground">{ticketData.cashierName}</span>
              </div>
              {ticketData.reprintedBy && (
                <div className="flex justify-between text-muted-foreground text-xs pt-1">
                  <span>Dicetak ulang oleh:</span>
                  <span className="font-medium text-foreground">{ticketData.reprintedBy}</span>
                </div>
              )}
            </div>

            {/* Items List (Strictly NO prices, NO subtotals, NO totals) */}
            <div className="space-y-2 border-b border-dashed border-border pb-3">
              <p className="font-medium text-xs text-muted-foreground">
                Menu yang perlu dimasak / disiapkan:
              </p>
              {ticketData.items && ticketData.items.length > 0 ? (
                ticketData.items.map((item, idx) => (
                  <div key={item.id || idx} className="space-y-0.5 text-xs">
                    <div className="flex items-baseline gap-1.5 font-medium text-foreground">
                      <span className="px-1.5 py-0.2 bg-muted rounded text-xs">
                        {item.quantity}x
                      </span>
                      <span>{item.productName}</span>
                    </div>

                    {item.variantName && (
                      <p className="text-xs text-muted-foreground pl-6">
                        • Varian: {item.variantName}
                      </p>
                    )}

                    {item.modifiers && item.modifiers.length > 0 && (
                      <p className="text-xs text-muted-foreground pl-6">
                        • Tambahan: {item.modifiers.join(", ")}
                      </p>
                    )}

                    {item.notes && item.notes.trim() && (
                      <p className="text-xs text-muted-foreground bg-muted/50 p-1.5 rounded pl-2 border-l-2 border-primary mt-0.5">
                        *Catatan: {item.notes.trim()}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground italic text-xs">(Tidak ada item pesanan)</p>
              )}
            </div>

            {/* Order Level Special Notes */}
            {ticketData.kitchenNotes && ticketData.kitchenNotes.trim() && (
              <div className="p-2 bg-muted/40 border border-border rounded text-xs space-y-0.5">
                <span className="font-medium text-foreground block">
                  Catatan khusus pesanan:
                </span>
                <p className="text-muted-foreground">{ticketData.kitchenNotes.trim()}</p>
              </div>
            )}

            {/* Kitchen Instructions / Footer */}
            <div className="text-center pt-1 text-xs font-medium text-muted-foreground">
              {settings.kitchenFooterNote || "Segera diproses"}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-border bg-card space-y-3 print:hidden">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Printer tujuan:</span>
            <span className="font-medium text-foreground">
              {activeKitchenPrinter?.name || "Printer dapur thermal"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {currentPurpose !== "REPRINT" ? (
              <Button
                type="button"
                size="lg"
                disabled={isPrinting}
                onClick={() => handlePrint(false)}
                className="w-full"
              >
                <Printer className="size-4" />
                <span>{isPrinting ? "Mengirim..." : "Cetak tiket"}</span>
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isPrinting}
              onClick={() => handlePrint(true)}
              className={`w-full ${currentPurpose === "REPRINT" ? "col-span-2" : ""}`}
              title="Cetak salinan dengan penanda REPRINT"
            >
              <RotateCcw className="size-4" />
              <span>Cetak salinan</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onClose}
              className="w-full col-span-2"
            >
              <span>Tutup</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
