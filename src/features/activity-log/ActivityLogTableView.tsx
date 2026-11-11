"use client";

import React from "react";
import { ArrowRight, Eye, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/app";
import { EmptyState } from "@/components/app";
import { ActivityLogEntry } from "@/types/audit";
import {
  getStatusTone,
  getSeverityTone,
} from "@/features/activity-log/activity-log-domain";

export interface ActivityLogTableViewProps {
  logs: ActivityLogEntry[];
  totalLogsCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  onSelectLog: (log: ActivityLogEntry) => void;
}

export function ActivityLogTableView({
  logs,
  totalLogsCount,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSelectLog,
}: ActivityLogTableViewProps) {
  const totalPages = Math.max(1, Math.ceil(totalLogsCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLogs = logs.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-muted/30 py-3 px-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Daftar Rekam Jejak Audit ({totalLogsCount} Entri Ditemukan)
        </CardTitle>
        <span className="text-[11px] font-medium text-muted-foreground">
          Halaman {safeCurrentPage} dari {totalPages}
        </span>
      </CardHeader>

      <CardContent className="p-0">
        {totalLogsCount === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={<FileText />}
              title="Tidak ada log aktivitas sesuai kriteria"
              description="Coba ubah kata kunci pencarian, rentang waktu, atau filter modul."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px] text-xs uppercase tracking-wider">
                    Waktu
                  </TableHead>
                  <TableHead className="w-[160px] text-xs uppercase tracking-wider">
                    Aktor & Role
                  </TableHead>
                  <TableHead className="w-[160px] text-xs uppercase tracking-wider">
                    Modul & Aksi
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Perubahan Nilai / Deskripsi
                  </TableHead>
                  <TableHead className="w-[140px] text-xs uppercase tracking-wider">
                    Alasan
                  </TableHead>
                  <TableHead className="w-[100px] text-center text-xs uppercase tracking-wider">
                    Severity
                  </TableHead>
                  <TableHead className="w-[100px] text-center text-xs uppercase tracking-wider">
                    Status
                  </TableHead>
                  <TableHead className="w-[80px] text-right text-xs uppercase tracking-wider">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      <div>
                        {new Date(log.timestamp).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-semibold">
                        {new Date(log.timestamp).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        WITA
                      </div>
                    </TableCell>

                    <TableCell className="whitespace-nowrap">
                      <div className="font-semibold text-foreground text-xs">
                        {log.actorName || "-"}
                      </div>
                      <div className="text-[10px] text-primary font-semibold">
                        {log.actorRole || "-"}
                      </div>
                    </TableCell>

                    <TableCell className="whitespace-nowrap">
                      <span className="inline-block px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[10px] font-mono font-semibold mb-0.5">
                        {log.module}
                      </span>
                      <div className="font-semibold text-foreground text-xs">
                        {log.action}
                      </div>
                      {log.recordId && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          #{log.recordId}
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="max-w-sm">
                      <div className="text-foreground line-clamp-1 text-xs">
                        {log.description}
                      </div>
                      {log.previousValue && log.newValue && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 font-mono bg-muted/50 p-1 rounded border border-border">
                          <span className="text-destructive line-through truncate max-w-[120px]">
                            {log.previousValue}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-[150px]">
                            {log.newValue}
                          </span>
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-muted-foreground italic max-w-xs truncate text-[11px] whitespace-nowrap">
                      {log.reason || "-"}
                    </TableCell>

                    <TableCell className="text-center whitespace-nowrap">
                      <StatusBadge status={getSeverityTone(log.severity)}>
                        {log.severity || "INFO"}
                      </StatusBadge>
                    </TableCell>

                    <TableCell className="text-center whitespace-nowrap">
                      <StatusBadge status={getStatusTone(log.status)}>
                        {log.status || "SUCCESS"}
                      </StatusBadge>
                    </TableCell>

                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSelectLog(log)}
                        className="h-7 px-2 text-xs gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Detail</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Controls Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-border bg-card">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Tampilkan:</span>
            <NativeSelect
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 text-xs font-medium"
            >
              <option value={10}>10 per halaman</option>
              <option value={15}>15 per halaman</option>
              <option value={25}>25 per halaman</option>
              <option value={50}>50 per halaman</option>
            </NativeSelect>
            <span className="text-border">|</span>
            <span className="tabular-nums font-mono text-[11px]">
              Menampilkan {totalLogsCount === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1} -{" "}
              {Math.min(safeCurrentPage * pageSize, totalLogsCount)} dari {totalLogsCount} entri
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={safeCurrentPage <= 1}
              onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
              className="h-8 px-2.5 text-xs gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Sebelumnya</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
              className="h-8 px-2.5 text-xs gap-1"
            >
              <span>Berikutnya</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
