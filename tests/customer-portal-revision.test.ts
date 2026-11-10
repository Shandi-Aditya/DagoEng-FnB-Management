import { describe, it, expect } from "vitest";
import {
  checkPromoValidity,
  validateVoucherCode,
  calculateOrderPricing,
  calculateCoworkingPricing,
  PromoConfig,
} from "@/lib/promo";

describe("Customer Portal Revision & Enhancement Tests", () => {
  const mockPromos: PromoConfig[] = [
    {
      id: "promo-ks10",
      code: "KS10",
      name: "Diskon Kopi Senja 10%",
      discountType: "PERCENTAGE",
      discountValue: 10,
      targetType: "TENANT",
      targetId: "tenant-ks",
      scope: "FNB",
      minimumAmount: 20000,
      isActive: true,
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2026-12-31T23:59:59.000Z",
    },
    {
      id: "promo-expired",
      code: "EXPIRED20",
      name: "Promo Kadaluarsa 20%",
      discountType: "PERCENTAGE",
      discountValue: 20,
      targetType: "ALL",
      scope: "ALL",
      isActive: true,
      validFrom: "2025-01-01T00:00:00.000Z",
      validUntil: "2025-06-01T00:00:00.000Z", // Past date (Expired)
    },
    {
      id: "promo-cowork50",
      code: "COWORK50",
      name: "Diskon Coworking 50%",
      discountType: "PERCENTAGE",
      discountValue: 50,
      targetType: "ALL",
      scope: "COWORKING",
      isActive: true,
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2026-12-31T23:59:59.000Z",
    },
  ];

  describe("P0: Voucher Integrity & Validation", () => {
    it("harus menolak voucher yang sudah expired saat validasi", () => {
      const result = validateVoucherCode("EXPIRED20", mockPromos, 50000);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Expired");
    });

    it("harus menolak voucher yang sudah pernah digunakan oleh customer (single-use)", () => {
      const promoWithUsedBy: PromoConfig = {
        ...mockPromos[0],
        usedBy: ["cust-123"],
      };
      const result = validateVoucherCode("KS10", [promoWithUsedBy], 50000, {
        customerId: "cust-123",
      });
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("sudah pernah menggunakan");
    });

    it("harus menolak voucher jika minimum transaksi tidak terpenuhi", () => {
      const result = validateVoucherCode("KS10", mockPromos, 15000); // min is 20000
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("minimal transaksi");
    });

    it("harus menolak voucher coworking jika dipakai untuk fnb", () => {
      const result = validateVoucherCode("COWORK50", mockPromos, 50000, {
        scope: "FNB",
      });
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Co-Working");
    });

    it("harus berhasil menerapkan voucher yang valid dan aktif", () => {
      const result = validateVoucherCode("KS10", mockPromos, 50000, {
        scope: "FNB",
        tenantId: "tenant-ks",
      });
      expect(result.isValid).toBe(true);
      expect(result.discountAmount).toBe(5000); // 10% of 50000
    });
  });

  describe("P1: Order Lifecycle & History", () => {
    interface MockOrder {
      id: string;
      orderNumber: string;
      status: "NEW" | "CONFIRMED" | "KITCHEN_RECEIVED" | "COOKING" | "READY" | "SERVED" | "COMPLETED" | "CANCELLED";
      paymentStatus: "PENDING" | "PAID";
      total: number;
    }

    it("order yang dibatalkan tidak boleh dihapus dan harus masuk ke riwayat", () => {
      const orders: MockOrder[] = [
        { id: "ord-1", orderNumber: "ORD-001", status: "NEW", paymentStatus: "PENDING", total: 45000 },
        { id: "ord-2", orderNumber: "ORD-002", status: "COOKING", paymentStatus: "PAID", total: 30000 },
      ];

      // Simulasi pembatalan order 1
      const cancelledOrder: MockOrder = {
        ...orders[0],
        status: "CANCELLED",
      };
      const updatedOrders = [cancelledOrder, orders[1]];

      // Filter active vs past orders
      const activeOrders = updatedOrders.filter(
        (o) => o.status !== "SERVED" && o.status !== "COMPLETED" && o.status !== "CANCELLED"
      );
      const pastOrders = updatedOrders.filter(
        (o) => o.status === "SERVED" || o.status === "COMPLETED" || o.status === "CANCELLED"
      );

      expect(activeOrders.length).toBe(1);
      expect(activeOrders[0].id).toBe("ord-2");

      expect(pastOrders.length).toBe(1);
      expect(pastOrders[0].id).toBe("ord-1");
      expect(pastOrders[0].status).toBe("CANCELLED");
    });

    it("order yang selesai (SERVED / COMPLETED) harus masuk ke riwayat", () => {
      const orders: MockOrder[] = [
        { id: "ord-1", orderNumber: "ORD-001", status: "SERVED", paymentStatus: "PAID", total: 45000 },
        { id: "ord-2", orderNumber: "ORD-002", status: "COMPLETED", paymentStatus: "PAID", total: 60000 },
        { id: "ord-3", orderNumber: "ORD-003", status: "READY", paymentStatus: "PAID", total: 25000 },
      ];

      const pastOrders = orders.filter(
        (o) => o.status === "SERVED" || o.status === "COMPLETED" || o.status === "CANCELLED"
      );
      const activeOrders = orders.filter(
        (o) => o.status !== "SERVED" && o.status !== "COMPLETED" && o.status !== "CANCELLED"
      );

      expect(activeOrders.length).toBe(1);
      expect(activeOrders[0].id).toBe("ord-3");

      expect(pastOrders.length).toBe(2);
      expect(pastOrders.map((o) => o.id)).toEqual(["ord-1", "ord-2"]);
    });
  });

  describe("P1: Co-Working Time Parsing & Minute Accuracy", () => {
    function parseTimeToMinutes(timeStr: string): number {
      if (!timeStr) return 9 * 60;
      const match = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
      }
      return 9 * 60;
    }

    function formatMinutesToTime(totalMinutes: number): string {
      const norm = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
      const hours = Math.floor(norm / 60);
      const mins = norm % 60;
      return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
    }

    function calculateEndTime(startTime: string, durationHours: number): string {
      const startMins = parseTimeToMinutes(startTime);
      const endMins = startMins + durationHours * 60;
      return formatMinutesToTime(endMins);
    }

    function isOverlapping(
      startA: string,
      durA: number,
      startB: string,
      durB: number
    ): boolean {
      const aStart = parseTimeToMinutes(startA);
      const aEnd = aStart + durA * 60;
      const bStart = parseTimeToMinutes(startB);
      const bEnd = bStart + durB * 60;
      return aStart < bEnd && aEnd > bStart;
    }

    it("harus menghitung end time secara presisi termasuk menit (e.g. 10:30 + 2 jam = 12:30)", () => {
      expect(calculateEndTime("10:30", 2)).toBe("12:30");
      expect(calculateEndTime("09:15", 3)).toBe("12:15");
      expect(calculateEndTime("14:45", 1)).toBe("15:45");
    });

    it("harus mendeteksi bentrok slot waktu dengan benar secara presisi menit", () => {
      // Booking A: 10:30 s/d 12:30
      // Request B: 11:00 s/d 13:00 -> Bentrok
      expect(isOverlapping("10:30", 2, "11:00", 2)).toBe(true);

      // Request C: 12:30 s/d 14:30 -> Tidak bentrok (persis setelah A)
      expect(isOverlapping("10:30", 2, "12:30", 2)).toBe(false);

      // Request D: 08:30 s/d 10:30 -> Tidak bentrok (persis sebelum A)
      expect(isOverlapping("10:30", 2, "08:30", 2)).toBe(false);
    });
  });
});
