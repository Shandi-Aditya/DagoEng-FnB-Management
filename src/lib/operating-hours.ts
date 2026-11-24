/**
 * Operational Hours, Holiday Calendar, Anti-Double Booking, and Tenant Order Engine
 * DagoEng F&B & Co-working Management System
 */

import { CoworkingBooking } from "@/types/coworking";

export interface NationalHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

export interface HolidayOverride {
  date: string; // YYYY-MM-DD
  isOpen: boolean; // true = dibuka khusus (event/override), false = ditutup khusus
  type?: "OPEN" | "CLOSED";
  reason?: string;
}

export type HolidayOverrideDate = HolidayOverride;

export interface CoworkingHolidayConfig {
  defaultWeekendClosed: boolean; // default true: Sabtu & Minggu tutup
  nationalHolidays: NationalHoliday[];
  overrides: HolidayOverride[];
  closeOnWeekends?: boolean;
  closeOnNationalHolidays?: boolean;
}

export interface ServiceHourConfig {
  openTime: string; // "07:00"
  closeTime: string; // "22:00"
  isOpen: boolean;
  open?: string;
  close?: string;
  allowBookingOutsideHours?: boolean;
  allowOrderOutsideHours?: boolean;
}

export interface ServiceOperationalHours {
  fnb: ServiceHourConfig;
  coworking: ServiceHourConfig;
}

export interface TenantOperationConfig {
  isOpenOrder: boolean;
  openTime: string; // "08:00"
  closeTime: string; // "21:00"
  notes?: string;
  tenantId?: string;
  tenantName?: string;
  isAcceptingOrders?: boolean;
  temporaryClosedReason?: string;
  estimatedReopenTime?: string;
  manualOverride?: "OPEN" | "CLOSED" | null;
  updatedAt?: string;
}

/**
 * Daftar Hari Libur Nasional Resmi Indonesia 2026
 */
export const DEFAULT_NATIONAL_HOLIDAYS_2026: NationalHoliday[] = [
  { date: "2026-01-01", name: "Tahun Baru 2026 Masehi" },
  { date: "2026-01-16", name: "Isra Mi'raj Nabi Muhammad SAW" },
  { date: "2026-02-17", name: "Tahun Baru Imlek 2577 Kongzili" },
  { date: "2026-03-20", name: "Hari Raya Idul Fitri 1447 H (Hari 1)" },
  { date: "2026-03-21", name: "Hari Raya Idul Fitri 1447 H (Hari 2)" },
  { date: "2026-03-22", name: "Hari Suci Nyepi (Tahun Baru Saka 1948)" },
  { date: "2026-04-03", name: "Wafat Yesus Kristus" },
  { date: "2026-04-05", name: "Hari Paskah" },
  { date: "2026-05-01", name: "Hari Buruh Internasional" },
  { date: "2026-05-14", name: "Kenaikan Yesus Kristus" },
  { date: "2026-05-31", name: "Hari Raya Waisak 2570 BE" },
  { date: "2026-06-01", name: "Hari Lahir Pancasila" },
  { date: "2026-06-16", name: "Hari Raya Idul Adha 1447 H" },
  { date: "2026-07-07", name: "Tahun Baru Islam 1448 H" },
  { date: "2026-08-17", name: "Hari Kemerdekaan Republik Indonesia" },
  { date: "2026-09-15", name: "Maulid Nabi Muhammad SAW" },
  { date: "2026-12-25", name: "Hari Raya Natal" },
];

export const INDONESIAN_NATIONAL_HOLIDAYS_2026 = DEFAULT_NATIONAL_HOLIDAYS_2026;

export const DEFAULT_COWORKING_HOLIDAY_CONFIG: CoworkingHolidayConfig = {
  defaultWeekendClosed: true,
  nationalHolidays: DEFAULT_NATIONAL_HOLIDAYS_2026,
  overrides: [],
};

export const DEFAULT_OPERATIONAL_HOURS: ServiceOperationalHours = {
  fnb: {
    openTime: "07:00",
    closeTime: "22:00",
    isOpen: true,
  },
  coworking: {
    openTime: "09:00",
    closeTime: "18:00",
    isOpen: true,
  },
};

