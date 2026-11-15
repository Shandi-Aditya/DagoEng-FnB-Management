"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/features/layout/ModeToggle";

interface WaiterHeaderProps {
  outletName: string;
}

export function WaiterHeader({ outletName }: WaiterHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur shadow-xs">
      <div className="mx-auto flex max-w-6xl items-center justify-between p-3.5 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg border bg-primary/10 text-primary">
            <UtensilsCrossed className="size-4" />
          </div>
          <div>
            <h1 className="text-sm font-medium leading-none text-foreground">
              Lantai pramusaji
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Outlet: <span className="font-medium text-foreground">{outletName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ModeToggle />
          <Button
            variant="outline"
            size="lg"
            render={<Link href="/dashboard" />}
            nativeButton={false}
          >
            <ArrowLeft className="size-3.5" />
            <span>Dashboard</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
