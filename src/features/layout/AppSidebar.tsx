"use client";

import type { ComponentProps, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Building2,
  Calculator,
  Calendar,
  ClipboardList,
  Grid,
  LayoutDashboard,
  Laptop,
  Package,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  UtensilsCrossed,
} from "lucide-react";

import { UnitDot } from "@/components/app/unit-dot";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthorizedNavItems } from "@/lib/rbac";
import { getTenantName } from "@/lib/tenant";

import { NavUser } from "./NavUser";
import { findActiveNavItem, groupNavItems } from "./nav-groups";

// One icon set, no per-item colors (docs/DESIGN_SYSTEM.md section 6)
const ICONS: Record<string, ReactNode> = {
  LayoutDashboard: <LayoutDashboard />,
  Calculator: <Calculator />,
  ClipboardList: <ClipboardList />,
  Grid: <Grid />,
  UtensilsCrossed: <UtensilsCrossed />,
  Package: <Package />,
  BookOpen: <BookOpen />,
  Users: <Users />,
  BarChart3: <BarChart3 />,
  UserCheck: <UserCheck />,
  Sparkles: <Sparkles />,
  ShieldCheck: <ShieldCheck />,
  Settings: <Settings />,
  Laptop: <Laptop />,
  Building2: <Building2 />,
  Calendar: <Calendar />,
};

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { user, activeOrgModules } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();

  const navItems = getAuthorizedNavItems(user, activeOrgModules);
  const groups = groupNavItems(navItems);
  const activeHref = findActiveNavItem(navItems, pathname)?.href;
  const subtitle = user?.tenant ? getTenantName(user.tenant.id) : "Platform dan manajemen";

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" onClick={closeOnMobile} />}>
              <span className="flex size-8 shrink-0 items-center justify-center">
                <Image src="/logo-dago.png" alt="" width={24} height={30} priority className="object-contain" />
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">Dago Creative Hub</span>
                <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel className="gap-2">
              {group.unit ? <UnitDot unit={group.unit} /> : null}
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={item.href === activeHref}
                    tooltip={item.name}
                    render={<Link href={item.href} onClick={closeOnMobile} />}
                  >
                    {ICONS[item.icon] ?? <LayoutDashboard />}
                    <span>{item.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
