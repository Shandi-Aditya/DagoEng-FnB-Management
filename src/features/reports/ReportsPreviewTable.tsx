"use client";

import { FileText, Search, ShieldCheck } from "lucide-react";

import { DataPagination } from "@/components/app/data-pagination";
import { EmptyState } from "@/components/app/empty-state";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  emptyReportMessage,
  filterReportRows,
  isNumericReportCell,
  type ReportDataset,
} from "@/features/reports/reports-domain";
import { cn } from "@/lib/utils";

export interface ReportsPreviewTableProps {
  report: ReportDataset;
  scopeName: string;
  periodLabel: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function ReportsPreviewTable({
  report,
  scopeName,
  periodLabel,
  searchQuery,
  onSearchChange,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: ReportsPreviewTableProps) {
  const hasSearch = searchQuery.trim() !== "";
  const filteredRows = filterReportRows(report.tableRows, searchQuery);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + pageSize);
  const emptyCopy = emptyReportMessage(scopeName, periodLabel, hasSearch && report.tableRows.length > 0);

  const numericColumns = report.tableHeaders.map((header, colIdx) => {
    if (header.includes("(Rp)") || header.includes("(%)")) return true;
    const sampleCell = report.tableRows.find((row) => row[colIdx] !== undefined && row[colIdx] !== "-")?.[colIdx];
    return sampleCell !== undefined ? isNumericReportCell(sampleCell) : false;
  });

  const summaryGridCols =
    report.summaryCards.length === 2
      ? "grid-cols-2"
      : report.summaryCards.length === 3
      ? "grid-cols-2 sm:grid-cols-3"
      : report.summaryCards.length >= 6
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
      : "grid-cols-2 lg:grid-cols-4";

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-6">
      {/* Summary KPI Cards */}
      <div className={cn("grid gap-3", summaryGridCols)}>
        {report.summaryCards.map((card, idx) => (
          <StatCard
            key={card.label}
            className={report.summaryCards.length === 3 && idx === 0 ? "col-span-2 sm:col-span-1" : undefined}
            label={card.label}
            value={card.value}
            hint={card.sub}
          />
        ))}
      </div>

      {/* Report Table Section */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-foreground">{report.title}</h2>
              <Badge variant="secondary" className="font-mono tabular-nums">
                {filteredRows.length} baris
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{report.subtitle}</p>
          </div>

          {report.tableRows.length > 0 ? (
            <InputGroup className="sm:max-w-xs">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Cari di laporan ini"
                aria-label="Cari baris laporan"
              />
            </InputGroup>
          ) : null}
        </div>

        {filteredRows.length === 0 ? (
          <EmptyState
            className="border"
            icon={<FileText />}
            title={emptyCopy.title}
            description={emptyCopy.description}
          />
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    {report.tableHeaders.map((header, i) => (
                      <TableHead
                        key={header}
                        className={cn("whitespace-nowrap", numericColumns[i] && "text-right")}
                      >
                        {header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((row, rIdx) => (
                    <TableRow key={`${safeCurrentPage}-${rIdx}`}>
                      {row.map((cell, cIdx) => {
                        const isNumeric = numericColumns[cIdx] || isNumericReportCell(cell);
                        return (
                          <TableCell
                            key={cIdx}
                            className={cn(
                              isNumeric
                                ? "whitespace-nowrap text-right font-mono font-medium tabular-nums text-foreground"
                                : "max-w-56 whitespace-normal text-muted-foreground"
                            )}
                          >
                            {cell}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DataPagination
              currentPage={safeCurrentPage}
              totalItems={filteredRows.length}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              itemLabel="baris"
            />
          </>
        )}
      </div>

      {/* Reconciliation / Integrity Audit Breakdown */}
      {report.reconciliationInfo && report.reconciliationInfo.length > 0 ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 text-success" aria-hidden />
              Ringkasan rekonsiliasi dan audit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {report.reconciliationInfo.map((rec) => (
                <div
                  key={rec.label}
                  className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs"
                >
                  <dt className="truncate text-muted-foreground">{rec.label}</dt>
                  <dd className="font-mono font-medium tabular-nums text-foreground">{rec.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
