import {
  checkCoworkingBookingConflict,
  normalizeDateToYMD,
  parseTimeToMinutes,
} from "@/lib/operating-hours";
import type { CoworkingBooking } from "@/types/coworking";
import { isSlotPast, parseHour } from "@/features/pos/pos-coworking";

import { calculateEndTime } from "./customer-domain";

export interface SpaceSlot {
  time: string;
  isTaken: boolean;
  remainingSeats: number;
  maxCapacity: number;
  isPast: boolean;
  label: string;
}

export function countOverlappingBookings(
  bookings: readonly CoworkingBooking[],
  spaceId: string,
  date: string,
  start: string,
  hours: number = 1
): number {
  const targetYmd = normalizeDateToYMD(date);
  const startH = parseHour(start);
  const reqStartMin = parseTimeToMinutes(start) ?? startH * 60;
  const reqEndMin = reqStartMin + hours * 60;

  const activeBookings = bookings.filter((b) => {
    if (b.spaceId !== spaceId) return false;
    if (
      b.checkInStatus === "CANCELLED" ||
      b.checkInStatus === "COMPLETED" ||
      (b as { paymentStatus?: string }).paymentStatus === "CANCELLED"
    ) {
      return false;
    }
    const bStartYmd = normalizeDateToYMD(b.date);
    const bEndYmd = b.endDate ? normalizeDateToYMD(b.endDate) : bStartYmd;
    return Boolean(bStartYmd) && targetYmd >= bStartYmd && targetYmd <= bEndYmd;
  });

  let peakOverlapping = 0;
  for (let min = reqStartMin; min < reqEndMin; min += 30) {
    const windowEnd = min + 30;
    const overlapping = activeBookings.filter((b) => {
      if (b.bookingType === "DAILY" || b.bookingType === "MONTHLY") return true;
      const bStartMin = parseTimeToMinutes(b.startTime) ?? parseHour(b.startTime) * 60;
      const bEndMin =
        parseTimeToMinutes(b.endTime) ?? bStartMin + (b.duration || 1) * 60;
      return min < bEndMin && windowEnd > bStartMin;
    });
    if (overlapping.length > peakOverlapping) {
      peakOverlapping = overlapping.length;
    }
  }

  return peakOverlapping;
}

export function isRangeFree(
  bookings: readonly CoworkingBooking[],
  spaceId: string,
  date: string,
  start: string,
  hours: number,
  maxCapacity: number = 1,
): boolean {
  const peakOverlapping = countOverlappingBookings(
    bookings,
    spaceId,
    date,
    start,
    hours
  );
  return peakOverlapping < maxCapacity;
}

export function slotAvailability(
  bookings: readonly CoworkingBooking[],
  spaceId: string,
  date: string,
  slots: readonly string[],
  maxCapacity: number = 1,
  options?: { now?: Date; checkPast?: boolean }
): SpaceSlot[] {
  const shouldCheckPast = options?.checkPast ?? false;
  return slots.map((time) => {
    const past = shouldCheckPast ? isSlotPast(date, time, options?.now) : false;
    const peakOverlapping = countOverlappingBookings(
      bookings,
      spaceId,
      date,
      time,
      1
    );
    const remainingSeats = Math.max(0, maxCapacity - peakOverlapping);
    const isTaken = past || remainingSeats <= 0;

    let label = `${remainingSeats}/${maxCapacity} tersisa`;
    if (past) {
      label = "Lewat";
    } else if (remainingSeats <= 0) {
      label = "Penuh";
    }

    return {
      time,
      isTaken,
      remainingSeats,
      maxCapacity,
      isPast: past,
      label,
    };
  });
}
