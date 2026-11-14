/**
 * Domain murni transaksi pembayaran kasir POS.
 * Mengelola kalkulasi uang kembalian, pecahan rekomendasi, pembagian tagihan (split bill),
 * dan format penghitung waktu kedaluwarsa QRIS.
 *
 * Importers:
 * - src/features/pos/PaymentModal.tsx
 * - tests/pos-payment.test.ts
 */

import type { SplitGuestBill } from "./types";

/**
 * Calculates cash change due and checks if cash given is sufficient for grand total.
 */
export function calculateCashChange(
  cashGiven: number,
  grandTotal: number
): { changeDue: number; isSufficient: boolean } {
  const safeCash = Math.max(0, cashGiven);
  const safeTotal = Math.max(0, grandTotal);
  const isSufficient = safeCash >= safeTotal;
  const changeDue = isSufficient ? safeCash - safeTotal : 0;

  return { changeDue, isSufficient };
}

/**
 * Generates quick cash recommendations including exact amount and rounded denominations.
 */
export function generateCashSuggestions(grandTotal: number): number[] {
  if (grandTotal <= 0) return [0];

  const exact = grandTotal;
  const round50k = Math.ceil(grandTotal / 50000) * 50000;
  const round100k = Math.ceil(grandTotal / 100000) * 100000;
  const next100k = (Math.ceil(grandTotal / 100000) + 1) * 100000;

  return [exact, round50k, round100k, next100k].filter(
    (v, i, arr) => arr.indexOf(v) === i && v >= grandTotal
  );
}

const DEFAULT_SPLIT_METHODS: readonly ("QRIS" | "CASH" | "EDC")[] = [
  "QRIS",
  "CASH",
  "EDC",
  "QRIS",
  "CASH",
];

/**
 * Generates initial equal split guests bill allocation for a given party count.
 * Remainder cents are allocated to the first guest to ensure sum === grandTotal.
 */
export function generateEqualSplitGuests(
  grandTotal: number,
  count: number
): SplitGuestBill[] {
  const safeCount = Math.max(1, count);
  const perGuest = Math.floor(grandTotal / safeCount);
  const remainder = grandTotal - perGuest * safeCount;

  return Array.from({ length: safeCount }, (_, idx) => ({
    id: `g-${idx + 1}`,
    guestLabel: `Tamu ${idx + 1} (Tamu ${String.fromCharCode(65 + idx)})`,
    assignedAmount: idx === 0 ? perGuest + remainder : perGuest,
    paymentMethod: DEFAULT_SPLIT_METHODS[idx % DEFAULT_SPLIT_METHODS.length] ?? "QRIS",
    isPaid: true,
  }));
}

export interface SplitBalanceResult {
  totalAssigned: number;
  remaining: number;
  isBalanced: boolean;
  isAllPaid: boolean;
  isValid: boolean;
}

/**
 * Calculates current split bill balance, check if total assigned equals grand total,
 * and verifies that all guest sub-bills are marked as paid.
 */
export function calculateSplitBalance(
  splitGuests: readonly SplitGuestBill[],
  grandTotal: number
): SplitBalanceResult {
  const totalAssigned = splitGuests.reduce((sum, g) => sum + g.assignedAmount, 0);
  const remaining = grandTotal - totalAssigned;
  const isBalanced = totalAssigned === grandTotal;
  const isAllPaid = splitGuests.length > 0 && splitGuests.every((g) => g.isPaid);
  const isValid = isBalanced && isAllPaid;

  return {
    totalAssigned,
    remaining,
    isBalanced,
    isAllPaid,
    isValid,
  };
}

/**
 * Formats countdown seconds (e.g. 120s) into a digital mm:ss timer string.
 */
export function formatQrisCountdown(seconds: number): string {
  const safeSec = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
