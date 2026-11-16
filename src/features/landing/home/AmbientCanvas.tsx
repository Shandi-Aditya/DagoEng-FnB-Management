"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export type UnitTheme = "work" | "food" | "events" | "partners";

interface AmbientUnitSvgProps {
  unit: UnitTheme;
  prefix: string;
}

function AmbientUnitSvg({ unit, prefix }: AmbientUnitSvgProps) {
  if (unit === "work") {
    return (
      <div
        className="absolute inset-0 size-full"
        style={{
          background: "radial-gradient(130% 120% at 50% 15%, #00b2fe 0%, #0096dc 45%, #0077b6 100%)",
        }}
      >
        <svg
          className="absolute inset-0 size-full"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1200 700"
          preserveAspectRatio="none"
        >
          <defs>
            <filter id={`${prefix}-work-soft`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="22" />
            </filter>
            <filter id={`${prefix}-work-deep`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="40" />
            </filter>
            <linearGradient id={`${prefix}-work-wave-1`} x1="0%" y1="0%" x2="100%" y2="80%">
              <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#00b2fe" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id={`${prefix}-work-wave-2`} x1="100%" y1="10%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00b2fe" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#0284c7" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#0369a1" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <path
            d="M-50,70 C220,-70 480,180 820,30 C1040,-80 1180,60 1250,140 L1250,-50 L-50,-50 Z"
            fill={`url(#${prefix}-work-wave-1)`}
            filter={`url(#${prefix}-work-soft)`}
          />
          <path
            d="M-30,220 C260,80 520,350 880,160 C1080,40 1200,230 1250,300 L1250,-50 L-30,-50 Z"
            fill={`url(#${prefix}-work-wave-2)`}
            filter={`url(#${prefix}-work-deep)`}
            opacity="0.85"
          />
          <ellipse cx="280" cy="100" rx="260" ry="130" fill="#e0f2fe" opacity="0.65" filter={`url(#${prefix}-work-deep)`} />
          <ellipse cx="980" cy="150" rx="300" ry="160" fill="#7dd3fc" opacity="0.5" filter={`url(#${prefix}-work-deep)`} />
        </svg>
      </div>
    );
  }

  if (unit === "food") {
    return (
      <div
        className="absolute inset-0 size-full"
        style={{
          background: "radial-gradient(130% 120% at 50% 15%, #ff6b00 0%, #f97316 45%, #ea580c 100%)",
        }}
      >
        <svg
          className="absolute inset-0 size-full"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1200 700"
          preserveAspectRatio="none"
        >
          <defs>
            <filter id={`${prefix}-food-soft`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="22" />
            </filter>
            <filter id={`${prefix}-food-deep`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="40" />
            </filter>
            <linearGradient id={`${prefix}-food-wave-1`} x1="0%" y1="0%" x2="100%" y2="80%">
              <stop offset="0%" stopColor="#fed7aa" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#fb923c" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#ff6b00" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id={`${prefix}-food-wave-2`} x1="100%" y1="10%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ff6b00" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#ea580c" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#c2410c" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <path
            d="M-50,70 C220,-70 480,180 820,30 C1040,-80 1180,60 1250,140 L1250,-50 L-50,-50 Z"
            fill={`url(#${prefix}-food-wave-1)`}
            filter={`url(#${prefix}-food-soft)`}
          />
          <path
            d="M-30,220 C260,80 520,350 880,160 C1080,40 1200,230 1250,300 L1250,-50 L-30,-50 Z"
            fill={`url(#${prefix}-food-wave-2)`}
            filter={`url(#${prefix}-food-deep)`}
            opacity="0.85"
          />
          <ellipse cx="280" cy="100" rx="260" ry="130" fill="#ffedd5" opacity="0.65" filter={`url(#${prefix}-food-deep)`} />
          <ellipse cx="980" cy="150" rx="300" ry="160" fill="#fdba74" opacity="0.5" filter={`url(#${prefix}-food-deep)`} />
        </svg>
      </div>
    );
  }

  if (unit === "events") {
    return (
      <div
        className="absolute inset-0 size-full"
        style={{
          background: "radial-gradient(130% 120% at 50% 15%, #00c853 0%, #059669 45%, #047857 100%)",
        }}
      >
        <svg
          className="absolute inset-0 size-full"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1200 700"
          preserveAspectRatio="none"
        >
          <defs>
            <filter id={`${prefix}-events-soft`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="22" />
            </filter>
            <filter id={`${prefix}-events-deep`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="40" />
            </filter>
            <linearGradient id={`${prefix}-events-wave-1`} x1="0%" y1="0%" x2="100%" y2="80%">
              <stop offset="0%" stopColor="#bbf7d0" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#4ade80" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#00c853" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id={`${prefix}-events-wave-2`} x1="100%" y1="10%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00c853" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#059669" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <path
            d="M-50,70 C220,-70 480,180 820,30 C1040,-80 1180,60 1250,140 L1250,-50 L-50,-50 Z"
            fill={`url(#${prefix}-events-wave-1)`}
            filter={`url(#${prefix}-events-soft)`}
          />
          <path
            d="M-30,220 C260,80 520,350 880,160 C1080,40 1200,230 1250,300 L1250,-50 L-30,-50 Z"
            fill={`url(#${prefix}-events-wave-2)`}
            filter={`url(#${prefix}-events-deep)`}
            opacity="0.85"
          />
          <ellipse cx="280" cy="100" rx="260" ry="130" fill="#d1fae5" opacity="0.65" filter={`url(#${prefix}-events-deep)`} />
          <ellipse cx="980" cy="150" rx="300" ry="160" fill="#22c55e" opacity="0.5" filter={`url(#${prefix}-events-deep)`} />
        </svg>
      </div>
    );
  }

  // partners / loyalty
  return (
    <div
      className="absolute inset-0 size-full"
      style={{
        background: "radial-gradient(130% 120% at 50% 15%, #ffb300 0%, #f59e0b 45%, #d97706 100%)",
      }}
    >
      <svg
        className="absolute inset-0 size-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1200 700"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id={`${prefix}-partner-soft`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
          <filter id={`${prefix}-partner-deep`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="40" />
          </filter>
          <linearGradient id={`${prefix}-partner-wave-1`} x1="0%" y1="0%" x2="100%" y2="80%">
            <stop offset="0%" stopColor="#fef9c3" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#fde047" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffb300" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id={`${prefix}-partner-wave-2`} x1="100%" y1="10%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffb300" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#b45309" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <path
          d="M-50,70 C220,-70 480,180 820,30 C1040,-80 1180,60 1250,140 L1250,-50 L-50,-50 Z"
          fill={`url(#${prefix}-partner-wave-1)`}
          filter={`url(#${prefix}-partner-soft)`}
        />
        <path
          d="M-30,220 C260,80 520,350 880,160 C1080,40 1200,230 1250,300 L1250,-50 L-30,-50 Z"
          fill={`url(#${prefix}-partner-wave-2)`}
          filter={`url(#${prefix}-partner-deep)`}
          opacity="0.85"
        />
        <ellipse cx="280" cy="100" rx="260" ry="130" fill="#fef08a" opacity="0.65" filter={`url(#${prefix}-partner-deep)`} />
        <ellipse cx="980" cy="150" rx="300" ry="160" fill="#fbbf24" opacity="0.5" filter={`url(#${prefix}-partner-deep)`} />
      </svg>
    </div>
  );
}

/** Tactile film & paper grain overlay */
function GrainOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 size-full opacity-50 mix-blend-overlay"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='hdGrain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23hdGrain)'/%3E%3C/svg%3E")`,
        backgroundSize: "200px 200px",
        backgroundRepeat: "repeat",
      }}
      aria-hidden="true"
    />
  );
}

/** Single unit ambient backdrop (used for static feature sections) */
export function AmbientCanvas({ unit }: { unit: UnitTheme }) {
  const rawId = useId();
  const prefix = `ac-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div className="pointer-events-none absolute inset-0 size-full overflow-hidden" aria-hidden="true">
      <AmbientUnitSvg unit={unit} prefix={prefix} />
      <GrainOverlay />
    </div>
  );
}

/** Multi-unit ambient backdrop with smooth cross-fade transition (used in Hero) */
export function AmbientHeroBackdrop({ showcase }: { showcase: UnitTheme }) {
  const rawId = useId();
  const prefix = `hero-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const units: readonly UnitTheme[] = ["work", "food", "events", "partners"];

  return (
    <div className="pointer-events-none absolute inset-0 size-full overflow-hidden" aria-hidden="true">
      {units.map((unit) => (
        <div
          key={unit}
          className={cn(
            "absolute inset-0 size-full transition-opacity duration-700 ease-in-out",
            showcase === unit ? "opacity-100" : "opacity-0",
          )}
        >
          <AmbientUnitSvg unit={unit} prefix={`${prefix}-${unit}`} />
        </div>
      ))}
      <GrainOverlay />
    </div>
  );
}

interface AmbientUnitFrameProps {
  unit: UnitTheme;
  withDissolve?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Ambient Unit Frame ("Ring"):
 * Wraps photo stages in a tactile, unit-colored organic gradient halo.
 * When withDissolve is false (feature sections), it frames the photo evenly on all sides.
 */
export function AmbientUnitFrame({
  unit,
  withDissolve = false,
  className,
  children,
}: AmbientUnitFrameProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        withDissolve
          ? "rounded-t-2xl sm:rounded-t-3xl rounded-b-none pt-5 px-5 pb-0 sm:pt-10 sm:px-10 sm:pb-0 lg:pt-14 lg:px-14 lg:pb-0"
          : "rounded-3xl sm:rounded-[2rem] p-3.5 sm:p-8 lg:p-11 shadow-2xl",
        className,
      )}
    >
      <AmbientCanvas unit={unit} />
      {withDissolve && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 sm:h-48 lg:h-56 bg-gradient-to-t from-background from-10% via-background/80 via-50% to-transparent z-10"
          aria-hidden="true"
        />
      )}
      <div className="relative z-10 w-full min-w-0">{children}</div>
    </div>
  );
}
