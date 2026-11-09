import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import {
  authorizeSupervisorQrisOverride,
  verifyGatewayWebhook,
  canConfirmQrisPayment,
  signQrisWebhookPayload,
} from "../src/lib/qris-verification";
import { POST as postQrisVerify, GET as getQrisVerify } from "../src/app/api/pos/qris/verify/route";
import { getAuditLogs } from "../src/lib/persistent-storage";

describe("A4 (POS-25): QRIS Payment Verification & Supervisor Manual Override", () => {
  it("prevents standard cashier from marking QRIS as paid without gateway confirmation or supervisor PIN (TC-K01)", () => {
    const canConfirm = canConfirmQrisPayment({
      isGatewayVerified: false,
      supervisorOverride: undefined,
    });
    expect(canConfirm).toBe(false);
  });

  it("rejects webhook confirmation if signature is invalid, status is PENDING, or amount mismatches", async () => {
    const invoice = `INV-TEST-${Date.now()}`;
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
        expectedAmount: 150000,
        transactionStatus: "SUCCESS",
      }),
    });
    const badSigRes = await postQrisVerify(badSigReq);
    expect(badSigRes.status).toBe(401);

    // 2. Amount mismatch -> 400
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
        expectedAmount: 150000,
        transactionStatus: "SUCCESS",
      }),
    });
    const mismatchRes = await postQrisVerify(mismatchReq);
    expect(mismatchRes.status).toBe(400);

    // 3. Valid signature & matching amount -> 200 and idempotent on replay
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
        expectedAmount: 150000,
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
        expectedAmount: 150000,
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
      `http://localhost:3000/api/pos/qris/verify?invoiceNumber=${invoice}`,
      {
        headers: { cookie: "dagoeng_active_persona=CASHIER_SGR" },
      }
    );
    const statusRes = await getQrisVerify(statusReq);
    const statusData = await statusRes.json();
    expect(statusData.verified).toBe(true);
    expect(statusData.status).toBe("VERIFIED_WEBHOOK");
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

  it("verifies supervisor override on the server and records an immutable audit log entry", async () => {
    const invoice = `INV-SUP-${Date.now()}`;
    const rrn = `BCA-RRN-${Date.now()}`;

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
        supervisorRole: "MANAGER",
        supervisorName: "Putu Arya (Store Manager)",
        note: "QRIS Statis Akrilik Meja 03",
      }),
    });

    const res = await postQrisVerify(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.allowed).toBe(true);
    expect(data.verification.type).toBe("SUPERVISOR_MANUAL");
    expect(data.verification.referenceNumber).toBe(rrn);

    // Check audit log was written on server
    const logs = await getAuditLogs();
    const matchedLog = logs.find(
      (l) => l.action === "QRIS_SUPERVISOR_MANUAL_OVERRIDE" && l.referenceId === invoice
    );
    expect(matchedLog).toBeDefined();
    expect(matchedLog?.metadata?.rrn).toBe(rrn);
  });
});
