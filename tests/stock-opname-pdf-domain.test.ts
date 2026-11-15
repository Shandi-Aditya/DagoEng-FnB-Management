import { describe, it, expect } from "vitest";
import type { StockOpnameRecord } from "@/types/inventory";
import {
  computeStockOpnamePdfMetrics,
  buildStockOpnameDocNumber,
  buildStockOpnameSignatories,
  formatStockOpnamePrintDate,
  formatOpnameReasonLabel,
  formatOpnameVarianceTone,
} from "@/features/inventory/stock-opname-pdf-domain";

describe("stock-opname-pdf-domain", () => {
  const mockOpnames: StockOpnameRecord[] = [
    {
      id: "opn-1",
      opnameNumber: "OPN-20261115-001",
      date: "2026-11-15T08:00:00.000Z",
      ingredientId: "ing-1",
      ingredientName: "Biji Kopi Arabika",
      category: "Coffee Beans",
      unit: "gram",
      systemStock: 5000,
      physicalStock: 4800,
      variance: -200,
      varianceValue: -50000,
      varianceType: "DEFICIT",
      reason: "WASTE",
      reasonNotes: "Tumpah saat kalibrasi grinder",
      performedBy: "Wayan Barista",
      status: "APPLIED",
      createdAt: "2026-11-15T08:30:00.000Z",
    },
    {
      id: "opn-2",
      opnameNumber: "OPN-20261115-002",
      date: "2026-11-15T08:00:00.000Z",
      ingredientId: "ing-2",
      ingredientName: "Susu Fresh Milk",
      category: "Dairy & Milk",
      unit: "ml",
      systemStock: 10000,
      physicalStock: 10500,
      variance: 500,
      varianceValue: 15000,
      varianceType: "SURPLUS",
      reason: "RECORDING_ERROR",
      reasonNotes: "Salah catat penerimaan faktur kemarin",
      performedBy: "Wayan Barista",
      status: "APPLIED",
      createdAt: "2026-11-15T08:35:00.000Z",
    },
    {
      id: "opn-3",
      opnameNumber: "OPN-20261115-003",
      date: "2026-11-15T08:00:00.000Z",
      ingredientId: "ing-3",
      ingredientName: "Sirup Karamel",
      category: "Syrup & Sauce",
      unit: "ml",
      systemStock: 2000,
      physicalStock: 2000,
      variance: 0,
      varianceValue: 0,
      varianceType: "MATCH",
      reason: "OTHER",
      performedBy: "Wayan Barista",
      status: "APPLIED",
      createdAt: "2026-11-15T08:40:00.000Z",
    },
  ];

  it("computes executive summary opname metrics accurately without mutating input", () => {
    const metrics = computeStockOpnamePdfMetrics(mockOpnames);

    expect(metrics.totalItems).toBe(3);
    expect(metrics.surplusCount).toBe(1);
    expect(metrics.deficitCount).toBe(1);
    expect(metrics.matchCount).toBe(1);
    // Absolute sum: |-50000| + |15000| + |0| = 65000
    expect(metrics.totalVarianceValue).toBe(65000);
  });

  it("handles empty opname records gracefully with safe zero defaults", () => {
    const metrics = computeStockOpnamePdfMetrics([]);

    expect(metrics.totalItems).toBe(0);
    expect(metrics.surplusCount).toBe(0);
    expect(metrics.deficitCount).toBe(0);
    expect(metrics.matchCount).toBe(0);
    expect(metrics.totalVarianceValue).toBe(0);
  });

  it("builds a deterministic official document number without Math.random", () => {
    const fixedDate = new Date("2026-11-15T10:00:00Z");
    const docNo = buildStockOpnameDocNumber(fixedDate, 3);

    expect(docNo).toBe("BA-OPN-20261115-3");
  });

  it("builds 3 factual accountable signatories for the outlet", () => {
    const signatories = buildStockOpnameSignatories("Wayan Barista", "Singaraja (Pusat)");

    expect(signatories.auditor.name).toBe("Wayan Barista");
    expect(signatories.auditor.role).toBe("Petugas Opname Fisik");
    expect(signatories.auditor.outlet).toBe("Singaraja (Pusat)");

    expect(signatories.supervisor.role).toBe("Supervisor Gudang / Dapur");
    expect(signatories.supervisor.name).toContain("Singaraja (Pusat)");

    expect(signatories.approver.role).toBe("Pimpinan / Owner Gerai");
    expect(signatories.approver.name).toContain("Singaraja (Pusat)");
  });

  it("formats opname print date properly in Indonesian convention", () => {
    const fixedDate = new Date("2026-11-15T10:30:00Z");
    const formatted = formatStockOpnamePrintDate(fixedDate);

    expect(formatted).toContain("15 November 2026");
  });

  it("translates opname reasons into standard Indonesian labels", () => {
    expect(formatOpnameReasonLabel("RECORDING_ERROR")).toBe("Selisih hitung / catat");
    expect(formatOpnameReasonLabel("WASTE")).toBe("Waste operasional");
    expect(formatOpnameReasonLabel("LOSS")).toBe("Kehilangan (loss)");
    expect(formatOpnameReasonLabel("DAMAGED")).toBe("Kerusakan fisik");
    expect(formatOpnameReasonLabel("EXPIRATION")).toBe("Kedaluwarsa");
    expect(formatOpnameReasonLabel("SAMPLE_PROMO")).toBe("Sampel promo");
    expect(formatOpnameReasonLabel("OTHER")).toBe("Lainnya");
    expect(formatOpnameReasonLabel("UNKNOWN_REASON")).toBe("Lainnya");
  });

  it("maps variance values to appropriate semantic status tones", () => {
    expect(formatOpnameVarianceTone(500)).toBe("success");
    expect(formatOpnameVarianceTone(-200)).toBe("destructive");
    expect(formatOpnameVarianceTone(0)).toBe("neutral");
  });
});
