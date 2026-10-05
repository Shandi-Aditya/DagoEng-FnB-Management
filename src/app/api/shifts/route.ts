import { NextRequest, NextResponse } from "next/server";

interface ShiftData {
  id: string;
  cashierName: string;
  outletId: string;
  startingCash: number;
  expectedCash?: number;
  actualCash?: number;
  cashDiff?: number;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt?: string;
  notes?: string;
}

let mockShifts: ShiftData[] = [];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let filtered = mockShifts;
  if (status) {
    filtered = filtered.filter((s) => s.status === status);
  }

  return NextResponse.json({ shifts: filtered });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, startingCash, actualCash, notes, shiftId, cashierName, outletId } = body;

    if (action === "OPEN") {
      const newShift: ShiftData = {
        id: `shift-${Date.now()}`,
        cashierName: cashierName || "Front Office Cashier",
        outletId: outletId || "outlet-sgr",
        startingCash: Number(startingCash) || 0,
        status: "OPEN",
        openedAt: new Date().toISOString(),
      };
      mockShifts.push(newShift);
      return NextResponse.json({ success: true, shift: newShift });
    }

    if (action === "CLOSE") {
      const shiftIndex = mockShifts.findIndex((s) => s.id === shiftId || s.status === "OPEN");
      if (shiftIndex === -1) {
        return NextResponse.json({ error: "Sesi kasir aktif tidak ditemukan." }, { status: 404 });
      }

      const current = mockShifts[shiftIndex];
      const actual = Number(actualCash) || 0;
      const expected = (current.startingCash || 0) + 1250000; // Expected total simulation
      const cashDiff = actual - expected;

      mockShifts[shiftIndex] = {
        ...current,
        actualCash: actual,
        expectedCash: expected,
        cashDiff,
        notes: notes || null,
        status: "CLOSED",
        closedAt: new Date().toISOString(),
      };

      return NextResponse.json({ success: true, shift: mockShifts[shiftIndex] });
    }

    return NextResponse.json({ error: "Action must be OPEN or CLOSE." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
