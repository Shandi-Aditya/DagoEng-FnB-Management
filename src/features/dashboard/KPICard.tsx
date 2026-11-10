import React from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  changePercent?: number;
  trendText?: string;
  icon?: React.ReactNode;
  accentColor?: "sage" | "orange" | "cyan" | "green" | "yellow" | "slate";
}

export function KPICard({
  title,
  value,
  changePercent,
  trendText,
  icon,
  accentColor = "sage",
}: KPICardProps) {
  const isPositive = changePercent !== undefined ? changePercent >= 0 : true;

  const iconAccentStyles = {
    sage: "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-light dark:border-primary/30",
    orange: "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-light dark:border-primary/30",
    cyan: "bg-sky-50 text-sky-600 border-sky-100/80 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/60",
    green: "bg-emerald-50 text-emerald-600 border-emerald-100/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60",
    yellow: "bg-amber-50 text-amber-700 border-amber-100/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60",
    slate: "bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  }[accentColor];

  return (
    <Card className="p-5 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-shadow bg-white dark:bg-slate-900 rounded-xl">
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-200 uppercase tracking-wider truncate min-w-0">
          {title}
        </span>
        {icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${iconAccentStyles}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">{value}</h3>
      </div>

      {(changePercent !== undefined || trendText) && (
        <div className="flex items-center space-x-1.5 mt-3 text-xs overflow-hidden">
          {changePercent !== undefined && (
            <span
              className={`inline-flex items-center font-bold px-1.5 py-0.5 rounded text-[11px] shrink-0 whitespace-nowrap ${
                isPositive
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50"
                  : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400 border border-red-200/50 dark:border-red-800/50"
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-3 h-3 mr-1" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1" />
              )}
              {Math.abs(changePercent)}%
            </span>
          )}
          {trendText && <span className="text-slate-600 dark:text-slate-300 text-[11px] font-medium truncate">{trendText}</span>}
        </div>
      )}
    </Card>
  );
}
