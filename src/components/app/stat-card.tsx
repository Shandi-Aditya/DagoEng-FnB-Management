import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { formatChange } from "./format-change";

export interface StatChange {
  /** Percentage change, e.g. 12 for +12% */
  value: number;
  /** What the change is compared to, e.g. "bulan lalu" */
  comparison: string;
}

export type StatTone = "destructive" | "warning" | "success" | "info" | "primary" | "muted";

export interface StatCardProps {
  label: string;
  value: string;
  valueTone?: StatTone;
  change?: StatChange;
  /** Optional quiet line under the value, e.g. "53 transaksi" */
  hint?: ReactNode;
  hintTone?: StatTone;
  className?: string;
}

function changeColor(value: number): string {
  if (value > 0) return "text-success";
  if (value < 0) return "text-destructive";
  return "text-muted-foreground";
}

function toneClasses(tone?: StatTone, fallback = "text-muted-foreground"): string {
  switch (tone) {
    case "destructive":
      return "text-destructive font-medium";
    case "warning":
      return "text-warning font-medium";
    case "success":
      return "text-success font-medium";
    case "info":
      return "text-info font-medium";
    case "primary":
      return "text-primary font-medium";
    case "muted":
      return "text-muted-foreground";
    default:
      return fallback;
  }
}

/** A number with its label and change. No icons, sparklines or decoration. */
export function StatCard({
  label,
  value,
  valueTone,
  change,
  hint,
  hintTone,
  className,
}: StatCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <span className={cn("text-2xl font-medium tabular-nums", toneClasses(valueTone, "text-foreground"))}>
          {value}
        </span>
        {change ? (
          <span className={cn("text-xs tabular-nums", changeColor(change.value))}>
            {formatChange(change.value, change.comparison)}
          </span>
        ) : null}
        {hint ? (
          <span className={cn("text-xs", toneClasses(hintTone, "text-muted-foreground"))}>
            {hint}
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
