import { cn } from "@/lib/utils";

export type BusinessUnit = "fnb" | "coworking" | "event" | "loyalty";

export const UNIT_LABELS: Record<BusinessUnit, string> = {
  fnb: "F&B",
  coworking: "Co-working",
  event: "Event komunitas",
  loyalty: "Loyalty",
};

// Static class names so Tailwind can detect them
const UNIT_DOT_CLASS: Record<BusinessUnit, string> = {
  fnb: "bg-unit-fnb",
  coworking: "bg-unit-coworking",
  event: "bg-unit-event",
  loyalty: "bg-unit-loyalty",
};

/** Icon tint for a unit's menu items. Same logo colors as the dot, used on glyphs only. */
export const UNIT_ICON_CLASS: Record<BusinessUnit, string> = {
  fnb: "text-unit-fnb",
  coworking: "text-unit-coworking",
  event: "text-unit-event",
  loyalty: "text-unit-loyalty",
};

export interface UnitDotProps {
  unit: BusinessUnit;
  showLabel?: boolean;
  className?: string;
}

/** Small logo-color marker for a business unit. Never put text on the color itself. */
export function UnitDot({ unit, showLabel = false, className }: UnitDotProps) {
  const label = UNIT_LABELS[unit];

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden={showLabel ? true : undefined}
        aria-label={showLabel ? undefined : label}
        role={showLabel ? undefined : "img"}
        className={cn("size-2 shrink-0 rounded-full", UNIT_DOT_CLASS[unit])}
      />
      {showLabel ? <span>{label}</span> : null}
    </span>
  );
}
