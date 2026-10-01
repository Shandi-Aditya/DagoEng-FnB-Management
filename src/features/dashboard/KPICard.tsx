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

  const accentStyles = {
    orange: "border-l-4 border-l-brand-orange",
    cyan: "border-l-4 border-l-brand-cyan",
    green: "border-l-4 border-l-brand-green",
    yellow: "border-l-4 border-l-brand-yellow",
    slate: "border-l-4 border-l-slate-400",
  }[accentColor];

  return (
    <Card className={`p-5 ${accentStyles} shadow-sm bg-white`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>

      <div className="flex items-baseline justify-between">
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
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
