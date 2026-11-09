import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { getDataFilePath } from "@/lib/data-storage";
import {
  appendAuditLog,
  getAuditLogs,
  getPersistentShifts,
  savePersistentShift,
  getCoworkingBookings,
  saveCoworkingBooking,
  savePersistentQrisSession,
  __setMockStorageWriteFailure,
} from "@/lib/persistent-storage";
import {
  syncWithOutbox,
  flushOutbox,
  getOutboxItems,
  clearOutboxForTests,
} from "@/lib/sync-outbox";
import { POST as postAuditLogs } from "@/app/api/audit-logs/route";
import { POST as postShifts } from "@/app/api/shifts/route";
import { POST as postOrders, GET as getOrders } from "@/app/api/orders/route";

describe("QA Handover A2 — Data Persistence & Loss Prevention (POS-33)", () => {
  beforeEach(() => {
    __setMockStorageWriteFailure(null);
    clearOutboxForTests();
    const files = [
      "audit_logs.json",
      "shifts.json",
      "coworking_bookings.json",
      "pos_orders.json",
      "loyalty_points.json",
    ].map((f) => getDataFilePath(f));

    for (const f of files) {
      const dir = path.dirname(f);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
  });

  it("A2.1: Audit trail disimpan secara append-only dan menolak duplikasi/overwrite ID yang sudah ada (A2-2)", async () => {
    const uniqueId = `audit-immutable-${Date.now()}`;
    const originalEntry = await appendAuditLog({
      id: uniqueId,
      action: "VOID_TRANSACTION",
      module: "POS",
      userId: "usr-01",
      userName: "Very Simbolon",
      userRole: "CASHIER",
      description: "Pembatalan transaksi kopi susu asli",
      timestamp: new Date().toISOString(),
    });

    expect(originalEntry.id).toBe(uniqueId);

    // Attempt to overwrite existing audit entry with the same ID must be rejected
    await expect(
      appendAuditLog({
        id: uniqueId,
        action: "TAMPERED_ACTION",
        module: "POS",
        userId: "usr-01",
        userName: "Attacker",
        userRole: "CASHIER",
        description: "Mencoba menimpa log audit lama",
        timestamp: new Date().toISOString(),
      })
    ).rejects.toThrow(/AUDIT_INTEGRITY_VIOLATION/);

    // Also verify POST /api/audit-logs returns 409 on duplicate ID
    const dupReq = new NextRequest("http://localhost:3000/api/audit-logs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CASHIER_SGR",
      },
      body: JSON.stringify({
        id: uniqueId,
        action: "TAMPERED_VIA_API",
        description: "Overwrite attempt via API",
      }),
    });
    const dupRes = await postAuditLogs(dupReq);
    expect(dupRes.status).toBe(409);

    // Original entry remains intact
    const logs = await getAuditLogs();
    const found = logs.find((l) => l.id === uniqueId);
    expect(found).toBeDefined();
    expect(found?.action).toBe("VOID_TRANSACTION");
    expect(found?.description).toBe("Pembatalan transaksi kopi susu asli");
  });

  it("A2.2: Menangani penulisan paralel (concurrent Promise.all) tanpa kehilangan data (A2-3)", async () => {
    const idA = `audit-parallel-A-${Date.now()}`;
    const idB = `audit-parallel-B-${Date.now()}`;

    await Promise.all([
      appendAuditLog({
        id: idA,
        action: "CONCURRENT_WRITE_A",
        module: "POS",
        userId: "usr-a",
        userName: "Cashier A",
        userRole: "CASHIER",
        description: "Parallel write A",
        timestamp: new Date().toISOString(),
      }),
      appendAuditLog({
        id: idB,
        action: "CONCURRENT_WRITE_B",
        module: "POS",
        userId: "usr-b",
        userName: "Cashier B",
        userRole: "CASHIER",
        description: "Parallel write B",
        timestamp: new Date().toISOString(),
      }),
    ]);

    const logs = await getAuditLogs();
    expect(logs.some((l) => l.id === idA)).toBe(true);
    expect(logs.some((l) => l.id === idB)).toBe(true);
  });

  it("A2.3: CLOSE shift dengan shiftId spesifik hanya menutup shift tersebut dan tidak menutup shift aktif lain (A2-5)", async () => {
    const shiftAId = `shf-${Date.now() - 2000}`;
    const shiftBId = `shf-${Date.now() - 1000}`;

    await savePersistentShift({
      id: shiftAId,
      shiftName: "Shift Kasir A",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      assignedCashierId: "user-cashier-a",
      assignedCashierName: "Kasir A",
      startTime: new Date().toISOString(),
      status: "ACTIVE",
      openingCash: 200000,
      cashSales: 50000,
      nonCashSales: 0,
      refundAmount: 0,
      expectedCash: 250000,
      actualCash: 200000,
      cashVariance: 0,
    });

    await savePersistentShift({
      id: shiftBId,
      shiftName: "Shift Kasir B",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      assignedCashierId: "user-cashier-sgr",
      assignedCashierName: "Ni Kadek Sri",
      startTime: new Date().toISOString(),
      status: "ACTIVE",
      openingCash: 300000,
      cashSales: 100000,
      nonCashSales: 0,
      refundAmount: 0,
      expectedCash: 400000,
      actualCash: 300000,
      cashVariance: 0,
    });

    // Close Shift B specifically as CASHIER_SGR (user-cashier-sgr)
    const closeReq = new NextRequest("http://localhost:3000/api/shifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CASHIER_SGR",
      },
      body: JSON.stringify({
        action: "CLOSE",
        shiftId: shiftBId,
        actualCash: 400000,
        closingNotes: "Tutup shift B tepat",
      }),
    });

    const closeRes = await postShifts(closeReq);
    expect(closeRes.status).toBe(200);

    const allShifts = await getPersistentShifts();
    const afterA = allShifts.find((s) => s.id === shiftAId);
    const afterB = allShifts.find((s) => s.id === shiftBId);

    // Shift A must remain ACTIVE while Shift B is CLOSED
    expect(afterA?.status).toBe("ACTIVE");
    expect(afterB?.status).toBe("CLOSED");
    expect(afterB?.actualCash).toBe(400000);
    expect(afterB?.cashVariance).toBe(0);
  });

  it("A2.4 & R8: Pesanan POS dan poin loyalti dihitung di server secara idempoten (mengabaikan loyaltyPointsDelta palsu dari body) serta menolak akses CUSTOMER (403)", async () => {
    const orderId = `ord-pos-persist-${Date.now()}`;
    const orderNumber = `ORD-${Date.now().toString().slice(-5)}`;
    const customerKey = `cust-loyalty-${Date.now()}`;

    // Pre-verify QRIS session on server for this order
    await savePersistentQrisSession({
      orderId,
      invoiceNumber: orderNumber,
      expectedAmount: 57500,
      status: "VERIFIED_WEBHOOK",
      verificationMethod: "GATEWAY_WEBHOOK",
      verifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 1. CUSTOMER attempting POST /api/orders must be rejected with 403
    const custReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CUSTOMER_DEMO",
      },
      body: JSON.stringify({
        order: {
          id: orderId,
          orderNumber,
          subtotal: 50000,
          tax: 5000,
          serviceCharge: 2500,
          total: 57500,
          paymentStatus: "PAID",
          paymentMethod: "QRIS",
        },
        customerKey,
        loyaltyPointsDelta: 99999,
      }),
    });
    const custRes = await postOrders(custReq);
    expect(custRes.status).toBe(403);

    // 2. CASHIER posts valid Rp 57.500 order with forged loyaltyPointsDelta: 99999
    // Server must ignore 99999 and award exactly Math.floor(57500 / 10000) = 5 points
    const orderPayload = {
      id: orderId,
      orderNumber,
      organizationId: "org-dago-hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-04",
      customerName: customerKey,
      orderType: "DINE_IN",
      status: "COMPLETED",
      items: [
        {
          id: "it-1",
          productId: "p-1",
          productName: "Es Kopi Senja",
          quantity: 2,
          unitPrice: 25000,
        },
      ],
      subtotal: 50000,
      tax: 5000,
      serviceCharge: 2500,
      total: 57500,
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
      qrisVerification: {
        type: "GATEWAY_WEBHOOK",
        referenceNumber: orderNumber,
        invoiceNumber: orderNumber,
        verifiedAt: new Date().toISOString(),
      },
      targetServiceMinutes: 10,
      createdAt: new Date().toISOString(),
      statusHistory: [],
    };

    const postReq1 = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CASHIER_SGR",
      },
      body: JSON.stringify({
        order: orderPayload,
        customerKey,
        loyaltyPointsDelta: 99999,
      }),
    });

    const postRes1 = await postOrders(postReq1);
    expect(postRes1.status).toBe(200);

    // 3. Duplicate POST with the exact same order.id must NOT double-credit points
    const postReq2 = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CASHIER_SGR",
      },
      body: JSON.stringify({
        order: orderPayload,
        customerKey,
        loyaltyPointsDelta: 99999,
      }),
    });
    const postRes2 = await postOrders(postReq2);
    expect(postRes2.status).toBe(200);

    // Read back from persistent storage (simulating browser clear / reload)
    const getReq = new NextRequest(
      `http://localhost:3000/api/orders?customerKey=${encodeURIComponent(customerKey)}`,
      {
        headers: { cookie: "dagoeng_active_persona=CASHIER_SGR" },
      }
    );
    const getRes = await getOrders(getReq);
    expect(getRes.status).toBe(200);
    const data = await getRes.json();

    const persistedOrder = data.orders.find((o: any) => o.id === orderId);
    expect(persistedOrder).toBeDefined();
    expect(persistedOrder.total).toBe(57500);

    expect(data.loyaltyPoints.length).toBe(1);
    expect(data.loyaltyPoints[0].points).toBe(5);
  });

  it("A2.5: Booking co-working tersimpan ke file replica sehingga tidak hilang saat localStorage dibersihkan", async () => {
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

    await saveCoworkingBooking(testBooking);
    const bookings = await getCoworkingBookings();
    const found = bookings.find((b: any) => b.id === testBooking.id);

    expect(found).toBeDefined();
    expect(found?.guestName).toBe("Sarah Jenkins");
    expect(found?.totalAmount).toBe(60000);
  });

  it("R9: kegagalan tulis storage mengembalikan HTTP 500 (bukan 200 palsu) dan outbox klien mengantrekan serta mengirim ulang pesanan saat server pulih", async () => {
    const orderId = `ord-r9-retry-${Date.now()}`;
    const orderPayload = {
      id: orderId,
      orderNumber: `ORD-R9-${Date.now().toString().slice(-4)}`,
      outletId: "outlet-sgr",
      subtotal: 30000,
      tax: 3000,
      serviceCharge: 0,
      total: 33000,
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      items: [
        {
          productName: "Americano Dingin",
          quantity: 1,
          unitPrice: 30000,
        },
      ],
    };

    // 1. Force storage write failure on the server
    __setMockStorageWriteFailure(new Error("DISK_WRITE_ERROR_SIMULATED"));

    const customFetch: typeof fetch = async (input, init) => {
      const req = new NextRequest(new URL(String(input), "http://localhost:3000"), {
        method: init?.method || "POST",
        headers: {
          "content-type": "application/json",
          cookie: "dagoeng_active_persona=CASHIER_SGR",
        },
        body: init?.body as string,
      });
      return postOrders(req);
    };

    // 2. Client calls syncWithOutbox while storage is failing -> receives 500 and queues item in outbox
    const failedAttempt = await syncWithOutbox(
      {
        id: `order-sync-${orderId}`,
        endpoint: "/api/orders",
        method: "POST",
        payload: { order: orderPayload },
      },
      customFetch
    );

    expect(failedAttempt.synced).toBe(false);
    expect(failedAttempt.status).toBe(500);
    expect(getOutboxItems().length).toBe(1);
    expect(getOutboxItems()[0].id).toBe(`order-sync-${orderId}`);

    // 3. Restore storage health and run flushOutbox -> order is persisted on server and removed from outbox
    __setMockStorageWriteFailure(null);
    const flushRes = await flushOutbox(customFetch);
    expect(flushRes.flushedCount).toBe(1);
    expect(flushRes.remainingCount).toBe(0);
    expect(getOutboxItems().length).toBe(0);

    // Confirm order is now stored on the server
    const getReq = new NextRequest("http://localhost:3000/api/orders", {
      headers: { cookie: "dagoeng_active_persona=CASHIER_SGR" },
    });
    const getData = await (await getOrders(getReq)).json();
    const saved = getData.orders.find((o: any) => o.id === orderId);
    expect(saved).toBeDefined();
    expect(saved.total).toBe(33000);
  });
});
