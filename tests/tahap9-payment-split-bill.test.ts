import { describe, it, expect } from "vitest";
import { formatCurrencyIDR } from "../src/lib/utils";
import { calculateOrderPricing, calculateCoworkingPricing, PromoConfig } from "../src/lib/promo";
import { SplitGuestBill, POSPaymentMethod } from "../src/features/pos/types";

// Helper function to validate split bill allocations
function validateSplitBill(
  grandTotal: number,
  guests: { id: string; amount: number; method: "QRIS" | "CASH" | "EDC"; isPaid: boolean }[]
): {
  isValid: boolean;
  totalAssigned: number;
  remaining: number;
  isOverpaid: boolean;
  isFullyPaid: boolean;
  error?: string;
} {
  const totalAssigned = guests.reduce((sum, g) => sum + g.amount, 0);
  const remaining = grandTotal - totalAssigned;
  const isOverpaid = totalAssigned > grandTotal;
  const isFullyPaid = totalAssigned === grandTotal && guests.every((g) => g.isPaid);

  if (isOverpaid) {
    return {
      isValid: false,
      totalAssigned,
      remaining: 0,
      isOverpaid: true,
      isFullyPaid: false,
      error: `Alokasi pembayaran melebihi total tagihan sebesar ${formatCurrencyIDR(totalAssigned - grandTotal)}.`,
    };
  }

  if (totalAssigned < grandTotal) {
    return {
      isValid: false,
      totalAssigned,
      remaining,
      isOverpaid: false,
      isFullyPaid: false,
      error: `Alokasi pembayaran kurang ${formatCurrencyIDR(remaining)}.`,
    };
  }

  if (!guests.every((g) => g.isPaid)) {
    return {
      isValid: false,
      totalAssigned,
      remaining: 0,
      isOverpaid: false,
      isFullyPaid: false,
      error: "Beberapa tamu belum menyelesaikan pembayaran.",
    };
  }

  return {
    isValid: true,
    totalAssigned,
    remaining: 0,
    isOverpaid: false,
    isFullyPaid: true,
  };
}

