import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface LandingSectionProps {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Shared section frame: anchor target, heading, consistent rhythm. */
export function LandingSection({ id, title, description, action, className, children }: LandingSectionProps) {
  return (
    <section id={id} className={cn("scroll-mt-16 border-t py-16 sm:py-20", className)}>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
            {description ? <p className="text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
        </div>
        {children}
      </div>
    </section>
  );
}
