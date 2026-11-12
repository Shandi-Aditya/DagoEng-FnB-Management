import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "info" | "destructive" | "neutral";

const TONE_CLASS: Record<Exclude<StatusTone, "neutral">, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  destructive: "bg-destructive/10 text-destructive",
};

export interface StatusBadgeProps {
  status: StatusTone;
  children: ReactNode;
  className?: string;
}

/** Status label colored by meaning only. Neutral states use the secondary badge. */
export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  if (status === "neutral") {
    return (
      <Badge variant="secondary" className={className}>
        {children}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn("border-transparent", TONE_CLASS[status], className)}>
      {children}
    </Badge>
  );
}
