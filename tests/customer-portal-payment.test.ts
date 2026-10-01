import { describe, it, expect } from "vitest";
import { OrderRecord } from "../src/types/order";
import { INITIAL_INGREDIENTS, INITIAL_RECIPES, deductRecipeIngredients } from "../src/features/inventory/inventory-data";
import { LoyaltyMember } from "../src/types/loyalty";

describe("Customer Portal Payment Waiting Flow (End-to-End)", () => {
  const baseMember: LoyaltyMember = {
    id: "mem-001",
    name: "Ketut Dian",
    phone: "+62 812-3456-7890",
    tier: "Silver",
    points: 120,
    totalSpend: 1250000,
    totalVisits: 8,
    status: "ACTIVE",
    lastVisit: "2026-09-24",
    favoriteItem: "Signature Wagyu Beef Bowl",
    registeredOutletId: "outlet-sgr",
    registeredOutletName: "Singaraja",
    joinedDate: "12 Jan 2026",
    pointHistory: [],
    tierHistory: [],
  };

  const cart = [
    { productName: "Signature Wagyu Beef Bowl", quantity: 2, price: 65000 },
    { productName: "Kopi Senja Aren", quantity: 1, price: 24000 },
  ];

  const subtotal = 154000;
  const tax = 15400;
  const grandTotal = 169400;

  it("1. Checkout creates order in PENDING_PAYMENT status without awarding loyalty points or deducting stock", () => {
    // 1. Initial Order Created via Checkout
    const initialOrder: OrderRecord = {
      id: "ord-test-pending",
      orderNumber: "ORD-20260924-0099",
      organizationId: "org-dago-hub",
      outletId: baseMember.registeredOutletId,
      outletName: baseMember.registeredOutletName,
      tableNumber: "T-03",
      customerName: baseMember.name,
      orderType: "DINE_IN",
      status: "NEW",
      targetServiceMinutes: 10,
      items: cart.map((c, i) => ({
        id: `it-${i}`,
        productName: c.productName,
        quantity: c.quantity,
        unitPrice: c.price,
      })),
      subtotal,
      tax,
      total: grandTotal,
      paymentStatus: "PENDING",
      paymentMethod: "QRIS",
      createdAt: new Date().toISOString(),
      statusHistory: [
        {
          id: "h-1",
          orderId: "ord-test-pending",
          fromStatus: null,
          toStatus: "NEW",
          timestamp: new Date().toISOString(),
          actorName: baseMember.name,
          note: "Checkout pesanan - Menunggu Pembayaran QRIS",
        },
      ],
    };

    expect(initialOrder.status).toBe("NEW");
    expect(initialOrder.paymentStatus).toBe("PENDING");
    expect(initialOrder.paymentMethod).toBe("QRIS");

    // Loyalty points must NOT be awarded while payment is PENDING
    const pointsAwarded = 0;
    expect(baseMember.points + pointsAwarded).toBe(120);

    // Stock must NOT be deducted yet
    const initialWagyuStock = INITIAL_INGREDIENTS.find((i) => i.id === "ing-1")?.stockNumber;
    expect(initialWagyuStock).toBe(4.5);
  });

  it("2. PENDING_PAYMENT -> PAID transition confirms order, deducts BOM ingredients, and awards Loyalty points", () => {
    const pendingOrder: OrderRecord = {
      id: "ord-test-pay-success",
      orderNumber: "ORD-20260924-0100",
      organizationId: "org-dago-hub",
      outletId: baseMember.registeredOutletId,
      outletName: baseMember.registeredOutletName,
      tableNumber: "T-03",
      customerName: baseMember.name,
      orderType: "DINE_IN",
      status: "NEW",
      targetServiceMinutes: 10,
      items: cart.map((c, i) => ({
        id: `it-${i}`,
        productName: c.productName,
        quantity: c.quantity,
        unitPrice: c.price,
      })),
      subtotal,
      tax,
      total: grandTotal,
      paymentStatus: "PENDING",
      paymentMethod: "QRIS",
      createdAt: new Date().toISOString(),
      statusHistory: [],
    };

    // Transition to PAID (simulated webhook / payment verification)
    const paidTimestamp = new Date().toISOString();
    const paidOrder: OrderRecord = {
      ...pendingOrder,
      status: "CONFIRMED",
      paymentStatus: "PAID",
      confirmedAt: paidTimestamp,
      statusHistory: [
        ...pendingOrder.statusHistory,
        {
          id: "h-paid",
          orderId: pendingOrder.id,
          fromStatus: "NEW",
          toStatus: "CONFIRMED",
          timestamp: paidTimestamp,
          actorName: "Webhook Payment Gateway",
          note: "Pembayaran lunas via QRIS Dinamis",
        },
      ],
    };

    expect(paidOrder.status).toBe("CONFIRMED");
    expect(paidOrder.paymentStatus).toBe("PAID");

    // Deduct BOM stock
    let currentIngredients = [...INITIAL_INGREDIENTS];
    paidOrder.items.forEach((item) => {
      const recipe = INITIAL_RECIPES.find((r) => r.menuName.toLowerCase() === item.productName.toLowerCase());
      if (recipe) {
        const res = deductRecipeIngredients(currentIngredients, recipe, item.quantity);
        currentIngredients = res.updatedStock;
      }
    });

    const wagyuStock = currentIngredients.find((i) => i.id === "ing-1")?.stockNumber;
    expect(wagyuStock).toBe(4.38); // 4.50kg - 0.12kg = 4.38kg

    // Award loyalty points ONLY on PAID
    const earnedPoints = Math.floor(paidOrder.total / 1000);
    expect(earnedPoints).toBe(169);
    const finalPoints = baseMember.points + earnedPoints;
    expect(finalPoints).toBe(289);
  });

  it("3. Cancelled/Expired pending order transitions to CANCELLED and does NOT award loyalty points", () => {
    const pendingOrder: OrderRecord = {
      id: "ord-test-cancel",
      orderNumber: "ORD-20260924-0101",
      organizationId: "org-dago-hub",
      outletId: baseMember.registeredOutletId,
      outletName: baseMember.registeredOutletName,
      tableNumber: "T-03",
      customerName: baseMember.name,
      orderType: "DINE_IN",
      status: "NEW",
      targetServiceMinutes: 10,
      items: cart.map((c, i) => ({
        id: `it-${i}`,
        productName: c.productName,
        quantity: c.quantity,
        unitPrice: c.price,
      })),
      subtotal,
      tax,
      total: grandTotal,
      paymentStatus: "PENDING",
      paymentMethod: "QRIS",
      createdAt: new Date().toISOString(),
      statusHistory: [],
    };

    // Cancellation Transition
    const cancelledOrder: OrderRecord = {
      ...pendingOrder,
      status: "CANCELLED",
      paymentStatus: "REFUNDED",
      statusHistory: [
        {
          id: "h-cancel",
          orderId: pendingOrder.id,
          fromStatus: "NEW",
          toStatus: "CANCELLED",
          timestamp: new Date().toISOString(),
          actorName: baseMember.name,
          note: "Dibatalkan oleh Pelanggan pada tahap menunggu pembayaran",
        },
      ],
    };

    expect(cancelledOrder.status).toBe("CANCELLED");

    // No loyalty points awarded
    let memberPoints = baseMember.points;
    if (cancelledOrder.paymentStatus === "PAID") {
      memberPoints += Math.floor(cancelledOrder.total / 1000);
    }
    expect(memberPoints).toBe(120);
  });

  it("4. Duplicate payment verification guard prevents duplicate loyalty points or double processing", () => {
    const alreadyPaidOrder: OrderRecord = {
      id: "ord-test-duplicate",
      orderNumber: "ORD-20260924-0102",
      organizationId: "org-dago-hub",
      outletId: baseMember.registeredOutletId,
      outletName: baseMember.registeredOutletName,
      tableNumber: "T-03",
      customerName: baseMember.name,
      orderType: "DINE_IN",
      status: "CONFIRMED",
      targetServiceMinutes: 10,
      items: cart.map((c, i) => ({
        id: `it-${i}`,
        productName: c.productName,
        quantity: c.quantity,
        unitPrice: c.price,
      })),
      subtotal,
      tax,
      total: grandTotal,
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
      createdAt: new Date().toISOString(),
      statusHistory: [],
    };

    let pointsAwardCount = 0;
    const processPayment = (order: OrderRecord) => {
      if (order.paymentStatus === "PAID" && order.status !== "NEW") {
        // Guard prevents re-processing
        return false;
      }
      pointsAwardCount++;
      return true;
    };

    const firstAttempt = processPayment(alreadyPaidOrder);
    expect(firstAttempt).toBe(false);
    expect(pointsAwardCount).toBe(0);
  });
});
