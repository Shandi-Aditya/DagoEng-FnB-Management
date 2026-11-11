import { StatusBadge } from "@/components/app/status-badge";
import { UnitDot } from "@/components/app/unit-dot";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrencyIDR } from "@/lib/utils";

import type { UnitBreakdownItem } from "./dashboard-metrics";

/** Revenue share per business unit, marked with the logo unit colors. */
export function UnitContributionCard({ units }: { units: UnitBreakdownItem[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Kontribusi unit bisnis</CardTitle>
        <CardDescription>Porsi pendapatan konsolidasi per unit</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-5">
          {units.map((unit) => (
            <li key={unit.unit} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <UnitDot unit={unit.unit} />
                    {unit.name}
                    {unit.isActive ? null : <StatusBadge status="neutral">Nonaktif</StatusBadge>}
                  </span>
                  <span className="truncate pl-4 text-xs text-muted-foreground">{unit.detail}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-sm font-medium tabular-nums">{formatCurrencyIDR(unit.revenue)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{unit.sharePercent}%</span>
                </div>
              </div>
              <Progress value={unit.sharePercent} aria-label={`Porsi ${unit.name}`} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
