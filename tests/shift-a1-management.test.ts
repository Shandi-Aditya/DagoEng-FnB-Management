import { describe, it, expect, beforeEach } from "vitest";
import { ShiftRecord, ShiftStatus } from "@/types/shift";

// Helper logic simulating the shift reconciliation & validation engine
export function checkShiftReconciliation(shift: ShiftRecord, currentTimeMs: number, maxDurationHours: number = 16): ShiftRecord {
  if (shift.status !== "ACTIVE" && shift.status !== "OPEN") {
    return shift;
  }

  // Parse ISO date or extract timestamp from shift.id or startTime
  let startTimeMs = 0;
  if (shift.id.startsWith("shf-") || shift.id.startsWith("shift-")) {
    const rawTs = Number(shift.id.replace(/\D/g, ""));
    if (rawTs > 1000000000) startTimeMs = rawTs;
  }

  // Fallback if id did not contain numeric timestamp
  if (!startTimeMs && shift.startTime) {
    const parsed = Date.parse(shift.startTime);
    if (!isNaN(parsed)) startTimeMs = parsed;
  }

  if (startTimeMs && currentTimeMs - startTimeMs > maxDurationHours * 60 * 60 * 1000) {
    return {
      ...shift,
      status: "NEEDS_RECONCILIATION",
      closingNotes: (shift.closingNotes ? shift.closingNotes + " • " : "") + "Otomatis dialihkan: Melebihi batas durasi operasional (Perlu Rekonsiliasi)",
    };
  }

  return shift;
}

export function validateManualShiftOpen(params: {
  openingCash: number;
  shiftName: string;
  cashierId: string;
  cashierName: string;
  outletId: string;
  existingShifts: ShiftRecord[];
}): { success: boolean; error?: string; shift?: ShiftRecord } {
  if (params.openingCash === undefined || params.openingCash === null || isNaN(params.openingCash)) {
    return { success: false, error: "Modal awal wajib diisi." };
  }

  if (params.openingCash < 0) {
    return { success: false, error: "Modal awal kas tidak boleh bernilai negatif." };
  }

  if (!params.cashierId) {
    return { success: false, error: "Shift kasir wajib terikat pada akun kasir yang valid." };
  }

  const activeExisting = params.existingShifts.find(
    (s) => (s.status === "ACTIVE" || s.status === "OPEN") && s.outletId === params.outletId
  );

  if (activeExisting) {
    return {
      success: false,
      error: `Shift aktif (${activeExisting.assignedCashierName}) sudah berjalan untuk outlet ini. Tutup sesi sebelumnya terlebih dahulu.`,
    };
  }

  const nowMs = Date.now();
  const newShift: ShiftRecord = {
    id: `shf-${nowMs}`,
    shiftName: params.shiftName,
    outletId: params.outletId,
    outletName: "Singaraja",
    assignedCashierId: params.cashierId,
    assignedCashierName: params.cashierName,
    startTime: new Date(nowMs).toISOString(),
    status: "ACTIVE",
    openingCash: params.openingCash,
    cashSales: 0,
    nonCashSales: 0,
    refundAmount: 0,
    expectedCash: params.openingCash,
    actualCash: params.openingCash,
    cashVariance: 0,
  };

  return { success: true, shift: newShift };
}

describe("QA Handover A1 — Shift Kasir Manual & Rekonsiliasi (POS-01, POS-02, POS-32)", () => {
  it("A1.1: Menolak pembukaan shift otomatis tanpa input modal awal manual", () => {
    // Attempting to open without valid modal awal fails
    const result = validateManualShiftOpen({
      openingCash: NaN,
      shiftName: "Shift Pagi",
      cashierId: "usr-kasir-1",
      cashierName: "Ni Kadek Sri",
      outletId: "outlet-sgr",
      existingShifts: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Modal awal wajib diisi");
  });

  it("A1.2: Memvalidasi modal awal non-negatif dan mengikat shift langsung ke akun kasir yang login", () => {
    const result = validateManualShiftOpen({
      openingCash: 250000,
      shiftName: "Shift Pagi (08:00 - 16:00)",
      cashierId: "usr-kasir-42",
      cashierName: "Ni Kadek Sri",
      outletId: "outlet-sgr",
      existingShifts: [],
    });

    expect(result.success).toBe(true);
    expect(result.shift?.assignedCashierId).toBe("usr-kasir-42");
    expect(result.shift?.assignedCashierName).toBe("Ni Kadek Sri");
    expect(result.shift?.openingCash).toBe(250000);
    expect(result.shift?.status).toBe("ACTIVE");
  });

  it("A1.3: Mencegah pembukaan shift ganda pada outlet yang sama sebelum shift aktif ditutup", () => {
    const existingActive: ShiftRecord = {
      id: `shf-${Date.now() - 3600000}`,
      shiftName: "Shift Pagi",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      assignedCashierId: "usr-kasir-1",
      assignedCashierName: "Budi",
      startTime: new Date().toISOString(),
      status: "ACTIVE",
      openingCash: 300000,
      cashSales: 0,
      nonCashSales: 0,
      refundAmount: 0,
      expectedCash: 300000,
      actualCash: 300000,
      cashVariance: 0,
    };

    const result = validateManualShiftOpen({
      openingCash: 200000,
      shiftName: "Shift Sore",
      cashierId: "usr-kasir-2",
      cashierName: "Siti",
      outletId: "outlet-sgr",
      existingShifts: [existingActive],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("sudah berjalan untuk outlet ini");
  });

  it("A1.4: Menandai shift aktif gantung yang melebihi 16 jam sebagai 'NEEDS_RECONCILIATION'", () => {
    const seventeenHoursAgo = Date.now() - 17 * 60 * 60 * 1000;
    const staleShift: ShiftRecord = {
      id: `shf-${seventeenHoursAgo}`,
      shiftName: "Shift Malam Gantung",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      assignedCashierId: "usr-barista-bandung",
      assignedCashierName: "Barista Community Bandung",
      startTime: new Date(seventeenHoursAgo).toISOString(),
      status: "ACTIVE",
      openingCash: 500000,
      cashSales: 0,
      nonCashSales: 0,
      refundAmount: 0,
      expectedCash: 500000,
      actualCash: 500000,
      cashVariance: 0,
    };

    const reconciled = checkShiftReconciliation(staleShift, Date.now(), 16);

    expect(reconciled.status).toBe("NEEDS_RECONCILIATION");
    expect(reconciled.closingNotes).toContain("Perlu Rekonsiliasi");
  });

  it("A1.5: Shift yang baru berjalan (<16 jam) tetap berstatus ACTIVE", () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const ongoingShift: ShiftRecord = {
      id: `shf-${twoHoursAgo}`,
      shiftName: "Shift Pagi Segar",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      assignedCashierId: "usr-kasir-1",
      assignedCashierName: "Ni Kadek Sri",
      startTime: new Date(twoHoursAgo).toISOString(),
      status: "ACTIVE",
      openingCash: 200000,
      cashSales: 0,
      nonCashSales: 0,
      refundAmount: 0,
      expectedCash: 200000,
      actualCash: 200000,
      cashVariance: 0,
    };

    const reconciled = checkShiftReconciliation(ongoingShift, Date.now(), 16);

    expect(reconciled.status).toBe("ACTIVE");
  });
});
