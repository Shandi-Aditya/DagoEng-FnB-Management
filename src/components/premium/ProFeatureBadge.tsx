"use client";

import React from "react";
import { Sparkles, Crown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

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
    container: "bg-warning/10 text-warning border-warning/20",
    icon: "text-warning",
  },
  addon: {
    container: "bg-primary/10 text-primary border-primary/20",
    icon: "text-primary",
  },
  enterprise: {
    container: "bg-info/10 text-info border-info/20",
    icon: "text-info",
  },
};

const SIZE_STYLES: Record<ProBadgeSize, { badge: string; icon: string }> = {
  xs: {
    badge: "text-xs px-2 py-0.5 font-medium rounded-md",
    icon: "size-3",
  },
  sm: {
    badge: "text-xs px-2.5 py-0.5 font-medium rounded-md",
    icon: "size-3.5",
  },
  md: {
    badge: "text-xs px-3 py-1 font-medium rounded-lg",
    icon: "size-4",
  },
};

/**
 * Reusable badge for SaaS PRO / ADD-ON / ENTERPRISE features.
 * Designed with semantic tokens that align with the design system.
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
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.addon;
  const sizeStyles = SIZE_STYLES[size] || SIZE_STYLES.xs;

  return (
    <span
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 border select-none transition-colors",
        styles.container,
        sizeStyles.badge,
        onClick && "cursor-pointer hover:bg-muted/80",
        className
      )}
    >
      {icon && (
        variant === "enterprise" ? (
          <Crown className={cn(sizeStyles.icon, styles.icon, "shrink-0")} />
        ) : variant === "addon" ? (
          <Zap className={cn(sizeStyles.icon, styles.icon, "shrink-0")} />
        ) : (
          <Sparkles className={cn(sizeStyles.icon, styles.icon, "shrink-0")} />
        )
      )}
      <span>{label}</span>
    </span>
  );
}
