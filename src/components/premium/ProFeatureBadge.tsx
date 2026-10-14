"use client";

import React from "react";
import { Sparkles, Crown, Zap } from "lucide-react";

export type ProBadgeVariant = "pro" | "addon" | "enterprise";
export type ProBadgeSize = "xs" | "sm" | "md";

export interface ProFeatureBadgeProps {
  label?: string;
  variant?: ProBadgeVariant;
  size?: ProBadgeSize;
  icon?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}

const VARIANT_STYLES: Record<ProBadgeVariant, { container: string; icon: string }> = {
  pro: {
    container: "bg-purple-50 text-purple-700 border-purple-200/90 hover:bg-purple-100/70",
    icon: "text-purple-600",
  },
  addon: {
    container: "bg-amber-50 text-amber-800 border-amber-200/90 hover:bg-amber-100/70",
    icon: "text-amber-700",
  },
  enterprise: {
    container: "bg-indigo-50 text-indigo-700 border-indigo-200/90 hover:bg-indigo-100/70",
    icon: "text-indigo-600",
  },
};

const SIZE_STYLES: Record<ProBadgeSize, { badge: string; icon: string }> = {
  xs: {
    badge: "text-[9px] px-1.5 py-0.5 tracking-wider font-bold rounded-md",
    icon: "w-2.5 h-2.5",
  },
  sm: {
    badge: "text-[10px] px-2 py-0.5 tracking-wider font-bold rounded-lg",
    icon: "w-3 h-3",
  },
  md: {
    badge: "text-xs px-2.5 py-1 tracking-wider font-bold rounded-lg",
    icon: "w-3.5 h-3.5",
  },
};

/**
 * Reusable elegant badge for SaaS PRO / ADD-ON / ENTERPRISE features.
 * Designed with soft pastel palettes that remain non-intrusive in operational screens.
 */
export function ProFeatureBadge({
  label = "PRO",
  variant = "pro",
  size = "xs",
  icon = true,
  className = "",
  onClick,
  title = "Fitur konsep premium SaaS DagoEng",
}: ProFeatureBadgeProps) {
  const styles = VARIANT_STYLES[variant];
  const sizeStyles = SIZE_STYLES[size];

  const content = (
    <span
      title={title}
      onClick={onClick}
      className={`inline-flex items-center space-x-1 border transition-colors select-none ${
        styles.container
      } ${sizeStyles.badge} ${
        onClick ? "cursor-pointer hover:shadow-2xs active:scale-95" : "cursor-default"
      } ${className}`}
    >
      {icon && (
        variant === "enterprise" ? (
          <Crown className={`${sizeStyles.icon} ${styles.icon} shrink-0`} />
        ) : variant === "addon" ? (
          <Zap className={`${sizeStyles.icon} ${styles.icon} shrink-0`} />
        ) : (
          <Sparkles className={`${sizeStyles.icon} ${styles.icon} shrink-0`} />
        )
      )}
      <span className="uppercase">{label}</span>
    </span>
  );

  return content;
}
