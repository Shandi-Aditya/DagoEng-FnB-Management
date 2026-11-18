"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  Bot,
  Printer,
  ShieldCheck,
  QrCode,
  Send,
  FileText,
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
import { notify } from "@/components/app";
import {
  buildClosingWhatsAppMessage,
  formatClosingTaxStatus,
} from "@/features/pos/pos-closing-report";

export interface TenantBreakdownItem {
  tenantId: string;
  tenantName: string;
  grossRevenue: number;
  netSales: number;
  tenantShareAmount: number;
  dagoShareAmount: number;
  tenantSharePercent: number;
  dagoSharePercent: number;
}

export interface ClosingReportData {
  reportNumber: string;
  outletName: string;
  outletAddress: string;
  outletPhone: string;
  cashierName: string;
  closingDateTime: string;
  shiftName: string;
  initialCash: number;
  totalCashSales: number;
  qrisSales: number;
  edcSales: number;
  totalTransactionsCount: number;
  totalGrossSales: number;
  totalDiscounts: number;
  isTaxEnabled: boolean;
  taxRatePercent: number;
  totalTax: number;
  totalServiceCharge?: number;
  totalNetSales: number;
  tenantSharePercent: number;
  dagoSharePercent: number;
  tenantTotalShare: number;
  dagoTotalShare: number;
  tenantQrisShare: number;
  dagoQrisShare: number;
  tenantCashShare: number;
  dagoCashShare: number;
  expectedCash?: number;
  actualCashEnding: number;
  cashDifference: number;
  shiftNotes?: string;
  verificationHash: string;
  tenantBreakdowns?: TenantBreakdownItem[];
}

interface DailyClosingPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId?: string;
  reportData: ClosingReportData;
  managerPhone: string;
}

