import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderRecord } from "@/types/order";
import type { ShiftRecord } from "@/types/shift";
import {
  getAuditLogs,
  savePersistentOrder,
  savePersistentShift,
  writePersistentData,
} from "@/lib/persistent-storage";
import {
  buildShiftClosingEnvelopes,
  dispatchShiftClosingChatbot,
  filterOrdersForShiftWindow,
  getClosingChatbotDispatches,
} from "@/lib/closing-chatbot";
import { POST as postShifts } from "@/app/api/shifts/route";
import { PUT as putSettlementReceiptPolicy } from "@/app/api/settings/settlement-receipt/route";
import {
  GET as getClosingChatbot,
  POST as postClosingChatbot,
} from "@/app/api/notifications/closing-chatbot/route";

const TRACKED_ENV_KEYS = [
  "DATA_DIR_OVERRIDE",
  "FONNTE_API_TOKEN",
  "TELEGRAM_BOT_TOKEN",
  "KA_ARI_WHATSAPP_PHONE",
  "FONNTE_TARGET_PHONE",
  "TELEGRAM_KA_ARI_CHAT_ID",
  "TELEGRAM_CHAT_ID",
  "TELEGRAM_PARTNER_TENANT_KS_CHAT_ID",
  "TELEGRAM_PARTNER_TENANT_KITCHEN_CHAT_ID",
] as const;

function makePaidOrder(params: {
  id: string;
  orderNumber: string;
  outletId?: string;
  createdAt: string;
  paymentMethod: OrderRecord["paymentMethod"];
  subtotal: number;
  discount?: number;
  tax: number;
  serviceCharge?: number;
  total: number;
  items: OrderRecord["items"];
}): OrderRecord {
  return {
    id: params.id,
    orderNumber: params.orderNumber,
    organizationId: "org-dago",
    outletId: params.outletId ?? "outlet-sgr",
    outletName: "Singaraja (Pusat)",
    tableNumber: "T-01",
    customerName: "Tamu Uji",
    orderType: "DINE_IN",
    status: "COMPLETED",
    items: params.items,
    subtotal: params.subtotal,
    discount: params.discount ?? 0,
    tax: params.tax,
    serviceCharge: params.serviceCharge ?? 0,
    total: params.total,
    paymentStatus: "PAID",
    paymentMethod: params.paymentMethod,
    targetServiceMinutes: 15,
    createdAt: params.createdAt,
    statusHistory: [],
  };
}

const SHIFT_BASE_START_ISO = "2026-11-17T00:00:00.000Z";
const SHIFT_BASE_START_MS = Date.parse(SHIFT_BASE_START_ISO);

function makeClosedShift(overrides: Partial<ShiftRecord> = {}): ShiftRecord {
  return {
    id: `shf-${SHIFT_BASE_START_MS}-v17`,
    shiftName: "Shift Pagi (08:00 - 16:00)",
    outletId: "outlet-sgr",
    outletName: "Singaraja (Pusat)",
    assignedCashierId: "user-cashier-sgr",
    assignedCashierName: "Ni Kadek Sri",
    startTime: SHIFT_BASE_START_ISO,
    endTime: "2026-11-17T08:00:00.000Z",
    closedAt: "2026-11-17T08:00:00.000Z",
    closedBy: "Ni Kadek Sri",
    status: "CLOSED",
    openingCash: 300000,
    cashSales: 110000,
    nonCashSales: 205000,
    refundAmount: 10000,
    expectedCash: 400000,
    actualCash: 395000,
    cashVariance: -5000,
    closingNotes: "Selisih uang receh Rp 5.000",
    ...overrides,
  };
}

