import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  authorizeSupervisorQrisOverride,
  canConfirmQrisPayment,
  signQrisWebhookPayload,
  resetSupervisorPinRateLimitForTests,
} from "../src/lib/qris-verification";
import { POST as postQrisVerify, GET as getQrisVerify } from "../src/app/api/pos/qris/verify/route";
import { POST as postOrders } from "../src/app/api/orders/route";
import { getAuditLogs } from "../src/lib/persistent-storage";

describe("A4 (POS-25): QRIS Payment Verification & Supervisor Manual Override", () => {
  beforeEach(() => {
    process.env.QRIS_WEBHOOK_SECRET = "test-webhook-secret-key-2026-secure";
    process.env.SUPERVISOR_OVERRIDE_PIN = "2580";
    resetSupervisorPinRateLimitForTests();
  });

  it("prevents standard cashier from marking QRIS as paid without gateway confirmation or supervisor PIN (TC-K01)", () => {
    const canConfirm = canConfirmQrisPayment({
      isGatewayVerified: false,
      supervisorOverride: undefined,
    });
    expect(canConfirm).toBe(false);
  });

  it("rejects webhook confirmation if session is unregistered, signature is invalid, or amount mismatches, and succeeds when pre-registered", async () => {
    const invoice = `INV-TEST-${Date.now()}`;

    // Pre-register the QRIS payment session on the server with expectedAmount = 150000
    const initReq = new NextRequest("http://localhost:3000/api/pos/qris/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CASHIER_SGR",
      },
      body: JSON.stringify({
        mode: "INIT",
        invoiceNumber: invoice,
        expectedAmount: 150000,
      }),
    });
    const initRes = await postQrisVerify(initReq);
    expect(initRes.status).toBe(200);

    const validSig = signQrisWebhookPayload({
      invoiceNumber: invoice,
      amount: 150000,
      transactionStatus: "SUCCESS",
    });

    // 1. Invalid signature -> 401
    const badSigReq = new NextRequest("http://localhost:3000/api/pos/qris/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dago-signature": "forged-signature-123",
      },
      body: JSON.stringify({
        mode: "WEBHOOK",
        invoiceNumber: invoice,
        amount: 150000,
        transactionStatus: "SUCCESS",
      }),
    });
    const badSigRes = await postQrisVerify(badSigReq);
    expect(badSigRes.status).toBe(401);

    // 2. Amount mismatch against server session (even if attacker sends body.expectedAmount = 100000) -> 400
    const mismatchSig = signQrisWebhookPayload({
      invoiceNumber: invoice,
      amount: 100000,
      transactionStatus: "SUCCESS",
    });
    const mismatchReq = new NextRequest("http://localhost:3000/api/pos/qris/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dago-signature": mismatchSig,
      },
      body: JSON.stringify({
        mode: "WEBHOOK",
        invoiceNumber: invoice,
        amount: 100000,
        expectedAmount: 100000,
        transactionStatus: "SUCCESS",
      }),
    });
    const mismatchRes = await postQrisVerify(mismatchReq);
    expect(mismatchRes.status).toBe(400);

    // 3. Valid signature & matching server expectedAmount -> 200 and idempotent on replay
    const validReq1 = new NextRequest("http://localhost:3000/api/pos/qris/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dago-signature": validSig,
      },
      body: JSON.stringify({
        mode: "WEBHOOK",
        invoiceNumber: invoice,
        amount: 150000,
        transactionStatus: "SUCCESS",
      }),
    });
    const validRes1 = await postQrisVerify(validReq1);
    expect(validRes1.status).toBe(200);
    const data1 = await validRes1.json();
    expect(data1.allowed).toBe(true);
    expect(data1.idempotent).toBe(false);

    // Replay same webhook -> idempotent: true, does not duplicate
    const validReq2 = new NextRequest("http://localhost:3000/api/pos/qris/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dago-signature": validSig,
      },
      body: JSON.stringify({
        mode: "WEBHOOK",
        invoiceNumber: invoice,
        amount: 150000,
        transactionStatus: "SUCCESS",
      }),
    });
    const validRes2 = await postQrisVerify(validReq2);
    expect(validRes2.status).toBe(200);
    const data2 = await validRes2.json();
    expect(data2.idempotent).toBe(true);
    expect(data2.alreadyProcessed).toBe(true);

    // Poll status via GET /api/pos/qris/verify
    const statusReq = new NextRequest(
      `http://localhost:3000/api/pos/qris/verify?invoiceNumber=${invoice}&expectedAmount=150000`,
      {
        headers: { cookie: "dagoeng_active_persona=CASHIER_SGR" },
      }
    );
    const statusRes = await getQrisVerify(statusReq);
    const statusData = await statusRes.json();
    expect(statusData.verified).toBe(true);
    expect(statusData.status).toBe("VERIFIED_WEBHOOK");
  });

  it("R4: rejects webhook for unregistered invoiceNumber (404) and fails closed (500) in production without QRIS_WEBHOOK_SECRET", async () => {
    const unregisteredInvoice = `INV-UNREG-${Date.now()}`;
    const sig = signQrisWebhookPayload({
      invoiceNumber: unregisteredInvoice,
      amount: 1,
      transactionStatus: "SUCCESS",
    });

    const unregReq = new NextRequest("http://localhost:3000/api/pos/qris/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dago-signature": sig,
      },
      body: JSON.stringify({
        mode: "WEBHOOK",
        invoiceNumber: unregisteredInvoice,
        amount: 1,
        expectedAmount: 1,
        transactionStatus: "SUCCESS",
      }),
    });
    const unregRes = await postQrisVerify(unregReq);
    expect(unregRes.status).toBe(404);

    // Production without QRIS_WEBHOOK_SECRET must fail closed with 500
    const prevNodeEnv = process.env.NODE_ENV;
    delete process.env.QRIS_WEBHOOK_SECRET;
    (process.env as any).NODE_ENV = "production";
    try {
      const prodReq = new NextRequest("http://localhost:3000/api/pos/qris/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "WEBHOOK",
          invoiceNumber: unregisteredInvoice,
          amount: 150000,
          transactionStatus: "SUCCESS",
        }),
      });
      const prodRes = await postQrisVerify(prodReq);
      expect(prodRes.status).toBe(500);
    } finally {
      (process.env as any).NODE_ENV = prevNodeEnv;
      process.env.QRIS_WEBHOOK_SECRET = "test-webhook-secret-key-2026-secure";
    }
  });

  it("rejects supervisor override when PIN is wrong, RRN is missing, or non-supervisor role is supplied", async () => {
    // Wrong PIN
    const wrongPinResult = authorizeSupervisorQrisOverride({
      pin: "0000",
      referenceNumber: "RRN-99281726",
    });
    expect(wrongPinResult.allowed).toBe(false);

    // Non-supervisor role attempting to act as supervisor
    const cashierAsSupervisor = authorizeSupervisorQrisOverride({
      pin: "2580",
      referenceNumber: "RRN-99281726",
      supervisorRole: "CASHIER",
    });
    expect(cashierAsSupervisor.allowed).toBe(false);
    expect(cashierAsSupervisor.statusCode).toBe(403);

    // Missing RRN
    const missingRefResult = authorizeSupervisorQrisOverride({
      pin: "2580",
      referenceNumber: "  ",
    });
    expect(missingRefResult.allowed).toBe(false);
  });

  it("R5: ignores forged supervisorRole from body, locks out after 5 failed PIN attempts, and blocks unverified PAID QRIS orders on POST /api/orders with 409", async () => {
    const invoice = `INV-SUP-${Date.now()}`;
    const rrn = `BCA-RRN-${Date.now()}`;

    // Cashier sends valid PIN with forged supervisorRole: "SUPER_ADMIN" in body
    const req = new NextRequest("http://localhost:3000/api/pos/qris/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CASHIER_SGR",
      },
      body: JSON.stringify({
        mode: "SUPERVISOR_OVERRIDE",
        pin: "2580",
        referenceNumber: rrn,
        invoiceNumber: invoice,
        expectedAmount: 85000,
        supervisorRole: "SUPER_ADMIN",
        supervisorName: "Forged Super Admin",
        note: "QRIS Statis Akrilik Meja 03",
      }),
    });

    const res = await postQrisVerify(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.allowed).toBe(true);
    expect(data.verification.type).toBe("SUPERVISOR_MANUAL");
    expect(data.verification.referenceNumber).toBe(rrn);
    // Stored role must come from server supervisor record ("MANAGER"), never "SUPER_ADMIN" from body
    expect(data.session.verifiedByRole).toBe("MANAGER");
    expect(data.session.verifiedByName).toBe("Putu Arya (Store Manager)");

    // Check audit log was written on server
    const logs = await getAuditLogs();
    const matchedLog = logs.find(
      (l) => l.action === "QRIS_SUPERVISOR_MANUAL_OVERRIDE" && l.referenceId === invoice
    );
    expect(matchedLog).toBeDefined();
    expect(matchedLog?.metadata?.rrn).toBe(rrn);

    // Brute-force lockout after 5 wrong PIN attempts -> 429
    for (let i = 0; i < 5; i++) {
      authorizeSupervisorQrisOverride({
        pin: "9999",
        referenceNumber: "RRN-LOCKOUT",
        actorKey: "brute-force-actor",
      });
    }
    const lockedAttempt = authorizeSupervisorQrisOverride({
      pin: "2580",
      referenceNumber: "RRN-LOCKOUT",
      actorKey: "brute-force-actor",
    });
    expect(lockedAttempt.allowed).toBe(false);
    expect(lockedAttempt.statusCode).toBe(429);

    // POST /api/orders with paymentMethod: "QRIS", paymentStatus: "PAID" without verified QRIS session -> 409
    const unverifiedOrderReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "dagoeng_active_persona=CASHIER_SGR",
      },
      body: JSON.stringify({
        order: {
          id: `ord-unverified-qris-${Date.now()}`,
          orderNumber: `ORD-UNV-${Date.now()}`,
          outletId: "outlet-sgr",
          subtotal: 50000,
          tax: 5000,
          serviceCharge: 0,
          total: 55000,
          paymentMethod: "QRIS",
          paymentStatus: "PAID",
          items: [
            {
              productName: "Kopi Senja",
              quantity: 2,
              unitPrice: 25000,
            },
          ],
        },
      }),
    });
    const unverifiedOrderRes = await postOrders(unverifiedOrderReq);
    expect(unverifiedOrderRes.status).toBe(409);
  });
});
