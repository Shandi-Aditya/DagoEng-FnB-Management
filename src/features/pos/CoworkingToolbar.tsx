"use client";

import { Calendar, Search } from "lucide-react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const COWORKING_TYPE_FILTERS = [
  { key: "ALL", label: "Semua tipe" },
  { key: "HOT_DESK", label: "Hot desk" },
  { key: "DEDICATED_DESK", label: "Dedicated desk" },
  { key: "MEETING_ROOM", label: "Meeting room" },
  { key: "PRIVATE_POD", label: "Private pod" },
] as const;

interface CoworkingToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  spaceTypeFilter: string;
  onSpaceTypeFilterChange: (type: string) => void;
  date: string;
  minDate: string;
  onDateChange: (date: string) => void;
}

/** Search, space type filter tabs, and date selection for the co-working screen. */
export function CoworkingToolbar({
  searchQuery,
  onSearchChange,
  spaceTypeFilter,
  onSpaceTypeFilterChange,
  date,
  minDate,
  onDateChange,
}: CoworkingToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-xs md:flex-row md:items-center md:justify-between">
      <div className="flex-1">
        <InputGroup className="w-full">
          <InputGroupAddon align="inline-start">
            <Search className="size-4 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari nama ruang, meja, atau tipe"
          />
        </InputGroup>
      </div>

      <div className="overflow-x-auto no-scrollbar">
        <Tabs
          value={spaceTypeFilter}
          onValueChange={(val) => onSpaceTypeFilterChange(val as string)}
        >
          <TabsList>
            {COWORKING_TYPE_FILTERS.map((f) => (
              <TabsTrigger key={f.key} value={f.key}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-input bg-input/20 px-2.5 py-1 text-xs">
        <Calendar className="size-3.5 text-muted-foreground shrink-0" />
        <input
          type="date"
          value={date}
          min={minDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="bg-transparent text-xs font-medium text-foreground outline-none"
        />
      </div>
    </div>
  );
}
