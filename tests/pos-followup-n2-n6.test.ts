import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as postQrisVerify } from "@/app/api/pos/qris/verify/route";
import { POST as postOrders, GET as getOrders } from "@/app/api/orders/route";
import { POST as postShifts } from "@/app/api/shifts/route";
import { getPersistentLoyaltyPoints, getPersistentOrders } from "@/lib/persistent-storage";
import {
  signQrisWebhookPayload,
  resetSupervisorPinRateLimitForTests,
  SHARED_SUPERVISOR_PIN_LABEL,
} from "@/lib/qris-verification";
import { syncWithOutbox, flushOutbox, getOutboxItems, clearOutboxForTests } from "@/lib/sync-outbox";

const CASHIER = "dagoeng_active_persona=CASHIER_SGR";
const MANAGER = "dagoeng_active_persona=HUB_MANAGER";
const KITCHEN = "dagoeng_active_persona=KITCHEN_SGR";
const WAITER = "dagoeng_active_persona=WAITER_SGR";

function post(url: string, body: unknown, cookie: string = CASHIER, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie, ...headers },
    body: JSON.stringify(body),
  });
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function posOrder(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    orderNumber: id.toUpperCase(),
    outletId: "outlet-sgr",
    status: "CONFIRMED",
    customerName: "Budi",
    subtotal: 50000,
    tax: 5000,
    serviceCharge: 0,
    total: 55000,
    paymentStatus: "PAID",
    items: [{ id: "i1", productName: "Kopi", quantity: 1, unitPrice: 50000 }],
    ...extra,
  };
}

async function initQris(invoiceNumber: string, expectedAmount = 55000) {
  const res = await postQrisVerify(post("/api/pos/qris/verify", { mode: "INIT", invoiceNumber, expectedAmount }));
  expect(res.status).toBe(200);
}

async function settleByWebhook(invoiceNumber: string, amount = 55000) {
  const signature = signQrisWebhookPayload({ invoiceNumber, amount, transactionStatus: "SUCCESS" });
  const res = await postQrisVerify(
    post("/api/pos/qris/verify", { invoiceNumber, amount, transactionStatus: "SUCCESS" }, "", {
      "x-dago-signature": signature,
    })
  );
  expect(res.status).toBe(200);
  return (await res.json()).verification;
}

beforeEach(() => {
  process.env.QRIS_WEBHOOK_SECRET = "test-webhook-secret-key-2026-secure";
  process.env.SUPERVISOR_OVERRIDE_PIN = "9137";
  resetSupervisorPinRateLimitForTests();
  clearOutboxForTests();
});

describe("N2: supervisor-approved QRIS orders are accepted by the server", () => {
  it("saves the order exactly as the POS page builds it after a supervisor override", async () => {
    const invoice = uid("TX-SUP");
    await initQris(invoice);
    const overrideRes = await postQrisVerify(
      post("/api/pos/qris/verify", {
        mode: "SUPERVISOR_OVERRIDE",
        pin: "9137",
        referenceNumber: "RRN987654",
        invoiceNumber: invoice,
      })
    );
    expect(overrideRes.status).toBe(200);
    const { verification } = await overrideRes.json();
    expect(verification.invoiceNumber).toBe(invoice);

    const orderRes = await postOrders(
      post("/api/orders", {
        order: posOrder(uid("ord-sup"), {
          paymentMethod: "QRIS",
          paymentReference: verification.referenceNumber,
          qrisVerification: verification,
        }),
      })
    );
    expect(orderRes.status).toBe(200);
  });

  it("rejects a supervisor override for an invoice that was never registered", async () => {
    const res = await postQrisVerify(
      post("/api/pos/qris/verify", {
        mode: "SUPERVISOR_OVERRIDE",
        pin: "9137",
        referenceNumber: "RRN111111",
        invoiceNumber: uid("TX-NONE"),
      })
    );
    expect(res.status).toBe(404);
  });
});

