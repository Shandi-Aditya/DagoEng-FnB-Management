import { describe, it, expect } from "vitest";
import { calculateCoworkingPricing } from "@/lib/promo";
import { DEFAULT_CATEGORY_TAX_CONFIG } from "@/types/settings";

describe("B8: Category-Level Tax Configuration & Coworking Pricing (POS-07, TC-E02)", () => {
  it("defaults coworking tax to non-taxable / 0% under default platform configuration", () => {
    const basePrice = 50000;
    const cwTaxConfig = DEFAULT_CATEGORY_TAX_CONFIG.coworking;
    const taxRate = cwTaxConfig.isEnabled ? cwTaxConfig.taxRatePercent / 100 : 0;

    const result = calculateCoworkingPricing(basePrice, undefined, taxRate, cwTaxConfig.taxType);

    expect(result.originalSubtotal).toBe(50000);
    expect(result.discountAmount).toBe(0);
    expect(result.subtotalAfterDiscount).toBe(50000);
    expect(result.tax).toBe(0);
    expect(result.total).toBe(50000);
    expect(result.taxType).toBe("NON_TAX");
    expect(result.taxRatePercent).toBe(0);
  });

  it("calculates promo discount before tax for coworking bookings", () => {
    const basePrice = 100000;
    const promo = {
      id: "promo-cw20",
      code: "DAGO20",
      name: "Diskon 20%",
      discountType: "PERCENTAGE" as const,
      discountValue: 20,
      targetType: "ALL" as const,
      scope: "COWORKING" as const,
      minimumAmount: 50000,
      isActive: true,
    };

    const result = calculateCoworkingPricing(basePrice, promo, 0, "NON_TAX");

    expect(result.originalSubtotal).toBe(100000);
    expect(result.discountAmount).toBe(20000);
    expect(result.subtotalAfterDiscount).toBe(80000);
    expect(result.tax).toBe(0);
    expect(result.total).toBe(80000);
  });

  it("applies flexible PPN tax when enabled for coworking space", () => {
    const basePrice = 100000;
    const ppnRate = 0.11; // 11% PPN

    const result = calculateCoworkingPricing(basePrice, undefined, ppnRate, "PPN");

    expect(result.originalSubtotal).toBe(100000);
    expect(result.tax).toBe(11000);
    expect(result.total).toBe(111000);
    expect(result.taxType).toBe("PPN");
    expect(result.taxRatePercent).toBe(11);
  });

  it("maintains strict category separation between F&B (PB1 10%) and Coworking (NON_TAX 0%)", () => {
    const fnbTax = DEFAULT_CATEGORY_TAX_CONFIG.fnb;
    const cwTax = DEFAULT_CATEGORY_TAX_CONFIG.coworking;

    expect(fnbTax.taxType).toBe("PB1");
    expect(fnbTax.taxRatePercent).toBe(10);
    expect(fnbTax.isEnabled).toBe(true);

    expect(cwTax.taxType).toBe("NON_TAX");
    expect(cwTax.taxRatePercent).toBe(0);
    expect(cwTax.isEnabled).toBe(false);
  });
});
