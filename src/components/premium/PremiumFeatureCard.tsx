"use client";

import React from "react";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProFeatureBadge, ProBadgeVariant } from "./ProFeatureBadge";
import { formatFeatureBenefits } from "./premium-domain";
import { cn } from "@/lib/utils";

export interface PremiumFeatureCardProps {
  title: string;
  description: string;
  badgeLabel?: string;
  badgeVariant?: ProBadgeVariant;
  status?: string;
  benefits?: string[];
  icon?: React.ReactNode;
  onLearnMore?: () => void;
  actionLabel?: string;
  className?: string;
}

export function PremiumFeatureCard({
  title,
  description,
  badgeLabel = "ADD-ON",
  badgeVariant = "addon",
  status = "Tersedia",
  benefits = [],
  icon,
  onLearnMore,
  actionLabel = "Pelajari Fitur",
  className = "",
}: PremiumFeatureCardProps) {
  const formattedBenefits = formatFeatureBenefits(benefits, 3);

  return (
    <div
      className={cn(
        "p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-2xs hover:border-border/80 flex flex-col justify-between space-y-4",
        className
      )}
    >
      <div className="space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            {icon && (
              <div className="size-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <div>
              <h4 className="font-semibold text-sm text-foreground leading-tight">
                {title}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span>Status: </span>
                <span className="text-foreground font-medium">{status}</span>
              </p>
            </div>
          </div>
          <ProFeatureBadge label={badgeLabel} variant={badgeVariant} size="xs" />
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>

        {/* Benefits list */}
        {formattedBenefits.length > 0 && (
          <div className="pt-1 space-y-1.5">
            {formattedBenefits.map((benefit, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                <span className="line-clamp-1">{benefit}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer / Action */}
      <div className="pt-2 border-t border-border flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Rancangan SaaS
        </span>
        {onLearnMore && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onLearnMore}
            className="gap-1"
          >
            <span>{actionLabel}</span>
            <ChevronRight className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
