import { describe, it, expect } from "vitest";
import {
  buildClosingWhatsAppMessage,
  formatClosingTaxStatus,
  formatClosingVerificationShortHash,
  buildClosingReportPdfUrl,
} from "@/features/pos/pos-closing-report";
import type { ClosingReportData } from "@/features/pos/DailyClosingPDFModal";

describe("pos-closing-report domain logic", () => {
  const sampleReport: ClosingReportData = {
    reportNumber: "EOD-20261115-001",
    outletName: "DAGO Creative Hub (Singaraja)",
    outletAddress: "Jl. Veteran No. 8, Singaraja, Bali",
    outletPhone: "081234567890",
    cashierName: "Budi Santoso",
    closingDateTime: "15 November 2026, 22:00 WITA",
    shiftName: "Shift 1 (Pagi)",
    initialCash: 200000,
    totalCashSales: 1050000,
    qrisSales: 2100000,
    edcSales: 350000,
    totalTransactionsCount: 42,
    totalGrossSales: 3500000,
    totalDiscounts: 50000,
    isTaxEnabled: true,
    taxRatePercent: 10,
    totalTax: 318182,
    totalNetSales: 3181818,
    tenantSharePercent: 85,
    dagoSharePercent: 15,
    tenantTotalShare: 2704545,
    dagoTotalShare: 477273,
    tenantQrisShare: 1785000,
    dagoQrisShare: 315000,
    tenantCashShare: 892500,
    dagoCashShare: 157500,
    actualCashEnding: 1250000,
    cashDifference: 0,
    shiftNotes: "Operasional lancar tanpa selisih.",
    verificationHash: "a1b2c3d4e5f67890abcdef1234567890",
  };

  describe("buildClosingWhatsAppMessage", () => {
    it("generates correct WhatsApp text message and URL with sanitized phone", () => {
      const managerPhone = "+62 812-3456-7890";
      const result = buildClosingWhatsAppMessage(sampleReport, managerPhone);

      expect(result.text).toContain("LAPORAN CLOSING RESMI");
      expect(result.text).toContain("EOD-20261115-001");
      expect(result.text).toContain("Budi Santoso");
      expect(result.text).toContain("42 transaksi");
      expect(result.text).toContain("Omzet kotor:");
      expect(result.text).toContain("Omzet bersih:");
      expect(result.text).toContain("BAGI HASIL:");

      // URL should have phone stripped of non-digits
      expect(result.url).toContain("phone=6281234567890");
      expect(result.url).toContain("https://api.whatsapp.com/send?");
    });

    it("handles tax disabled gracefully in WhatsApp message", () => {
      const noTaxReport = { ...sampleReport, isTaxEnabled: false, taxRatePercent: 0, totalTax: 0 };
      const result = buildClosingWhatsAppMessage(noTaxReport, "081111");

      expect(result.text).toContain("Pajak PB1: Bebas pajak (0%)");
    });
  });

  describe("formatClosingTaxStatus", () => {
    it("formats tax status into sentence case Indonesian", () => {
      expect(formatClosingTaxStatus(true, 10)).toBe("PB1 10% (aktif)");
      expect(formatClosingTaxStatus(true, 11)).toBe("PPN 11% (aktif)");
      expect(formatClosingTaxStatus(false, 0)).toBe("Nonaktif (0%)");
      expect(formatClosingTaxStatus(false, 10)).toBe("Nonaktif (0%)");
    });
  });

  describe("formatClosingVerificationShortHash", () => {
    it("safely truncates verification hash to 10 characters with ellipsis", () => {
      expect(formatClosingVerificationShortHash("a1b2c3d4e5f67890abcdef1234567890")).toBe("a1b2c3d4e5...");
      expect(formatClosingVerificationShortHash("short")).toBe("short");
      expect(formatClosingVerificationShortHash("")).toBe("-");
    });
  });

  describe("buildClosingReportPdfUrl", () => {
    it("builds the server endpoint URL for PDF rendering with complete parameters", () => {
      const url = buildClosingReportPdfUrl(sampleReport);
      expect(url).toContain("/api/reports/closing/pdf?");
      expect(url).toContain("docNo=EOD-20261115-001");
      expect(url).toContain("gross=3500000");
      expect(url).toContain("net=3181818");
      expect(url).toContain("transactions=42");
    });
  });
});
