import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary/20 dark:border-primary/40 bg-primary/10 dark:bg-primary/20 text-primary dark:text-emerald-300",
        primary: "border-primary/30 dark:border-primary/50 bg-primary/10 dark:bg-primary/20 text-primary dark:text-emerald-300 font-bold",
        secondary: "border-slate-200/80 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium",
        info: "border-sky-200/70 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200",
        success: "border-emerald-200/70 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200",
        warning: "border-amber-200/70 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200",
        danger: "border-rose-200/70 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200",
        outline: "text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
