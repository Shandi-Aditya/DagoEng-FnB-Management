import { describe, expect, it } from "vitest";

import type { IngredientItem } from "@/types/inventory";
import {
  buildInventoryReportDocNumber,
  buildInventoryReportSignatories,
  computeInventoryReportPdfMetrics,
  formatInventoryReportDate,
} from "@/features/inventory/inventory-report-pdf-domain";

describe("inventory-report-pdf-domain", () => {
  const sampleIngredients: IngredientItem[] = [
    {
      id: "ing-1",
      name: "Susu Fresh Milk",
      category: "Dairy",
      stockNumber: 20,
      unit: "Liter",
      min: 10,
      costPerUnit: 18000,
      supplier: "Diamond",
      status: "SAFE",
      lastUpdated: "2026-11-15",
    },
    {
      id: "ing-2",
      name: "Biji Kopi Senja House Blend",
      category: "Coffee Beans",
      stockNumber: 3,
      unit: "kg",
      min: 5,
      costPerUnit: 120000,
      supplier: "Kintamani Roastery",
      status: "LOW",
      lastUpdated: "2026-11-15",
    },
    {
      id: "ing-3",
      name: "Sirup Karamel",
      category: "Syrup & Sweetener",
      stockNumber: 1,
      unit: "Botol",
      min: 4,
      costPerUnit: 85000,
      supplier: "Toffin",
      status: "CRITICAL",
      lastUpdated: "2026-11-15",
    },
  ];

  it("computes executive summary metrics accurately without mutating input", () => {
    const copy = JSON.parse(JSON.stringify(sampleIngredients));
    const metrics = computeInventoryReportPdfMetrics(sampleIngredients);

    // 20*18000 (360.000) + 3*120000 (360.000) + 1*85000 (85.000) = 805.000
    expect(metrics.totalValuation).toBe(805000);
    expect(metrics.safeCount).toBe(1);
    expect(metrics.lowCount).toBe(1);
    expect(metrics.criticalCount).toBe(1);

    expect(sampleIngredients.length).toBe(copy.length);
  });

  it("handles empty ingredient list gracefully with safe zero defaults", () => {
    const metrics = computeInventoryReportPdfMetrics([]);

    expect(metrics.totalValuation).toBe(0);
    expect(metrics.safeCount).toBe(0);
    expect(metrics.lowCount).toBe(0);
    expect(metrics.criticalCount).toBe(0);
  });

  it("builds a deterministic official document number without Math.random", () => {
    const fixedDate = new Date("2026-11-15T09:30:00Z");
    const docNumber = buildInventoryReportDocNumber(fixedDate, 42);

    expect(docNumber).toBe("REP-INV-20261115-42");
  });

  it("builds 3 factual accountable signatories for the outlet", () => {
    const signatories = buildInventoryReportSignatories("Staf Gudang", "Singaraja (Pusat)");

    expect(signatories.preparer.role).toBe("Staf Gudang / Barista");
    expect(signatories.preparer.name).toBe("Staf Gudang");

    expect(signatories.reviewer.role).toBe("Supervisor Gerai");
    expect(signatories.reviewer.name).toContain("Supervisor");

    expect(signatories.approver.role).toBe("Pimpinan / Owner Gerai");
    expect(signatories.approver.name).toContain("Pimpinan");
  });

  it("formats report date according to Indonesian WITA conventions", () => {
    const fixedDate = new Date("2026-11-15T10:30:00Z");
    const formatted = formatInventoryReportDate(fixedDate);

    expect(formatted).toContain("15");
    expect(formatted).toContain("Nov");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("WITA");
  });
});