describe("N3: one QRIS payment settles exactly one order", () => {
  it("rejects a second order reusing the same payment and accepts a retry of the first", async () => {
    const invoice = uid("TX-WH");
    await initQris(invoice);
    const verification = await settleByWebhook(invoice);

    const first = posOrder(uid("ord-wh-a"), { paymentMethod: "QRIS", qrisVerification: verification });
    expect((await postOrders(post("/api/orders", { order: first }))).status).toBe(200);
    expect((await postOrders(post("/api/orders", { order: first }))).status).toBe(200);

    const second = posOrder(uid("ord-wh-b"), { paymentMethod: "QRIS", qrisVerification: verification });
    const secondRes = await postOrders(post("/api/orders", { order: second }));
    expect(secondRes.status).toBe(409);
    expect((await secondRes.json()).error).toContain("ALREADY_CONSUMED");
  });

  it("rejects a PAID QRIS order whose total differs from the settled amount", async () => {
    const invoice = uid("TX-AMT");
    await initQris(invoice);
    const verification = await settleByWebhook(invoice);
    const res = await postOrders(
      post("/api/orders", {
        order: posOrder(uid("ord-amt"), {
          subtotal: 100000,
          tax: 10000,
          total: 110000,
          items: [{ id: "i1", productName: "Kopi", quantity: 2, unitPrice: 50000 }],
          paymentMethod: "QRIS",
          qrisVerification: verification,
        }),
      })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("AMOUNT_MISMATCH");
  });
});

describe("N4: a shared supervisor PIN never names a person who was not involved", () => {
  it("records the shared PIN label when a cashier enters the PIN, ignoring identity in the body", async () => {
    const invoice = uid("TX-PIN");
    await initQris(invoice);
    const res = await postQrisVerify(
      post("/api/pos/qris/verify", {
        mode: "SUPERVISOR_OVERRIDE",
        pin: "9137",
        referenceNumber: "RRN222222",
        invoiceNumber: invoice,
        supervisorName: "Putu Arya (Store Manager)",
        supervisorId: "emp-001",
        supervisorRole: "OWNER",
      })
    );
    const { session } = await res.json();
    expect(session.verifiedByName).toBe(SHARED_SUPERVISOR_PIN_LABEL);
    expect(session.verifiedByUserId).toBeUndefined();
    expect(session.verifiedByRole).toBeUndefined();
    expect(session.verificationMethod).toBe("SHARED_SUPERVISOR_PIN");
  });

  it("records the supervisor's own identity when a supervisor enters the PIN", async () => {
    const invoice = uid("TX-MGR");
    await initQris(invoice);
    const res = await postQrisVerify(
      post(
        "/api/pos/qris/verify",
        { mode: "SUPERVISOR_OVERRIDE", pin: "9137", referenceNumber: "RRN333333", invoiceNumber: invoice },
        MANAGER
      )
    );
    const { session } = await res.json();
    expect(session.verifiedByRole).toBe("MANAGER");
    expect(session.verifiedByUserId).toBeTruthy();
    expect(session.verificationMethod).toBe("SUPERVISOR_OVERRIDE");
  });
});

describe("N5: split bills are stored as SPLIT and sync failures are never silent", () => {
  it("accepts a split bill order without demanding a QRIS session", async () => {
    const res = await postOrders(post("/api/orders", { order: posOrder(uid("ord-split"), { paymentMethod: "SPLIT" }) }));
    expect(res.status).toBe(200);
  });

  it("counts a retried RECORD_SALE with the same saleId only once", async () => {
    const shiftId = `shf-${Date.now()}-n5ab`;
    const open = await postShifts(post("/api/shifts", { action: "OPEN", shiftId, openingCash: 100000, outletId: "outlet-sgr" }));
    expect(open.status).toBe(200);

    const sale = { action: "RECORD_SALE", shiftId, cashAmount: 50000, nonCashAmount: 0, saleId: "ord-n5-sale" };
    await postShifts(post("/api/shifts", sale));
    const retry = await postShifts(post("/api/shifts", sale));
    expect((await retry.json()).shift.cashSales).toBe(50000);

    const close = await postShifts(post("/api/shifts", { action: "CLOSE", shiftId, actualCash: 150000 }));
    expect((await close.json()).shift.cashVariance).toBe(0);
  });

  it("drops a 4xx-rejected mutation from the outbox and reports it instead of retrying forever", async () => {
    const rejectingFetch = (async () =>
      new Response(JSON.stringify({ error: "QRIS_PAYMENT_UNVERIFIED" }), { status: 409 })) as typeof fetch;
    const offlineFetch = (async () => {
      throw new Error("offline");
    }) as typeof fetch;

    const queued = await syncWithOutbox(
      { id: "order-sync-x", endpoint: "/api/orders", payload: { order: { id: "x" } } },
      offlineFetch
    );
    expect(queued.rejected).toBe(false);
    expect(getOutboxItems()).toHaveLength(1);

    const flushed = await flushOutbox(rejectingFetch);
    expect(flushed.rejected).toHaveLength(1);
    expect(flushed.rejected[0].error).toContain("QRIS_PAYMENT_UNVERIFIED");
    expect(getOutboxItems()).toHaveLength(0);
  });
});

describe("N6: paid orders cannot be reversed by a cashier and loyalty data stays with POS roles", () => {
  it("forbids a cashier from turning a paid order into a refund, and allows a manager", async () => {
    const id = uid("ord-rev");
    expect((await postOrders(post("/api/orders", { order: posOrder(id, { paymentMethod: "CASH" }) }))).status).toBe(200);

    const reversal = posOrder(id, { paymentMethod: "CASH", paymentStatus: "REFUNDED", status: "CANCELLED" });
    expect((await postOrders(post("/api/orders", { order: reversal }))).status).toBe(403);
    expect((await postOrders(post("/api/orders", { order: reversal }, MANAGER))).status).toBe(200);
  });

  it("returns orders but no loyalty records to kitchen staff", async () => {
    const res = await getOrders(new NextRequest("http://localhost:3000/api/orders", { headers: { cookie: KITCHEN } }));
    expect(res.status).toBe(200);
    expect((await res.json()).loyaltyPoints).toEqual([]);
  });
});

describe("Reviewer bypasses: a settled QRIS payment stays bound to one order", () => {
  async function supervisorApprove(invoice: string) {
    const res = await postQrisVerify(
      post("/api/pos/qris/verify", { mode: "SUPERVISOR_OVERRIDE", pin: "9137", referenceNumber: "RRN444444", invoiceNumber: invoice })
    );
    return { status: res.status, body: await res.json() };
  }

  it("a late gateway webhook after a supervisor approval does not free the payment for another order", async () => {
    const invoice = uid("TX-LATE");
    await initQris(invoice);
    const { body } = await supervisorApprove(invoice);
    const orderA = posOrder(uid("ord-late-a"), { paymentMethod: "QRIS", qrisVerification: body.verification });
    expect((await postOrders(post("/api/orders", { order: orderA }))).status).toBe(200);

    await settleByWebhook(invoice);

    const orderC = posOrder(uid("ord-late-c"), { paymentMethod: "QRIS", qrisVerification: body.verification });
    expect((await postOrders(post("/api/orders", { order: orderC }))).status).toBe(409);
  });

  it("re-running INIT cannot downgrade or re-arm a verified payment", async () => {
    const invoice = uid("TX-REARM");
    await initQris(invoice);
    const verification = await settleByWebhook(invoice);
    const orderA = posOrder(uid("ord-rearm-a"), { paymentMethod: "QRIS", qrisVerification: verification });
    expect((await postOrders(post("/api/orders", { order: orderA }))).status).toBe(200);

    const reinit = await postQrisVerify(post("/api/pos/qris/verify", { mode: "INIT", invoiceNumber: invoice, expectedAmount: 55001 }));
    expect(reinit.status).toBe(409);
    await postQrisVerify(post("/api/pos/qris/verify", { mode: "INIT", invoiceNumber: invoice, expectedAmount: 55000 }));
    await settleByWebhook(invoice);

    const orderB = posOrder(uid("ord-rearm-b"), { paymentMethod: "QRIS", qrisVerification: verification });
    expect((await postOrders(post("/api/orders", { order: orderB }))).status).toBe(409);
  });

  it("a supervisor PIN cannot overwrite a payment the gateway already verified", async () => {
    const invoice = uid("TX-GW");
    await initQris(invoice);
    await settleByWebhook(invoice);
    const { status } = await supervisorApprove(invoice);
    expect(status).toBe(409);
  });
});

describe("Reviewer bypasses: a cashier cannot rewrite a paid order", () => {
  it("blocks the two-step PAID -> PENDING -> REFUNDED reversal", async () => {
    const id = uid("ord-2step");
    expect((await postOrders(post("/api/orders", { order: posOrder(id, { paymentMethod: "CASH" }) }))).status).toBe(200);
    const toPending = posOrder(id, { paymentMethod: "CASH", paymentStatus: "PENDING" });
    expect((await postOrders(post("/api/orders", { order: toPending }))).status).toBe(403);
  });

  it("blocks zeroing the amounts of a paid order while keeping it PAID", async () => {
    const id = uid("ord-zero");
    expect((await postOrders(post("/api/orders", { order: posOrder(id, { paymentMethod: "CASH" }) }))).status).toBe(200);
    const zeroed = posOrder(id, { paymentMethod: "CASH", subtotal: 0, tax: 0, total: 0, items: [] });
    expect((await postOrders(post("/api/orders", { order: zeroed }))).status).toBe(403);
  });

  it("still lets staff advance the kitchen status of a paid order", async () => {
    const id = uid("ord-kds");
    expect((await postOrders(post("/api/orders", { order: posOrder(id, { paymentMethod: "CASH" }) }))).status).toBe(200);
    const served = posOrder(id, { paymentMethod: "CASH", status: "SERVED" });
    expect((await postOrders(post("/api/orders", { order: served }))).status).toBe(200);
  });
});

describe("Reviewer finding: an expired session never deletes queued offline work", () => {
  it("keeps a mutation queued when the server answers 401", async () => {
    const unauthorizedFetch = (async () =>
      new Response(JSON.stringify({ error: "SESSION_EXPIRED" }), { status: 401 })) as typeof fetch;
    const result = await syncWithOutbox(
      { id: "order-sync-401", endpoint: "/api/orders", payload: { order: { id: "y" } } },
      unauthorizedFetch
    );
    expect(result.rejected).toBe(false);
    expect(getOutboxItems()).toHaveLength(1);
  });
});

describe("Second review: a paid sale is immutable for non-supervisors, workflow stays open", () => {
  it("blocks a cashier from moving a paid order to another outlet, date, or item list", async () => {
    const id = uid("ord-move");
    expect((await postOrders(post("/api/orders", { order: posOrder(id, { paymentMethod: "CASH" }) }))).status).toBe(200);
    const moved = posOrder(id, { paymentMethod: "CASH", outletId: "outlet-other" });
    expect((await postOrders(post("/api/orders", { order: moved }))).status).toBe(403);
    const redated = posOrder(id, { paymentMethod: "CASH", createdAt: "2020-01-01T00:00:00.000Z" });
    expect((await postOrders(post("/api/orders", { order: redated }))).status).toBe(403);
    const swapped = posOrder(id, {
      paymentMethod: "CASH",
      items: [{ id: "i9", productName: "Teh", quantity: 1, unitPrice: 50000 }],
    });
    expect((await postOrders(post("/api/orders", { order: swapped }))).status).toBe(403);
  });

  it("lets kitchen staff advance a paid order but not change the sale", async () => {
    const id = uid("ord-kitchen");
    expect((await postOrders(post("/api/orders", { order: posOrder(id, { paymentMethod: "CASH" }) }))).status).toBe(200);
    const cooking = posOrder(id, { paymentMethod: "CASH", status: "COOKING" });
    expect((await postOrders(post("/api/orders", { order: cooking }, KITCHEN))).status).toBe(200);
    const changed = posOrder(id, { paymentMethod: "CASH", status: "COOKING", total: 1, subtotal: 1, tax: 0, items: [] });
    expect((await postOrders(post("/api/orders", { order: changed }, KITCHEN))).status).toBe(403);
  });

  it("lets a waiter create an unpaid order but not a paid one", async () => {
    const pending = posOrder(uid("ord-waiter"), { paymentStatus: "PENDING" });
    expect((await postOrders(post("/api/orders", { order: pending }, WAITER))).status).toBe(200);
    const paid = posOrder(uid("ord-waiter-paid"), { paymentMethod: "CASH" });
    expect((await postOrders(post("/api/orders", { order: paid }, WAITER))).status).toBe(403);
  });

  it("keeps an existing paid QRIS order updatable even if it predates invoice binding", async () => {
    const invoice = uid("TX-LEGACY");
    await initQris(invoice);
    const verification = await settleByWebhook(invoice);
    const id = uid("ord-legacy");
    expect((await postOrders(post("/api/orders", { order: posOrder(id, { paymentMethod: "QRIS", qrisVerification: verification }) }))).status).toBe(200);
    const served = posOrder(id, { paymentMethod: "QRIS", qrisVerification: verification, status: "SERVED" });
    expect((await postOrders(post("/api/orders", { order: served }))).status).toBe(200);
  });

  it("blocks re-pointing a paid QRIS order at a second payment", async () => {
    const first = uid("TX-FIRST");
    const second = uid("TX-SECOND");
    await initQris(first);
    await initQris(second);
    const v1 = await settleByWebhook(first);
    const v2 = await settleByWebhook(second);
    const id = uid("ord-repoint");
    expect((await postOrders(post("/api/orders", { order: posOrder(id, { paymentMethod: "QRIS", qrisVerification: v1 }) }))).status).toBe(200);
    const repointed = posOrder(id, { paymentMethod: "QRIS", qrisVerification: v2 });
    expect((await postOrders(post("/api/orders", { order: repointed }))).status).toBe(403);
  });
});

describe("Third review: loyalty credit, refunded orders, and workflow fields", () => {
  it("credits loyalty once, on the move into PAID, to the order's own customer only", async () => {
    const customer = uid("cust");
    const id = uid("ord-loyal");
    const order = posOrder(id, { paymentMethod: "CASH", customerName: customer });
    expect((await postOrders(post("/api/orders", { order }))).status).toBe(200);

    const evilKey = uid("evil");
    const cooking = { ...order, status: "COOKING" };
    expect((await postOrders(post("/api/orders", { order: cooking, customerKey: evilKey }, KITCHEN))).status).toBe(200);
    expect((await postOrders(post("/api/orders", { order: { ...order, status: "SERVED" }, customerKey: evilKey }))).status).toBe(200);

    const points = await getPersistentLoyaltyPoints();
    expect(points.find((p) => p.customerKey === evilKey.toLowerCase())).toBeUndefined();
    expect(points.find((p) => p.customerKey === customer.toLowerCase())?.points).toBe(5);
  });

  it("does not let a cashier re-mark a refunded order as paid", async () => {
    const id = uid("ord-refund");
    expect((await postOrders(post("/api/orders", { order: posOrder(id, { paymentMethod: "CASH" }) }))).status).toBe(200);
    const refunded = posOrder(id, { paymentMethod: "CASH", paymentStatus: "REFUNDED", status: "CANCELLED" });
    expect((await postOrders(post("/api/orders", { order: refunded }, MANAGER))).status).toBe(200);

    const repaid = posOrder(id, { paymentMethod: "CASH", status: "COMPLETED", total: 1, subtotal: 1, tax: 0, items: [] });
    expect((await postOrders(post("/api/orders", { order: repaid }))).status).toBe(403);
    const revived = { ...refunded, status: "COOKING" };
    expect((await postOrders(post("/api/orders", { order: revived }, KITCHEN))).status).toBe(403);
  });

  it("rejects unknown statuses and rewritten history, and never stores client sync fields", async () => {
    const id = uid("ord-hist");
    const order = {
      ...posOrder(id, { paymentMethod: "CASH" }),
      statusHistory: [{ id: "h1", status: "CONFIRMED", timestamp: "2026-11-09T00:00:00.000Z", actorName: "Kasir" }],
    };
    expect((await postOrders(post("/api/orders", { order }))).status).toBe(200);

    expect((await postOrders(post("/api/orders", { order: { ...order, status: "VOID" } }, KITCHEN))).status).toBe(400);
    expect((await postOrders(post("/api/orders", { order: { ...order, status: "COOKING", statusHistory: [] } }, KITCHEN))).status).toBe(403);

    const appended = {
      ...order,
      status: "COOKING",
      syncStatus: "REJECTED",
      syncError: "x".repeat(1000),
      statusHistory: [...order.statusHistory, { id: "h2", status: "COOKING", timestamp: "2026-11-09T00:05:00.000Z", actorName: "Dapur" }],
    };
    expect((await postOrders(post("/api/orders", { order: appended }, KITCHEN))).status).toBe(200);
    const stored = (await getPersistentOrders()).find((o) => o.id === id);
    expect(stored?.syncStatus).toBeUndefined();
    expect(stored?.syncError).toBeUndefined();
  });
});
