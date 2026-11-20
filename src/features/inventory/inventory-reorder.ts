import type { IngredientItem, StockAdjustmentLog } from "@/types/inventory";

/** Same "critical" line as calculateInventoryKPIs: flagged critical, or at most 40% of the minimum. */
const CRITICAL_RATIO = 0.4;
/** Suggested order restores stock to this multiple of the minimum. */
const RESTOCK_TARGET = 2;

export interface ReorderEntry {
  item: IngredientItem;
  reason: "habis" | "kritis";
  suggestedQuantity: number;
}

function needsReorder(item: IngredientItem): boolean {
  return item.stockNumber <= 0 || item.status === "CRITICAL" || item.stockNumber <= item.min * CRITICAL_RATIO;
}

function stockRatio(item: IngredientItem): number {
  return item.min > 0 ? item.stockNumber / item.min : item.stockNumber;
}

/** Quantity that brings stock back to twice the minimum; never below one unit. */
export function suggestedReorderQuantity(item: IngredientItem): number {
  return Math.max(1, Math.ceil(item.min * RESTOCK_TARGET - item.stockNumber));
}

/** Items to buy now, most urgent first, with a suggested quantity back to twice the minimum. */
export function buildReorderList(ingredients: readonly IngredientItem[]): ReorderEntry[] {
  return ingredients
    .filter(needsReorder)
    .sort((a, b) => stockRatio(a) - stockRatio(b))
    .map((item) => ({
      item,
      reason: item.stockNumber <= 0 ? "habis" : "kritis",
      suggestedQuantity: suggestedReorderQuantity(item),
    }));
}

/** Calendar date `days` after `from`, e.g. "14 Nov 2026". */
export function deliveryDateLabel(from: Date, days: number): string {
  const date = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Makassar" });
}

const CATEGORY_LABEL: Record<IngredientItem["category"], string> = {
  Dairy: "Susu dan olahan",
  "Coffee Beans": "Biji kopi",
  "Syrup & Sweetener": "Sirup dan pemanis",
  "Meat & Protein": "Daging dan protein",
  "Dry Goods": "Bahan kering",
  Packaging: "Kemasan",
};

/** Indonesian label for the stored (English) ingredient category. */
export function ingredientCategoryLabel(category: string): string {
  return CATEGORY_LABEL[category as IngredientItem["category"]] ?? category;
}

const ADJUSTMENT_REASON_LABEL: Record<string, string> = {
  PENJUALAN_RESEP: "Terjual",
  PO_MASUK: "PO diterima",
  OPNAME_HILANG_RUSAK: "Opname",
  MANUAL_ADJUSTMENT: "Penyesuaian manual",
  PRODUKSI_BOM: "Pemakaian produksi",
  WASTE_RUSAK: "Limbah atau rusak",
  KADALUWARSA: "Kedaluwarsa",
  KOREKSI_OPNAME: "Koreksi opname",
  LAINNYA: "Penyesuaian lain",
};

export function adjustmentReasonLabel(reason: StockAdjustmentLog["reason"] | string): string {
  return ADJUSTMENT_REASON_LABEL[reason] ?? reason;
}
