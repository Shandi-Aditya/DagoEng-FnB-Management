import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-brand-orange text-white hover:bg-[#C2410C] shadow-xs",
        secondary: "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/90 shadow-2xs font-semibold",
        outline: "border border-slate-300/80 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs",
        ghost: "hover:bg-slate-100/80 text-slate-700",
        cyan: "bg-sky-600 text-white hover:bg-sky-700 shadow-xs",
        green: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs",
        danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-xs",
        link: "text-brand-orange underline-offset-4 hover:underline font-medium",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs font-medium",
        lg: "h-11 rounded-lg px-6 text-base font-semibold",
        icon: "h-9 w-9 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
