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

    // Verify baseline record counts
    expect(report.integrityChecks.eventsCount).toBe(16);
    expect(report.integrityChecks.bookingsCount).toBe(8);
    expect(report.integrityChecks.organizersCount).toBe(9);
    expect(report.integrityChecks.proofsCount).toBe(2);

    // Verify financial integrity
    expect(report.integrityChecks.totalRevenueNominalExact).toBe("Rp 1.706.000");
    expect(report.integrityChecks.paidRevenueNominalExact).toBe("Rp 506.000");
    expect(report.integrityChecks.pendingRevenueNominalExact).toBe("Rp 1.000.000");
    expect(report.integrityChecks.cancelledRevenueNominalExact).toBe("Rp 200.000");

    // Verify that legacy bookings missing guestToken are caught
    const guestTokenIssues = report.issues.filter((i) => i.field === "guestToken");
    expect(guestTokenIssues.length).toBe(3); // DAGO-EVT-48246, DAGO-EVT-77491, DAGO-EVT-88219
  });

  it("Confirms public payment proof directory does NOT exist (Zero Leaked Exposure)", () => {
    const publicProofsDir = path.resolve("public/images/events/proofs");
    expect(fs.existsSync(publicProofsDir)).toBe(false);
  });
});
