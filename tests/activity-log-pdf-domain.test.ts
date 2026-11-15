import { describe, it, expect } from "vitest";
import {
  computeActivityLogPdfMetrics,
  buildAuditSignatories,
  formatAuditPrintDate,
  formatAuditStatusLabel,
  formatAuditDiffValues,
} from "@/features/activity-log/activity-log-pdf-domain";
import type { ActivityLogEntry } from "@/types/audit";

describe("activity-log-pdf-domain", () => {
  const mockLogs: ActivityLogEntry[] = [
    {
      id: "log-1",
      actorId: "usr-1",
      actorName: "Hendra Wijaya",
      actorRole: "Owner",
      module: "POS",
      action: "PAYMENT_CONFIRMED",
      recordId: "ord-1",
      timestamp: "2026-11-15T02:00:00.000Z",
      description: "Pembayaran lunas",
      status: "SUCCESS",
      severity: "INFO",
      previousValue: "ORDER_CREATED",
      newValue: "PAID",
    },
    {
      id: "log-2",
      actorId: "usr-2",
      actorName: "Ni Kadek Sri",
      actorRole: "Kasir",
      module: "POS",
      action: "ORDER_VOIDED",
      recordId: "ord-2",
      timestamp: "2026-11-15T03:00:00.000Z",
      description: "Pembatalan item",
      status: "WARNING",
      severity: "HIGH",
      reason: "Salah meja",
    },
    {
      id: "log-3",
      actorId: "usr-3",
      actorName: "Gede Agus",
      actorRole: "Chef",
      module: "INVENTORY",
      action: "STOCK_ADJUSTMENT",
      recordId: "ing-1",
      timestamp: "2026-11-15T04:00:00.000Z",
      description: "Penyesuaian stok",
      status: "FAILED",
      severity: "CRITICAL",
      reason: "Bahan rusak",
    },
  ];

  it("computes executive summary metrics accurately without mutation", () => {
    const metrics = computeActivityLogPdfMetrics(mockLogs);
    expect(metrics.totalCount).toBe(3);
    expect(metrics.successCount).toBe(1);
    expect(metrics.warningCount).toBe(1);
    expect(metrics.failedCount).toBe(1);
    expect(metrics.highSeverityCount).toBe(2); // HIGH + CRITICAL
  });

  it("handles empty logs gracefully", () => {
    const metrics = computeActivityLogPdfMetrics([]);
    expect(metrics.totalCount).toBe(0);
    expect(metrics.successCount).toBe(0);
    expect(metrics.warningCount).toBe(0);
    expect(metrics.failedCount).toBe(0);
    expect(metrics.highSeverityCount).toBe(0);
  });

  it("builds factual 3-party audit signatories", () => {
    const signatories = buildAuditSignatories("Hendra Wijaya", "Singaraja (Pusat)");
    expect(signatories).toHaveLength(3);
    expect(signatories[0].role).toBe("Pembuat Laporan / Operator");
    expect(signatories[0].name).toBe("Hendra Wijaya");
    expect(signatories[1].role).toBe("Supervisor / Auditor Gerai");
    expect(signatories[2].role).toBe("Pimpinan / Owner Gerai");
  });

  it("formats audit print date in WITA standard Indonesian format", () => {
    const date = new Date("2026-11-15T02:30:00.000Z");
    const formatted = formatAuditPrintDate(date);
    expect(formatted).toContain("15 Nov 2026");
    expect(formatted).toContain("WITA");
  });

  it("formats audit status label into Indonesian sentence case", () => {
    expect(formatAuditStatusLabel("SUCCESS")).toBe("Sukses");
    expect(formatAuditStatusLabel("WARNING")).toBe("Peringatan");
    expect(formatAuditStatusLabel("FAILED")).toBe("Gagal");
  });

  it("formats audit diff values cleanly", () => {
    const diff = formatAuditDiffValues("ORDER_CREATED", "PAID");
    expect(diff.hasDiff).toBe(true);
    expect(diff.before).toBe("ORDER_CREATED");
    expect(diff.after).toBe("PAID");

    const noDiff = formatAuditDiffValues(undefined, undefined);
    expect(noDiff.hasDiff).toBe(false);
  });
});
