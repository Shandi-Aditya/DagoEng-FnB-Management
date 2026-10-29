import path from "path";

/**
 * Centralized Data Storage Path Resolver for DagoEng
 *
 * Guarantees test isolation while preserving active demo data runtime:
 * - Runtime (Development / Production): resolves to `<cwd>/data`
 * - Testing (Vitest `NODE_ENV === "test"` or `DATA_DIR_OVERRIDE` set): resolves to isolated test directory
 */
export function getDataDirectory(): string {
  if (process.env.DATA_DIR_OVERRIDE && process.env.DATA_DIR_OVERRIDE.trim() !== "") {
    return process.env.DATA_DIR_OVERRIDE;
  }
  if (process.env.NODE_ENV === "test") {
    return path.join(process.cwd(), "data", ".test-storage");
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
