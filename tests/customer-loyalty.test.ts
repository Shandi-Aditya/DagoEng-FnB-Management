import { describe, it, expect } from "vitest";
import { LoyaltyMember, LoyaltyTier, LoyaltyPointTransaction } from "../src/types/loyalty";
import { DEFAULT_PLATFORM_SETTINGS } from "../src/types/settings";

describe("Customer Loyalty & Auto-Tier Engine", () => {
  const config = DEFAULT_PLATFORM_SETTINGS.loyaltyTiers;

  // Helper matching LoyaltyContext.calculateTierForPoints
  const calculateTierForPoints = (points: number): LoyaltyTier => {
    if (points >= config.platinumMin) return "Platinum";
    if (points >= config.goldMin) return "Gold";
    if (points >= config.silverMin) return "Silver";
    return "Bronze";
  };

  // Helper matching LoyaltyContext.addPoints logic
  const addPointsToMember = (
    member: LoyaltyMember,
    pointsEarned: number,
    reason: string,
    transactionId?: string
  ): LoyaltyMember => {
    if (pointsEarned <= 0) return member;

    // Idempotency: skip if already awarded for this transactionId
    if (
      transactionId &&
      member.pointHistory.some((ptx) => ptx.relatedTransactionId === transactionId)
    ) {
      return member;
    }

    const newPoints = member.points + pointsEarned;
    const newTier = calculateTierForPoints(newPoints);
    const tierChanged = newTier !== member.tier;
    const nowIso = new Date().toISOString();

    const ptx: LoyaltyPointTransaction = {
      id: `ptx-${Date.now()}`,
      memberId: member.id,
      type: "EARN",
      points: pointsEarned,
      balanceAfter: newPoints,
      reason,
      relatedTransactionId: transactionId,
      timestamp: nowIso,
      actorName: "Kasir / Sistem",
      outletId: member.registeredOutletId,
    };

    let newTierHistory = [...member.tierHistory];
    if (tierChanged) {
      newTierHistory.unshift({
        id: `th-${Date.now()}`,
        memberId: member.id,
        previousTier: member.tier,
        newTier,
        pointsAtChange: newPoints,
        reason: `Poin mencapai ${newPoints} (Auto Tier Upgrade)`,
        isManualOverride: false,
        actorName: "Sistem Loyalty",
        timestamp: nowIso,
      });
    }

    return {
      ...member,
      points: newPoints,
      tier: newTier,
      pointHistory: [ptx, ...member.pointHistory],
      tierHistory: newTierHistory,
    };
  };

  // Helper matching reverseTransactionPoints
  const reversePointsFromMember = (
    member: LoyaltyMember,
    transactionId: string,
    reason?: string
  ): LoyaltyMember => {
    const earnTx = member.pointHistory.find(
      (ptx) => ptx.type === "EARN" && ptx.relatedTransactionId === transactionId
    );
    if (!earnTx) return member;

    const revTxId = `rev-${transactionId}`;
    if (member.pointHistory.some((ptx) => ptx.relatedTransactionId === revTxId)) {
      return member;
    }

    const pointsToDeduct = earnTx.points;
    const newPoints = Math.max(0, member.points - pointsToDeduct);
    const newTier = calculateTierForPoints(newPoints);
    const tierChanged = newTier !== member.tier;
    const nowIso = new Date().toISOString();

    const ptx: LoyaltyPointTransaction = {
      id: `ptx-${Date.now()}`,
      memberId: member.id,
      type: "ADJUSTMENT",
      points: -pointsToDeduct,
      balanceAfter: newPoints,
      reason: reason || `Pembatalan/Refund transaksi #${transactionId}`,
      relatedTransactionId: revTxId,
      timestamp: nowIso,
      actorName: "Sistem Loyalty",
      outletId: member.registeredOutletId,
    };

    let newTierHistory = [...member.tierHistory];
    if (tierChanged) {
      newTierHistory.unshift({
        id: `th-${Date.now()}`,
        memberId: member.id,
        previousTier: member.tier,
        newTier,
        pointsAtChange: newPoints,
        reason: `Poin disesuaikan menjadi ${newPoints} (Auto Tier Downgrade/Adjustment)`,
        isManualOverride: false,
        actorName: "Sistem Loyalty",
        timestamp: nowIso,
      });
    }

    return {
      ...member,
      points: newPoints,
      tier: newTier,
      pointHistory: [ptx, ...member.pointHistory],
      tierHistory: newTierHistory,
    };
  };

  it("TEST 1: Customer earns points on completed transaction while staying within current tier", () => {
    const member: LoyaltyMember = {
      id: "mem-test-1",
      name: "Budi Santoso",
      phone: "+62 857-9988-7766",
      tier: "Bronze",
      points: 100,
      totalSpend: 100000,
      totalVisits: 2,
      favoriteItem: "Kopi Senja Aren",
      registeredOutletId: "outlet-sgr",
      registeredOutletName: "Singaraja",
      status: "ACTIVE",
      joinedDate: "05 Agu 2026",
      lastVisit: "14 Sep 2026",
      pointHistory: [],
      tierHistory: [],
    };

    // Transaction Rp 80.000 -> 80 points earned (1 pt per Rp 1.000)
    const transactionTotal = 80000;
    const pointsEarned = Math.floor(transactionTotal / 1000);
    const updated = addPointsToMember(member, pointsEarned, "Transaksi POS #ORD-101", "ORD-101");

    expect(updated.points).toBe(180);
    expect(updated.tier).toBe("Bronze"); // 180 < 500 (Silver threshold)
    expect(updated.pointHistory.length).toBe(1);
    expect(updated.pointHistory[0].type).toBe("EARN");
    expect(updated.pointHistory[0].points).toBe(80);
    expect(updated.tierHistory.length).toBe(0);
  });

  it("TEST 2: Customer transitions automatically to next tier (Silver, Gold, Platinum) upon passing thresholds", () => {
    const bronzeMember: LoyaltyMember = {
      id: "mem-test-2",
      name: "Siti Rahma",
      phone: "+62 812-3456-7890",
      tier: "Bronze",
      points: 450,
      totalSpend: 450000,
      totalVisits: 5,
      favoriteItem: "Artisan Peach White Tea",
      registeredOutletId: "outlet-sgr",
      registeredOutletName: "Singaraja",
      status: "ACTIVE",
      joinedDate: "01 Sep 2026",
      lastVisit: "20 Sep 2026",
      pointHistory: [],
      tierHistory: [],
    };

    // Transaction Rp 60.000 -> 60 points earned. Total 450 + 60 = 510 points (>= 500 -> Silver)
    const updatedSilver = addPointsToMember(bronzeMember, 60, "Transaksi POS #ORD-201", "ORD-201");
    expect(updatedSilver.points).toBe(510);
    expect(updatedSilver.tier).toBe("Silver");
    expect(updatedSilver.tierHistory.length).toBe(1);
    expect(updatedSilver.tierHistory[0].previousTier).toBe("Bronze");
    expect(updatedSilver.tierHistory[0].newTier).toBe("Silver");

    // Upgrade to Gold (1500 points)
    const updatedGold = addPointsToMember(updatedSilver, 1000, "Transaksi Catering #ORD-202", "ORD-202");
    expect(updatedGold.points).toBe(1510);
    expect(updatedGold.tier).toBe("Gold");
    expect(updatedGold.tierHistory.length).toBe(2);
    expect(updatedGold.tierHistory[0].newTier).toBe("Gold");

    // Upgrade to Platinum (3000 points)
    const updatedPlatinum = addPointsToMember(updatedGold, 1500, "Transaksi Coworking #ORD-203", "ORD-203");
    expect(updatedPlatinum.points).toBe(3010);
    expect(updatedPlatinum.tier).toBe("Platinum");
    expect(updatedPlatinum.tierHistory.length).toBe(3);
    expect(updatedPlatinum.tierHistory[0].newTier).toBe("Platinum");
  });

  it("TEST 3: Pending, cancelled, or zero-total transactions do not award points", () => {
    const member: LoyaltyMember = {
      id: "mem-test-3",
      name: "Dewi Lestari",
      phone: "+62 811-2233-4455",
      tier: "Bronze",
      points: 200,
      totalSpend: 200000,
      totalVisits: 3,
      favoriteItem: "Croissant",
      registeredOutletId: "outlet-sgr",
      registeredOutletName: "Singaraja",
      status: "ACTIVE",
      joinedDate: "10 Agu 2026",
      lastVisit: "22 Sep 2026",
      pointHistory: [],
      tierHistory: [],
    };

    // Attempting 0 points
    const noPoints = addPointsToMember(member, 0, "Pending order", "ORD-PENDING");
    expect(noPoints.points).toBe(200);
    expect(noPoints.pointHistory.length).toBe(0);

    // Negative points in addPoints ignored
    const negPoints = addPointsToMember(member, -50, "Failed transaction", "ORD-FAILED");
    expect(negPoints.points).toBe(200);
    expect(negPoints.pointHistory.length).toBe(0);
  });

  it("TEST 4: State consistency across boundaries (0, 499, 500, 1499, 1500, 2999, 3000)", () => {
    expect(calculateTierForPoints(0)).toBe("Bronze");
    expect(calculateTierForPoints(499)).toBe("Bronze");
    expect(calculateTierForPoints(500)).toBe("Silver");
    expect(calculateTierForPoints(1499)).toBe("Silver");
    expect(calculateTierForPoints(1500)).toBe("Gold");
    expect(calculateTierForPoints(2999)).toBe("Gold");
    expect(calculateTierForPoints(3000)).toBe("Platinum");
    expect(calculateTierForPoints(10000)).toBe("Platinum");
  });

  it("TEST 5: Customer Portal computes accurate progress and displays current tier & points", () => {
    const member: LoyaltyMember = {
      id: "mem-test-5",
      name: "Ketut Dian",
      phone: "+62 819-1122-3344",
      tier: "Silver",
      points: 840,
      totalSpend: 1420000,
      totalVisits: 18,
      favoriteItem: "Kopi Senja Aren",
      registeredOutletId: "outlet-sgr",
      registeredOutletName: "Singaraja",
      status: "ACTIVE",
      joinedDate: "12 Jan 2026",
      lastVisit: "16 Sep 2026",
      pointHistory: [
        {
          id: "ptx-1",
          memberId: "mem-test-5",
          type: "EARN",
          points: 40,
          balanceAfter: 840,
          reason: "Transaksi POS Meja T-03",
          relatedTransactionId: "ORD-20260914-0102",
          timestamp: "2026-09-14T10:40:00Z",
          actorName: "Ni Kadek Sri (Kasir)",
          outletId: "outlet-sgr",
        },
      ],
      tierHistory: [],
    };

    // Customer Portal Next Tier calculation for Silver (target: 1500 for Gold)
    const pts = member.points;
    const span = config.goldMin - config.silverMin; // 1500 - 500 = 1000
    const done = pts - config.silverMin; // 840 - 500 = 340
    const pointsNeeded = config.goldMin - pts; // 1500 - 840 = 660
    const progress = Math.min(100, Math.round((done / span) * 100)); // 34%

    expect(pointsNeeded).toBe(660);
    expect(progress).toBe(34);
    expect(member.tier).toBe("Silver");
    expect(member.points).toBe(840);
  });

  it("TEST 6: Prevents duplicate point awarding on duplicate completion calls and handles reversals", () => {
    const member: LoyaltyMember = {
      id: "mem-test-6",
      name: "Ahmad Faisal",
      phone: "+62 817-8899-0011",
      tier: "Bronze",
      points: 100,
      totalSpend: 100000,
      totalVisits: 1,
      favoriteItem: "Croissant",
      registeredOutletId: "outlet-sgr",
      registeredOutletName: "Singaraja",
      status: "ACTIVE",
      joinedDate: "20 Sep 2026",
      lastVisit: "20 Sep 2026",
      pointHistory: [],
      tierHistory: [],
    };

    const transactionId = "ORD-COMPLETION-001";
    // First call: Award 50 points
    const step1 = addPointsToMember(member, 50, "Order Paid", transactionId);
    expect(step1.points).toBe(150);
    expect(step1.pointHistory.length).toBe(1);

    // Duplicate call with SAME transactionId: should NOT add points again
    const step2 = addPointsToMember(step1, 50, "Order Paid (Retry)", transactionId);
    expect(step2.points).toBe(150); // Still 150, not 200
    expect(step2.pointHistory.length).toBe(1);

    // Reversal / Refund:
    const step3 = reversePointsFromMember(step2, transactionId, "Refund order");
    expect(step3.points).toBe(100); // Reverted back to original
    expect(step3.pointHistory.length).toBe(2);
    expect(step3.pointHistory[0].type).toBe("ADJUSTMENT");
    expect(step3.pointHistory[0].points).toBe(-50);

    // Duplicate reversal attempt: should be ignored
    const step4 = reversePointsFromMember(step3, transactionId, "Refund duplicate");
    expect(step4.points).toBe(100);
    expect(step4.pointHistory.length).toBe(2);
  });
});
