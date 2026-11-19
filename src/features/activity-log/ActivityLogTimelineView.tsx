"use client";

import { ChevronRight, FileText, User } from "lucide-react";

import { DataPagination } from "@/components/app/data-pagination";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  auditActionLabel,
  auditModuleLabel,
  auditStatusLabel,
  getStatusTone,
} from "@/features/activity-log/activity-log-domain";
import { cn } from "@/lib/utils";
import type { ActivityLogEntry } from "@/types/audit";

export interface ActivityLogTimelineViewProps {
  logs: ActivityLogEntry[];
  totalLogsCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  onSelectLog: (log: ActivityLogEntry) => void;
  emptyMessage: { title: string; description: string };
}

function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return `${date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Makassar",
  })} WITA`;
}

export function ActivityLogTimelineView({
  logs,
  totalLogsCount,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSelectLog,
  emptyMessage,
}: ActivityLogTimelineViewProps) {
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
    <div className="flex flex-col gap-4">
      <div className="relative space-y-4 pl-6 before:absolute before:top-3 before:bottom-3 before:left-2.5 before:w-0.5 before:bg-border">
        {paginatedLogs.map((log) => {
          const tone = getStatusTone(log.status);

          return (
            <div key={log.id} className="relative">
              <div
                className={cn(
                  "absolute top-2 -left-6 flex size-5 items-center justify-center rounded-full border-2 bg-background",
                  tone === "success" && "border-success",
                  tone === "warning" && "border-warning",
                  tone === "destructive" && "border-destructive",
                  tone === "neutral" && "border-border"
                )}
              >
                <div
                  className={cn(
                    "size-2 rounded-full",
                    tone === "success" && "bg-success",
                    tone === "warning" && "bg-warning",
                    tone === "destructive" && "bg-destructive",
                    tone === "neutral" && "bg-muted-foreground"
                  )}
                />
              </div>

              <Card size="sm" className="transition-colors hover:border-foreground/30">
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {auditModuleLabel(log.module)}
                      </Badge>
                      <span className="text-sm font-medium text-foreground">
                        {auditActionLabel(log.action)}
                      </span>
                      {log.recordId ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          #{log.recordId}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono tabular-nums">
                        {formatDateTime(log.timestamp)}
                      </span>
                      <StatusBadge status={tone}>
                        {auditStatusLabel(log.status)}
                      </StatusBadge>
                    </div>
                  </div>

                  <p className="text-sm text-foreground">{log.description}</p>

                  {log.previousValue || log.newValue ? (
                    <div className="space-y-1 rounded-md border bg-muted/40 p-2.5 font-mono text-xs">
                      {log.previousValue ? (
                        <div className="text-destructive line-through">
                          <span className="mr-1 font-sans text-muted-foreground">
                            Sebelum:
                          </span>
                          {log.previousValue}
                        </div>
                      ) : null}
                      {log.newValue ? (
                        <div className="text-success">
                          <span className="mr-1 font-sans text-muted-foreground">
                            Sesudah:
                          </span>
                          {log.newValue}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                      <User className="size-3.5" aria-hidden />
                      <span>Oleh</span>
                      <span className="font-medium text-foreground">{log.actorName || log.userName || "—"}</span>
                      {log.actorRole || log.role ? (
                        <span>({log.actorRole || log.role})</span>
                      ) : null}
                      {log.outletName ? <span>· {log.outletName}</span> : null}
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onSelectLog(log)}
                    >
                      Detail
                      <ChevronRight />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
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