export const COWORKING_OPEN_TIME = DEFAULT_OPERATIONAL_HOURS.coworking.openTime;
export const COWORKING_CLOSE_TIME = DEFAULT_OPERATIONAL_HOURS.coworking.closeTime;
export const COWORKING_OPEN_MINUTES = 9 * 60;
export const COWORKING_CLOSE_MINUTES = 18 * 60;
export const COWORKING_MAX_HOURS = (COWORKING_CLOSE_MINUTES - COWORKING_OPEN_MINUTES) / 60;

export function getCoworkingStartSlots(minDurationHours = 1): string[] {
  const safeMinHours = Math.max(1, Math.floor(minDurationHours));
  const lastStartMinutes = COWORKING_CLOSE_MINUTES - safeMinHours * 60;
  const slots: string[] = [];
  for (let mins = COWORKING_OPEN_MINUTES; mins <= lastStartMinutes; mins += 60) {
    const h = Math.floor(mins / 60);
    slots.push(`${String(h).padStart(2, "0")}:00`);
  }
  return slots;
}

export function isWithinCoworkingHours(startTime: string, durationHours: number): boolean {
  const startMinutes = parseTimeToMinutes(startTime);
  if (startMinutes === null || durationHours <= 0) return false;
  return (
    startMinutes >= COWORKING_OPEN_MINUTES &&
    startMinutes + durationHours * 60 <= COWORKING_CLOSE_MINUTES
  );
}

export const DEFAULT_TENANT_OPERATIONS: Record<string, TenantOperationConfig> = {
  "tenant-ks": {
    isOpenOrder: true,
    openTime: "07:00",
    closeTime: "22:00",
    notes: "Kopi Senja - Buka Setiap Hari",
  },
  "tenant-kitchen": {
    isOpenOrder: true,
    openTime: "10:00",
    closeTime: "21:30",
    notes: "Dapur Mama - Hidangan Siang & Malam",
  },
  "tenant-bakery": {
    isOpenOrder: true,
    openTime: "07:30",
    closeTime: "20:00",
    notes: "Manis Bakery - Fresh Pastry Pagi",
  },
  "tenant-tea": {
    isOpenOrder: true,
    openTime: "09:00",
    closeTime: "21:00",
    notes: "Teh Nusantara",
  },
  "tenant-snack": {
    isOpenOrder: true,
    openTime: "10:00",
    closeTime: "21:00",
    notes: "Warung Bu Narti",
  },
};

/**
 * Normalizes date to YYYY-MM-DD
 */
export function normalizeDateToYMD(dateStr: string): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Indonesian localized date (e.g. "12 Okt 2026", "01 Sep 2026", "15 Agustus 2026")
  const idMonths: Record<string, string> = {
    jan: "01", januari: "01",
    feb: "02", februari: "02",
    mar: "03", maret: "03",
    apr: "04", april: "04",
    mei: "05",
    jun: "06", juni: "06",
    jul: "07", juli: "07",
    agu: "08", agustus: "08",
    sep: "09", september: "09",
    okt: "10", oktober: "10",
    nov: "11", november: "11",
    des: "12", desember: "12",
  };

  const parts = trimmed.split(/\s+/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, "0");
    const mKey = parts[1].toLowerCase().replace(".", "").slice(0, 3);
    const month = idMonths[mKey] || "01";
    const year = parts[2];
    if (/^\d{4}$/.test(year) && /^\d{2}$/.test(day)) {
      return `${year}-${month}-${day}`;
    }
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  return trimmed;
}

/**
 * Parses time string (e.g. "09:00", "09:00 WITA", "18:00") into minutes from midnight
 */
export function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
}

/**
 * Evaluates whether a date is open for Co-working according to weekend policy, national holidays, and manual overrides.
 */
