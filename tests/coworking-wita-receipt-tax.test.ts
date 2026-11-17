import { describe, it, expect } from "vitest";
import { getTodayWitaDateString } from "@/features/coworking/coworking-domain";
import {
  MASTER_HQ_OUTLET,
  DEMO_OUTLETS,
  resolveCoworkingReceiptPublisher,
  resolvePosReceiptPublisher,
} from "@/lib/receipt-publisher";
import { calculateCoworkingPricing } from "@/lib/promo";

describe("Task S-10: Booking Co-Working WITA Date, Official Receipt, and Tax Consistency", () => {
  describe("1. WITA Default Booking Date", () => {
    it("returns correct WITA date for early morning hours when UTC is previous day (13 Nov 03:05 WITA -> 2026-11-13)", () => {
      // 13 Nov 2026 03:05 WITA = 12 Nov 2026 19:05 UTC
      const dateWitaEarly = new Date("2026-11-12T19:05:00.000Z");
      expect(getTodayWitaDateString(dateWitaEarly)).toBe("2026-11-13");
      expect(dateWitaEarly.toISOString().split("T")[0]).toBe("2026-11-12"); // proves UTC would be wrong
    });

    it("returns correct WITA date across midnight boundaries", () => {
      // 13 Nov 2026 00:01 WITA = 12 Nov 2026 16:01 UTC
      const justAfterMidnight = new Date("2026-11-12T16:01:00.000Z");
      expect(getTodayWitaDateString(justAfterMidnight)).toBe("2026-11-13");

      // 13 Nov 2026 23:59 WITA = 13 Nov 2026 15:59 UTC
      const justBeforeMidnight = new Date("2026-11-13T15:59:00.000Z");
      expect(getTodayWitaDateString(justBeforeMidnight)).toBe("2026-11-13");
    });
  });

  describe("2. Official Outlet Address & Contact on Receipts", () => {
    const OFFICIAL_ADDRESS = "Jl. Teleng No. 1, Banyuasri, Kec. Buleleng, Kabupaten Buleleng, Bali 81116";
    const OFFICIAL_PHONE = "+62 821-1550-1995";

    it("uses official Jl. Teleng No. 1 address and phone across master HQ and demo outlets", () => {
      expect(MASTER_HQ_OUTLET.address).toBe(OFFICIAL_ADDRESS);
      expect(MASTER_HQ_OUTLET.phone).toBe(OFFICIAL_PHONE);
      expect(DEMO_OUTLETS[0].address).toBe(OFFICIAL_ADDRESS);
      expect(DEMO_OUTLETS[0].phone).toBe(OFFICIAL_PHONE);
    });

    it("provides official address and phone on coworking receipt publisher fallback", () => {
      const pub = resolveCoworkingReceiptPublisher(null);
      expect(pub.brandName).toBe("DAGO CREATIVE HUB");
      expect(pub.outletAddress).toBe(OFFICIAL_ADDRESS);
      expect(pub.outletPhone).toBe(OFFICIAL_PHONE);
    });

    it("provides official address and phone on POS multi-tenant receipt publisher fallback", () => {
      const pub = resolvePosReceiptPublisher([
        { tenantId: "tenant-ks", tenantName: "Kopi Senja" },
        { tenantId: "tenant-kitchen", tenantName: "Dapur Mama" },
      ], null);
      expect(pub.outletAddress).toBe(OFFICIAL_ADDRESS);
      expect(pub.outletPhone).toBe(OFFICIAL_PHONE);
    });
  });

  describe("3. Coworking Tax Label & Exempt PB1 Consistency", () => {
    it("calculates 0 tax and NON_TAX for default coworking booking", () => {
      const pricing = calculateCoworkingPricing(15000);
      expect(pricing.tax).toBe(0);
      expect(pricing.taxType).toBe("NON_TAX");
      expect(pricing.total).toBe(15000);
    });

    it("unifies tax exemption label as 'Pajak (bebas PB1)' when tax is 0", () => {
      const pricing = calculateCoworkingPricing(30000, undefined, 0, "NON_TAX");
      const label = pricing.tax > 0 ? `Pajak (${pricing.taxType} ${pricing.taxRatePercent}%)` : "Pajak (bebas PB1)";
      expect(label).toBe("Pajak (bebas PB1)");
      expect(pricing.tax).toBe(0);
    });

    it("handles explicit taxable coworking correctly when enabled (e.g. PPN 11%)", () => {
      const pricing = calculateCoworkingPricing(100000, undefined, 0.11, "PPN");
      const label = pricing.tax > 0 ? `Pajak (${pricing.taxType} ${pricing.taxRatePercent}%)` : "Pajak (bebas PB1)";
      expect(label).toBe("Pajak (PPN 11%)");
      expect(pricing.tax).toBe(11000);
      expect(pricing.total).toBe(111000);
    });
  });
});