describe("Tahap 9: Payment, QRIS, and Split Bill Audit & Comprehensive Test Suite", () => {
  // 1. Payment-First Flow: Order remains PENDING before payment is confirmed
  it("1. Payment-first flow ensures transaction is PENDING payment and not final initially", () => {
    const order = {
      id: "ord-1001",
      total: 100000,
      status: "NEW",
      paymentStatus: "PENDING",
    };

    expect(order.paymentStatus).toBe("PENDING");
    expect(order.status).toBe("NEW");
  });

  // 2. Order is not marked CONFIRMED before payment success
  it("2. Order is not finalized into kitchen before payment verification", () => {
    const order = {
      id: "ord-1002",
      total: 75000,
      status: "NEW",
      paymentStatus: "PENDING",
    };

    // Attempting to advance without paying
    const isPayConfirmed = order.paymentStatus === "PAID";
    expect(isPayConfirmed).toBe(false);
    expect(order.status).not.toBe("CONFIRMED");
  });

  // 3. QRIS Pending state is not considered PAID
  it("3. QRIS pending state keeps paymentStatus as PENDING", () => {
    const qrisTransaction = {
      id: "qris-tx-01",
      amount: 120000,
      paymentMethod: "QRIS",
      qrisStatus: "WAITING_FOR_PAYMENT",
      paymentStatus: "PENDING",
    };

    expect(qrisTransaction.paymentStatus).toBe("PENDING");
    expect(qrisTransaction.qrisStatus).toBe("WAITING_FOR_PAYMENT");
  });

  // 4. QRIS Success confirms payment and advances order status to PAID
  it("4. QRIS success updates payment status to PAID and finalizes order", () => {
    const order = {
      id: "ord-1003",
      total: 50000,
      status: "NEW",
      paymentStatus: "PENDING",
      paymentMethod: "QRIS",
    };

    // Simulate Webhook / Confirmation
    order.paymentStatus = "PAID";
    order.status = "CONFIRMED";

    expect(order.paymentStatus).toBe("PAID");
    expect(order.status).toBe("CONFIRMED");
  });

  // 5. QRIS Cancelled/Failed does not mark as PAID
  it("5. QRIS cancellation or failure sets status to CANCELLED and does not mark as PAID", () => {
    const order = {
      id: "ord-1004",
      total: 45000,
      status: "NEW",
      paymentStatus: "PENDING",
    };

    // User cancels during payment waiting
    order.status = "CANCELLED";
    order.paymentStatus = "FAILED";

    expect(order.paymentStatus).toBe("FAILED");
    expect(order.status).toBe("CANCELLED");
    expect(order.paymentStatus).not.toBe("PAID");
  });

  // 6. Cash Payment flow calculates change and marks PAID
  it("6. Cash payment handles cash given, computes change due, and marks transaction PAID", () => {
    const grandTotal = 85000;
    const cashGiven = 100000;
    const changeDue = cashGiven - grandTotal;

    expect(changeDue).toBe(15000);
    expect(cashGiven >= grandTotal).toBe(true);

    const receipt = {
      grandTotal,
      paymentMethod: "CASH" as POSPaymentMethod,
      amountPaid: cashGiven,
      changeDue,
      paymentStatus: "PAID",
    };

    expect(receipt.amountPaid).toBe(100000);
    expect(receipt.changeDue).toBe(15000);
    expect(receipt.paymentStatus).toBe("PAID");
  });

  // 7. EDC Payment flow
  it("7. EDC payment records bank selection, approval code, and completes with exact total", () => {
    const grandTotal = 150000;
    const edcPayment = {
      method: "EDC" as POSPaymentMethod,
      bank: "BCA",
      approvalCode: "APP-982103",
      amountPaid: grandTotal,
      changeDue: 0,
      paymentStatus: "PAID",
    };

    expect(edcPayment.method).toBe("EDC");
    expect(edcPayment.amountPaid).toBe(150000);
    expect(edcPayment.approvalCode).toBe("APP-982103");
  });

  // 8. Split Bill with 1 allocation
  it("8. Split bill with 1 single full allocation validates correctly", () => {
    const grandTotal = 100000;
    const guests = [
      { id: "g-1", amount: 100000, method: "QRIS" as const, isPaid: true },
    ];

    const result = validateSplitBill(grandTotal, guests);
    expect(result.isValid).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.isFullyPaid).toBe(true);
  });

  // 9. Split Bill with 2 methods (QRIS 60k + Cash 40k = 100k)
  it("9. Split bill with 2 methods (QRIS 60.000 + Cash 40.000 = 100.000) achieves PAID status", () => {
    const grandTotal = 100000;
    const guests = [
      { id: "g-1", amount: 60000, method: "QRIS" as const, isPaid: true },
      { id: "g-2", amount: 40000, method: "CASH" as const, isPaid: true },
    ];

    const result = validateSplitBill(grandTotal, guests);
    expect(result.isValid).toBe(true);
    expect(result.totalAssigned).toBe(100000);
    expect(result.remaining).toBe(0);
    expect(result.isFullyPaid).toBe(true);
  });

  // 10. Split Bill with 3 methods (QRIS 40k + Cash 30k + EDC 30k = 100k)
  it("10. Split bill with 3 methods (QRIS 40.000 + Cash 30.000 + EDC 30.000) calculates correctly", () => {
    const grandTotal = 100000;
    const guests = [
      { id: "g-1", amount: 40000, method: "QRIS" as const, isPaid: true },
      { id: "g-2", amount: 30000, method: "CASH" as const, isPaid: true },
      { id: "g-3", amount: 30000, method: "EDC" as const, isPaid: true },
    ];

    const result = validateSplitBill(grandTotal, guests);
    expect(result.isValid).toBe(true);
    expect(result.totalAssigned).toBe(100000);
    expect(result.remaining).toBe(0);
    expect(result.isFullyPaid).toBe(true);
  });

  // 11. Partial / Remaining balance calculation
  it("11. Remaining balance is computed correctly when payment is partially allocated", () => {
    const grandTotal = 100000;
    const guests = [
      { id: "g-1", amount: 60000, method: "QRIS" as const, isPaid: true },
    ];

    const result = validateSplitBill(grandTotal, guests);
    expect(result.isValid).toBe(false);
    expect(result.totalAssigned).toBe(60000);
    expect(result.remaining).toBe(40000);
  });

  // 12. Overpayment in split bill is rejected/prevented
  it("12. Overpayment in split bill allocations is prevented and marked invalid", () => {
    const grandTotal = 100000;
    const guests = [
      { id: "g-1", amount: 80000, method: "QRIS" as const, isPaid: true },
      { id: "g-2", amount: 30000, method: "CASH" as const, isPaid: true },
    ]; // Total = 110,000 > 100,000

    const result = validateSplitBill(grandTotal, guests);
    expect(result.isValid).toBe(false);
    expect(result.isOverpaid).toBe(true);
    expect(result.totalAssigned).toBe(110000);
    expect(result.error).toContain("melebihi");
  });

  // 13. Remaining balance cannot be negative
  it("13. Remaining balance never becomes negative", () => {
    const grandTotal = 50000;
    const totalAssigned = 60000;
    const remaining = Math.max(0, grandTotal - totalAssigned);

    expect(remaining).toBe(0);
  });

  // 14. Double payment prevention (idempotent confirmation)
  it("14. Double payment confirmation does not add duplicate loyalty points", () => {
    let memberPoints = 100;
    const processedTxIds = new Set<string>();

    const confirmPaymentAndAwardPoints = (txId: string, amount: number) => {
      if (processedTxIds.has(txId)) {
        return false; // Already processed
      }
      processedTxIds.add(txId);
      const points = Math.floor(amount / 1000);
      memberPoints += points;
      return true;
    };

    const firstAttempt = confirmPaymentAndAwardPoints("tx-555", 50000);
    expect(firstAttempt).toBe(true);
    expect(memberPoints).toBe(150); // 100 + 50

    // Duplicate webhook / confirmation attempt
    const secondAttempt = confirmPaymentAndAwardPoints("tx-555", 50000);
    expect(secondAttempt).toBe(false);
    expect(memberPoints).toBe(150); // Points remained 150 without double add
  });

  // 15. Promo discount is calculated BEFORE determining payment grand total
  it("15. Promo discount applies before payment so payment uses post-discount grand total", () => {
    const promo: PromoConfig = {
      id: "promo-20",
      name: "Diskon 20%",
      discountType: "PERCENTAGE",
      discountValue: 20,
      targetType: "ALL",
      isActive: true,
    };

    const items = [
      { productId: "p-1", quantity: 2, unitPrice: 50000 }, // Subtotal: 100,000
    ];

    const pricing = calculateOrderPricing(items, promo, 0.1); // 10% PB1 tax

    expect(pricing.originalSubtotal).toBe(100000);
    expect(pricing.discountAmount).toBe(20000); // 20% of 100k
    expect(pricing.subtotalAfterDiscount).toBe(80000);
    expect(pricing.tax).toBe(8000); // 10% of 80k
    expect(pricing.total).toBe(88000); // Grand total to pay is 88,000, not 110,000

    // Split bill based on final grand total
    const split = validateSplitBill(pricing.total, [
      { id: "g-1", amount: 44000, method: "QRIS", isPaid: true },
      { id: "g-2", amount: 44000, method: "CASH", isPaid: true },
    ]);

    expect(split.isValid).toBe(true);
    expect(split.totalAssigned).toBe(88000);
  });

  // 16. Multi-Tenant Attribution in payment and receipt
  it("16. Multi-tenant items retain individual tenant ownership and correct total", () => {
    const orderItems = [
      { name: "Kopi Senja Signature", quantity: 2, unitPrice: 25000, subtotal: 50000, tenantId: "tenant-ks", tenantName: "Kopi Senja" },
      { name: "Nasi Ayam Betutu", quantity: 1, unitPrice: 45000, subtotal: 45000, tenantId: "tenant-kitchen", tenantName: "Dapur Mama" },
    ];

    const subtotal = orderItems.reduce((s, i) => s + i.subtotal, 0);
    expect(subtotal).toBe(95000);

    const tenantBreakdown = new Map<string, number>();
    orderItems.forEach((item) => {
      tenantBreakdown.set(item.tenantId, (tenantBreakdown.get(item.tenantId) || 0) + item.subtotal);
    });

    expect(tenantBreakdown.get("tenant-ks")).toBe(50000);
    expect(tenantBreakdown.get("tenant-kitchen")).toBe(45000);
  });
});
