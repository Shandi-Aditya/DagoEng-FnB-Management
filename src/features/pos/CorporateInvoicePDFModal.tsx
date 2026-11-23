"use client";

import React, { useMemo } from "react";
import { Building2, CheckCircle2, Clock, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  OFFICIAL_BANK_ACCOUNTS,
  OFFICIAL_CS_WHATSAPP_NUMBER,
  OFFICIAL_FINANCE_EMAIL,
  OFFICIAL_HUB_ADDRESS,
  OFFICIAL_HUB_NAME,
} from "@/lib/contact-config";
import { buildOrderReceiptData } from "@/features/orders/orders-domain";
import type { POSReceiptData } from "@/features/pos/types";
import type { OrderRecord } from "@/types/order";

export interface CorporateInvoicePDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: POSReceiptData | OrderRecord | null;
}

export function CorporateInvoicePDFModal({
  isOpen,
  onClose,
  order,
}: CorporateInvoicePDFModalProps) {
  const receiptData: POSReceiptData | null = useMemo(() => {
    if (!order) return null;
    if ("grandTotal" in order) return order as POSReceiptData;
    return buildOrderReceiptData(order);
  }, [order]);

  if (!isOpen || !receiptData) return null;

  const corporate = receiptData.corporateInfo;
  const isPaid = receiptData.paymentMethod !== "INVOICE";
  const rawInvoice = corporate?.invoiceNumber || receiptData.orderNumber;
  const invoiceNumber = rawInvoice.startsWith("INV-") ? rawInvoice : `INV-${rawInvoice}`;

  const issueDate = receiptData.date || new Date().toLocaleDateString("id-ID", {
    timeZone: "Asia/Makassar",
    dateStyle: "medium",
  });

  const dueDate =
    corporate?.invoiceDueDate ||
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString("id-ID", {
      dateStyle: "long",
      timeZone: "Asia/Makassar",
    });

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 border border-border shadow-2xl print:max-h-none print:overflow-visible print:static print:w-full print:shadow-none print:border-none print:p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Invoice Perusahaan {invoiceNumber}</DialogTitle>
          <DialogDescription>Faktur tagihan resmi perusahaan Dago Creative Hub</DialogDescription>
        </DialogHeader>

        {/* Global Print Isolation CSS */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #printable-corporate-invoice, #printable-corporate-invoice * {
                  visibility: visible !important;
                }
                #printable-corporate-invoice {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 24px !important;
                }
              }
            `,
          }}
        />

        {/* Action Header (Hidden during print) */}
        <div className="flex items-center justify-between border-b bg-muted/40 px-6 py-3.5 print:hidden">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground">
              Invoice Tagihan Resmi — {corporate?.companyName || "Perusahaan"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="size-3.5" />
              <span>Cetak / Simpan PDF</span>
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Tutup invoice">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Printable Invoice Document Container */}
        <div
          id="printable-corporate-invoice"
          className="p-8 bg-card text-card-foreground font-sans leading-relaxed text-xs print:p-0 print:m-0 print:text-black"
        >
          {/* Header & Logo */}
          <div className="flex justify-between items-start border-b border-border pb-6 mb-6">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {OFFICIAL_HUB_NAME}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                Coworking, Meeting Space & Curated F&B Multi-Tenant
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {OFFICIAL_HUB_ADDRESS}
              </p>
              <p className="text-xs text-muted-foreground">
                WhatsApp Hotline: {OFFICIAL_CS_WHATSAPP_NUMBER} · Email: {OFFICIAL_FINANCE_EMAIL}
              </p>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20">
                Faktur Korporat
              </div>
              <p className="font-mono text-sm font-semibold text-foreground mt-2">{invoiceNumber}</p>
              <p className="text-xs text-muted-foreground">Order Ref: #{receiptData.orderNumber}</p>
            </div>
          </div>

          {/* Meta & Billed To Section */}
          <div className="grid grid-cols-2 gap-6 bg-muted/20 p-4 rounded-lg border border-border/60 mb-6">
            <div>
              <span className="text-xs font-semibold text-muted-foreground block mb-1">
                Ditujukan Kepada (Billed To):
              </span>
              <p className="text-sm font-semibold text-foreground">
                {corporate?.companyName || "Perusahaan Rekanan"}
              </p>
              <p className="text-xs text-foreground font-medium mt-0.5">
                U.P. / PIC: {corporate?.picName || "Penanggung Jawab Tim"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kontak PIC: {corporate?.picPhone || "-"}
              </p>
              {corporate?.headcount ? (
                <p className="text-xs text-muted-foreground">
                  Jumlah Peserta: {corporate.headcount} Orang
                </p>
              ) : null}
            </div>

            <div className="text-right">
              <span className="text-xs font-semibold text-muted-foreground block mb-1">
                Informasi Termin & Status:
              </span>
              <div className="space-y-1 text-xs">
                <p>
                  <span className="text-muted-foreground">Tanggal Terbit: </span>
                  <span className="font-semibold text-foreground">{issueDate}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Jatuh Tempo: </span>
                  <span className="font-semibold text-foreground">{dueDate}</span>
                </p>
                <p className="flex items-center justify-end gap-1.5 pt-0.5">
                  <span className="text-muted-foreground">Status Pembayaran: </span>
                  <span
                    className={`font-semibold inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${
                      isPaid
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {isPaid ? (
                      <>
                        <CheckCircle2 className="size-3" /> Lunas
                      </>
                    ) : (
                      <>
                        <Clock className="size-3" /> Tagihan Bertempo (14 Hari)
                      </>
                    )}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Table of Items */}
          <div className="border border-border rounded-lg overflow-hidden mb-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground">
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3">Layanan / Konsumsi</th>
                  <th className="py-2.5 px-3 w-32">Tenant / Unit</th>
                  <th className="py-2.5 px-3 w-16 text-center">Qty</th>
                  <th className="py-2.5 px-3 w-28 text-right">Harga Satuan</th>
                  <th className="py-2.5 px-3 w-32 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {receiptData.items.map((item, idx) => {
                  const unitPrice = item.unitPrice;
                  const itemSubtotal = item.subtotal ?? unitPrice * item.quantity;
                  const tenantLabel = item.tenantName || item.tenantId || "Dago Creative Hub";

                  return (
                    <tr key={idx} className="hover:bg-muted/10">
                      <td className="py-2 px-3 text-center text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <span className="font-semibold text-foreground block">
                          {item.name}
                        </span>
                        {item.notes ? (
                          <span className="text-xs text-muted-foreground block">{item.notes}</span>
                        ) : null}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">{tenantLabel}</td>
                      <td className="py-2 px-3 text-center font-medium tabular-nums">{item.quantity}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                        {formatCurrencyIDR(unitPrice)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold tabular-nums text-foreground">
                        {formatCurrencyIDR(itemSubtotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Financial Calculation Breakdown */}
          <div className="flex justify-end mb-8">
            <div className="w-72 space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatCurrencyIDR(receiptData.subtotal)}
                </span>
              </div>
              {receiptData.discount && receiptData.discount > 0 ? (
                <div className="flex justify-between text-muted-foreground font-medium">
                  <span>Potongan / Diskon:</span>
                  <span className="tabular-nums">- {formatCurrencyIDR(receiptData.discount)}</span>
                </div>
              ) : null}
              {receiptData.tax && receiptData.tax > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>Pajak Restoran & Daerah (PB1 10%):</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatCurrencyIDR(receiptData.tax)}
                  </span>
                </div>
              ) : null}
              {receiptData.serviceCharge && receiptData.serviceCharge > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>Biaya Layanan (Service Charge):</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatCurrencyIDR(receiptData.serviceCharge)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold text-foreground">
                <span>Total Tagihan:</span>
                <span className="tabular-nums text-primary text-base">
                  {formatCurrencyIDR(receiptData.grandTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Banking Instructions & Signatures */}
          <div className="grid grid-cols-2 gap-8 border-t border-border pt-6">
            <div className="space-y-2 text-xs">
              <span className="font-semibold text-foreground block">Instruksi Pembayaran Rekening Resmi:</span>
              <div className="rounded border bg-muted/20 p-3 space-y-2 text-xs">
                {OFFICIAL_BANK_ACCOUNTS.map((bank, bIdx) => (
                  <div key={bank.bankName} className={bIdx > 0 ? "border-t border-border/60 pt-1.5" : ""}>
                    <p className="font-semibold text-foreground">{bank.bankName}</p>
                    <p className="text-muted-foreground font-mono">No. Rekening: {bank.accountNumber}</p>
                    <p className="text-muted-foreground">Atas Nama: {bank.accountHolder}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground italic">
                * Harap cantumkan nomor invoice <strong>{invoiceNumber}</strong> pada berita transfer dan konfirmasi ke WhatsApp Hotline Dago Creative Hub.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center text-xs">
              <div className="flex flex-col justify-between h-32 border-b pb-2">
                <span className="text-muted-foreground text-xs">Penerima / Klien</span>
                <div className="mt-auto">
                  <p className="font-semibold text-foreground">{corporate?.picName || "PIC Perusahaan"}</p>
                  <p className="text-xs text-muted-foreground">{corporate?.companyName || "Instansi"}</p>
                </div>
              </div>

              <div className="flex flex-col justify-between h-32 border-b pb-2">
                <span className="text-muted-foreground text-xs">{OFFICIAL_HUB_NAME}</span>
                <div className="mt-auto">
                  <p className="font-semibold text-foreground">Finance & Accounting</p>
                  <p className="text-xs text-muted-foreground">Singaraja, Bali</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CorporateInvoicePDFModal;
