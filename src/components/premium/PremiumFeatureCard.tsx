"use client";

import React from "react";
import { CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProFeatureBadge, ProBadgeVariant } from "./ProFeatureBadge";

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
  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4 ${className}`}
    >
      <div className="space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center space-x-2.5">
            {icon && (
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <div>
              <h4 className="font-bold text-sm text-slate-900 leading-tight">{title}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Status: <span className="text-slate-600 font-semibold">{status}</span></p>
            </div>
          </div>
          <ProFeatureBadge label={badgeLabel} variant={badgeVariant} size="xs" />
        </div>

        {/* Description */}
        <p className="text-xs text-slate-600 leading-relaxed">{description}</p>

        {/* Benefits list */}
        {benefits.length > 0 && (
          <div className="pt-1 space-y-1.5">
            {benefits.slice(0, 3).map((benefit, idx) => (
              <div key={idx} className="flex items-start space-x-1.5 text-[11px] text-slate-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="line-clamp-1">{benefit}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer / Action */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Rancangan SaaS
        </span>
        {onLearnMore && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onLearnMore}
            className="text-xs font-bold text-purple-700 hover:text-purple-800 hover:bg-purple-50 h-8 px-2.5 space-x-1 rounded-lg"
          >
            <span>{actionLabel}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
