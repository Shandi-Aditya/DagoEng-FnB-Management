import { describe, expect, it } from "vitest";
import type { OrderRecord } from "@/types/order";
import {
  DEFAULT_PAYMENT_EXPIRY_SECONDS,
  formatPaymentTimer,
  calculatePaymentProgress,
  normalizePaymentItem,
  getPaymentMethodDisplay,
  calculateSecondsRemaining,
  type UnifiedPaymentItem,
} from "@/features/payment/payment-waiting";

describe("payment-waiting domain logic", () => {
  describe("formatPaymentTimer", () => {
    it("formats 900 seconds to 15:00", () => {
      expect(formatPaymentTimer(900)).toBe("15:00");
    });

    it("formats 65 seconds to 01:05", () => {
      expect(formatPaymentTimer(65)).toBe("01:05");
    });

    it("formats 0 seconds to 00:00", () => {
      expect(formatPaymentTimer(0)).toBe("00:00");
    });

    it("handles negative seconds by clamping to 00:00", () => {
      expect(formatPaymentTimer(-10)).toBe("00:00");
    });
  });

  describe("calculatePaymentProgress", () => {
    it("returns 100% when full duration remains", () => {
      expect(calculatePaymentProgress(900, 900)).toBe(100);
    });

    it("returns 50% when half duration remains", () => {
      expect(calculatePaymentProgress(450, 900)).toBe(50);
    });

    it("returns 0% when timer reaches zero or less", () => {
      expect(calculatePaymentProgress(0, 900)).toBe(0);
      expect(calculatePaymentProgress(-5, 900)).toBe(0);
    });

    it("clamps values exceeding 100%", () => {
      expect(calculatePaymentProgress(1000, 900)).toBe(100);
    });

    it("uses DEFAULT_PAYMENT_EXPIRY_SECONDS when total duration omitted", () => {
      expect(calculatePaymentProgress(DEFAULT_PAYMENT_EXPIRY_SECONDS)).toBe(100);
    });
  });

  describe("normalizePaymentItem", () => {
    it("returns paymentItem directly if provided", () => {
      const customItem: UnifiedPaymentItem = {
        id: "custom-1",
        itemCode: "CUSTOM-001",
        title: "Pesanan Kustom",
        subtitle: "Lantai 1",
        customerName: "Budi",
        total: 50000,
        paymentMethod: "QRIS",
        type: "FNB",
        paymentStatus: "PENDING",
      };
      expect(normalizePaymentItem({ paymentItem: customItem })).toEqual(customItem);
    });

    it("normalizes F&B OrderRecord correctly", () => {
      const order: OrderRecord = {
        id: "ord-123",
        orderNumber: "ORD-2026-001",
        organizationId: "org-dago-hub",
        orderType: "DINE_IN",
        targetServiceMinutes: 15,
        statusHistory: [],
        customerName: "Ahmad",
        tableNumber: "T-04",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        items: [
          {
            id: "it-1",
            productId: "p-1",
            productName: "Kopi Dago",
            quantity: 2,
            unitPrice: 20000,
          },
        ],
        subtotal: 40000,
        tax: 4000,
        total: 44000,
        paymentStatus: "PENDING",
        paymentMethod: "QRIS",
        status: "CONFIRMED",
        createdAt: "2026-11-15T08:00:00Z",
      };

      const normalized = normalizePaymentItem({ order });
      expect(normalized).not.toBeNull();
      expect(normalized?.id).toBe("ord-123");
      expect(normalized?.itemCode).toBe("ORD-2026-001");
      expect(normalized?.title).toBe("Pesanan F&B");
      expect(normalized?.subtitle).toBe("Meja T-04 (Singaraja)");
      expect(normalized?.customerName).toBe("Ahmad");
      expect(normalized?.total).toBe(44000);
      expect(normalized?.type).toBe("FNB");
      expect(normalized?.itemsBreakdown).toEqual([
        {
          label: "Kopi Dago",
          qty: 2,
          price: 40000,
        },
      ]);
    });

    it("normalizes Co-working booking correctly", () => {
      const booking = {
        id: "bk-99",
        bookingCode: "BK-CWK-099",
        spaceName: "Dedicated Desk D-02",
        guestName: "Siti",
        duration: 4,
        totalAmount: 60000,
        paymentMethod: "CASH",
        paymentStatus: "PENDING",
        date: "15 Nov 2026",
        startTime: "10:00",
      };

      const normalized = normalizePaymentItem({ booking });
      expect(normalized).not.toBeNull();
      expect(normalized?.id).toBe("bk-99");
      expect(normalized?.itemCode).toBe("BK-CWK-099");
      expect(normalized?.title).toBe("Sewa ruang kerja co-working");
      expect(normalized?.subtitle).toBe("Dedicated Desk D-02 (4 jam)");
      expect(normalized?.customerName).toBe("Siti");
      expect(normalized?.total).toBe(60000);
      expect(normalized?.type).toBe("COWORKING");
      expect(normalized?.paymentMethod).toBe("CASH");
      expect(normalized?.dateInfo).toBe("15 Nov 2026 • 10:00");
    });

    it("returns null if no item, order, or booking passed", () => {
      expect(normalizePaymentItem({})).toBeNull();
    });
  });

  describe("getPaymentMethodDisplay", () => {
    it("returns proper label and unslop instruction for CASH", () => {
      const display = getPaymentMethodDisplay("CASH");
      expect(display.label).toBe("Tunai di kasir");
      expect(display.instruction).not.toContain("Silakan");
      expect(display.instruction).not.toContain("!");
    });

    it("returns proper label and unslop instruction for EDC", () => {
      const display = getPaymentMethodDisplay("EDC");
      expect(display.label).toBe("Kartu debit / kredit");
      expect(display.instruction).not.toContain("Silakan");
    });

    it("defaults to QRIS dinamis for QRIS or unknown", () => {
      const display = getPaymentMethodDisplay("QRIS");
      expect(display.label).toBe("QRIS dinamis");
      expect(getPaymentMethodDisplay("UNKNOWN").label).toBe("QRIS dinamis");
    });
  });

  describe("calculateSecondsRemaining", () => {
    it("calculates remaining time correctly from createdAt", () => {
      const now = new Date("2026-11-15T10:10:00Z").getTime();
      const createdAt = "2026-11-15T10:05:00Z"; // 5 minutes ago (300s elapsed)
      // 900 - 300 = 600 seconds
      expect(calculateSecondsRemaining(createdAt, now, 900)).toBe(600);
    });

    it("returns 0 if order expired", () => {
      const now = new Date("2026-11-15T10:20:00Z").getTime();
      const createdAt = "2026-11-15T10:00:00Z"; // 20 minutes ago (1200s elapsed)
      expect(calculateSecondsRemaining(createdAt, now, 900)).toBe(0);
    });

    it("returns max duration if createdAt is invalid or omitted", () => {
      expect(calculateSecondsRemaining(undefined, Date.now(), 900)).toBe(900);
      expect(calculateSecondsRemaining("invalid-date", Date.now(), 900)).toBe(900);
    });
  });
});
