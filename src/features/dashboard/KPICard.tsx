import React from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  changePercent?: number;
  trendText?: string;
  icon?: React.ReactNode;
  accentColor?: "orange" | "cyan" | "green" | "yellow" | "slate";
}

export function KPICard({
  title,
  value,
  changePercent,
  trendText,
  icon,
  accentColor = "orange",
}: KPICardProps) {
  const isPositive = changePercent !== undefined ? changePercent >= 0 : true;

  const iconAccentStyles = {
    orange: "bg-orange-50 text-orange-600 border-orange-100/80",
    cyan: "bg-sky-50 text-sky-600 border-sky-100/80",
    green: "bg-emerald-50 text-emerald-600 border-emerald-100/80",
    yellow: "bg-amber-50 text-amber-700 border-amber-100/80",
    slate: "bg-slate-100 text-slate-700 border-slate-200/80",
  }[accentColor];

  return (
    <Card className="p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow bg-white rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        {icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${iconAccentStyles}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
      </div>

      {(changePercent !== undefined || trendText) && (
        <div className="flex items-center space-x-1.5 mt-3 text-xs">
          {changePercent !== undefined && (
            <span
              className={`inline-flex items-center font-bold px-1.5 py-0.5 rounded text-[11px] ${
                isPositive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
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
          {trendText && <span className="text-slate-500 text-[11px]">{trendText}</span>}
        </div>
      )}
    </Card>
  );
}
