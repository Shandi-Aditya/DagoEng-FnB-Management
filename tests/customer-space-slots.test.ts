import { describe, expect, it } from "vitest";

import { isRangeFree, slotAvailability } from "@/features/customer/space-slots";
import type { CoworkingBooking } from "@/types/coworking";

const booking = (spaceId: string, startTime: string, endTime: string, extra: Partial<CoworkingBooking> = {}) =>
  ({ id: `${spaceId}-${startTime}`, spaceId, date: "2026-11-20", bookingType: "HOURLY", startTime, endTime, checkInStatus: "BOOKED", ...extra }) as CoworkingBooking;

describe("slotAvailability", () => {
  it("marks the hours an existing booking covers as taken, for that space only", () => {
    const bookings = [booking("pod-1", "10:00 WITA", "12:00 WITA"), booking("pod-2", "09:00 WITA", "10:00 WITA")];

    const slots = slotAvailability(bookings, "pod-1", "2026-11-20", ["09:00", "10:00", "11:00", "12:00"]);

    expect(slots).toEqual([
      { time: "09:00", isTaken: false },
      { time: "10:00", isTaken: true },
      { time: "11:00", isTaken: true },
      { time: "12:00", isTaken: false },
    ]);
  });

  it("ignores cancelled bookings and other dates", () => {
    const bookings = [
      booking("pod-1", "10:00 WITA", "11:00 WITA", { checkInStatus: "CANCELLED" }),
      booking("pod-1", "10:00 WITA", "11:00 WITA", { date: "2026-11-21" }),
    ];

    expect(slotAvailability(bookings, "pod-1", "2026-11-20", ["10:00"])).toEqual([{ time: "10:00", isTaken: false }]);
  });
});

describe("isRangeFree", () => {
  it("rejects a range that runs into a later booking", () => {
    const bookings = [booking("pod-1", "11:00 WITA", "12:00 WITA")];

    expect(isRangeFree(bookings, "pod-1", "2026-11-20", "09:00", 2)).toBe(true);
    expect(isRangeFree(bookings, "pod-1", "2026-11-20", "10:00", 2)).toBe(false);
  });
});
