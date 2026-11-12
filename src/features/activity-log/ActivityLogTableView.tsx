"use client";

import { ArrowRight, Eye, FileText } from "lucide-react";

import { DataPagination } from "@/components/app/data-pagination";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  auditActionLabel,
  auditModuleLabel,
  auditSeverityLabel,
  auditStatusLabel,
  getSeverityTone,
  getStatusTone,
} from "@/features/activity-log/activity-log-domain";
import type { ActivityLogEntry } from "@/types/audit";

export interface ActivityLogTableViewProps {
  logs: ActivityLogEntry[];
  totalLogsCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  onSelectLog: (log: ActivityLogEntry) => void;
  emptyMessage: { title: string; description: string };
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Makassar",
  });
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Makassar",
  })} WITA`;
}

export function ActivityLogTableView({
  logs,
  totalLogsCount,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSelectLog,
  emptyMessage,
}: ActivityLogTableViewProps) {
  const totalPages = Math.max(1, Math.ceil(totalLogsCount / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedLogs = logs.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  if (totalLogsCount === 0) {
    return (
      <EmptyState
        className="border"
        icon={<FileText />}
        title={emptyMessage.title}
        description={emptyMessage.description}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden sm:table-cell">Waktu</TableHead>
              <TableHead className="hidden md:table-cell">Pelaku</TableHead>
              <TableHead>Aktivitas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">Aksi</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLogs.map((log) => {
              const showSeverity = log.severity === "HIGH" || log.severity === "CRITICAL";
              return (
                <TableRow
                  key={log.id}
                  className="cursor-pointer"
                  onClick={() => onSelectLog(log)}
                >
                  <TableCell className="hidden sm:table-cell whitespace-nowrap font-mono text-xs text-muted-foreground tabular-nums">
                    <div className="flex flex-col">
                      <span className="text-foreground">{formatDate(log.timestamp)}</span>
                      <span>{formatTime(log.timestamp)}</span>
                    </div>
                  </TableCell>

                  <TableCell className="hidden md:table-cell whitespace-normal">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{log.actorName || "—"}</span>
                      <span className="text-xs text-muted-foreground">{log.actorRole || "—"}</span>
                    </div>
                  </TableCell>

                  <TableCell className="whitespace-normal">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        className="text-left font-medium text-foreground outline-none focus-visible:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLog(log);
                        }}
                      >
                        {log.description}
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {auditModuleLabel(log.module)} · {auditActionLabel(log.action)}
                        {log.recordId ? (
                          <span className="font-mono"> · #{log.recordId}</span>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted-foreground md:hidden">
                        {log.actorName || "—"}
                        <span className="sm:hidden font-mono tabular-nums">
                          {" "}
                          · {formatTime(log.timestamp)}
                        </span>
                      </span>
                      {log.previousValue && log.newValue ? (
                        <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground">
                          <span className="max-w-44 truncate text-destructive line-through">
                            {log.previousValue}
                          </span>
                          <ArrowRight className="size-3 shrink-0" aria-hidden />
                          <span className="max-w-44 truncate text-success">
                            {log.newValue}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={getStatusTone(log.status)}>
                        {auditStatusLabel(log.status)}
                      </StatusBadge>
                      {showSeverity ? (
                        <StatusBadge status={getSeverityTone(log.severity)}>
                          {auditSeverityLabel(log.severity)}
                        </StatusBadge>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLog(log);
                      }}
                      aria-label={`Lihat detail ${auditActionLabel(log.action)}`}
                    >
                      <Eye />
                      <span className="hidden sm:inline">Detail</span>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <DataPagination
        currentPage={safeCurrentPage}
        totalItems={totalLogsCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[10, 15, 25, 50]}
        itemLabel="catatan"
      />
    </div>
  );
}
