"use client";

import React from "react";
import { Search, Calendar, User, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Card } from "@/components/ui/card";
import {
  DateFilterType,
  MODULE_OPTIONS,
} from "@/features/activity-log/activity-log-domain";
import { cn } from "@/lib/utils";

export interface ActivityLogFilterBarProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  dateFilter: DateFilterType;
  onDateFilterChange: (v: DateFilterType) => void;
  selectedStatus: string;
  onStatusChange: (v: string) => void;
  selectedActor: string;
  onActorChange: (v: string) => void;
  uniqueActors: string[];
  selectedRole: string;
  onRoleChange: (v: string) => void;
  uniqueRoles: string[];
  selectedModule: string;
  onModuleChange: (v: string) => void;
}

export function ActivityLogFilterBar({
  searchTerm,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  selectedStatus,
  onStatusChange,
  selectedActor,
  onActorChange,
  uniqueActors,
  selectedRole,
  onRoleChange,
  uniqueRoles,
  selectedModule,
  onModuleChange,
}: ActivityLogFilterBarProps) {
  return (
    <Card className="p-4 space-y-3">
      {/* Row 1: Search & Date Range & Status */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Search Box */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cari aksi, pelaku, ID data, atau alasan"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-semibold shrink-0">
            Waktu:
          </span>
          {[
            { key: "ALL", label: "Semua" },
            { key: "TODAY", label: "Hari ini" },
            { key: "LAST_7_DAYS", label: "7 Hari" },
            { key: "LAST_30_DAYS", label: "30 Hari" },
          ].map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => onDateFilterChange(d.key as DateFilterType)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-lg font-medium shrink-0 transition-colors cursor-pointer",
                dateFilter === d.key
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1 w-full md:w-auto">
          <span className="text-xs text-muted-foreground font-semibold shrink-0">
            Status:
          </span>
          {(["ALL", "SUCCESS", "WARNING", "FAILED"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => onStatusChange(st)}
              className={cn(
                "px-2 py-1 text-[11px] rounded-lg font-semibold transition-colors cursor-pointer",
                selectedStatus === st
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {st === "ALL" ? "Semua" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: User, Role, and Module Filters */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
        {/* User / Actor Dropdown */}
        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            User:
          </span>
          <NativeSelect
            value={selectedActor}
            onChange={(e) => onActorChange(e.target.value)}
            className="h-8 text-xs font-medium"
          >
            <option value="ALL">Semua pengguna</option>
            {uniqueActors.map((actor) => (
              <option key={actor} value={actor}>
                {actor}
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* Role Dropdown */}
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            Role:
          </span>
          <NativeSelect
            value={selectedRole}
            onChange={(e) => onRoleChange(e.target.value)}
            className="h-8 text-xs font-medium"
          >
            <option value="ALL">Semua jabatan</option>
            {uniqueRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* Module Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          <span className="text-[10px] text-muted-foreground font-bold shrink-0 uppercase mr-1">
            Modul:
          </span>
          <NativeSelect
            value={selectedModule}
            onChange={(e) => onModuleChange(e.target.value)}
            className="h-8 text-xs font-medium"
          >
            {MODULE_OPTIONS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
    </Card>
  );
}
