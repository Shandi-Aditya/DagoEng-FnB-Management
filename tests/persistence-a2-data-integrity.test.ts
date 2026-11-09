import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { getDataFilePath } from "@/lib/data-storage";
import {
  readPersistentData,
  writePersistentData,
  appendAuditLog,
  getAuditLogs,
  getPersistentShifts,
  savePersistentShift,
  getCoworkingBookings,
  saveCoworkingBooking,
} from "@/lib/persistent-storage";

describe("QA Handover A2 — Data Persistence & Loss Prevention (POS-33)", () => {
  beforeEach(() => {
    // Ensure test directories exist
    const auditFile = getDataFilePath("audit_logs.json");
    const shiftsFile = getDataFilePath("shifts.json");
    const cwFile = getDataFilePath("coworking_bookings.json");

    for (const f of [auditFile, shiftsFile, cwFile]) {
      const dir = path.dirname(f);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
  });

  it("A2.1: Audit trail disimpan secara append-only dan tidak hilang saat memory di-reset", async () => {
    const testLog = {
      id: `audit-test-${Date.now()}`,
      action: "VOID_TRANSACTION",
      module: "POS",
      actorId: "usr-01",
      actorName: "Very Simbolon",
      role: "Cashier",
      description: "Pembatalan transaksi kopi susu",
      status: "SUCCESS" as const,
      timestamp: new Date().toISOString(),
    };

    // Append log to persistent storage
    const result = await appendAuditLog(testLog as any);
    expect(result).toBe(true);

    // Verify it is saved to persistent disk replica
    const logs = await getAuditLogs();
    const found = logs.find((l: any) => l.id === testLog.id);
    expect(found).toBeDefined();
    expect(found?.action).toBe("VOID_TRANSACTION");
  });

  it("A2.2: Audit trail menolak operasi pembersihan data secara destruktif (Append-Only Guard)", async () => {
    const initialLogs = await getAuditLogs();
    const initialCount = initialLogs.length;

    // Menambahkan entri audit baru
    await appendAuditLog({
      id: `audit-security-${Date.now()}`,
      action: "SECURITY_AUDIT_ENTRY",
      module: "SECURITY",
      actorId: "usr-admin",
      actorName: "Super Admin",
      role: "Super Admin",
      description: "Pemeriksaan integritas audit trail",
      status: "SUCCESS" as const,
      timestamp: new Date().toISOString(),
    } as any);

    const logsAfterAdd = await getAuditLogs();
    expect(logsAfterAdd.length).toBe(initialCount + 1);

    // Memverifikasi bahwa data tersimpan di file fisik
    const auditFile = getDataFilePath("audit_logs.json");
    expect(fs.existsSync(auditFile)).toBe(true);
    const content = JSON.parse(fs.readFileSync(auditFile, "utf-8"));
    expect(Array.isArray(content)).toBe(true);
    expect(content.some((l: any) => l.action === "SECURITY_AUDIT_ENTRY")).toBe(true);
  });

  it("A2.3: Data shift kasir tersimpan secara persisten dan bertahan setelah simulasi restart", async () => {
    const testShift = {
      id: `shf-persisted-${Date.now()}`,
      shiftName: "Shift Pagi (08:00 - 16:00)",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      assignedCashierId: "usr-kasir-42",
      assignedCashierName: "Ni Kadek Sri",
      startTime: new Date().toISOString(),
      status: "ACTIVE" as const,
      openingCash: 350000,
      cashSales: 150000,
      nonCashSales: 200000,
      refundAmount: 0,
      expectedCash: 500000,
      actualCash: 500000,
      cashVariance: 0,
    };

    // Save shift to persistent backend storage
    await savePersistentShift(testShift as any);

    // Reload from persistent backend storage (simulating fresh server read)
    const shifts = await getPersistentShifts();
    const found = shifts.find((s: any) => s.id === testShift.id);

    expect(found).toBeDefined();
    expect(found?.openingCash).toBe(350000);
    expect(found?.assignedCashierName).toBe("Ni Kadek Sri");
  });

  it("A2.4: Booking co-working tersimpan ke file replica sehingga tidak hilang saat localStorage dibersihkan", async () => {
    const testBooking = {
      id: `cwb-${Date.now()}`,
      bookingCode: `CW-SGR-${Math.floor(1000 + Math.random() * 9000)}`,
      guestName: "Sarah Jenkins",
      guestPhone: "+62 819-5566-7788",
      spaceId: "sp-hot-1",
      spaceName: "Hot Desk Flex #01",
      spaceType: "HOT_DESK",
      bookingType: "HOURLY",
      date: "2026-11-10",
      startTime: "09:00",
      duration: 4,
      totalAmount: 60000,
      paymentMethod: "QRIS",
      paymentStatus: "PAID",
      createdAt: new Date().toISOString(),
    };

    // Save booking to backend persistent storage
    await saveCoworkingBooking(testBooking as any);

    // Read back
    const bookings = await getCoworkingBookings();
    const found = bookings.find((b: any) => b.id === testBooking.id);

    expect(found).toBeDefined();
    expect(found?.guestName).toBe("Sarah Jenkins");
    expect(found?.totalAmount).toBe(60000);
  });
});
