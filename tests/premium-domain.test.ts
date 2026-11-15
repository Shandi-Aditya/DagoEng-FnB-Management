import { describe, it, expect } from "vitest";
import {
  getProBadgeVariantMeta,
  formatFeatureBenefits,
  getSamplePlanStatusLabel,
} from "@/components/premium/premium-domain";

describe("Premium Domain Logic", () => {
  describe("getProBadgeVariantMeta", () => {
    it("maps 'addon' variant to appropriate label and tone", () => {
      const meta = getProBadgeVariantMeta("addon");
      expect(meta.label).toBe("ADD-ON");
      expect(meta.tone).toBe("primary");
    });

    it("maps 'pro' variant to PRO label with accent tone", () => {
      const meta = getProBadgeVariantMeta("pro");
      expect(meta.label).toBe("PRO");
      expect(meta.tone).toBe("warning");
    });

    it("maps 'enterprise' variant to ENTERPRISE label with info tone", () => {
      const meta = getProBadgeVariantMeta("enterprise");
      expect(meta.label).toBe("ENTERPRISE");
      expect(meta.tone).toBe("info");
    });

    it("maps 'beta' variant to BETA label with neutral tone", () => {
      const meta = getProBadgeVariantMeta("beta");
      expect(meta.label).toBe("BETA");
      expect(meta.tone).toBe("neutral");
    });

    it("handles undefined or unknown variant gracefully with default addon", () => {
      const meta = getProBadgeVariantMeta(undefined as any);
      expect(meta.label).toBe("ADD-ON");
      expect(meta.tone).toBe("primary");
    });
  });

  describe("formatFeatureBenefits", () => {
    it("cleans and filters empty benefit items", () => {
      const benefits = ["  Otomatisasi Inventori  ", "", "   ", "Integrasi POS"];
      const formatted = formatFeatureBenefits(benefits);
      expect(formatted).toEqual(["Otomatisasi Inventori", "Integrasi POS"]);
    });

    it("handles empty or undefined array gracefully", () => {
      expect(formatFeatureBenefits(undefined)).toEqual([]);
      expect(formatFeatureBenefits([])).toEqual([]);
    });

    it("limits benefits to maximum requested count", () => {
      const benefits = ["1", "2", "3", "4", "5"];
      expect(formatFeatureBenefits(benefits, 3)).toEqual(["1", "2", "3"]);
    });
  });

  describe("getSamplePlanStatusLabel", () => {
    it("returns provided status text or default fallback", () => {
      expect(getSamplePlanStatusLabel("Aktif")).toBe("Aktif");
      expect(getSamplePlanStatusLabel("")).toBe("Tersedia untuk Pengujian Demo");
      expect(getSamplePlanStatusLabel(undefined)).toBe("Tersedia untuk Pengujian Demo");
    });
  });
});
