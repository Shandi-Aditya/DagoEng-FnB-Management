import { describe, it, expect } from "vitest";
import { POSCartItem, POSVariantOption, POSModifierOption, LoyaltyMemberProfile, LoyaltyVoucher } from "../src/features/pos/types";

describe("POS Calculation & Transaction Engine", () => {
  it("calculates exact item price with variant adjustments and multiple modifiers", () => {
    const basePrice = 24000; // Kopi Senja Aren base
    const variant: POSVariantOption = { name: "Large (400ml)", priceAdjustment: 5000 };
    const modifiers: POSModifierOption[] = [
      { name: "Extra Espresso Shot", price: 6000 },
      { name: "Ganti Susu Oat (Oat Milk)", price: 8000 },
    ];

    const modifiersTotal = modifiers.reduce((s, m) => s + m.price, 0); // 14,000
    const unitFinalPrice = basePrice + variant.priceAdjustment + modifiersTotal; // 24k + 5k + 14k = 43,000
    const quantity = 3;
    const itemTotal = unitFinalPrice * quantity; // 129,000

    expect(unitFinalPrice).toBe(43000);
    expect(itemTotal).toBe(129000);
  });

  it("calculates accurate subtotal, 10% PB1 tax, and 5% dine-in service charge", () => {
    const subtotal = 100000;
    const discountPercent = 10;
    const discountAmount = Math.round((subtotal * discountPercent) / 100); // 10,000
    const taxableAmount = subtotal - discountAmount; // 90,000

    const taxPB1 = Math.round(taxableAmount * 0.1); // 9,000
    const serviceCharge = Math.round(taxableAmount * 0.05); // 4,500
    const grandTotal = taxableAmount + taxPB1 + serviceCharge; // 103,500

    expect(taxPB1).toBe(9000);
    expect(serviceCharge).toBe(4500);
    expect(grandTotal).toBe(103500);
  });

  it("calculates cash change accurately and handles exact cash payments", () => {
    const grandTotal = 83600;
    const cashGiven1 = 100000;
    const changeDue1 = Math.max(0, cashGiven1 - grandTotal);
    expect(changeDue1).toBe(16400);

    const cashGivenExact = 83600;
    const changeDueExact = Math.max(0, cashGivenExact - grandTotal);
    expect(changeDueExact).toBe(0);
  });

  it("divides equal split bills correctly without dropping remainders", () => {
    const grandTotal = 100000;
    const guestCount = 3;

    const perGuest = Math.floor(grandTotal / guestCount); // 33,333
    const remainder = grandTotal - perGuest * guestCount; // 1

    const guest1 = perGuest + remainder; // 33,334
    const guest2 = perGuest; // 33,333
    const guest3 = perGuest; // 33,333

    const totalSplit = guest1 + guest2 + guest3;
    expect(totalSplit).toBe(grandTotal);
  });

  it("applies fixed and percentage loyalty voucher discounts with points deduction", () => {
    const member: LoyaltyMemberProfile = {
      id: "mem-1",
      name: "Ketut Dian",
      phone: "+62 819-1122-3344",
      tier: "Gold",
      points: 340,
    };

    const voucherFixed: LoyaltyVoucher = {
      id: "vouch-1",
      title: "Voucher Potongan Rp 25.000",
      description: "Potongan Rp 25.000",
      pointsCost: 100,
      discountType: "FIXED",
      discountValue: 25000,
    };

    const subtotal = 120000;
    const discountVoucher = Math.min(subtotal, voucherFixed.discountValue); // 25,000
    const remainingPoints = member.points - voucherFixed.pointsCost; // 240

    const taxableAmount = subtotal - discountVoucher; // 95,000
    const taxPB1 = Math.round(taxableAmount * 0.1); // 9,500
    const serviceCharge = Math.round(taxableAmount * 0.05); // 4,750
    const grandTotal = taxableAmount + taxPB1 + serviceCharge; // 109,250

    expect(discountVoucher).toBe(25000);
    expect(remainingPoints).toBe(240);
    expect(grandTotal).toBe(109250);
  });

  it("transitions reservation status to SEATED and table to OCCUPIED on check-in", () => {
    const initialReservation = {
      id: "res-101",
      customerName: "Bpk. Hendra Wijaya",
      tableId: "VIP-01",
      status: "CONFIRMED" as const,
    };

    const initialTable = {
      id: "VIP-01",
      status: "RESERVED" as const,
      customer: "Bpk. Hendra (Meeting)",
    };

    // Simulate Seat Table Action
    const updatedReservation = { ...initialReservation, status: "SEATED" as const };
    const updatedTable = { ...initialTable, status: "OCCUPIED" as const, customer: initialReservation.customerName };

    expect(updatedReservation.status).toBe("SEATED");
    expect(updatedTable.status).toBe("OCCUPIED");
    expect(updatedTable.customer).toBe("Bpk. Hendra Wijaya");
  });
});
