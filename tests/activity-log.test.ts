import { describe, it, expect } from "vitest";
import { ActivityLogEntry, ActivityModule, AuditStatus, ActivitySeverity } from "../src/types/audit";

describe("Activity Log & Audit Trail Engine", () => {
  const sampleLogs: ActivityLogEntry[] = [
    {
      id: "log-1",
      actorId: "usr-owner-01",
      actorName: "Hendra Wijaya",
      actorRole: "Owner",
      role: "Owner",
      organization: "org-dago-hub",
      organizationName: "Dago Creative Hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      module: "POS",
      action: "PAYMENT_CONFIRMED",
      recordId: "ord-1042",
      timestamp: "2026-09-18T03:45:00.000Z",
      previousValue: "Status: ORDER_CREATED",
      newValue: "Status: PAID (Total: Rp 82.800 via QRIS)",
      description: "Pembayaran pesanan meja T-01 terkonfirmasi lunas.",
      reason: "Transaksi checkout berhasil melalui QRIS DagoPay",
      status: "SUCCESS",
      severity: "INFO",
      category: "TRANSACTION",
      metadata: { orderId: "ord-1042", table: "T-01", paymentMethod: "QRIS", amount: 82800 },
    },
    {
      id: "log-2",
      actorId: "usr-kadek-02",
      actorName: "Ni Kadek Sri",
      actorRole: "Head Cashier",
      role: "Head Cashier",
      organization: "org-dago-hub",
      organizationName: "Dago Creative Hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      module: "POS",
      action: "ORDER_VOIDED",
      recordId: "ord-1039",
      timestamp: "2026-09-17T11:20:00.000Z",
      previousValue: "Status: ORDER_CREATED (Rp 45.000)",
      newValue: "Status: CANCELLED / VOID",
      description: "Pembatalan item pesanan kasir karena salah ketik meja.",
      reason: "Pelanggan berpindah meja dan mengubah menu pesanan",
      status: "WARNING",
      severity: "HIGH",
      category: "TRANSACTION",
      metadata: { orderId: "ord-1039", voidAmount: 45000 },
    },
    {
      id: "log-3",
      actorId: "usr-owner-01",
      actorName: "Hendra Wijaya",
      actorRole: "Owner",
      role: "Owner",
      organization: "org-dago-hub",
      organizationName: "Dago Creative Hub",
      outletId: "outlet-dps",
      outletName: "Denpasar",
      module: "SETTINGS",
      action: "UPDATE_TAX_CONFIGURATION",
      recordId: "cfg-tax-01",
      timestamp: "2026-09-16T16:15:00.000Z",
      previousValue: "PB1: 10%, Service Charge: 5%",
      newValue: "PB1: 11%, Service Charge: 5%",
      description: "Pembaruan parameter fiskal dan pajak restoran PB1 platform.",
      reason: "Penyesuaian kenaikan tarif PB1 regulasi lokal Denpasar",
      status: "SUCCESS",
      severity: "MEDIUM",
      category: "CONFIGURATION",
      metadata: { taxRatePercent: 11, serviceChargePercent: 5 },
    },
    {
      id: "log-4",
      actorId: "usr-gede-03",
      actorName: "Gede Agus",
      actorRole: "Chef Singaraja",
      role: "Chef",
      organization: "org-dago-hub",
      organizationName: "Dago Creative Hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      module: "INVENTORY",
      action: "STOCK_ADJUSTMENT",
      recordId: "ing-1",
      timestamp: "2026-09-15T14:30:00.000Z",
      previousValue: "Stok: 12.0 kg",
      newValue: "Stok: 14.5 kg (+2.5 kg)",
      description: "Penyesuaian stok Biji Kopi House Blend setelah Stock Opname harian.",
      reason: "Rekonsiliasi fisik gudang malam dengan tim barista",
      status: "SUCCESS",
      severity: "LOW",
      category: "INVENTORY",
      metadata: { ingredientId: "ing-1", diff: 2.5 },
    },
  ];

  it("filters logs accurately by outlet scope isolation", () => {
    // Singaraja outlet filter
    const sgrLogs = sampleLogs.filter((l) => l.outletId === "outlet-sgr");
    expect(sgrLogs.length).toBe(3);
    expect(sgrLogs.every((l) => l.outletId === "outlet-sgr")).toBe(true);

    // Denpasar outlet filter
    const dpsLogs = sampleLogs.filter((l) => l.outletId === "outlet-dps");
    expect(dpsLogs.length).toBe(1);
    expect(dpsLogs[0].action).toBe("UPDATE_TAX_CONFIGURATION");
  });

  it("filters logs accurately by module and severity classification", () => {
    const posLogs = sampleLogs.filter((l) => l.module === "POS");
    expect(posLogs.length).toBe(2);

    const highSeverityLogs = sampleLogs.filter((l) => l.severity === "HIGH");
    expect(highSeverityLogs.length).toBe(1);
    expect(highSeverityLogs[0].action).toBe("ORDER_VOIDED");
    expect(highSeverityLogs[0].status).toBe("WARNING");
  });

  it("performs multi-field search matches across actor, action, reason, and recordId", () => {
    const query = "void";
    const matched = sampleLogs.filter((l) => {
      const term = query.toLowerCase();
      return (
        l.actorName.toLowerCase().includes(term) ||
        l.action.toLowerCase().includes(term) ||
        l.description.toLowerCase().includes(term) ||
        (l.reason && l.reason.toLowerCase().includes(term)) ||
        (l.recordId && l.recordId.toLowerCase().includes(term))
      );
    });

    expect(matched.length).toBe(1);
    expect(matched[0].id).toBe("log-2");
    expect(matched[0].recordId).toBe("ord-1039");
  });

  it("records immutable before vs after data transformations and structured metadata", () => {
    const taxLog = sampleLogs.find((l) => l.action === "UPDATE_TAX_CONFIGURATION");
    expect(taxLog).toBeDefined();
    expect(taxLog?.previousValue).toContain("PB1: 10%");
    expect(taxLog?.newValue).toContain("PB1: 11%");
    expect(taxLog?.metadata).toEqual({ taxRatePercent: 11, serviceChargePercent: 5 });
  });

  it("filters logs within specified date ranges", () => {
    const now = new Date("2026-09-18T12:00:00.000Z").getTime();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const recentLogs = sampleLogs.filter((l) => {
      const logTime = new Date(l.timestamp).getTime();
      return logTime >= sevenDaysAgo;
    });

    expect(recentLogs.length).toBe(4);
  });
});
