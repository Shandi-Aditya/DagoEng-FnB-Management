"use client";

import { FileText, Search, ShieldCheck } from "lucide-react";

import { DataPagination } from "@/components/app/data-pagination";
import { EmptyState } from "@/components/app/empty-state";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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
  type MdrBearerMode,
  type ReportDataset,
  type ReportType,
} from "@/features/reports/reports-domain";
import { cn } from "@/lib/utils";

function adjustmentKindTone(value: string): StatusTone {
  if (value === "Refund") return "destructive";
  if (value === "Diskon manual") return "warning";
  return "neutral";
}

export interface ReportsPreviewTableProps {
  report: ReportDataset;
  reportType?: ReportType;
  scopeName: string;
  periodLabel: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  companyFilter?: {
    selectedCompany: string;
    availableCompanies: string[];
    onCompanyChange: (company: string) => void;
  };
  mdrBearerFilter?: {
    selected: MdrBearerMode;
    onChange: (mode: MdrBearerMode) => void;
  };
  onToggleSettlementStatus?: (tenantId: string) => void;
}

export function ReportsPreviewTable({
  report,
  reportType,
  scopeName,
  periodLabel,
  searchQuery,
  onSearchChange,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  companyFilter,
  mdrBearerFilter,
  onToggleSettlementStatus,
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
            valueTone={card.valueTone}
            hint={card.sub}
            hintTone={card.subTone}
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

          <div className="flex flex-wrap items-center gap-2">
            {mdrBearerFilter && (
              <NativeSelect
                className="w-full sm:w-56"
                value={mdrBearerFilter.selected}
                onChange={(e) => mdrBearerFilter.onChange(e.target.value as MdrBearerMode)}
                aria-label="Pilihan penanggung MDR QRIS"
              >
                <NativeSelectOption value="MITRA">MDR QRIS: Ditanggung mitra</NativeSelectOption>
                <NativeSelectOption value="DAGO">MDR QRIS: Ditanggung DAGO</NativeSelectOption>
                <NativeSelectOption value="SPLIT">MDR QRIS: Dibagi proporsional</NativeSelectOption>
              </NativeSelect>
            )}

            {companyFilter && (
              <NativeSelect
                className="w-full sm:w-48"
                value={companyFilter.selectedCompany}
                onChange={(e) => companyFilter.onCompanyChange(e.target.value)}
                aria-label="Filter perusahaan"
              >
                <NativeSelectOption value="ALL">Semua perusahaan</NativeSelectOption>
                {companyFilter.availableCompanies.map((c) => (
                  <NativeSelectOption key={c} value={c}>
                    {c}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}

            {report.tableRows.length > 0 || hasSearch ? (
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
                    {report.tableHeaders.map((header, i) => {
                      const isStatusHeader =
                        (reportType === "SETTLEMENT" ||
                          reportType === "SETTLEMENT_CONSOLIDATED") &&
                        i === report.tableHeaders.length - 1;
                      return (
                        <TableHead
                          key={header}
                          className={cn(
                            "whitespace-nowrap",
                            (numericColumns[i] || isStatusHeader) && "text-right"
                          )}
                        >
                          {header}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((row, rIdx) => {
                    const isTotalRow = String(row[0]).toLowerCase() === "total";
                    return (
                      <TableRow
                        key={`${safeCurrentPage}-${rIdx}`}
                        className={cn(isTotalRow && "bg-muted/30 font-semibold border-t-2")}
                      >
                        {row.map((cell, cIdx) => {
                          const isNumeric = numericColumns[cIdx] || isNumericReportCell(cell);
                          const cellStr = String(cell);
                          const isNegative =
                            isNumeric &&
                            (cellStr.startsWith("-Rp") || (cellStr.startsWith("-") && cellStr !== "-"));
                          const isPositiveVariance =
                            isNumeric && (cellStr.startsWith("+Rp") || cellStr.startsWith("+"));
                          const isAdjustmentBadgeCol =
                            (reportType === "VOID_REFUND_DISCOUNT" ||
                              report.tableHeaders[2] === "Jenis koreksi") &&
                            cIdx === 2;

                          const isStatusCol =
                            (reportType === "SETTLEMENT" ||
                              reportType === "SETTLEMENT_CONSOLIDATED") &&
                            cIdx === report.tableHeaders.length - 1;

                          if (isStatusCol) {
                            if (isTotalRow) {
                              return (
                                <TableCell
                                  key={cIdx}
                                  className="whitespace-nowrap text-right font-medium"
                                >
                                  <Badge variant="secondary">{cellStr}</Badge>
                                </TableCell>
                              );
                            }
                            if (cellStr === "Internal") {
                              return (
                                <TableCell key={cIdx} className="whitespace-nowrap text-right">
                                  <StatusBadge status="neutral">Internal</StatusBadge>
                                </TableCell>
                              );
                            }
                            const isPaid = cellStr === "Lunas";
                            const tenantId = String(row[0]);
                            return (
                              <TableCell key={cIdx} className="whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <StatusBadge status={isPaid ? "success" : "warning"}>
                                    {cellStr}
                                  </StatusBadge>
                                  {onToggleSettlementStatus && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => onToggleSettlementStatus(tenantId)}
                                    >
                                      {isPaid ? "Batal" : "Tandai lunas"}
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            );
                          }

                          const isActionCashFlow =
                            (reportType === "SETTLEMENT" ||
                              reportType === "SETTLEMENT_CONSOLIDATED") &&
                            (report.tableHeaders[cIdx] === "Aliran kas akhir" ||
                              cellStr.startsWith("Dago transfer") ||
                              cellStr.startsWith("Mitra setor") ||
                              cellStr.startsWith("Impas"));

                          if (isActionCashFlow && !isTotalRow) {
                            const isDagoTransfer = cellStr.startsWith("Dago transfer");
                            const isMitraSetor = cellStr.startsWith("Mitra setor");
                            return (
                              <TableCell key={cIdx} className="whitespace-nowrap">
                                <StatusBadge
                                  status={
                                    isDagoTransfer ? "info" : isMitraSetor ? "warning" : "neutral"
                                  }
                                >
                                  {cellStr}
                                </StatusBadge>
                              </TableCell>
                            );
                          }

                          return (
                            <TableCell
                              key={cIdx}
                              className={cn(
                                isNumeric
                                  ? cn(
                                      "whitespace-nowrap text-right font-mono font-medium tabular-nums",
                                      isNegative
                                        ? "text-destructive"
                                        : isPositiveVariance
                                        ? "text-success"
                                        : isTotalRow
                                        ? "text-foreground font-semibold"
                                        : "text-foreground"
                                    )
                                  : cn(
                                      "max-w-56 whitespace-normal",
                                      isTotalRow
                                        ? "font-semibold text-foreground"
                                        : "text-muted-foreground"
                                    )
                              )}
                            >
                              {isAdjustmentBadgeCol ? (
                                <StatusBadge status={adjustmentKindTone(cellStr)}>
                                  {cellStr}
                                </StatusBadge>
                              ) : (
                                cell
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
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
                  <dd
                    className={cn(
                      "font-mono font-medium tabular-nums",
                      rec.tone === "destructive" && "text-destructive",
                      rec.tone === "warning" && "text-warning",
                      rec.tone === "success" && "text-success",
                      rec.tone === "info" && "text-info",
                      (!rec.tone || rec.tone === "muted") && "text-foreground"
                    )}
                  >
                    {rec.value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
