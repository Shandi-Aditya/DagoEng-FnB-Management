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
  computeActivityLogPdfMetrics,
  buildAuditSignatories,
  formatAuditPrintDate,
  formatAuditStatusLabel,
  formatAuditDiffValues,
} from "./activity-log-pdf-domain";
import {
  auditActionLabel,
  auditModuleLabel,
  getStatusTone,
} from "./activity-log-domain";
import type { ActivityLogEntry } from "@/types/audit";

export interface ActivityLogPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ActivityLogEntry[];
  outletName: string;
  generatedBy: string;
  generatedRole: string;
  periodLabel: string;
}

export default function ActivityLogPDFModal({
  isOpen,
  onClose,
  logs,
  outletName,
  generatedBy,
  generatedRole,
  periodLabel,
}: ActivityLogPDFModalProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      const raf = requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      });
      const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }, 60);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const reportEl = document.getElementById("activity-log-pdf-report");
    if (!reportEl) {
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
  <title>Pratinjau Dokumen Audit - ${outletName}</title>
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
    #activity-log-pdf-report {
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

  const metrics = computeActivityLogPdfMetrics(logs);
  const signatories = buildAuditSignatories(generatedBy, outletName);
  const printTimestamp = formatAuditPrintDate(new Date());

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
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
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
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

          #activity-log-pdf-report {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
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
        showCloseButton={false}
        className="w-full sm:max-w-5xl md:max-w-6xl lg:max-w-7xl max-h-[88vh] h-[88vh] flex flex-col p-0 gap-0 overflow-hidden"
      >
        {/* Action Bar Header */}
        <DialogHeader className="p-4 px-6 border-b bg-muted/40 flex flex-row items-center justify-between gap-4 shrink-0 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-semibold truncate">
                  Pratinjau Dokumen Audit
                </DialogTitle>
                <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                  Rekam Aktivitas & Audit Trail
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground truncate">
                {outletName} • Periode: {periodLabel} • {metrics.totalCount} entri tercatat
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="lg" onClick={onClose}>
              Tutup
            </Button>
            <Button size="lg" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              <span>Cetak laporan</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable Document Body */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-4 sm:p-6 bg-muted/20 flex flex-col items-center min-w-0 print:p-0 print:bg-white print:overflow-visible print:max-h-none"
        >
          <div
            id="activity-log-pdf-report"
            className="w-full max-w-5xl min-w-0 bg-card text-card-foreground p-6 sm:p-8 rounded-lg shadow-xs border border-border space-y-6 my-2 print:p-0 print:shadow-none print:border-none print:max-w-none print:bg-white print:text-slate-900"
          >
            {/* Header Branding */}
            <div className="flex items-start justify-between border-b pb-5 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-12 relative shrink-0">
                    <Image
                      src="/logo-dago.png"
                      alt="Dago Creative Hub Logo"
                      width={40}
                      height={50}
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
                    <span className="font-medium text-foreground">Periode Audit:</span> {periodLabel}
                  </p>
                </div>
              </div>

              <div className="text-right text-xs text-muted-foreground space-y-1 shrink-0">
                <div className="inline-block px-2.5 py-1 bg-muted rounded-md font-mono text-xs font-medium border text-foreground">
                  DOKUMEN RESMI AUDIT TRAIL
                </div>
                <p>Dicetak: {printTimestamp}</p>
                <p>
                  Oleh: <span className="font-medium text-foreground">{generatedBy}</span> ({generatedRole})
                </p>
              </div>
            </div>

            {/* Executive Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-muted/40 border rounded-lg">
                <span className="text-xs text-muted-foreground">Total aktivitas</span>
                <p className="text-xl font-semibold font-mono tabular-nums text-foreground mt-0.5">
                  {metrics.totalCount}
                </p>
              </div>
              <div className="p-3.5 bg-muted/40 border rounded-lg">
                <span className="text-xs text-muted-foreground">Sukses</span>
                <p className="text-xl font-semibold font-mono tabular-nums text-foreground mt-0.5">
                  {metrics.successCount}
                </p>
              </div>
              <div className="p-3.5 bg-muted/40 border rounded-lg">
                <span className="text-xs text-muted-foreground">Peringatan / selisih</span>
                <p className="text-xl font-semibold font-mono tabular-nums text-foreground mt-0.5">
                  {metrics.warningCount}
                </p>
              </div>
              <div className="p-3.5 bg-muted/40 border rounded-lg">
                <span className="text-xs text-muted-foreground">Dampak tinggi & kritis</span>
                <p className="text-xl font-semibold font-mono tabular-nums text-foreground mt-0.5">
                  {metrics.highSeverityCount}
                </p>
              </div>
            </div>

            {/* Audit Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-foreground">
                  Daftar rekam aktivitas dan transformasi data
                </h2>
                <span className="text-xs text-muted-foreground">
                  Menampilkan {logs.length} catatan
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border w-full">
                <table className="w-full min-w-[760px] sm:min-w-0 table-fixed text-left text-xs border-collapse">
                  <colgroup>
                    <col className="w-[13%]" />
                    <col className="w-[15%]" />
                    <col className="w-[16%]" />
                    <col className="w-[30%]" />
                    <col className="w-[14%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-muted/60 text-muted-foreground border-b font-medium">
                      <th className="px-2.5 py-2.5 font-medium">Waktu (WITA)</th>
                      <th className="px-2.5 py-2.5 font-medium">Aktor & role</th>
                      <th className="px-2.5 py-2.5 font-medium">Modul & aksi</th>
                      <th className="px-2.5 py-2.5 font-medium">Transformasi data</th>
                      <th className="px-2.5 py-2.5 font-medium">Alasan bisnis</th>
                      <th className="px-2 py-2.5 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                          Tidak ada catatan aktivitas pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log, idx) => {
                        const diff = formatAuditDiffValues(log.previousValue, log.newValue);
                        return (
                          <tr key={log.id || idx} className="align-top hover:bg-muted/20">
                            <td className="px-2.5 py-2 font-mono text-xs text-muted-foreground break-words">
                              {new Date(log.timestamp).toLocaleString("id-ID", {
                                timeZone: "Asia/Makassar",
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </td>
                            <td className="px-2.5 py-2 break-words">
                              <div className="font-medium text-foreground">{log.actorName}</div>
                              <div className="text-xs text-muted-foreground">
                                {log.actorRole || log.role || "Staf"}
                              </div>
                            </td>
                            <td className="px-2.5 py-2 break-words">
                              <span className="font-mono text-xs text-muted-foreground font-medium">
                                [{auditModuleLabel(log.module)}]
                              </span>
                              <div className="text-foreground">
                                {auditActionLabel(log.action)}
                              </div>
                            </td>
                            <td className="px-2.5 py-2 break-words">
                              <div className="text-foreground">{log.description}</div>
                              {diff.hasDiff && (
                                <div className="text-xs font-mono mt-1 space-y-0.5">
                                  {diff.before && (
                                    <div className="text-muted-foreground line-through">
                                      <span className="font-medium text-foreground">Sebelum:</span> {diff.before}
                                    </div>
                                  )}
                                  {diff.after && (
                                    <div className="text-foreground font-medium">
                                      <span>Sesudah:</span> {diff.after}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-2.5 py-2 text-xs text-muted-foreground italic break-words">
                              {log.reason || "—"}
                            </td>
                            <td className="px-2 py-2 text-center align-middle">
                              <StatusBadge status={getStatusTone(log.status)} className="max-w-full">
                                {formatAuditStatusLabel(log.status)}
                              </StatusBadge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reconciliation Notes & Factual Signatures */}
            <div className="pt-4 border-t space-y-6">
              <div className="rounded-lg border bg-muted/20 p-3.5 space-y-1">
                <h3 className="text-xs font-semibold text-foreground">
                  Catatan integritas audit trail
                </h3>
                <p className="text-xs text-muted-foreground">
                  Rekam aktivitas ini dihasilkan secara otomatis oleh sistem pencatatan terpusat Dago Creative Hub.
                  Seluruh perubahan data transaksional, inventori, dan konfigurasi tercatat secara kronologis untuk
                  kebutuhan akuntabilitas audit operasional gerai.
                </p>
              </div>

              {/* 3-Column Formal Signatories */}
              <div className="grid grid-cols-3 gap-6 pt-4 text-center">
                {signatories.map((sig, idx) => (
                  <div key={idx} className="space-y-12">
                    <p className="text-xs text-muted-foreground">{sig.role}</p>
                    <div className="border-b border-foreground/30 w-3/4 mx-auto pb-1">
                      <p className="text-xs font-medium text-foreground">
                        {sig.isSigner ? sig.name : "______________________"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
