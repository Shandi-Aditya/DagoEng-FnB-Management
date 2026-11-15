import { describe, it, expect } from "vitest";
import {
  formatReportPrintDate,
  buildReportSignatories,
  isNumericOrCurrencyCell,
  formatReportHeaderBadge,
} from "../src/features/reports/report-pdf-domain";

describe("report-pdf-domain", () => {
  it("formats print date with WITA timezone in Indonesian locale", () => {
    const fixedDate = new Date("2026-11-15T06:00:00.000Z"); // 14:00 WITA
    const formatted = formatReportPrintDate(fixedDate);
    expect(formatted).toContain("2026");
    expect(formatted).toContain("WITA");
  });

  it("builds factual signatories without hardcoded fictional names", () => {
    const signatories = buildReportSignatories("Hendra Wijaya", "Outlet Singaraja");
    expect(signatories).toHaveLength(3);

    // Preparer
    expect(signatories[0].roleTitle).toBe("Disiapkan oleh");
    expect(signatories[0].name).toBe("Hendra Wijaya");

    // Reviewer
    expect(signatories[1].roleTitle).toBe("Diperiksa oleh");
    expect(signatories[1].designation).toBe("Supervisor / Manager Gerai");

    // Approver
    expect(signatories[2].roleTitle).toBe("Disetujui oleh");
    expect(signatories[2].designation).toBe("Pimpinan / Owner");
  });

  it("identifies numeric and currency values for table alignment", () => {
    expect(isNumericOrCurrencyCell(150000)).toBe(true);
    expect(isNumericOrCurrencyCell("Rp 25.000")).toBe(true);
    expect(isNumericOrCurrencyCell("75%")).toBe(true);
    expect(isNumericOrCurrencyCell("Kopi Senja")).toBe(false);
    expect(isNumericOrCurrencyCell("")).toBe(false);
  });

  it("formats report type badge text cleanly in sentence case", () => {
    expect(formatReportHeaderBadge("SALES")).toBe("Laporan Penjualan");
    expect(formatReportHeaderBadge("CLOSING")).toBe("Laporan Closing");
    expect(formatReportHeaderBadge("INVENTORY")).toBe("Laporan Stok & HPP");
    expect(formatReportHeaderBadge("FINANCE_AUDIT")).toBe("Laporan Audit Finansial");
    expect(formatReportHeaderBadge("SETTLEMENT")).toBe("Laporan Settlement");
    expect(formatReportHeaderBadge("EVENTS")).toBe("Laporan Acara");
  });
});
