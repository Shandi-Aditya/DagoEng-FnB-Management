import path from "path";
import fs from "fs";
import os from "os";

let isVercelSeeded = false;

function isVercelEnvironment(): boolean {
  return Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.VERCEL_ENV
  );
}

function ensureVercelStorageSeeded(targetDir: string): void {
  if (isVercelSeeded && fs.existsSync(targetDir)) return;
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const proofsDir = path.join(targetDir, "proofs");
    if (!fs.existsSync(proofsDir)) {
      fs.mkdirSync(proofsDir, { recursive: true });
    }

    const sourceDir = path.join(process.cwd(), "data");
    if (fs.existsSync(sourceDir)) {
      const items = fs.readdirSync(sourceDir);
      for (const item of items) {
        if (item.endsWith(".json")) {
          const srcFile = path.join(sourceDir, item);
          const destFile = path.join(targetDir, item);
          if (!fs.existsSync(destFile)) {
            try {
              fs.copyFileSync(srcFile, destFile);
            } catch (copyErr) {
              console.warn(`[data-storage] Failed to seed ${item} to tmp:`, copyErr);
            }
          }
        }
      }
    }
    isVercelSeeded = true;
  } catch (err) {
    console.error("[data-storage] Error ensuring Vercel storage seeded:", err);
  }
}

/**
 * Centralized Data Storage Path Resolver for DagoEng
 *
 * Guarantees test isolation while preserving active demo data runtime:
 * - Runtime (Development / Production): resolves to `<cwd>/data`
 * - Vercel Serverless: resolves to `<os.tmpdir()>/dago-data` (seeded from `<cwd>/data`)
 * - Testing (Vitest `NODE_ENV === "test"` or `DATA_DIR_OVERRIDE` set): resolves to isolated test directory
 */
export function getDataDirectory(): string {
  if (process.env.DATA_DIR_OVERRIDE && process.env.DATA_DIR_OVERRIDE.trim() !== "") {
    return process.env.DATA_DIR_OVERRIDE;
  }
  if (process.env.NODE_ENV === "test") {
    return path.join(process.cwd(), "data", ".test-storage");
  }

  // In Vercel serverless functions, the project root (/var/task) is strictly read-only.
  // os.tmpdir() (/tmp in Linux) is the only writable filesystem directory available on Vercel.
  if (isVercelEnvironment()) {
    const tmpDataDir = path.join(os.tmpdir(), "dago-data");
    ensureVercelStorageSeeded(tmpDataDir);
    return tmpDataDir;
  }

  return path.join(process.cwd(), "data");
}

export function getDataFilePath(filename: string): string {
  return path.join(getDataDirectory(), filename);
}

/**
 * Returns the private, non-public directory used to store sensitive payment proofs.
 * Guarantees that payment proofs are never placed in public/ or exposed as static assets.
 */
export function getProofsDirectory(): string {
  return path.join(getDataDirectory(), "proofs");
}

export function getProofFilePath(filename: string): string {
  return path.join(getProofsDirectory(), filename);
}

/**
 * Storage Synchronization Status
 * Distinguishes granular database sync states to prevent silent data loss or seed clobbering:
 * - SYNCED: Successfully synchronized from PostgreSQL to local disk replica
 * - EMPTY: Database is online, but no row exists yet for this storage key
 * - UNAVAILABLE: Database is offline, connection refused, or DATABASE_URL not set
 * - TIMEOUT: Database query exceeded safe latency budget (cold-start / high latency)
 * - INVALID_DATA: Record found in DB but payload is corrupt / invalid JSON
 */
export type StorageSyncStatus =
  | "SYNCED"
  | "EMPTY"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "INVALID_DATA";

export interface StorageSyncResult {
  status: StorageSyncStatus;
  filename: string;
  bytes?: number;
  error?: string;
}

const storageSyncStatusMap = new Map<string, StorageSyncStatus>();
const lastSyncedUpdatedAtMap = new Map<string, Date>();

export function getStorageSyncStatus(filename: string): StorageSyncStatus {
  if (process.env.NODE_ENV === "test" && !storageSyncStatusMap.has(filename)) {
    return "SYNCED";
  }
  return storageSyncStatusMap.get(filename) || "UNAVAILABLE";
}

export function setStorageSyncStatus(filename: string, status: StorageSyncStatus, updatedAt?: Date): void {
  storageSyncStatusMap.set(filename, status);
  if (updatedAt) {
    lastSyncedUpdatedAtMap.set(filename, updatedAt);
  } else if (status !== "SYNCED") {
    lastSyncedUpdatedAtMap.delete(filename);
  }
}

export function resetStorageSyncStatus(): void {
  storageSyncStatusMap.clear();
  lastSyncedUpdatedAtMap.clear();
}

