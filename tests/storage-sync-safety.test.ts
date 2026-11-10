import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  syncStorageFromDb,
  persistStorageToDb,
  getStorageSyncStatus,
  setStorageSyncStatus,
  resetStorageSyncStatus,
  DatabasePersistenceError,
  getDataFilePath,
} from "@/lib/data-storage";
import fs from "fs";

vi.mock("@/lib/db", () => {
  return {
    db: {
      systemSetting: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    },
  };
});

describe("PHASE 2: Storage Synchronization Safety & Data Loss Prevention", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetStorageSyncStatus();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetStorageSyncStatus();
    vi.clearAllMocks();
  });

  describe("A. Granular Storage Sync Status Tracking", () => {
    it("1. sets status to UNAVAILABLE when DATABASE_URL is not configured", async () => {
      delete process.env.DATABASE_URL;
      process.env.NODE_ENV = "production";

      const synced = await syncStorageFromDb("events.json");
      expect(synced).toBe(false);
      expect(getStorageSyncStatus("events.json")).toBe("UNAVAILABLE");
    });

    it("2. sets status to TIMEOUT when database query exceeds latency budget", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@ep-host.neon.tech/dagoeng";
      process.env.NODE_ENV = "production";

      const { db } = await import("@/lib/db");
      // Simulate database hanging/cold-start latency > 3500ms
      vi.mocked(db.systemSetting.findUnique).mockImplementation(
        (() => new Promise((resolve) => setTimeout(() => resolve({ key: "STORAGE_events.json", value: "[]" } as any), 5000))) as any
      );

      const synced = await syncStorageFromDb("events.json");
      expect(synced).toBe(false);
      // Critical check: Timeout MUST NOT be treated as empty or synced
      expect(getStorageSyncStatus("events.json")).toBe("TIMEOUT");
    });

    it("3. sets status to EMPTY when database is online but row does not exist", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@ep-host.neon.tech/dagoeng";
      process.env.NODE_ENV = "production";

      const { db } = await import("@/lib/db");
      vi.mocked(db.systemSetting.findUnique).mockResolvedValue(null);

      const synced = await syncStorageFromDb("events.json");
      expect(synced).toBe(false);
      expect(getStorageSyncStatus("events.json")).toBe("EMPTY");
    });

    it("4. sets status to INVALID_DATA and prevents writing corrupt JSON to disk", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@ep-host.neon.tech/dagoeng";
      process.env.NODE_ENV = "production";

      const { db } = await import("@/lib/db");
      vi.mocked(db.systemSetting.findUnique).mockResolvedValue({
        id: "1",
        key: "STORAGE_events.json",
        value: "{ this is invalid json payload ... truncated",
        description: "mock",
        updatedAt: new Date(),
      });

      const synced = await syncStorageFromDb("events.json");
      expect(synced).toBe(false);
      expect(getStorageSyncStatus("events.json")).toBe("INVALID_DATA");
    });

    it("5. sets status to SYNCED and safely writes valid JSON to local disk replica", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@ep-host.neon.tech/dagoeng";
      process.env.NODE_ENV = "production";

      const validEventsJson = JSON.stringify([{ id: "evt-prod-100", title: "Valid Event" }]);
      const { db } = await import("@/lib/db");
      vi.mocked(db.systemSetting.findUnique).mockResolvedValue({
        id: "1",
        key: "STORAGE_events.json",
        value: validEventsJson,
        description: "mock",
        updatedAt: new Date(),
      });

      const synced = await syncStorageFromDb("events.json");
      expect(synced).toBe(true);
      expect(getStorageSyncStatus("events.json")).toBe("SYNCED");

      // Verify file was written to disk
      const filePath = getDataFilePath("events.json");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toBe(validEventsJson);
    });
  });

  describe("B. Data Loss Prevention: Write Protection Guard", () => {
    it("6. rejects persistStorageToDb when previous sync was TIMEOUT to prevent seed clobbering", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@ep-host.neon.tech/dagoeng";
      process.env.NODE_ENV = "production";

      // Status was TIMEOUT during startup
      setStorageSyncStatus("events.json", "TIMEOUT");

      // Attempting to write local seed must be blocked with safe DatabasePersistenceError
      await expect(
        persistStorageToDb("events.json", JSON.stringify([{ id: "initial-seed" }]))
      ).rejects.toThrowError(DatabasePersistenceError);

      await expect(
        persistStorageToDb("events.json", JSON.stringify([{ id: "initial-seed" }]))
      ).rejects.toThrow(/RISK_DATA_LOSS.*TIMEOUT/);
    });

    it("7. rejects persistStorageToDb when previous sync was INVALID_DATA to prevent corrupting state", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@ep-host.neon.tech/dagoeng";
      process.env.NODE_ENV = "production";

      setStorageSyncStatus("event_bookings.json", "INVALID_DATA");

      await expect(
        persistStorageToDb("event_bookings.json", JSON.stringify([]))
      ).rejects.toThrowError(DatabasePersistenceError);

      await expect(
        persistStorageToDb("event_bookings.json", JSON.stringify([]))
      ).rejects.toThrow(/RISK_DATA_LOSS.*INVALID_DATA/);
    });

    it("8. permits persistStorageToDb when status is SYNCED (normal safe operations)", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@ep-host.neon.tech/dagoeng";
      process.env.NODE_ENV = "production";

      setStorageSyncStatus("events.json", "SYNCED");
      const { db } = await import("@/lib/db");
      vi.mocked(db.systemSetting.upsert).mockResolvedValue({ updatedAt: new Date() } as any);

      const success = await persistStorageToDb("events.json", JSON.stringify([]));
      expect(success).toBe(true);
      expect(getStorageSyncStatus("events.json")).toBe("SYNCED");
    });

    it("9. rejects persistStorageToDb when sync status is UNAVAILABLE (offline/unverified)", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@ep-host.neon.tech/dagoeng";
      process.env.NODE_ENV = "production";

      setStorageSyncStatus("events.json", "UNAVAILABLE");

      await expect(
        persistStorageToDb("events.json", JSON.stringify([]))
      ).rejects.toThrowError(DatabasePersistenceError);

      await expect(
        persistStorageToDb("events.json", JSON.stringify([]))
      ).rejects.toThrow(/RISK_DATA_LOSS.*UNAVAILABLE/);
    });

    it("10. atomic create-if-absent when status is EMPTY, preventing concurrent seed overwrite", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@ep-host.neon.tech/dagoeng";
      process.env.NODE_ENV = "production";

      setStorageSyncStatus("events.json", "EMPTY");
      const { db } = await import("@/lib/db");

      // Simulate concurrent creation conflict: another container inserted the row first (Prisma P2002)
      vi.mocked(db.systemSetting.create).mockRejectedValue({
        code: "P2002",
        message: "Unique constraint failed on the fields: (`key`)",
      });

      await expect(
        persistStorageToDb("events.json", JSON.stringify([{ id: "seed-events" }]))
      ).rejects.toThrow(/CONCURRENT_CREATE_CONFLICT/);

      // Status must be invalidated to UNAVAILABLE to force re-sync before writing
      expect(getStorageSyncStatus("events.json")).toBe("UNAVAILABLE");
    });

    it("11. optimistic concurrency check prevents Lost Updates when record is modified concurrently", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@ep-host.neon.tech/dagoeng";
      process.env.NODE_ENV = "production";

      const initialDate = new Date("2026-10-30T10:00:00Z");
      // Simulate that sync tracked updatedAt = initialDate
      setStorageSyncStatus("events.json", "SYNCED", initialDate);

      const { db } = await import("@/lib/db");
      // updateMany returns count: 0 when updatedAt has changed in the database
      vi.mocked(db.systemSetting.updateMany).mockResolvedValue({ count: 0 });

      await expect(
        persistStorageToDb("events.json", JSON.stringify([{ id: "stale-overwrite" }]))
      ).rejects.toThrow(/LOST_UPDATE_PREVENTED/);

      // Status invalidated to UNAVAILABLE
      expect(getStorageSyncStatus("events.json")).toBe("UNAVAILABLE");
    });

    it("12. database failure during persist resets status to UNAVAILABLE, requiring re-sync before retrying", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@ep-host.neon.tech/dagoeng";
      process.env.NODE_ENV = "production";

      setStorageSyncStatus("events.json", "SYNCED");
      const { db } = await import("@/lib/db");
      vi.mocked(db.systemSetting.upsert).mockRejectedValue(new Error("Connection reset by peer"));

      await expect(
        persistStorageToDb("events.json", JSON.stringify([]))
      ).rejects.toThrowError(DatabasePersistenceError);

      // After failure, status is UNAVAILABLE
      expect(getStorageSyncStatus("events.json")).toBe("UNAVAILABLE");

      // Second write attempt without re-sync is immediately rejected by the write guard
      await expect(
        persistStorageToDb("events.json", JSON.stringify([]))
      ).rejects.toThrow(/RISK_DATA_LOSS.*UNAVAILABLE/);
    });
  });
});

