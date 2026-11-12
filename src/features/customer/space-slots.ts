import { checkCoworkingBookingConflict } from "@/lib/operating-hours";
import type { CoworkingBooking } from "@/types/coworking";

import { calculateEndTime } from "./customer-domain";

export interface SpaceSlot {
  time: string;
  isTaken: boolean;
}

/** True when [start, start + hours) on that date does not overlap any live booking of the space. */
export function isRangeFree(
  bookings: readonly CoworkingBooking[],
  spaceId: string,
  date: string,
  start: string,
  hours: number,
): boolean {
  const result = checkCoworkingBookingConflict([...bookings], {
    spaceId,
    bookingType: "HOURLY",
    date,
    startTime: start,
    endTime: calculateEndTime(start, hours),
  });
  return !result.hasConflict;
}

/** One-hour slots for a space on a date, each marked taken when an existing booking covers it. */
export function slotAvailability(
  bookings: readonly CoworkingBooking[],
  spaceId: string,
  date: string,
  slots: readonly string[],
): SpaceSlot[] {
  return slots.map((time) => ({ time, isTaken: !isRangeFree(bookings, spaceId, date, time, 1) }));
}
