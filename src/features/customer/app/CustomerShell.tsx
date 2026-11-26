"use client";

import { Armchair, Laptop, ReceiptText, UserRound, UtensilsCrossed } from "lucide-react";

import { UNIT_ICON_CLASS, type BusinessUnit } from "@/components/app/unit-dot";
import { UnitScope } from "@/components/app/unit-scope";
import { Badge } from "@/components/ui/badge";
import { HomeNav } from "@/features/landing/home/HomeNav";
import { cn } from "@/lib/utils";

export type CustomerView = "space" | "order" | "activity" | "account";

// Each view belongs to one business unit, so its accent (buttons, filters, nav) matches
// the dashboard: Ruang is co-working, Pesan is F&B, Aktivitas is event tickets and
// bookings, Akun is loyalty.
const NAV: readonly { id: CustomerView; label: string; icon: React.ReactNode; unit: BusinessUnit }[] = [
  { id: "space", label: "Ruang", icon: <Laptop />, unit: "coworking" },
  { id: "order", label: "Pesan", icon: <UtensilsCrossed />, unit: "fnb" },
  { id: "activity", label: "Aktivitas", icon: <ReceiptText />, unit: "event" },
  { id: "account", label: "Akun", icon: <UserRound />, unit: "loyalty" },
];

interface CustomerShellProps {
  view: CustomerView;
  onViewChange: (view: CustomerView) => void;
  /** Shown in the page title area by the views; kept for future multi-outlet picking. */
  tableNumber: string | null;
  activeCount: number;
  children: React.ReactNode;
}

/** Phone-first frame: brand bar on top, the four jobs in a thumb-reach bar at the bottom. */
export function CustomerShell({ view, onViewChange, tableNumber, activeCount, children }: CustomerShellProps) {
  const activeUnit = NAV.find((item) => item.id === view)?.unit;

  return (
    <div data-unit={activeUnit} className="flex min-h-svh flex-col bg-background">
      <UnitScope unit={activeUnit} />
      <HomeNav
        showCta={false}
        showLinks={false}
        extra={
          tableNumber ? (
            <Badge variant="outline" className="gap-1.5">
              <Armchair className="text-unit-fnb" />
              Meja {tableNumber}
            </Badge>
          ) : null
        }
      />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-5 pb-28">{children}</main>

      <nav
        aria-label="Menu aplikasi"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85"
      >
        <ul className="mx-auto grid h-16 max-w-2xl grid-cols-4">
          {NAV.map((item) => {
            const isActive = item.id === view;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onViewChange(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex h-full w-full flex-col items-center justify-center gap-1 text-xs transition-colors [&_svg]:size-5",
                    isActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className={isActive ? UNIT_ICON_CLASS[item.unit] : undefined}>{item.icon}</span>
                  {item.label}
                  {item.id === "activity" && activeCount > 0 ? (
                    <span className="absolute top-2 left-1/2 ml-2 flex size-4 items-center justify-center rounded-full bg-primary font-mono text-xs text-primary-foreground tabular-nums">
                      {activeCount}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
