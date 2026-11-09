import { ShiftRecord, ShiftStatus } from "@/types/shift";
import { RoleSlug } from "@/types/auth";

export const MAX_SHIFT_DURATION_HOURS = 16;

/**
 * Extracts the start timestamp in milliseconds from a ShiftRecord.
 */
export function extractShiftStartTimeMs(shift: ShiftRecord): number {
  if (shift.id) {
    const match = shift.id.match(/^(?:shf|shift)-(\d{10,15})/);
    if (match) {
      const ts = Number(match[1]);
      if (ts > 1000000000) return ts;
    }
  }

  if (shift.startTime) {
    const parsed = Date.parse(shift.startTime);
    if (!isNaN(parsed)) return parsed;
  }

  return 0;
}

/**
 * Checks whether a single shift has exceeded the operational duration limit (default 16 hours)
 * and transitions it from ACTIVE/OPEN to NEEDS_RECONCILIATION.
 */
export function checkShiftReconciliation(
  shift: ShiftRecord,
  currentTimeMs: number = Date.now(),
  maxDurationHours: number = MAX_SHIFT_DURATION_HOURS
): ShiftRecord {
  if (shift.status !== "ACTIVE" && shift.status !== "OPEN") {
    return shift;
  }

  const startTimeMs = extractShiftStartTimeMs(shift);
  if (startTimeMs > 0 && currentTimeMs - startTimeMs > maxDurationHours * 60 * 60 * 1000) {
    const noteSuffix =
      "Otomatis dialihkan: Melebihi batas durasi operasional (Perlu Rekonsiliasi)";
    const alreadyHasNote = shift.closingNotes?.includes("Perlu Rekonsiliasi");
    return {
      ...shift,
      status: "NEEDS_RECONCILIATION" as ShiftStatus,
      closingNotes: alreadyHasNote
        ? shift.closingNotes
        : (shift.closingNotes ? shift.closingNotes + " • " : "") + noteSuffix,
    };
  }

  return shift;
}

/**
 * Runs reconciliation checks across a list of shifts and returns updated shifts.
 */
export function reconcileOverdueShifts(
  shifts: ShiftRecord[],
  currentTimeMs: number = Date.now(),
  maxDurationHours: number = MAX_SHIFT_DURATION_HOURS
): { shifts: ShiftRecord[]; changed: boolean; updatedShifts: ShiftRecord[] } {
  let changed = false;
  const updatedShifts: ShiftRecord[] = [];

  const nextShifts = shifts.map((s) => {
    const checked = checkShiftReconciliation(s, currentTimeMs, maxDurationHours);
    if (checked.status !== s.status) {
      changed = true;
      updatedShifts.push(checked);
    }
    return checked;
  });

  return { shifts: nextShifts, changed, updatedShifts };
}

/**
 * Returns the active shift specifically bound to the given cashier (POS-02 / TC-A02).
 * Does NOT return another cashier's shift even at the same outlet.
 */
export function getActiveShiftForCashier(
  shifts: ShiftRecord[],
  cashierId?: string | null,
  outletId?: string | null,
  currentTimeMs: number = Date.now()
): ShiftRecord | null {
  if (!cashierId) return null;

  const { shifts: reconciled } = reconcileOverdueShifts(shifts, currentTimeMs);
  return (
    reconciled.find(
      (s) =>
        (s.status === "ACTIVE" || s.status === "OPEN") &&
        s.assignedCashierId === cashierId &&
        (!outletId || outletId === "ALL" || s.outletId === outletId)
    ) || null
  );
}

/**
 * Validates and constructs a new manual cashier shift (POS-01, POS-02).
 * - Rejects empty, null, undefined, NaN, or negative openingCash (TC-A01).
 * - Binds the shift to the specific cashierId (TC-A02).
 * - Allows a different cashier at the same outlet to open their own shift while preventing
 *   the same cashier from opening duplicate active shifts.
 */
