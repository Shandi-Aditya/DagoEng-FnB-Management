"use client";

import React from "react";
import { History, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
}: EventsCatalogToolbarProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* 1. Time Tab & Search Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

        <div className="flex items-center gap-2.5 flex-1 sm:max-w-md">
          <div className="flex-1">
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
        </div>
      </div>

      {/* 2. Category Selection Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATALOG_CATEGORIES.map((tab) => {
          const isActive = selectedCategory === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSelectCategory(tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
