import type { CoworkingBooking, CoworkingSpaceItem } from "@/types/coworking";

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
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function getValidOperationalTime(targetDateStr?: string): string {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (targetDateStr && targetDateStr > todayStr) {
    return "09:00";
  }
  const curH = now.getHours();
  const curM = now.getMinutes();
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

export interface SlotAvailabilityResult {
  isAvailable: boolean;
  reason?: string;
  conflictingBooking?: CoworkingBooking;
}

export interface CheckSlotParams {
  spaceId: string;
  spaces: CoworkingSpaceItem[];
  bookings: CoworkingBooking[];
  targetDate: string;
  startHour: number;
  durationHours: number;
}

export function checkSlotAvailability({
  spaceId,
  spaces,
  bookings,
  targetDate,
  startHour,
  durationHours,
}: CheckSlotParams): SlotAvailabilityResult {
  const space = spaces.find((s) => s.id === spaceId);
  const maxCapacity = space?.type === "HOT_DESK" ? space.capacity || 8 : 1;
  const targetEndHour = startHour + durationHours;

  const activeBookings = bookings.filter(
    (b) =>
      b.spaceId === spaceId &&
      b.date === targetDate &&
      b.checkInStatus !== "CANCELLED" &&
      b.checkInStatus !== "COMPLETED"
  );

  for (let h = startHour; h < targetEndHour; h++) {
    const overlapping = activeBookings.filter((b) => {
      const bStart = parseHour(b.startTime);
      const bEnd = bStart + (b.duration || 1);
      return h >= bStart && h < bEnd;
    });

    if (overlapping.length >= maxCapacity) {
      return {
        isAvailable: false,
        reason: "Sudah dibooking",
        conflictingBooking: overlapping[0],
      };
    }
  }

  return { isAvailable: true };
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
