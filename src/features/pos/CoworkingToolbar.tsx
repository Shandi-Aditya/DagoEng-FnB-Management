"use client";

import { Calendar, Search } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const COWORKING_TYPE_FILTERS = [
  { key: "ALL", label: "Semua tipe" },
  { key: "OPEN_SPACE", label: "Open space" },
  { key: "SPACE_MONITOR", label: "Space monitor" },
  { key: "SMALL_MEETING_ROOM", label: "Small meeting" },
  { key: "LARGE_MEETING_ROOM", label: "Large meeting" },
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
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <InputGroup className="w-full">
            <InputGroupAddon align="inline-start">
              <Search className="size-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari nama ruang, meja, atau tipe"
              aria-label="Cari nama ruang atau meja"
            />
          </InputGroup>
        </div>

        <label className={cn(buttonVariants({ variant: "outline", size: "lg" }), "shrink-0 cursor-pointer")}>
          <Calendar className="size-4 text-muted-foreground shrink-0" />
          <input
            type="date"
            value={date}
            min={minDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="bg-transparent text-xs font-medium text-foreground outline-none cursor-pointer"
            aria-label="Pilih tanggal operasional"
          />
        </label>
      </div>

      <div className="w-full">
        <Tabs
          value={spaceTypeFilter}
          onValueChange={(val) => onSpaceTypeFilterChange(val as string)}
        >
          <TabsList aria-label="Filter tipe ruang kerja" className="group-data-horizontal/tabs:h-auto w-full flex-wrap justify-start gap-1 p-1">
            {COWORKING_TYPE_FILTERS.map((f) => (
              <TabsTrigger key={f.key} value={f.key} className="flex-none h-7 px-2.5">
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
