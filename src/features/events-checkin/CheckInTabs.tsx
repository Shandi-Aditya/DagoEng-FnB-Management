"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import type { CheckInStats } from "./events-checkin-domain";

interface CheckInTabsProps {
  activeTab: "UNCHECKED" | "CHECKED" | "ALL";
  onChangeTab: (tab: "UNCHECKED" | "CHECKED" | "ALL") => void;
  searchQuery: string;
  onChangeSearchQuery: (query: string) => void;
  stats: CheckInStats;
}

export function CheckInTabs({
  activeTab,
  onChangeTab,
  searchQuery,
  onChangeSearchQuery,
  stats,
}: CheckInTabsProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <Tabs
        value={activeTab}
        onValueChange={(val) => onChangeTab(val as "UNCHECKED" | "CHECKED" | "ALL")}
        className="w-full sm:w-auto"
      >
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
          <TabsTrigger value="UNCHECKED" className="text-xs">
            <span>Belum hadir</span>
            <Badge variant="secondary" className="ml-1 tabular-nums text-xs">
              {stats.uncheckedOrders}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="CHECKED" className="text-xs">
            <span>Sudah hadir</span>
            <Badge variant="secondary" className="ml-1 tabular-nums text-xs">
              {stats.checkedOrders}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="ALL" className="text-xs">
            <span>Semua</span>
            <Badge variant="secondary" className="ml-1 tabular-nums text-xs">
              {stats.totalOrders}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="w-full sm:w-72">
        <InputGroup>
          <InputGroupAddon>
            <Search className="text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={searchQuery}
            onChange={(e) => onChangeSearchQuery(e.target.value)}
            placeholder="Cari nama, kode, kontak..."
            aria-label="Cari tiket peserta"
          />
          {searchQuery && (
            <InputGroupAddon>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => onChangeSearchQuery("")}
                aria-label="Hapus pencarian"
              >
                <X />
              </Button>
            </InputGroupAddon>
          )}
        </InputGroup>
      </div>
    </div>
  );
}
