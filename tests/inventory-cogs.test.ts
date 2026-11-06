import { describe, it, expect } from "vitest";
import {
  INITIAL_INGREDIENTS,
  INITIAL_RECIPES,
  deductRecipeIngredients,
} from "../src/features/inventory/inventory-data";
import { IngredientItem, RecipeBOM } from "../src/types/inventory";

describe("Smart Inventory & BOM Recipe Deduction Engine", () => {
  it("accurately calculates BOM Recipe COGS and gross margin percentage", () => {
    const kopiSenjaRecipe = INITIAL_RECIPES.find((r) => r.menuId === "m-1");
    expect(kopiSenjaRecipe).toBeDefined();

    if (kopiSenjaRecipe) {
      const calculatedCOGS = kopiSenjaRecipe.ingredients.reduce(
        (sum, ing) => sum + ing.costEstimate,
        0
      );
      expect(kopiSenjaRecipe.totalCOGS).toBe(calculatedCOGS);
      expect(kopiSenjaRecipe.sellingPrice).toBe(24000);
      expect(kopiSenjaRecipe.grossMarginPercent).toBeGreaterThan(70);
    }
  });

  it("deducts precise quantities of multiple ingredients when order is processed", () => {
    const freshMilkBefore = INITIAL_INGREDIENTS.find((i) => i.id === "ing-1")?.stockNumber || 0;
    const coffeeBeansBefore = INITIAL_INGREDIENTS.find((i) => i.id === "ing-2")?.stockNumber || 0;

    const kopiSenjaRecipe = INITIAL_RECIPES.find((r) => r.menuId === "m-1")!;
    const orderQuantity = 5; // 5 cups

    const { updatedStock, logs } = deductRecipeIngredients(
      INITIAL_INGREDIENTS,
      kopiSenjaRecipe,
      orderQuantity
    );

    const freshMilkAfter = updatedStock.find((i) => i.id === "ing-1")?.stockNumber || 0;
    const coffeeBeansAfter = updatedStock.find((i) => i.id === "ing-2")?.stockNumber || 0;

    // Expected deduction: 5 * 0.12 = 0.6L milk, 5 * 0.018 = 0.09kg coffee
    expect(Number((freshMilkBefore - freshMilkAfter).toFixed(3))).toBe(0.6);
    expect(Number((coffeeBeansBefore - coffeeBeansAfter).toFixed(3))).toBe(0.09);
    expect(logs.length).toBe(kopiSenjaRecipe.ingredients.length);
  });

  it("updates stock status to CRITICAL or LOW when threshold is breached", () => {
    const testStock: IngredientItem[] = [
      {
        id: "test-milk",
        name: "Test Milk",
        category: "Dairy",
        stockNumber: 15,
        unit: "Liter",
        min: 10,
        costPerUnit: 20000,
        supplier: "Test Dairy",
        status: "SAFE",
        lastUpdated: "Today",
      },
    ];

    const testRecipe: RecipeBOM = {
      menuId: "test-menu",
      menuName: "Latte",
      category: "Coffee",
      sellingPrice: 30000,
      ingredients: [
        {
          ingredientId: "test-milk",
          ingredientName: "Test Milk",
          quantityRequired: 1, // 1 liter per cup for rapid test
          unit: "Liter",
          costEstimate: 20000,
        },
      ],
      totalCOGS: 20000,
      grossMarginPercent: 33.3,
    };

    // Deduct 7 cups -> Stock becomes 8 (below min 10 -> LOW)
    const step1 = deductRecipeIngredients(testStock, testRecipe, 7);
    const itemStep1 = step1.updatedStock.find((i) => i.id === "test-milk")!;
    expect(itemStep1.stockNumber).toBe(8);
    expect(itemStep1.status).toBe("LOW");

    // Deduct 5 more cups -> Stock becomes 3 (below 40% of min 10 = 4 -> CRITICAL)
    const step2 = deductRecipeIngredients(step1.updatedStock, testRecipe, 5);
    const itemStep2 = step2.updatedStock.find((i) => i.id === "test-milk")!;
    expect(itemStep2.stockNumber).toBe(3);
    expect(itemStep2.status).toBe("CRITICAL");
  });
});
