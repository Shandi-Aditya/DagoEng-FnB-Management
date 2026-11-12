import { describe, expect, it } from "vitest";
import {
  calculateCustomerKPIs,
  calculateTierFromPoints,
  filterMembers,
  getTierHint,
  getTierTone,
  buildCustomerExportData,
  emptyCustomerMessage,
} from "@/features/customers/customers-domain";
import type { LoyaltyMember } from "@/types/loyalty";

const mockMembers: LoyaltyMember[] = [
  {
    id: "M-001",
    name: "Gusti Bagus",
    phone: "081234567890",
    email: "gusti@example.com",
    identityNo: "5108011234560001",
    tier: "Platinum",
    points: 3500,
    totalSpend: 3500000,
    totalVisits: 18,
    favoriteItem: "Cold Brew",
    registeredOutletId: "outlet-1",
    registeredOutletName: "Singaraja Hub",
    status: "ACTIVE",
    joinedDate: "2024-01-15",
    lastVisit: "2024-03-01",
    pointHistory: [],
    tierHistory: [],
  },
  {
    id: "M-002",
    name: "Ayu Putu",
    phone: "082345678901",
    email: "ayu@example.com",
    identityNo: "5108011234560002",
    tier: "Gold",
    points: 1800,
    totalSpend: 1800000,
    totalVisits: 9,
    favoriteItem: "Matcha Latte",
    registeredOutletId: "outlet-1",
    registeredOutletName: "Singaraja Hub",
    status: "ACTIVE",
    joinedDate: "2024-02-10",
    lastVisit: "2024-03-02",
    pointHistory: [],
    tierHistory: [],
  },
  {
    id: "M-003",
    name: "Ketut Wijaya",
    phone: "083456789012",
    email: undefined,
    identityNo: undefined,
    tier: "Silver",
    points: 800,
    totalSpend: 800000,
    totalVisits: 4,
    favoriteItem: "Croissant",
    registeredOutletId: "outlet-1",
    registeredOutletName: "Singaraja Hub",
    status: "ACTIVE",
    joinedDate: "2024-02-20",
    lastVisit: "2024-02-28",
    pointHistory: [],
    tierHistory: [],
  },
  {
    id: "M-004",
    name: "Made Dharma",
    phone: "084567890123",
    email: "made@example.com",
    identityNo: undefined,
    tier: "Bronze",
    points: 150,
    totalSpend: 150000,
    totalVisits: 1,
    favoriteItem: "Americano",
    registeredOutletId: "outlet-1",
    registeredOutletName: "Singaraja Hub",
    status: "ACTIVE",
    joinedDate: "2024-03-01",
    lastVisit: "2024-03-01",
    pointHistory: [],
    tierHistory: [],
  },
];

describe("customers-domain", () => {
  it("calculates loyalty tier based on points threshold", () => {
    expect(calculateTierFromPoints(0)).toBe("Bronze");
    expect(calculateTierFromPoints(499)).toBe("Bronze");
    expect(calculateTierFromPoints(500)).toBe("Silver");
    expect(calculateTierFromPoints(1499)).toBe("Silver");
    expect(calculateTierFromPoints(1500)).toBe("Gold");
    expect(calculateTierFromPoints(2999)).toBe("Gold");
    expect(calculateTierFromPoints(3000)).toBe("Platinum");
    expect(calculateTierFromPoints(5000)).toBe("Platinum");
  });

  it("returns human friendly tier hint string", () => {
    expect(getTierHint(0)).toContain("Bronze");
    expect(getTierHint(600)).toContain("Silver");
    expect(getTierHint(1600)).toContain("Gold");
    expect(getTierHint(3200)).toContain("Platinum");
  });

  it("maps tier to appropriate status tone", () => {
    expect(getTierTone("Platinum")).toBe("info");
    expect(getTierTone("Gold")).toBe("warning");
    expect(getTierTone("Silver")).toBe("neutral");
    expect(getTierTone("Bronze")).toBe("neutral");
  });

  it("aggregates customer KPI metrics", () => {
    const kpis = calculateCustomerKPIs(mockMembers);
    expect(kpis.totalMembers).toBe(4);
    expect(kpis.platinumGoldCount).toBe(2);
    expect(kpis.silverCount).toBe(1);
    expect(kpis.bronzeCount).toBe(1);
  });

  it("filters members by name, phone, email, or tier", () => {
    expect(filterMembers(mockMembers, "")).toHaveLength(4);
    expect(filterMembers(mockMembers, "gusti")).toHaveLength(1);
    expect(filterMembers(mockMembers, "083456")).toHaveLength(1);
    expect(filterMembers(mockMembers, "ayu@example.com")).toHaveLength(1);
    expect(filterMembers(mockMembers, "silver")).toHaveLength(1);
    expect(filterMembers(mockMembers, "", "Platinum")).toHaveLength(1);
    expect(filterMembers(mockMembers, "", "Gold")).toHaveLength(1);
    expect(filterMembers(mockMembers, "nonexistent")).toHaveLength(0);
  });

  it("generates CSV/Excel export structure", () => {
    const exportData = buildCustomerExportData(mockMembers);
    expect(exportData.headers).toHaveLength(11);
    expect(exportData.rows).toHaveLength(4);
    expect(exportData.rows[0][1]).toBe("Gusti Bagus");
    expect(exportData.rows[0][5]).toBe("Platinum");
  });

  it("provides distinct empty-state copy for filtered vs empty customer database", () => {
    const emptyDb = emptyCustomerMessage(false);
    expect(emptyDb.title).toBe("Belum ada member");

    const filtered = emptyCustomerMessage(true);
    expect(filtered.title).toBe("Tidak ada member yang cocok");
    expect(filtered.description).toContain("Ubah kata kunci");

    const searched = emptyCustomerMessage(true, "budi");
    expect(searched.title).toBe("Tidak ada member yang cocok");
    expect(searched.description).toContain("budi");
  });
});

