"use client";

import { Clock, Laptop, Utensils } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type PosMode = "FNB" | "COWORKING";

interface PosToolbarProps {
  mode: PosMode;
  onModeChange: (mode: PosMode) => void;
  cartCount: number;
  activeShift: { shiftName: string; assignedCashierName: string } | null | undefined;
  onOpenShift: () => void;
  onCloseShift: () => void;
}

/** Mode switch plus the cashier's shift state. No shift means no payments. */
export function PosToolbar({ mode, onModeChange, cartCount, activeShift, onOpenShift, onCloseShift }: PosToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Tabs value={mode} onValueChange={(value) => onModeChange(value as PosMode)}>
        <TabsList>
          <TabsTrigger value="FNB">
            <Utensils />
            F&B
            {cartCount > 0 ? (
              <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 tabular-nums">{cartCount}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="COWORKING">
            <Laptop />
            Co-working
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeShift ? (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden h-6 gap-1.5 sm:inline-flex">
            <span className="size-1.5 rounded-full bg-success" aria-hidden />
            {activeShift.shiftName} · {activeShift.assignedCashierName}
          </Badge>
          <Button variant="ghost" size="sm" onClick={onCloseShift}>
            Tutup shift
          </Button>
        </div>
      ) : (
        <Button size="sm" onClick={onOpenShift}>
          <Clock />
          Buka shift
        </Button>
      )}
    </div>
  );
}
