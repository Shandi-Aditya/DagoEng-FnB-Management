"use client";

import React from "react";
import { User, ChevronRight, ChevronLeft, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/app";
import { EmptyState } from "@/components/app";
import { ActivityLogEntry } from "@/types/audit";
import { getStatusTone } from "@/features/activity-log/activity-log-domain";
import { cn } from "@/lib/utils";

export interface ActivityLogTimelineViewProps {
  logs: ActivityLogEntry[];
  totalLogsCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  onSelectLog: (log: ActivityLogEntry) => void;
}

export function ActivityLogTimelineView({
  logs,
  totalLogsCount,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSelectLog,
}: ActivityLogTimelineViewProps) {
  const totalPages = Math.max(1, Math.ceil(totalLogsCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLogs = logs.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  if (totalLogsCount === 0) {
    return (
      <Card className="p-12">
        <EmptyState
          icon={<FileText />}
          title="Tidak ada log aktivitas sesuai kriteria"
          description="Coba ubah kata kunci pencarian, rentang waktu, atau filter modul."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
        {paginatedLogs.map((log) => {
          const tone = getStatusTone(log.status);

          return (
            <div key={log.id} className="relative group">
              {/* Timeline Dot Icon */}
              <div
                className={cn(
                  "absolute -left-6 top-1.5 h-5 w-5 rounded-full border-2 bg-background flex items-center justify-center",
                  tone === "success" && "border-emerald-500",
                  tone === "warning" && "border-amber-500",
                  tone === "destructive" && "border-destructive",
                  tone === "neutral" && "border-border"
                )}
              >
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    tone === "success" && "bg-emerald-500",
                    tone === "warning" && "bg-amber-500",
                    tone === "destructive" && "bg-destructive",
                    tone === "neutral" && "bg-muted-foreground"
                  )}
                />
              </div>

              {/* Timeline Card */}
              <Card className="p-4 space-y-2 hover:border-primary/50 transition-colors">
                <div className="flex flex-col gap-1 pb-2 border-b border-border sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-muted text-muted-foreground rounded">
                      {log.module}
                    </span>
                    <h4 className="text-xs font-bold text-foreground">{log.action}</h4>
                    {log.recordId && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        #{log.recordId}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono tabular-nums">
                      {new Date(log.timestamp).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      WITA
                    </span>
                    <StatusBadge status={tone}>
                      {log.status || "SUCCESS"}
                    </StatusBadge>
                  </div>
                </div>

                <p className="text-xs text-foreground font-medium">{log.description}</p>

                {/* Diff Preview */}
                {(log.previousValue || log.newValue) && (
                  <div className="p-2.5 bg-muted/40 rounded-lg border border-border text-xs font-mono space-y-1">
                    {log.previousValue && (
                      <div className="text-destructive line-through text-[11px]">
                        <span className="text-muted-foreground font-semibold mr-1">
                          SEBELUM:
                        </span>
                        {log.previousValue}
                      </div>
                    )}
                    {log.newValue && (
                      <div className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                        <span className="text-muted-foreground font-semibold mr-1">
                          SESUDAH:
                        </span>
                        {log.newValue}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                    <User className="h-3.5 w-3.5" />
                    <span>Oleh:</span>
                    <span className="font-bold text-foreground">{log.actorName}</span>
                    <span className="text-primary font-medium">({log.actorRole})</span>
                    {log.outletName && (
                      <>
                        <span>•</span>
                        <span>{log.outletName}</span>
                      </>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSelectLog(log)}
                    className="h-6 px-2 text-[11px] gap-0.5 text-primary hover:text-primary"
                  >
                    <span>Detail Lengkap</span>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls Bar for Timeline */}
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4">
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
      </Card>
    </div>
  );
}
