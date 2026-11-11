import { Calculator, Sparkles, Utensils } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyIDR } from "@/lib/utils";
import type { RecipeBOM } from "@/types/inventory";

interface InventoryRecipesTabProps {
  recipes: RecipeBOM[];
  onOpenRecipeModal: (recipe: RecipeBOM) => void;
}

export function InventoryRecipesTab({ recipes, onOpenRecipeModal }: InventoryRecipesTabProps) {
  if (recipes.length === 0) {
    return (
      <EmptyState
        icon={<Utensils className="size-6 text-muted-foreground" />}
        title="Belum ada resep"
        description="Resep menghubungkan menu dengan bahan, jadi HPP dan stok terhitung otomatis setiap ada penjualan."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {recipes.map((r) => {
          const margin = Math.round(r.grossMarginPercent || 0);

          return (
            <Card key={r.menuId} className="flex flex-col justify-between">
              <div>
                <CardHeader className="border-b bg-muted/20 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-medium">{r.menuName}</CardTitle>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        ID: {r.menuId}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[11px] ${
                        margin >= 60
                          ? "border-success/30 bg-success/10 text-success"
                          : margin >= 40
                            ? "border-warning/30 bg-warning/10 text-warning"
                            : "border-destructive/30 bg-destructive/10 text-destructive"
                      }`}
                    >
                      Margin {margin}%
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 p-4 text-xs">
                  {/* Financial Metrics */}
                  <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-2.5">
                    <div>
                      <span className="text-[10px] text-muted-foreground">HPP</span>
                      <p className="font-mono text-xs font-medium tabular-nums text-foreground">
                        {formatCurrencyIDR(r.totalCOGS)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">Harga jual</span>
                      <p className="font-mono text-xs font-medium tabular-nums text-foreground">
                        {formatCurrencyIDR(r.sellingPrice)}
                      </p>
                    </div>
                  </div>

                  {/* Ingredients Breakdown */}
                  <div>
                    <span className="mb-1.5 block text-[11px] font-medium text-foreground">
                      Komposisi Bahan ({r.ingredients.length}):
                    </span>
                    <div className="space-y-1">
                      {r.ingredients.map((ing, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[11px] text-muted-foreground"
                        >
                          <span>
                            {ing.ingredientName} ({ing.quantityRequired} {ing.unit})
                          </span>
                          <span className="font-mono tabular-nums text-foreground">
                            {formatCurrencyIDR(ing.costEstimate)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </div>

              <div className="border-t p-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenRecipeModal(r)}
                  className="w-full gap-1.5 text-xs"
                >
                  <Calculator className="size-3.5 text-muted-foreground" />
                  <span>Atur resep</span>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
