"use client";

import { Calendar, Users, DollarSign, Settings, LayoutDashboard } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export type OrganizerNavView = "EVENTS" | "ATTENDEES" | "FINANCE" | "SETTINGS" | "HOME" | "SUBMIT";

interface OrganizerTabsProps {
  activeNav: OrganizerNavView;
  onNavChange: (nav: OrganizerNavView) => void;
  eventCount?: number;
  bookingCount?: number;
}

export function OrganizerTabs({
  activeNav,
  onNavChange,
  eventCount,
  bookingCount,
}: OrganizerTabsProps) {
  return (
    <Tabs
      value={activeNav}
      onValueChange={(val) => onNavChange(val as OrganizerNavView)}
      className="w-full"
    >
      <TabsList className="w-full sm:w-auto grid grid-cols-5 sm:inline-flex h-auto p-1 bg-muted/60">
        <TabsTrigger value="EVENTS" className="gap-1.5 text-xs">
          <Calendar className="size-4" />
          <span>Event</span>
          {typeof eventCount === "number" && (
            <Badge variant="secondary" className="px-1.5 py-0 text-xs">
              {eventCount}
            </Badge>
          )}
        </TabsTrigger>

        <TabsTrigger value="ATTENDEES" className="gap-1.5 text-xs">
          <Users className="size-4" />
          <span>Peserta</span>
          {typeof bookingCount === "number" && (
            <Badge variant="secondary" className="px-1.5 py-0 text-xs">
              {bookingCount}
            </Badge>
          )}
        </TabsTrigger>

        <TabsTrigger value="FINANCE" className="gap-1.5 text-xs">
          <DollarSign className="size-4" />
          <span>Keuangan</span>
        </TabsTrigger>

        <TabsTrigger value="SETTINGS" className="gap-1.5 text-xs">
          <Settings className="size-4" />
          <span>Pengaturan</span>
        </TabsTrigger>

        <TabsTrigger value="HOME" className="gap-1.5 text-xs">
          <LayoutDashboard className="size-4" />
          <span>Ringkasan</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
