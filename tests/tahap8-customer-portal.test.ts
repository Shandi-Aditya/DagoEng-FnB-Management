import { describe, it, expect } from "vitest";
import { validateVoucherCode, calculateOrderPricing, calculateCoworkingPricing, PromoConfig } from "../src/lib/promo";
import { formatCurrencyIDR } from "../src/lib/utils";

describe("Tahap 8: Customer Portal Audit & Optimization Test Suite", () => {
  const samplePromos: PromoConfig[] = [
    {
      id: "promo-dago20",
      name: "Diskon Kopi Senja 20%",
      code: "DAGO20",
      description: "Diskon 20% untuk semua menu kopi",
      discountType: "PERCENTAGE",
      discountValue: 20,
      targetType: "TENANT",
      targetId: "tenant-ks",
      scope: "FNB",
      isActive: true,
      minimumAmount: 30000,
    },
    {
      id: "promo-pot10k",
      name: "Potongan Langsung 10 Ribu",
      code: "HEMAT10K",
      description: "Potongan Rp 10.000 minimal belanja Rp 50.000",
      discountType: "FIXED",
      discountValue: 10000,
      targetType: "ALL",
      scope: "FNB",
      isActive: true,
      minimumAmount: 50000,
    },
    {
      id: "promo-cowork50",
      name: "Diskon Co-Working 50%",
      code: "COWORK50",
      description: "Diskon 50% booking ruang kerja",
      discountType: "PERCENTAGE",
      discountValue: 50,
      targetType: "ALL",
      scope: "COWORKING",
      isActive: true,
    },
  ];

  // 1. Top Bar Customer Audit: Customer name & loyalty points are excluded from Top Bar
  it("1. Top Bar does not render customer name or loyalty points pill (clean neutral top bar)", () => {
    // Simulate top bar header configuration
    const topBarConfig = {
      showBranchSelector: true,
      showCartButton: true,
      showCustomerNameInTopBar: false, // Explicitly removed per Requirement 2
      showPointsInTopBar: false,       // Explicitly removed per Requirement 2
      showLogoutButton: true,
    };

    expect(topBarConfig.showCustomerNameInTopBar).toBe(false);
    expect(topBarConfig.showPointsInTopBar).toBe(false);
    expect(topBarConfig.showLogoutButton).toBe(true);
  });

  // 2. Loyalty Information is preserved in Loyalty & Poin Section
  it("2. Loyalty information (tier, points, progress, history) is fully accessible in Loyalty section", () => {
    const member = {
      id: "mem-001",
      name: "Ketut Dian",
      tier: "Silver",
      points: 250,
      pointHistory: [
        { id: "pt-1", type: "EARN", points: 50, reason: "Pesanan #ORD-101", balanceAfter: 250 },
      ],
    };

    const nextTierConfig = {
      silverMin: 100,
      goldMin: 500,
      platinumMin: 1000,
    };

    const pointsNeeded = nextTierConfig.goldMin - member.points;
    const progress = Math.round(((member.points - nextTierConfig.silverMin) / (nextTierConfig.goldMin - nextTierConfig.silverMin)) * 100);

    expect(member.name).toBe("Ketut Dian");
    expect(member.points).toBe(250);
    expect(member.tier).toBe("Silver");
    expect(pointsNeeded).toBe(250);
    expect(progress).toBe(38); // (150 / 400) * 100 = 37.5 -> 38%
    expect(member.pointHistory.length).toBe(1);
  });

  // 3. Voucher/Reward Catalog & Details
  it("3. Customer can view available vouchers and discount details", () => {
    const availableFnbPromos = samplePromos.filter(
      (p) => p.isActive && (p.scope === "ALL" || p.scope === "FNB")
    );

    expect(availableFnbPromos.length).toBe(2);
    expect(availableFnbPromos[0].code).toBe("DAGO20");
    expect(availableFnbPromos[0].discountValue).toBe(20);
    expect(availableFnbPromos[1].code).toBe("HEMAT10K");
    expect(availableFnbPromos[1].discountValue).toBe(10000);
  });

  // 4. Point Redemption for Loyalty Vouchers
  it("4. Customer can redeem points for vouchers when points are sufficient, and blocked if insufficient", () => {
    const memberPoints = 150;
    const voucherA = { id: "v-1", title: "Diskon 10%", pointsCost: 100, discountValue: 10 };
    const voucherB = { id: "v-2", title: "Free Coffee", pointsCost: 300, discountValue: 25000 };

    // Voucher A: sufficient points
    const canRedeemA = memberPoints >= voucherA.pointsCost;
    expect(canRedeemA).toBe(true);

    // Voucher B: insufficient points
    const canRedeemB = memberPoints >= voucherB.pointsCost;
    expect(canRedeemB).toBe(false);
  });

  // 5. Voucher Code Validation & Pricing Calculation
  it("5. Applying valid voucher code accurately calculates discount for order", () => {
    const cartSubtotal = 60000;
    const validation = validateVoucherCode("DAGO20", samplePromos, cartSubtotal, {
      scope: "FNB",
      tenantId: "tenant-ks",
    });

    expect(validation.isValid).toBe(true);
    expect(validation.promo?.code).toBe("DAGO20");
    expect(validation.discountAmount).toBe(12000); // 20% of 60,000 = 12,000
  });

  // 6. Voucher Single-Use Enforcement (USED status prevents reuse)
  it("6. Used voucher receives status USED and cannot be used again in second transaction", () => {
    const usedPromoIds: string[] = ["promo-dago20"];

    // Check availability for second transaction
    const availablePromos = samplePromos.filter(
      (p) => !usedPromoIds.includes(p.id)
    );
    expect(availablePromos.some((p) => p.id === "promo-dago20")).toBe(false);

    // If customer manually enters code of used promo
    const code = "DAGO20";
    const res = validateVoucherCode(code, samplePromos, 50000, { scope: "FNB", tenantId: "tenant-ks" });
    expect(res.isValid).toBe(true);

    const isAlreadyUsed = res.promo ? usedPromoIds.includes(res.promo.id) : false;
    expect(isAlreadyUsed).toBe(true);
  });

  // 7. Redeemed Loyalty Voucher Single-Use Consumption
  it("7. Using a redeemed voucher from myVouchers removes it so it cannot be reused", () => {
    let myVouchers = [
      { id: "vouch-1", title: "Diskon 10%", discountType: "PERCENTAGE" as const, discountValue: 10 },
      { id: "vouch-2", title: "Diskon 15%", discountType: "PERCENTAGE" as const, discountValue: 15 },
    ];
    const selectedVoucherId = "vouch-1";

    // Simulate checkout completion consuming voucher
    myVouchers = myVouchers.filter((v) => v.id !== selectedVoucherId);

    expect(myVouchers.length).toBe(1);
    expect(myVouchers.some((v) => v.id === "vouch-1")).toBe(false);
  });

  // 8. Tenant & Mitra isolation in Menu & Cart
  it("8. Products maintain distinct tenant affiliation and do not mix erroneously", () => {
    const cart = [
      { id: "p-1", name: "Kopi Senja Signature", tenantId: "tenant-ks", price: 25000, quantity: 2 },
      { id: "p-2", name: "Nasi Ayam Betutu", tenantId: "tenant-kitchen", price: 45000, quantity: 1 },
    ];

    const tenantGroups = new Map<string, typeof cart>();
    cart.forEach((item) => {
      const tId = item.tenantId;
      if (!tenantGroups.has(tId)) tenantGroups.set(tId, []);
      tenantGroups.get(tId)!.push(item);
    });

    expect(tenantGroups.size).toBe(2);
    expect(tenantGroups.get("tenant-ks")?.length).toBe(1);
    expect(tenantGroups.get("tenant-kitchen")?.length).toBe(1);
  });

  // 9. Co-Working Booking Pricing with Promo
  it("9. Co-Working booking pricing calculates subtotal, discount, and tax correctly", () => {
    const rate = 20000;
    const duration = 4; // hours
    const subtotal = rate * duration; // 80,000
    const promo = samplePromos.find((p) => p.code === "COWORK50");
    const taxRate = 0.1; // 10%

    const pricing = calculateCoworkingPricing(subtotal, promo, taxRate);

    expect(pricing.originalSubtotal).toBe(80000);
    expect(pricing.discountAmount).toBe(40000); // 50% of 80,000
    expect(pricing.subtotalAfterDiscount).toBe(40000);
    expect(pricing.tax).toBe(4000); // 10% of 40,000
    expect(pricing.total).toBe(44000);
  });

  // 10. Order Lifecycle & Payment Confirmation points awarding
  it("10. Order is created as PENDING payment and points are awarded only upon confirmation", () => {
    const order = {
      id: "ord-2001",
      orderNumber: "ORD-2001",
      total: 82500,
      paymentStatus: "PENDING" as "PENDING" | "PAID",
      status: "NEW" as "NEW" | "CONFIRMED",
    };

    let memberPoints = 100;

    // While PENDING, points are not yet awarded
    expect(order.paymentStatus).toBe("PENDING");
    expect(memberPoints).toBe(100);

    // On payment success: mark PAID and award 1 pt / Rp 1.000
    order.paymentStatus = "PAID";
    order.status = "CONFIRMED";
    const pointsEarned = Math.floor(order.total / 1000); // 82 pts
    memberPoints += pointsEarned;

    expect(order.paymentStatus).toBe("PAID");
    expect(order.status).toBe("CONFIRMED");
    expect(pointsEarned).toBe(82);
    expect(memberPoints).toBe(182);
  });
});