export function DailyClosingPDFModal({
  isOpen,
  onClose,
  shiftId,
  reportData,
  managerPhone,
}: DailyClosingPDFModalProps) {
  const [isGatewaySending, setIsGatewaySending] = useState(false);
  const [isChatbotSending, setIsChatbotSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = 0;
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Print the report using an isolated A4 iframe engine.
  // This avoids host scroll-lock, 100vh wrapper blank page 1 bugs,
  // and host dark-mode color pollution.
  const handlePrintPDF = () => {
    const reportElement = document.getElementById("closing-pdf-report");
    if (!reportElement) return;

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
  <title>Dokumen Closing Harian - ${reportData.outletName} (${reportData.reportNumber})</title>
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
    :root {
      --background: oklch(1 0 0) !important;
      --foreground: oklch(0.145 0 0) !important;
      --card: oklch(1 0 0) !important;
      --card-foreground: oklch(0.145 0 0) !important;
      --popover: oklch(1 0 0) !important;
      --popover-foreground: oklch(0.145 0 0) !important;
      --primary: oklch(0.488 0.243 264.376) !important;
      --primary-foreground: oklch(0.97 0.014 254.604) !important;
      --muted: oklch(0.97 0 0) !important;
      --muted-foreground: oklch(0.556 0 0) !important;
      --border: oklch(0.922 0 0) !important;
      --info: oklch(0.5 0.134 242.749) !important;
      --info-foreground: oklch(0.977 0.013 236.62) !important;
      --warning: oklch(0.555 0.163 48.998) !important;
      --warning-foreground: oklch(0.987 0.022 95.277) !important;
      --success: oklch(0.527 0.154 150.069) !important;
      --success-foreground: oklch(0.982 0.018 155.826) !important;
    }
    html, body {
      background: #ffffff !important;
      color: #0f172a !important;
      margin: 0 !important;
      padding: 0 !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .font-mono, td.font-mono, th.font-mono, [class*="font-mono"] {
      font-family: 'DM Mono', monospace !important;
    }
    body > *,
    #closing-pdf-report {
      display: block !important;
      visibility: visible !important;
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      box-shadow: none !important;
      background: transparent !important;
    }
    thead {
      display: table-header-group !important;
    }
    tr {
      break-inside: avoid !important;
    }
    .no-break {
      break-inside: avoid !important;
    }
  </style>
</head>
<body>
  ${reportElement.outerHTML}
</body>
</html>`);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Gagal mencetak dokumen closing:", err);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }
    }, 400);
  };

  // Dispatch to WhatsApp Gateway / Direct WA fallback
  const handleDispatchWAGateway = () => {
    setIsGatewaySending(true);
    try {
      const { url } = buildClosingWhatsAppMessage(reportData, managerPhone);
      window.open(url, "_blank");
      notify.success(
        "Laporan closing terkirim",
        `Ringkasan closing berhasil diteruskan ke WhatsApp ${managerPhone}.`
      );
    } catch {
      notify.error(
        "Gagal membuka WhatsApp",
        "Periksa kembali nomor telepon manajer atau konfigurasi browser."
      );
    } finally {
      setIsGatewaySending(false);
    }
  };

  const handleDispatchChatbot = async () => {
    if (!shiftId || isChatbotSending) return;
    setIsChatbotSending(true);
    try {
      const response = await fetch("/api/notifications/closing-chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId, forceResend: true }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        notify.error(
          "Gagal mengirim ringkasan bot",
          data?.error || "Periksa status shift atau koneksi server lalu coba lagi."
        );
        return;
      }

      const dispatch = data.dispatch;
      const sentCount = dispatch?.sentCount ?? 0;
      const envelopeCount = dispatch?.envelopeCount ?? 0;
      const allUnconfigured =
        Array.isArray(dispatch?.envelopes) &&
        dispatch.envelopes.length > 0 &&
        dispatch.envelopes.every((env: { deliveries?: Array<{ configured?: boolean }> }) =>
          (env.deliveries || []).every((d) => d.configured === false)
        );

      if (sentCount > 0) {
        notify.success(
          "Ringkasan dikirim",
          `Laporan closing diteruskan ke ${envelopeCount} penerima melalui ${sentCount} kanal.`
        );
      } else if (allUnconfigured) {
        notify.info(
          "Gateway chatbot belum aktif",
          "Token WhatsApp atau Telegram belum dikonfigurasi di server."
        );
      } else {
        notify.error(
          "Pengiriman chatbot gagal",
          "Gateway tidak berhasil mengirim pesan ke penerima."
        );
      }
    } catch {
      notify.error(
        "Gagal menghubungi server",
        "Tidak dapat terhubung ke layanan notifikasi chatbot."
      );
    } finally {
      setIsChatbotSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full sm:max-w-4xl md:max-w-5xl max-h-[88vh] h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Top Control Bar */}
        <DialogHeader className="px-5 sm:px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/40 shrink-0 pr-14 sm:pr-16">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-medium text-foreground truncate">
                Dokumen resmi closing harian
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate">
                No. dokumen: <span className="font-mono">{reportData.reportNumber}</span>
              </DialogDescription>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center shrink-0">
            <Button
              type="button"
              size="lg"
              onClick={handlePrintPDF}
              className={shiftId ? "col-span-2 sm:col-span-1 w-full sm:w-auto" : "w-full sm:w-auto"}
              title="Cetak langsung atau simpan sebagai PDF dari browser"
            >
              <Printer className="size-4" />
              <span>Cetak PDF</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleDispatchWAGateway}
              disabled={isGatewaySending}
              className="w-full sm:w-auto"
              title="Kirim ringkasan laporan ke WhatsApp manajer"
            >
              <Send className="size-4" />
              <span>
                {isGatewaySending ? "Membuka WA..." : "Kirim WA"}
              </span>
            </Button>

            {shiftId && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleDispatchChatbot}
                disabled={isChatbotSending}
                className="w-full sm:w-auto"
                title="Kirim ringkasan closing via chatbot ke Ka Ari dan mitra"
              >
                <Bot className="size-4" />
                <span>
                  {isChatbotSending ? "Mengirim..." : "Kirim bot"}
                </span>
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Printable PDF Document Sheet (Optimized 1-Page A4) */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-3 sm:p-6 pb-12 sm:pb-16 bg-muted/20 flex flex-col items-center min-w-0"
        >
          <div
            id="closing-pdf-report"
            className="w-full max-w-[760px] min-w-0 bg-card p-5 sm:p-8 rounded-lg shadow-xs border border-border text-card-foreground space-y-5"
          >
              {/* Header: Brand & Document Identity */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b-2 border-border pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 relative shrink-0">
                      <Image
                        src="/logo-dago.png"
                        alt="DagoEng"
                        width={32}
                        height={40}
                        className="object-contain"
                      />
                    </div>
                    <div>
                      <h1 className="font-semibold text-base tracking-tight text-foreground leading-none">
                        DAGOENG CREATIVE HUB
                      </h1>
                      <p className="text-xs text-muted-foreground font-medium pt-1">
                        Manajemen F&B multi-unit dan ekosistem platform
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium pt-1">
                    Tenant: <strong className="text-foreground">{reportData.outletName}</strong> • {reportData.outletAddress}
                  </p>
                  <p className="text-xs text-muted-foreground">Kontak: {reportData.outletPhone}</p>
                </div>

                <div className="text-left sm:text-right space-y-1 shrink-0">
                  <div>
                    <StatusBadge status="neutral">
                      Rekapitulasi resmi
                    </StatusBadge>
                  </div>
                  <h2 className="font-medium text-xs text-foreground pt-0.5">
                    Laporan closing harian
                  </h2>
                  <p className="font-mono text-xs font-medium text-primary">
                    {reportData.reportNumber}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono tabular-nums">
                    {reportData.closingDateTime}
                  </p>
                </div>
              </div>

              {/* Meta Information Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 sm:p-3.5 rounded-lg border border-border text-xs">
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground block">Shift / sesi:</span>
                  <span className="font-medium text-foreground">{reportData.shiftName}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground block">Kasir bertugas:</span>
                  <span className="font-medium text-foreground">{reportData.cashierName}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground block">Volume penjualan:</span>
                  <span className="font-medium font-mono tabular-nums text-foreground">
                    {reportData.totalTransactionsCount} transaksi
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground block">Status pajak:</span>
                  <span className="font-medium text-foreground">
                    {formatClosingTaxStatus(reportData.isTaxEnabled, reportData.taxRatePercent)}
                  </span>
                </div>
              </div>

              {/* Section 1: Ringkasan Penjualan & Pajak */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-foreground border-b border-border pb-1.5">
                  1. Ringkasan pendapatan dan rincian pajak (PB1 / PPN)
                </h3>
                <table className="w-full text-xs text-left">
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="py-2 text-muted-foreground">Total penjualan kotor</td>
                      <td className="py-2 text-right font-mono tabular-nums font-medium text-foreground">
                        {formatCurrencyIDR(reportData.totalGrossSales)}
                      </td>
                    </tr>
                    {reportData.totalDiscounts > 0 && (
                      <tr className="text-success">
                        <td className="py-2">Total potongan promo dan diskon voucher</td>
                        <td className="py-2 text-right font-mono tabular-nums font-medium">
                          -{formatCurrencyIDR(reportData.totalDiscounts)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-2 text-muted-foreground">
                        Pajak restoran ({reportData.isTaxEnabled ? `PB1 ${reportData.taxRatePercent}%` : "Nonaktif"})
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums font-medium text-foreground">
                        {formatCurrencyIDR(reportData.totalTax)}
                      </td>
                    </tr>
                    {reportData.totalServiceCharge !== undefined && reportData.totalServiceCharge > 0 && (
                      <tr>
                        <td className="py-2 text-muted-foreground">Biaya layanan (Service charge)</td>
                        <td className="py-2 text-right font-mono tabular-nums font-medium text-foreground">
                          {formatCurrencyIDR(reportData.totalServiceCharge)}
                        </td>
                      </tr>
                    )}
                    <tr className="bg-muted/40 font-semibold text-foreground border-t border-border">
                      <td className="py-2.5 px-2">Total omzet bersih</td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-sm text-primary">
                        {formatCurrencyIDR(reportData.totalNetSales)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 2: Rekonsiliasi Metode Pembayaran */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-foreground border-b border-border pb-1.5">
                  2. Rekonsiliasi metode pembayaran (tunai dan non-tunai)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                    <span className="text-xs text-muted-foreground block">Kas tunai (laci kasir)</span>
                    <p className="text-sm font-semibold font-mono tabular-nums text-foreground">
                      {formatCurrencyIDR(reportData.totalCashSales)}
                    </p>
                    <span className="text-xs text-muted-foreground block">Uang fisik kasir</span>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                    <span className="text-xs text-muted-foreground block">QRIS dinamis</span>
                    <p className="text-sm font-semibold font-mono tabular-nums text-foreground">
                      {formatCurrencyIDR(reportData.qrisSales)}
                    </p>
                    <span className="text-xs text-muted-foreground block">Settlement digital</span>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                    <span className="text-xs text-muted-foreground block">Kartu EDC</span>
                    <p className="text-sm font-semibold font-mono tabular-nums text-foreground">
                      {formatCurrencyIDR(reportData.edcSales)}
                    </p>
                    <span className="text-xs text-muted-foreground block">Debit / kredit EDC</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Rekonsiliasi Kas Laci Kasir (Front Office) */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-foreground border-b border-border pb-1.5">
                  3. Rekonsiliasi kas laci kasir (Front Office)
                </h3>
                <div className="rounded-lg border border-border bg-card overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="py-2 px-3 text-muted-foreground">Modal awal kasir (kas pembuka)</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-foreground">
                          {formatCurrencyIDR(reportData.initialCash)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-muted-foreground">Penjualan kas tunai</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-foreground">
                          {formatCurrencyIDR(reportData.totalCashSales)}
                        </td>
                      </tr>
                      <tr className="bg-muted/30 font-medium">
                        <td className="py-2 px-3 text-foreground">Total kas seharusnya di laci</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-foreground">
                          {formatCurrencyIDR(reportData.expectedCash ?? (reportData.initialCash + reportData.totalCashSales))}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-muted-foreground">Kas fisik aktual (setoran kasir)</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-foreground">
                          {formatCurrencyIDR(reportData.actualCashEnding)}
                        </td>
                      </tr>
                      <tr className={reportData.cashDifference === 0 ? "bg-success/10 text-success" : reportData.cashDifference < 0 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}>
                        <td className="py-2 px-3 font-semibold">
                          Selisih kas ({reportData.cashDifference === 0 ? "Seimbang" : reportData.cashDifference < 0 ? "Kurang / Tekor" : "Lebih"})
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">
                          {reportData.cashDifference >= 0 ? "+" : ""}{formatCurrencyIDR(reportData.cashDifference)}
                        </td>
                      </tr>
                      {reportData.shiftNotes && (
                        <tr className="bg-muted/10">
                          <td className="py-2 px-3 text-muted-foreground">Keterangan / alasan selisih</td>
                          <td className="py-2 px-3 text-right text-foreground italic">
                            {reportData.shiftNotes}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 4: Split Bagi Hasil & Rincian per Mitra */}
              <div className="space-y-2 min-w-0">
                <h3 className="text-xs font-semibold text-foreground border-b border-border pb-1.5">
                  4. Alokasi bagi hasil dan rincian per mitra tenant
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                  {/* Tenant Share */}
                  <div className="p-3 sm:p-3.5 rounded-lg border border-border bg-muted/20 space-y-2.5 min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span
                        className="font-semibold text-xs text-foreground truncate"
                        title={`Hak pemilik usaha / tenant (${reportData.tenantSharePercent}%)`}
                      >
                        Hak pemilik usaha / tenant ({reportData.tenantSharePercent}%)
                      </span>
                      <StatusBadge status="warning" className="shrink-0">
                        Tenant
                      </StatusBadge>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between items-center gap-2 min-w-0 text-muted-foreground">
                        <span className="truncate">• Bagian QRIS digital:</span>
                        <span className="font-mono tabular-nums font-medium text-foreground shrink-0">
                          {formatCurrencyIDR(reportData.tenantQrisShare)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2 min-w-0 text-muted-foreground">
                        <span className="truncate">• Bagian kas tunai:</span>
                        <span className="font-mono tabular-nums font-medium text-foreground shrink-0">
                          {formatCurrencyIDR(reportData.tenantCashShare)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2 min-w-0 font-semibold border-t border-border pt-1.5 text-foreground text-xs">
                        <span className="truncate">Total bersih tenant:</span>
                        <span className="font-mono tabular-nums text-sm text-primary shrink-0">
                          {formatCurrencyIDR(reportData.tenantTotalShare)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dago Hub Share */}
                  <div className="p-3 sm:p-3.5 rounded-lg border border-border bg-muted/20 space-y-2.5 min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span
                        className="font-semibold text-xs text-foreground truncate"
                        title={`Hak pengelola Dago Hub (${reportData.dagoSharePercent}%)`}
                      >
                        Hak pengelola Dago Hub ({reportData.dagoSharePercent}%)
                      </span>
                      <StatusBadge status="info" className="shrink-0">
                        Platform
                      </StatusBadge>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between items-center gap-2 min-w-0 text-muted-foreground">
                        <span className="truncate">• Bagian QRIS digital:</span>
                        <span className="font-mono tabular-nums font-medium text-foreground shrink-0">
                          {formatCurrencyIDR(reportData.dagoQrisShare)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2 min-w-0 text-muted-foreground">
                        <span className="truncate">• Bagian kas tunai:</span>
                        <span className="font-mono tabular-nums font-medium text-foreground shrink-0">
                          {formatCurrencyIDR(reportData.dagoCashShare)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2 min-w-0 font-semibold border-t border-border pt-1.5 text-foreground text-xs">
                        <span className="truncate">Total bersih Dago Hub:</span>
                        <span className="font-mono tabular-nums text-sm text-primary shrink-0">
                          {formatCurrencyIDR(reportData.dagoTotalShare)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Per-Mitra Breakdown Table */}
                {reportData.tenantBreakdowns && reportData.tenantBreakdowns.length > 0 && (
                  <div className="mt-3 rounded-lg border border-border bg-card p-3 space-y-1.5">
                    <span className="text-xs font-semibold text-foreground block">
                      Rincian penjualan dan bagi hasil per mitra F&B
                    </span>
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="py-1.5 font-medium">Mitra tenant</th>
                          <th className="py-1.5 text-right font-medium">Omset kotor</th>
                          <th className="py-1.5 text-right font-medium">Omset bersih</th>
                          <th className="py-1.5 text-right font-medium">Hak mitra</th>
                          <th className="py-1.5 text-right font-medium">Hak platform</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {reportData.tenantBreakdowns.map((t) => (
                          <tr key={t.tenantId}>
                            <td className="py-1.5 font-medium text-foreground">{t.tenantName}</td>
                            <td className="py-1.5 text-right font-mono tabular-nums text-muted-foreground">{formatCurrencyIDR(t.grossRevenue)}</td>
                            <td className="py-1.5 text-right font-mono tabular-nums text-foreground">{formatCurrencyIDR(t.netSales)}</td>
                            <td className="py-1.5 text-right font-mono tabular-nums text-foreground font-medium">{formatCurrencyIDR(t.tenantShareAmount)}</td>
                            <td className="py-1.5 text-right font-mono tabular-nums text-muted-foreground">{formatCurrencyIDR(t.dagoShareAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section 5: Digital Certification Stamp */}
              <div className="pt-3 border-t border-dashed border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-border shrink-0">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div className="text-xs space-y-0.5 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      Tersertifikasi digital
                    </p>
                    <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                      Laporan diterbitkan otomatis oleh sistem DagoEng. Sah secara hukum dan finansial tanpa memerlukan tanda tangan fisik basah.
                    </p>
                    <p className="text-xs font-mono text-muted-foreground pt-0.5 break-all">
                      Audit hash: {reportData.verificationHash}
                    </p>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 font-mono text-xs text-muted-foreground shrink-0">
                  <div className="size-11 border border-border rounded p-1 flex items-center justify-center bg-card">
                    <QrCode className="size-8 text-foreground" />
                  </div>
                  <span>Scan validasi</span>
                </div>
              </div>
            </div>
            {/* Bottom scroll buffer so Section 4 is never cropped */}
            <div className="h-6 shrink-0" />
          </div>
        </DialogContent>
    </Dialog>
  );
}
