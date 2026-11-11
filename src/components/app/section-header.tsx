import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SectionHeaderProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Heading for a block inside a page. Sentence case, no badge above it. */
export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
