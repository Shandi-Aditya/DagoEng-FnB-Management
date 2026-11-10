import { NextRequest, NextResponse } from "next/server";
import {
  getPersistentShifts,
  savePersistentShift,
} from "@/lib/persistent-storage";
import { getRequestAuthUser } from "@/lib/server-auth";
import { RoleSlug } from "@/types/auth";
import {
  reconcileOverdueShifts,
  validateManualShiftOpen,
  recordShiftSaleTransaction,
  closeShiftById,
} from "@/lib/shift-management";

const AUTHORIZED_SHIFT_ROLES: RoleSlug[] = ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"];

async function loadAndReconcileServerShifts(nowMs: number = Date.now()) {
  const rawShifts = await getPersistentShifts();
  const { shifts, changed, updatedShifts } = reconcileOverdueShifts(rawShifts, nowMs);
  if (changed) {
    for (const updated of updatedShifts) {
      await savePersistentShift(updated);
    }
  }
  return shifts;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    if (!AUTHORIZED_SHIFT_ROLES.includes(auth.role)) {
      return NextResponse.json(
        { error: `FORBIDDEN: Role [${auth.role}] tidak memiliki akses operasional shift kasir.` },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const outletId = searchParams.get("outletId");
    const cashierId = searchParams.get("cashierId");

    let shifts = await loadAndReconcileServerShifts();

    if (status) {
      shifts = shifts.filter((s) => s.status === status);
    }
    if (outletId && outletId !== "ALL") {
      shifts = shifts.filter((s) => s.outletId === outletId);
    }
    if (cashierId) {
      shifts = shifts.filter((s) => s.assignedCashierId === cashierId);
    }

    return NextResponse.json({ shifts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role || !auth.userId) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    if (!AUTHORIZED_SHIFT_ROLES.includes(auth.role)) {
      return NextResponse.json(
        { error: `FORBIDDEN: Role [${auth.role}] tidak diizinkan memodifikasi shift kasir.` },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      action,
      startingCash,
      openingCash,
      actualCash,
      notes,
      closingNotes,
      shiftId,
      cashierName,
      cashierId,
      outletId,
      outletName,
      cashAmount,
      nonCashAmount,
    } = body;

    if (action === "SYNC") {
      return NextResponse.json(
        {
          error:
            "SHIFT_SYNC_FORBIDDEN: Raw shift state overwrite is disabled. Use explicit OPEN, RECORD_SALE, or CLOSE actions.",
        },
        { status: 400 }
      );
    }

    const nowMs = Date.now();
    const shifts = await loadAndReconcileServerShifts(nowMs);

    if (action === "OPEN") {
      const isSupervisor =
        auth.role === "SUPER_ADMIN" || auth.role === "OWNER" || auth.role === "MANAGER";
      const effectiveCashierId = isSupervisor && cashierId ? cashierId : auth.userId;
      const effectiveCashierName =
        (isSupervisor && cashierName ? cashierName : auth.name) ||
        cashierName ||
        auth.email ||
        "Front Office Cashier";

      const openResult = validateManualShiftOpen({
        openingCash: openingCash !== undefined ? openingCash : startingCash,
        shiftName: body.shiftName,
        cashierId: effectiveCashierId,
        cashierName: effectiveCashierName,
        outletId: outletId || "outlet-sgr",
        outletName,
        existingShifts: shifts,
        clientShiftId: typeof shiftId === "string" ? shiftId : typeof body.id === "string" ? body.id : undefined,
        currentTimeMs: nowMs,
      });

      if (!openResult.success || !openResult.shift) {
        return NextResponse.json(
          {
            error: openResult.error,
            shift: openResult.shift,
            isAlreadyOpen: openResult.isAlreadyOpen || false,
          },
          { status: openResult.isAlreadyOpen ? 409 : 400 }
        );
      }

      await savePersistentShift(openResult.shift);
      return NextResponse.json({ success: true, shift: openResult.shift });
    }

    if (action === "RECORD_SALE") {
      const saleResult = recordShiftSaleTransaction({
        shifts,
        cashierId: cashierId || auth.userId,
        shiftId,
        cashAmount: Number(cashAmount) || 0,
        nonCashAmount: Number(nonCashAmount) || 0,
        saleId: typeof body.saleId === "string" && body.saleId.trim() ? body.saleId.trim() : undefined,
        actorId: auth.userId,
        actorRole: auth.role,
        currentTimeMs: nowMs,
      });

      if (!saleResult.success || !saleResult.shift) {
        if (saleResult.shift && saleResult.shift.status === "NEEDS_RECONCILIATION") {
          await savePersistentShift(saleResult.shift);
          return NextResponse.json(
            { error: saleResult.error, shift: saleResult.shift },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { error: saleResult.error },
          { status: saleResult.statusCode || 400 }
        );
      }

      await savePersistentShift(saleResult.shift);
      return NextResponse.json({ success: true, shift: saleResult.shift });
    }

    if (action === "CLOSE") {
      const closeResult = closeShiftById({
        shifts,
        shiftId,
        actualCash,
        closingNotes: closingNotes ?? notes,
        actorId: auth.userId,
        actorName: auth.name || cashierName || auth.email || "Kasir Bertugas",
        actorRole: auth.role,
        currentTimeMs: nowMs,
      });

      if (!closeResult.success || !closeResult.shift) {
        return NextResponse.json(
          { error: closeResult.error },
          { status: closeResult.statusCode }
        );
      }

      await savePersistentShift(closeResult.shift);
      return NextResponse.json({ success: true, shift: closeResult.shift });
    }

    return NextResponse.json(
      { error: "Action must be OPEN, RECORD_SALE, or CLOSE." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
