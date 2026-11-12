"use client";

import { FileText, ShieldCheck } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { emptyReportMessage, ReportDataset } from "@/features/reports/reports-domain";

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
  const emptyCopy = emptyReportMessage(scopeName, periodLabel);

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {report.summaryCards.map((card, idx) => (
          <StatCard
            key={idx}
            label={card.label}
            value={card.value}
            hint={card.sub}
          />
        ))}
      </div>

      {/* Table Card */}
      <Card className="w-full min-w-0 max-w-full overflow-hidden">
        <CardHeader className="flex flex-col gap-2 border-b border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-medium">
              {report.title}
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">{report.subtitle}</p>
          </div>
          <Badge variant="secondary" className="self-start font-mono text-xs tabular-nums sm:self-center">
            {report.tableRows.length} baris data
          </Badge>
        </CardHeader>

        <CardContent className="min-w-0 max-w-full overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {report.tableHeaders.map((header, i) => (
                  <TableHead key={i} className="whitespace-nowrap text-xs font-medium">
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
                      icon={<FileText className="size-8 text-muted-foreground" />}
                      title={emptyCopy.title}
                      description={emptyCopy.description}
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
                          className={`max-w-[220px] truncate text-xs ${
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

          {remainingCount > 0 && (
            <div className="border-t border-border bg-muted/20 p-3 text-center text-xs text-muted-foreground">
              Menampilkan 10 baris pratinjau pertama dari total{" "}
              <span className="font-mono font-medium text-foreground">{report.tableRows.length}</span> baris data. Gunakan tombol Cetak PDF atau Ekspor Excel di atas untuk melihat seluruh data.
            </div>
          )}

          {/* Reconciliation / Integrity Audit Breakdown */}
          {report.reconciliationInfo && report.reconciliationInfo.length > 0 && (
            <div className="space-y-3 border-t border-border bg-muted/30 p-4 sm:p-5">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <ShieldCheck className="size-4 shrink-0 text-success" />
                <h4 className="text-xs font-medium text-foreground">
                  Ringkasan rekonsiliasi dan audit
                </h4>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {report.reconciliationInfo.map((rec, rIdx) => (
                  <div
                    key={rIdx}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-xs"
                  >
                    <span className="truncate text-xs text-muted-foreground">
                      {rec.label}
                    </span>
                    <span className="font-mono text-xs font-medium tabular-nums text-foreground">
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
