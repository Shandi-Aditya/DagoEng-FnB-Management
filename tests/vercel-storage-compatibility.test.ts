import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import { getDataDirectory, getDataFilePath, getProofsDirectory } from "../src/lib/data-storage";
import { isSafePublicUrl } from "../src/lib/events";

describe("Vercel Serverless Storage Compatibility", () => {
  const originalVercel = process.env.VERCEL;
  const originalOverride = process.env.DATA_DIR_OVERRIDE;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    delete process.env.DATA_DIR_OVERRIDE;
  });

  afterEach(() => {
    if (originalVercel !== undefined) process.env.VERCEL = originalVercel;
    else delete process.env.VERCEL;

    if (originalOverride !== undefined) process.env.DATA_DIR_OVERRIDE = originalOverride;
    else delete process.env.DATA_DIR_OVERRIDE;

    process.env.NODE_ENV = originalNodeEnv;
  });

  it("1. should route storage to /tmp/dago-data and auto-seed baseline data when on Vercel", () => {
    process.env.NODE_ENV = "production";
    process.env.VERCEL = "1";

    const dir = getDataDirectory();
    expect(dir).toContain("dago-data");

    // Verify proofs directory is inside /tmp/dago-data
    const proofsDir = getProofsDirectory();
    expect(proofsDir).toContain("proofs");

    // Verify file path resolves correctly
    const eventsPath = getDataFilePath("events.json");
    expect(eventsPath).toContain("events.json");

    // Verify seeded file exists
    expect(fs.existsSync(eventsPath)).toBe(true);
  });

  it("2. should validate and allow data URI for uploaded event posters in serverless environment", () => {
    const sampleDataUri = "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/2QAA";
    const check = isSafePublicUrl(sampleDataUri);
    expect(check.safe).toBe(true);
  });

  it("3. should still block unsafe SSRF URLs even when data URIs are allowed", () => {
    expect(isSafePublicUrl("http://localhost:3000/api").safe).toBe(false);
    expect(isSafePublicUrl("http://127.0.0.1:8080").safe).toBe(false);
    expect(isSafePublicUrl("http://169.254.169.254/latest/meta-data/").safe).toBe(false);
    expect(isSafePublicUrl("ftp://example.com/image.jpg").safe).toBe(false);
  });
});

