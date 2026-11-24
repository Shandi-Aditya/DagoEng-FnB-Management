import { describe, expect, it } from "vitest";

import { isRangeFree, slotAvailability } from "@/features/customer/space-slots";
import type { CoworkingBooking } from "@/types/coworking";

const booking = (spaceId: string, startTime: string, endTime: string, extra: Partial<CoworkingBooking> = {}) =>
  ({ id: `${spaceId}-${startTime}`, spaceId, date: "2026-11-20", bookingType: "HOURLY", startTime, endTime, checkInStatus: "BOOKED", ...extra }) as CoworkingBooking;

describe("slotAvailability", () => {
  it("marks the hours an existing booking covers as taken, for that space only", () => {
    const bookings = [booking("pod-1", "10:00 WITA", "12:00 WITA"), booking("pod-2", "09:00 WITA", "10:00 WITA")];

    const slots = slotAvailability(
      bookings,
      "pod-1",
      "2026-11-20",
      ["09:00", "10:00", "11:00", "12:00"],
      1,
      { checkPast: false }
    );

    expect(slots).toEqual([
      { time: "09:00", isTaken: false, remainingSeats: 1, maxCapacity: 1, isPast: false, label: "1/1 tersisa" },
      { time: "10:00", isTaken: true, remainingSeats: 0, maxCapacity: 1, isPast: false, label: "Penuh" },
      { time: "11:00", isTaken: true, remainingSeats: 0, maxCapacity: 1, isPast: false, label: "Penuh" },
      { time: "12:00", isTaken: false, remainingSeats: 1, maxCapacity: 1, isPast: false, label: "1/1 tersisa" },
    ]);
  });

  it("ignores cancelled bookings and other dates", () => {
    const bookings = [
      booking("pod-1", "10:00 WITA", "11:00 WITA", { checkInStatus: "CANCELLED" }),
      booking("pod-1", "10:00 WITA", "11:00 WITA", { date: "2026-11-21" }),
    ];

    expect(
      slotAvailability(bookings, "pod-1", "2026-11-20", ["10:00"], 1, { checkPast: false })
    ).toEqual([
      { time: "10:00", isTaken: false, remainingSeats: 1, maxCapacity: 1, isPast: false, label: "1/1 tersisa" },
    ]);
  });

  it("calculates multi-seat capacity correctly for Hot Desk (e.g. 5/8 tersisa)", () => {
    const bookings = [
      booking("hot-1", "10:00 WITA", "11:00 WITA", { id: "b1" }),
      booking("hot-1", "10:00 WITA", "11:00 WITA", { id: "b2" }),
      booking("hot-1", "10:00 WITA", "11:00 WITA", { id: "b3" }),
    ];

    const slots = slotAvailability(
      bookings,
      "hot-1",
      "2026-11-20",
      ["10:00"],
      8,
      { checkPast: false }
    );

    expect(slots).toEqual([
      { time: "10:00", isTaken: false, remainingSeats: 5, maxCapacity: 8, isPast: false, label: "5/8 tersisa" },
    ]);
  });

  it("labels past slots as 'Lewat' on past dates or earlier hours", () => {
    const bookings: CoworkingBooking[] = [];
    const mockNow = new Date("2026-11-23T05:00:00.000Z"); // 13:00 WITA

    const slots = slotAvailability(
      bookings,
      "hot-1",
      "2026-11-23",
      ["09:00", "12:00", "13:00", "14:00"],
      8,
      { now: mockNow, checkPast: true }
    );

    expect(slots).toEqual([
      { time: "09:00", isTaken: true, remainingSeats: 8, maxCapacity: 8, isPast: true, label: "Lewat" },
      { time: "12:00", isTaken: true, remainingSeats: 8, maxCapacity: 8, isPast: true, label: "Lewat" },
      { time: "13:00", isTaken: false, remainingSeats: 8, maxCapacity: 8, isPast: false, label: "8/8 tersisa" },
      { time: "14:00", isTaken: false, remainingSeats: 8, maxCapacity: 8, isPast: false, label: "8/8 tersisa" },
    ]);
  });
});

describe("isRangeFree", () => {
  it("rejects a range that runs into a later booking", () => {
    const bookings = [booking("pod-1", "11:00 WITA", "12:00 WITA")];

    expect(isRangeFree(bookings, "pod-1", "2026-11-20", "09:00", 2)).toBe(true);
    expect(isRangeFree(bookings, "pod-1", "2026-11-20", "10:00", 2)).toBe(false);
  });
});
