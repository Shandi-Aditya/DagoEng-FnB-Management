"use client";

import React from "react";
import { FileText, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ActivityLogStats } from "@/features/activity-log/activity-log-domain";

export interface ActivityLogStatsCardsProps {
  stats: ActivityLogStats;
}

export function ActivityLogStatsCards({ stats }: ActivityLogStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card className="p-4 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Jejak Audit
          </p>
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <p className="text-2xl font-bold font-mono tabular-nums tracking-tight">
          {stats.totalCount} Entri
        </p>
        <p className="text-[11px] text-muted-foreground">Tidak bisa diubah setelah tercatat</p>
      </Card>

      <Card className="p-4 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Berhasil (Success)
          </p>
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-2xl font-bold font-mono tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
          {stats.successCount}
        </p>
        <p className="text-[11px] text-muted-foreground font-medium">
          {stats.integrityPercent}% integritas sistem
        </p>
      </Card>

      <Card className="p-4 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Peringatan / Selisih
          </p>
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <p className="text-2xl font-bold font-mono tabular-nums tracking-tight text-amber-600 dark:text-amber-400">
          {stats.warningCount}
        </p>
        <p className="text-[11px] text-muted-foreground font-medium">
          Void, selisih stok & kas
        </p>
      </Card>

      <Card className="p-4 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            High / Critical
          </p>
          <ShieldCheck className="h-4 w-4 text-primary" />
        </div>
        <p className="text-2xl font-bold font-mono tabular-nums tracking-tight text-foreground">
          {stats.highSeverityCount}
        </p>
        <p className="text-[11px] text-muted-foreground font-medium">
          Aksi butuh otorisasi tinggi
        </p>
      </Card>
    </div>
  );
}
