import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { ShiftRecord } from "@/types/shift";
import {
  checkShiftReconciliation,
  getActiveShiftForCashier,
  validateManualShiftOpen,
  recordShiftSaleTransaction,
  reconcileClientShiftAfterServerOpen,
  hydrateShiftsFromServer,
} from "@/lib/shift-management";
import {
  savePersistentShift,
  getPersistentShifts,
  writePersistentData,
} from "@/lib/persistent-storage";
import { POST as postShifts, GET as getShifts } from "@/app/api/shifts/route";

describe("QA Handover A1 — Shift Kasir Manual & Rekonsiliasi (POS-01, POS-02, POS-32)", () => {
  it("A1.1 (TC-A01): Menolak pembukaan shift tanpa input modal awal (kosong, null, undefined, NaN, atau negatif)", async () => {
    expect(
      validateManualShiftOpen({
        openingCash: undefined,
        cashierId: "usr-kasir-1",
        cashierName: "Ni Kadek Sri",
        outletId: "outlet-sgr",
        existingShifts: [],
      }).success
    ).toBe(false);

    expect(
      validateManualShiftOpen({
        openingCash: "",
        cashierId: "usr-kasir-1",
        cashierName: "Ni Kadek Sri",
        outletId: "outlet-sgr",
        existingShifts: [],
      }).success
    ).toBe(false);

    expect(
      validateManualShiftOpen({
        openingCash: NaN,
        cashierId: "usr-kasir-1",
        cashierName: "Ni Kadek Sri",
        outletId: "outlet-sgr",
        existingShifts: [],
      }).success
    ).toBe(false);

    expect(
      validateManualShiftOpen({
        openingCash: -50000,
        cashierId: "usr-kasir-1",
        cashierName: "Ni Kadek Sri",
        outletId: "outlet-sgr",
        existingShifts: [],
      }).success
    ).toBe(false);

    // Also verify POST /api/shifts rejects missing startingCash/openingCash with 400
    const badOpenReq = new NextRequest("http://localhost:3000/api/shifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CASHIER_SGR",
      },
      body: JSON.stringify({
        action: "OPEN",
        shiftName: "Shift Tanpa Modal",
      }),
    });
    const badOpenRes = await postShifts(badOpenReq);
    expect(badOpenRes.status).toBe(400);
  });

  it("A1.2 (TC-A02): Mengikat shift per kasir sehingga Kasir B wajib membuka shift sendiri saat Kasir A masih aktif di outlet yang sama", () => {
    const openCashierA = validateManualShiftOpen({
      openingCash: 300000,
      shiftName: "Shift Pagi Kasir A",
      cashierId: "usr-kasir-A",
      cashierName: "Kasir A (Budi)",
      outletId: "outlet-sgr",
      existingShifts: [],
    });
    expect(openCashierA.success).toBe(true);
    const shiftA = openCashierA.shift!;

    // When Cashier B logs in, getActiveShiftForCashier for Cashier B returns null (does NOT inherit Shift A)
    const activeForBBeforeOpen = getActiveShiftForCashier(
      [shiftA],
      "usr-kasir-B",
      "outlet-sgr"
    );
    expect(activeForBBeforeOpen).toBeNull();

    // Cashier B can open their own separate shift at the same outlet
    const openCashierB = validateManualShiftOpen({
      openingCash: 250000,
      shiftName: "Shift Siang Kasir B",
      cashierId: "usr-kasir-B",
      cashierName: "Kasir B (Siti)",
      outletId: "outlet-sgr",
      existingShifts: [shiftA],
    });
    expect(openCashierB.success).toBe(true);
    expect(openCashierB.shift?.assignedCashierId).toBe("usr-kasir-B");
    expect(openCashierB.shift?.id).not.toBe(shiftA.id);

    // Meanwhile Cashier A cannot open a second duplicate active shift
    const duplicateCashierA = validateManualShiftOpen({
      openingCash: 100000,
      shiftName: "Shift Ganda Kasir A",
      cashierId: "usr-kasir-A",
      cashierName: "Kasir A (Budi)",
      outletId: "outlet-sgr",
      existingShifts: [shiftA, openCashierB.shift!],
    });
    expect(duplicateCashierA.success).toBe(false);
    expect(duplicateCashierA.isAlreadyOpen).toBe(true);
  });

  it("A1.3 (TC-A03): Shift > 16 jam otomatis menjadi NEEDS_RECONCILIATION di server dan menolak transaksi baru", async () => {
    const seventeenHoursAgo = Date.now() - 17 * 60 * 60 * 1000;
    const staleShiftId = `shf-${seventeenHoursAgo}`;
    const staleCashierId = "user-cashier-sgr";

    const staleShift: ShiftRecord = {
      id: staleShiftId,
      shiftName: "Shift Malam Gantung",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      assignedCashierId: staleCashierId,
      assignedCashierName: "Ni Kadek Sri (Kasir)",
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

    // Attempting to record a sale on an overdue shift fails and transitions it to NEEDS_RECONCILIATION
    const saleAttempt = recordShiftSaleTransaction({
      shifts: [staleShift],
      cashierId: staleCashierId,
      shiftId: staleShiftId,
      cashAmount: 50000,
      nonCashAmount: 0,
    });
    expect(saleAttempt.success).toBe(false);
    expect(saleAttempt.error).toContain("SHIFT_NEEDS_RECONCILIATION");
    expect(saleAttempt.shift?.status).toBe("NEEDS_RECONCILIATION");

    // Also verify via server API route POST /api/shifts (action: RECORD_SALE)
    await savePersistentShift(staleShift);
    const apiSaleReq = new NextRequest("http://localhost:3000/api/shifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CASHIER_SGR",
      },
      body: JSON.stringify({
        action: "RECORD_SALE",
        shiftId: staleShiftId,
        cashierId: staleCashierId,
        cashAmount: 45000,
        nonCashAmount: 0,
      }),
    });
    const apiSaleRes = await postShifts(apiSaleReq);
    expect(apiSaleRes.status).toBe(409);

    const persistedShifts = await getPersistentShifts();
    const persistedStale = persistedShifts.find((s) => s.id === staleShiftId);
    expect(persistedStale?.status).toBe("NEEDS_RECONCILIATION");
  });

  it("A1.4: Shift yang baru berjalan (<16 jam) tetap berstatus ACTIVE dan menerima pencatatan transaksi", () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const ongoingShift: ShiftRecord = {
      id: `shf-${twoHoursAgo}`,
      shiftName: "Shift Pagi Segar",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      assignedCashierId: "usr-kasir-active",
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

    const saleRes = recordShiftSaleTransaction({
      shifts: [ongoingShift],
      cashierId: "usr-kasir-active",
      cashAmount: 75000,
      nonCashAmount: 50000,
    });
    expect(saleRes.success).toBe(true);
    expect(saleRes.shift?.status).toBe("ACTIVE");
    expect(saleRes.shift?.cashSales).toBe(75000);
    expect(saleRes.shift?.nonCashSales).toBe(50000);
    expect(saleRes.shift?.expectedCash).toBe(275000);
  });

  it("R1: Siklus penuh client+server (openShift -> closeShift -> GET /api/shifts -> reload hydration) menjaga ID sinkron dan tidak pernah membangkitkan shift yang sudah ditutup", async () => {
    await writePersistentData("shifts.json", []);

    // 1. Client creates shift locally and sends POST /api/shifts { action: "OPEN", shiftId }
    const localOpen = validateManualShiftOpen({
      openingCash: 400000,
      shiftName: "Shift R1 Sinkron",
      cashierId: "user-cashier-sgr",
      cashierName: "Ni Kadek Sri (Kasir)",
      outletId: "outlet-sgr",
      existingShifts: [],
    });
    expect(localOpen.success).toBe(true);
    let clientShifts: ShiftRecord[] = [localOpen.shift!];

    const openReq = new NextRequest("http://localhost:3000/api/shifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CASHIER_SGR",
      },
      body: JSON.stringify({
        action: "OPEN",
        shiftId: localOpen.shift!.id,
        shiftName: "Shift R1 Sinkron",
        openingCash: 400000,
        outletId: "outlet-sgr",
      }),
    });
    const openRes = await postShifts(openReq);
    expect(openRes.status).toBe(200);
    const openData = await openRes.json();
    expect(openData.shift.id).toBe(localOpen.shift!.id);

    clientShifts = reconcileClientShiftAfterServerOpen(
      clientShifts,
      localOpen.shift!.id,
      openData.shift
    );
    const activeShiftId = clientShifts[0].id;

    // 2. Close shift via POST /api/shifts { action: "CLOSE", shiftId: activeShiftId }
    const closeReq = new NextRequest("http://localhost:3000/api/shifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CASHIER_SGR",
      },
      body: JSON.stringify({
        action: "CLOSE",
        shiftId: activeShiftId,
        actualCash: 400000,
        closingNotes: "Tutup shift R1 bersih",
      }),
    });
    const closeRes = await postShifts(closeReq);
    expect(closeRes.status).toBe(200);

    // 3. GET /api/shifts confirms shift is CLOSED on the server
    const getReq = new NextRequest("http://localhost:3000/api/shifts", {
      headers: { cookie: "dagoeng_active_persona=CASHIER_SGR" },
    });
    const getRes = await getShifts(getReq);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    const serverClosed = getData.shifts.find((s: ShiftRecord) => s.id === activeShiftId);
    expect(serverClosed?.status).toBe("CLOSED");

    // 4. Simulate reload hydration even if localStorage still had stale ACTIVE state
    const hydrated = hydrateShiftsFromServer(clientShifts, getData.shifts);
    const activeAfterReload = getActiveShiftForCashier(
      hydrated,
      "user-cashier-sgr",
      "outlet-sgr"
    );
    expect(activeAfterReload).toBeNull();
  });

  it("R2: CLOSE mengabaikan metrics.cashSales dari body klien dan menghitung expectedCash & cashVariance murni dari penjualan server", async () => {
    await writePersistentData("shifts.json", []);

    // Open shift with Rp 300.000
    const openReq = new NextRequest("http://localhost:3000/api/shifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CASHIER_SGR",
      },
      body: JSON.stringify({
        action: "OPEN",
        shiftName: "Shift R2 Anti-Tamper",
        openingCash: 300000,
        outletId: "outlet-sgr",
      }),
    });
    const openData = await (await postShifts(openReq)).json();
    const shiftId = openData.shift.id;

    // Record cash sale of Rp 500.000 on server
    const saleReq = new NextRequest("http://localhost:3000/api/shifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CASHIER_SGR",
      },
      body: JSON.stringify({
        action: "RECORD_SALE",
        shiftId,
        cashAmount: 500000,
        nonCashAmount: 0,
      }),
    });
    const saleRes = await postShifts(saleReq);
    expect(saleRes.status).toBe(200);

    // Attempt to close with actualCash = openingCash (300.000) and forged metrics: { cashSales: 0 }
    const closeReq = new NextRequest("http://localhost:3000/api/shifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CASHIER_SGR",
      },
      body: JSON.stringify({
        action: "CLOSE",
        shiftId,
        actualCash: 300000,
        metrics: { cashSales: 0, nonCashSales: 0 },
      }),
    });
    const closeRes = await postShifts(closeReq);
    expect(closeRes.status).toBe(200);
    const closeData = await closeRes.json();

    expect(closeData.shift.cashSales).toBe(500000);
    expect(closeData.shift.expectedCash).toBe(800000);
    expect(closeData.shift.cashVariance).toBe(-500000);
  });

  it("R3: RECORD_SALE menolak kasir A yang mencoba mencatat penjualan ke shiftId milik kasir B dengan HTTP 403", async () => {
    const shiftBId = `shf-${Date.now()}-b`;
    await savePersistentShift({
      id: shiftBId,
      shiftName: "Shift Kasir B",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      assignedCashierId: "usr-other-cashier-b",
      assignedCashierName: "Kasir B",
      startTime: new Date().toISOString(),
      status: "ACTIVE",
      openingCash: 250000,
      cashSales: 100000,
      nonCashSales: 0,
      refundAmount: 0,
      expectedCash: 350000,
      actualCash: 250000,
      cashVariance: 0,
    });

    // Cashier A (CASHIER_SGR = user-cashier-sgr) attempts RECORD_SALE on shiftBId
    const crossSaleReq = new NextRequest("http://localhost:3000/api/shifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CASHIER_SGR",
      },
      body: JSON.stringify({
        action: "RECORD_SALE",
        shiftId: shiftBId,
        cashAmount: 900000,
        nonCashAmount: 0,
      }),
    });
    const crossSaleRes = await postShifts(crossSaleReq);
    expect(crossSaleRes.status).toBe(403);

    const shiftsAfter = await getPersistentShifts();
    const shiftBAfter = shiftsAfter.find((s) => s.id === shiftBId);
    expect(shiftBAfter?.cashSales).toBe(100000);
  });
});
