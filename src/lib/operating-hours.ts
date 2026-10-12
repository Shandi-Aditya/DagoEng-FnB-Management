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

  // 1. Highest priority: Manual Override by Admin/Owner
  const override = config.overrides?.find((o) => o.date === ymd);
  if (override) {
    return {
      isOpen: override.isOpen,
      reason: override.reason || (override.isOpen ? "Dibuka khusus via Admin Override" : "Ditutup khusus via Admin Override"),
      isOverridden: true,
    };
  }

  // 2. National Holiday check
  const holiday = config.nationalHolidays?.find((h) => h.date === ymd);
  if (holiday) {
    return {
      isOpen: false,
      reason: `Tutup: Hari Libur Nasional (${holiday.name})`,
      isOverridden: false,
    };
  }

  // 3. Weekend check (Saturday = 6, Sunday = 0)
  if (config.defaultWeekendClosed) {
    const [year, month, day] = ymd.split("-").map(Number);
    // Use UTC or local noon to avoid timezone shift
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
    reason: "Buka sesuai jam operasional Co-working",
    isOverridden: false,
  };
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
  }
): { hasConflict: boolean; conflictingBooking?: CoworkingBooking; message?: string } {
  const candStartYmd = normalizeDateToYMD(candidate.date);
  const candEndYmd = candidate.endDate ? normalizeDateToYMD(candidate.endDate) : candStartYmd;

  const candStartMin = parseTimeToMinutes(candidate.startTime);
  const candEndMin = parseTimeToMinutes(candidate.endTime);

  for (const b of existingBookings) {
    // Skip checking self
    if (candidate.id && b.id === candidate.id) continue;

    // Skip cancelled bookings
    if (b.checkInStatus === "CANCELLED" || (b as any).paymentStatus === "CANCELLED") continue;

    // Must be the same workspace/space to conflict
    if (b.spaceId !== candidate.spaceId) continue;

    const bookStartYmd = normalizeDateToYMD(b.date);
    const bookEndYmd = b.endDate ? normalizeDateToYMD(b.endDate) : bookStartYmd;

    // Check date interval overlap: !(candEndYmd < bookStartYmd || candStartYmd > bookEndYmd)
    const datesOverlap = !(candEndYmd < bookStartYmd || candStartYmd > bookEndYmd);
    if (!datesOverlap) continue;

    // If dates overlap:
    // Case 1: Both are single-day HOURLY bookings on the exact same date
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
        // Standard interval collision: start1 < end2 && start2 < end1
        // Note: strictly less than ensures consecutive slots (e.g. 10-12 and 12-14) do NOT conflict!
        const timesOverlap = candStartMin < bookEndMin && bookStartMin < candEndMin;
        if (timesOverlap) {
          return {
            hasConflict: true,
            conflictingBooking: b,
            message: `Jadwal bentrok: Workspace ${candidate.spaceName || b.spaceName} sudah dipesan oleh ${b.guestName} pada jam ${b.startTime} - ${b.endTime || "Selesai"} (Kode: ${b.bookingCode}).`,
          };
        }
        // If times do not overlap, this booking is fine
        continue;
      }
    }

    // Case 2: One or both are DAILY / MONTHLY or multi-day reservations
    // Daily/Monthly booking reserves the workspace for the full operating hours of the overlapping dates
    return {
      hasConflict: true,
      conflictingBooking: b,
      message: `Jadwal bentrok: Workspace ${candidate.spaceName || b.spaceName} sudah memiliki reservasi aktif (${b.bookingType}) oleh ${b.guestName} pada rentang ${b.date}${b.endDate ? ` s/d ${b.endDate}` : ""} (Kode: ${b.bookingCode}).`,
    };
  }

  return { hasConflict: false };
}

/**
 * Checks if a specific tenant is currently open and accepting orders.
 */
export function isTenantAcceptingOrders(
  tenantId: string,
  tenantOperations?: Record<string, TenantOperationConfig>,
  currentDateObj: Date = new Date()
): { isOpen: boolean; reason: string } {
  const config = tenantOperations?.[tenantId] || DEFAULT_TENANT_OPERATIONS[tenantId];
  if (!config) {
    // If not configured, default to open
    return { isOpen: true, reason: "Mitra beroperasi normal" };
  }

  if (!config.isOpenOrder) {
    return {
      isOpen: false,
      reason: config.notes || "Mitra sedang Tutup Sementara (Open Order dimatikan oleh tenant)",
    };
  }

  // Check operating hours if configured
  if (config.openTime && config.closeTime) {
    const curHours = currentDateObj.getHours();
    const curMinutes = currentDateObj.getMinutes();
    const curTotal = curHours * 60 + curMinutes;

    const openTotal = parseTimeToMinutes(config.openTime) ?? 0;
    const closeTotal = parseTimeToMinutes(config.closeTime) ?? 24 * 60;

    if (curTotal < openTotal || curTotal >= closeTotal) {
      return {
        isOpen: false,
        reason: `Mitra di luar jam operasional (${config.openTime} - ${config.closeTime})`,
      };
    }
  }

  return { isOpen: true, reason: "Mitra buka dan menerima pesanan" };
}

/**
 * Checks if general service (F&B or Co-working) is within operating hours.
 */
export function isServiceWithinHours(
  service: "fnb" | "coworking",
  operationalHours?: ServiceOperationalHours,
  currentDateObj: Date = new Date()
): { isOpen: boolean; reason: string } {
  const config = operationalHours?.[service] || DEFAULT_OPERATIONAL_HOURS[service];
  if (!config.isOpen) {
    return { isOpen: false, reason: `Layanan ${service.toUpperCase()} sedang dinonaktifkan sementara` };
  }

  const curHours = currentDateObj.getHours();
  const curMinutes = currentDateObj.getMinutes();
  const curTotal = curHours * 60 + curMinutes;

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