/**
 * Distributed Cloud Synchronization:
 * On Vercel / serverless deployments where local disk (/tmp) is container-ephemeral,
 * persists and synchronizes critical state across instances using PostgreSQL SystemSetting.
 *
 * Hardened Safety Invariants:
 * 1. Timeout / connection errors are NEVER treated as an empty database.
 * 2. Unconfirmed or timed-out reads flag the storage state so write operations cannot
 *    clobber existing production records with local seed defaults.
 * 3. JSON payloads are strictly validated before writing to disk replicas.
 */
export async function syncStorageFromDb(filename: string): Promise<boolean> {
  if (process.env.NODE_ENV === "test") {
    // In test environment, if test explicitly mocked status to non-SYNCED, respect it
    if (storageSyncStatusMap.has(filename) && storageSyncStatusMap.get(filename) !== "SYNCED") {
      return false;
    }
    storageSyncStatusMap.set(filename, "SYNCED");
    return true;
  }
  if (!process.env.DATABASE_URL) {
    storageSyncStatusMap.set(filename, "UNAVAILABLE");
    return false;
  }

  try {
    const { db } = await import("./db");
    const key = `STORAGE_${filename}`;

    const queryPromise = db.systemSetting.findUnique({ where: { key } });
    const timeoutPromise = new Promise<"TIMEOUT">((resolve) =>
      setTimeout(() => resolve("TIMEOUT"), 3500)
    );

    const result = await Promise.race([queryPromise, timeoutPromise]);

    if (result === "TIMEOUT") {
      storageSyncStatusMap.set(filename, "TIMEOUT");
      console.warn(`[data-storage] syncStorageFromDb TIMEOUT (3500ms) for ${filename}. Database state unconfirmed.`);
      return false;
    }

    const setting = result;
    if (!setting || !setting.value || setting.value.trim().length === 0) {
      storageSyncStatusMap.set(filename, "EMPTY");
      lastSyncedUpdatedAtMap.delete(filename);
      return false;
    }

    // Integrity check: Validate that data in PostgreSQL is valid JSON before writing to disk
    try {
      const parsed = JSON.parse(setting.value);
      if (typeof parsed !== "object" || parsed === null) {
        storageSyncStatusMap.set(filename, "INVALID_DATA");
        console.error(`[data-storage] syncStorageFromDb INVALID_DATA for ${filename}: Root JSON must be an object or array.`);
        return false;
      }
    } catch (parseErr) {
      storageSyncStatusMap.set(filename, "INVALID_DATA");
      console.error(`[data-storage] syncStorageFromDb INVALID_DATA for ${filename}: Corrupted JSON payload in database.`, parseErr);
      return false;
    }

    // Valid JSON payload confirmed: safely write to local disk replica
    const filePath = getDataFilePath(filename);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, setting.value, "utf-8");

    storageSyncStatusMap.set(filename, "SYNCED");
    if (setting.updatedAt) {
      lastSyncedUpdatedAtMap.set(filename, new Date(setting.updatedAt));
    }
    return true;
  } catch (err) {
    storageSyncStatusMap.set(filename, "UNAVAILABLE");
    lastSyncedUpdatedAtMap.delete(filename);
    console.warn(`[data-storage] syncStorageFromDb UNAVAILABLE for ${filename}:`, err);
    return false;
  }
}

export class DatabasePersistenceError extends Error {
  public readonly filename: string;
  public readonly isTransient: boolean;

  constructor(message: string, filename: string, isTransient: boolean = true) {
    super(message);
    this.name = "DatabasePersistenceError";
    this.filename = filename;
    this.isTransient = isTransient;
    Object.setPrototypeOf(this, DatabasePersistenceError.prototype);
  }
}

