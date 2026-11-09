import { NextRequest, NextResponse } from "next/server";
import { getPersistentShifts, savePersistentShift } from "@/lib/persistent-storage";
import { ShiftRecord } from "@/types/shift";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const outletId = searchParams.get("outletId");

    let shifts = await getPersistentShifts();

    if (status) {
      shifts = shifts.filter((s) => s.status === status);
    }
    if (outletId && outletId !== "ALL") {
      shifts = shifts.filter((s) => s.outletId === outletId);
    }

    return NextResponse.json({ shifts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, startingCash, actualCash, notes, shiftId, cashierName, cashierId, outletId, shiftRecord } = body;

    // Direct save / sync of complete ShiftRecord
    if (action === "SYNC" && shiftRecord) {
      await savePersistentShift(shiftRecord);
      return NextResponse.json({ success: true, shift: shiftRecord });
    }

    const shifts = await getPersistentShifts();

    if (action === "OPEN") {
      const targetOutlet = outletId || "outlet-sgr";
      const existingOpen = shifts.find(
        (s) => (s.status === "OPEN" || s.status === "ACTIVE") && s.outletId === targetOutlet
      );

      if (existingOpen) {
        return NextResponse.json(
          {
            error: `Sesi kasir aktif (${existingOpen.assignedCashierName}) sudah berjalan untuk outlet ini. Tutup sesi sebelumnya terlebih dahulu.`,
            shift: existingOpen,
            isAlreadyOpen: true,
          },
          { status: 409 }
        );
      }

      const nowFormatted = new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) + " WITA";
      const startCash = Math.max(0, Number(startingCash) || 0);

      const newShift: ShiftRecord = {
        id: `shf-${Date.now()}`,
        shiftName: body.shiftName || "Shift Pagi (08:00 - 16:00)",
        outletId: targetOutlet,
        outletName: targetOutlet === "outlet-dps" ? "Denpasar" : "Singaraja",
        assignedCashierId: cashierId || "usr-kasir",
        assignedCashierName: cashierName || "Front Office Cashier",
        startTime: nowFormatted,
        status: "ACTIVE",
        openingCash: startCash,
        cashSales: 0,
        nonCashSales: 0,
        refundAmount: 0,
        expectedCash: startCash,
        actualCash: startCash,
        cashVariance: 0,
      };

      await savePersistentShift(newShift);
      return NextResponse.json({ success: true, shift: newShift });
    }

    if (action === "CLOSE") {
      const shiftIndex = shifts.findIndex((s) => s.id === shiftId || s.status === "ACTIVE" || s.status === "OPEN");
      if (shiftIndex === -1) {
        return NextResponse.json({ error: "Sesi kasir aktif tidak ditemukan." }, { status: 404 });
      }

      const current = shifts[shiftIndex];
      const actual = Number(actualCash) || 0;
      const expected = current.expectedCash || (current.openingCash + (current.cashSales || 0) - (current.refundAmount || 0));
      const cashVariance = actual - expected;
      const nowFormatted = new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) + " WITA";

      const closedShift: ShiftRecord = {
        ...current,
        actualCash: actual,
        cashVariance,
        closingNotes: notes || current.closingNotes,
        status: "CLOSED",
        endTime: nowFormatted,
        closedAt: nowFormatted,
        closedBy: cashierName || current.assignedCashierName,
      };

      await savePersistentShift(closedShift);
      return NextResponse.json({ success: true, shift: closedShift });
    }

    return NextResponse.json({ error: "Action must be OPEN, CLOSE, or SYNC." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
