import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { runOfflineETLValidation, safeAddDecimals, maskSensitive } from "../scripts/migrate-json-to-postgres";

describe("DAGOENG OFFLINE ETL VALIDATOR & SYNTHETIC FIXTURE SUITE", () => {
  it("Masking utility correctly masks PII without leaking sensitive strings", () => {
    expect(maskSensitive("budi.santoso@example.com", "email")).toBe("b**********o@example.com");
    expect(maskSensitive("08123456789", "phone")).toBe("0812****89");
    expect(maskSensitive("tok_abcdef123456789", "token")).toBe("tok_...789");
    expect(maskSensitive(null, "email")).toBe("N/A");
  });

  it("Exact decimal summation prevents floating point inaccuracies", () => {
    // 0.1 + 0.2 in JS float is 0.30000000000000004
    // In our integer/cents representation:
    expect(safeAddDecimals("100000", "200000")).toBe("300000");
    expect(safeAddDecimals(50000, 25000)).toBe("75000");
  });

  it("Audits live data and detects real legacy schema anomalies (read-only)", () => {
    // Record file stats before
    const bookingsPath = path.resolve("data/event_bookings.json");
    const mtimeBefore = fs.statSync(bookingsPath).mtimeMs;

    const report = runOfflineETLValidation();

    // Verify file was NOT modified
    const mtimeAfter = fs.statSync(bookingsPath).mtimeMs;
    expect(mtimeAfter).toBe(mtimeBefore);

    // Verify baseline record counts (greater than or equal to initial seed records)
    expect(report.integrityChecks.eventsCount).toBeGreaterThanOrEqual(16);
    expect(report.integrityChecks.bookingsCount).toBeGreaterThanOrEqual(8);
    expect(report.integrityChecks.organizersCount).toBeGreaterThanOrEqual(9);
    expect(report.integrityChecks.proofsCount).toBeGreaterThanOrEqual(2);

    // Verify financial integrity is calculated and valid
    expect(report.integrityChecks.totalRevenueNominalExact).toMatch(/^Rp\s/);
    expect(report.integrityChecks.paidRevenueNominalExact).toMatch(/^Rp\s/);

    // Verify that legacy bookings missing guestToken are caught
    const guestTokenIssues = report.issues.filter((i) => i.field === "guestToken");
    expect(guestTokenIssues.length).toBeGreaterThanOrEqual(3); // DAGO-EVT-48246, DAGO-EVT-77491, DAGO-EVT-88219
  });

  it("Confirms public payment proof directory does NOT exist (Zero Leaked Exposure)", () => {
    const publicProofsDir = path.resolve("public/images/events/proofs");
    expect(fs.existsSync(publicProofsDir)).toBe(false);
  });
});
