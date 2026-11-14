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
const inFlightWriteTracker = new Map<string, Set<Promise<any>>>();
const reconciliationGateSet = new Set<string>();
const activeReconciliationPromises = new Map<string, Promise<StorageSyncSnapshot>>();

export function isReconciliationGateActive(filename: string): boolean {
  return reconciliationGateSet.has(filename);
}

export function setReconciliationGateForTest(filename: string, active: boolean): void {
  if (active) {
    reconciliationGateSet.add(filename);
  } else {
    reconciliationGateSet.delete(filename);
  }
}

let reconciliationTimeoutMs = 10000;
export function setReconciliationTimeoutForTest(ms: number): void {
  reconciliationTimeoutMs = ms;
}

export type DatabaseReadHandler = (filename: string, key: string) => Promise<{ value: string; updatedAt?: Date | string } | null>;
let testDatabaseReadHandler: DatabaseReadHandler | null = null;
let testDiskWriteHandler: ((filename: string, content: string) => Promise<void> | void) | null = null;

export function setTestDatabaseReadHandler(handler: DatabaseReadHandler | null): void {
  testDatabaseReadHandler = handler;
}

export function setTestDiskWriteHandler(handler: ((filename: string, content: string) => Promise<void> | void) | null): void {
  testDiskWriteHandler = handler;
}

export function getInFlightWriteCount(filename: string): number {
  return inFlightWriteTracker.get(filename)?.size || 0;
}

export function registerInFlightWrite(filename: string, promise: Promise<any>): void {
  let fileInFlight = inFlightWriteTracker.get(filename);
  if (!fileInFlight) {
    fileInFlight = new Set<Promise<any>>();
    inFlightWriteTracker.set(filename, fileInFlight);
  }
  fileInFlight.add(promise);
  promise.finally(() => {
    const currentSet = inFlightWriteTracker.get(filename);
    if (currentSet) {
      currentSet.delete(promise);
      if (currentSet.size === 0) {
        inFlightWriteTracker.delete(filename);
      }
    }
  }).catch(() => {});
}

export function clearInFlightWrites(): void {
  inFlightWriteTracker.clear();
}

export function getStorageSyncStatus(filename: string): StorageSyncStatus {
  if (process.env.NODE_ENV === "test" && !storageSyncStatusMap.has(filename)) {
    return "SYNCED";
  }
  return storageSyncStatusMap.get(filename) || "UNAVAILABLE";
}

export function getLastSyncedUpdatedAt(filename: string): Date | undefined {
  return lastSyncedUpdatedAtMap.get(filename);
}

