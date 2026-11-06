import { describe, it, expect } from "vitest";
import { calculateOrderPricing, PromoConfig } from "../src/lib/promo";
import { calculateSettlement } from "../src/lib/settlement";
import { OrderRecord } from "../src/types/order";

describe("POS Promo Integration & Settlement Tests", () => {
  const mockDate = new Date();
  const pastDate = new Date(mockDate.getTime() - 86400000).toISOString();
  const futureDate = new Date(mockDate.getTime() + 86400000).toISOString();

  it("1. POS tanpa promo", () => {
    const items = [{ productId: "p1", quantity: 1, unitPrice: 100000 }];
    const pricing = calculateOrderPricing(items, undefined, 0.1);
    
    expect(pricing.originalSubtotal).toBe(100000);
    expect(pricing.discountAmount).toBe(0);
    expect(pricing.tax).toBe(10000);
    expect(pricing.total).toBe(110000);
  });

  it("2. POS dengan promo 10%", () => {
    const promo: PromoConfig = {
      id: "promo1", name: "Promo 10%", discountType: "PERCENTAGE", discountValue: 10,
      targetType: "ALL", isActive: true
    };
    const items = [{ productId: "p1", quantity: 1, unitPrice: 100000 }];
    const pricing = calculateOrderPricing(items, promo, 0.1);
    
    expect(pricing.originalSubtotal).toBe(100000);
    expect(pricing.discountAmount).toBe(10000);
    expect(pricing.subtotalAfterDiscount).toBe(90000);
    expect(pricing.tax).toBe(9000);
    expect(pricing.total).toBe(99000);
  });

  it("3. Promo minimum amount tidak terpenuhi", () => {
    const promo: PromoConfig = {
      id: "promo1", name: "Promo 100k", discountType: "FIXED", discountValue: 20000,
      targetType: "ALL", minimumAmount: 150000, isActive: true
    };
    const items = [{ productId: "p1", quantity: 1, unitPrice: 100000 }];
    const pricing = calculateOrderPricing(items, promo, 0.1);
    
    expect(pricing.discountAmount).toBe(0);
    expect(pricing.total).toBe(110000);
  });

  it("4. Promo expired", () => {
    const promo: PromoConfig = {
      id: "promo1", name: "Promo Expired", discountType: "PERCENTAGE", discountValue: 10,
      targetType: "ALL", validUntil: pastDate, isActive: true
    };
    const items = [{ productId: "p1", quantity: 1, unitPrice: 100000 }];
    const pricing = calculateOrderPricing(items, promo, 0.1);
    
    expect(pricing.discountAmount).toBe(0);
  });

  it("5. Promo target product", () => {
    const promo: PromoConfig = {
      id: "promo1", name: "Promo Kopi", discountType: "PERCENTAGE", discountValue: 50,
      targetType: "PRODUCT", targetId: "kopi1", isActive: true
    };
    const items = [
      { productId: "kopi1", quantity: 1, unitPrice: 50000 },
      { productId: "roti1", quantity: 1, unitPrice: 30000 }
    ];
    const pricing = calculateOrderPricing(items, promo, 0.1);
    
    expect(pricing.originalSubtotal).toBe(80000);
    expect(pricing.discountAmount).toBe(25000); // 50% of 50k
  });

  it("6. Promo target category", () => {
    const promo: PromoConfig = {
      id: "promo1", name: "Promo Makanan", discountType: "PERCENTAGE", discountValue: 20,
      targetType: "CATEGORY", targetId: "Food", isActive: true
    };
    const items = [
      { productId: "kopi1", category: "Beverage", quantity: 1, unitPrice: 50000 },
      { productId: "roti1", category: "Food", quantity: 2, unitPrice: 30000 }
    ];
    const pricing = calculateOrderPricing(items, promo, 0.1);
    
    expect(pricing.originalSubtotal).toBe(110000);
    expect(pricing.discountAmount).toBe(12000); // 20% of 60k
  });

  it("7. Promo target tenant", () => {
    const promo: PromoConfig = {
      id: "promo1", name: "Promo Mitra X", discountType: "PERCENTAGE", discountValue: 30,
      targetType: "TENANT", targetId: "tenant-x", isActive: true
    };
    const items = [
      { productId: "kopi1", tenantId: "DAGO_HUB", quantity: 1, unitPrice: 50000 },
      { productId: "roti1", tenantId: "tenant-x", quantity: 1, unitPrice: 40000 }
    ];
    const pricing = calculateOrderPricing(items, promo, 0.1);
    
    expect(pricing.originalSubtotal).toBe(90000);
    expect(pricing.discountAmount).toBe(12000); // 30% of 40k
  });

  it("8. Mixed Dago + Mitra + Promo 10% All", () => {
    const promo: PromoConfig = {
      id: "promo1", name: "Promo All 10%", discountType: "PERCENTAGE", discountValue: 10,
      targetType: "ALL", isActive: true
    };
    const items = [
      { productId: "kopi1", tenantId: "DAGO_HUB", quantity: 1, unitPrice: 40000 }, // Dago
      { productId: "roti1", tenantId: "mitra-a", quantity: 1, unitPrice: 60000 } // Mitra
    ];
    const pricing = calculateOrderPricing(items, promo, 0.1); // Tax 10%
    
    expect(pricing.originalSubtotal).toBe(100000);
    expect(pricing.discountAmount).toBe(10000);
    expect(pricing.tax).toBe(9000);
    expect(pricing.total).toBe(99000); // 90k + 9k tax

    // 9. Discount masuk ke total order (simulasi order record)
    const order: OrderRecord = {
      id: "ord1",
      orderNumber: "ORD-1",
      organizationId: "org1",
      outletId: "out1",
      outletName: "Outlet 1",
      tableNumber: "1",
      customerName: "Test",
      orderType: "DINE_IN",
      status: "COMPLETED",
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
      items: [
        { id: "it1", productId: "kopi1", tenantId: "DAGO_HUB", productName: "Kopi", quantity: 1, unitPrice: 40000 },
        { id: "it2", productId: "roti1", tenantId: "mitra-a", productName: "Roti", quantity: 1, unitPrice: 60000 }
      ],
      subtotal: pricing.originalSubtotal, // 100000
      discount: pricing.discountAmount, // 10000
      tax: pricing.tax, // 9000
      total: pricing.total, // 99000
      targetServiceMinutes: 10,
      statusHistory: [],
      createdAt: new Date().toISOString()
    };

    // 10. Settlement membaca discount dengan benar (Prorata)
    const settlement = calculateSettlement([order]);
    
    // Total gross = 100k (Dago 40k, Mitra 60k)
    // Discount alloc: Dago (40%) = 4000, Mitra (60%) = 6000
    // Tax alloc: Dago (40%) = 3600, Mitra (60%) = 5400
    // Net: Gross - Discount + Tax

    const dagoHub = settlement.find(s => s.tenantId === "DAGO_HUB");
    expect(dagoHub).toBeDefined();
    expect(dagoHub?.grossRevenue).toBe(40000);
    expect(dagoHub?.discount).toBe(4000);
    expect(dagoHub?.tax).toBe(3600);
    expect(dagoHub?.netRevenue).toBe(40000 - 4000 + 3600); // 39600

    const mitraA = settlement.find(s => s.tenantId === "mitra-a");
    expect(mitraA).toBeDefined();
    expect(mitraA?.grossRevenue).toBe(60000);
    expect(mitraA?.discount).toBe(6000);
    expect(mitraA?.tax).toBe(5400);
    expect(mitraA?.netRevenue).toBe(60000 - 6000 + 5400); // 59400
  });
});
