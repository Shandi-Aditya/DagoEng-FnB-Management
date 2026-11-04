import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { DatabasePersistenceError, persistStorageToDb } from "@/lib/data-storage";
import { GET as healthHandler } from "@/app/api/system/health/route";

vi.mock("@/lib/db", () => {
  return {
    db: {
      $queryRaw: vi.fn().mockResolvedValue([{ live: 1 }]),
      systemSetting: {
        upsert: vi.fn().mockResolvedValue({ key: "MOCK", value: "{}" }),
      },
    },
  };
});

describe("Task 1: Error Propagation & Database Persistence Hardening", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("should throw DatabasePersistenceError in production if DATABASE_URL is missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;

    await expect(
      persistStorageToDb("events.json", JSON.stringify([]))
    ).rejects.toThrowError(DatabasePersistenceError);

    await expect(
      persistStorageToDb("events.json", JSON.stringify([]))
    ).rejects.toThrow(/DATABASE_URL tidak terkonfigurasi/);
  });

  it("should include filename and transient flag in DatabasePersistenceError", () => {
    const error = new DatabasePersistenceError("Koneksi gagal", "event_bookings.json", true);
    expect(error.name).toBe("DatabasePersistenceError");
    expect(error.filename).toBe("event_bookings.json");
    expect(error.isTransient).toBe(true);
    expect(error.message).toBe("Koneksi gagal");
  });

  it("should invalidate in-memory cache and rethrow when database upsert fails during saveEventsToDisk", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.systemSetting.upsert).mockRejectedValueOnce(new Error("Neon DB connection dropped"));
    process.env.DATABASE_URL = "postgresql://mock:secret@neon.tech/mockdb";
    process.env.NODE_ENV = "production";

    const { saveEventsToDisk } = await import("@/lib/events");

    await expect(
      saveEventsToDisk([])
    ).rejects.toThrowError(DatabasePersistenceError);
  });
});

describe("Task 2: Secured /api/system/health Access Separation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: "postgresql://postgres:secret123@ep-mock-db.aws.neon.tech/neondb?sslmode=require",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("should return strictly minimal generic response to unauthenticated/public callers without infra leaks", async () => {
    const req = new NextRequest("http://localhost:3000/api/system/health");
    const response = await healthHandler(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.database).toBe("connected");
    expect(body.timestamp).toBeDefined();

    // Critical security check: MUST NOT expose hostname, database name, provider, latency, or environment
    expect(body.host).toBeUndefined();
    expect(body.databaseName).toBeUndefined();
    expect(body.latencyMs).toBeUndefined();
    expect(body.environment).toBeUndefined();
    expect(body.diagnostics).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("ep-mock-db.aws.neon.tech");
    expect(JSON.stringify(body)).not.toContain("secret123");
  });

  it("should return degraded 503 response without leaking connection string if DATABASE_URL is missing for unauthenticated callers", async () => {
    delete process.env.DATABASE_URL;

    const req = new NextRequest("http://localhost:3000/api/system/health");
    const response = await healthHandler(req);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.database).toBe("disconnected");

    // No stack traces or internals
    expect(body.host).toBeUndefined();
    expect(body.message).toBeUndefined();
  });

  it("should return degraded 503 response without leaking connection string if database probe fails for unauthenticated callers", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.$queryRaw).mockRejectedValueOnce(new Error("Connection refused"));

    const req = new NextRequest("http://localhost:3000/api/system/health");
    const response = await healthHandler(req);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.database).toBe("disconnected");

    // No stack traces or internals
    expect(body.host).toBeUndefined();
    expect(body.error).toBeUndefined();
  });
});
