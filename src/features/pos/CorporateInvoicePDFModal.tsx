"use client";

import React, { useEffect, useMemo, useRef } from "react";
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
import { getTodayWitaDateString } from "@/features/coworking/coworking-domain";
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      });
    }
  }, [isOpen]);

  const receiptData: POSReceiptData | null = useMemo(() => {
    if (!order) return null;
    if ("grandTotal" in order) return order as POSReceiptData;
    return buildOrderReceiptData(order);
  }, [order]);

  if (!isOpen || !receiptData) return null;

  const corporate = receiptData.corporateInfo;
  const isPaid =
    order && "paymentStatus" in order
      ? order.paymentStatus === "PAID"
      : receiptData.paymentStatus === "PAID";
  const isPrepaid = corporate?.billingType === "PREPAID";
  const rawInvoice = corporate?.invoiceNumber || receiptData.orderNumber;
  const invoiceNumber = rawInvoice.startsWith("INV-") ? rawInvoice : `INV-${rawInvoice}`;

  const issueDate =
    receiptData.date ||
    new Date().toLocaleDateString("id-ID", {
      timeZone: "Asia/Makassar",
      dateStyle: "medium",
    });

  const formatIndonesianDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("id-ID", {
      timeZone: "Asia/Makassar",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const dueDate =
    isPaid || isPrepaid
      ? "-"
      : formatIndonesianDate(
          corporate?.invoiceDueDate ||
            getTodayWitaDateString(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))
        );

  const handlePrint = () => {
    const invoiceEl = document.getElementById("printable-corporate-invoice");
    if (!invoiceEl) {
      window.print();
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = "210mm";
    iframe.style.height = "297mm";
    iframe.style.border = "none";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const styles = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
      .map((el) => el.outerHTML)
      .join("\n");

    const htmlClass = document.documentElement.className;

    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="id" class="${htmlClass}">
<head>
  <meta charset="utf-8" />
  <base href="${window.location.origin}/" />
  <title>Invoice Perusahaan - ${invoiceNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,400;0,500;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet" />
  ${styles}
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      box-sizing: border-box !important;
    }
    html, body {
      background: #ffffff !important;
      color: #0f172a !important;
      margin: 0 !important;
      padding: 0 !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      font-family: 'DM Sans', var(--font-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .font-mono, td.font-mono, th.font-mono, [class*="font-mono"] {
      font-family: 'DM Mono', var(--font-dm-mono), ui-monospace, SFMono-Regular, Menlo, monospace !important;
    }
    body > *,
    #printable-corporate-invoice {
      display: block !important;
      visibility: visible !important;
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      box-shadow: none !important;
      background: #ffffff !important;
      break-before: auto !important;
      page-break-before: auto !important;
    }
    .overflow-x-auto {
      overflow: visible !important;
      max-width: 100% !important;
      width: 100% !important;
    }
    table {
      table-layout: fixed !important;
      width: 100% !important;
      border-collapse: collapse !important;
    }
    th, td {
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }
    thead {
      display: table-header-group !important;
    }
    tr {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
  </style>
</head>
<body class="bg-white text-foreground font-sans" style="background: #ffffff !important; padding: 0 !important; margin: 0 !important;">
  ${invoiceEl.outerHTML}
</body>
</html>`);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }
    }, 400);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-full sm:max-w-5xl md:max-w-6xl lg:max-w-7xl max-h-[88vh] h-[88vh] flex flex-col p-0 gap-0 overflow-hidden"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Invoice perusahaan {invoiceNumber}</DialogTitle>
          <DialogDescription>Faktur tagihan resmi perusahaan Dago Creative Hub</DialogDescription>
        </DialogHeader>

        {/* Action Header */}
        <div className="flex items-center justify-between border-b bg-muted/40 px-6 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground">
              Invoice tagihan resmi · {corporate?.companyName || "Perusahaan"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="size-3.5" />
              <span>Cetak dokumen</span>
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Tutup invoice">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-4 sm:p-6 bg-muted/20 flex flex-col items-center min-w-0"
        >
          <div
            id="printable-corporate-invoice"
            className="w-full max-w-5xl min-w-0 p-6 sm:p-8 bg-card text-card-foreground font-sans leading-relaxed text-xs border rounded-lg shadow-xs mx-auto"
          >
            {/* Header & Logo */}
            <div className="flex justify-between items-start border-b border-border pb-6 mb-6">
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {OFFICIAL_HUB_NAME}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                  Ruang kerja, ruang pertemuan, dan F&B multi-mitra
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {OFFICIAL_HUB_ADDRESS}
                </p>
                <p className="text-xs text-muted-foreground">
                  Layanan WhatsApp: {OFFICIAL_CS_WHATSAPP_NUMBER} · Email: {OFFICIAL_FINANCE_EMAIL}
                </p>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20">
                  Faktur korporat
                </div>
                <p className="font-mono text-sm font-semibold text-foreground mt-2">{invoiceNumber}</p>
                <p className="text-xs text-muted-foreground">Referensi pesanan: #{receiptData.orderNumber}</p>
              </div>
            </div>

            {/* Meta & Billed To Section */}
            <div className="grid grid-cols-2 gap-6 bg-muted/20 p-4 rounded-lg border border-border/60 mb-6">
              <div>
                <span className="text-xs font-semibold text-muted-foreground block mb-1">
                  Ditujukan kepada:
                </span>
                <p className="text-sm font-semibold text-foreground">
                  {corporate?.companyName || "Perusahaan rekanan"}
                </p>
                <p className="text-xs text-foreground font-medium mt-0.5">
                  U.P. atau PIC: {corporate?.picName || "Penanggung jawab tim"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Kontak PIC: {corporate?.picPhone || "-"}
                </p>
                {corporate?.headcount ? (
                  <p className="text-xs text-muted-foreground">
                    Jumlah peserta: {corporate.headcount} orang
                  </p>
                ) : null}
              </div>

              <div className="text-right">
                <span className="text-xs font-semibold text-muted-foreground block mb-1">
                  Informasi termin dan status:
                </span>
                <div className="space-y-1 text-xs">
                  <p>
                    <span className="text-muted-foreground">Tanggal terbit: </span>
                    <span className="font-semibold text-foreground">{issueDate}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Jatuh tempo: </span>
                    <span className="font-semibold text-foreground">{dueDate}</span>
                  </p>
                  <p className="flex items-center justify-end gap-1.5 pt-0.5">
                    <span className="text-muted-foreground">Status pembayaran: </span>
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
                          <Clock className="size-3" /> {isPrepaid ? "Belum dibayar" : "Belum dibayar (tempo 14 hari)"}
                        </>
                      )}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Table of Items */}
            <div className="border border-border rounded-lg overflow-x-auto w-full mb-6">
              <table className="w-full table-fixed min-w-[760px] sm:min-w-0 text-left border-collapse">
                <colgroup>
                  <col className="w-[6%]" />
                  <col className="w-[42%]" />
                  <col className="w-[20%]" />
                  <col className="w-[8%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground">
                    <th className="py-2.5 px-3 text-center">No</th>
                    <th className="py-2.5 px-3">Layanan atau konsumsi</th>
                    <th className="py-2.5 px-3">Tenant atau unit</th>
                    <th className="py-2.5 px-3 text-center">Jumlah</th>
                    <th className="py-2.5 px-3 text-right">Harga satuan</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs">
                  {receiptData.items.map((item, idx) => {
                    const unitPrice = item.unitPrice;
                    const itemSubtotal = item.subtotal ?? unitPrice * item.quantity;
                    const tenantLabel = item.tenantName || item.tenantId || "Dago Creative Hub";

                    return (
                      <tr key={idx} className="hover:bg-muted/10 break-inside-avoid">
                        <td className="py-2 px-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="py-2 px-3 break-words">
                          <span className="font-semibold text-foreground block">
                            {item.name}
                          </span>
                          {item.notes ? (
                            <span className="text-xs text-muted-foreground block">{item.notes}</span>
                          ) : null}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground text-xs break-words">{tenantLabel}</td>
                        <td className="py-2 px-3 text-center font-medium font-mono tabular-nums">{item.quantity}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-muted-foreground">
                          {formatCurrencyIDR(unitPrice)}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold font-mono tabular-nums text-foreground">
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
                  <span className="font-medium font-mono tabular-nums text-foreground">
                    {formatCurrencyIDR(receiptData.subtotal)}
                  </span>
                </div>
                {receiptData.discount && receiptData.discount > 0 ? (
                  <div className="flex justify-between text-muted-foreground font-medium">
                    <span>Potongan atau diskon:</span>
                    <span className="font-mono tabular-nums">- {formatCurrencyIDR(receiptData.discount)}</span>
                  </div>
                ) : null}
                {(() => {
                  const coworkingTax = receiptData.coworkingTax ?? 0;
                  const fnbTax =
                    receiptData.fnbTax !== undefined
                      ? receiptData.fnbTax
                      : Math.max(0, (receiptData.tax ?? 0) - coworkingTax);
                  return (
                    <>
                      {fnbTax > 0 ? (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Pajak restoran PB1:</span>
                          <span className="font-medium font-mono tabular-nums text-foreground">
                            {formatCurrencyIDR(fnbTax)}
                          </span>
                        </div>
                      ) : null}
                      {coworkingTax > 0 ? (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Pajak sewa co-working:</span>
                          <span className="font-medium font-mono tabular-nums text-foreground">
                            {formatCurrencyIDR(coworkingTax)}
                          </span>
                        </div>
                      ) : null}
                    </>
                  );
                })()}
                {receiptData.serviceCharge && receiptData.serviceCharge > 0 ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Biaya layanan:</span>
                    <span className="font-medium font-mono tabular-nums text-foreground">
                      {formatCurrencyIDR(receiptData.serviceCharge)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold text-foreground">
                  <span>Total tagihan:</span>
                  <span className="font-mono tabular-nums text-primary text-base">
                    {formatCurrencyIDR(receiptData.grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Banking Instructions & Signatures */}
            <div className="grid grid-cols-2 gap-8 border-t border-border pt-6">
              <div className="space-y-2 text-xs">
                <span className="font-semibold text-foreground block">Instruksi pembayaran rekening resmi:</span>
                <div className="rounded border bg-muted/20 p-3 space-y-2 text-xs">
                  {OFFICIAL_BANK_ACCOUNTS.map((bank, bIdx) => (
                    <div key={bank.bankName} className={bIdx > 0 ? "border-t border-border/60 pt-1.5" : ""}>
                      <p className="font-semibold text-foreground">{bank.bankName}</p>
                      <p className="text-muted-foreground font-mono">No. rekening: {bank.accountNumber}</p>
                      <p className="text-muted-foreground">Atas nama: {bank.accountHolder}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  * Cantumkan nomor invoice <strong>{invoiceNumber}</strong> pada berita transfer untuk mempercepat verifikasi.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center text-xs">
                <div className="flex flex-col justify-between h-32 border-b pb-2">
                  <span className="text-muted-foreground text-xs">Penerima atau klien</span>
                  <div className="mt-auto">
                    <p className="font-semibold text-foreground">{corporate?.picName || "PIC Perusahaan"}</p>
                    <p className="text-xs text-muted-foreground">{corporate?.companyName || "Instansi"}</p>
                  </div>
                </div>

                <div className="flex flex-col justify-between h-32 border-b pb-2">
                  <span className="text-muted-foreground text-xs">{OFFICIAL_HUB_NAME}</span>
                  <div className="mt-auto">
                    <p className="font-semibold text-foreground">Keuangan & akuntansi</p>
                    <p className="text-xs text-muted-foreground">Singaraja, Bali</p>
                  </div>
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
