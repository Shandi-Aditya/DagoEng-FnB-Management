import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand-orange text-white",
        secondary: "border-transparent bg-slate-100 text-slate-800",
        info: "border-transparent bg-[#E5F7FF] text-[#0089C7]",
        success: "border-transparent bg-[#E6F9EE] text-[#009E42]",
        warning: "border-transparent bg-[#FFF8E1] text-[#B27B00]",
        danger: "border-transparent bg-red-100 text-red-700",
        outline: "text-slate-700 border-slate-300",
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
