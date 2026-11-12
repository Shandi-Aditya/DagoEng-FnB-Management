"use client";

import { GitCommit, Search, Table as TableIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type DateFilterType,
  MODULE_OPTIONS,
  type ViewMode,
} from "@/features/activity-log/activity-log-domain";

export interface ActivityLogFilterBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
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
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

const DATE_OPTIONS: readonly { key: DateFilterType; label: string }[] = [
  { key: "ALL", label: "Semua waktu" },
  { key: "TODAY", label: "Hari ini" },
  { key: "LAST_7_DAYS", label: "7 hari terakhir" },
  { key: "LAST_30_DAYS", label: "30 hari terakhir" },
];

const STATUS_OPTIONS = [
  { key: "ALL", label: "Semua status" },
  { key: "SUCCESS", label: "Berhasil" },
  { key: "WARNING", label: "Peringatan" },
  { key: "FAILED", label: "Gagal" },
] as const;

export function ActivityLogFilterBar({
  viewMode,
  onViewModeChange,
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
  hasActiveFilters,
  onResetFilters,
}: ActivityLogFilterBarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-full overflow-x-auto no-scrollbar">
          <Tabs value={viewMode} onValueChange={(value) => onViewModeChange(value as ViewMode)}>
            <TabsList aria-label="Tampilan log aktivitas">
              <TabsTrigger value="TABLE">
                <TableIcon />
                Tabel
              </TabsTrigger>
              <TabsTrigger value="TIMELINE">
                <GitCommit />
                Riwayat
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <InputGroup className="sm:max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari pelaku, aksi, atau ID data"
            aria-label="Cari aktivitas"
          />
        </InputGroup>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          value={dateFilter}
          onChange={(e) => onDateFilterChange(e.target.value as DateFilterType)}
          aria-label="Filter waktu"
        >
          {DATE_OPTIONS.map((opt) => (
            <NativeSelectOption key={opt.key} value={opt.key}>
              {opt.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <NativeSelect
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          aria-label="Filter status"
        >
          {STATUS_OPTIONS.map((opt) => (
            <NativeSelectOption key={opt.key} value={opt.key}>
              {opt.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <NativeSelect
          value={selectedModule}
          onChange={(e) => onModuleChange(e.target.value)}
          aria-label="Filter modul"
        >
          {MODULE_OPTIONS.map((mod) => (
            <NativeSelectOption key={mod.key} value={mod.key}>
              {mod.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <NativeSelect
          value={selectedActor}
          onChange={(e) => onActorChange(e.target.value)}
          aria-label="Filter pengguna"
        >
          <NativeSelectOption value="ALL">Semua pengguna</NativeSelectOption>
          {uniqueActors.map((actor) => (
            <NativeSelectOption key={actor} value={actor}>
              {actor}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <NativeSelect
          value={selectedRole}
          onChange={(e) => onRoleChange(e.target.value)}
          aria-label="Filter jabatan"
        >
          <NativeSelectOption value="ALL">Semua jabatan</NativeSelectOption>
          {uniqueRoles.map((role) => (
            <NativeSelectOption key={role} value={role}>
              {role}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={onResetFilters}>
            Hapus filter
          </Button>
        ) : null}
      </div>
    </div>
  );
}
