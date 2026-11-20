import { describe, expect, it } from "vitest";

import {
  computeCustomersReportPdfMetrics,
  buildCustomersReportDocNumber,
  buildCustomersReportSignatories,
  formatCustomersReportPrintDate,
  formatCustomerTierLabel,
  formatCustomerTierTone,
} from "@/features/customers/customers-report-pdf-domain";
import type { LoyaltyMember } from "@/types/loyalty";

const MOCK_MEMBERS: LoyaltyMember[] = [
  {
    id: "mem-1",
    name: "Ahmad Wijaya",
    phone: "081234567890",
    email: "ahmad@example.com",
    tier: "Platinum",
    points: 1250,
    totalSpend: 4500000,
    totalVisits: 18,
    favoriteItem: "Es Kopi Dago",
    registeredOutletId: "outlet-sgr",
    registeredOutletName: "Singaraja",
    status: "ACTIVE",
    joinedDate: "2026-01-10",
    lastVisit: "2026-11-10",
    pointHistory: [],
    tierHistory: [],
  },
  {
    id: "mem-2",
    name: "Siti Nurhaliza",
    phone: "081298765432",
    email: "siti@example.com",
    tier: "Gold",
    points: 600,
    totalSpend: 2200000,
    totalVisits: 9,
    favoriteItem: "Matcha Latte",
    registeredOutletId: "outlet-sgr",
    registeredOutletName: "Singaraja",
    status: "ACTIVE",
    joinedDate: "2026-02-14",
    lastVisit: "2026-11-12",
    pointHistory: [],
    tierHistory: [],
  },
  {
    id: "mem-3",
    name: "Budi Santoso",
    phone: "081311223344",
    email: "budi@example.com",
    tier: "Silver",
    points: 150,
    totalSpend: 750000,
    totalVisits: 3,
    favoriteItem: "Americano",
    registeredOutletId: "outlet-sgr",
    registeredOutletName: "Singaraja",
    status: "ACTIVE",
    joinedDate: "2026-03-01",
    lastVisit: "2026-11-15",
    pointHistory: [],
    tierHistory: [],
  },
];

describe("customers-report-pdf-domain", () => {
  it("computes executive summary metrics accurately without mutating input", () => {
    const originalCopy = JSON.parse(JSON.stringify(MOCK_MEMBERS));
    const metrics = computeCustomersReportPdfMetrics(MOCK_MEMBERS);

    expect(metrics.totalMembers).toBe(3);
    expect(metrics.platinumCount).toBe(1);
    expect(metrics.goldCount).toBe(1);
    expect(metrics.silverCount).toBe(1);
    expect(metrics.vipCount).toBe(2); // Platinum + Gold
    expect(metrics.totalPoints).toBe(2000);
    expect(metrics.totalSpend).toBe(7450000);
    expect(metrics.averageSpendPerMember).toBe(Math.round(7450000 / 3));

    // Non-mutation check
    expect(MOCK_MEMBERS).toEqual(originalCopy);
  });

  it("handles empty members list gracefully with safe zero defaults", () => {
    const metrics = computeCustomersReportPdfMetrics([]);

    expect(metrics.totalMembers).toBe(0);
    expect(metrics.platinumCount).toBe(0);
    expect(metrics.goldCount).toBe(0);
    expect(metrics.silverCount).toBe(0);
    expect(metrics.vipCount).toBe(0);
    expect(metrics.totalPoints).toBe(0);
    expect(metrics.totalSpend).toBe(0);
    expect(metrics.averageSpendPerMember).toBe(0);
  });

  it("builds a deterministic official document number without Math.random", () => {
    const date = new Date("2026-11-15T10:00:00Z");
    const docNum1 = buildCustomersReportDocNumber(date, 15);
    const docNum2 = buildCustomersReportDocNumber(date, 15);

    expect(docNum1).toBe("CRM-REP-20261115-015");
    expect(docNum1).toBe(docNum2);
  });

  it("builds 3 factual accountable signatories for the outlet", () => {
    const signatories = buildCustomersReportSignatories("Dago Creative Hub - Jimbaran");

    expect(signatories).toHaveLength(3);
    expect(signatories[0].role).toBe("Staf Front Office & CRM");
    expect(signatories[1].role).toBe("Supervisor Loyalty & Program");
    expect(signatories[2].role).toBe("Manajer Operasional Gerai");
    expect(signatories[0].outlet).toContain("Jimbaran");
  });

  it("formats customer report print date properly in Indonesian convention", () => {
    const date = new Date("2026-11-15T08:30:00Z");
    const formatted = formatCustomersReportPrintDate(date);

    expect(formatted).toContain("15 November 2026");
  });

  it("translates tiers into standard Indonesian labels and semantic tones", () => {
    expect(formatCustomerTierLabel("Platinum")).toBe("Platinum");
    expect(formatCustomerTierTone("Platinum")).toBe("success");
    expect(formatCustomerTierTone("Gold")).toBe("warning");
    expect(formatCustomerTierTone("Silver")).toBe("info");
    expect(formatCustomerTierTone("Bronze")).toBe("neutral");
  });
});
