"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "@/features/layout/AppSidebar";
import { SiteHeader } from "@/features/layout/SiteHeader";
import { evaluateRouteAccess } from "@/lib/route-guard";
import { cn } from "@/lib/utils";

// Counter screens (cashier, kitchen) drop the max width so they can use a wide
// monitor. Padding is the same on every page, so content starts at the same
// distance from the sidebar everywhere.
const FULL_WIDTH_ROUTES = new Set(["/pos", "/kitchen"]);

const SHELL_STYLE = {
  "--sidebar-width": "calc(var(--spacing) * 64)",
  "--header-height": "calc(var(--spacing) * 12)",
} as CSSProperties;

function StatusScreen({ message, tone = "default" }: { message: string; tone?: "default" | "destructive" }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <Spinner className={cn("size-6", tone === "destructive" ? "text-destructive" : "text-muted-foreground")} />
        <p className={cn("text-sm", tone === "destructive" ? "text-destructive" : "text-muted-foreground")}>
          {message}
        </p>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, isLoggingOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isFullWidthPage = FULL_WIDTH_ROUTES.has(pathname);

  useEffect(() => {
    if (!isLoading && user === null) {
      router.push("/login");
      return;
    }

    if (!isLoading && user) {
      const evaluation = evaluateRouteAccess(pathname, user.role.slug);
      if (!evaluation.allowed && evaluation.redirectTo) {
        router.push(evaluation.redirectTo);
      }
    }
  }, [user, isLoading, pathname, router]);

  if (!user && !isLoading) {
    // During active logout, let LogoutOverlay render without the fallback screen
    if (isLoggingOut) return null;
    return <StatusScreen message="Sesi telah berakhir. Mengarahkan ke halaman login" />;
  }

  if (user && !isLoading) {
    const evaluation = evaluateRouteAccess(pathname, user.role.slug);
    if (!evaluation.allowed) {
      return (
        <StatusScreen
          tone="destructive"
          message={`Role ${user.role.name} tidak punya akses ke halaman ini. Mengalihkan`}
        />
      );
    }
  }

  return (
    <SidebarProvider style={SHELL_STYLE}>
      <AppSidebar variant="inset" />
      <SidebarInset className="min-w-0 max-w-full overflow-x-hidden">
        <SiteHeader />
        <div
          className={cn(
            "flex w-full min-w-0 flex-1 flex-col p-4 lg:p-6",
            !isFullWidthPage && "mx-auto max-w-7xl",
          )}
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
