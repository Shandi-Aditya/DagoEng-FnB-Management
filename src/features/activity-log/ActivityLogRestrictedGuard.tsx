"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";

export interface ActivityLogRestrictedGuardProps {
  roleName: string;
}

export function ActivityLogRestrictedGuard({ roleName }: ActivityLogRestrictedGuardProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center bg-card rounded-2xl border border-border space-y-4">
      <div className="p-4 bg-destructive/10 rounded-2xl border border-destructive/20 text-destructive">
        <ShieldAlert className="h-10 w-10" />
      </div>
      <div className="space-y-2 max-w-md">
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          Akses Dibatasi (Restricted Access)
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Halaman Audit Trail & Activity Log hanya dapat diakses oleh Super Admin, Owner, atau Manager untuk menjaga integritas histori sistem.
        </p>
        <div className="pt-2">
          <span className="inline-block px-3 py-1 bg-muted text-muted-foreground text-xs font-mono font-medium rounded-full border border-border">
            Role Anda: {roleName}
          </span>
        </div>
      </div>
    </div>
  );
}
