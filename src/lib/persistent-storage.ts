import fs from "fs";
import path from "path";
import { getDataFilePath, syncStorageFromDb, persistStorageToDb } from "@/lib/data-storage";
import { ActivityLogEntry } from "@/types/audit";
import { ShiftRecord } from "@/types/shift";
import { OrderRecord } from "@/types/order";

const FILE_AUDIT_LOGS = "audit_logs.json";
const FILE_SHIFTS = "shifts.json";
const FILE_COWORKING_BOOKINGS = "coworking_bookings.json";
const FILE_POS_ORDERS = "pos_orders.json";
const FILE_LOYALTY_POINTS = "loyalty_points.json";
const FILE_QRIS_SESSIONS = "qris_sessions.json";

export interface LoyaltyPointsRecord {
  customerKey: string; // phone or customerId
  customerName?: string;
  points: number;
  updatedAt: string;
}

export interface QrisVerificationSessionRecord {
  orderId: string;
  invoiceNumber: string;
  expectedAmount: number;
  status: "PENDING" | "VERIFIED_WEBHOOK" | "VERIFIED_SUPERVISOR" | "FAILED";
  verificationMethod?: "GATEWAY_WEBHOOK" | "SUPERVISOR_OVERRIDE";
  transactionId?: string;
  rrn?: string;
  verifiedByUserId?: string;
  verifiedByName?: string;
  verifiedByRole?: string;
  verifiedAt?: string;
  updatedAt: string;
}

// Mutex queues per file to serialize read-modify-write operations atomically
const fileLocks = new Map<string, Promise<any>>();

export function withFileLock<T>(filename: string, fn: () => Promise<T> | T): Promise<T> {
  const currentLock = fileLocks.get(filename) || Promise.resolve();
  const nextLock = currentLock.then(fn, fn);
  fileLocks.set(filename, nextLock.catch(() => {}));
  return nextLock;
}

async function readUnlocked<T>(filename: string, defaultValue: T): Promise<T> {
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

async function writeUnlocked<T>(filename: string, data: T): Promise<boolean> {
  try {
    const filePath = getDataFilePath(filename);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, "utf-8");

    if (process.env.NODE_ENV !== "test") {
      try {
        await persistStorageToDb(filename, content);
      } catch (dbErr) {
        console.warn(`[persistent-storage] DB sync warning for ${filename}:`, dbErr);
      }
    }

    return true;
  } catch (err) {
    console.error(`[persistent-storage] Write failed for ${filename}:`, err);
    return false;
  }
}

/**
 * Reads a JSON persistent storage file from disk replica, syncing from PostgreSQL when needed.
 */
export async function readPersistentData<T>(filename: string, defaultValue: T): Promise<T> {
  return withFileLock(filename, () => readUnlocked(filename, defaultValue));
}

/**
 * Writes data safely to the disk replica and awaits PostgreSQL SystemSetting sync.
 */
export async function writePersistentData<T>(filename: string, data: T): Promise<boolean> {
  return withFileLock(filename, () => writeUnlocked(filename, data));
}

/**
 * Performs an atomic read-modify-write inside the per-file mutex lock so concurrent updates never overwrite each other.
 */
export async function mutatePersistentData<T>(
  filename: string,
  defaultValue: T,
  mutator: (current: T) => Promise<T> | T
): Promise<T> {
  return withFileLock(filename, async () => {
    const current = await readUnlocked(filename, defaultValue);
    const updated = await mutator(current);
    await writeUnlocked(filename, updated);
    return updated;
  });
}

// ==========================================
// 1. AUDIT TRAIL (STRICTLY APPEND-ONLY)
// ==========================================

export async function getAuditLogs(): Promise<ActivityLogEntry[]> {
  return readPersistentData<ActivityLogEntry[]>(FILE_AUDIT_LOGS, []);
}

/**
 * Appends an audit log entry permanently inside an atomic file lock.
 * Enforces append-only semantics: existing logs cannot be erased, truncated, or overwritten.
 */
export async function appendAuditLog(entry: ActivityLogEntry): Promise<ActivityLogEntry> {
  return withFileLock(FILE_AUDIT_LOGS, async () => {
    const existing = await readUnlocked<ActivityLogEntry[]>(FILE_AUDIT_LOGS, []);

    if (entry.id && existing.some((l) => l.id === entry.id)) {
      throw new Error(
        `AUDIT_INTEGRITY_VIOLATION: Audit log entry with ID [${entry.id}] already exists and cannot be overwritten.`
      );
    }

    const finalEntry: ActivityLogEntry = {
      ...entry,
      id: entry.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
    };

    const updated = [finalEntry, ...existing];
    await writeUnlocked(FILE_AUDIT_LOGS, updated);
    return finalEntry;
  });
}