describe("Task V-17: Closing Chatbot Notifications (Ka Ari & Partners)", () => {
  let tempDir = "";
  let savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv = {};
    for (const key of TRACKED_ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "v17-test-"));
    process.env.DATA_DIR_OVERRIDE = tempDir;
  });

  afterEach(() => {
    for (const key of TRACKED_ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("1. Ka Ari envelope contains full FO cash reconciliation, payment breakdown, and multi-partner summary in WITA", () => {
    const shift = makeClosedShift();
    const orders: OrderRecord[] = [
      makePaidOrder({
        id: "ord-ks-1",
        orderNumber: "ORD-101",
        createdAt: "2026-11-17T02:00:00.000Z",
        paymentMethod: "CASH",
        subtotal: 100000,
        discount: 0,
        tax: 10000,
        serviceCharge: 0,
        total: 110000,
        items: [
          {
            id: "itm-1",
            tenantId: "tenant-ks",
            productName: "Kopi Susu Gula Aren",
            quantity: 4,
            unitPrice: 25000,
          },
        ],
      }),
      makePaidOrder({
        id: "ord-dm-1",
        orderNumber: "ORD-102",
        createdAt: "2026-11-17T04:00:00.000Z",
        paymentMethod: "QRIS",
        subtotal: 150000,
        discount: 0,
        tax: 15000,
        serviceCharge: 0,
        total: 165000,
        items: [
          {
            id: "itm-2",
            tenantId: "tenant-kitchen",
            productName: "Nasi Goreng Spesial",
            quantity: 3,
            unitPrice: 50000,
          },
        ],
      }),
      makePaidOrder({
        id: "ord-dm-2",
        orderNumber: "ORD-103",
        createdAt: "2026-11-17T05:00:00.000Z",
        paymentMethod: "EDC",
        subtotal: 40000,
        discount: 0,
        tax: 0,
        serviceCharge: 0,
        total: 40000,
        items: [
          {
            id: "itm-3",
            tenantId: "tenant-kitchen",
            productName: "Ayam Bakar",
            quantity: 1,
            unitPrice: 40000,
          },
        ],
      }),
    ];

    const envelopes = buildShiftClosingEnvelopes({ shift, orders });
    const kaAri = envelopes.find((e) => e.role === "KA_ARI");

    expect(kaAri).toBeDefined();
    expect(kaAri?.recipientId).toBe("ka-ari");
    expect(kaAri?.recipientName).toBe("Ka Ari");
    expect(kaAri?.message).toContain(shift.id);
    expect(kaAri?.message).toContain(shift.shiftName);
    expect(kaAri?.message).toContain("Ni Kadek Sri");
    expect(kaAri?.message).toContain("WITA");
    expect(kaAri?.message).toContain("3 transaksi");
    expect(kaAri?.message).toContain("Rp 300.000");
    expect(kaAri?.message).toContain("Rp 400.000");
    expect(kaAri?.message).toContain("Rp 395.000");
    expect(kaAri?.message).toContain("Rp 5.000");
    expect(kaAri?.message).toContain("Rp 10.000");
    expect(kaAri?.message).toContain("Selisih uang receh Rp 5.000");
    expect(kaAri?.message).toContain("QRIS");
    expect(kaAri?.message).toContain("EDC");
    expect(kaAri?.message).toContain("Kopi Senja");
    expect(kaAri?.message).toContain("Dapur Mama");
    expect(kaAri?.message).toContain("Dago Hub");
  });

  it("2. Strict partner data isolation excludes peer partners, outlet totals, FO cash drawer, and zero-order partners", () => {
    const shift = makeClosedShift({
      openingCash: 325000,
      cashSales: 110000,
      refundAmount: 15000,
      expectedCash: 420000,
      actualCash: 413000,
      cashVariance: -7000,
      closingNotes: "Catatan internal FO rahasia",
    });

    const orders: OrderRecord[] = [
      makePaidOrder({
        id: "ord-iso-1",
        orderNumber: "ORD-201",
        createdAt: "2026-11-17T02:00:00.000Z",
        paymentMethod: "CASH",
        subtotal: 100000,
        discount: 0,
        tax: 10000,
        serviceCharge: 0,
        total: 110000,
        items: [
          {
            id: "itm-iso-1",
            tenantId: "tenant-ks",
            productName: "Espresso",
            quantity: 2,
            unitPrice: 50000,
          },
        ],
      }),
      makePaidOrder({
        id: "ord-iso-2",
        orderNumber: "ORD-202",
        createdAt: "2026-11-17T03:00:00.000Z",
        paymentMethod: "QRIS",
        subtotal: 200000,
        discount: 0,
        tax: 20000,
        serviceCharge: 0,
        total: 220000,
        items: [
          {
            id: "itm-iso-2",
            tenantId: "tenant-kitchen",
            productName: "Rawon Daging",
            quantity: 4,
            unitPrice: 50000,
          },
        ],
      }),
      makePaidOrder({
        id: "ord-iso-out",
        orderNumber: "ORD-203",
        createdAt: "2026-11-16T10:00:00.000Z",
        paymentMethod: "QRIS",
        subtotal: 80000,
        discount: 0,
        tax: 8000,
        serviceCharge: 0,
        total: 88000,
        items: [
          {
            id: "itm-iso-3",
            tenantId: "tenant-bakery",
            productName: "Croissant Butter",
            quantity: 2,
            unitPrice: 40000,
          },
        ],
      }),
    ];

    expect(filterOrdersForShiftWindow(orders, shift)).toHaveLength(2);

    const envelopes = buildShiftClosingEnvelopes({ shift, orders });
    const kopiSenja = envelopes.find((e) => e.recipientId === "tenant-ks");
    const dapurMama = envelopes.find((e) => e.recipientId === "tenant-kitchen");
    const manisBakery = envelopes.find((e) => e.recipientId === "tenant-bakery");

    expect(manisBakery).toBeUndefined();
    expect(kopiSenja).toBeDefined();
    expect(dapurMama).toBeDefined();

    expect(kopiSenja!.message).toContain("Kopi Senja");
    expect(kopiSenja!.message).toContain("Rp 100.000");
    expect(kopiSenja!.message).toContain("Rp 85.000");
    expect(kopiSenja!.message).toContain("Rp 15.000");
    expect(kopiSenja!.message).not.toContain("Dapur Mama");
    expect(kopiSenja!.message).not.toContain("200.000");
    expect(kopiSenja!.message).not.toContain("300.000");
    expect(kopiSenja!.message).not.toContain("325.000");
    expect(kopiSenja!.message).not.toContain("420.000");
    expect(kopiSenja!.message).not.toContain("413.000");
    expect(kopiSenja!.message).not.toContain("Selisih kas");
    expect(kopiSenja!.message).not.toContain("Catatan internal FO rahasia");

    expect(dapurMama!.message).toContain("Dapur Mama");
    expect(dapurMama!.message).toContain("Rp 200.000");
    expect(dapurMama!.message).toContain("Rp 170.000");
    expect(dapurMama!.message).toContain("Rp 30.000");
    expect(dapurMama!.message).not.toContain("Kopi Senja");
    expect(dapurMama!.message).not.toContain("100.000");
    expect(dapurMama!.message).not.toContain("300.000");
    expect(dapurMama!.message).not.toContain("413.000");
    expect(dapurMama!.message).not.toContain("Selisih kas");
  });

  it("3. Dispatches WhatsApp (Fonnte) and Telegram in parallel within 1 minute SLA, and reports configured: false when tokens are missing", async () => {
    const shift = makeClosedShift({ id: `shf-${SHIFT_BASE_START_MS}-sla` });
    const orders: OrderRecord[] = [
      makePaidOrder({
        id: "ord-sla-1",
        orderNumber: "ORD-301",
        createdAt: "2026-11-17T03:00:00.000Z",
        paymentMethod: "QRIS",
        subtotal: 100000,
        tax: 10000,
        total: 110000,
        items: [
          {
            id: "itm-sla-1",
            tenantId: "tenant-ks",
            productName: "Latte",
            quantity: 2,
            unitPrice: 50000,
          },
        ],
      }),
    ];

    process.env.TELEGRAM_KA_ARI_CHAT_ID = "99887766";
    const unconfiguredDispatch = await dispatchShiftClosingChatbot({
      shift,
      orders,
    });
    expect(unconfiguredDispatch.sentCount).toBe(0);
    expect(unconfiguredDispatch.withinOneMinuteSla).toBe(true);
    const kaAriUnconf = unconfiguredDispatch.envelopes.find((e) => e.role === "KA_ARI");
    expect(kaAriUnconf?.deliveries.every((d) => d.configured === false && d.sent === false)).toBe(true);

    process.env.FONNTE_API_TOKEN = "fonnte-test-token";
    process.env.TELEGRAM_BOT_TOKEN = "tg-bot-test-token";
    process.env.KA_ARI_WHATSAPP_PHONE = "081211112222";
    process.env.TELEGRAM_KA_ARI_CHAT_ID = "100200300";
    process.env.TELEGRAM_PARTNER_TENANT_KS_CHAT_ID = "400500600";

    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const body = JSON.parse(String(init?.body || "{}"));
      calls.push({ url, body });
      return new Response(JSON.stringify({ status: true, ok: true, id: "msg-ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const okDispatch = await dispatchShiftClosingChatbot({
      shift,
      orders,
      forceResend: true,
      fetchImpl: mockFetch,
    });

    expect(okDispatch.withinOneMinuteSla).toBe(true);
    expect(okDispatch.elapsedMs).toBeLessThan(60_000);
    expect(okDispatch.envelopeCount).toBe(2);
    expect(okDispatch.sentCount).toBe(4);
    expect(calls.filter((c) => c.url === "https://api.fonnte.com/send")).toHaveLength(2);
    expect(
      calls.filter((c) => c.url === "https://api.telegram.org/bottg-bot-test-token/sendMessage")
    ).toHaveLength(2);
  });

  it("4. Enforces idempotency per shift.id unless forceResend is true", async () => {
    process.env.FONNTE_API_TOKEN = "fonnte-test-token";
    process.env.KA_ARI_WHATSAPP_PHONE = "081211112222";

    const shift = makeClosedShift({ id: `shf-${SHIFT_BASE_START_MS}-idem` });
    const orders: OrderRecord[] = [
      makePaidOrder({
        id: "ord-idem-1",
        orderNumber: "ORD-401",
        createdAt: "2026-11-17T03:00:00.000Z",
        paymentMethod: "CASH",
        subtotal: 50000,
        tax: 5000,
        total: 55000,
        items: [
          {
            id: "itm-idem-1",
            tenantId: "tenant-ks",
            productName: "Americano",
            quantity: 1,
            unitPrice: 50000,
          },
        ],
      }),
    ];

    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ status: true }), { status: 200 });
    }) as unknown as typeof fetch;

    const first = await dispatchShiftClosingChatbot({
      shift,
      orders,
      fetchImpl: mockFetch,
    });
    expect(first.duplicateSkipped).toBeFalsy();
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const second = await dispatchShiftClosingChatbot({
      shift,
      orders,
      fetchImpl: mockFetch,
    });
    expect(second.duplicateSkipped).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const forced = await dispatchShiftClosingChatbot({
      shift,
      orders,
      forceResend: true,
      fetchImpl: mockFetch,
    });
    expect(forced.duplicateSkipped).toBeFalsy();
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("5. POST /api/shifts CLOSE automatically dispatches closing chatbot and records audit log", async () => {
    const startMs = Date.parse("2026-11-17T01:00:00.000Z");
    const shiftId = `shf-${startMs}-e2e`;
    await writePersistentData("shifts.json", []);
    await writePersistentData("closing_chatbot_dispatches.json", []);
    await writePersistentData("audit_logs.json", []);

    await savePersistentShift({
      id: shiftId,
      shiftName: "Shift Pagi E2E",
      outletId: "outlet-sgr",
      outletName: "Singaraja (Pusat)",
      assignedCashierId: "user-cashier-sgr",
      assignedCashierName: "Ni Kadek Sri (Kasir)",
      startTime: "2026-11-17T01:00:00.000Z",
      status: "ACTIVE",
      openingCash: 200000,
      cashSales: 55000,
      nonCashSales: 0,
      refundAmount: 0,
      expectedCash: 255000,
      actualCash: 200000,
      cashVariance: 0,
    });

    await savePersistentOrder(
      makePaidOrder({
        id: "ord-e2e-1",
        orderNumber: "ORD-501",
        createdAt: "2026-11-17T02:00:00.000Z",
        paymentMethod: "CASH",
        subtotal: 50000,
        tax: 5000,
        total: 55000,
        items: [
          {
            id: "itm-e2e-1",
            tenantId: "tenant-ks",
            productName: "Matcha Latte",
            quantity: 1,
            unitPrice: 50000,
          },
        ],
      })
    );

    const closeReq = new NextRequest("http://localhost:3000/api/shifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CASHIER_SGR",
      },
      body: JSON.stringify({
        action: "CLOSE",
        shiftId,
        actualCash: 255000,
        closingNotes: "Closing otomatis E2E",
      }),
    });

    const res = await postShifts(closeReq);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.shift.status).toBe("CLOSED");
    expect(body.chatbotDispatch).toBeDefined();
    expect(body.chatbotDispatch.shiftId).toBe(shiftId);
    expect(body.chatbotDispatch.envelopeCount).toBe(2);

    const dispatches = await getClosingChatbotDispatches();
    expect(dispatches.some((d) => d.shiftId === shiftId)).toBe(true);

    const audits = await getAuditLogs();
    const audit = audits.find(
      (a) => a.module === "EMPLOYEES_SHIFT" && a.action === "CLOSING_CHATBOT_DISPATCHED" && a.recordId === shiftId
    );
    expect(audit).toBeDefined();

    const unauthGet = await getClosingChatbot(
      new NextRequest("http://localhost:3000/api/notifications/closing-chatbot")
    );
    expect(unauthGet.status).toBe(401);

    const customerForbiddenPost = await postClosingChatbot(
      new NextRequest("http://localhost:3000/api/notifications/closing-chatbot", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "dagoeng_active_persona=CUSTOMER",
        },
        body: JSON.stringify({ shiftId }),
      })
    );
    expect(customerForbiddenPost.status).toBe(403);

    const missingShiftPost = await postClosingChatbot(
      new NextRequest("http://localhost:3000/api/notifications/closing-chatbot", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "dagoeng_active_persona=HUB_MANAGER",
        },
        body: JSON.stringify({ shiftId: "shf-nonexistent" }),
      })
    );
    expect(missingShiftPost.status).toBe(404);

    await savePersistentShift({
      id: "shf-still-active",
      shiftName: "Shift Aktif",
      outletId: "outlet-sgr",
      outletName: "Singaraja (Pusat)",
      assignedCashierId: "user-cashier-sgr",
      assignedCashierName: "Ni Kadek Sri",
      startTime: "2026-11-17T08:00:00.000Z",
      status: "ACTIVE",
      openingCash: 100000,
      cashSales: 0,
      nonCashSales: 0,
      refundAmount: 0,
      expectedCash: 100000,
      actualCash: 100000,
      cashVariance: 0,
    });
    const activeShiftPost = await postClosingChatbot(
      new NextRequest("http://localhost:3000/api/notifications/closing-chatbot", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "dagoeng_active_persona=HUB_MANAGER",
        },
        body: JSON.stringify({ shiftId: "shf-still-active" }),
      })
    );
    expect(activeShiftPost.status).toBe(400);

    const authGet = await getClosingChatbot(
      new NextRequest(`http://localhost:3000/api/notifications/closing-chatbot?shiftId=${shiftId}`, {
        headers: { cookie: "dagoeng_active_persona=HUB_OWNER" },
      })
    );
    expect(authGet.status).toBe(200);
    const getBody = await authGet.json();
    expect(getBody.dispatches).toHaveLength(1);

    const manualPost = await postClosingChatbot(
      new NextRequest("http://localhost:3000/api/notifications/closing-chatbot", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "dagoeng_active_persona=HUB_MANAGER",
        },
        body: JSON.stringify({ shiftId, forceResend: true }),
      })
    );
    expect(manualPost.status).toBe(200);
    const manualBody = await manualPost.json();
    expect(manualBody.success).toBe(true);
    expect(manualBody.dispatch.forceResend).toBe(true);
  });

  it("6. Applies settlement_receipt_policy.json custom splits and settlementBasis to partner envelopes", async () => {
    await writePersistentData("settlement_receipt_policy.json", {
      settlementBasis: "RECEIPT_TOTAL_WITH_TAX",
      revenueSplits: {
        "tenant-ks": {
          tenantId: "tenant-ks",
          tenantName: "Kopi Senja",
          tenantSharePercent: 80,
          dagoSharePercent: 20,
          status: "ACTIVE",
        },
      },
    });

    const shift = makeClosedShift({ id: `shf-${SHIFT_BASE_START_MS}-policy` });
    const orders: OrderRecord[] = [
      makePaidOrder({
        id: "ord-pol-1",
        orderNumber: "ORD-601",
        createdAt: "2026-11-17T03:00:00.000Z",
        paymentMethod: "QRIS",
        subtotal: 100000,
        discount: 0,
        tax: 10000,
        serviceCharge: 0,
        total: 110000,
        items: [
          {
            id: "itm-pol-1",
            tenantId: "tenant-ks",
            productName: "Kopi Susu",
            quantity: 2,
            unitPrice: 50000,
          },
        ],
      }),
    ];

    const dispatch = await dispatchShiftClosingChatbot({ shift, orders });
    expect(dispatch.settlementBasis).toBe("RECEIPT_TOTAL_WITH_TAX");

    const kopiSenja = dispatch.envelopes.find((e) => e.recipientId === "tenant-ks");
    expect(kopiSenja).toBeDefined();
    expect(kopiSenja?.role).toBe("PARTNER");
    if (kopiSenja?.role === "PARTNER") {
      expect(kopiSenja.summary.effectiveBasisAmount).toBe(110000);
      expect(kopiSenja.summary.tenantSharePercent).toBe(80);
      expect(kopiSenja.summary.dagoSharePercent).toBe(20);
      expect(kopiSenja.summary.partnerShareAmount).toBe(88000);
      expect(kopiSenja.summary.dagoShareAmount).toBe(22000);
    }
    expect(kopiSenja?.message).toContain("Rp 110.000");
    expect(kopiSenja?.message).toContain("Rp 88.000");
    expect(kopiSenja?.message).toContain("Rp 22.000");
  });

  it("7. Cross-task integration: Owner saves policy via PUT /api/settings/settlement-receipt and shift CLOSE applies it to chatbot envelopes", async () => {
    await writePersistentData("shifts.json", []);
    await writePersistentData("pos_orders.json", []);
    await writePersistentData("closing_chatbot_dispatches.json", []);
    await writePersistentData("audit_logs.json", []);

    const policyRes = await putSettlementReceiptPolicy(
      new NextRequest("http://localhost:3000/api/settings/settlement-receipt", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: "dagoeng_active_persona=DAGO_OWNER",
        },
        body: JSON.stringify({
          settlementBasis: "RECEIPT_GROSS_SUBTOTAL",
          revenueSplits: {
            "tenant-ks": {
              tenantId: "tenant-ks",
              tenantName: "Kopi Senja",
              tenantSharePercent: 70,
              dagoSharePercent: 30,
              status: "ACTIVE",
            },
          },
        }),
      })
    );
    expect(policyRes.status).toBe(200);

    const startMs = Date.parse("2026-11-17T01:00:00.000Z");
    const shiftId = `shf-${startMs}-cross`;
    await savePersistentShift({
      id: shiftId,
      shiftName: "Shift Pagi Cross V17-V18",
      outletId: "outlet-sgr",
      outletName: "Singaraja (Pusat)",
      assignedCashierId: "user-cashier-sgr",
      assignedCashierName: "Ni Kadek Sri (Kasir)",
      startTime: "2026-11-17T01:00:00.000Z",
      status: "ACTIVE",
      openingCash: 100000,
      cashSales: 88000,
      nonCashSales: 0,
      refundAmount: 0,
      expectedCash: 188000,
      actualCash: 100000,
      cashVariance: 0,
    });

    await savePersistentOrder(
      makePaidOrder({
        id: "ord-cross-1",
        orderNumber: "ORD-701",
        createdAt: "2026-11-17T02:30:00.000Z",
        paymentMethod: "CASH",
        subtotal: 100000,
        discount: 20000,
        tax: 8000,
        total: 88000,
        items: [
          {
            id: "itm-cross-1",
            tenantId: "tenant-ks",
            productName: "Kopi Senja Aren",
            quantity: 4,
            unitPrice: 25000,
          },
        ],
      })
    );

    const closeRes = await postShifts(
      new NextRequest("http://localhost:3000/api/shifts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "dagoeng_active_persona=CASHIER_SGR",
        },
        body: JSON.stringify({
          action: "CLOSE",
          shiftId,
          actualCash: 188000,
          closingNotes: "Closing cross-task V17-V18",
        }),
      })
    );
    expect(closeRes.status).toBe(200);
    const closeJson = await closeRes.json();
    expect(closeJson.chatbotDispatch.settlementBasis).toBe("RECEIPT_GROSS_SUBTOTAL");
    const ksEnv = closeJson.chatbotDispatch.envelopes.find(
      (e: { recipientId: string }) => e.recipientId === "tenant-ks"
    );
    expect(ksEnv).toBeDefined();
    expect(ksEnv.summary.effectiveBasisAmount).toBe(100000);
    expect(ksEnv.summary.partnerShareAmount).toBe(70000);
    expect(ksEnv.summary.dagoShareAmount).toBe(30000);
  });
});
