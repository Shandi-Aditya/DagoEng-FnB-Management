"use client";

import { useState } from "react";
import { CheckCircle2, ShoppingCart } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { IngredientItem } from "@/types/inventory";

import type { ReorderEntry } from "./inventory-reorder";

const VISIBLE_LIMIT = 5;

interface ReorderPanelProps {
  entries: readonly ReorderEntry[];
  onCreatePO: (item: IngredientItem) => void;
}

/** What to buy now, most urgent first. Replaces the old "restock alert" modal hidden behind a button. */
export function ReorderPanel({ entries, onCreatePO }: ReorderPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (entries.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 text-success" aria-hidden />
        Tidak ada bahan yang perlu dibeli sekarang.
      </p>
    );
  }

  const visible = isExpanded ? entries : entries.slice(0, VISIBLE_LIMIT);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <ShoppingCart className="size-4 text-muted-foreground" aria-hidden />
          Perlu dibeli
        </CardTitle>
        <CardDescription>Saran jumlah mengembalikan stok ke dua kali batas minimum.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {visible.map(({ item, reason, suggestedQuantity }) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {item.name}
                  <StatusBadge status={reason === "habis" ? "destructive" : "warning"}>
                    {reason === "habis" ? "Habis" : "Kritis"}
                  </StatusBadge>
                </span>
                <span className="text-xs text-muted-foreground">
                  Sisa <span className="font-mono tabular-nums">{item.stockNumber}</span> dari minimum{" "}
                  <span className="font-mono tabular-nums">{item.min}</span> {item.unit} · {item.supplier}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  Saran <span className="font-mono text-foreground tabular-nums">{suggestedQuantity}</span> {item.unit}
                </span>
                <Button size="sm" variant="outline" onClick={() => onCreatePO(item)}>
                  Buat PO
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {entries.length > VISIBLE_LIMIT ? (
          <Button variant="link" size="sm" className="mt-2 px-0" onClick={() => setIsExpanded((prev) => !prev)}>
            {isExpanded ? "Tampilkan lebih sedikit" : `Lihat ${entries.length - VISIBLE_LIMIT} bahan lain`}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
