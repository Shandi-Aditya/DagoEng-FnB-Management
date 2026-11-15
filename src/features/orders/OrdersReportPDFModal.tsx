"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { FileText, Printer } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrencyIDR } from "@/lib/utils";
import type { OrderRecord } from "@/types/order";

import {
  orderStatusLabel,
  orderStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
} from "./orders-domain";
import {
  buildOrdersReportDocNumber,
  buildOrdersReportSignatories,
  computeOrdersReportPdfMetrics,
  formatOrdersReportDate,
} from "./orders-report-pdf-domain";

interface OrdersReportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: OrderRecord[];
  outletName: string;
}

export function OrdersReportPDFModal({
  isOpen,
  onClose,
  orders,
  outletName,
}: OrdersReportPDFModalProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Selalu reset posisi scroll ke atas saat dialog terbuka
  useEffect(() => {
    if (isOpen) {
      const animId = requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      });
      return () => cancelAnimationFrame(animId);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const metrics = computeOrdersReportPdfMetrics(orders);
  const now = new Date();
  const docNumber = buildOrdersReportDocNumber(now, orders.length);
  const printDateStr = formatOrdersReportDate(now);
  const signatories = buildOrdersReportSignatories("Kasir / Staf POS", outletName);

  const handlePrint = () => {
    const reportEl = document.getElementById("orders-report-pdf-canvas");
    if (!reportEl) {
      window.print();
      return;
    }

    // Gunakan invisible iframe fisik A4 terisolasi untuk mencegah halaman 1 kosong
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
  <title>Laporan Transaksi Pesanan - ${outletName}</title>
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
    #orders-report-pdf-canvas {
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
  ${reportEl.outerHTML}
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
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent
        showCloseButton={false}
        className="w-full sm:max-w-5xl md:max-w-6xl lg:max-w-7xl max-h-[88vh] h-[88vh] flex flex-col p-0 gap-0 overflow-hidden"
      >
        {/* Header Toolbar (Non-printable) */}
        <DialogHeader className="p-4 px-6 border-b bg-muted/40 flex flex-row items-center justify-between gap-4 shrink-0 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-semibold truncate">
                  Pratinjau Dokumen Transaksi Pesanan
                </DialogTitle>
                <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                  F&B Kasir & POS
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground truncate">
                {outletName} • {orders.length} transaksi tercatat • Format cetak resmi
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="lg" onClick={onClose}>
              Tutup
            </Button>
            <Button size="lg" onClick={handlePrint} className="gap-2">
              <Printer className="size-4" />
              <span>Cetak laporan</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable Document Canvas with containment */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-4 sm:p-6 bg-muted/20 flex flex-col items-center min-w-0 print:p-0 print:bg-white print:overflow-visible print:max-h-none"
        >
          <div
            id="orders-report-pdf-canvas"
            className="w-full max-w-5xl min-w-0 bg-card text-card-foreground p-6 sm:p-8 rounded-lg shadow-xs border border-border space-y-6 my-2 print:p-0 print:shadow-none print:border-none print:max-w-none print:bg-white"
          >
            {/* Document Header Branding */}
            <div className="flex items-start justify-between border-b pb-5 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="size-10 relative shrink-0">
                    <Image
                      src="/logo-dago.png"
                      alt="Logo Dago Creative Hub"
                      width={40}
                      height={40}
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold tracking-tight leading-tight">
                      DAGO CREATIVE HUB
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      Manajemen Terpadu F&B, Co-working & Komersial
                    </p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>
                    <span className="font-medium text-foreground">Gerai / Outlet:</span> {outletName}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Periode Transaksi:</span> Rekapitulasi pesanan aktif
                  </p>
                </div>
              </div>

              <div className="text-right text-xs text-muted-foreground space-y-1 shrink-0">
                <div className="inline-block px-2.5 py-1 bg-muted rounded-md font-mono text-xs font-medium border text-foreground">
                  DOKUMEN RESMI TRANSAKSI
                </div>
                <p>
                  No: <span className="font-mono font-medium text-foreground">{docNumber}</span>
                </p>
                <p>Dicetak: {printDateStr}</p>
              </div>
            </div>

            {/* Subtitle & Document Note */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-muted/40 p-3 rounded-lg border">
              <div>
                <p className="font-medium text-foreground">Rekapitulasi Penjualan & Alur Pesanan</p>
                <p className="text-muted-foreground text-xs">
                  Konsolidasi data transaksi kasir POS dan pemesanan meja tamu
                </p>
              </div>
              <div className="font-mono text-xs text-muted-foreground shrink-0">
                Dokumen Resmi Kasir
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-muted/40 border rounded-lg space-y-1">
                <span className="text-xs text-muted-foreground">Omzet penjualan</span>
                <p className="text-xl font-semibold font-mono tabular-nums text-foreground">
                  {formatCurrencyIDR(metrics.totalRevenue)}
                </p>
              </div>
              <div className="p-3.5 bg-muted/40 border rounded-lg space-y-1">
                <span className="text-xs text-muted-foreground">Selesai & lunas</span>
                <p className="text-xl font-semibold text-foreground">
                  <span className="font-mono tabular-nums">{metrics.completedCount}</span>{" "}
                  <span className="text-xs font-normal text-muted-foreground">pesanan</span>
                </p>
              </div>
              <div className="p-3.5 bg-muted/40 border rounded-lg space-y-1">
                <span className="text-xs text-muted-foreground">Aktif / diproses</span>
                <p className="text-xl font-semibold text-foreground">
                  <span className="font-mono tabular-nums">{metrics.inProgressCount}</span>{" "}
                  <span className="text-xs font-normal text-muted-foreground">pesanan</span>
                </p>
              </div>
              <div className="p-3.5 bg-muted/40 border rounded-lg space-y-1">
                <span className="text-xs text-muted-foreground">Item terjual</span>
                <p className="text-xl font-semibold text-foreground">
                  <span className="font-mono tabular-nums">{metrics.totalItemsSold}</span>{" "}
                  <span className="text-xs font-normal text-muted-foreground">porsi</span>
                </p>
              </div>
            </div>

            {/* Orders Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-foreground">
                  Daftar transaksi pesanan
                </h2>
                <span className="text-xs text-muted-foreground">
                  Menampilkan {orders.length} transaksi
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border w-full">
                <table className="w-full min-w-[760px] sm:min-w-0 table-fixed text-left text-xs border-collapse">
                  <colgroup>
                    <col className="w-[14%]" />
                    <col className="w-[10%]" />
                    <col className="w-[14%]" />
                    <col className="w-[24%]" />
                    <col className="w-[12%]" />
                    <col className="w-[9%]" />
                    <col className="w-[9%]" />
                    <col className="w-[8%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-muted/60 text-muted-foreground border-b font-medium">
                      <th className="px-2.5 py-2.5 font-medium">No. pesanan</th>
                      <th className="px-2.5 py-2.5 font-medium">Meja</th>
                      <th className="px-2.5 py-2.5 font-medium">Pelanggan</th>
                      <th className="px-2.5 py-2.5 font-medium">Rincian item</th>
                      <th className="px-2.5 py-2.5 text-right font-medium">Total</th>
                      <th className="px-2 py-2.5 text-center font-medium">Operasional</th>
                      <th className="px-2 py-2.5 text-center font-medium">Pembayaran</th>
                      <th className="px-2 py-2.5 text-center font-medium">Metode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-muted-foreground">
                          Tidak ada data transaksi pesanan pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={o.id} className="align-top hover:bg-muted/20">
                          <td className="px-2.5 py-2 font-mono text-xs font-medium tabular-nums text-foreground break-words">
                            {o.orderNumber}
                          </td>
                          <td className="px-2.5 py-2 text-foreground font-medium break-words">
                            {o.tableNumber}
                          </td>
                          <td className="px-2.5 py-2 text-foreground break-words">
                            {o.customerName || "Tamu"}
                          </td>
                          <td className="px-2.5 py-2 text-xs text-muted-foreground break-words">
                            {o.items && o.items.length > 0
                              ? o.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")
                              : "—"}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono text-xs font-medium tabular-nums text-foreground">
                            {formatCurrencyIDR(o.total || 0)}
                          </td>
                          <td className="px-2 py-2 text-center align-middle">
                            <StatusBadge status={orderStatusTone(o.status)} className="max-w-full">
                              {orderStatusLabel(o.status)}
                            </StatusBadge>
                          </td>
                          <td className="px-2 py-2 text-center align-middle">
                            <StatusBadge status={paymentStatusTone(o.paymentStatus)} className="max-w-full">
                              {paymentStatusLabel(o.paymentStatus)}
                            </StatusBadge>
                          </td>
                          <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                            {o.paymentMethod || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Accountable Factual Signatures */}
            <div className="pt-6 border-t">
              <div className="grid grid-cols-3 gap-6 text-center text-xs">
                <div className="space-y-12">
                  <p className="text-muted-foreground">Disiapkan oleh,</p>
                  <div>
                    <p className="font-medium text-foreground underline underline-offset-4">
                      {signatories.preparer.name}
                    </p>
                    <p className="text-muted-foreground mt-0.5">{signatories.preparer.role}</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="text-muted-foreground">Diperiksa oleh,</p>
                  <div>
                    <p className="font-mono text-muted-foreground select-none">
                      ______________________
                    </p>
                    <p className="text-muted-foreground mt-0.5">{signatories.reviewer.role}</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="text-muted-foreground">Disetujui oleh,</p>
                  <div>
                    <p className="font-mono text-muted-foreground select-none">
                      ______________________
                    </p>
                    <p className="text-muted-foreground mt-0.5">{signatories.approver.role}</p>
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
