"use client";

import {
  Boxes,
  Building2,
  Clock,
  DollarSign,
  ShieldCheck,
  Ticket,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ReportCategoryMeta, ReportType } from "@/features/reports/reports-domain";
import { cn } from "@/lib/utils";

const ICONS: Record<ReportType, LucideIcon> = {
  SALES: DollarSign,
  SETTLEMENT: Building2,
  EVENTS: Ticket,
  CLOSING: Clock,
  PRODUCTS: TrendingUp,
  INVENTORY: Boxes,
  FINANCE_AUDIT: ShieldCheck,
};

export interface ReportsCategorySelectorProps {
  categories: ReportCategoryMeta[];
  selectedType: ReportType;
  onSelectType: (type: ReportType) => void;
}

export function ReportsCategorySelector({
  categories,
  selectedType,
  onSelectType,
}: ReportsCategorySelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {categories.map((cat) => {
        const Icon = ICONS[cat.id] || DollarSign;
        const isSelected = selectedType === cat.id;

        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectType(cat.id)}
            className={cn(
              "flex flex-col justify-between overflow-hidden rounded-xl border p-3 text-left transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
              isSelected
                ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                : "border-border bg-card text-card-foreground hover:bg-muted/50"
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-colors shrink-0",
                  isSelected
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="size-4" />
              </div>
              <Badge
                variant={isSelected ? "default" : "secondary"}
                className="font-mono text-xs tabular-nums"
              >
                {cat.count}
              </Badge>
            </div>
            <p className="mt-3 truncate text-xs font-medium">
              {cat.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}
