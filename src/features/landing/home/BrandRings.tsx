import { cn } from "@/lib/utils";

/**
 * The four letters of the DagoEng mark (d, a, g, o), drawn in the business-unit colours.
 * Decorative only: used large and cropped behind cards, never as the logo itself.
 */
export function BrandRings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 370" fill="none" strokeWidth={24} strokeLinecap="round" aria-hidden className={cn("pointer-events-none", className)}>
      <g className="stroke-unit-fnb">
        <circle cx="70" cy="95" r="50" />
        <path d="M 120 14 L 120 145" />
      </g>
      <g className="stroke-unit-coworking">
        <circle cx="210" cy="95" r="50" />
        <path d="M 260 45 L 260 145" />
      </g>
      <g className="stroke-unit-event">
        <circle cx="70" cy="235" r="50" />
        <path d="M 120 185 L 120 285 C 120 335, 95 355, 60 355 C 30 355, 20 340, 20 340" />
      </g>
      <g className="stroke-unit-loyalty">
        <circle cx="210" cy="235" r="50" />
      </g>
    </svg>
  );
}
