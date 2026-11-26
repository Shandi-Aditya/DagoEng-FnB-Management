export const WITA_TIMEZONE = "Asia/Makassar";

export const SHORT_MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

export const MONTH_INDEX_BY_NAME: Record<string, string> = {
  jan: "01",
  januari: "01",
  january: "01",
  feb: "02",
  februari: "02",
  february: "02",
  mar: "03",
  maret: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  mei: "05",
  jun: "06",
  juni: "06",
  june: "06",
  jul: "07",
  juli: "07",
  july: "07",
  aug: "08",
  agu: "08",
  agt: "08",
  agustus: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  okt: "10",
  oktober: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  des: "12",
  desember: "12",
  december: "12",
};

const WITA_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: WITA_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export interface WitaDateTimeParts {
  year: string;
  month: string;
  day: string;
  hour: number;
  minute: number;
  second: number;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    !Number.isNaN(dt.getTime()) &&
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

const UNZONED_WITA_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;

export function parseUnzonedWitaTimestamp(raw: string): WitaDateTimeParts | null {
  const match = UNZONED_WITA_RE.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  if (!isValidCalendarDate(year, month, day)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return {
    year: match[1],
    month: match[2],
    day: match[3],
    hour,
    minute,
    second,
  };
}

export function extractWitaParts(isoOrDate: string | Date): WitaDateTimeParts | null {
  if (isoOrDate instanceof Date) {
    if (Number.isNaN(isoOrDate.getTime())) return null;
    const partMap = new Map<string, string>();
    for (const part of WITA_PARTS_FORMATTER.formatToParts(isoOrDate)) {
      if (part.type !== "literal") partMap.set(part.type, part.value);
    }
    return {
      year: partMap.get("year") ?? "1970",
      month: partMap.get("month") ?? "01",
      day: partMap.get("day") ?? "01",
      hour: Number(partMap.get("hour") ?? 0),
      minute: Number(partMap.get("minute") ?? 0),
      second: Number(partMap.get("second") ?? 0),
    };
  }

  if (typeof isoOrDate !== "string") return null;
  const raw = isoOrDate.trim();
  if (!raw) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    if (!isValidCalendarDate(year, month, day)) return null;
    return {
      year: dateOnlyMatch[1],
      month: dateOnlyMatch[2],
      day: dateOnlyMatch[3],
      hour: 0,
      minute: 0,
      second: 0,
    };
  }

  if (UNZONED_WITA_RE.test(raw)) {
    return parseUnzonedWitaTimestamp(raw);
  }

  const dmyMatch =
    /^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})(?:[,\s]+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?(?:\s*(?:WITA|WIB|WIT))?)?$/i.exec(
      raw
    );
  if (dmyMatch) {
    const month = MONTH_INDEX_BY_NAME[dmyMatch[2].toLowerCase()];
    if (month) {
      const yearNum = Number(dmyMatch[3]);
      const monthNum = Number(month);
      const dayNum = Number(dmyMatch[1]);
      const hour = Number(dmyMatch[4] ?? 0);
      const minute = Number(dmyMatch[5] ?? 0);
      const second = Number(dmyMatch[6] ?? 0);
      if (
        !isValidCalendarDate(yearNum, monthNum, dayNum) ||
        hour > 23 ||
        minute > 59 ||
        second > 59
      ) {
        return null;
      }
      return {
        year: dmyMatch[3],
        month,
        day: String(dayNum).padStart(2, "0"),
        hour,
        minute,
        second,
      };
    }
  }

  const slashDmyMatch =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\sT]+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?(?:\s*(?:WITA|WIB|WIT))?)?$/i.exec(
      raw
    );
  if (slashDmyMatch) {
    const dayNum = Number(slashDmyMatch[1]);
    const monthNum = Number(slashDmyMatch[2]);
    const yearNum = Number(slashDmyMatch[3]);
    const hour = Number(slashDmyMatch[4] ?? 0);
    const minute = Number(slashDmyMatch[5] ?? 0);
    const second = Number(slashDmyMatch[6] ?? 0);
    if (
      !isValidCalendarDate(yearNum, monthNum, dayNum) ||
      hour > 23 ||
      minute > 59 ||
      second > 59
    ) {
      return null;
    }
    return {
      year: slashDmyMatch[3],
      month: String(monthNum).padStart(2, "0"),
      day: String(dayNum).padStart(2, "0"),
      hour,
      minute,
      second,
    };
  }

  const isoDatePrefix = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(raw);
  if (isoDatePrefix) {
    const yearNum = Number(isoDatePrefix[1]);
    const monthNum = Number(isoDatePrefix[2]);
    const dayNum = Number(isoDatePrefix[3]);
    if (!isValidCalendarDate(yearNum, monthNum, dayNum)) return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return extractWitaParts(parsed);
}

export function getTodayWitaDateString(now: Date = new Date()): string {
  const safeNow = Number.isNaN(now.getTime()) ? new Date() : now;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WITA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(safeNow);
}

export function toWitaDateKey(isoOrDate: string | Date): string {
  const parts = extractWitaParts(isoOrDate);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : "";
}

export function getWitaHour(isoOrDate: string | Date): number | null {
  const parts = extractWitaParts(isoOrDate);
  return parts ? parts.hour : null;
}

/** Formats a date or timestamp in WITA using dd, MM, MMM, yyyy, HH, mm, ss tokens. */
export function formatWitaDateTime(
  isoOrDate: string | Date,
  pattern: string = "dd/MM/yyyy HH:mm"
): string {
  const parts = extractWitaParts(isoOrDate);
  if (!parts) return "";
  const monthIdx = Math.max(0, Math.min(11, Number(parts.month) - 1));
  const tokens: Record<string, string> = {
    yyyy: parts.year,
    MMM: SHORT_MONTH_LABELS[monthIdx] ?? parts.month,
    MM: parts.month,
    dd: parts.day,
    HH: String(parts.hour).padStart(2, "0"),
    mm: String(parts.minute).padStart(2, "0"),
    ss: String(parts.second).padStart(2, "0"),
  };
  return pattern.replace(/yyyy|MMM|MM|dd|HH|mm|ss/g, (token) => tokens[token] ?? token);
}

export function normalizeDateRange(
  start: string,
  end: string,
  fallbackDate: string = getTodayWitaDateString()
): { startDate: string; endDate: string } {
  const startKey = toWitaDateKey(start);
  const endKey = toWitaDateKey(end);
  const resolvedStart = startKey || endKey || fallbackDate;
  const resolvedEnd = endKey || startKey || fallbackDate;
  if (resolvedStart <= resolvedEnd) {
    return { startDate: resolvedStart, endDate: resolvedEnd };
  }
  return { startDate: resolvedEnd, endDate: resolvedStart };
}

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

export function diffDaysInclusive(startKey: string, endKey: string): number {
  const [sy, sm, sd] = startKey.split("-").map(Number);
  const [ey, em, ed] = endKey.split("-").map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return 1;
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  return Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1);
}
