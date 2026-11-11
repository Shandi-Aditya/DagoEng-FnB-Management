"use client";

import { CircleCheck } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useInventory } from "@/contexts/InventoryContext";

/** Ingredients close to or below their minimum stock. */
export function InventoryRiskCard() {
  const { filteredIngredients } = useInventory();
  const atRisk = filteredIngredients.filter((item) => item.status === "CRITICAL" || item.status === "LOW");

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Stok bahan baku</CardTitle>
        <CardDescription>Bahan yang mendekati batas minimum</CardDescription>
      </CardHeader>
      <CardContent>
        {atRisk.length === 0 ? (
          <EmptyState
            icon={<CircleCheck />}
            title="Semua stok aman"
            description={`${filteredIngredients.length} bahan terdaftar di atas batas minimum`}
          />
        ) : (
          <ul className="flex flex-col divide-y">
            {atRisk.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{item.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Minimum {item.min} {item.unit} · {item.supplier}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm tabular-nums">
                    {item.stockNumber} {item.unit}
                  </span>
                  <StatusBadge status={item.status === "CRITICAL" ? "destructive" : "warning"} className="text-xs">
                    {item.status === "CRITICAL" ? "Kritis" : "Rendah"}
                  </StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