export async function persistStorageToDb(filename: string, content: string): Promise<boolean> {
  if (process.env.NODE_ENV === "test") {
    // If test explicitly sets status to TIMEOUT, INVALID_DATA, or UNAVAILABLE, guard against data loss
    const testStatus = storageSyncStatusMap.get(filename);
    if (testStatus === "TIMEOUT" || testStatus === "INVALID_DATA" || testStatus === "UNAVAILABLE") {
      throw new DatabasePersistenceError(
        `RISK_DATA_LOSS: Operasi tulis [${filename}] ditahan karena status sinkronisasi sebelumnya adalah ${testStatus}. Mencegah penimpaan data produksi yang belum terbaca.`,
        filename,
        true
      );
    }
    return true;
  }

  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === "production") {
      throw new DatabasePersistenceError(
        `Gagal menyimpan [${filename}] ke database cloud: DATABASE_URL tidak terkonfigurasi pada runtime Production.`,
        filename,
        false
      );
    }
    console.warn(`[data-storage] DATABASE_URL tidak diset pada local development. Hanya menyimpan ke disk lokal untuk ${filename}`);
    return false;
  }

  // DATA LOSS PREVENTION GUARD:
  // Jika status sinkronisasi file ini adalah TIMEOUT, INVALID_DATA, atau UNAVAILABLE, operasi tulis ditahan
  // demi mencegah state lokal yang unconfirmed/seed/unverified menimpa record PostgreSQL.
  const currentSyncStatus = getStorageSyncStatus(filename);
  if (
    currentSyncStatus === "TIMEOUT" ||
    currentSyncStatus === "INVALID_DATA" ||
    currentSyncStatus === "UNAVAILABLE"
  ) {
    throw new DatabasePersistenceError(
      `RISK_DATA_LOSS: Operasi penyimpanan [${filename}] ditolak demi mencegah penimpaan data produksi. Sinkronisasi sebelumnya berstatus ${currentSyncStatus}. Verifikasi status database sebelum menulis.`,
      filename,
      true
    );
  }

  try {
    const { db } = await import("./db");
    const key = `STORAGE_${filename}`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new DatabasePersistenceError(
              `Batas waktu (timeout 6000ms) penyimpanan [${filename}] ke database PostgreSQL terlampaui. Operasi belum dapat dikonfirmasi oleh database.`,
              filename,
              true
            )
          ),
        6000
      )
    );

    // 1. ATOMIC CREATE-IF-ABSENT:
    // If the record was empty at initial sync, we attempt create().
    // If another node created the record concurrently, Prisma unique constraint (P2002) is triggered.
    if (currentSyncStatus === "EMPTY") {
      try {
        const created = await Promise.race([
          db.systemSetting.create({
            data: {
              key,
              value: content,
              description: `Distributed persistent cloud store for ${filename}`,
            },
          }),
          timeoutPromise,
        ]);
        storageSyncStatusMap.set(filename, "SYNCED");
        if (created?.updatedAt) {
          lastSyncedUpdatedAtMap.set(filename, new Date(created.updatedAt));
        }
        return true;
      } catch (createErr: any) {
        if (createErr?.code === "P2002" || createErr?.message?.includes("Unique constraint")) {
          storageSyncStatusMap.set(filename, "UNAVAILABLE");
          lastSyncedUpdatedAtMap.delete(filename);
          throw new DatabasePersistenceError(
            `CONCURRENT_CREATE_CONFLICT: Baris [${filename}] telah dibuat secara paralel oleh node lain. Re-sync diperlukan sebelum menulis ulang.`,
            filename,
            true
          );
        }
        throw createErr;
      }
    }

    // 2. OPTIMISTIC CONCURRENCY CHECK (Preventing Lost Updates on SYNCED state):
    const lastUpdatedAt = lastSyncedUpdatedAtMap.get(filename);
    if (lastUpdatedAt && typeof db.systemSetting.updateMany === "function") {
      const updateResult = await Promise.race([
        db.systemSetting.updateMany({
          where: {
            key,
            updatedAt: lastUpdatedAt,
          },
          data: {
            value: content,
          },
        }),
        timeoutPromise,
      ]);

      if (updateResult.count === 0) {
        // Record was modified by another node between sync and write!
        storageSyncStatusMap.set(filename, "UNAVAILABLE");
        lastSyncedUpdatedAtMap.delete(filename);
        throw new DatabasePersistenceError(
          `LOST_UPDATE_PREVENTED: Rekaman [${filename}] telah diperbarui di PostgreSQL oleh instance lain. Re-sync diperlukan sebelum menimpa data.`,
          filename,
          true
        );
      }

      // Fetch refreshed updatedAt
      const refreshed = await db.systemSetting.findUnique({
        where: { key },
        select: { updatedAt: true },
      });
      if (refreshed?.updatedAt) {
        lastSyncedUpdatedAtMap.set(filename, new Date(refreshed.updatedAt));
      }
      storageSyncStatusMap.set(filename, "SYNCED");
      return true;
    }

    // 3. FALLBACK UPSERT:
    const upserted = await Promise.race([
      db.systemSetting.upsert({
        where: { key },
        create: {
          key,
          value: content,
          description: `Distributed persistent cloud store for ${filename}`,
        },
        update: {
          value: content,
        },
      }),
      timeoutPromise,
    ]);

    if (upserted?.updatedAt) {
      lastSyncedUpdatedAtMap.set(filename, new Date(upserted.updatedAt));
    }
    storageSyncStatusMap.set(filename, "SYNCED");
    return true;
  } catch (err: any) {
    // Write failure invalidates local state to prevent cascading inconsistency
    storageSyncStatusMap.set(filename, "UNAVAILABLE");
    lastSyncedUpdatedAtMap.delete(filename);
    console.error(`[data-storage] persistStorageToDb critical failure for ${filename}:`, err?.message || err);
    if (err instanceof DatabasePersistenceError) {
      throw err;
    }
    throw new DatabasePersistenceError(
      `Gagal mengamankan penyimpanan [${filename}] ke database PostgreSQL: ${err?.message || "Koneksi database terputus"}`,
      filename,
      true
    );
  }
}

