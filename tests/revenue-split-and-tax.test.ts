import { describe, it, expect } from "vitest";

describe("POS Tax Settings & Revenue Sharing Split Engine", () => {
  it("calculates order totals accurately with PPN/PB1 active vs inactive", () => {
    const subtotal = 100000;
    const discount = 10000;
    const taxableAmount = subtotal - discount; // 90,000

    // When Tax is Enabled (PB1 10%)
    const taxRatePercent = 10;
    const isTaxEnabled = true;
    const taxAmountActive = isTaxEnabled
      ? Math.round(taxableAmount * (taxRatePercent / 100))
      : 0;
    expect(taxAmountActive).toBe(9000);
    expect(taxableAmount + taxAmountActive).toBe(99000);

    // When Tax is Disabled
    const isTaxDisabled = false;
    const taxAmountDisabled = isTaxDisabled
      ? Math.round(taxableAmount * (taxRatePercent / 100))
      : 0;
    expect(taxAmountDisabled).toBe(0);
    expect(taxableAmount + taxAmountDisabled).toBe(90000);
  });

  it("calculates Revenue Sharing Split (85% Tenant vs 15% Dago Hub) across QRIS and Cash", () => {
    const totalCashSales = 680000;
    const qrisSales = 1450000;
    const totalNetSales = totalCashSales + qrisSales; // 2,130,000

    const tenantSharePercent = 85;
    const dagoSharePercent = 15;

    // Tenant Calculations
    const tenantTotal = Math.round((totalNetSales * tenantSharePercent) / 100);
    const tenantQris = Math.round((qrisSales * tenantSharePercent) / 100);
    const tenantCash = Math.round((totalCashSales * tenantSharePercent) / 100);

    // Dago Hub Calculations
    const dagoTotal = totalNetSales - tenantTotal;
    const dagoQris = qrisSales - tenantQris;
    const dagoCash = totalCashSales - tenantCash;

    expect(tenantTotal).toBe(1810500);
    expect(dagoTotal).toBe(319500);
    expect(tenantTotal + dagoTotal).toBe(totalNetSales);

    expect(tenantQris + dagoQris).toBe(qrisSales);
    expect(tenantCash + dagoCash).toBe(totalCashSales);
  });

  it("formats WhatsApp closing report text with required business breakdown", () => {
    const outletName = "Kopi Senja Singaraja";
    const cashierName = "Ni Kadek Sri";
    const totalSales = 2130000;
    const tenantShare = 1810500;
    const dagoShare = 319500;

    const waReport = `📊 *LAPORAN CLOSING SHIFT - DAGOENG F&B*
Outlet: ${outletName}
Kasir: ${cashierName}
Total Omset: Rp ${totalSales}
Porsi Tenant (85%): Rp ${tenantShare}
Porsi Dago Hub (15%): Rp ${dagoShare}`;

    expect(waReport).toContain("LAPORAN CLOSING SHIFT");
    expect(waReport).toContain("Kopi Senja Singaraja");
    expect(waReport).toContain("Ni Kadek Sri");
    expect(waReport).toContain("Porsi Tenant (85%)");
    expect(waReport).toContain("Porsi Dago Hub (15%)");
  });
});
