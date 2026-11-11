"use client";

import React, { useState } from "react";
import { ShieldCheck, Copy, Lock, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app";
import { ActivityLogEntry } from "@/types/audit";
import {
  getStatusTone,
  getSeverityTone,
} from "@/features/activity-log/activity-log-domain";

export interface ActivityLogDetailModalProps {
  log: ActivityLogEntry | null;
  onClose: () => void;
}

export function ActivityLogDetailModal({ log, onClose }: ActivityLogDetailModalProps) {
  const [copiedJson, setCopiedJson] = useState(false);

  if (!log) return null;

  const copyLogJson = () => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <Dialog open={!!log} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Rincian Rekam Jejak Audit
              </DialogTitle>
              <DialogDescription className="text-xs font-mono">
                ID: {log.id}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Core Metadata Grid */}
          <div className="space-y-2 text-xs bg-muted/40 p-3.5 rounded-xl border border-border">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Waktu Tercatat:</span>
              <span className="font-mono font-bold text-foreground tabular-nums">
                {new Date(log.timestamp).toLocaleString("id-ID", {
                  dateStyle: "full",
                  timeStyle: "medium",
                })}{" "}
                WITA
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Aktor & Role:</span>
              <span className="font-semibold text-foreground">
                {log.actorName}{" "}
                <span className="text-primary">({log.actorRole})</span>
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Scope Bisnis / Gerai:</span>
              <span className="font-medium text-foreground">
                {log.organizationName || "Dago Creative Hub"} • {log.outletName || "Semua"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Modul & Kode Aksi:</span>
              <span className="font-mono font-bold text-primary">
                [{log.module}] {log.action}
              </span>
            </div>

            {log.recordId && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Target Record ID:</span>
                <span className="font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded">
                  {log.recordId}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Status & Severity:</span>
              <div className="flex items-center gap-1.5">
                <StatusBadge status={getStatusTone(log.status)}>
                  {log.status || "SUCCESS"}
                </StatusBadge>
                <StatusBadge status={getSeverityTone(log.severity)}>
                  {log.severity || "INFO"}
                </StatusBadge>
              </div>
            </div>
          </div>

          {/* Before vs After Visual Diff */}
          {(log.previousValue || log.newValue) && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-foreground block">
                Transformasi Data (Before ➔ After):
              </span>
              <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-1.5 font-mono text-xs">
                {log.previousValue && (
                  <div className="text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                    <strong className="block text-[10px] uppercase font-bold text-destructive">
                      NILAI SEBELUMNYA:
                    </strong>
                    {log.previousValue}
                  </div>
                )}
                {log.newValue && (
                  <div className="text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                    <strong className="block text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300">
                      NILAI SESUDAH:
                    </strong>
                    {log.newValue}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description & Audit Reason */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-foreground block">
              Deskripsi & Narasi Aksi:
            </span>
            <p className="p-3 bg-card rounded-xl border border-border text-xs text-foreground">
              {log.description}
            </p>
            {log.reason && (
              <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                <span className="font-semibold">Alasan Bisnis:</span> {log.reason}
              </div>
            )}
          </div>

          {/* Raw JSON Payload */}
          {log.metadata && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Payload Metadata (JSON):
                </span>
                <button
                  type="button"
                  onClick={copyLogJson}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Copy className="h-3 w-3" />
                  <span>{copiedJson ? "Tersalin!" : "Salin JSON"}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 text-slate-100 rounded-xl text-[10px] font-mono overflow-x-auto max-h-36">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            <span>Kekal & Terenkripsi</span>
          </div>
          <Button size="sm" onClick={onClose} variant="outline">
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
