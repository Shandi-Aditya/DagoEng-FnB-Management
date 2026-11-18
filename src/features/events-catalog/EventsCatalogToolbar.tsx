"use client";

import React from "react";
import { History, RotateCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventDateRangeFilter, type DateRange } from "@/components/events/EventDateRangeFilter";
import {
  CATALOG_CATEGORIES,
  type EventPriceFilter,
  type EventTimeTab,
} from "./events-catalog-domain";

interface EventsCatalogToolbarProps {
  viewTab: EventTimeTab;
  onViewTabChange: (tab: EventTimeTab) => void;
  upcomingCount: number;
  pastCount: number;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  priceFilter: EventPriceFilter;
  onPriceFilterChange: (price: EventPriceFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateRange?: DateRange | null;
  onDateRangeChange?: (range: DateRange | null) => void;
  hasFilterActive?: boolean;
  onResetFilter?: () => void;
}

export function EventsCatalogToolbar({
  viewTab,
  onViewTabChange,
  upcomingCount,
  pastCount,
  selectedCategory,
  onSelectCategory,
  priceFilter,
  onPriceFilterChange,
  searchQuery,
  onSearchChange,
  dateRange = null,
  onDateRangeChange,
  hasFilterActive = false,
  onResetFilter,
}: EventsCatalogToolbarProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <Tabs
          value={viewTab}
          onValueChange={(val) => onViewTabChange(val as EventTimeTab)}
        >
          <TabsList className="h-auto p-1 bg-muted/60">
            <TabsTrigger value="UPCOMING" className="gap-1.5 text-xs">
              <span>Event mendatang</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                {upcomingCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="PAST" className="gap-1.5 text-xs">
              <History className="size-3.5" />
              <span>Telah selesai</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                {pastCount}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2.5 flex-1 lg:justify-end">
          <div className="min-w-[200px] flex-1 sm:max-w-xs">
            <InputGroup>
              <InputGroupAddon>
                <Search className="size-4 text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Cari acara, topik, komunitas..."
                aria-label="Cari event"
              />
            </InputGroup>
          </div>

          <div className="w-36 shrink-0">
            <NativeSelect
              value={priceFilter}
              onChange={(e) => onPriceFilterChange(e.target.value as EventPriceFilter)}
              aria-label="Filter harga event"
            >
              <NativeSelectOption value="ALL">Semua tiket</NativeSelectOption>
              <NativeSelectOption value="FREE">Gratis</NativeSelectOption>
              <NativeSelectOption value="PAID">Berbayar</NativeSelectOption>
            </NativeSelect>
          </div>

          {onDateRangeChange ? (
            <EventDateRangeFilter
              initialRange={dateRange}
              onApplyFilter={onDateRangeChange}
              label="Tanggal acara"
              align="right"
            />
          ) : null}

          {hasFilterActive && onResetFilter ? (
            <Button variant="ghost" size="lg" onClick={onResetFilter}>
              <RotateCcw />
              <span>Reset filter</span>
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs value={selectedCategory} onValueChange={(value) => onSelectCategory(String(value))}>
        <TabsList variant="line" aria-label="Kategori event" className="max-w-full justify-start overflow-x-auto no-scrollbar">
          {CATALOG_CATEGORIES.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="flex-none px-2">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
