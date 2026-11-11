import { describe, it, expect } from "vitest";
import {
  filterActivityLogs,
  computeActivityLogStats,
  getUniqueRoles,
  getUniqueActors,
  getStatusTone,
  getSeverityTone,
  getPeriodLabel,
  buildActivityLogExportRows,
} from "@/features/activity-log/activity-log-domain";
import { ActivityLogEntry } from "@/types/audit";

describe("activity-log-domain", () => {
  const sampleLogs: ActivityLogEntry[] = [
    {
      id: "log-1",
      timestamp: new Date().toISOString(),
      actorName: "Ayu Pratiwi",
      actorRole: "KASIR",
      module: "POS",
      action: "VOID_ITEM",
      recordId: "ORD-101",
      status: "WARNING",
      severity: "HIGH",
      description: "Void 1x Espresso",
      reason: "Salah input oleh tamu",
      previousValue: "2x Espresso",
      newValue: "1x Espresso",
      outletId: "out-1",
      tenantId: "TENANT_A",
    },
    {
      id: "log-2",
      timestamp: new Date().toISOString(),
      actorName: "Budi Santoso",
      actorRole: "MANAGER",
      module: "INVENTORY",
      action: "STOCK_ADJUSTMENT",
      recordId: "ING-01",
      status: "SUCCESS",
      severity: "MEDIUM",
      description: "Penyesuaian stok biji kopi",
      outletId: "out-1",
      tenantId: "DAGO_HUB",
    },
    {
      id: "log-3",
      timestamp: "2026-01-01T00:00:00Z",
      actorName: "Citra Dewi",
      actorRole: "SUPER_ADMIN",
      module: "SETTINGS",
      action: "UPDATE_CONFIG",
      status: "FAILED",
      severity: "CRITICAL",
      description: "Gagal update konfigurasi printer",
      outletId: "out-2",
      tenantId: "DAGO_HUB",
    },
  ];

  it("filters logs by module, status, severity, and search", () => {
    const posLogs = filterActivityLogs(sampleLogs, { selectedModule: "POS" });
    expect(posLogs).toHaveLength(1);
    expect(posLogs[0].id).toBe("log-1");

    const warningLogs = filterActivityLogs(sampleLogs, { selectedStatus: "WARNING" });
    expect(warningLogs).toHaveLength(1);
    expect(warningLogs[0].action).toBe("VOID_ITEM");

    const criticalLogs = filterActivityLogs(sampleLogs, { selectedSeverity: "CRITICAL" });
    expect(criticalLogs).toHaveLength(1);
    expect(criticalLogs[0].id).toBe("log-3");

    const searchResult = filterActivityLogs(sampleLogs, { searchTerm: "biji kopi" });
    expect(searchResult).toHaveLength(1);
    expect(searchResult[0].actorName).toBe("Budi Santoso");
  });

  it("enforces tenant isolation when tenant owner", () => {
    const tenantALogs = filterActivityLogs(sampleLogs, {
      isTenantOwner: true,
      tenantId: "TENANT_A",
    });
    expect(tenantALogs).toHaveLength(1);
    expect(tenantALogs[0].id).toBe("log-1");
  });

  it("filters logs by date filter (TODAY vs old)", () => {
    const todayLogs = filterActivityLogs(sampleLogs, { dateFilter: "TODAY" });
    expect(todayLogs.some((l) => l.id === "log-3")).toBe(false);
  });

  it("computes stats accurately", () => {
    const stats = computeActivityLogStats(sampleLogs);
    expect(stats.totalCount).toBe(3);
    expect(stats.successCount).toBe(1);
    expect(stats.warningCount).toBe(1);
    expect(stats.failedCount).toBe(1);
    expect(stats.highSeverityCount).toBe(2); // HIGH + CRITICAL
    expect(stats.integrityPercent).toBe(33); // 1 out of 3
  });

  it("extracts unique roles and actors", () => {
    const roles = getUniqueRoles(sampleLogs);
    expect(roles).toEqual(["KASIR", "MANAGER", "SUPER_ADMIN"]);

    const actors = getUniqueActors(sampleLogs);
    expect(actors).toEqual(["Ayu Pratiwi", "Budi Santoso", "Citra Dewi"]);
  });

  it("returns proper status and severity tones", () => {
    expect(getStatusTone("SUCCESS")).toBe("success");
    expect(getStatusTone("WARNING")).toBe("warning");
    expect(getStatusTone("FAILED")).toBe("destructive");

    expect(getSeverityTone("CRITICAL")).toBe("destructive");
    expect(getSeverityTone("HIGH")).toBe("warning");
    expect(getSeverityTone("MEDIUM")).toBe("info");
    expect(getSeverityTone("INFO")).toBe("neutral");
  });

  it("builds export rows correctly", () => {
    const { headers, rows } = buildActivityLogExportRows(sampleLogs);
    expect(headers).toContain("Timestamp");
    expect(headers).toContain("Nilai Sebelumnya");
    expect(rows).toHaveLength(3);
    expect(rows[0][1]).toBe("Ayu Pratiwi");
  });

  it("formats period labels correctly", () => {
    expect(getPeriodLabel("ALL")).toBe("Semua Rekam Audit");
    expect(getPeriodLabel("LAST_7_DAYS")).toBe("7 Hari Terakhir");
    expect(getPeriodLabel("LAST_30_DAYS")).toBe("30 Hari Terakhir");
    expect(getPeriodLabel("TODAY")).toContain("Hari Ini");
  });
});
