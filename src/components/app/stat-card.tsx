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

export interface StatCardProps {
  label: string;
  value: string;
  change?: StatChange;
  /** Optional quiet line under the value, e.g. "53 transaksi" */
  hint?: ReactNode;
  className?: string;
}

function changeColor(value: number): string {
  if (value > 0) return "text-success";
  if (value < 0) return "text-destructive";
  return "text-muted-foreground";
}

/** A number with its label and change. No icons, sparklines or decoration. */
export function StatCard({ label, value, change, hint, className }: StatCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <span className="text-2xl font-medium tabular-nums text-foreground">{value}</span>
        {change ? (
          <span className={cn("text-xs tabular-nums", changeColor(change.value))}>
            {formatChange(change.value, change.comparison)}
          </span>
        ) : null}
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </CardContent>
    </Card>
  );
}
