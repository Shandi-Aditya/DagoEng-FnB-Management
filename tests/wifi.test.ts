import { describe, it, expect } from "vitest";
import {
  matchFnBWifiRule,
  generateSimulatedFnBVoucher,
  DEFAULT_FNB_WIFI_RULES,
  DEFAULT_COWORKING_WIFI_RULES,
} from "@/lib/wifi";

describe("Wi-Fi Management Business Rules & Calculation", () => {
  it("should have correct default F&B tiered rules according to management guidelines", () => {
    expect(DEFAULT_FNB_WIFI_RULES.length).toBe(3);

    // Rule 1: < 100.000 (25.000 - 99.999) -> 60 minutes
    const rule1 = DEFAULT_FNB_WIFI_RULES[0];
    expect(rule1.minTransactionAmount).toBe(25000);
    expect(rule1.maxTransactionAmount).toBe(99999);
    expect(rule1.durationMinutes).toBe(60);

    // Rule 2: 100.000 - 249.999 -> 120 minutes (2 Jam)
    const rule2 = DEFAULT_FNB_WIFI_RULES[1];
    expect(rule2.minTransactionAmount).toBe(100000);
    expect(rule2.maxTransactionAmount).toBe(249999);
    expect(rule2.durationMinutes).toBe(120);

    // Rule 3: >= 250.000 -> 180 minutes (3 Jam)
    const rule3 = DEFAULT_FNB_WIFI_RULES[2];
    expect(rule3.minTransactionAmount).toBe(250000);
    expect(rule3.maxTransactionAmount).toBeUndefined();
    expect(rule3.durationMinutes).toBe(180);
  });

  it("should return null for transactions below minimum threshold (e.g. Rp 10.000)", () => {
    const matched = matchFnBWifiRule(10000);
    expect(matched).toBeNull();
  });

  it("should match 1-hour voucher for transaction of Rp 45.000", () => {
    const matched = matchFnBWifiRule(45000);
    expect(matched).toBeDefined();
    expect(matched?.durationMinutes).toBe(60);
    expect(matched?.label).toContain("1 Jam");
  });

  it("should match 2-hour voucher for transaction of Rp 125.000", () => {
    const matched = matchFnBWifiRule(125000);
    expect(matched).toBeDefined();
    expect(matched?.durationMinutes).toBe(120);
    expect(matched?.label).toContain("2 Jam");
  });

  it("should match 3-hour voucher for large transaction of Rp 350.000", () => {
    const matched = matchFnBWifiRule(350000);
    expect(matched).toBeDefined();
    expect(matched?.durationMinutes).toBe(180);
    expect(matched?.label).toContain("3 Jam");
  });

  it("should generate simulated voucher record correctly when eligible", () => {
    const voucher = generateSimulatedFnBVoucher("ORD-2026-999", "Budi Santoso", 125000, "Dago Hub Singaraja", "Kopi Senja");
    expect(voucher).not.toBeNull();
    expect(voucher?.serviceType).toBe("FNB");
    expect(voucher?.voucherCode).toMatch(/^DG-FNB-\d{4}$/);
    expect(voucher?.referenceId).toBe("ORD-2026-999");
    expect(voucher?.durationMinutes).toBe(120);
    expect(voucher?.status).toBe("ACTIVE");
    expect(voucher?.isSimulated).toBe(true);
  });

  it("should define separate rules for Co-working spaces", () => {
    expect(DEFAULT_COWORKING_WIFI_RULES.length).toBeGreaterThanOrEqual(4);
    const meetingRule = DEFAULT_COWORKING_WIFI_RULES.find((r) => r.spaceType === "MEETING_ROOM");
    expect(meetingRule).toBeDefined();
    expect(meetingRule?.maxConcurrentDevices).toBe(10);
    expect(meetingRule?.durationMode).toBe("FOLLOW_BOOKING");
  });

  it("should detect overlapping rules correctly", async () => {
    const validRules = [
      {
        id: "r1",
        minTransactionAmount: 25000,
        maxTransactionAmount: 99999,
        durationMinutes: 60,
        label: "Tier 1",
        isActive: true,
      },
      {
        id: "r2",
        minTransactionAmount: 100000,
        maxTransactionAmount: 200000,
        durationMinutes: 120,
        label: "Tier 2",
        isActive: true,
      },
    ];
    const { validateFnBRulesOverlap } = await import("@/lib/wifi");
    expect(validateFnBRulesOverlap(validRules).hasOverlap).toBe(false);

    const overlappingRules = [
      {
        id: "r1",
        minTransactionAmount: 25000,
        maxTransactionAmount: 120000,
        durationMinutes: 60,
        label: "Tier 1 Overlap",
        isActive: true,
      },
      {
        id: "r2",
        minTransactionAmount: 100000,
        maxTransactionAmount: 200000,
        durationMinutes: 120,
        label: "Tier 2 Overlap",
        isActive: true,
      },
    ];
    const result = validateFnBRulesOverlap(overlappingRules);
    expect(result.hasOverlap).toBe(true);
    expect(result.errorMessage).toContain("tumpang-tindih");
  });

  it("should return the exact same voucher code when reprinting receipt (idempotent / stable reference)", async () => {
    const { getOrCreateSimulatedWifiVoucher } = await import("@/lib/wifi");
    const testOrderId = `ORD-TEST-${Date.now()}`;

    // First print
    const voucher1 = getOrCreateSimulatedWifiVoucher(testOrderId, "Pelanggan A", 75000);
    expect(voucher1).not.toBeNull();
    const code1 = voucher1?.voucherCode;

    // Second print (reprint)
    const voucher2 = getOrCreateSimulatedWifiVoucher(testOrderId, "Pelanggan A", 75000);
    expect(voucher2).not.toBeNull();
    expect(voucher2?.voucherCode).toBe(code1);
    expect(voucher2?.id).toBe(voucher1?.id);
  });

  it("should generate coworking voucher with grace period and device limit on valid check-in", async () => {
    const { getOrCreateSimulatedCoworkingVoucher } = await import("@/lib/wifi");
    const bookingCode = `BKG-TEST-${Date.now()}`;

    const cwVoucher = getOrCreateSimulatedCoworkingVoucher(bookingCode, "Tamu Co-working", "HOT_DESK", "HOURLY", 2);
    expect(cwVoucher).not.toBeNull();
    expect(cwVoucher?.serviceType).toBe("COWORKING");
    expect(cwVoucher?.durationMinutes).toBe(135); // 2 hours (120) + 15 min grace
    expect(cwVoucher?.maxDevices).toBe(1);
    expect(cwVoucher?.status).toBe("ACTIVE");
  });

  it("should isolate tenant vouchers so tenant owner can filter only their own vouchers", async () => {
    const { getSimulatedWifiVouchers } = await import("@/lib/wifi");
    const allVouchers = getSimulatedWifiVouchers();

    // Filter by tenant-ks
    const tenantKsVouchers = allVouchers.filter((v) => v.serviceType === "FNB" && v.tenantId === "tenant-ks");
    expect(tenantKsVouchers.length).toBeGreaterThan(0);
    tenantKsVouchers.forEach((v) => {
      expect(v.tenantId).toBe("tenant-ks");
    });

    // Ensure tenant-dm vouchers are not included in tenant-ks filter
    const hasOtherTenant = tenantKsVouchers.some((v) => v.tenantId === "tenant-dm");
    expect(hasOtherTenant).toBe(false);
  });

  it("should accurately handle boundary values below, equal, and above thresholds", () => {
    // Threshold 1: 25.000
    expect(matchFnBWifiRule(24999)).toBeNull();
    expect(matchFnBWifiRule(25000)?.durationMinutes).toBe(60);
    expect(matchFnBWifiRule(25001)?.durationMinutes).toBe(60);

    // Threshold 2: 100.000
    expect(matchFnBWifiRule(99999)?.durationMinutes).toBe(60);
    expect(matchFnBWifiRule(100000)?.durationMinutes).toBe(120);
    expect(matchFnBWifiRule(100001)?.durationMinutes).toBe(120);

    // Threshold 3: 250.000
    expect(matchFnBWifiRule(249999)?.durationMinutes).toBe(120);
    expect(matchFnBWifiRule(250000)?.durationMinutes).toBe(180);
    expect(matchFnBWifiRule(250001)?.durationMinutes).toBe(180);
  });

  it("should switch and persist calculation basis between GRAND_TOTAL and NET_SALES", async () => {
    const { getSimulatedWifiCalcBasis, setSimulatedWifiCalcBasis } = await import("@/lib/wifi");

    setSimulatedWifiCalcBasis("NET_SALES");
    expect(getSimulatedWifiCalcBasis()).toBe("NET_SALES");

    setSimulatedWifiCalcBasis("GRAND_TOTAL");
    expect(getSimulatedWifiCalcBasis()).toBe("GRAND_TOTAL");
  });

  it("should not issue or activate voucher for cancelled coworking bookings", async () => {
    const { getOrCreateSimulatedCoworkingVoucher } = await import("@/lib/wifi");
    const cancelledBookingCode = `BKG-CANC-${Date.now()}`;

    const voucher = getOrCreateSimulatedCoworkingVoucher(
      cancelledBookingCode,
      "Tamu Batal",
      "HOT_DESK",
      "HOURLY",
      2,
      "Dago Hub Singaraja",
      "CANCELLED"
    );
    expect(voucher).toBeNull();
  });

  it("should properly revoke voucher when order is voided", async () => {
    const { getOrCreateSimulatedWifiVoucher, revokeSimulatedWifiVoucher, getSimulatedWifiVouchers } = await import("@/lib/wifi");
    const orderId = `ORD-REVOKE-${Date.now()}`;

    const voucher = getOrCreateSimulatedWifiVoucher(orderId, "Pelanggan Void", 85000);
    expect(voucher).not.toBeNull();
    expect(voucher?.status).toBe("ACTIVE");

    revokeSimulatedWifiVoucher(orderId);
    const updatedList = getSimulatedWifiVouchers();
    const found = updatedList.find((v) => v.referenceId === orderId);
    expect(found).toBeDefined();
    expect(found?.status).toBe("CANCELLED");
  });
});
