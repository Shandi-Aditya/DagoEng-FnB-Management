"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in milliseconds. */
  delay?: number;
  /** Transition duration in milliseconds (default: 950ms for smooth, unhurried reveals). */
  duration?: number;
  /** Direction of the subtle slide-in (default: "up"). */
  direction?: "up" | "none";
  /** Optional micro-scale for subtle physical depth (0.985 to 1.0). Default: true. */
  withScale?: boolean;
}

/**
 * Fades and lifts its content as it scrolls into view using an IntersectionObserver.
 * Features an organic quintic-out curve, generous duration (~950ms), and subtle physical depth (scale-[0.985] to 1).
 * Once visible, it stays in place and disconnects the observer for zero ongoing scroll cost.
 * Falls back to instant visibility under prefers-reduced-motion.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  duration = 950,
  direction = "up",
  withScale = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element);
        }
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px",
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const slideClass =
    direction === "up"
      ? isVisible
        ? "translate-y-0 opacity-100 scale-100"
        : cn("translate-y-8 opacity-0", withScale && "scale-[0.985]")
      : isVisible
        ? "opacity-100 scale-100"
        : cn("opacity-0", withScale && "scale-[0.985]");

  return (
    <div
      ref={ref}
      className={cn(
        "transition-[opacity,translate,transform] motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:opacity-100 motion-reduce:transition-none will-change-[transform,opacity]",
        slideClass,
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        transitionDelay: delay > 0 ? `${delay}ms` : undefined,
      }}
    >
      {children}
    </div>
  );
}
