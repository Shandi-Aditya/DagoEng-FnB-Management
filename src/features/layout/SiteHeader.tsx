"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Calendar } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { getAuthorizedNavItems } from "@/lib/rbac";

import { ModeToggle } from "./ModeToggle";
import { NotificationMenu } from "./NotificationMenu";
import { RoleAwareStatusPill } from "./RoleAwareStatusPill";
import { findActiveNavItem } from "./nav-groups";

const ACTIVE_OUTLET_LABEL = "Outlet Singaraja (Pusat)";

export function SiteHeader() {
  const pathname = usePathname();
  const { user, activeOrgModules } = useAuth();
  const { formattedRangeLabel } = useDateFilter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const navItems = getAuthorizedNavItems(user, activeOrgModules);
  const pageTitle = findActiveNavItem(navItems, pathname)?.name ?? "Dago Creative Hub";

  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/95 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full min-w-0 items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
        <h1 className="truncate text-base font-medium">{pageTitle}</h1>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="hidden h-6 gap-1.5 px-2 text-xs sm:inline-flex">
            <span className="size-1.5 rounded-full bg-success" aria-hidden />
            {ACTIVE_OUTLET_LABEL}
          </Badge>
          <div className="hidden xl:block">
            <RoleAwareStatusPill />
          </div>
          {isMounted && formattedRangeLabel ? (
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground tabular-nums md:flex">
              <Calendar className="size-3.5" />
              {formattedRangeLabel}
            </span>
          ) : null}
          <Separator orientation="vertical" className="mx-1 hidden h-4 data-vertical:self-auto md:block" />
          <ModeToggle />
          <NotificationMenu />
        </div>
      </div>
    </header>
  );
}
