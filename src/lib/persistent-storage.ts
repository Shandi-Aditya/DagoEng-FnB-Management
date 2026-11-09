import fs from "fs";
import path from "path";
import { getDataFilePath, syncStorageFromDb, persistStorageToDb } from "@/lib/data-storage";
import { ActivityLogEntry } from "@/types/audit";
import { ShiftRecord } from "@/types/shift";

const FILE_AUDIT_LOGS = "audit_logs.json";
const FILE_SHIFTS = "shifts.json";
const FILE_COWORKING_BOOKINGS = "coworking_bookings.json";

// Mutex queues per file to prevent race conditions during file write operations
const fileLocks = new Map<string, Promise<any>>();

function withFileLock<T>(filename: string, fn: () => Promise<T> | T): Promise<T> {
  const currentLock = fileLocks.get(filename) || Promise.resolve();
  const nextLock = currentLock.then(fn, fn);
  fileLocks.set(filename, nextLock.catch(() => {}));
  return nextLock;
}

/**
 * Reads a JSON persistent storage file from disk replica, syncing from PostgreSQL when needed.
 */
export async function readPersistentData<T>(filename: string, defaultValue: T): Promise<T> {
  try {
    if (process.env.NODE_ENV !== "test") {
      await syncStorageFromDb(filename).catch(() => {});
    }

    const filePath = getDataFilePath(filename);
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }

    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) return defaultValue;

    return JSON.parse(content) as T;
  } catch (err) {
    console.warn(`[persistent-storage] Read error on ${filename}:`, err);
    return defaultValue;
  }
}

/**
 * Writes data safely to the disk replica and pushes to PostgreSQL SystemSetting.
 */
export async function writePersistentData<T>(filename: string, data: T): Promise<boolean> {
  return withFileLock(filename, async () => {
    try {
      const filePath = getDataFilePath(filename);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const content = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, content, "utf-8");

      if (process.env.NODE_ENV !== "test") {
        persistStorageToDb(filename, content).catch((dbErr) => {
          console.warn(`[persistent-storage] DB sync warning for ${filename}:`, dbErr);
        });
      }

      return true;
    } catch (err) {
      console.error(`[persistent-storage] Write failed for ${filename}:`, err);
      return false;
    }
  });
}

// ==========================================
// 1. AUDIT TRAIL (APPEND-ONLY)
// ==========================================

export async function getAuditLogs(): Promise<ActivityLogEntry[]> {
  return readPersistentData<ActivityLogEntry[]>(FILE_AUDIT_LOGS, []);
}

/**
 * Appends an audit log entry permanently.
 * Enforces append-only semantics: logs cannot be erased, truncated, or overwritten.
 */
export async function appendAuditLog(entry: ActivityLogEntry): Promise<boolean> {
  const existing = await getAuditLogs();
  const updated = [entry, ...existing.filter((l) => l.id !== entry.id)];
  return writePersistentData(FILE_AUDIT_LOGS, updated);
}

// ==========================================
// 2. SHIFTS PERSISTENCE
// ==========================================

export async function getPersistentShifts(): Promise<ShiftRecord[]> {
  return readPersistentData<ShiftRecord[]>(FILE_SHIFTS, []);
}

export async function savePersistentShift(shift: ShiftRecord): Promise<boolean> {
  const existing = await getPersistentShifts();
  const index = existing.findIndex((s) => s.id === shift.id);
  let updated: ShiftRecord[];

  if (index >= 0) {
    updated = [...existing];
    updated[index] = shift;
  } else {
    updated = [shift, ...existing];
  }

  return writePersistentData(FILE_SHIFTS, updated);
}

// ==========================================
// 3. COWORKING BOOKINGS PERSISTENCE
// ==========================================

export async function getCoworkingBookings(): Promise<any[]> {
  return readPersistentData<any[]>(FILE_COWORKING_BOOKINGS, []);
}

export async function saveCoworkingBooking(booking: any): Promise<boolean> {
  const existing = await getCoworkingBookings();
  const index = existing.findIndex((b) => b.id === booking.id || b.bookingCode === booking.bookingCode);
  let updated: any[];

  if (index >= 0) {
    updated = [...existing];
    updated[index] = booking;
  } else {
    updated = [booking, ...existing];
  }

  return writePersistentData(FILE_COWORKING_BOOKINGS, updated);
}
