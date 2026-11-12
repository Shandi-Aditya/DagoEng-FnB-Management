import { describe, expect, it } from "vitest";
import {
  calculateCommercialKPIs,
  filterLeases,
  getLeaseStatusTone,
  getLeaseStatusLabel,
  paymentScheduleLabel,
  emptyCommercialMessage,
  buildCommercialExportData,
} from "@/features/commercial/commercial-domain";
import type { CommercialLease } from "@/types/commercial";

const mockLeases: CommercialLease[] = [
  {
    id: "lse-1",
    leaseNumber: "LSE-DAGO-2026-001",
    outletId: "outlet-1",
    outletName: "Singaraja Hub",
    tenantName: "Kopi Kenangan",
    tenantContact: "0812345678",
    tenantEmail: "tenant@brand.com",
    unitCode: "Lot A-01",
    areaSquareMeters: 45,
    monthlyRent: 8000000,
    totalContractValue: 96000000,
    depositAmount: 16000000,
    startDate: "01 Jan 2026",
    endDate: "31 Des 2026",
    paymentSchedule: "MONTHLY",
    status: "ACTIVE",
    paymentHistory: [],
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  {
    id: "lse-2",
    leaseNumber: "LSE-DAGO-2026-002",
    outletId: "outlet-1",
    outletName: "Singaraja Hub",
    tenantName: "Artisan Bakery",
    tenantContact: "0823456789",
    tenantEmail: "bakery@brand.com",
    unitCode: "Lot A-02",
    areaSquareMeters: 30,
    monthlyRent: 5000000,
    totalContractValue: 60000000,
    depositAmount: 10000000,
    startDate: "01 Okt 2025",
    endDate: "30 Sep 2026",
    paymentSchedule: "MONTHLY",
    status: "EXPIRING_SOON",
    paymentHistory: [],
    createdAt: "2025-10-01",
    updatedAt: "2025-10-01",
  },
  {
    id: "lse-3",
    leaseNumber: "LSE-DAGO-2026-003",
    outletId: "outlet-1",
    outletName: "Singaraja Hub",
    tenantName: "Old Shop",
    tenantContact: "0834567890",
    tenantEmail: "",
    unitCode: "Lot B-01",
    areaSquareMeters: 25,
    monthlyRent: 4000000,
    totalContractValue: 48000000,
    depositAmount: 8000000,
    startDate: "01 Jan 2025",
    endDate: "31 Des 2025",
    paymentSchedule: "MONTHLY",
    status: "EXPIRED",
    paymentHistory: [],
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  },
];

describe("commercial-domain", () => {
  it("calculates commercial KPIs correctly for active leases", () => {
    const kpis = calculateCommercialKPIs(mockLeases);
    expect(kpis.activeUnitsCount).toBe(1);
    expect(kpis.totalMonthlyBilling).toBe(8000000);
    expect(kpis.totalSecurityDeposit).toBe(16000000);
  });

  it("filters leases by search query and status filter", () => {
    expect(filterLeases(mockLeases, "ALL", "")).toHaveLength(3);
    expect(filterLeases(mockLeases, "ACTIVE", "")).toHaveLength(1);
    expect(filterLeases(mockLeases, "ALL", "kenangan")).toHaveLength(1);
    expect(filterLeases(mockLeases, "ALL", "Lot A-02")).toHaveLength(1);
    expect(filterLeases(mockLeases, "ALL", "2026-003")).toHaveLength(1);
    expect(filterLeases(mockLeases, "EXPIRED", "kenangan")).toHaveLength(0);
  });

  it("maps lease status to status tone and label", () => {
    expect(getLeaseStatusTone("ACTIVE")).toBe("success");
    expect(getLeaseStatusTone("EXPIRING_SOON")).toBe("warning");
    expect(getLeaseStatusTone("TERMINATED")).toBe("destructive");
    expect(getLeaseStatusTone("EXPIRED")).toBe("neutral");

    expect(getLeaseStatusLabel("ACTIVE")).toBe("Aktif");
    expect(getLeaseStatusLabel("EXPIRING_SOON")).toBe("Segera berakhir");
    expect(getLeaseStatusLabel("TERMINATED")).toBe("Diakhiri");
    expect(getLeaseStatusLabel("EXPIRED")).toBe("Berakhir");
  });

  it("builds export dataset for commercial leases", () => {
    const exportData = buildCommercialExportData(mockLeases);
    expect(exportData.headers).toHaveLength(13);
    expect(exportData.rows).toHaveLength(3);
    expect(exportData.rows[0][1]).toBe("Kopi Kenangan");
    expect(exportData.rows[0][4]).toBe("Lot A-01");
  });

  it("converts raw payment schedule enums to Indonesian labels", () => {
    expect(paymentScheduleLabel("MONTHLY")).toBe("Bulanan");
    expect(paymentScheduleLabel("QUARTERLY")).toBe("Triwulan");
    expect(paymentScheduleLabel("ANNUALLY")).toBe("Tahunan");
  });

  it("provides distinct empty-state copy for commercial leases", () => {
    const emptyDb = emptyCommercialMessage(false);
    expect(emptyDb.title).toBe("Belum ada kontrak sewa");

    const filtered = emptyCommercialMessage(true);
    expect(filtered.title).toBe("Tidak ada kontrak yang cocok");
    expect(filtered.description).toContain("Ubah kata kunci");
  });
});