export function isCoworkingDateOpen(
  dateInput: string,
  config: CoworkingHolidayConfig = DEFAULT_COWORKING_HOLIDAY_CONFIG
): { isOpen: boolean; reason: string; isOverridden: boolean } {
  const ymd = normalizeDateToYMD(dateInput);
  if (!ymd) return { isOpen: false, reason: "Tanggal tidak valid", isOverridden: false };

  const override = config.overrides?.find((o) => o.date === ymd);
  if (override) {
    return {
      isOpen: override.isOpen,
      reason: override.reason || (override.isOpen ? "Dibuka khusus via Admin Override" : "Ditutup khusus via Admin Override"),
      isOverridden: true,
    };
  }

  const holidaysClosed = config.closeOnNationalHolidays ?? true;
  if (holidaysClosed) {
    const holiday = config.nationalHolidays?.find((h) => h.date === ymd);
    if (holiday) {
      return {
        isOpen: false,
        reason: `Tutup: Hari Libur Nasional (${holiday.name})`,
        isOverridden: false,
      };
    }
  }

  const weekendClosed = config.closeOnWeekends ?? config.defaultWeekendClosed ?? true;
  if (weekendClosed) {
    const [year, month, day] = ymd.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day, 12, 0, 0);
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        isOpen: false,
        reason: dayOfWeek === 0 ? "Tutup: Hari Minggu (Libur Akhir Pekan)" : "Tutup: Hari Sabtu (Libur Akhir Pekan)",
        isOverridden: false,
      };
    }
  }

  return {
    isOpen: true,
    reason: "Buka sesuai jam kantor Dago Creative Hub (Senin - Jumat, 09:00 - 18:00 WITA)",
    isOverridden: false,
  };
}

