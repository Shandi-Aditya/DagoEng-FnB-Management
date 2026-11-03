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
