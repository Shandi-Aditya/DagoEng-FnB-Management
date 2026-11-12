"use client";

import { ShieldAlert } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";

export interface ActivityLogRestrictedGuardProps {
  roleName: string;
}

export function ActivityLogRestrictedGuard({ roleName }: ActivityLogRestrictedGuardProps) {
  return (
    <EmptyState
      className="mx-auto my-12 max-w-lg border bg-card"
      icon={<ShieldAlert className="text-destructive" />}
      title="Akses dibatasi"
      description="Halaman log aktivitas hanya dapat dibuka oleh admin, pemilik, atau manajer outlet."
      action={<Badge variant="secondary">Peran: {roleName}</Badge>}
    />
  );
}
