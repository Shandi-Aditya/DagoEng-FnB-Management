"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AreaWithTables } from "./waiter-domain";

interface WaiterAreaTabsProps {
  areas: AreaWithTables[];
  selectedArea: string;
  onSelectArea: (areaId: string) => void;
  totalTablesCount: number;
}

export function WaiterAreaTabs({
  areas,
  selectedArea,
  onSelectArea,
  totalTablesCount,
}: WaiterAreaTabsProps) {
  return (
    <div className="border-b bg-background">
      <div className="mx-auto max-w-6xl px-4 py-2.5 sm:px-6">
        <Tabs value={selectedArea} onValueChange={onSelectArea}>
          <TabsList aria-label="Filter area meja" className="max-w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="ALL">
              <span>Semua area</span>
              <Badge variant="secondary" className="ml-1 tabular-nums">
                {totalTablesCount}
              </Badge>
            </TabsTrigger>
            {areas.map((a) => (
              <TabsTrigger key={a.id} value={a.id}>
                <span>{a.name}</span>
                <Badge variant="secondary" className="ml-1 tabular-nums">
                  {a.tables.length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
