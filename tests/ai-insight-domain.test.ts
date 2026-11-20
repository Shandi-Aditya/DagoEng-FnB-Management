import { describe, it, expect } from "vitest";
import {
  createWelcomeMessage,
  generateAIInsightResponse,
  QUICK_PROMPTS,
} from "@/features/ai-insight/ai-insight-domain";
import { IngredientItem } from "@/types/inventory";

describe("ai-insight-domain", () => {
  const criticalItems: IngredientItem[] = [
    {
      id: "ing-1",
      name: "Biji Kopi",
      category: "Bahan",
      stockNumber: 2,
      min: 5,
      unit: "kg",
      costPerUnit: 100000,
      reorderAmount: 10,
      supplier: "Supplier A",
      sku: "BK-01",
      status: "CRITICAL",
      lastUpdated: "2026-11-10",
    },
  ];

  const baseParams = {
    outletName: "Outlet Singaraja",
    totalRevenue: 5000000,
    ordersCount: 100,
    materialsCount: 20,
    criticalItems,
    topProductName: "Kopi Senja Signature",
    areasCount: 3,
    bookingsCount: 5,
    leasesCount: 2,
    membersCount: 45,
    productsCount: 15,
  };

  it("creates welcome message with proper metrics", () => {
    const welcome = createWelcomeMessage({
      userName: "Shandi",
      outletName: "Outlet Singaraja",
      totalRevenue: 5000000,
      ordersCount: 100,
      criticalItemsCount: 1,
    });

    expect(welcome.sender).toBe("AI");
    expect(welcome.aiAnalysis).toContain("Halo Shandi");
    expect(welcome.systemData?.[0]).toContain("Outlet Singaraja");
    expect(welcome.actionUrl).toBe("/reports");
  });

  it("generates inventory response for stock queries", () => {
    const res = generateAIInsightResponse({
      ...baseParams,
      query: "Bagaimana kondisi stok bahan baku kritis?",
    });

    expect(res.sender).toBe("AI");
    expect(res.systemData?.[1]).toContain("1 bahan");
    expect(res.actionUrl).toBe("/inventory");
    expect(res.actionLabel).toBe("Buka inventori");
  });

  it("generates sales response for revenue queries", () => {
    const res = generateAIInsightResponse({
      ...baseParams,
      query: "Berapa total omset dan laba penjualan hari ini?",
    });

    expect(res.sender).toBe("AI");
    expect(res.systemData?.[0]).toContain("Rp 5.000.000");
    expect(res.systemData?.[2]).toContain("Rp 50.000"); // AOV: 5000000 / 100
    expect(res.actionUrl).toBe("/menu");
  });

  it("generates space response for coworking and table queries", () => {
    const res = generateAIInsightResponse({
      ...baseParams,
      query: "Cek okupansi meja dan booking coworking",
    });

    expect(res.sender).toBe("AI");
    expect(res.systemData?.[0]).toContain("Area meja: 3");
    expect(res.actionUrl).toBe("/coworking");
  });

  it("generates default loyalty response for other queries", () => {
    const res = generateAIInsightResponse({
      ...baseParams,
      query: "Apa strategi bisnis umum untuk gerai?",
    });

    expect(res.sender).toBe("AI");
    expect(res.systemData?.[1]).toContain("Member terdaftar: 45");
    expect(res.actionUrl).toBe("/customers");
  });

  it("provides quick prompt list adhering to glossary", () => {
    expect(QUICK_PROMPTS.length).toBeGreaterThan(0);
    expect(QUICK_PROMPTS.some((p) => p.includes("omzet"))).toBe(true);
    expect(QUICK_PROMPTS.some((p) => p.includes("omset"))).toBe(false);
  });

  it("handles zero critical items gracefully with calm feedback", () => {
    const res = generateAIInsightResponse({
      ...baseParams,
      criticalItems: [],
      query: "Cek stok bahan saat ini",
    });

    expect(res.sender).toBe("AI");
    expect(res.systemData?.[1]).toContain("0 bahan");
    expect(res.aiAnalysis).toContain("Semua bahan di Outlet Singaraja masih di atas batas minimum.");
    expect(res.actionLabel).toBe("Buka inventori");
  });

  it("formats fallback outlet name consistently", () => {
    const welcome = createWelcomeMessage({
      userName: "Budi",
      outletName: "",
      totalRevenue: 0,
      ordersCount: 0,
      criticalItemsCount: 0,
    });

    expect(welcome.systemData?.[0]).toContain("Semua outlet");
  });
});
