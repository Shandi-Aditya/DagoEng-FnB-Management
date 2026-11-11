"use client";

import React from "react";
import { ShieldCheck, FileText } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/app";
import { ReportDataset } from "@/features/reports/reports-domain";

export interface ReportsPreviewTableProps {
  report: ReportDataset;
  scopeName: string;
  periodLabel: string;
}

export function ReportsPreviewTable({
  report,
  scopeName,
  periodLabel,
}: ReportsPreviewTableProps) {
  const previewRows = report.tableRows.slice(0, 10);
  const remainingCount = Math.max(0, report.tableRows.length - 10);

  return (
    <div className="space-y-6">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {report.summaryCards.map((card, idx) => (
          <Card key={idx} className="p-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
              {card.label}
            </p>
            <p className="text-2xl font-bold tracking-tight truncate font-mono tabular-nums">
              {card.value}
            </p>
            {card.sub && (
              <p className="text-[11px] text-muted-foreground font-medium truncate">
                {card.sub}
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Table Card */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-2 border-b border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight">
              {report.title}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{report.subtitle}</p>
          </div>
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground self-start sm:self-center shrink-0">
            {report.tableRows.length} Baris Data
          </span>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  {report.tableHeaders.map((header, i) => (
                    <TableHead key={i} className="whitespace-nowrap text-xs font-bold uppercase tracking-wider">
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.tableRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={report.tableHeaders.length} className="p-8">
                      <EmptyState
                        icon={<FileText />}
                        title="Belum ada baris data untuk modul laporan ini"
                        description={`Tidak ada transaksi atau entri tercatat untuk ${scopeName} pada rentang ${periodLabel}.`}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  previewRows.map((row, rIdx) => (
                    <TableRow key={rIdx}>
                      {row.map((cell, cIdx) => {
                        const isNumeric =
                          typeof cell === "number" ||
                          (typeof cell === "string" &&
                            (cell.startsWith("Rp") ||
                              cell.startsWith("+Rp") ||
                              cell.startsWith("-Rp") ||
                              cell.endsWith("%")));

                        return (
                          <TableCell
                            key={cIdx}
                            className={`whitespace-nowrap max-w-[220px] truncate text-xs ${
                              isNumeric
                                ? "font-mono font-medium tabular-nums text-foreground"
                                : "text-muted-foreground"
                            }`}
                            title={String(cell)}
                          >
                            {cell}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {remainingCount > 0 && (
            <div className="border-t border-border bg-muted/20 p-3 text-center text-xs text-muted-foreground">
              Menampilkan 10 baris pratinjau pertama dari total{" "}
              <strong className="text-foreground">{report.tableRows.length}</strong> baris data. Gunakan tombol Cetak PDF Resmi atau Excel (.xls) di atas untuk melihat seluruh data.
            </div>
          )}

          {/* Reconciliation / Integrity Audit Breakdown */}
          {report.reconciliationInfo && report.reconciliationInfo.length > 0 && (
            <div className="border-t border-border bg-muted/30 p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Ringkasan Rekonsiliasi & Audit Terkait
                </h4>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {report.reconciliationInfo.map((rec, rIdx) => (
                  <div
                    key={rIdx}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-xs"
                  >
                    <span className="text-[11px] text-muted-foreground truncate">
                      {rec.label}
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-foreground shrink-0 ml-2">
                      {rec.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
