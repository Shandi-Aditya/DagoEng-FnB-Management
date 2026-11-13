"use client";

import React from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { DataPagination } from "@/components/app/data-pagination";
import type { PublicCommunityEvent } from "@/types/event";
import { EventCard } from "./EventCard";
import type { EventTimeTab } from "./events-catalog-domain";

interface EventsCatalogGridProps {
  events: PublicCommunityEvent[];
  isLoading: boolean;
  viewTab: EventTimeTab;
  emptyMessage: { title: string; description: string };
  hasFilterActive: boolean;
  onResetFilter: () => void;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function EventsCatalogGrid({
  events,
  isLoading,
  viewTab,
  emptyMessage,
  hasFilterActive,
  onResetFilter,
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: EventsCatalogGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-80 rounded-xl border bg-muted/40 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        className="border"
        icon={<Calendar className="size-8 text-muted-foreground" />}
        title={emptyMessage.title}
        description={emptyMessage.description}
        action={
          hasFilterActive ? (
            <Button variant="outline" size="sm" onClick={onResetFilter}>
              Reset filter
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            isPast={viewTab === "PAST"}
          />
        ))}
      </div>

      <DataPagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        itemLabel="event"
      />
    </div>
  );
}
