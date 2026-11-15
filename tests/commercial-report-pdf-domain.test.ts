import { describe, expect, it } from "vitest";

import {
  computeCommercialReportPdfMetrics,
  buildCommercialReportDocNumber,
  buildCommercialReportSignatories,
  formatCommercialReportPrintDate,
  formatCommercialLeaseStatusLabel,
  formatCommercialLeaseStatusTone,
} from "@/features/commercial/commercial-report-pdf-domain";
import type { CommercialLease } from "@/types/commercial";

const MOCK_LEASES: CommercialLease[] = [
  {
    id: "lease-1",
    leaseNumber: "LSE-001",
    tenantName: "Kopi Kenangan",
    tenantContact: "0811223344",
    unitCode: "LOT-A1",
    areaSquareMeters: 45,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    monthlyRent: 15000000,
    depositAmount: 30000000,
    status: "ACTIVE",
    paymentHistory: [
      { id: "pay-1", date: "2026-01-05", amount: 15000000, period: "Januari 2026", method: "TRANSFER" },
      { id: "pay-2", date: "2026-02-05", amount: 15000000, period: "Februari 2026", method: "TRANSFER" },
    ],
  },
  {
    id: "lease-2",
    leaseNumber: "LSE-002",
    tenantName: "Sour Sally",
    tenantContact: "0819876543",
    unitCode: "LOT-B2",
    areaSquareMeters: 30,
    startDate: "2026-02-01",
    endDate: "2026-04-30",
    monthlyRent: 10000000,
    depositAmount: 20000000,
    status: "EXPIRING_SOON",
    paymentHistory: [
      { id: "pay-3", date: "2026-02-02", amount: 10000000, period: "Februari 2026", method: "TRANSFER" },
    ],
  },
  {
    id: "lease-3",
    leaseNumber: "LSE-003",
    tenantName: "Gramedia Kiosk",
    tenantContact: "0815556667",
    unitCode: "LOT-C3",
    areaSquareMeters: 25,
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    monthlyRent: 8000000,
    depositAmount: 16000000,
    status: "TERMINATED",
    paymentHistory: [],
  },
];

describe("commercial-report-pdf-domain", () => {
  it("computes executive commercial report metrics accurately without mutating input", () => {
    const originalCopy = JSON.parse(JSON.stringify(MOCK_LEASES));
    const metrics = computeCommercialReportPdfMetrics(MOCK_LEASES);

    expect(metrics.totalLeases).toBe(3);
    expect(metrics.activeLeases).toBe(1);
    expect(metrics.expiringSoonLeases).toBe(1);
    expect(metrics.terminatedLeases).toBe(1);
    expect(metrics.occupancyRatePercent).toBe(Math.round((2 / 3) * 100)); // ACTIVE + EXPIRING_SOON
    expect(metrics.totalAnnualValue).toBe((15000000 + 10000000 + 8000000) * 12);
    expect(metrics.totalDepositHeld).toBe(30000000 + 20000000 + 16000000);
    expect(metrics.totalPaidRevenue).toBe(30000000 + 10000000); // 40.000.000
    expect(metrics.averageMonthlyRent).toBe(Math.round((15000000 + 10000000 + 8000000) / 3));

    // Non-mutation check
    expect(MOCK_LEASES).toEqual(originalCopy);
  });

  it("handles empty leases list gracefully with safe zero defaults", () => {
    const metrics = computeCommercialReportPdfMetrics([]);

    expect(metrics.totalLeases).toBe(0);
    expect(metrics.activeLeases).toBe(0);
    expect(metrics.expiringSoonLeases).toBe(0);
    expect(metrics.terminatedLeases).toBe(0);
    expect(metrics.occupancyRatePercent).toBe(0);
    expect(metrics.totalAnnualValue).toBe(0);
    expect(metrics.totalDepositHeld).toBe(0);
    expect(metrics.totalPaidRevenue).toBe(0);
    expect(metrics.averageMonthlyRent).toBe(0);
  });

  it("builds a deterministic official document number without Math.random", () => {
    const date = new Date("2026-11-15T10:00:00Z");
    const docNum1 = buildCommercialReportDocNumber(date, 7);
    const docNum2 = buildCommercialReportDocNumber(date, 7);

    expect(docNum1).toBe("COMM-REP-20261115-007");
    expect(docNum1).toBe(docNum2);
  });

  it("builds 3 factual accountable signatories for commercial property", () => {
    const signatories = buildCommercialReportSignatories("Dago Creative Hub - Jimbaran");

    expect(signatories).toHaveLength(3);
    expect(signatories[0].role).toBe("Staf Administrasi Properti");
    expect(signatories[1].role).toBe("Supervisor Komersial & Tenant");
    expect(signatories[2].role).toBe("Direktur Komersial & Bisnis");
    expect(signatories[0].outlet).toContain("Jimbaran");
  });

  it("formats commercial report print date properly in Indonesian convention", () => {
    const date = new Date("2026-11-15T08:30:00Z");
    const formatted = formatCommercialReportPrintDate(date);

    expect(formatted).toContain("15 November 2026");
  });

  it("translates lease statuses into standard Indonesian labels and semantic tones", () => {
    expect(formatCommercialLeaseStatusLabel("ACTIVE")).toBe("Aktif");
    expect(formatCommercialLeaseStatusTone("ACTIVE")).toBe("success");

    expect(formatCommercialLeaseStatusLabel("EXPIRING_SOON")).toBe("Segera berakhir");
    expect(formatCommercialLeaseStatusTone("EXPIRING_SOON")).toBe("warning");

    expect(formatCommercialLeaseStatusLabel("TERMINATED")).toBe("Selesai");
    expect(formatCommercialLeaseStatusTone("TERMINATED")).toBe("neutral");
  });
});
