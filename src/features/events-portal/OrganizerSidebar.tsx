"use client";

import React, { type ComponentProps } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  Users,
  DollarSign,
  Settings,
  LayoutDashboard,
  ExternalLink,
  LogOut,
  ChevronsUpDown,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
    SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UNIT_ICON_CLASS } from "@/components/app/unit-dot";
import type { OrganizerNavView } from "./OrganizerTabs";

interface OrganizerSidebarProps extends ComponentProps<typeof Sidebar> {
  activeNav: OrganizerNavView;
  onNavChange: (nav: OrganizerNavView) => void;
  /** Events waiting on the organizer (revision or a split proposal). */
  actionCount?: number;
  bookingCount?: number;
  organizerName: string;
  organizerEmail: string;
  userInitial: string;
  onLogout: () => void;
}

const NAV_ITEMS: readonly { id: OrganizerNavView; label: string; icon: typeof Calendar }[] = [
  { id: "HOME", label: "Ringkasan", icon: LayoutDashboard },
  { id: "EVENTS", label: "Event", icon: Calendar },
  { id: "ATTENDEES", label: "Peserta", icon: Users },
  { id: "FINANCE", label: "Keuangan", icon: DollarSign },
  { id: "SETTINGS", label: "Pengaturan", icon: Settings },
];

export function OrganizerSidebar({
  activeNav,
  onNavChange,
  actionCount,
  bookingCount,
  organizerName,
  organizerEmail,
  userInitial,
  onLogout,
  ...props
}: OrganizerSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavClick = (nav: OrganizerNavView) => {
    onNavChange(nav);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/events/portal" />}>
              <span className="flex size-8 shrink-0 items-center justify-center">
                <Image src="/logo-dagoeng.svg" alt="" width={20} height={26} priority />
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">Dago Creative Hub</span>
                <span className="truncate text-xs text-muted-foreground">
                  {organizerName || "Portal penyelenggara"}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const count = id === "EVENTS" ? actionCount : id === "ATTENDEES" ? bookingCount : undefined;
              return (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton isActive={activeNav === id} onClick={() => handleNavClick(id)} tooltip={label}>
                    <Icon className={UNIT_ICON_CLASS.event} />
                    <span>{label}</span>
                    {typeof count === "number" && count > 0 && (
                      <Badge
                        variant={id === "EVENTS" ? "default" : "secondary"}
                        className="ml-auto px-1.5 py-0 text-xs"
                        aria-label={id === "EVENTS" ? `${count} event perlu tindakan` : undefined}
                      >
                        {count}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="aria-expanded:bg-sidebar-accent" />}>
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">{userInitial || "M"}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{organizerName || "Penyelenggara"}</span>
                  <span className="truncate text-xs text-muted-foreground">{organizerEmail}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-56"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="size-8 rounded-lg">
                        <AvatarFallback className="rounded-lg">{userInitial || "M"}</AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">{organizerName || "Penyelenggara"}</span>
                        <span className="truncate text-xs text-muted-foreground">{organizerEmail}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/events" target="_blank" rel="noopener noreferrer" />}>
                  <ExternalLink />
                  <span>Lihat halaman event publik</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLogout} className="text-destructive">
                  <LogOut />
                  <span>Keluar</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
