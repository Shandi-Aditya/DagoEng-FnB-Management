import fs from "fs";
import path from "path";
import os from "os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  checkSlotAvailability,
  isSlotPast,
} from "@/features/pos/pos-coworking";
import { slotAvailability } from "@/features/customer/space-slots";
import { checkCoworkingBookingConflict } from "@/lib/operating-hours";
import { saveCoworkingBooking } from "@/lib/persistent-storage";
import type { CoworkingBooking, CoworkingSpaceItem } from "@/types/coworking";

const hotDeskSpace: CoworkingSpaceItem = {
  id: "sp-hot-test",
  name: "Hot Desk Flex #01 - #08",
  type: "HOT_DESK",
  area: "Ground Floor Main",
  capacity: 8,
  hourlyRate: 15000,
  dailyRate: 65000,
  status: "AVAILABLE",
  amenities: ["WiFi", "Power Outlet"],
  description: "Hot desk komunal",
  imageUrl: "",
};

const dedicatedDeskSpace: CoworkingSpaceItem = {
  id: "sp-ded-test",
  name: "Dedicated Desk D-01",
  type: "DEDICATED_DESK",
  area: "Mezzanine Quiet Zone",
  capacity: 1,
  hourlyRate: 25000,
  dailyRate: 120000,
  status: "AVAILABLE",
  amenities: ["Ergonomic Chair", "Dual Monitor"],
  description: "Dedicated desk personal",
  imageUrl: "",
};

