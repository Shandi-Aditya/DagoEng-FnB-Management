"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { Briefcase, FileText, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/app/status-badge";
import {
  buildEmployeesReportDocNumber,
  buildEmployeesReportSignatories,
  computeEmployeesReportPdfMetrics,
  formatEmployeeStatusLabel,
  formatEmployeeStatusTone,
  formatEmployeesReportPrintDate,
} from "@/features/employees/employees-report-pdf-domain";
import { formatCurrencyIDR } from "@/lib/utils";
import type { Employee, ShiftRecord } from "@/types/shift";

interface EmployeesReportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  shifts: ShiftRecord[];
  outletName: string;
}

export function EmployeesReportPDFModal({
  isOpen,
  onClose,
  employees,
  shifts,
  outletName,
}: EmployeesReportPDFModalProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const now = useMemo(() => new Date(), [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const metrics = useMemo(
    () => computeEmployeesReportPdfMetrics(employees, shifts),
    [employees, shifts]
  );
  const docNumber = useMemo(
    () => buildEmployeesReportDocNumber(now, employees.length),
    [now, employees.length]
  );
  const signatories = useMemo(
    () => buildEmployeesReportSignatories(outletName),
    [outletName]
  );
  const printDate = useMemo(() => formatEmployeesReportPrintDate(now), [now]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      });
    }
  }, [isOpen]);

  const handlePrint = () => {
    const reportElement = document.getElementById("employees-report-printable");
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
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8" />
          <base href="${window.location.origin}/" />
          <title>${docNumber}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 10mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #0f172a;
              background: #ffffff;
              font-size: 11px;
              line-height: 1.4;
            }
            .font-mono {
              font-family: 'DM Mono', monospace !important;
            }
            .tabular-nums {
              font-variant-numeric: tabular-nums;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            th, td {
              word-break: break-word;
              overflow-wrap: break-word;
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
          ${reportElement.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Gagal mencetak dokumen karyawan:", err);
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
        {/* Header Modal */}
        <DialogHeader className="p-4 px-6 border-b border-border shrink-0 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-lg border border-border bg-muted/30 flex items-center justify-center shrink-0">
              <FileText className="size-4 text-foreground" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-medium text-foreground truncate">
                Pratinjau laporan karyawan dan shift
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate">
                Rekapitulasi absensi staf, penugasan shift kasir, dan rekonsiliasi omzet laci
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
              variant="default"
              size="lg"
              onClick={handlePrint}
            >
              <Printer className="size-4" />
              <span>Cetak laporan</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-4 sm:p-6 bg-muted/20 flex flex-col items-center min-w-0"
        >
          <div
            id="employees-report-printable"
            className="w-full max-w-5xl min-w-0 bg-card p-6 sm:p-8 rounded-lg border border-border shadow-xs text-card-foreground"
          >
            {/* Kop Surat Dokumen */}
            <div className="flex items-start justify-between pb-5 border-b border-border gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="size-12 relative shrink-0">
                  <Image
                    src="/logo-dago.png"
                    alt="Logo DagoEng"
                    width={48}
                    height={48}
                    className="object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-semibold text-foreground tracking-tight">
                    DagoEng Creative Hub
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Divisi Sumber Daya Manusia & Pengawasan Shift Operasional
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Outlet: {outletName || "Semua outlet"} • Roster penugasan & audit shift kasir
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-xs text-muted-foreground block">
                  Nomor dokumen
                </span>
                <span className="text-xs font-mono font-medium text-foreground block">
                  {docNumber}
                </span>
                <span className="text-xs text-muted-foreground block mt-0.5">
                  Tanggal: {printDate}
                </span>
              </div>
            </div>

            {/* Judul Laporan */}
            <div className="text-center py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">
                Rekapitulasi Data Karyawan, Penjadwalan, dan Audit Shift Kasir
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Daftar absensi staf, rekapitulasi sesi kasir terdata, dan total omzet per shift
              </p>
            </div>

            {/* Ringkasan Eksekutif KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
              <div className="p-3 bg-muted/30 rounded-lg border border-border text-center">
                <span className="text-xs text-muted-foreground block">
                  Total staf aktif
                </span>
                <span className="text-sm font-mono font-semibold text-foreground mt-0.5 block tabular-nums">
                  {metrics.activeEmployees} / {metrics.totalEmployees} staf
                </span>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border border-border text-center">
                <span className="text-xs text-muted-foreground block">
                  Shift selesai ditutup
                </span>
                <span className="text-sm font-mono font-semibold text-foreground mt-0.5 block tabular-nums">
                  {metrics.completedShifts} sesi
                </span>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border border-border text-center">
                <span className="text-xs text-muted-foreground block">
                  Total omzet sesi shift
                </span>
                <span className="text-sm font-mono font-semibold text-foreground mt-0.5 block tabular-nums">
                  {formatCurrencyIDR(metrics.totalShiftSales)}
                </span>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border border-border text-center">
                <span className="text-xs text-muted-foreground block">
                  Rata-rata omzet per shift
                </span>
                <span className="text-sm font-mono font-semibold text-foreground mt-0.5 block tabular-nums">
                  {formatCurrencyIDR(metrics.averageSalesPerShift)}
                </span>
              </div>
            </div>

            {/* Tabel Data Staf & Shift */}
            <div className="border border-border rounded-lg overflow-x-auto my-4 w-full">
              <table className="w-full text-left text-xs table-fixed min-w-[760px] sm:min-w-0">
                <colgroup>
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "14%" }} />
                </colgroup>
                <thead className="bg-muted/40 border-b border-border text-foreground font-medium">
                  <tr>
                    <th className="p-2.5">ID staf</th>
                    <th className="p-2.5">Nama karyawan</th>
                    <th className="p-2.5">Posisi / peran</th>
                    <th className="p-2.5">Departemen</th>
                    <th className="p-2.5">Penugasan shift</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-muted-foreground">
                  {employees.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/20">
                      <td className="p-2.5 font-mono text-xs text-foreground font-medium break-words">
                        {e.employeeNumber || "—"}
                      </td>
                      <td className="p-2.5 text-foreground font-medium break-words">
                        {e.name}
                      </td>
                      <td className="p-2.5 text-foreground break-words">
                        {e.role}
                      </td>
                      <td className="p-2.5 text-muted-foreground break-words">
                        {e.department}
                      </td>
                      <td className="p-2.5 font-mono text-xs text-muted-foreground break-words">
                        {e.assignedShift || "Sesuai jadwal"}
                      </td>
                      <td className="p-2.5 text-center">
                        <StatusBadge
                          status={formatEmployeeStatusTone(e.status)}
                          className="max-w-full inline-flex align-middle text-xs"
                        >
                          {formatEmployeeStatusLabel(e.status)}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        Belum ada data staf karyawan yang terdaftar untuk dicetak.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Lembar Otorisasi & Tanda Tangan */}
            <div className="mt-8 pt-5 border-t border-border no-break">
              <div className="grid grid-cols-3 gap-6 text-center text-xs">
                {signatories.map((sig, idx) => (
                  <div key={idx} className="space-y-1">
                    <span className="text-muted-foreground block">
                      {sig.role}
                    </span>
                    <span className="text-muted-foreground text-xs block">
                      {sig.department}
                    </span>
                    <div className="h-14" />
                    <span className="font-mono text-xs text-foreground block font-medium">
                      ( ........................................ )
                    </span>
                    <span className="text-muted-foreground text-xs block">
                      {sig.outlet}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Briefcase className="size-3.5 text-muted-foreground" />
                  <span>
                    Dokumen rekapitulasi HR & Shift resmi DagoEng Management System
                  </span>
                </div>
                <span className="font-mono tabular-nums">
                  Halaman 1 dari 1 • Dicetak pada {printDate}
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
