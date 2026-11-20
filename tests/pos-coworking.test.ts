import { describe, it, expect } from "vitest";
import {
  COWORKING_TIME_SLOTS,
  parseHour,
  calculateEndTime,
  getValidOperationalTime,
  checkSlotAvailability,
  spaceTypeLabel,
  formatCoworkingDuration,
  coworkingEmptyStateMessage,
} from "@/features/pos/pos-coworking";
import type { CoworkingSpaceItem, CoworkingBooking } from "@/types/coworking";

describe("pos-coworking logic", () => {
  it("defines standard operational time slots from 09:00 to 18:00", () => {
    expect(COWORKING_TIME_SLOTS[0]).toBe("09:00");
    expect(COWORKING_TIME_SLOTS[COWORKING_TIME_SLOTS.length - 1]).toBe("18:00");
  });

  it("parses hours from time strings reliably", () => {
    expect(parseHour("09:00")).toBe(9);
    expect(parseHour("14:30")).toBe(14);
    expect(parseHour("")).toBe(9);
  });

  it("calculates end time from start time and duration", () => {
    expect(calculateEndTime("09:00", 2)).toBe("11:00");
    expect(calculateEndTime("10:30", 3)).toBe("13:30");
    expect(calculateEndTime("17:00", 2)).toBe("19:00");
  });

  it("returns 09:00 for future dates in getValidOperationalTime", () => {
    expect(getValidOperationalTime("2099-01-01")).toBe("09:00");
  });

  describe("checkSlotAvailability", () => {
    const spaces: CoworkingSpaceItem[] = [
      {
        id: "space-1",
        name: "Private Office A",
        type: "MEETING_ROOM",
        capacity: 4,
        hourlyRate: 50000,
        dailyRate: 250000,
        status: "AVAILABLE",
        area: "Lantai 2",
        amenities: ["WiFi", "AC"],
      },
      {
        id: "space-desk",
        name: "Hot Desk Area",
        type: "HOT_DESK",
        capacity: 4,
        hourlyRate: 15000,
        dailyRate: 75000,
        status: "AVAILABLE",
        area: "Lantai 1",
        amenities: ["WiFi", "Stopkontak"],
      },
    ];

    it("allows booking an unreserved room", () => {
      const res = checkSlotAvailability({
        spaceId: "space-1",
        spaces,
        bookings: [],
        targetDate: "2026-11-12",
        startHour: 10,
        durationHours: 2,
      });
      expect(res.isAvailable).toBe(true);
    });

    it("detects conflict when a single-capacity room is already booked", () => {
      const bookings: CoworkingBooking[] = [
        {
          id: "b-1",
          bookingCode: "BK-01",
          spaceId: "space-1",
          spaceName: "Private Office A",
          spaceType: "MEETING_ROOM",
          bookingType: "HOURLY",
          guestName: "Alice",
          guestPhone: "0812345",
          guestEmail: "alice@test.com",
          date: "2026-11-12",
          startTime: "10:00",
          duration: 2,
          totalAmount: 100000,
          paymentStatus: "PAID",
          paymentMethod: "QRIS",
          checkInStatus: "RESERVED",
          createdAt: new Date().toISOString(),
          notes: "",
        },
      ];

      const overlap = checkSlotAvailability({
        spaceId: "space-1",
        spaces,
        bookings,
        targetDate: "2026-11-12",
        startHour: 11,
        durationHours: 2,
      });
      expect(overlap.isAvailable).toBe(false);
      expect(overlap.reason).toBe("Sudah dibooking");
    });

    it("allows multiple bookings up to capacity on HOT_DESK", () => {
      const bookings: CoworkingBooking[] = [
        {
          id: "b-1",
          bookingCode: "BK-01",
          spaceId: "space-desk",
          spaceName: "Hot Desk Area",
          spaceType: "HOT_DESK",
          bookingType: "HOURLY",
          guestName: "Alice",
          guestPhone: "0812345",
          guestEmail: "alice@test.com",
          date: "2026-11-12",
          startTime: "10:00",
          duration: 2,
          totalAmount: 30000,
          paymentStatus: "PAID",
          paymentMethod: "QRIS",
          checkInStatus: "RESERVED",
          createdAt: new Date().toISOString(),
          notes: "",
        },
      ];

      const res = checkSlotAvailability({
        spaceId: "space-desk",
        spaces,
        bookings,
        targetDate: "2026-11-12",
        startHour: 10,
        durationHours: 2,
      });
      expect(res.isAvailable).toBe(true);
    });
  });

  describe("spaceTypeLabel", () => {
    it("formats standard space types in sentence case", () => {
      expect(spaceTypeLabel("HOT_DESK")).toBe("Hot desk");
      expect(spaceTypeLabel("DEDICATED_DESK")).toBe("Dedicated desk");
      expect(spaceTypeLabel("MEETING_ROOM")).toBe("Meeting room");
      expect(spaceTypeLabel("PRIVATE_POD")).toBe("Private pod");
    });

    it("handles fallback and undefined gracefully", () => {
      expect(spaceTypeLabel("CUSTOM_ROOM")).toBe("Custom room");
      expect(spaceTypeLabel("")).toBe("—");
      expect(spaceTypeLabel(undefined as unknown as string)).toBe("—");
    });
  });

  describe("formatCoworkingDuration", () => {
    it("formats hourly durations and full day label", () => {
      expect(formatCoworkingDuration(1)).toBe("1 jam");
      expect(formatCoworkingDuration(2)).toBe("2 jam");
      expect(formatCoworkingDuration(4)).toBe("4 jam");
      expect(formatCoworkingDuration(8)).toBe("Seharian (8 jam)");
    });
  });

  describe("coworkingEmptyStateMessage", () => {
    it("returns filter-specific message when filtering or searching", () => {
      const msg = coworkingEmptyStateMessage(true);
      expect(msg.title).toBe("Ruang kerja tidak ditemukan");
      expect(msg.description).toContain("Ubah kata kunci");
    });

    it("returns general empty state message when no filters applied", () => {
      const msg = coworkingEmptyStateMessage(false);
      expect(msg.title).toBe("Belum ada ruang kerja");
      expect(msg.description).toContain("Ruang kerja aktif");
    });
  });
});
