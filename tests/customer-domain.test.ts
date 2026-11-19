import { describe, it, expect } from "vitest";
import {
  customerOrderStatusLabel,
  customerOrderStatusTone,
  spaceTypeLabel,
  bookingStatusLabel,
  bookingStatusTone,
  calculateCartTotals,
  filterCustomerProducts,
  getAvailableTimeSlots,
  calculateEndTime,
  type CustomerCartItem,
} from "@/features/customer/customer-domain";
import type { MasterProduct } from "@/types/product";
import type { PromoConfig } from "@/lib/promo";

describe("customer-domain", () => {
  const mockProducts: MasterProduct[] = [
    {
      id: "prd-ks-1",
      name: "Kopi Susu Gula Aren",
      category: "Minuman",
      basePrice: 20000,
      cogsEstimate: 8000,
      grossMarginPercent: "60%",
      status: "ACTIVE",
      outletId: "ALL",
      outletName: "Semua Outlet",
      isAvailable: true,
      tenantId: "tenant-ks",
      createdAt: "2026-11-01T08:00:00Z",
      updatedAt: "2026-11-01T08:00:00Z",
    },
    {
      id: "prd-ks-2",
      name: "Americano Dingin",
      category: "Minuman",
      basePrice: 18000,
      cogsEstimate: 5000,
      grossMarginPercent: "72%",
      status: "ACTIVE",
      outletId: "ALL",
      outletName: "Semua Outlet",
      isAvailable: true,
      tenantId: "tenant-ks",
      createdAt: "2026-11-01T08:00:00Z",
      updatedAt: "2026-11-01T08:00:00Z",
    },
    {
      id: "prd-dm-1",
      name: "Nasi Goreng Spesial",
      category: "Makanan",
      basePrice: 35000,
      cogsEstimate: 15000,
      grossMarginPercent: "57%",
      status: "ACTIVE",
      outletId: "ALL",
      outletName: "Semua Outlet",
      isAvailable: true,
      tenantId: "tenant-kitchen",
      createdAt: "2026-11-01T08:00:00Z",
      updatedAt: "2026-11-01T08:00:00Z",
    },
  ];

  describe("Status labels and semantic tones", () => {
    it("maps order status to customer-friendly Indonesian sentence case labels", () => {
      expect(customerOrderStatusLabel("NEW")).toBe("Menunggu konfirmasi");
      expect(customerOrderStatusLabel("CONFIRMED")).toBe("Diterima kasir");
      expect(customerOrderStatusLabel("KITCHEN_RECEIVED")).toBe("Diterima dapur");
      expect(customerOrderStatusLabel("COOKING")).toBe("Sedang dimasak");
      expect(customerOrderStatusLabel("READY")).toBe("Siap diambil");
      expect(customerOrderStatusLabel("SERVED")).toBe("Sudah disajikan");
      expect(customerOrderStatusLabel("COMPLETED")).toBe("Selesai");
      expect(customerOrderStatusLabel("CANCELLED")).toBe("Dibatalkan");
    });

    it("maps order status to appropriate status badge tones", () => {
      expect(customerOrderStatusTone("NEW")).toBe("warning");
      expect(customerOrderStatusTone("COOKING")).toBe("info");
      expect(customerOrderStatusTone("READY")).toBe("success");
      expect(customerOrderStatusTone("CANCELLED")).toBe("destructive");
      expect(customerOrderStatusTone("COMPLETED")).toBe("neutral");
    });

    it("maps space types to friendly Indonesian terms", () => {
      expect(spaceTypeLabel("HOT_DESK")).toBe("Hot desk");
      expect(spaceTypeLabel("DEDICATED_DESK")).toBe("Dedicated desk");
      expect(spaceTypeLabel("MEETING_ROOM")).toBe("Ruang rapat");
      expect(spaceTypeLabel("PRIVATE_OFFICE")).toBe("Kantor privat");
    });

    it("maps booking statuses to friendly labels and tones", () => {
      expect(bookingStatusLabel("CONFIRMED")).toBe("Terkonfirmasi");
      expect(bookingStatusLabel("CHECKED_IN")).toBe("Sedang digunakan");
      expect(bookingStatusLabel("COMPLETED")).toBe("Selesai");
      expect(bookingStatusLabel("CANCELLED")).toBe("Dibatalkan");
      expect(bookingStatusTone("CONFIRMED")).toBe("success");
      expect(bookingStatusTone("CANCELLED")).toBe("destructive");
    });
  });

  describe("filterCustomerProducts", () => {
    it("filters products by active partner, category, and search query without mutation", () => {
      const original = [...mockProducts];

      const ksDrinks = filterCustomerProducts(mockProducts, {
        partnerId: "tenant-ks",
        category: "Minuman",
      });
      expect(ksDrinks).toHaveLength(2);
      expect(ksDrinks.every((p) => p.tenantId === "tenant-ks")).toBe(true);

      const searched = filterCustomerProducts(mockProducts, {
        searchQuery: "nasi",
      });
      expect(searched).toHaveLength(1);
      expect(searched[0].id).toBe("prd-dm-1");

      // Verify immutability
      expect(mockProducts).toEqual(original);
    });
  });

  describe("calculateCartTotals", () => {
    const cartItems: CustomerCartItem[] = [
      { product: mockProducts[0], quantity: 2 }, // 2 * 20.000 = 40.000
      { product: mockProducts[2], quantity: 1 }, // 1 * 35.000 = 35.000
    ]; // Subtotal = 75.000

    it("computes subtotal, tax, service charge, and total without promo", () => {
      const result = calculateCartTotals(cartItems, {
        activePromo: null,
        taxRatePercent: 10,
        serviceChargePercent: 5,
        isDineIn: true,
      });

      expect(result.subtotal).toBe(75000);
      expect(result.discountAmount).toBe(0);
      expect(result.serviceChargeAmount).toBe(3750); // 5% of 75.000
      expect(result.taxAmount).toBe(7500); // 10% of 75.000
      expect(result.finalTotal).toBe(75000 + 3750 + 7500);
    });

    it("applies percentage discount voucher capped by maxDiscount", () => {
      const promo: PromoConfig = {
        id: "prm-1",
        code: "HEMAT20",
        name: "Diskon 20%",
        discountType: "PERCENTAGE",
        discountValue: 20,
        maxDiscount: 10000,
        targetType: "ALL",
        isActive: true,
      };

      const result = calculateCartTotals(cartItems, {
        activePromo: promo,
        taxRatePercent: 0,
        serviceChargePercent: 0,
        isDineIn: false,
      });

      // 20% of 75.000 = 15.000, but capped at 10.000
      expect(result.discountAmount).toBe(10000);
      expect(result.finalTotal).toBe(65000);
    });

    it("applies fixed discount voucher", () => {
      const promo: PromoConfig = {
        id: "prm-2",
        code: "POTONGAN15",
        name: "Potongan Rp 15.000",
        discountType: "FIXED",
        discountValue: 15000,
        targetType: "ALL",
        isActive: true,
      };

      const result = calculateCartTotals(cartItems, {
        activePromo: promo,
        taxRatePercent: 0,
        serviceChargePercent: 0,
        isDineIn: false,
      });

      expect(result.discountAmount).toBe(15000);
      expect(result.finalTotal).toBe(60000);
    });
  });

  describe("Time slot helpers for coworking", () => {
    it("provides standard start slots from 09:00 through 17:00 so 1-hour bookings finish by 18:00 WITA", () => {
      const slots = getAvailableTimeSlots();
      expect(slots[0]).toBe("09:00");
      expect(slots[slots.length - 1]).toBe("17:00");
      expect(slots).not.toContain("18:00");
    });

    it("calculates booking end time accurately", () => {
      expect(calculateEndTime("09:00", 2)).toBe("11:00");
      expect(calculateEndTime("09:00", 9)).toBe("18:00");
      expect(calculateEndTime("14:30", 3)).toBe("17:30");
    });
  });
});