// ==========================================
// 2. SHIFTS PERSISTENCE
// ==========================================

export async function getPersistentShifts(): Promise<ShiftRecord[]> {
  return readPersistentData<ShiftRecord[]>(FILE_SHIFTS, []);
}

export async function savePersistentShift(shift: ShiftRecord): Promise<boolean> {
  await mutatePersistentData<ShiftRecord[]>(FILE_SHIFTS, [], (existing) => {
    const index = existing.findIndex((s) => s.id === shift.id);
    if (index >= 0) {
      const updated = [...existing];
      updated[index] = shift;
      return updated;
    }
    return [shift, ...existing];
  });
  return true;
}

// ==========================================
// 3. COWORKING BOOKINGS PERSISTENCE
// ==========================================

export async function getCoworkingBookings(): Promise<any[]> {
  return readPersistentData<any[]>(FILE_COWORKING_BOOKINGS, []);
}

export async function saveCoworkingBooking(booking: any): Promise<boolean> {
  await mutatePersistentData<any[]>(FILE_COWORKING_BOOKINGS, [], (existing) => {
    const index = existing.findIndex(
      (b) => b.id === booking.id || (booking.bookingCode && b.bookingCode === booking.bookingCode)
    );
    if (index >= 0) {
      const updated = [...existing];
      updated[index] = booking;
      return updated;
    }
    return [booking, ...existing];
  });
  return true;
}

// ==========================================
// 4. POS ORDERS & LOYALTY POINTS PERSISTENCE (POS-33)
// ==========================================

export async function getPersistentOrders(): Promise<OrderRecord[]> {
  return readPersistentData<OrderRecord[]>(FILE_POS_ORDERS, []);
}

export async function savePersistentOrder(order: OrderRecord): Promise<OrderRecord> {
  await mutatePersistentData<OrderRecord[]>(FILE_POS_ORDERS, [], (existing) => {
    const index = existing.findIndex((o) => o.id === order.id);
    if (index >= 0) {
      const updated = [...existing];
      updated[index] = order;
      return updated;
    }
    return [order, ...existing];
  });
  return order;
}

export async function getPersistentLoyaltyPoints(): Promise<LoyaltyPointsRecord[]> {
  return readPersistentData<LoyaltyPointsRecord[]>(FILE_LOYALTY_POINTS, []);
}

export async function updatePersistentLoyaltyPoints(
  customerKey: string,
  pointsDelta: number,
  customerName?: string
): Promise<LoyaltyPointsRecord> {
  const normalizedKey = customerKey.trim().toLowerCase();
  let resultRecord: LoyaltyPointsRecord | null = null;

  await mutatePersistentData<LoyaltyPointsRecord[]>(FILE_LOYALTY_POINTS, [], (existing) => {
    const index = existing.findIndex((r) => r.customerKey.toLowerCase() === normalizedKey);
    const now = new Date().toISOString();
    if (index >= 0) {
      const updated = [...existing];
      const currentPoints = Number(updated[index].points) || 0;
      resultRecord = {
        ...updated[index],
        customerName: customerName || updated[index].customerName,
        points: Math.max(0, currentPoints + pointsDelta),
        updatedAt: now,
      };
      updated[index] = resultRecord;
      return updated;
    } else {
      resultRecord = {
        customerKey: normalizedKey,
        customerName,
        points: Math.max(0, pointsDelta),
        updatedAt: now,
      };
      return [resultRecord, ...existing];
    }
  });

  return resultRecord!;
}

// ==========================================
// 5. QRIS SERVER VERIFICATION SESSIONS (POS-25)
// ==========================================

export async function getPersistentQrisSessions(): Promise<QrisVerificationSessionRecord[]> {
  return readPersistentData<QrisVerificationSessionRecord[]>(FILE_QRIS_SESSIONS, []);
}

export async function getPersistentQrisSession(
  orderIdOrInvoice: string
): Promise<QrisVerificationSessionRecord | null> {
  const target = (orderIdOrInvoice || "").trim();
  if (!target) return null;
  const all = await getPersistentQrisSessions();
  return all.find((s) => s.orderId === target || s.invoiceNumber === target) || null;
}

export async function savePersistentQrisSession(
  session: QrisVerificationSessionRecord
): Promise<QrisVerificationSessionRecord> {
  await mutatePersistentData<QrisVerificationSessionRecord[]>(FILE_QRIS_SESSIONS, [], (existing) => {
    const index = existing.findIndex(
      (s) => s.orderId === session.orderId || s.invoiceNumber === session.invoiceNumber
    );
    if (index >= 0) {
      const updated = [...existing];
      updated[index] = session;
      return updated;
    }
    return [session, ...existing];
  });
  return session;
}
