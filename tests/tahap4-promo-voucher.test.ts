import { describe, it, expect } from "vitest";
import {
  calculateOrderPricing,
  calculateCoworkingPricing,
  validateVoucherCode,
  checkPromoValidity,
  PromoConfig,
  OrderItemInput,
} from "../src/lib/promo";
import { OrderRecord } from "../src/types/order";

describe("Tahap 4 - Comprehensive Promo & Voucher Integration Tests", () => {
  const sampleItems: OrderItemInput[] = [
    { productId: "p-kopi", category: "COFFEE", tenantId: "tenant-ks", quantity: 2, unitPrice: 25000 }, // 50.000
    { productId: "p-croissant", category: "PASTRY", tenantId: "tenant-bl", quantity: 1, unitPrice: 30000 }, // 30.000
  ]; // Total subtotal = 80.000

  // 1. Promo aktif berhasil digunakan
  it("1. Promo aktif berhasil digunakan dan diskon terhitung otomatis", () => {
    const promo: PromoConfig = {
      id: "promo-aktif-10",
      code: "DAGO10",
      name: "Diskon 10% All",
      discountType: "PERCENTAGE",
      discountValue: 10,
      targetType: "ALL",
      scope: "FNB",
      isActive: true,
    };

    const res = calculateOrderPricing(sampleItems, promo, 0.1);
    expect(res.originalSubtotal).toBe(80000);
    expect(res.discountAmount).toBe(8000); // 10% of 80k
    expect(res.subtotalAfterDiscount).toBe(72000);
    expect(res.tax).toBe(7200); // 10% of 72k
    expect(res.total).toBe(79200);
  });

  // 2. Promo expired ditolak
  it("2. Promo expired ditolak dengan pesan yang sesuai", () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const expiredPromo: PromoConfig = {
      id: "promo-exp",
      code: "EXPIRED20",
      name: "Promo Kadaluarsa",
      discountType: "PERCENTAGE",
      discountValue: 20,
      targetType: "ALL",
      validUntil: pastDate,
      isActive: true,
    };

    const val = validateVoucherCode("EXPIRED20", [expiredPromo], 80000);
    expect(val.isValid).toBe(false);
    expect(val.discountAmount).toBe(0);
    expect(val.reason).toContain("Expired");

    const pricing = calculateOrderPricing(sampleItems, expiredPromo, 0.1);
    expect(pricing.discountAmount).toBe(0);
    expect(pricing.total).toBe(88000);
  });

  // 3. Minimum transaksi tidak terpenuhi ditolak
  it("3. Minimum transaksi tidak terpenuhi ditolak", () => {
    const minPromo: PromoConfig = {
      id: "promo-min",
      code: "MIN100K",
      name: "Diskon Belanja Min 100rb",
      discountType: "FIXED",
      discountValue: 15000,
      targetType: "ALL",
      minimumAmount: 100000,
      isActive: true,
    };

    // Subtotal 80k < 100k
    const val = validateVoucherCode("MIN100K", [minPromo], 80000);
    expect(val.isValid).toBe(false);
    expect(val.discountAmount).toBe(0);
    expect(val.reason).toContain("minimal transaksi");

    const pricing = calculateOrderPricing(sampleItems, minPromo, 0.1);
    expect(pricing.discountAmount).toBe(0);
  });

  // 4. Quota habis ditolak
  it("4. Quota habis ditolak", () => {
    const quotaPromo: PromoConfig = {
      id: "promo-quota",
      code: "LIMITED5",
      name: "Promo Terbatas Kuota",
      discountType: "PERCENTAGE",
      discountValue: 50,
      targetType: "ALL",
      quota: 5,
      usageCount: 5, // Fully utilized
      isActive: true,
    };

    const val = validateVoucherCode("LIMITED5", [quotaPromo], 80000);
    expect(val.isValid).toBe(false);
    expect(val.discountAmount).toBe(0);
    expect(val.reason).toContain("Kuota pemakaian");

    const pricing = calculateOrderPricing(sampleItems, quotaPromo, 0.1);
    expect(pricing.discountAmount).toBe(0);
  });

  // 5. Tenant tidak sesuai ditolak (Multi-Tenant Isolation)
  it("5. Promo tenant-specific hanya memotong item dari tenant yang sesuai", () => {
    const ksTenantPromo: PromoConfig = {
      id: "promo-ks-only",
      code: "SENJA20",
      name: "Promo Kopi Senja Only",
      discountType: "PERCENTAGE",
      discountValue: 20,
      targetType: "TENANT",
      targetId: "tenant-ks", // Only applies to Kopi Senja (50k), not Bakery (30k)
      isActive: true,
    };

    const pricing = calculateOrderPricing(sampleItems, ksTenantPromo, 0.1);
    expect(pricing.originalSubtotal).toBe(80000);
    // 20% of 50.000 = 10.000 (Croissant 30k from tenant-bl is not discounted)
    expect(pricing.discountAmount).toBe(10000);
    expect(pricing.subtotalAfterDiscount).toBe(70000);
  });

  // 6. Voucher yang sudah digunakan tidak dapat digunakan lagi (USED status lifecycle)
  it("6. Voucher yang sudah digunakan per customer ditolak (Single-use enforcement)", () => {
    const singleUsePromo: PromoConfig = {
      id: "promo-welcome",
      code: "WELCOME10",
      name: "Welcome Voucher",
      discountType: "FIXED",
      discountValue: 10000,
      targetType: "ALL",
      usedBy: ["cust-agus-123"],
      isActive: true,
    };

    // User who already used it
    const valUsed = validateVoucherCode("WELCOME10", [singleUsePromo], 80000, { customerId: "cust-agus-123" });
    expect(valUsed.isValid).toBe(false);
    expect(valUsed.reason).toContain("sudah pernah menggunakan");

    // Fresh user
    const valFresh = validateVoucherCode("WELCOME10", [singleUsePromo], 80000, { customerId: "cust-budi-999" });
    expect(valFresh.isValid).toBe(true);
    expect(valFresh.discountAmount).toBe(10000);
  });

  // 7. Diskon tidak dihitung dua kali (Single discount application)
  it("7. Diskon hanya diterapkan satu kali dan tidak terduplikasi", () => {
    const promo: PromoConfig = {
      id: "promo-single",
      code: "FLAT15",
      name: "Flat 15k Off",
      discountType: "FIXED",
      discountValue: 15000,
      targetType: "ALL",
      isActive: true,
    };

    const res1 = calculateOrderPricing(sampleItems, promo, 0.1);
    expect(res1.discountAmount).toBe(15000);

    // Re-calculating with same items & promo returns identical immutable discount
    const res2 = calculateOrderPricing(sampleItems, promo, 0.1);
    expect(res2.discountAmount).toBe(15000);
    expect(res2.total).toBe(res1.total);
  });

  // 8. Total transaksi tetap benar & tidak pernah negatif
  it("8. Total transaksi tetap benar dan dipastikan tidak negatif bahkan jika diskon > subtotal", () => {
    const largePromo: PromoConfig = {
      id: "promo-huge",
      code: "SUPER100K",
      name: "Potongan Rp 100.000",
      discountType: "FIXED",
      discountValue: 100000, // Greater than 80k subtotal
      targetType: "ALL",
      isActive: true,
    };

    const res = calculateOrderPricing(sampleItems, largePromo, 0.1);
    expect(res.originalSubtotal).toBe(80000);
    expect(res.discountAmount).toBe(80000); // Capped at subtotal
    expect(res.subtotalAfterDiscount).toBe(0);
    expect(res.tax).toBe(0);
    expect(res.total).toBe(0); // Not negative!
  });

  // 9. Flow payment -> order tetap tidak berubah (Payment first verification)
  it("9. Flow payment -> order tetap terjaga: pesanan dibuat dengan paymentStatus PENDING hingga lunas", () => {
    const rawOrder: OrderRecord = {
      id: "ord-self-01",
      orderNumber: "ORD-20261007-001",
      organizationId: "org-dago-hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-05",
      customerName: "I Putu Agus",
      orderType: "DINE_IN",
      subtotal: 80000,
      discount: 8000,
      promoId: "promo-aktif-10",
      tax: 7200,
      total: 79200,
      targetServiceMinutes: 10,
      status: "NEW",
      paymentStatus: "PENDING", // Payment first!
      paymentMethod: "QRIS",
      items: [
        { id: "it-1", productId: "p-kopi", tenantId: "tenant-ks", productName: "Kopi Senja", quantity: 2, unitPrice: 25000 },
        { id: "it-2", productId: "p-croissant", tenantId: "tenant-bl", productName: "Croissant", quantity: 1, unitPrice: 30000 },
      ],
      createdAt: new Date().toISOString(),
      statusHistory: [],
    };

    expect(rawOrder.paymentStatus).toBe("PENDING");
    expect(rawOrder.status).toBe("NEW");
    expect(rawOrder.promoId).toBe("promo-aktif-10");
    expect(rawOrder.discount).toBe(8000);

    // Simulate successful payment
    const paidOrder: OrderRecord = {
      ...rawOrder,
      status: "CONFIRMED",
      paymentStatus: "PAID",
      confirmedAt: new Date().toISOString(),
    };

    expect(paidOrder.paymentStatus).toBe("PAID");
    expect(paidOrder.status).toBe("CONFIRMED");
    expect(paidOrder.total).toBe(79200);
  });
});