export function validateManualShiftOpen(params: {
  openingCash: unknown;
  shiftName?: string;
  cashierId: string;
  cashierName: string;
  outletId: string;
  outletName?: string;
  existingShifts: ShiftRecord[];
  currentTimeMs?: number;
}): { success: boolean; error?: string; shift?: ShiftRecord; isAlreadyOpen?: boolean } {
  const { openingCash, cashierId, cashierName, outletId, existingShifts } = params;
  const nowMs = params.currentTimeMs ?? Date.now();

  if (
    openingCash === undefined ||
    openingCash === null ||
    openingCash === "" ||
    typeof openingCash === "boolean"
  ) {
    return { success: false, error: "Modal awal wajib diisi." };
  }

  const parsedCash = Number(openingCash);
  if (!Number.isFinite(parsedCash) || isNaN(parsedCash)) {
    return { success: false, error: "Modal awal wajib diisi dengan angka yang valid." };
  }

  if (parsedCash < 0) {
    return { success: false, error: "Modal awal kas tidak boleh bernilai negatif." };
  }

  if (!cashierId || typeof cashierId !== "string" || !cashierId.trim()) {
    return { success: false, error: "Shift kasir wajib terikat pada akun kasir yang valid." };
  }

  // Reconcile any overdue shifts first so a >16h stale shift does not block a fresh shift
  const { shifts: reconciled } = reconcileOverdueShifts(existingShifts, nowMs);

  // Per-cashier active shift check (TC-A02)
  const activeForSameCashier = reconciled.find(
    (s) =>
      (s.status === "ACTIVE" || s.status === "OPEN") &&
      s.assignedCashierId === cashierId
  );

  if (activeForSameCashier) {
    return {
      success: false,
      isAlreadyOpen: true,
      shift: activeForSameCashier,
      error: `Sesi kasir aktif untuk ${activeForSameCashier.assignedCashierName} sudah berjalan (${activeForSameCashier.id}). Tutup sesi sebelumnya terlebih dahulu.`,
    };
  }

  const resolvedOutletId = outletId || "outlet-sgr";
  const resolvedOutletName =
    params.outletName || (resolvedOutletId === "outlet-dps" ? "Denpasar" : "Singaraja");

  const newShift: ShiftRecord = {
    id: `shf-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
    shiftName: params.shiftName || "Shift Pagi (08:00 - 16:00)",
    outletId: resolvedOutletId,
    outletName: resolvedOutletName,
    assignedCashierId: cashierId,
    assignedCashierName: cashierName || "Kasir Bertugas",
    startTime: new Date(nowMs).toISOString(),
    status: "ACTIVE",
    openingCash: parsedCash,
    cashSales: 0,
    nonCashSales: 0,
    refundAmount: 0,
    expectedCash: parsedCash,
    actualCash: parsedCash,
    cashVariance: 0,
  };

  return { success: true, shift: newShift };
}

/**
 * Records a sale transaction against an active shift.
 * Enforces that overdue shifts (>16h -> NEEDS_RECONCILIATION) cannot accept new sales (TC-A03).
 */
export function recordShiftSaleTransaction(params: {
  shifts: ShiftRecord[];
  cashierId: string;
  shiftId?: string;
  cashAmount: number;
  nonCashAmount: number;
  currentTimeMs?: number;
}): {
  success: boolean;
  error?: string;
  shift?: ShiftRecord;
  updatedShifts: ShiftRecord[];
} {
  const nowMs = params.currentTimeMs ?? Date.now();
  const { shifts: reconciled } = reconcileOverdueShifts(params.shifts, nowMs);

  const targetIndex = reconciled.findIndex((s) =>
    params.shiftId
      ? s.id === params.shiftId
      : s.assignedCashierId === params.cashierId && (s.status === "ACTIVE" || s.status === "OPEN")
  );

  if (targetIndex === -1) {
    // Check if the cashier's shift was just transitioned to NEEDS_RECONCILIATION
    const overdueShift = reconciled.find(
      (s) => s.assignedCashierId === params.cashierId && s.status === "NEEDS_RECONCILIATION"
    );
    if (overdueShift) {
      return {
        success: false,
        error: "SHIFT_NEEDS_RECONCILIATION: Shift telah melebihi batas operasional 16 jam dan wajib direkonsiliasi sebelum transaksi baru.",
        shift: overdueShift,
        updatedShifts: reconciled,
      };
    }

    return {
      success: false,
      error: "SHIFT_NOT_OPEN: Tidak ada sesi shift aktif untuk kasir ini. Buka shift terlebih dahulu.",
      updatedShifts: reconciled,
    };
  }

  const target = reconciled[targetIndex];
  if (target.status === "NEEDS_RECONCILIATION") {
    return {
      success: false,
      error: "SHIFT_NEEDS_RECONCILIATION: Shift telah melebihi batas operasional 16 jam dan wajib direkonsiliasi sebelum transaksi baru.",
      shift: target,
      updatedShifts: reconciled,
    };
  }

  if (target.status !== "ACTIVE" && target.status !== "OPEN") {
    return {
      success: false,
      error: `SHIFT_INVALID_STATUS: Transaksi tidak dapat dicatat pada shift berstatus ${target.status}.`,
      shift: target,
      updatedShifts: reconciled,
    };
  }

  const cashDelta = Math.max(0, Number(params.cashAmount) || 0);
  const nonCashDelta = Math.max(0, Number(params.nonCashAmount) || 0);
  const newCashSales = (target.cashSales || 0) + cashDelta;
  const newNonCashSales = (target.nonCashSales || 0) + nonCashDelta;
  const newExpected = target.openingCash + newCashSales - (target.refundAmount || 0);

  const updatedShift: ShiftRecord = {
    ...target,
    cashSales: newCashSales,
    nonCashSales: newNonCashSales,
    expectedCash: newExpected,
  };

  const nextShifts = [...reconciled];
  nextShifts[targetIndex] = updatedShift;

  return {
    success: true,
    shift: updatedShift,
    updatedShifts: nextShifts,
  };
}

/**
 * Closes a specific shift by shiftId with server-calculated expectedCash and cashVariance (A2-5).
 */
export function closeShiftById(params: {
  shifts: ShiftRecord[];
  shiftId: string;
  actualCash: unknown;
  closingNotes?: string;
  actorId: string;
  actorName: string;
  actorRole: RoleSlug;
  metrics?: { cashSales?: number; nonCashSales?: number };
  currentTimeMs?: number;
}): {
  success: boolean;
  statusCode: number;
  error?: string;
  shift?: ShiftRecord;
} {
  if (!params.shiftId || typeof params.shiftId !== "string" || !params.shiftId.trim()) {
    return {
      success: false,
      statusCode: 400,
      error: "Parameter shiftId wajib disertakan untuk menutup shift.",
    };
  }

  if (
    params.actualCash === undefined ||
    params.actualCash === null ||
    params.actualCash === "" ||
    typeof params.actualCash === "boolean"
  ) {
    return {
      success: false,
      statusCode: 400,
      error: "Jumlah kas aktual (actualCash) wajib diisi.",
    };
  }

  const parsedActual = Number(params.actualCash);
  if (!Number.isFinite(parsedActual) || isNaN(parsedActual) || parsedActual < 0) {
    return {
      success: false,
      statusCode: 400,
      error: "Jumlah kas aktual (actualCash) wajib berupa angka non-negatif.",
    };
  }

  // Strictly match by shiftId only (never fallback to first ACTIVE shift)
  const target = params.shifts.find((s) => s.id === params.shiftId);
  if (!target) {
    return {
      success: false,
      statusCode: 404,
      error: `Shift dengan ID [${params.shiftId}] tidak ditemukan.`,
    };
  }

  if (target.status === "CLOSED") {
    return {
      success: false,
      statusCode: 409,
      error: `Shift [${params.shiftId}] sudah berstatus CLOSED dan tidak dapat ditutup ulang.`,
    };
  }

  const isSupervisor =
    params.actorRole === "SUPER_ADMIN" ||
    params.actorRole === "OWNER" ||
    params.actorRole === "MANAGER";

  if (target.assignedCashierId !== params.actorId && !isSupervisor) {
    return {
      success: false,
      statusCode: 403,
      error: `FORBIDDEN: Anda (${params.actorId}) tidak berhak menutup shift milik kasir lain (${target.assignedCashierName}).`,
    };
  }

  const finalCashSales =
    params.metrics?.cashSales !== undefined ? Number(params.metrics.cashSales) || 0 : target.cashSales || 0;
  const finalNonCashSales =
    params.metrics?.nonCashSales !== undefined
      ? Number(params.metrics.nonCashSales) || 0
      : target.nonCashSales || 0;

  const expectedCash = target.openingCash + finalCashSales - (target.refundAmount || 0);
  const cashVariance = parsedActual - expectedCash;
  const nowIso = new Date(params.currentTimeMs ?? Date.now()).toISOString();

  const closedShift: ShiftRecord = {
    ...target,
    cashSales: finalCashSales,
    nonCashSales: finalNonCashSales,
    expectedCash,
    actualCash: parsedActual,
    cashVariance,
    closingNotes: params.closingNotes ?? target.closingNotes,
    status: "CLOSED",
    endTime: nowIso,
    closedAt: nowIso,
    closedBy: params.actorName || target.assignedCashierName,
  };

  return {
    success: true,
    statusCode: 200,
    shift: closedShift,
  };
}
