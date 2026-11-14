import { describe, it, expect } from "vitest";
import {
  calculateTenantReceiptGroups,
  formatReceiptLoyaltyPoints,
  formatReceiptPaymentStatus,
  formatReceiptOrderType,
  formatReceiptServiceChargeLabel,
  formatKitchenTicketPurpose,
} from "@/features/pos/pos-receipt";
import type { POSReceiptItem } from "@/features/pos/types";

describe("pos-receipt domain logic", () => {
  describe("calculateTenantReceiptGroups", () => {
    it("groups items by tenant correctly and calculates subtotal without mutating input", () => {
      const items: readonly POSReceiptItem[] = [
        {
          id: "item-1",
          productId: "prod-1",
          name: "Kopi Senja Aren",
          price: 20000,
          quantity: 2,
          subtotal: 40000,
          tenantId: "tenant-ks",
          tenantName: "Kopi Senja",
        },
        {
          id: "item-2",
          productId: "prod-2",
          name: "Roti Bakar",
          price: 15000,
          quantity: 1,
          subtotal: 15000,
          tenantId: "tenant-roti",
          tenantName: "Roti Sedap",
        },
        {
          id: "item-3",
          productId: "prod-3",
          name: "Americano",
          price: 18000,
          quantity: 1,
          subtotal: 18000,
          tenantId: "tenant-ks",
          tenantName: "Kopi Senja",
        },
      ];

      const groups = calculateTenantReceiptGroups(items);

      expect(groups).toHaveLength(2);

      const ksGroup = groups.find((g) => g.tenantId === "tenant-ks");
      expect(ksGroup).toBeDefined();
      expect(ksGroup?.tenantName).toBe("Kopi Senja");
      expect(ksGroup?.items).toHaveLength(2);
      expect(ksGroup?.subtotal).toBe(58000);

      const rotiGroup = groups.find((g) => g.tenantId === "tenant-roti");
      expect(rotiGroup).toBeDefined();
      expect(rotiGroup?.tenantName).toBe("Roti Sedap");
      expect(rotiGroup?.items).toHaveLength(1);
      expect(rotiGroup?.subtotal).toBe(15000);

      // Verify input array not mutated
      expect(items).toHaveLength(3);
    });

    it("handles empty items array gracefully", () => {
      const groups = calculateTenantReceiptGroups([]);
      expect(groups).toEqual([]);
    });

    it("falls back to default tenant name when tenant info is omitted", () => {
      const items: readonly POSReceiptItem[] = [
        {
          id: "item-x",
          productId: "prod-x",
          name: "Menu Bebas",
          price: 10000,
          quantity: 1,
          subtotal: 10000,
        },
      ];

      const groups = calculateTenantReceiptGroups(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].tenantId).toBe("tenant-ks");
      expect(groups[0].tenantName).toBe("Kopi Senja");
    });
  });

  describe("formatReceiptLoyaltyPoints", () => {
    it("formats point values with Indonesian glosarium 'poin'", () => {
      expect(formatReceiptLoyaltyPoints(0)).toBe("0 poin");
      expect(formatReceiptLoyaltyPoints(50)).toBe("50 poin");
      expect(formatReceiptLoyaltyPoints(120)).toBe("120 poin");
    });
  });

  describe("formatReceiptPaymentStatus", () => {
    it("translates payment status enums into sentence case Indonesian", () => {
      expect(formatReceiptPaymentStatus("PAID")).toBe("Lunas");
      expect(formatReceiptPaymentStatus("REFUNDED")).toBe("Dikembalikan");
      expect(formatReceiptPaymentStatus("CANCELLED")).toBe("Dibatalkan");
      expect(formatReceiptPaymentStatus("PENDING")).toBe("Menunggu pembayaran");
      expect(formatReceiptPaymentStatus("UNKNOWN")).toBe("UNKNOWN");
    });
  });

  describe("formatReceiptOrderType", () => {
    it("formats order type into sentence case with Dine in / Takeaway / Delivery", () => {
      expect(formatReceiptOrderType("DINE_IN")).toBe("Dine in");
      expect(formatReceiptOrderType("TAKEAWAY")).toBe("Takeaway");
      expect(formatReceiptOrderType("DELIVERY")).toBe("Delivery");
      expect(formatReceiptOrderType(undefined)).toBe("Dine in");
    });
  });

  describe("formatReceiptServiceChargeLabel", () => {
    it("formats service charge label with percentage when available", () => {
      expect(formatReceiptServiceChargeLabel(5)).toBe("Biaya layanan (5%)");
      expect(formatReceiptServiceChargeLabel(10)).toBe("Biaya layanan (10%)");
      expect(formatReceiptServiceChargeLabel(0)).toBe("Biaya layanan");
      expect(formatReceiptServiceChargeLabel(undefined)).toBe("Biaya layanan");
    });
  });

  describe("formatKitchenTicketPurpose", () => {
    it("returns correct sentence case labels and tones for kitchen purposes", () => {
      expect(formatKitchenTicketPurpose("NEW_ORDER")).toEqual({
        title: "Nota pesanan dapur",
        tone: "neutral",
      });
      expect(formatKitchenTicketPurpose("ADDITIONAL_ORDER", 2)).toEqual({
        title: "Pesanan tambahan #2",
        tone: "warning",
      });
      expect(formatKitchenTicketPurpose("REPRINT")).toEqual({
        title: "Salinan (reprint)",
        tone: "info",
      });
      expect(formatKitchenTicketPurpose("CANCELLATION")).toEqual({
        title: "Pembatalan pesanan",
        tone: "destructive",
      });
    });
  });
});
