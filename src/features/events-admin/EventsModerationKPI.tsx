"use client";

import { StatCard } from "@/components/app/stat-card";

export interface EventsModerationKPIProps {
  pendingCount: number;
  approvedCount: number;
  revisionCount: number;
}

export function EventsModerationKPI({
  pendingCount,
  approvedCount,
  revisionCount,
}: EventsModerationKPIProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <StatCard
        label="Menunggu review"
        value={String(pendingCount)}
        hint="Pengajuan perlu kurasi admin"
        className="col-span-2 sm:col-span-1"
      />
      <StatCard
        label="Disetujui"
        value={String(approvedCount)}
        hint="Event aktif di katalog"
      />
      <StatCard
        label="Perlu revisi"
        value={String(revisionCount)}
        hint="Menunggu pembaruan mitra"
      />
    </div>
  );
}
