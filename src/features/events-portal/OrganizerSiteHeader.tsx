"use client";

import React from "react";
import { Plus, ScanLine } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/features/layout/ModeToggle";
import type { OrganizerNavView } from "./OrganizerTabs";

interface OrganizerSiteHeaderProps {
  activeNav: OrganizerNavView;
  onOpenCheckIn: () => void;
  /** Absent for admins in supervision mode: they do not submit events as an organizer. */
  onSubmitEvent?: () => void;
}

const NAV_TITLES: Record<OrganizerNavView, string> = {
  HOME: "Ringkasan",
  EVENTS: "Event",
  ATTENDEES: "Peserta",
  FINANCE: "Keuangan",
  SETTINGS: "Pengaturan",
  SUBMIT: "Ajukan event",
};

/** Page title plus the two things an organizer does from anywhere: check guests in and submit an event. */
export function OrganizerSiteHeader({ activeNav, onOpenCheckIn, onSubmitEvent }: OrganizerSiteHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/95 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full min-w-0 items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
        <h1 className="truncate text-base font-medium">{NAV_TITLES[activeNav]}</h1>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ModeToggle />
          <Button size="sm" variant="outline" onClick={onOpenCheckIn}>
            <ScanLine />
            Check-in
          </Button>
          {onSubmitEvent && activeNav !== "SUBMIT" && (
            <Button size="sm" onClick={onSubmitEvent} aria-label="Ajukan event">
              <Plus />
              <span className="hidden sm:inline">Ajukan event</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
