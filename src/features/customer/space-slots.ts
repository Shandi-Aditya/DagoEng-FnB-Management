import { checkCoworkingBookingConflict } from "@/lib/operating-hours";
import type { CoworkingBooking } from "@/types/coworking";

import { calculateEndTime } from "./customer-domain";

export interface SpaceSlot {
  time: string;
  isTaken: boolean;
}

export function isRangeFree(
  bookings: readonly CoworkingBooking[],
  spaceId: string,
  date: string,
  start: string,
  hours: number,
  maxCapacity: number = 1,
): boolean {
  const result = checkCoworkingBookingConflict([...bookings], {
    spaceId,
    bookingType: "HOURLY",
    date,
    startTime: start,
    endTime: calculateEndTime(start, hours),
    maxCapacity,
  });
  return !result.hasConflict;
}

export function slotAvailability(
  bookings: readonly CoworkingBooking[],
  spaceId: string,
  date: string,
  slots: readonly string[],
  maxCapacity: number = 1,
): SpaceSlot[] {
  return slots.map((time) => ({
    time,
    isTaken: !isRangeFree(bookings, spaceId, date, time, 1, maxCapacity),
  }));
}