export function getNextOpenCoworkingDate(
  startDateInput: string,
  config: CoworkingHolidayConfig = DEFAULT_COWORKING_HOLIDAY_CONFIG
): string {
  const startYmd = normalizeDateToYMD(startDateInput);
  if (!startYmd) return startDateInput;
  const [sY, sM, sD] = startYmd.split("-").map(Number);
  const cursor = new Date(sY, sM - 1, sD, 12, 0, 0);
  for (let offset = 0; offset < 14; offset += 1) {
    const candidateYmd = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (isCoworkingDateOpen(candidateYmd, config).isOpen) {
      return candidateYmd;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return startYmd;
}

export function validateCoworkingBookingSchedule(
  candidate: {
    bookingType?: string;
    date?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    duration?: number;
  },
  config: CoworkingHolidayConfig = DEFAULT_COWORKING_HOLIDAY_CONFIG
): { isValid: boolean; reason?: string } {
  if (!candidate.date) {
    return { isValid: false, reason: "Tanggal booking co-working wajib diisi." };
  }

  const startYmd = normalizeDateToYMD(candidate.date);
  const endYmd = candidate.endDate ? normalizeDateToYMD(candidate.endDate) : startYmd;
  const startStatus = isCoworkingDateOpen(startYmd, config);
  if (!startStatus.isOpen) {
    return {
      isValid: false,
      reason: `Tanggal ${startYmd} tidak dapat dibooking (${startStatus.reason}). Co-working buka Senin sampai Jumat pukul 09:00–18:00 WITA.`,
    };
  }

  const normalizedType = (candidate.bookingType || "HOURLY").toUpperCase();
  if (endYmd && endYmd < startYmd) {
    return {
      isValid: false,
      reason: "Tanggal selesai tidak boleh mendahului tanggal mulai.",
    };
  }

  if (normalizedType === "DAILY" && endYmd && endYmd !== startYmd) {
    const rangeStatus = validateCoworkingDateRange(startYmd, endYmd, config);
    if (!rangeStatus.isValid) {
      const firstClosed = rangeStatus.closedDates[0];
      return {
        isValid: false,
        reason: `Tanggal ${firstClosed.date} tidak dapat dibooking (${firstClosed.reason}). Co-working buka Senin sampai Jumat pukul 09:00–18:00 WITA.`,
      };
    }
  } else if (normalizedType === "HOURLY" && endYmd && endYmd !== startYmd) {
    const endStatus = isCoworkingDateOpen(endYmd, config);
    if (!endStatus.isOpen) {
      return {
        isValid: false,
        reason: `Tanggal ${endYmd} tidak dapat dibooking (${endStatus.reason}).`,
      };
    }
  }

  if (normalizedType === "HOURLY" && candidate.startTime) {
    const startMinutes = parseTimeToMinutes(candidate.startTime);
    const endMinutes = candidate.endTime
      ? parseTimeToMinutes(candidate.endTime)
      : startMinutes !== null && candidate.duration
        ? startMinutes + candidate.duration * 60
        : null;

    if (
      startMinutes === null ||
      startMinutes < COWORKING_OPEN_MINUTES ||
      (endMinutes !== null && (endMinutes > COWORKING_CLOSE_MINUTES || endMinutes <= startMinutes))
    ) {
      return {
        isValid: false,
        reason:
          "Waktu sewa co-working harus berada dalam jam kantor Dago Creative Hub (Senin sampai Jumat, 09:00–18:00 WITA).",
      };
    }
  }

  return { isValid: true };
}

/**
 * Convenience helper to check if a date is considered a Co-working holiday.
 */
export function isCoworkingHoliday(
  dateInput: string,
  config: CoworkingHolidayConfig = DEFAULT_COWORKING_HOLIDAY_CONFIG
): { isHoliday: boolean; reason: string; isOverride: boolean } {
  const res = isCoworkingDateOpen(dateInput, config);
  return {
    isHoliday: !res.isOpen,
    reason: res.reason,
    isOverride: res.isOverridden,
  };
}

/**
 * Validates a range of dates for Co-working bookings.
 */
export function validateCoworkingDateRange(
  startDateInput: string,
  endDateInput?: string,
  config: CoworkingHolidayConfig = DEFAULT_COWORKING_HOLIDAY_CONFIG
): { isValid: boolean; closedDates: { date: string; reason: string }[] } {
  const startYmd = normalizeDateToYMD(startDateInput);
  const endYmd = endDateInput ? normalizeDateToYMD(endDateInput) : startYmd;

  if (!startYmd) return { isValid: false, closedDates: [{ date: startDateInput, reason: "Format tanggal tidak valid" }] };

  const closedDates: { date: string; reason: string }[] = [];

  const [sY, sM, sD] = startYmd.split("-").map(Number);
  const [eY, eM, eD] = endYmd.split("-").map(Number);
  const cur = new Date(sY, sM - 1, sD, 12, 0, 0);
  const end = new Date(eY, eM - 1, eD, 12, 0, 0);

  // Limit check to prevent infinite loop
  let daysCount = 0;
  while (cur <= end && daysCount < 366) {
    const curYmd = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    const status = isCoworkingDateOpen(curYmd, config);
    if (!status.isOpen) {
      closedDates.push({ date: curYmd, reason: status.reason });
    }
    cur.setDate(cur.getDate() + 1);
    daysCount++;
  }

  return {
    isValid: closedDates.length === 0,
    closedDates,
  };
}

/**
 * Anti Double-Booking Collision Detector.
 * Prevents overlapping bookings for the same workspace.
 * Correctly permits:
 * - Different rooms/spaces at the same time
 * - Consecutive time slots on the same space (e.g. 10:00-12:00 and 12:00-14:00)
 * - Ignores cancelled bookings
 */
export function checkCoworkingBookingConflict(
  existingBookings: CoworkingBooking[],
  candidate: {
    id?: string;
    spaceId: string;
    spaceName?: string;
    bookingType: "HOURLY" | "DAILY" | "MONTHLY";
    date: string;
    endDate?: string;
    startTime: string;
    endTime?: string;
    maxCapacity?: number;
  }
): { hasConflict: boolean; conflictingBooking?: CoworkingBooking; message?: string } {
  const candStartYmd = normalizeDateToYMD(candidate.date);
  const candEndYmd = candidate.endDate ? normalizeDateToYMD(candidate.endDate) : candStartYmd;

  const candStartMin = parseTimeToMinutes(candidate.startTime);
  const candEndMin = parseTimeToMinutes(candidate.endTime);
  const allowedConcurrent = Math.max(1, candidate.maxCapacity ?? 1);

  if (
    candidate.bookingType === "HOURLY" &&
    candStartMin !== null &&
    candEndMin !== null &&
    candStartYmd === candEndYmd
  ) {
    const relevantBookings = existingBookings.filter((b) => {
      if (candidate.id && b.id === candidate.id) return false;
      if (
        b.checkInStatus === "CANCELLED" ||
        b.checkInStatus === "COMPLETED" ||
        (b as { paymentStatus?: string }).paymentStatus === "CANCELLED"
      ) {
        return false;
      }
      if (b.spaceId !== candidate.spaceId) return false;
      const bStartYmd = normalizeDateToYMD(b.date);
      const bEndYmd = b.endDate ? normalizeDateToYMD(b.endDate) : bStartYmd;
      return !(candEndYmd < bStartYmd || candStartYmd > bEndYmd);
    });

    for (let min = candStartMin; min < candEndMin; min += 30) {
      const windowEnd = min + 30;
      const overlapping = relevantBookings.filter((b) => {
        if (b.bookingType === "DAILY" || b.bookingType === "MONTHLY") return true;
        const bStartMin = parseTimeToMinutes(b.startTime);
        const bEndMin = parseTimeToMinutes(b.endTime);
        if (bStartMin === null || bEndMin === null) return true;
        return min < bEndMin && windowEnd > bStartMin;
      });

      if (overlapping.length >= allowedConcurrent) {
        const firstOverlap = overlapping[0];
        const remainingSeats = Math.max(0, allowedConcurrent - overlapping.length);
        return {
          hasConflict: true,
          conflictingBooking: firstOverlap,
          message:
            allowedConcurrent > 1
              ? `Kapasitas slot tidak mencukupi: Workspace ${candidate.spaceName || firstOverlap.spaceName} sudah terisi ${overlapping.length}/${allowedConcurrent} kursi pada rentang ini (tersisa ${remainingSeats} kursi).`
              : `Jadwal bentrok: Workspace ${candidate.spaceName || firstOverlap.spaceName} sudah dipesan oleh ${firstOverlap.guestName} pada jam ${firstOverlap.startTime} - ${firstOverlap.endTime || "Selesai"} (Kode: ${firstOverlap.bookingCode}).`,
        };
      }
    }

    return { hasConflict: false };
  }

  let overlappingCount = 0;
  let firstOverlap: CoworkingBooking | undefined;

  for (const b of existingBookings) {
    if (candidate.id && b.id === candidate.id) continue;

    if (
      b.checkInStatus === "CANCELLED" ||
      b.checkInStatus === "COMPLETED" ||
      (b as { paymentStatus?: string }).paymentStatus === "CANCELLED"
    ) {
      continue;
    }

    if (b.spaceId !== candidate.spaceId) continue;

    const bookStartYmd = normalizeDateToYMD(b.date);
    const bookEndYmd = b.endDate ? normalizeDateToYMD(b.endDate) : bookStartYmd;

    const datesOverlap = !(candEndYmd < bookStartYmd || candStartYmd > bookEndYmd);
    if (!datesOverlap) continue;

    if (
      candidate.bookingType === "HOURLY" &&
      b.bookingType === "HOURLY" &&
      candStartYmd === candEndYmd &&
      bookStartYmd === bookEndYmd &&
      candStartYmd === bookStartYmd
    ) {
      const bookStartMin = parseTimeToMinutes(b.startTime);
      const bookEndMin = parseTimeToMinutes(b.endTime);

      if (
        candStartMin !== null &&
        candEndMin !== null &&
        bookStartMin !== null &&
        bookEndMin !== null
      ) {
        const timesOverlap = candStartMin < bookEndMin && bookStartMin < candEndMin;
        if (timesOverlap) {
          overlappingCount += 1;
          if (!firstOverlap) firstOverlap = b;
          if (overlappingCount >= allowedConcurrent) {
            return {
              hasConflict: true,
              conflictingBooking: firstOverlap,
              message: `Jadwal bentrok: Workspace ${candidate.spaceName || firstOverlap.spaceName} sudah dipesan oleh ${firstOverlap.guestName} pada jam ${firstOverlap.startTime} - ${firstOverlap.endTime || "Selesai"} (Kode: ${firstOverlap.bookingCode}).`,
            };
          }
        }
        continue;
      }
    }

    overlappingCount += 1;
    if (!firstOverlap) firstOverlap = b;
    if (overlappingCount >= allowedConcurrent) {
      return {
        hasConflict: true,
        conflictingBooking: firstOverlap,
        message: `Jadwal bentrok: Workspace ${candidate.spaceName || firstOverlap.spaceName} sudah memiliki reservasi aktif (${firstOverlap.bookingType}) oleh ${firstOverlap.guestName} pada rentang ${firstOverlap.date}${firstOverlap.endDate ? ` s/d ${firstOverlap.endDate}` : ""} (Kode: ${firstOverlap.bookingCode}).`,
      };
    }
  }

  return { hasConflict: false };
}

function getWitaTotalMinutes(dateObj: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(dateObj);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/**
 * Checks if a specific tenant is currently open and accepting orders.
 */
export function isTenantAcceptingOrders(
  tenantId: string,
  tenantOperations?: Record<string, TenantOperationConfig>,
  currentDateObj: Date = new Date()
): { isOpen: boolean; reason: string; estimatedReopenTime?: string } {
  const config = tenantOperations?.[tenantId] || DEFAULT_TENANT_OPERATIONS[tenantId];
  if (!config) {
    // If not configured, default to open
    return { isOpen: true, reason: "Mitra beroperasi normal" };
  }

  // 1. Tombol Buka/Tutup manual mengalahkan jadwal sampai di-reset (Task V-03)
  if (config.manualOverride === "OPEN") {
    return {
      isOpen: true,
      reason: "Buka manual (override jadwal operasional oleh operator)",
    };
  }

  if (config.manualOverride === "CLOSED") {
    const reopenEstimate =
      config.estimatedReopenTime ||
      (config.openTime ? `Buka kembali pk ${config.openTime} WITA` : "Estimasi buka segera");
    return {
      isOpen: false,
      reason:
        config.temporaryClosedReason ||
        config.notes ||
        "Mitra sedang Tutup Sementara (manual override oleh operator)",
      estimatedReopenTime: reopenEstimate,
    };
  }

  if (!config.isOpenOrder) {
    const reopenEstimate =
      config.estimatedReopenTime ||
      (config.openTime ? `Buka kembali pk ${config.openTime} WITA` : "Estimasi buka segera");
    return {
      isOpen: false,
      reason:
        config.temporaryClosedReason ||
        config.notes ||
        "Mitra sedang Tutup Sementara (Open Order dimatikan oleh tenant)",
      estimatedReopenTime: reopenEstimate,
    };
  }

  if (config.openTime && config.closeTime) {
    const curTotal = getWitaTotalMinutes(currentDateObj);

    const openTotal = parseTimeToMinutes(config.openTime) ?? 0;
    const closeTotal = parseTimeToMinutes(config.closeTime) ?? 24 * 60;

    if (curTotal < openTotal || curTotal >= closeTotal) {
      return {
        isOpen: false,
        reason: `Mitra di luar jam operasional (${config.openTime} - ${config.closeTime})`,
        estimatedReopenTime: `Buka kembali pk ${config.openTime} WITA`,
      };
    }
  }

  return { isOpen: true, reason: "Mitra buka dan menerima pesanan" };
}

export function isServiceWithinHours(
  service: "fnb" | "coworking",
  operationalHours?: ServiceOperationalHours,
  currentDateObj: Date = new Date()
): { isOpen: boolean; reason: string } {
  const config = operationalHours?.[service] || DEFAULT_OPERATIONAL_HOURS[service];
  if (!config.isOpen) {
    return { isOpen: false, reason: `Layanan ${service.toUpperCase()} sedang dinonaktifkan sementara` };
  }

  const curTotal = getWitaTotalMinutes(currentDateObj);

  const openTotal = parseTimeToMinutes(config.openTime) ?? 0;
  const closeTotal = parseTimeToMinutes(config.closeTime) ?? 24 * 60;

  if (curTotal < openTotal || curTotal >= closeTotal) {
    return {
      isOpen: false,
      reason: `Layanan ${service.toUpperCase()} di luar jam operasional (${config.openTime} - ${config.closeTime})`,
    };
  }

  return { isOpen: true, reason: `Layanan ${service.toUpperCase()} aktif` };
}
