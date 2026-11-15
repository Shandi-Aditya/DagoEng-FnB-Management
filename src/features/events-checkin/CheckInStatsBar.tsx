"use client";

import React from "react";
import { StatCard } from "@/components/app/stat-card";
import type { CheckInStats } from "./events-checkin-domain";

interface CheckInStatsBarProps {
  stats: CheckInStats;
}

export function CheckInStatsBar({ stats }: CheckInStatsBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <StatCard
        label="Sudah hadir"
        value={String(stats.checkedInCount)}
        hint={`dari ${stats.totalTickets} tiket`}
        className="col-span-2 sm:col-span-1"
      />
      <StatCard
        label="Belum hadir"
        value={String(stats.remainingCount)}
        hint="menunggu verifikasi"
      />
      <StatCard
        label="Tingkat kehadiran"
        value={`${stats.percentage}%`}
        hint="dari kapasitas tiket"
      />
    </div>
  );
}
