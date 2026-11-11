import { Utensils } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyIDR } from "@/lib/utils";
import type { RecipeBOM } from "@/types/inventory";

const HEALTHY_MARGIN = 60;
const THIN_MARGIN = 40;

interface InventoryRecipesTabProps {
  recipes: RecipeBOM[];
  onOpenRecipeModal: (recipe: RecipeBOM) => void;
}

function marginTone(margin: number): StatusTone {
  if (margin >= HEALTHY_MARGIN) return "success";
  if (margin >= THIN_MARGIN) return "warning";
  return "destructive";
}

export function InventoryRecipesTab({ recipes, onOpenRecipeModal }: InventoryRecipesTabProps) {
  if (recipes.length === 0) {
    return (
      <EmptyState
        className="border"
        icon={<Utensils />}
        title="Belum ada resep"
        description="Resep menghubungkan menu dengan bahan, jadi HPP dan stok terhitung setiap ada penjualan."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {recipes.map((recipe) => {
        const margin = Math.round(recipe.grossMarginPercent || 0);
        return (
          <Card key={recipe.menuId} size="sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-medium">{recipe.menuName}</CardTitle>
                <StatusBadge status={marginTone(margin)}>Margin {margin}%</StatusBadge>
              </div>
              <p className="text-xs text-muted-foreground">
                HPP <span className="font-mono text-foreground tabular-nums">{formatCurrencyIDR(recipe.totalCOGS)}</span> dari harga{" "}
                <span className="font-mono text-foreground tabular-nums">{formatCurrencyIDR(recipe.sellingPrice)}</span>
              </p>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {recipe.ingredients.map((ingredient) => (
                  <li key={ingredient.ingredientId} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate" title={ingredient.ingredientName}>
                      {ingredient.ingredientName}
                    </span>
                    <span className="shrink-0">
                      <span className="font-mono tabular-nums">{ingredient.quantityRequired}</span> {ingredient.unit}
                    </span>
                    <span className="w-20 shrink-0 text-right font-mono text-foreground tabular-nums">
                      {formatCurrencyIDR(ingredient.costEstimate)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button size="sm" variant="outline" className="w-full" onClick={() => onOpenRecipeModal(recipe)}>
                Atur resep
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
