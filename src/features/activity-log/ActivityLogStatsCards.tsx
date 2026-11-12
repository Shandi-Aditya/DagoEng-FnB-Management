"use client";

import { StatCard } from "@/components/app/stat-card";
import type { ActivityLogStats } from "@/features/activity-log/activity-log-domain";

export interface ActivityLogStatsCardsProps {
  stats: ActivityLogStats;
}

export function ActivityLogStatsCards({ stats }: ActivityLogStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatCard
        className="col-span-2 sm:col-span-1"
        label="Total catatan"
        value={stats.totalCount.toLocaleString("id-ID")}
        hint="aktivitas terekam"
      />
      <StatCard
        label="Peringatan"
        value={stats.warningCount.toLocaleString("id-ID")}
        hint="void, selisih stok, atau kas"
      />
      <StatCard
        label="Dampak tinggi"
        value={stats.highSeverityCount.toLocaleString("id-ID")}
        hint={
          stats.failedCount > 0
            ? `${stats.failedCount} aksi gagal`
            : "perubahan otorisasi tinggi"
        }
      />
    </div>
  );
}
