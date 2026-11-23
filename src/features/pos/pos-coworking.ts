import type { CoworkingBooking, CoworkingSpaceItem } from "@/types/coworking";
import { getTodayWitaDateString } from "@/features/coworking/coworking-domain";
import { normalizeDateToYMD, parseTimeToMinutes } from "@/lib/operating-hours";

export const COWORKING_TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
] as const;

export function parseHour(timeStr: string): number {
  if (!timeStr) return 9;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (match) return parseInt(match[1], 10);
  const matchNum = timeStr.match(/(\d{1,2})/);
  if (matchNum) return parseInt(matchNum[1], 10);
  return 9;
}

export function getCurrentTimeFormatted(): string {
  const now = new Date();
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

export function getValidOperationalTime(targetDateStr?: string): string {
  const now = new Date();
  const todayStr = getTodayWitaDateString(now);
  if (targetDateStr && targetDateStr > todayStr) {
    return "09:00";
  }
  const witaHourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    hour: "numeric",
    hour12: false,
  }).format(now);
  const witaMinuteStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    minute: "numeric",
  }).format(now);
  const curH = parseInt(witaHourStr, 10);
  const curM = parseInt(witaMinuteStr, 10);
  if (curH < 9) return "09:00";
  if (curH >= 9 && curH <= 17) {
    const slotHour = curM > 15 ? Math.min(curH + 1, 17) : curH;
    return `${slotHour.toString().padStart(2, "0")}:00`;
  }
  return "09:00";
}

export function calculateEndTime(startTime: string, durationHours: number): string {
  if (!startTime) return "11:00";
  const match = startTime.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const startHour = parseInt(match[1], 10);
    const startMin = match[2];
    const endHour = (startHour + durationHours) % 24;
    return `${endHour.toString().padStart(2, "0")}:${startMin}`;
  }
  const startHour = parseHour(startTime);
  const endHour = (startHour + durationHours) % 24;
  return `${endHour.toString().padStart(2, "0")}:00`;
}

export function isSlotPast(
  targetDate: string,
  slotTime: string,
  now = new Date()
): boolean {
  const todayWita = getTodayWitaDateString(now);
  const targetYmd = normalizeDateToYMD(targetDate);
  if (!targetYmd) return false;
  if (targetYmd < todayWita) {
    return true;
  }
  if (targetYmd > todayWita) {
    return false;
  }
  const witaHourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    hour: "numeric",
    hour12: false,
  }).format(now);
  const curH = parseInt(witaHourStr, 10);
  const slotH = parseHour(slotTime);
  return slotH < curH;
}

export interface SlotAvailabilityResult {
  isAvailable: boolean;
  reason?: string;
  conflictingBooking?: CoworkingBooking;
  remainingSeats: number;
  maxCapacity: number;
  isPast: boolean;
  label: string;
}

export interface CheckSlotParams {
  spaceId: string;
  spaces: CoworkingSpaceItem[];
  bookings: CoworkingBooking[];
  targetDate: string;
  startHour: number;
  durationHours: number;
  checkPast?: boolean;
  now?: Date;
}

export function checkSlotAvailability({
  spaceId,
  spaces,
  bookings,
  targetDate,
  startHour,
  durationHours,
  checkPast = false,
  now = new Date(),
}: CheckSlotParams): SlotAvailabilityResult {
  const space = spaces.find((s) => s.id === spaceId);
  const maxCapacity = space?.type === "HOT_DESK" ? space.capacity || 8 : 1;
  const isPast = checkPast
    ? isSlotPast(targetDate, `${startHour.toString().padStart(2, "0")}:00`, now)
    : false;

  if (space?.status === "MAINTENANCE") {
    return {
      isAvailable: false,
      reason: "Sedang pemeliharaan",
      remainingSeats: 0,
      maxCapacity,
      isPast: false,
      label: "Pemeliharaan",
    };
  }

  const targetYmd = normalizeDateToYMD(targetDate);
  const reqStartMin = startHour * 60;
  const reqEndMin = (startHour + durationHours) * 60;

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
  let firstConflicting: CoworkingBooking | undefined;

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
      if (!firstConflicting && overlapping.length >= maxCapacity) {
        firstConflicting = overlapping[0];
      }
    }
  }

  const remainingSeats = Math.max(0, maxCapacity - peakOverlapping);

  if (isPast) {
    return {
      isAvailable: false,
      reason: "Slot sudah lewat",
      remainingSeats,
      maxCapacity,
      isPast: true,
      label: "Lewat",
    };
  }

  if (remainingSeats <= 0) {
    return {
      isAvailable: false,
      reason: "Sudah dibooking",
      conflictingBooking: firstConflicting,
      remainingSeats: 0,
      maxCapacity,
      isPast: false,
      label: "Penuh",
    };
  }

  return {
    isAvailable: true,
    remainingSeats,
    maxCapacity,
    isPast: false,
    label: `${remainingSeats}/${maxCapacity} tersisa`,
  };
}

const SPACE_TYPE_LABELS: Record<string, string> = {
  HOT_DESK: "Hot desk",
  DEDICATED_DESK: "Dedicated desk",
  MEETING_ROOM: "Meeting room",
  PRIVATE_POD: "Private pod",
};

/** Convert space type enum to human-friendly sentence-case Indonesian label. */
export function spaceTypeLabel(type?: string): string {
  if (!type) return "—";
  if (SPACE_TYPE_LABELS[type]) return SPACE_TYPE_LABELS[type];
  const cleaned = type.replace(/_/g, " ").toLowerCase();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Format duration in hours for display. 8 hours is labeled full day. */
export function formatCoworkingDuration(hours: number): string {
  if (hours === 8) return "Seharian (8 jam)";
  return `${hours} jam`;
}

/** Standardized empty state message for co-working room catalogue. */
export function coworkingEmptyStateMessage(hasFilter: boolean): { title: string; description: string } {
  if (hasFilter) {
    return {
      title: "Ruang kerja tidak ditemukan",
      description: "Ubah kata kunci pencarian atau pilih filter tipe ruang lain.",
    };
  }
  return {
    title: "Belum ada ruang kerja",
    description: "Ruang kerja aktif akan muncul di sini.",
  };
}
