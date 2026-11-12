"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in milliseconds. */
  delay?: number;
  /** Direction of the subtle slide-in (default: "up"). */
  direction?: "up" | "none";
}

/**
 * Fades and lifts its content as it scrolls into view using an IntersectionObserver.
 * Once visible, it stays in place and disconnects the observer for zero ongoing scroll cost.
 * Falls back to instant visibility under prefers-reduced-motion.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  direction = "up",
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
        rootMargin: "0px 0px -40px 0px",
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const slideClass =
    direction === "up"
      ? isVisible
        ? "translate-y-0 opacity-100"
        : "translate-y-6 opacity-0"
      : isVisible
        ? "opacity-100"
        : "opacity-0";

  return (
    <div
      ref={ref}
      className={cn(
        "transition-[opacity,translate] duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
        slideClass,
        className
      )}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
