import { describe, it, expect } from "vitest";
import {
  calculateRecipeCOGS,
  calculateGrossProfit,
  calculateGrossMargin,
  getMarginStatusTone,
  generateSuggestedIngredients,
  type RecipeIngredientLine,
} from "../src/features/inventory/bom-recipe-domain";
import type { IngredientItem } from "../src/types/inventory";

describe("bom-recipe-domain", () => {
  const sampleLines: RecipeIngredientLine[] = [
    {
      ingredientId: "ing-coffee",
      ingredientName: "Biji Kopi House Blend",
      quantityRequired: 18,
      unit: "gram",
      costEstimate: 2520,
    },
    {
      ingredientId: "ing-milk",
      ingredientName: "Susu Fresh Milk",
      quantityRequired: 150,
      unit: "ml",
      costEstimate: 3300,
    },
  ];

  const availableIngredients: IngredientItem[] = [
    {
      id: "ing-coffee",
      name: "Biji Kopi House Blend Arabica",
      category: "Biji Kopi",
      stockNumber: 10,
      unit: "kg",
      min: 2,
      costPerUnit: 140000,
      supplier: "Kintamani Roasters",
      status: "SAFE",
      lastUpdated: "Hari ini",
    },
    {
      id: "ing-milk",
      name: "Susu Fresh Milk Greenfield",
      category: "Susu",
      stockNumber: 20,
      unit: "Liter",
      min: 5,
      costPerUnit: 22000,
      supplier: "Greenfield",
      status: "SAFE",
      lastUpdated: "Hari ini",
    },
    {
      id: "ing-tea",
      name: "Daun Teh Artisan Peach",
      category: "Teh",
      stockNumber: 5,
      unit: "Botol",
      min: 1,
      costPerUnit: 85000,
      supplier: "Artisan Tea",
      status: "SAFE",
      lastUpdated: "Hari ini",
    },
  ];

  it("calculates total COGS accurately from ingredient lines", () => {
    const total = calculateRecipeCOGS(sampleLines);
    expect(total).toBe(5820);
  });

  it("calculates gross profit correctly without negative bounds", () => {
    expect(calculateGrossProfit(25000, 5820)).toBe(19180);
    expect(calculateGrossProfit(5000, 6000)).toBe(0);
  });

  it("calculates gross margin percentage accurately", () => {
    const margin = calculateGrossMargin(25000, 5820);
    expect(margin).toBe(76.7);
    expect(calculateGrossMargin(0, 1000)).toBe(0);
  });

  it("maps margin percentage to standard status tone", () => {
    expect(getMarginStatusTone(65)).toBe("success");
    expect(getMarginStatusTone(45)).toBe("warning");
    expect(getMarginStatusTone(20)).toBe("destructive");
  });

  it("suggests ingredients based on available inventory matching coffee products", () => {
    const suggestions = generateSuggestedIngredients("Kopi Latte Dingin", availableIngredients);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    expect(suggestions[0].ingredientId).toBe("ing-coffee");
  });

  it("falls back safely when no keyword matches but available ingredients exist", () => {
    const suggestions = generateSuggestedIngredients("Nasi Goreng Spesial", availableIngredients);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].ingredientId).toBe(availableIngredients[0].id);
  });
});
