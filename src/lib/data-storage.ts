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
 * Distributed Cloud Synchronization:
 * On Vercel / serverless deployments where local disk (/tmp) is container-ephemeral,
 * persists and synchronizes critical state across instances using PostgreSQL SystemSetting.
 */
export async function syncStorageFromDb(filename: string): Promise<boolean> {
  if (process.env.NODE_ENV === "test") return false;
  if (!process.env.DATABASE_URL) return false;

  try {
    const { db } = await import("./db");
    const key = `STORAGE_${filename}`;
    const setting = await Promise.race([
      db.systemSetting.findUnique({ where: { key } }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
    ]);

    if (setting && setting.value && setting.value.trim().length > 2) {
      const filePath = getDataFilePath(filename);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, setting.value, "utf-8");
      return true;
    }
  } catch (err) {
    // Non-fatal: continue using local disk replica
    console.warn(`[data-storage] syncStorageFromDb skipped for ${filename}:`, err);
  }
  return false;
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
  if (process.env.NODE_ENV === "test") return true;

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

  try {
    const { db } = await import("./db");
    const key = `STORAGE_${filename}`;

    await Promise.race([
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
      new Promise<never>((_, reject) =>
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
      ),
    ]);
    return true;
  } catch (err: any) {
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