export interface StorageSyncSnapshot {
  success: boolean;
  updatedAt?: Date;
  status: StorageSyncStatus;
  recordFound?: boolean;
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
  clearInFlightWrites();
  reconciliationGateSet.clear();
  activeReconciliationPromises.clear();
  testDatabaseReadHandler = null;
  testDiskWriteHandler = null;
  reconciliationTimeoutMs = 10000;
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
 * 4. Reconciliation Gate per filename prevents new writes from arriving during reconciliation.
 */
export function syncStorageFromDbInternal(filename: string): Promise<StorageSyncSnapshot> {
  // Concurrent reconciliation guard for the same filename:
  // If a reconciliation is already running for this filename, await and reuse the same promise.
  const existingReconciliation = activeReconciliationPromises.get(filename);
  if (existingReconciliation) {
    return existingReconciliation;
  }

  // 1. Synchronously activate reconciliation gate before any asynchronous operations
  reconciliationGateSet.add(filename);

  const reconPromise = (async (): Promise<StorageSyncSnapshot> => {
    try {
      // 2. Drain all in-flight write queries that started before gate activation
      const startReconTime = Date.now();
      const maxBudgetMs = reconciliationTimeoutMs;

      while (getInFlightWriteCount(filename) > 0) {
        const elapsed = Date.now() - startReconTime;
        const remainingBudget = maxBudgetMs - elapsed;
        if (remainingBudget <= 0) {
          storageSyncStatusMap.set(filename, "UNAVAILABLE");
          lastSyncedUpdatedAtMap.delete(filename);
          console.warn(`[data-storage] syncStorageFromDb rekonsiliasi timeout (${maxBudgetMs}ms) menunggu operasi tulis [${filename}]. Status dipertahankan UNAVAILABLE.`);
          return {
            success: false,
            status: "UNAVAILABLE",
            recordFound: false,
          };
        }

        const currentPending = Array.from(inFlightWriteTracker.get(filename) || []);
        const drainTimeout = new Promise<"DRAIN_TIMEOUT">((resolve) =>
          setTimeout(() => resolve("DRAIN_TIMEOUT"), Math.min(remainingBudget, 50))
        );
        const waitResult = await Promise.race([
          Promise.allSettled(currentPending),
          drainTimeout,
        ]);

        if (waitResult === "DRAIN_TIMEOUT") {
          continue;
        }
      }

      // Fast path in test environment when not explicitly simulating DB reconciliation
      if (process.env.NODE_ENV === "test" && !testDatabaseReadHandler) {
        if (storageSyncStatusMap.has(filename) && storageSyncStatusMap.get(filename) !== "SYNCED") {
          return {
            success: false,
            status: storageSyncStatusMap.get(filename)!,
            recordFound: false,
          };
        }
        if (getInFlightWriteCount(filename) > 0) {
          storageSyncStatusMap.set(filename, "UNAVAILABLE");
          return {
            success: false,
            status: "UNAVAILABLE",
            recordFound: false,
          };
        }
        storageSyncStatusMap.set(filename, "SYNCED");
        const existingUpdatedAt = lastSyncedUpdatedAtMap.get(filename) || new Date("2026-01-01T00:00:00.000Z");
        lastSyncedUpdatedAtMap.set(filename, existingUpdatedAt);
        return {
          success: true,
          status: "SYNCED",
          updatedAt: new Date(existingUpdatedAt.getTime()),
          recordFound: true,
        };
      }

      if (!testDatabaseReadHandler && !process.env.DATABASE_URL) {
        storageSyncStatusMap.set(filename, "UNAVAILABLE");
        return {
          success: false,
          status: "UNAVAILABLE",
          recordFound: false,
        };
      }

      // 3. Database Reconciliation
      const key = `STORAGE_${filename}`;
      let setting: { value: string; updatedAt?: Date | string } | null = null;

      if (testDatabaseReadHandler) {
        setting = await testDatabaseReadHandler(filename, key);
      } else {
        const { db } = await import("./db");
        const queryPromise = db.systemSetting.findUnique({ where: { key } });
        const timeoutPromise = new Promise<"TIMEOUT">((resolve) =>
          setTimeout(() => resolve("TIMEOUT"), 8000)
        );

        const result = await Promise.race([queryPromise, timeoutPromise]);
        if (result === "TIMEOUT") {
          storageSyncStatusMap.set(filename, "TIMEOUT");
          console.warn(`[data-storage] syncStorageFromDb TIMEOUT (8000ms) for ${filename}. Database state unconfirmed.`);
          return {
            success: false,
            status: "TIMEOUT",
            recordFound: false,
          };
        }
        setting = result;
      }

      if (!setting || !setting.value || setting.value.trim().length === 0) {
        storageSyncStatusMap.set(filename, "EMPTY");
        lastSyncedUpdatedAtMap.delete(filename);
        return {
          success: false,
          status: "EMPTY",
          recordFound: false,
        };
      }

      // Integrity check: Validate that data in PostgreSQL is valid JSON before writing to disk
      try {
        const parsed = JSON.parse(setting.value);
        if (typeof parsed !== "object" || parsed === null) {
          storageSyncStatusMap.set(filename, "INVALID_DATA");
          console.error(`[data-storage] syncStorageFromDb INVALID_DATA for ${filename}: Root JSON must be an object or array.`);
          return {
            success: false,
            status: "INVALID_DATA",
            recordFound: true,
          };
        }
      } catch (parseErr) {
        storageSyncStatusMap.set(filename, "INVALID_DATA");
        console.error(`[data-storage] syncStorageFromDb INVALID_DATA for ${filename}: Corrupted JSON payload in database.`, parseErr);
        return {
          success: false,
          status: "INVALID_DATA",
          recordFound: true,
        };
      }

      // Write to local disk replica
      if (testDiskWriteHandler) {
        await testDiskWriteHandler(filename, setting.value);
      } else {
        const filePath = getDataFilePath(filename);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, setting.value, "utf-8");
      }

      // Pre-commit check: pastikan tidak ada write aktif sebelum menetapkan SYNCED
      if (getInFlightWriteCount(filename) > 0) {
        storageSyncStatusMap.set(filename, "UNAVAILABLE");
        return {
          success: false,
          status: "UNAVAILABLE",
          recordFound: true,
        };
      }

      const snapshotUpdatedAt = setting.updatedAt ? new Date(setting.updatedAt) : undefined;
      storageSyncStatusMap.set(filename, "SYNCED");
      if (snapshotUpdatedAt) {
        lastSyncedUpdatedAtMap.set(filename, snapshotUpdatedAt);
      }
      return {
        success: true,
        status: "SYNCED",
        updatedAt: snapshotUpdatedAt ? new Date(snapshotUpdatedAt.getTime()) : undefined,
        recordFound: true,
      };
    } catch (err) {
      storageSyncStatusMap.set(filename, "UNAVAILABLE");
      lastSyncedUpdatedAtMap.delete(filename);
      console.warn(`[data-storage] syncStorageFromDb UNAVAILABLE for ${filename}:`, err);
      return {
        success: false,
        status: "UNAVAILABLE",
        recordFound: false,
      };
    } finally {
      // Ensure gate is unconditionally released
      reconciliationGateSet.delete(filename);
      activeReconciliationPromises.delete(filename);
    }
  })();

