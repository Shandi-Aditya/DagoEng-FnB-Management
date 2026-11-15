import type { StatusTone } from "@/components/app/status-badge";
import type { IngredientItem } from "@/types/inventory";

export interface RecipeIngredientLine {
  ingredientId: string;
  ingredientName: string;
  quantityRequired: number;
  unit: string;
  costEstimate: number;
}

const HEALTHY_MARGIN_THRESHOLD = 60;
const THIN_MARGIN_THRESHOLD = 40;

export function calculateRecipeCOGS(lines: RecipeIngredientLine[]): number {
  return lines.reduce((sum, line) => sum + (line.costEstimate || 0), 0);
}

export function calculateGrossProfit(sellingPrice: number, cogs: number): number {
  return Math.max(0, sellingPrice - cogs);
}

export function calculateGrossMargin(sellingPrice: number, cogs: number): number {
  if (sellingPrice <= 0) return 0;
  const profit = calculateGrossProfit(sellingPrice, cogs);
  return Number(((profit / sellingPrice) * 100).toFixed(1));
}

export function getMarginStatusTone(marginPercent: number): StatusTone {
  if (marginPercent >= HEALTHY_MARGIN_THRESHOLD) return "success";
  if (marginPercent >= THIN_MARGIN_THRESHOLD) return "warning";
  return "destructive";
}

export function calculateLineCostEstimate(
  ingredient: IngredientItem | undefined,
  quantityRequired: number
): number {
  if (!ingredient || quantityRequired <= 0) return 0;
  const unit = (ingredient.unit || "").toLowerCase();

  // If unit is kg or liter and quantity is in grams or ml
  if (unit === "kg" || unit === "liter" || unit === "l") {
    // Estimasi takaran porsi umumnya gram atau ml (1/1000)
    return Math.round((ingredient.costPerUnit / 1000) * quantityRequired);
  }

  // Jika unit botol, porsi atau pcs, gunakan rasio wajar terhadap porsi
  return Math.round((ingredient.costPerUnit * quantityRequired) / 50);
}

export function generateSuggestedIngredients(
  productName: string,
  availableIngredients: IngredientItem[]
): RecipeIngredientLine[] {
  if (availableIngredients.length === 0) return [];

  const lowerName = productName.toLowerCase();
  const matched: RecipeIngredientLine[] = [];

  const findIngredient = (keyword: string) =>
    availableIngredients.find(
      (ing) =>
        ing.name.toLowerCase().includes(keyword) ||
        ing.category.toLowerCase().includes(keyword)
    );

  if (lowerName.includes("kopi") || lowerName.includes("coffee") || lowerName.includes("espresso") || lowerName.includes("latte")) {
    const coffee = findIngredient("kopi") || availableIngredients[0];
    const milk = findIngredient("susu");
    const sugar = findIngredient("gula") || findIngredient("syrup");

    if (coffee) {
      matched.push({
        ingredientId: coffee.id,
        ingredientName: coffee.name,
        quantityRequired: 18,
        unit: "gram",
        costEstimate: calculateLineCostEstimate(coffee, 18),
      });
    }
    if (milk) {
      matched.push({
        ingredientId: milk.id,
        ingredientName: milk.name,
        quantityRequired: 150,
        unit: "ml",
        costEstimate: calculateLineCostEstimate(milk, 150),
      });
    }
    if (sugar) {
      matched.push({
        ingredientId: sugar.id,
        ingredientName: sugar.name,
        quantityRequired: 20,
        unit: "ml",
        costEstimate: calculateLineCostEstimate(sugar, 20),
      });
    }
  } else if (lowerName.includes("teh") || lowerName.includes("tea") || lowerName.includes("peach")) {
    const tea = findIngredient("teh") || findIngredient("tea") || availableIngredients[0];
    const syrup = findIngredient("syrup") || findIngredient("gula");

    if (tea) {
      matched.push({
        ingredientId: tea.id,
        ingredientName: tea.name,
        quantityRequired: 10,
        unit: "gram",
        costEstimate: calculateLineCostEstimate(tea, 10),
      });
    }
    if (syrup) {
      matched.push({
        ingredientId: syrup.id,
        ingredientName: syrup.name,
        quantityRequired: 25,
        unit: "ml",
        costEstimate: calculateLineCostEstimate(syrup, 25),
      });
    }
  } else if (lowerName.includes("daging") || lowerName.includes("beef") || lowerName.includes("wagyu") || lowerName.includes("bowl")) {
    const meat = findIngredient("daging") || findIngredient("beef") || availableIngredients[0];
    const rice = findIngredient("beras") || findIngredient("nasi");

    if (meat) {
      matched.push({
        ingredientId: meat.id,
        ingredientName: meat.name,
        quantityRequired: 100,
        unit: "gram",
        costEstimate: calculateLineCostEstimate(meat, 100),
      });
    }
    if (rice) {
      matched.push({
        ingredientId: rice.id,
        ingredientName: rice.name,
        quantityRequired: 150,
        unit: "gram",
        costEstimate: calculateLineCostEstimate(rice, 150),
      });
    }
  }

  // Jika tidak ada kata kunci yang cocok, gunakan bahan pertama yang tersedia
  if (matched.length === 0) {
    const fallback = availableIngredients[0];
    matched.push({
      ingredientId: fallback.id,
      ingredientName: fallback.name,
      quantityRequired: 20,
      unit: fallback.unit,
      costEstimate: Math.max(100, Math.round(fallback.costPerUnit * 0.1)),
    });
  }

  return matched;
}
