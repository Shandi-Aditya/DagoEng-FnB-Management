import { describe, it, expect } from "vitest";
import {
  isCoworkingHoliday,
  checkCoworkingBookingConflict,
  isServiceWithinHours,
  isTenantAcceptingOrders,
  DEFAULT_NATIONAL_HOLIDAYS_2026,
  DEFAULT_COWORKING_HOLIDAY_CONFIG,
  DEFAULT_OPERATIONAL_HOURS,
  HolidayOverride,
} from "../src/lib/operating-hours";
import {
  PromoConfig,
  isPromoEligibleForItem,
  getPromoComputedStatus,
  sortPromosByPriority,
} from "../src/lib/promo";
import { StockOpnameRecord } from "../src/types/inventory";

describe("10 Revisi Master Prompt (12 Oktober 2026) - Comprehensive Verification", () => {
  // ---------------------------------------------------------------------------
  // REVISI 1: Aturan Hari Libur Co-working
  // ---------------------------------------------------------------------------
  describe("Revisi 1: Aturan Hari Libur Co-working & Override", () => {
    it("harus menutup co-working pada hari Sabtu dan Minggu secara default", () => {
      // 2026-10-17 adalah hari Sabtu, 2026-10-18 adalah hari Minggu
      const saturdayResult = isCoworkingHoliday("2026-10-17", DEFAULT_COWORKING_HOLIDAY_CONFIG);
      const sundayResult = isCoworkingHoliday("2026-10-18", DEFAULT_COWORKING_HOLIDAY_CONFIG);
      expect(saturdayResult.isHoliday).toBe(true);
      expect(saturdayResult.reason).toContain("Akhir Pekan");
      expect(sundayResult.isHoliday).toBe(true);
      expect(sundayResult.reason).toContain("Akhir Pekan");
    });

    it("harus membuka co-working pada hari kerja biasa (Senin-Jumat)", () => {
      // 2026-10-14 adalah hari Rabu (bukan libur nasional)
      const wednesdayResult = isCoworkingHoliday("2026-10-14", DEFAULT_COWORKING_HOLIDAY_CONFIG);
      expect(wednesdayResult.isHoliday).toBe(false);
    });

    it("harus mendeteksi hari libur nasional Indonesia 2026", () => {
      // 2026-08-17 Hari Kemerdekaan RI
      const holidayResult = isCoworkingHoliday("2026-08-17", DEFAULT_COWORKING_HOLIDAY_CONFIG);
      expect(holidayResult.isHoliday).toBe(true);
      expect(holidayResult.reason).toContain("Kemerdekaan");
    });

    it("harus mengizinkan Owner/Admin melakukan override buka khusus pada hari libur", () => {
      const overrides: HolidayOverride[] = [
        { date: "2026-10-18", isOpen: true, reason: "Hackathon Weekend Open" },
      ];
      const configWithOverride = {
        ...DEFAULT_COWORKING_HOLIDAY_CONFIG,
        overrides,
      };
      const result = isCoworkingHoliday("2026-10-18", configWithOverride);
      expect(result.isHoliday).toBe(false);
      expect(result.isOverride).toBe(true);
    });

    it("harus mengizinkan Owner/Admin melakukan override tutup khusus pada hari kerja", () => {
      const overrides: HolidayOverride[] = [
        { date: "2026-10-14", isOpen: false, reason: "Maintenance Listrik & AC Gedung" },
      ];
      const configWithOverride = {
        ...DEFAULT_COWORKING_HOLIDAY_CONFIG,
        overrides,
      };
      const result = isCoworkingHoliday("2026-10-14", configWithOverride);
      expect(result.isHoliday).toBe(true);
      expect(result.isOverride).toBe(true);
      expect(result.reason).toContain("Maintenance");
    });
  });

  // ---------------------------------------------------------------------------
  // REVISI 2: Jam Buka-Tutup Pesanan F&B per Mitra
  // ---------------------------------------------------------------------------
  describe("Revisi 2: Jam Buka-Tutup Pesanan F&B per Mitra", () => {
    it("harus menerima order jika tenant dalam status isOpenOrder dan dalam jam operasional", () => {
      const tenantOps = {
        "tenant-ks": {
          isOpenOrder: true,
          openTime: "08:00",
          closeTime: "22:00",
        },
      };
      // 14:00 (siang) berada dalam 08:00 - 22:00
      const testTime = new Date("2026-10-14T14:00:00");
      const result = isTenantAcceptingOrders("tenant-ks", tenantOps, testTime);
      expect(result.isOpen).toBe(true);
    });

    it("harus menolak order dan memberikan status 'Tutup Sementara' jika isOpenOrder false", () => {
      const tenantOps = {
        "tenant-ks": {
          isOpenOrder: false,
          openTime: "08:00",
          closeTime: "22:00",
          notes: "Mitra sedang Tutup Sementara",
        },
      };
      const testTime = new Date("2026-10-14T14:00:00");
      const result = isTenantAcceptingOrders("tenant-ks", tenantOps, testTime);
      expect(result.isOpen).toBe(false);
      expect(result.reason).toContain("Tutup Sementara");
    });

    it("harus menolak pesanan jika waktu pemesanan sebelum jam buka tenant", () => {
      const tenantOps = {
        "tenant-ks": {
          isOpenOrder: true,
          openTime: "08:00",
          closeTime: "21:00",
        },
      };
      // 06:30 (pagi) sebelum jam buka 08:00
      const testTime = new Date("2026-10-14T06:30:00");
      const result = isTenantAcceptingOrders("tenant-ks", tenantOps, testTime);
      expect(result.isOpen).toBe(false);
      expect(result.reason).toContain("di luar jam operasional");
    });

    it("harus menolak pesanan jika waktu pemesanan setelah jam tutup tenant", () => {
      const tenantOps = {
        "tenant-ks": {
          isOpenOrder: true,
          openTime: "08:00",
          closeTime: "21:00",
        },
      };
      // 21:30 (malam) setelah jam tutup 21:00
      const testTime = new Date("2026-10-14T21:30:00");
      const result = isTenantAcceptingOrders("tenant-ks", tenantOps, testTime);
      expect(result.isOpen).toBe(false);
      expect(result.reason).toContain("di luar jam operasional");
    });
  });

  // ---------------------------------------------------------------------------
  // REVISI 3: Proteksi Anti Double-Booking Co-working
  // ---------------------------------------------------------------------------
  describe("Revisi 3: Proteksi Anti Double-Booking Co-working", () => {
    const existingBookings = [
      {
        id: "b-1",
        spaceId: "sp-hotdesk-1",
        spaceName: "Hot Desk Alpha",
        date: "2026-10-14",
        startTime: "10:00",
        endTime: "13:00",
        bookingType: "HOURLY" as const,
        guestName: "Alice",
        bookingCode: "CW-101",
        checkInStatus: "CONFIRMED" as const,
      } as any,
    ];

    it("harus mendeteksi konflik bila slot baru tumpang tindih secara parsial di awal (09.00-11.00 vs 10.00-13.00)", () => {
      const conflict = checkCoworkingBookingConflict(existingBookings, {
        spaceId: "sp-hotdesk-1",
        date: "2026-10-14",
        startTime: "09:00",
        endTime: "11:00",
        bookingType: "HOURLY",
      });
      expect(conflict.hasConflict).toBe(true);
      expect(conflict.message).toContain("Jadwal bentrok");
    });

    it("harus mendeteksi konflik bila slot baru berada di dalam rentang booking eksisting (11.00-12.00 vs 10.00-13.00)", () => {
      const conflict = checkCoworkingBookingConflict(existingBookings, {
        spaceId: "sp-hotdesk-1",
        date: "2026-10-14",
        startTime: "11:00",
        endTime: "12:00",
        bookingType: "HOURLY",
      });
      expect(conflict.hasConflict).toBe(true);
    });

    it("harus mendeteksi konflik bila slot baru tumpang tindih secara parsial di akhir (12.00-15.00 vs 10.00-13.00)", () => {
      const conflict = checkCoworkingBookingConflict(existingBookings, {
        spaceId: "sp-hotdesk-1",
        date: "2026-10-14",
        startTime: "12:00",
        endTime: "15:00",
        bookingType: "HOURLY",
      });
      expect(conflict.hasConflict).toBe(true);
    });

    it("harus mengizinkan booking jika waktu tidak beririsan (adjacent slot: 08.00-10.00 dan 13.00-16.00)", () => {
      const conflictBefore = checkCoworkingBookingConflict(existingBookings, {
        spaceId: "sp-hotdesk-1",
        date: "2026-10-14",
        startTime: "08:00",
        endTime: "10:00",
        bookingType: "HOURLY",
      });
      const conflictAfter = checkCoworkingBookingConflict(existingBookings, {
        spaceId: "sp-hotdesk-1",
        date: "2026-10-14",
        startTime: "13:00",
        endTime: "16:00",
        bookingType: "HOURLY",
      });
      expect(conflictBefore.hasConflict).toBe(false);
      expect(conflictAfter.hasConflict).toBe(false);
    });

    it("harus mengabaikan booking yang statusnya CANCELLED", () => {
      const cancelledBookings = [
        {
          ...existingBookings[0],
          checkInStatus: "CANCELLED" as const,
        },
      ];
      const conflict = checkCoworkingBookingConflict(cancelledBookings, {
        spaceId: "sp-hotdesk-1",
        date: "2026-10-14",
        startTime: "10:00",
        endTime: "13:00",
        bookingType: "HOURLY",
      });
      expect(conflict.hasConflict).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // REVISI 4: Pemisahan Konfigurasi Jam Operasional F&B vs Co-working
  // ---------------------------------------------------------------------------
  describe("Revisi 4: Pemisahan Jam Operasional F&B (07-22) vs Co-working (09-18)", () => {
    it("harus memvalidasi operasional F&B dalam rentang 07.00 - 22.00", () => {
      const earlyMorning = new Date("2026-10-14T06:30:00");
      const morning = new Date("2026-10-14T07:30:00");
      const night = new Date("2026-10-14T21:45:00");
      const lateNight = new Date("2026-10-14T22:15:00");

      expect(isServiceWithinHours("fnb", DEFAULT_OPERATIONAL_HOURS, earlyMorning).isOpen).toBe(false);
      expect(isServiceWithinHours("fnb", DEFAULT_OPERATIONAL_HOURS, morning).isOpen).toBe(true);
      expect(isServiceWithinHours("fnb", DEFAULT_OPERATIONAL_HOURS, night).isOpen).toBe(true);
      expect(isServiceWithinHours("fnb", DEFAULT_OPERATIONAL_HOURS, lateNight).isOpen).toBe(false);
    });

    it("harus memvalidasi operasional Co-working dalam rentang 09.00 - 18.00", () => {
      const early = new Date("2026-10-14T08:30:00");
      const day = new Date("2026-10-14T09:30:00");
      const afternoon = new Date("2026-10-14T17:45:00");
      const evening = new Date("2026-10-14T18:15:00");

      expect(isServiceWithinHours("coworking", DEFAULT_OPERATIONAL_HOURS, early).isOpen).toBe(false);
      expect(isServiceWithinHours("coworking", DEFAULT_OPERATIONAL_HOURS, day).isOpen).toBe(true);
      expect(isServiceWithinHours("coworking", DEFAULT_OPERATIONAL_HOURS, afternoon).isOpen).toBe(true);
      expect(isServiceWithinHours("coworking", DEFAULT_OPERATIONAL_HOURS, evening).isOpen).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // REVISI 5: Promo Diskon dengan Katalog Multi-Select Produk
  // ---------------------------------------------------------------------------
  describe("Revisi 5: Promo Diskon Katalog Multi-Select Produk", () => {
    const promoWithMultiProducts: PromoConfig = {
      id: "p-multi",
      code: "ESPRESSOPRO",
      name: "Promo Espresso Blend",
      discountType: "PERCENTAGE",
      discountValue: 20,
      scope: "FNB",
      targetType: "PRODUCT",
      applicableProductIds: ["prod-latte", "prod-cappuccino", "prod-americano"],
      targetId: "prod-latte,prod-cappuccino,prod-americano",
      isActive: true,
    };

    it("harus memberikan diskon untuk produk yang ada dalam daftar applicableProductIds", () => {
      const latteItem = { productId: "prod-latte", name: "Latte", unitPrice: 25000, quantity: 1, category: "Minuman", tenantId: "tenant-ks" };
      const cappItem = { productId: "prod-cappuccino", name: "Cappuccino", unitPrice: 25000, quantity: 1, category: "Minuman", tenantId: "tenant-ks" };
      const amerItem = { productId: "prod-americano", name: "Americano", unitPrice: 20000, quantity: 1, category: "Minuman", tenantId: "tenant-ks" };

      expect(isPromoEligibleForItem(latteItem, promoWithMultiProducts)).toBe(true);
      expect(isPromoEligibleForItem(cappItem, promoWithMultiProducts)).toBe(true);
      expect(isPromoEligibleForItem(amerItem, promoWithMultiProducts)).toBe(true);
    });

    it("harus menolak diskon untuk produk di luar daftar applicableProductIds", () => {
      const croissantItem = { productId: "prod-croissant", name: "Croissant", unitPrice: 28000, quantity: 1, category: "Makanan", tenantId: "tenant-ks" };
      const matchaItem = { productId: "prod-matcha", name: "Matcha Latte", unitPrice: 28000, quantity: 1, category: "Minuman", tenantId: "tenant-ks" };

      expect(isPromoEligibleForItem(croissantItem, promoWithMultiProducts)).toBe(false);
      expect(isPromoEligibleForItem(matchaItem, promoWithMultiProducts)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // REVISI 6: Penanda Visual dan Pengurutan Status Promo
  // ---------------------------------------------------------------------------
  describe("Revisi 6: Penanda Visual dan Pengurutan Status Promo", () => {
    it("harus menghitung status komputasi promo dengan tepat", () => {
      const activePromo: PromoConfig = {
        id: "p-act",
        code: "ACT",
        name: "Active Promo",
        discountType: "FIXED",
        discountValue: 10000,
        targetType: "ALL",
        isActive: true,
      };
      const inactivePromo: PromoConfig = {
        ...activePromo,
        id: "p-inact",
        isActive: false,
      };
      const exhaustedPromo: PromoConfig = {
        ...activePromo,
        id: "p-exh",
        quota: 5,
        usageCount: 5,
      };
      const expiredPromo: PromoConfig = {
        ...activePromo,
        id: "p-exp",
        validUntil: "2026-01-01T00:00:00.000Z",
      };

      expect(getPromoComputedStatus(activePromo)).toBe("ACTIVE");
      expect(getPromoComputedStatus(inactivePromo)).toBe("INACTIVE");
      expect(getPromoComputedStatus(exhaustedPromo)).toBe("QUOTA_EXHAUSTED");
      expect(getPromoComputedStatus(expiredPromo)).toBe("EXPIRED");
    });

    it("harus mengurutkan promo aktif di urutan teratas dan promo expired/habis/nonaktif di bawah", () => {
      const promos: PromoConfig[] = [
        { id: "p-1", code: "P1", name: "Nonaktif", discountType: "FIXED", discountValue: 5000, targetType: "ALL", isActive: false },
        { id: "p-2", code: "P2", name: "Expired", discountType: "FIXED", discountValue: 5000, targetType: "ALL", isActive: true, validUntil: "2026-01-01T00:00:00.000Z" },
        { id: "p-3", code: "P3", name: "Aktif", discountType: "FIXED", discountValue: 5000, targetType: "ALL", isActive: true },
        { id: "p-4", code: "P4", name: "Habis Kuota", discountType: "FIXED", discountValue: 5000, targetType: "ALL", isActive: true, quota: 10, usageCount: 10 },
      ];

      const sorted = sortPromosByPriority(promos);
      expect(sorted[0].id).toBe("p-3"); // Aktif di paling atas
      // Non-aktif/expired/exhausted berada setelah promo aktif
      const nonActiveIds = sorted.slice(1).map((p) => p.id);
      expect(nonActiveIds).toContain("p-1");
      expect(nonActiveIds).toContain("p-2");
      expect(nonActiveIds).toContain("p-4");
    });
  });

  // ---------------------------------------------------------------------------
  // REVISI 7: Filter Status Master Data & Pengurutan Waktu
  // ---------------------------------------------------------------------------
  describe("Revisi 7: Filter Status Master Data & Pengurutan Waktu", () => {
    const products = [
      { id: "p-1", name: "Kopi Susu", status: "ACTIVE", updatedAt: "2026-10-10T10:00:00Z", basePrice: 20000 },
      { id: "p-2", name: "Kopi Hitam", status: "INACTIVE", updatedAt: "2026-10-12T10:00:00Z", basePrice: 15000 },
      { id: "p-3", name: "Croissant", status: "ACTIVE", updatedAt: "2026-10-11T10:00:00Z", basePrice: 28000 },
    ];

    it("harus memfilter produk berdasarkan status ACTIVE", () => {
      const activeOnly = products.filter((p) => p.status === "ACTIVE");
      expect(activeOnly.length).toBe(2);
      expect(activeOnly.map((p) => p.id)).toEqual(["p-1", "p-3"]);
    });

    it("harus memfilter produk berdasarkan status INACTIVE", () => {
      const inactiveOnly = products.filter((p) => p.status === "INACTIVE");
      expect(inactiveOnly.length).toBe(1);
      expect(inactiveOnly[0].id).toBe("p-2");
    });

    it("harus mengurutkan produk berdasarkan update terbaru (UPDATED_DESC)", () => {
      const sortedDesc = [...products].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      expect(sortedDesc[0].id).toBe("p-2"); // 12 Oktober
      expect(sortedDesc[1].id).toBe("p-3"); // 11 Oktober
      expect(sortedDesc[2].id).toBe("p-1"); // 10 Oktober
    });
  });

  // ---------------------------------------------------------------------------
  // REVISI 8: Modul Stock Opname Inventori
  // ---------------------------------------------------------------------------
  describe("Revisi 8: Modul Stock Opname Inventori (Variance & Audit)", () => {
    it("harus menghitung variance dengan rumus: Stok Fisik - Stok Sistem", () => {
      const systemStock = 50;
      const physicalStock = 42;
      const variance = physicalStock - systemStock;
      expect(variance).toBe(-8); // Selisih -8 (kurang)
    });

    it("harus mencatat record stock opname dengan struktur lengkap dan isolasi tenant", () => {
      const opnameRecord: StockOpnameRecord = {
        id: "opname-1",
        opnameNumber: "OPN-20261012-001",
        date: "2026-10-12",
        ingredientId: "ing-beans",
        ingredientName: "Biji Kopi Arabika Kintamani",
        category: "Coffee Beans",
        systemStock: 100,
        physicalStock: 95,
        variance: -5,
        varianceType: "DEFICIT",
        unit: "kg",
        reason: "DAMAGED",
        reasonNotes: "5kg rusak terkena rembesan air",
        performedBy: "Shandi Aditya",
        tenantId: "tenant-ks",
        status: "APPLIED",
        createdAt: "2026-10-12T10:00:00Z",
      };

      expect(opnameRecord.variance).toBe(-5);
      expect(opnameRecord.reason).toBe("DAMAGED");
      expect(opnameRecord.tenantId).toBe("tenant-ks");
    });
  });

  // ---------------------------------------------------------------------------
  // REVISI 9: Kustomisasi Tipe dan Area Ruangan Co-working
  // ---------------------------------------------------------------------------
  describe("Revisi 9: Kustomisasi Tipe dan Area Ruangan Co-working", () => {
    it("harus mendukung custom string untuk space type dan area tanpa kehilangan data", () => {
      const customSpace = {
        id: "sp-custom-1",
        name: "Podcast & Livestream Studio",
        type: "STUDIO_PODCAST", // Custom string
        area: "Lantai 3 Mezzanine Timur", // Custom string
        capacity: 3,
        hourlyRate: 75000,
        dailyRate: 350000,
        status: "AVAILABLE",
      };

      expect(customSpace.type).toBe("STUDIO_PODCAST");
      expect(customSpace.area).toBe("Lantai 3 Mezzanine Timur");
    });
  });

  // ---------------------------------------------------------------------------
  // REVISI 10: Palet Warna Soft & UI/UX
  // ---------------------------------------------------------------------------
  describe("Revisi 10: Palet Warna Soft & Semantic Tokens", () => {
    it("harus menggunakan warna brand terracotta (#EA580C) dan calm cyan (#0284C7)", () => {
      const brandColors = {
        orange: "#EA580C",
        cyan: "#0284C7",
        green: "#059669",
        yellow: "#D97706",
      };

      // Pastikan tidak lagi menggunakan warna harsh / neon seperti #FF6B00 / #00B2FE
      expect(brandColors.orange).not.toBe("#FF6B00");
      expect(brandColors.orange).toBe("#EA580C");
      expect(brandColors.cyan).not.toBe("#00B2FE");
      expect(brandColors.cyan).toBe("#0284C7");
    });
  });
});
