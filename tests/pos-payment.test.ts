import { describe, it, expect } from "vitest";
import {
  calculateCashChange,
  generateCashSuggestions,
  generateEqualSplitGuests,
  calculateSplitBalance,
  formatQrisCountdown,
} from "@/features/pos/pos-payment";
import type { SplitGuestBill } from "@/features/pos/types";

describe("pos-payment domain logic", () => {
  describe("calculateCashChange", () => {
    it("calculates exact change and sufficiency accurately", () => {
      expect(calculateCashChange(50000, 50000)).toEqual({
        changeDue: 0,
        isSufficient: true,
      });

      expect(calculateCashChange(100000, 75000)).toEqual({
        changeDue: 25000,
        isSufficient: true,
      });

      expect(calculateCashChange(40000, 50000)).toEqual({
        changeDue: 0,
        isSufficient: false,
      });

      expect(calculateCashChange(0, 50000)).toEqual({
        changeDue: 0,
        isSufficient: false,
      });
    });
  });

  describe("generateCashSuggestions", () => {
    it("generates exact amount and rounded denominations above grand total", () => {
      const suggestions = generateCashSuggestions(65000);
      expect(suggestions).toContain(65000); // Exact money
      expect(suggestions).toContain(100000); // Rounded 50k / 100k
      expect(suggestions.every((v) => v >= 65000)).toBe(true);
      // No duplicate suggestions
      expect(new Set(suggestions).size).toBe(suggestions.length);
    });

    it("handles zero or small amounts safely", () => {
      const suggestions = generateCashSuggestions(0);
      expect(suggestions).toEqual([0]);
    });
  });

  describe("generateEqualSplitGuests", () => {
    it("allocates grand total evenly across guest count with remainder applied to first guest", () => {
      const guests = generateEqualSplitGuests(100000, 3);
      expect(guests).toHaveLength(3);
      expect(guests[0].assignedAmount).toBe(33334);
      expect(guests[1].assignedAmount).toBe(33333);
      expect(guests[2].assignedAmount).toBe(33333);
      const total = guests.reduce((sum, g) => sum + g.assignedAmount, 0);
      expect(total).toBe(100000);
    });

    it("assigns sequential labels and default payment methods", () => {
      const guests = generateEqualSplitGuests(50000, 2);
      expect(guests[0].guestLabel).toContain("Tamu 1");
      expect(guests[1].guestLabel).toContain("Tamu 2");
      expect(guests[0].isPaid).toBe(true);
    });
  });

  describe("calculateSplitBalance", () => {
    it("detects balanced and valid allocation", () => {
      const guests: SplitGuestBill[] = [
        { id: "g-1", guestLabel: "Tamu 1", assignedAmount: 30000, paymentMethod: "QRIS", isPaid: true },
        { id: "g-2", guestLabel: "Tamu 2", assignedAmount: 20000, paymentMethod: "CASH", isPaid: true },
      ];

      const balance = calculateSplitBalance(guests, 50000);
      expect(balance).toEqual({
        totalAssigned: 50000,
        remaining: 0,
        isBalanced: true,
        isAllPaid: true,
        isValid: true,
      });
    });

    it("detects under-allocated or over-allocated split bill", () => {
      const underGuests: SplitGuestBill[] = [
        { id: "g-1", guestLabel: "Tamu 1", assignedAmount: 30000, paymentMethod: "QRIS", isPaid: true },
      ];
      const underBalance = calculateSplitBalance(underGuests, 50000);
      expect(underBalance.isBalanced).toBe(false);
      expect(underBalance.remaining).toBe(20000);
      expect(underBalance.isValid).toBe(false);

      const unpaidGuests: SplitGuestBill[] = [
        { id: "g-1", guestLabel: "Tamu 1", assignedAmount: 50000, paymentMethod: "QRIS", isPaid: false },
      ];
      const unpaidBalance = calculateSplitBalance(unpaidGuests, 50000);
      expect(unpaidBalance.isBalanced).toBe(true);
      expect(unpaidBalance.isAllPaid).toBe(false);
      expect(unpaidBalance.isValid).toBe(false);
    });
  });

  describe("formatQrisCountdown", () => {
    it("formats seconds remaining into human readable string", () => {
      expect(formatQrisCountdown(120)).toBe("02:00");
      expect(formatQrisCountdown(65)).toBe("01:05");
      expect(formatQrisCountdown(9)).toBe("00:09");
      expect(formatQrisCountdown(0)).toBe("00:00");
    });
  });
});
