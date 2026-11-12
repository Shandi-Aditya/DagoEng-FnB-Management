import { describe, expect, it } from "vitest";

import { adjustmentReasonLabel, buildReorderList, deliveryDateLabel, ingredientCategoryLabel, suggestedReorderQuantity } from "@/features/inventory/inventory-reorder";
import type { IngredientItem } from "@/types/inventory";

function ingredient(id: string, stockNumber: number, min: number, status: IngredientItem["status"] = "SAFE"): IngredientItem {
  return {
    id,
    name: id,
    category: "Dairy",
    stockNumber,
    unit: "liter",
    min,
    costPerUnit: 20000,
    supplier: "Bali Dairy Fresh",
    status,
    lastUpdated: "2026-11-12",
  };
}

describe("buildReorderList", () => {
  it("lists out-of-stock items first, then critical items by how far below minimum they are", () => {
    const list = buildReorderList([
      ingredient("aman", 50, 10),
      ingredient("kritis-ringan", 4, 10),
      ingredient("habis", 0, 5),
      ingredient("kritis-parah", 1, 10),
      ingredient("ditandai-kritis", 9, 10, "CRITICAL"),
    ]);

    expect(list.map((entry) => entry.item.id)).toEqual(["habis", "kritis-parah", "kritis-ringan", "ditandai-kritis"]);
    expect(list[0].reason).toBe("habis");
    expect(list[1].reason).toBe("kritis");
  });

  it("suggests buying back up to twice the minimum, at least one unit", () => {
    const [entry] = buildReorderList([ingredient("susu", 2, 10)]);
    expect(entry.suggestedQuantity).toBe(18);

    const [marked] = buildReorderList([ingredient("x", 25, 10, "CRITICAL")]);
    expect(marked.suggestedQuantity).toBe(1);
  });

  it("returns nothing when every item is above the critical line", () => {
    expect(buildReorderList([ingredient("a", 10, 10), ingredient("b", 5, 10)])).toEqual([]);
  });
});

describe("deliveryDateLabel", () => {
  it("formats a real date instead of a fixed phrase", () => {
    expect(deliveryDateLabel(new Date("2026-11-12T03:00:00Z"), 2)).toBe("14 Nov 2026");
  });
});

describe("labels", () => {
  it("translates ingredient categories and stock movement reasons", () => {
    expect(ingredientCategoryLabel("Coffee Beans")).toBe("Biji kopi");
    expect(ingredientCategoryLabel("Dry Goods")).toBe("Bahan kering");
    expect(adjustmentReasonLabel("PENJUALAN_RESEP")).toBe("Terjual");
    expect(adjustmentReasonLabel("PO_MASUK")).toBe("PO diterima");
    expect(adjustmentReasonLabel("OPNAME_HILANG_RUSAK")).toBe("Opname");
    expect(adjustmentReasonLabel("MANUAL_ADJUSTMENT")).toBe("Penyesuaian manual");
  });

  it("uses one suggestion rule for the panel and the PO form", () => {
    expect(suggestedReorderQuantity(ingredient("s", 2, 10))).toBe(18);
  });
});
