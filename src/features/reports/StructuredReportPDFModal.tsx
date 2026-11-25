"use client";

import React, { useRef, useEffect } from "react";
import Image from "next/image";
import { Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/app/status-badge";
import {
  formatReportPrintDate,
  buildReportSignatories,
  isNumericOrCurrencyCell,
  formatReportHeaderBadge,
  computeReportColumnWidths,
} from "./report-pdf-domain";
import type { ReportType } from "./reports-domain";

export interface ReportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: ReportType;
  outletName: string;
  periodLabel: string;
  generatedBy: string;
  data: {
    title: string;
    subtitle: string;
    summaryCards: { label: string; value: string; sub?: string }[];
    tableHeaders: string[];
    tableRows: (string | number)[][];
    footerNotes?: string;
    reconciliationInfo?: { label: string; value: string }[];
  };
}

export default function StructuredReportPDFModal({
  isOpen,
  onClose,
  reportType,
  outletName,
  periodLabel,
  generatedBy,
  data,
}: ReportPDFModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLandscape = data.tableHeaders.length >= 10;
  const colWidths = computeReportColumnWidths(data.tableHeaders);
  const pageSizeDirective = isLandscape ? "A4 landscape" : "A4 portrait";

  const handlePrint = () => {
    const reportEl = document.getElementById("structured-pdf-report");
    if (!reportEl) {
      window.print();
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = isLandscape ? "297mm" : "210mm";
    iframe.style.height = isLandscape ? "210mm" : "297mm";
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
  <title>Pratinjau dokumen laporan - ${outletName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,400;0,500;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet" />
  ${styles}
  <style>
    @page {
      size: ${pageSizeDirective};
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
    #structured-pdf-report {
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

  const signatories = buildReportSignatories(generatedBy, outletName);
  const badgeLabel = formatReportHeaderBadge(reportType);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      {/* Global Print Style to format precise A4 sheet and eliminate blank page 1 */}
      <style jsx global>{`
        @media print {
          @page {
            size: ${pageSizeDirective};
            margin: 10mm 12mm;
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
          }

          /* Hide all application elements outside the dialog portal */
          body > *:not([data-base-ui-portal]):not([data-slot="dialog-portal"]),
          [data-slot="sidebar-wrapper"],
          [data-slot="sidebar-inset"],
          [data-base-ui-inert],
          [data-slot="dialog-overlay"],
          [data-slot="dialog-header"],
          [data-slot="dialog-close"],
          header,
          aside,
          nav,
          main,
          .print\\:hidden {
            display: none !important;
          }

          html,
          body {
            background: #ffffff !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          [data-base-ui-portal],
          [data-slot="dialog-portal"] {
            position: static !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }

          [data-slot="dialog-content"] {
            position: static !important;
            display: block !important;
            transform: none !important;
            translate: none !important;
            inset: auto !important;
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            outline: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            animation: none !important;
            opacity: 1 !important;
          }

          [data-slot="dialog-content"] > div {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            display: block !important;
          }

          #structured-pdf-report {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          thead {
            display: table-header-group !important;
          }

          tr {
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <DialogContent
        className="w-full sm:max-w-5xl md:max-w-6xl lg:max-w-7xl max-h-[88vh] h-[88vh] flex flex-col p-0 gap-0 overflow-hidden"
        showCloseButton={false}
      >
        {/* Header Toolbar (Non-printable) */}
        <DialogHeader className="p-4 px-6 border-b bg-muted/40 flex flex-row items-center justify-between gap-4 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-semibold truncate">
                  Pratinjau dokumen laporan
                </DialogTitle>
                <StatusBadge status="neutral">{badgeLabel}</StatusBadge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground truncate">
                {outletName} · {periodLabel}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onClose}
            >
              Tutup
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={handlePrint}
              className="gap-1.5"
            >
              <Printer className="size-4" />
              <span>Cetak laporan</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Document Body with min-h-0 for proper flexbox scroll isolation */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-4 sm:p-6 bg-muted/20 flex flex-col items-center min-w-0 print:p-0 print:bg-background print:overflow-visible print:max-h-none"
        >
          <div
            id="structured-pdf-report"
            ref={printRef}
            className={`w-full ${
              isLandscape ? "max-w-7xl" : "max-w-5xl"
            } min-w-0 bg-card text-card-foreground p-6 sm:p-8 rounded-lg shadow-xs border border-border space-y-6 my-2 print:p-0 print:shadow-none print:border-none print:max-w-none print:bg-background print:text-foreground`}
          >
            {/* Header & Logo */}
            <div className="flex items-start justify-between border-b pb-5 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 relative shrink-0">
                    <Image
                      src="/logo-dago.png"
                      alt="Logo Dago Creative Hub"
                      width={40}
                      height={40}
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight">
                      Dago Creative Hub
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      Manajemen terpadu F&B, co-working & komersial
                    </p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                  <p>
                    <span className="font-medium text-foreground">Gerai / outlet:</span>{" "}
                    {outletName}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Periode laporan:</span>{" "}
                    {periodLabel}
                  </p>
                </div>
              </div>

              <div className="text-right text-xs text-muted-foreground space-y-1 shrink-0">
                <div className="inline-block px-2.5 py-1 bg-muted rounded font-mono font-medium text-foreground text-xs">
                  {data.title}
                </div>
                <p className="text-xs">
                  Dicetak: {formatReportPrintDate()}
                </p>
                <p className="text-xs">
                  Oleh: <span className="font-medium text-foreground">{generatedBy}</span>
                </p>
              </div>
            </div>

            {/* Subtitle & Document Note */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-muted/40 p-3 rounded-lg border">
              <div>
                <p className="font-medium text-foreground">{data.title}</p>
                <p className="text-muted-foreground text-xs">{data.subtitle}</p>
              </div>
              <div className="font-mono text-xs text-muted-foreground shrink-0">
                Dokumen resmi sistem
              </div>
            </div>

            {/* KPI Summary Cards */}
            {data.summaryCards && data.summaryCards.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {data.summaryCards.map((card, idx) => (
                  <div key={idx} className="p-3 bg-muted/20 rounded-lg border space-y-1">
                    <p className="text-xs text-muted-foreground font-medium truncate">{card.label}</p>
                    <p className="text-base font-semibold font-mono tabular-nums text-foreground truncate">
                      {card.value}
                    </p>
                    {card.sub && (
                      <p className="text-xs text-muted-foreground truncate">{card.sub}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Table Data */}
            <div className="border rounded-lg overflow-x-auto w-full">
              <table className="table-fixed w-full min-w-[760px] sm:min-w-0 text-left text-xs border-collapse">
                <colgroup>
                  {colWidths.map((widthPct, idx) => (
                    <col key={idx} style={{ width: `${widthPct}%` }} />
                  ))}
                </colgroup>
                <thead className="bg-muted/50 text-foreground font-medium border-b">
                  <tr>
                    {data.tableHeaders.map((th, i) => {
                      const isLast = i === data.tableHeaders.length - 1;
                      const isRightAligned =
                        isLast || th.includes("(Rp)") || th.includes("(%)");
                      return (
                        <th
                          key={i}
                          className={`px-2 py-2 text-xs font-semibold break-words ${
                            isRightAligned ? "text-right" : ""
                          }`}
                        >
                          {th}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.tableRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-muted/30">
                      {row.map((cell, cIdx) => {
                        const isNumeric = isNumericOrCurrencyCell(cell);
                        const isCode =
                          typeof cell === "string" &&
                          (cell.startsWith("ORD-") ||
                            cell.startsWith("EVT-") ||
                            cell.startsWith("SH-"));
                        return (
                          <td
                            key={cIdx}
                            className={`px-2 py-2 text-xs text-foreground break-words ${
                              isNumeric
                                ? "text-right font-mono tabular-nums font-medium"
                                : isCode
                                ? "font-mono"
                                : ""
                            }`}
                          >
                            {cell}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Reconciliation Details if available */}
            {data.reconciliationInfo && (
              <div className="bg-muted/30 border rounded-lg p-3.5 space-y-2 text-xs">
                <p className="font-semibold text-foreground text-xs">
                  Catatan rekonsiliasi & validasi integritas data
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {data.reconciliationInfo.map((item, idx) => (
                    <div key={idx}>
                      <span className="text-muted-foreground block text-xs">{item.label}</span>
                      <span className="font-medium text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signatures Section */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t text-center text-xs">
              {signatories.map((sig, idx) => (
                <div key={idx} className="flex flex-col items-center justify-between min-h-[110px]">
                  <p className="text-muted-foreground text-xs">{sig.roleTitle},</p>
                  <div className="w-40 sm:w-48">
                    <p className="font-semibold text-foreground text-xs pb-1 truncate">
                      {sig.name || "\u00A0"}
                    </p>
                    <div className="border-b border-foreground/30 w-full" />
                    <p className="text-xs text-muted-foreground mt-1.5">{sig.designation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
