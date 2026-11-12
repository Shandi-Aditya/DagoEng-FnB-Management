"use client";

import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EventDateRangeFilter,
  type DateRange,
} from "@/components/events/EventDateRangeFilter";

export const STATUS_TABS = [
  { key: "ALL", label: "Semua" },
  { key: "PENDING", label: "Menunggu review" },
  { key: "REVENUE_SPLIT", label: "Bagi hasil" },
  { key: "APPROVED", label: "Disetujui" },
  { key: "REVISION_REQUESTED", label: "Perlu revisi" },
  { key: "REJECTED", label: "Ditolak" },
  { key: "ARCHIVED", label: "Arsip" },
] as const;

export interface EventsModerationToolbarProps {
  statusTab: string;
  onStatusTabChange: (tab: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateRange: DateRange | null;
  onDateRangeChange: (range: DateRange | null) => void;
  pendingCount?: number;
}

export function EventsModerationToolbar({
  statusTab,
  onStatusTabChange,
  searchQuery,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  pendingCount = 0,
}: EventsModerationToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Status Queue Tabs */}
      <Tabs value={statusTab} onValueChange={onStatusTabChange}>
        <TabsList className="w-full justify-start overflow-x-auto no-scrollbar">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5">
              <span>{tab.label}</span>
              {tab.key === "PENDING" && pendingCount > 0 ? (
                <Badge variant="secondary">
                  {pendingCount}
                </Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Filter and Search Controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 max-w-sm">
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="Cari judul, penyelenggara, lokasi…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Cari event"
            />
          </InputGroup>
        </div>

        <div className="flex items-center gap-2">
          <EventDateRangeFilter
            initialRange={dateRange}
            onApplyFilter={onDateRangeChange}
          />
        </div>
      </div>
    </div>
  );
}