  activeReconciliationPromises.set(filename, reconPromise);
  reconPromise.finally(() => {
    reconciliationGateSet.delete(filename);
    activeReconciliationPromises.delete(filename);
  }).catch(() => {});

  return reconPromise;
}

/**
 * Returns an isolated per-request snapshot of the database synchronization state directly
 * from the database query result. Does NOT re-read module-level Map after async reconciliation.
 */
export function syncStorageFromDbWithSnapshot(filename: string): Promise<StorageSyncSnapshot> {
  return syncStorageFromDbInternal(filename);
}

const activeBooleanReconciliationPromises = new Map<string, Promise<boolean>>();

export function syncStorageFromDb(filename: string): Promise<boolean> {
  const existing = activeBooleanReconciliationPromises.get(filename);
  if (existing) {
    return existing;
  }
  const boolPromise = (async () => {
    try {
      const snapshot = await syncStorageFromDbInternal(filename);
      return snapshot.success;
    } finally {
      activeBooleanReconciliationPromises.delete(filename);
    }
  })();
  activeBooleanReconciliationPromises.set(filename, boolPromise);
  return boolPromise;
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

export function markStorageSyncSynced(filename: string, updatedAt?: Date): void {
  storageSyncStatusMap.set(filename, "SYNCED");
  if (updatedAt) {
    lastSyncedUpdatedAtMap.set(filename, updatedAt);
  }
}

export async function persistStorageToDb(
  filename: string,
  content: string,
  options?: { expectedUpdatedAt?: Date; requireCas?: boolean; tx?: any }
): Promise<boolean> {
  // 1. RECONCILIATION GATE GUARD:
  // Operasi tulis ditolak jika rekonsiliasi database sedang berlangsung untuk filename ini demi integritas data
  if (isReconciliationGateActive(filename)) {
    throw new DatabasePersistenceError(
      `RECONCILIATION_IN_PROGRESS: Operasi penyimpanan [${filename}] ditolak karena proses rekonsiliasi database sedang berlangsung. Silakan coba beberapa saat lagi.`,
      filename,
      true
    );
  }

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
    if (options?.requireCas) {
      if (!options.expectedUpdatedAt || !(options.expectedUpdatedAt instanceof Date) || isNaN(options.expectedUpdatedAt.getTime())) {
        storageSyncStatusMap.set(filename, "UNAVAILABLE");
        throw new DatabasePersistenceError(
          `CAS_SNAPSHOT_INVALID: Operasi penyimpanan [${filename}] dengan CAS wajib ditolak karena expectedUpdatedAt tidak valid atau tidak disediakan.`,
          filename,
          true
        );
      }
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
    const client = options?.tx || (await import("./db")).db;
    const key = `STORAGE_${filename}`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new DatabasePersistenceError(
              `Batas waktu (timeout 8000ms) penyimpanan [${filename}] ke database PostgreSQL terlampaui. Operasi belum dapat dikonfirmasi oleh database.`,
              filename,
              true
            )
          ),
        8000
      )
    );

    // 1. ATOMIC CREATE-IF-ABSENT:
    // If the record was empty at initial sync, we attempt create().
    // If another node created the record concurrently, Prisma unique constraint (P2002) is triggered.
    if (currentSyncStatus === "EMPTY") {
      try {
        const createQuery = client.systemSetting.create({
          data: {
            key,
            value: content,
            description: `Distributed persistent cloud store for ${filename}`,
          },
        });
        registerInFlightWrite(filename, createQuery);
        const created = await Promise.race([createQuery, timeoutPromise]);
        if (!options?.tx) {
          storageSyncStatusMap.set(filename, "SYNCED");
          if (created?.updatedAt) {
            lastSyncedUpdatedAtMap.set(filename, new Date(created.updatedAt));
          }
        }
        return true;
      } catch (createErr: any) {
        if (createErr?.code === "P2002" || createErr?.message?.includes("Unique constraint")) {
          if (!options?.tx) {
            storageSyncStatusMap.set(filename, "UNAVAILABLE");
            lastSyncedUpdatedAtMap.delete(filename);
          }
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
    if (options?.requireCas) {
      if (!options.expectedUpdatedAt || !(options.expectedUpdatedAt instanceof Date) || isNaN(options.expectedUpdatedAt.getTime())) {
        storageSyncStatusMap.set(filename, "UNAVAILABLE");
        throw new DatabasePersistenceError(
          `CAS_SNAPSHOT_INVALID: Operasi penyimpanan [${filename}] dengan CAS wajib ditolak karena snapshot expectedUpdatedAt tidak valid atau tidak disediakan.`,
          filename,
          true
        );
      }
    }

    // In strict CAS mode, ONLY options.expectedUpdatedAt is accepted. NEVER fall back to global map!
    const lastUpdatedAt = options?.requireCas
      ? options.expectedUpdatedAt
      : (options?.expectedUpdatedAt ?? lastSyncedUpdatedAtMap.get(filename));
    if (lastUpdatedAt && typeof client.systemSetting.updateMany === "function") {
      const updateQuery = (async () => {
        const updateResult = await client.systemSetting.updateMany({
          where: {
            key,
            updatedAt: lastUpdatedAt,
          },
          data: {
            value: content,
          },
        });

        if (updateResult.count === 0) {
          if (!options?.tx) {
            storageSyncStatusMap.set(filename, "UNAVAILABLE");
            lastSyncedUpdatedAtMap.delete(filename);
          }
          throw new DatabasePersistenceError(
            `LOST_UPDATE_PREVENTED: Rekaman [${filename}] telah diperbarui di PostgreSQL oleh instance lain. Re-sync diperlukan sebelum menimpa data.`,
            filename,
            true
          );
        }

        const refreshed = await client.systemSetting.findUnique({
          where: { key },
          select: { updatedAt: true },
        });
        return refreshed;
      })();

      registerInFlightWrite(filename, updateQuery);
      const refreshed = await Promise.race([updateQuery, timeoutPromise]);

      if (!options?.tx) {
        if (refreshed?.updatedAt) {
          lastSyncedUpdatedAtMap.set(filename, new Date(refreshed.updatedAt));
        }
        storageSyncStatusMap.set(filename, "SYNCED");
      }
      return true;
    }

    if (options?.requireCas || (currentSyncStatus === "SYNCED" && !lastUpdatedAt)) {
      if (!options?.tx) {
        storageSyncStatusMap.set(filename, "UNAVAILABLE");
      }
      throw new DatabasePersistenceError(
        `LOST_UPDATE_PREVENTED: Rekaman [${filename}] berada pada status SYNCED namun metadata updatedAt tidak ditemukan atau tidak cocok. Re-sync diperlukan sebelum menimpa data.`,
        filename,
        true
      );
    }

    // 3. FALLBACK UPSERT:
    const upsertQuery = client.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value: content,
        description: `Distributed persistent cloud store for ${filename}`,
      },
      update: {
        value: content,
      },
    });
    registerInFlightWrite(filename, upsertQuery);
    const upserted = await Promise.race([upsertQuery, timeoutPromise]);

    if (!options?.tx) {
      if (upserted?.updatedAt) {
        lastSyncedUpdatedAtMap.set(filename, new Date(upserted.updatedAt));
      }
      storageSyncStatusMap.set(filename, "SYNCED");
    }
    return true;
  } catch (err: any) {
    // Write failure invalidates local state to prevent cascading inconsistency (only if not uncommitted tx)
    if (!options?.tx) {
      storageSyncStatusMap.set(filename, "UNAVAILABLE");
      lastSyncedUpdatedAtMap.delete(filename);
    }
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

