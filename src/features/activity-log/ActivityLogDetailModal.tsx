"use client";

import { useState } from "react";
import { Copy, Lock } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  auditActionLabel,
  auditModuleLabel,
  auditSeverityLabel,
  auditStatusLabel,
  getSeverityTone,
  getStatusTone,
} from "@/features/activity-log/activity-log-domain";
import type { ActivityLogEntry } from "@/types/audit";

export interface ActivityLogDetailModalProps {
  log: ActivityLogEntry | null;
  onClose: () => void;
}

function formatFullTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return `${date.toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "medium",
    timeZone: "Asia/Makassar",
  })} WITA`;
}

export function ActivityLogDetailModal({ log, onClose }: ActivityLogDetailModalProps) {
  const [copiedJson, setCopiedJson] = useState(false);

  const copyLogJson = (entry: ActivityLogEntry) => {
    navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <Sheet open={log !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        {log ? (
          <>
            <SheetHeader className="gap-2 border-b">
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <SheetTitle className="text-base font-medium">
                  {auditActionLabel(log.action)}
                </SheetTitle>
                <StatusBadge status={getStatusTone(log.status)}>
                  {auditStatusLabel(log.status)}
                </StatusBadge>
              </div>
              <SheetDescription className="font-mono text-xs">
                {log.id}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6 text-sm">
              <dl className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Waktu</dt>
                  <dd className="text-right font-mono tabular-nums text-foreground">
                    {formatFullTime(log.timestamp)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Pelaku</dt>
                  <dd className="text-right font-medium text-foreground">
                    {log.actorName || "—"}
                    {log.actorRole ? (
                      <span className="font-normal text-muted-foreground"> ({log.actorRole})</span>
                    ) : null}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Outlet</dt>
                  <dd className="text-right text-foreground">
                    {log.outletName || "Semua outlet"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Modul</dt>
                  <dd className="text-right text-foreground">{auditModuleLabel(log.module)}</dd>
                </div>
                {log.recordId ? (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">ID data</dt>
                    <dd className="text-right font-mono text-foreground">{log.recordId}</dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Dampak</dt>
                  <dd>
                    <StatusBadge status={getSeverityTone(log.severity)}>
                      {auditSeverityLabel(log.severity)}
                    </StatusBadge>
                  </dd>
                </div>
              </dl>

              <section className="flex flex-col gap-2">
                <h3 className="text-xs text-muted-foreground">Keterangan</h3>
                <p className="rounded-lg border bg-card p-3 text-sm text-foreground">
                  {log.description}
                </p>
                {log.reason ? (
                  <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                    Alasan: {log.reason}
                  </p>
                ) : null}
              </section>

              {log.previousValue || log.newValue ? (
                <>
                  <Separator />
                  <section className="flex flex-col gap-2">
                    <h3 className="text-xs text-muted-foreground">Perubahan nilai</h3>
                    <div className="space-y-2 rounded-lg border bg-muted/30 p-3 font-mono text-xs">
                      {log.previousValue ? (
                        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2 text-destructive">
                          <span className="mb-0.5 block font-sans text-muted-foreground">
                            Sebelum
                          </span>
                          {log.previousValue}
                        </div>
                      ) : null}
                      {log.newValue ? (
                        <div className="rounded-md border border-success/20 bg-success/10 p-2 text-success">
                          <span className="mb-0.5 block font-sans text-muted-foreground">
                            Sesudah
                          </span>
                          {log.newValue}
                        </div>
                      ) : null}
                    </div>
                  </section>
                </>
              ) : null}

              {log.metadata ? (
                <>
                  <Separator />
                  <section className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs text-muted-foreground">Metadata JSON</h3>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => copyLogJson(log)}
                      >
                        <Copy />
                        {copiedJson ? "Tersalin" : "Salin JSON"}
                      </Button>
                    </div>
                    <pre className="max-h-40 overflow-x-auto rounded-lg border bg-muted p-3 font-mono text-xs text-foreground">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </section>
                </>
              ) : null}
            </div>

            <SheetFooter className="flex-row items-center justify-between border-t sm:justify-between">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" aria-hidden />
                Tidak bisa diubah
              </span>
              <Button size="sm" variant="outline" onClick={onClose}>
                Tutup
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
