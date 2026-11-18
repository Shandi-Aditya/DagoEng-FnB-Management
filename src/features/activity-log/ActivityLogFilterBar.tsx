"use client";

import { GitCommit, Search, Table as TableIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  customStartDate?: string;
  customEndDate?: string;
  onCustomStartDateChange?: (v: string) => void;
  onCustomEndDateChange?: (v: string) => void;
  selectedStatus: string;
  onStatusChange: (v: string) => void;
  selectedSeverity?: string;
  onSeverityChange?: (v: string) => void;
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
  { key: "CUSTOM", label: "Rentang khusus" },
];

const STATUS_OPTIONS = [
  { key: "ALL", label: "Semua status" },
  { key: "SUCCESS", label: "Berhasil" },
  { key: "WARNING", label: "Peringatan" },
  { key: "FAILED", label: "Gagal" },
] as const;

const SEVERITY_OPTIONS = [
  { key: "ALL", label: "Semua tingkat" },
  { key: "INFO", label: "Info" },
  { key: "LOW", label: "Rendah" },
  { key: "MEDIUM", label: "Sedang" },
  { key: "HIGH", label: "Tinggi" },
  { key: "CRITICAL", label: "Kritis" },
] as const;

export function ActivityLogFilterBar({
  viewMode,
  onViewModeChange,
  searchTerm,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  customStartDate = "",
  customEndDate = "",
  onCustomStartDateChange,
  onCustomEndDateChange,
  selectedStatus,
  onStatusChange,
  selectedSeverity = "ALL",
  onSeverityChange,
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

        {dateFilter === "CUSTOM" && onCustomStartDateChange && onCustomEndDateChange ? (
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={customStartDate}
              onChange={(e) => onCustomStartDateChange(e.target.value)}
              aria-label="Tanggal mulai audit"
              className="w-36"
            />
            <span className="text-xs text-muted-foreground">s/d</span>
            <Input
              type="date"
              value={customEndDate}
              onChange={(e) => onCustomEndDateChange(e.target.value)}
              aria-label="Tanggal akhir audit"
              className="w-36"
            />
          </div>
        ) : null}

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

        {onSeverityChange ? (
          <NativeSelect
            value={selectedSeverity}
            onChange={(e) => onSeverityChange(e.target.value)}
            aria-label="Filter tingkat risiko"
          >
            {SEVERITY_OPTIONS.map((opt) => (
              <NativeSelectOption key={opt.key} value={opt.key}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : null}

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
