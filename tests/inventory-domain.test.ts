import { describe, expect, it } from "vitest";

import {
  buildOpnameExportData,
  buildStockExportData,
  calculateInventoryKPIs,
  calculateOpnameSummary,
  filterStockIngredients,
  filterStockOpnames,
  opnameReasonLabel,
  poStatusLabel,
  poStatusTone,
  stockStatusLabel,
  stockStatusTone,
} from "@/features/inventory/inventory-domain";
import type { IngredientItem, PurchaseOrder, StockOpnameRecord } from "@/types/inventory";

function makeIngredient(id: string, overrides: Partial<IngredientItem> = {}): IngredientItem {
  return {
    id,
    name: `Bahan ${id}`,
    category: "Dairy & Milk",
    stockNumber: 10,
    unit: "L",
    min: 5,
    costPerUnit: 20000,
    supplier: "Bali Dairy Fresh",
    status: "SAFE",
    lastUpdated: "2026-11-11",
    ...overrides,
  };
}

function makePO(id: string, overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id,
    poNumber: `PO-${id}`,
    supplier: "Bali Dairy Fresh",
    items: [],
    subtotal: 100000,
    tax: 11000,
    total: 111000,
    status: "SENT",
    orderDate: "11 Nov 2026",
    ...overrides,
  };
}

function makeOpname(id: string, overrides: Partial<StockOpnameRecord> = {}): StockOpnameRecord {
  return {
    id,
    opnameNumber: `OPN-${id}`,
    date: "11 Nov 2026",
    ingredientId: "ing-1",
    ingredientName: "Fresh Milk",
    category: "Dairy & Milk",
    unit: "L",
    systemStock: 10,
    physicalStock: 8,
    variance: -2,
    varianceType: "DEFICIT",
    reason: "WASTE",
    performedBy: "Auditor Gudang",
    status: "APPLIED",
    createdAt: "2026-11-11",
    ...overrides,
  };
}

describe("calculateInventoryKPIs", () => {
  it("calculates totals, critical counts, and asset valuation accurately", () => {
    const items = [
      makeIngredient("1", { stockNumber: 10, costPerUnit: 20000, min: 5, status: "SAFE" }),
      makeIngredient("2", { stockNumber: 3, costPerUnit: 15000, min: 5, status: "LOW" }),
      makeIngredient("3", { stockNumber: 1, costPerUnit: 50000, min: 5, status: "CRITICAL" }),
      makeIngredient("4", { stockNumber: 0, costPerUnit: 10000, min: 5, status: "CRITICAL" }),
    ];

    const kpis = calculateInventoryKPIs(items);
    expect(kpis.totalStockValue).toBe(10 * 20000 + 3 * 15000 + 1 * 50000 + 0);
    expect(kpis.safeCount).toBe(1);
    expect(kpis.lowCount).toBe(1);
    expect(kpis.criticalCount).toBe(2);
    expect(kpis.outOfStockCount).toBe(1);
    expect(kpis.criticalItems).toHaveLength(2);
  });
});

describe("calculateOpnameSummary", () => {
  it("computes variance volume and estimated loss valuation", () => {
    const opnames = [
      makeOpname("1", { variance: -2, ingredientId: "ing-1" }),
      makeOpname("2", { variance: -1, ingredientId: "ing-2" }),
    ];
    const ingredients = [
      makeIngredient("ing-1", { costPerUnit: 20000 }),
      makeIngredient("ing-2", { costPerUnit: 30000 }),
    ];

    const summary = calculateOpnameSummary(opnames, ingredients);
    expect(summary.totalSessions).toBe(2);
    expect(summary.totalVarianceUnits).toBe(-3);
    expect(summary.totalVarianceValue).toBe(-2 * 20000 + -1 * 30000);
  });
});

describe("filterStockIngredients", () => {
  it("filters ingredients by status, category, and search query", () => {
    const items = [
      makeIngredient("1", { name: "Susu Segar", category: "Dairy", status: "SAFE" }),
      makeIngredient("2", { name: "Biji Kopi", category: "Coffee", status: "LOW" }),
      makeIngredient("3", { name: "Sirup Aren", category: "Syrup", status: "CRITICAL", stockNumber: 0 }),
    ];

    expect(filterStockIngredients(items, "ALL", "ALL", "")).toHaveLength(3);
    expect(filterStockIngredients(items, "OUT_OF_STOCK", "ALL", "")).toHaveLength(1);
    expect(filterStockIngredients(items, "ALL", "Coffee", "")).toHaveLength(1);
    expect(filterStockIngredients(items, "ALL", "ALL", "segar")).toHaveLength(1);
  });
});

describe("filterStockOpnames", () => {
  it("filters opname records by reason and search query", () => {
    const opnames = [
      makeOpname("1", { ingredientName: "Susu", reason: "WASTE" }),
      makeOpname("2", { ingredientName: "Sirup", reason: "EXPIRATION" }),
    ];

    expect(filterStockOpnames(opnames, "ALL", "")).toHaveLength(2);
    expect(filterStockOpnames(opnames, "WASTE", "")).toHaveLength(1);
    expect(filterStockOpnames(opnames, "ALL", "sirup")).toHaveLength(1);
  });
});

describe("status tones and human labels", () => {
  it("maps stock statuses to tones and labels", () => {
    expect(stockStatusTone("SAFE")).toBe("success");
    expect(stockStatusTone("LOW")).toBe("warning");
    expect(stockStatusTone("CRITICAL")).toBe("destructive");

    expect(stockStatusLabel("SAFE")).toBe("Aman");
    expect(stockStatusLabel("LOW")).toBe("Menipis");
    expect(stockStatusLabel("CRITICAL")).toBe("Kritis");
  });

  it("maps PO statuses to tones and labels", () => {
    expect(poStatusTone("SENT")).toBe("warning");
    expect(poStatusTone("RECEIVED")).toBe("success");
    expect(poStatusTone("DRAFT")).toBe("neutral");

    expect(poStatusLabel("SENT")).toBe("Terkirim");
    expect(poStatusLabel("RECEIVED")).toBe("Diterima");
    expect(poStatusLabel("DRAFT")).toBe("Draf");
  });

  it("maps opname reasons to human Indonesian labels", () => {
    expect(opnameReasonLabel("WASTE")).toBe("Waste Operasional");
    expect(opnameReasonLabel("EXPIRATION")).toBe("Kadaluwarsa");
    expect(opnameReasonLabel("RECORDING_ERROR")).toBe("Kesalahan Catat");
  });
});

describe("buildStockExportData and buildOpnameExportData", () => {
  it("formats stock export headers and data rows", () => {
    const items = [makeIngredient("1")];
    const { headers, rows } = buildStockExportData(items);

    expect(headers).toContain("Nama Bahan Baku");
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toBe("Bahan 1");
  });

  it("formats opname export headers and data rows", () => {
    const opnames = [makeOpname("1")];
    const { headers, rows } = buildOpnameExportData(opnames);

    expect(headers).toContain("No. Opname");
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe("OPN-1");
  });
});