function createMockBooking(
  spaceId: string,
  start: string,
  end: string,
  extra: Partial<CoworkingBooking> = {}
): CoworkingBooking {
  return {
    id: `bk-${Math.random().toString(36).slice(2, 8)}`,
    bookingCode: `CWK-${Math.floor(1000 + Math.random() * 9000)}`,
    spaceId,
    spaceName: "Test Space",
    spaceType: "HOT_DESK",
    guestName: "Budi Santoso",
    guestPhone: "08123456789",
    guestEmail: extra.guestEmail ?? "budi.s35@example.com",
    date: "2026-12-01",
    bookingType: "HOURLY",
    startTime: start,
    endTime: end,
    duration: 1,
    price: 15000,
    totalAmount: 15000,
    paymentStatus: "PAID",
    checkInStatus: "CHECKED_IN",
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

describe("S-35: Coworking Quota Display and Overbooking Prevention", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "s35-coworking-"));
    process.env.DATA_DIR_OVERRIDE = tempDir;
  });

  afterEach(() => {
    delete process.env.DATA_DIR_OVERRIDE;
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });
  describe("1. Remaining Seats Calculation", () => {
    it("displays correct remaining seats for Hot Desk (e.g. 5/8 tersisa when 3 booked)", () => {
      const bookings: CoworkingBooking[] = [
        createMockBooking("sp-hot-test", "10:00", "11:00"),
        createMockBooking("sp-hot-test", "10:00", "11:00"),
        createMockBooking("sp-hot-test", "10:00", "11:00"),
      ];

      const result = checkSlotAvailability({
        spaceId: "sp-hot-test",
        spaces: [hotDeskSpace],
        bookings,
        targetDate: "2026-12-01",
        startHour: 10,
        durationHours: 1,
      });

      expect(result.isAvailable).toBe(true);
      expect(result.remainingSeats).toBe(5);
      expect(result.maxCapacity).toBe(8);
      expect(result.label).toBe("5/8 tersisa");
    });

    it("displays Dedicated Desk as 1/1 tersisa when free and Penuh when occupied", () => {
      const freeResult = checkSlotAvailability({
        spaceId: "sp-ded-test",
        spaces: [dedicatedDeskSpace],
        bookings: [],
        targetDate: "2026-12-01",
        startHour: 10,
        durationHours: 1,
      });

      expect(freeResult.isAvailable).toBe(true);
      expect(freeResult.remainingSeats).toBe(1);
      expect(freeResult.label).toBe("1/1 tersisa");

      const occupiedBookings = [createMockBooking("sp-ded-test", "10:00", "11:00")];
      const occupiedResult = checkSlotAvailability({
        spaceId: "sp-ded-test",
        spaces: [dedicatedDeskSpace],
        bookings: occupiedBookings,
        targetDate: "2026-12-01",
        startHour: 10,
        durationHours: 1,
      });

      expect(occupiedResult.isAvailable).toBe(false);
      expect(occupiedResult.remainingSeats).toBe(0);
      expect(occupiedResult.label).toBe("Penuh");
    });
  });

  describe("2. Past Slot Labeling ('Lewat' vs 'Terisi'/'Penuh')", () => {
    it("labels slots that have already passed as 'Lewat', not 'Terisi'", () => {
      const mockNow = new Date("2026-11-23T06:00:00.000Z"); // 14:00 WITA

      expect(isSlotPast("2026-11-23", "09:00", mockNow)).toBe(true);
      expect(isSlotPast("2026-11-23", "13:00", mockNow)).toBe(true);
      expect(isSlotPast("2026-11-23", "14:00", mockNow)).toBe(false);
      expect(isSlotPast("2026-11-23", "15:00", mockNow)).toBe(false);
      expect(isSlotPast("2026-11-22", "15:00", mockNow)).toBe(true); // yesterday
      expect(isSlotPast("2026-11-24", "09:00", mockNow)).toBe(false); // tomorrow
    });

    it("marks empty past slot as unavailable with label 'Lewat'", () => {
      const result = checkSlotAvailability({
        spaceId: "sp-hot-test",
        spaces: [hotDeskSpace],
        bookings: [],
        targetDate: "2026-11-20", // Past date
        startHour: 9,
        durationHours: 1,
        checkPast: true,
      });

      expect(result.isAvailable).toBe(false);
      expect(result.isPast).toBe(true);
      expect(result.label).toBe("Lewat");
      expect(result.reason).toBe("Slot sudah lewat");
    });
  });

  describe("3. Cashier and Customer Consistency", () => {
    it("ensures Cashier and Customer views show identical remaining quota and labels", () => {
      const bookings: CoworkingBooking[] = [
        createMockBooking("sp-hot-test", "11:00", "12:00", { date: "2026-12-05" }),
        createMockBooking("sp-hot-test", "11:00", "12:00", { date: "2026-12-05" }),
      ];

      // Cashier calculation
      const cashierResult = checkSlotAvailability({
        spaceId: "sp-hot-test",
        spaces: [hotDeskSpace],
        bookings,
        targetDate: "2026-12-05",
        startHour: 11,
        durationHours: 1,
      });

      // Customer calculation
      const customerSlots = slotAvailability(
        bookings,
        "sp-hot-test",
        "2026-12-05",
        ["11:00"],
        8,
        { checkPast: false }
      );

      expect(cashierResult.remainingSeats).toBe(6);
      expect(customerSlots[0].remainingSeats).toBe(6);
      expect(cashierResult.maxCapacity).toBe(8);
      expect(customerSlots[0].maxCapacity).toBe(8);
      expect(cashierResult.label).toBe("6/8 tersisa");
      expect(customerSlots[0].label).toBe("6/8 tersisa");
      expect(cashierResult.isAvailable).toBe(!customerSlots[0].isTaken);
    });
  });

  describe("4. Overbooking Prevention", () => {
    it("rejects booking when capacity is full in checkCoworkingBookingConflict", () => {
      const bookings: CoworkingBooking[] = Array.from({ length: 8 }, (_, i) =>
        createMockBooking("sp-hot-test", "10:00", "11:00", { id: `bk-${i}` })
      );

      const conflictCheck = checkCoworkingBookingConflict(bookings, {
        spaceId: "sp-hot-test",
        spaceName: "Hot Desk Flex #01 - #08",
        bookingType: "HOURLY",
        date: "2026-12-01",
        startTime: "10:00",
        endTime: "11:00",
        maxCapacity: 8,
      });

      expect(conflictCheck.hasConflict).toBe(true);
      expect(conflictCheck.message).toContain("Kapasitas slot tidak mencukupi");
      expect(conflictCheck.message).toContain("tersisa 0 kursi");
    });

    it("allows booking when capacity is still available (e.g. 7 of 8 booked)", () => {
      const bookings: CoworkingBooking[] = Array.from({ length: 7 }, (_, i) =>
        createMockBooking("sp-hot-test", "10:00", "11:00", { id: `bk-${i}` })
      );

      const conflictCheck = checkCoworkingBookingConflict(bookings, {
        spaceId: "sp-hot-test",
        spaceName: "Hot Desk Flex #01 - #08",
        bookingType: "HOURLY",
        date: "2026-12-01",
        startTime: "10:00",
        endTime: "11:00",
        maxCapacity: 8,
      });

      expect(conflictCheck.hasConflict).toBe(false);
    });

    it("rejects overbooking atomically in parallel saveCoworkingBooking", async () => {
      const uniqueSpaceId = `sp-test-atomic-${Date.now()}`;
      const targetDate = "2026-12-15";

      // Book capacity 1 space with two parallel bookings
      const booking1 = createMockBooking(uniqueSpaceId, "14:00", "15:00", {
        id: `bk-atomic-1-${Date.now()}`,
        date: targetDate,
      });

      const booking2 = createMockBooking(uniqueSpaceId, "14:00", "15:00", {
        id: `bk-atomic-2-${Date.now()}`,
        date: targetDate,
      });

      const results = await Promise.allSettled([
        saveCoworkingBooking(booking1, { maxCapacity: 1, spaceName: "Atomic Space" }),
        saveCoworkingBooking(booking2, { maxCapacity: 1, spaceName: "Atomic Space" }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      if (rejected[0].status === "rejected") {
        expect((rejected[0].reason as any).code).toBe("OVERBOOKING_CONFLICT");
      }
    });
  });
});
