"use client";

import React, { useRef, useEffect } from "react";
import Image from "next/image";
import { FileText, Printer, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/app/status-badge";
import { formatCurrencyIDR } from "@/lib/utils";
import type { CoworkingBooking, CoworkingMember, CoworkingSpace } from "@/types/coworking";
import {
  computeCoworkingReportPdfMetrics,
  buildCoworkingReportDocNumber,
  buildCoworkingReportSignatories,
  formatCoworkingReportPrintDate,
  formatCoworkingDurationLabel,
  formatCoworkingCheckInStatusLabel,
  formatCoworkingCheckInStatusTone,
} from "./coworking-report-pdf-domain";

export interface CoworkingReportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaces: CoworkingSpace[];
  bookings: CoworkingBooking[];
  members: CoworkingMember[];
  outletName: string;
}

export function CoworkingReportPDFModal({
  isOpen,
  onClose,
  spaces,
  bookings,
  members,
  outletName,
}: CoworkingReportPDFModalProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll reset ke puncak setiap dialog dibuka
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

  const metrics = computeCoworkingReportPdfMetrics(spaces, bookings, members);
  const now = new Date();
  const reportNumber = buildCoworkingReportDocNumber(now, bookings.length);
  const signatories = buildCoworkingReportSignatories(outletName);
  const formattedDate = formatCoworkingReportPrintDate(now);

  const handlePrint = () => {
    const reportEl = document.getElementById("coworking-report-pdf-canvas");
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
  <title>Laporan Co-working Space & Reservasi - ${outletName}</title>
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
    #coworking-report-pdf-canvas {
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
                  Pratinjau Dokumen Co-working Space
                </DialogTitle>
                <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                  Ruang & Fasilitas
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground truncate">
                {outletName} • {bookings.length} reservasi tercatat • Format cetak resmi A4
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
            id="coworking-report-pdf-canvas"
            className="w-full max-w-5xl min-w-0 bg-card text-card-foreground p-6 sm:p-8 rounded-lg shadow-xs border border-border space-y-6 my-2 print:p-0 print:shadow-none print:border-none print:max-w-none print:bg-white"
          >
            {/* Document Header Branding */}
            <div className="flex items-start justify-between border-b pb-5 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="size-10 relative shrink-0">
                    <Image
                      src="/logo-dago.png"
                      alt="Logo DagoEng"
                      width={40}
                      height={40}
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <h1 className="text-base font-semibold text-foreground">
                      DAGOENG CREATIVE HUB
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      Co-working Space, Meeting Rooms & Private Pods
                    </p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>
                    <span className="text-foreground font-medium">Unit gerai:</span> {outletName} • Dago Coworking Unit
                  </p>
                  <p>
                    <span className="text-foreground font-medium">Klasifikasi:</span> Rekapitulasi Okupansi Ruang & Pendapatan Sewa
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 space-y-1 text-xs text-muted-foreground">
                <div className="inline-block px-2.5 py-1 bg-muted rounded-md font-mono text-xs font-medium border text-foreground">
                  Dokumen Resmi Co-working
                </div>
                <p>
                  No: <span className="font-mono font-medium text-foreground">{reportNumber}</span>
                </p>
                <p>Dicetak: <span className="font-mono text-foreground">{formattedDate}</span></p>
              </div>
            </div>

            {/* Document Subtitle & Note */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-muted/40 p-3 rounded-lg border">
              <div>
                <p className="font-medium text-foreground">Rekapitulasi Okupansi Ruang Kerja & Pendapatan Sewa</p>
                <p className="text-muted-foreground text-xs">
                  Daftar transaksi reservasi aktif, status ruang (Hot Desk/Meeting Room), dan member terdaftar
                </p>
              </div>
              <div className="font-mono text-xs text-muted-foreground shrink-0">
                Laporan Operasional Ruang
              </div>
            </div>

            {/* 4 Executive KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-muted/40 border rounded-lg space-y-1">
                <span className="text-xs text-muted-foreground block">
                  Total pendapatan sewa
                </span>
                <p className="text-xl font-semibold font-mono tabular-nums text-foreground">
                  {formatCurrencyIDR(metrics.totalRevenue)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Akumulasi seluruh pemesanan
                </p>
              </div>

              <div className="p-3.5 bg-muted/40 border rounded-lg space-y-1">
                <span className="text-xs text-muted-foreground block">
                  Tingkat okupansi
                </span>
                <p className="text-xl font-semibold text-foreground">
                  <span className="font-mono tabular-nums text-primary">{metrics.occupancyPercent}%</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {metrics.occupiedSpacesCount} dari {metrics.totalSpaces} ruang terisi
                </p>
              </div>

              <div className="p-3.5 bg-muted/40 border rounded-lg space-y-1">
                <span className="text-xs text-muted-foreground block">
                  Sesi aktif & reservasi
                </span>
                <p className="text-xl font-semibold text-foreground">
                  <span className="font-mono tabular-nums">{metrics.activeBookingsCount}</span>{" "}
                  <span className="text-xs font-normal text-muted-foreground">sesi</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Sedang berjalan / terjadwal
                </p>
              </div>

              <div className="p-3.5 bg-muted/40 border rounded-lg space-y-1">
                <span className="text-xs text-muted-foreground block">
                  Member terdaftar
                </span>
                <p className="text-xl font-semibold text-foreground">
                  <span className="font-mono tabular-nums">{metrics.totalMembers}</span>{" "}
                  <span className="text-xs font-normal text-muted-foreground">member</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Member aktif co-working
                </p>
              </div>
            </div>

            {/* Main Bookings Table with explicit column proportions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-foreground">
                  Daftar transaksi reservasi co-working
                </h2>
                <span className="text-xs text-muted-foreground">
                  Menampilkan {bookings.length} transaksi
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border w-full">
                <table className="w-full min-w-[760px] sm:min-w-0 table-fixed text-left text-xs border-collapse">
                  <colgroup>
                    <col className="w-[14%]" />
                    <col className="w-[20%]" />
                    <col className="w-[18%]" />
                    <col className="w-[14%]" />
                    <col className="w-[18%]" />
                    <col className="w-[16%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-muted/60 text-muted-foreground border-b font-medium">
                      <th className="px-2.5 py-2.5 font-medium">No. booking</th>
                      <th className="px-2.5 py-2.5 font-medium">Nama tamu / member</th>
                      <th className="px-2.5 py-2.5 font-medium">Ruang kerja</th>
                      <th className="px-2.5 py-2.5 font-medium">Durasi sewa</th>
                      <th className="px-2.5 py-2.5 font-medium text-right">Biaya sewa</th>
                      <th className="px-2 py-2.5 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {bookings.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          Belum ada data reservasi co-working untuk ditampilkan.
                        </td>
                      </tr>
                    ) : (
                      bookings.map((b) => {
                        const tone = formatCoworkingCheckInStatusTone(b.checkInStatus);
                        const statusLabel = formatCoworkingCheckInStatusLabel(b.checkInStatus);
                        const durationText = formatCoworkingDurationLabel(b.duration, b.bookingType);

                        return (
                          <tr key={b.id} className="hover:bg-muted/10">
                            <td className="px-2.5 py-2 font-mono text-xs text-muted-foreground">
                              {b.bookingCode || b.id}
                            </td>
                            <td className="px-2.5 py-2 font-medium text-foreground">
                              <div>{b.guestName}</div>
                              {b.company && (
                                <div className="text-xs text-muted-foreground font-normal">
                                  {b.company}
                                </div>
                              )}
                            </td>
                            <td className="px-2.5 py-2 text-foreground">
                              {b.spaceName}
                            </td>
                            <td className="px-2.5 py-2 font-mono text-xs text-muted-foreground">
                              {durationText}
                            </td>
                            <td className="px-2.5 py-2 text-right font-mono tabular-nums text-xs font-semibold text-foreground">
                              {formatCurrencyIDR(b.totalAmount)}
                            </td>
                            <td className="px-2 py-2 text-center align-middle">
                              <StatusBadge status={tone} className="max-w-full">
                                {statusLabel}
                              </StatusBadge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {bookings.length > 0 && (
                    <tfoot className="bg-muted/40 font-semibold border-t-2 border-border text-foreground">
                      <tr>
                        <td colSpan={4} className="px-2.5 py-2.5 text-xs font-semibold">
                          Total rekapitulasi ({bookings.length} reservasi)
                        </td>
                        <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-xs font-semibold text-foreground">
                          {formatCurrencyIDR(metrics.totalRevenue)}
                        </td>
                        <td className="px-2 py-2.5 text-center text-muted-foreground font-normal text-xs">
                          —
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Accountable Factual Signatures (3 Parties) */}
            <div className="pt-6 border-t">
              <div className="grid grid-cols-3 gap-6 text-center text-xs">
                <div className="space-y-12">
                  <p className="text-muted-foreground">Disiapkan oleh,</p>
                  <div>
                    <p className="font-medium text-foreground underline underline-offset-4">
                      {signatories.staff.name}
                    </p>
                    <p className="text-muted-foreground mt-0.5">{signatories.staff.role}</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="text-muted-foreground">Diperiksa oleh,</p>
                  <div>
                    <p className="font-mono text-muted-foreground select-none">
                      ______________________
                    </p>
                    <p className="text-muted-foreground mt-0.5">{signatories.supervisor.role}</p>
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

            {/* Official Validation Footer */}
            <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-success" />
                <span>Dokumen sah terverifikasi DagoEng F&B & Co-working Management</span>
              </div>
              <div className="font-mono text-xs">
                {outletName} • Halaman 1 dari 1 (A4)
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CoworkingReportPDFModal;
