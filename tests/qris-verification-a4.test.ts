import { describe, it, expect } from "vitest";
import {
  authorizeSupervisorQrisOverride,
  verifyGatewayWebhook,
  canConfirmQrisPayment,
  verifySupervisorPin,
  DEFAULT_SUPERVISOR_PIN,
} from "../src/lib/qris-verification";

describe("A4 (POS-25): QRIS Payment Verification & Supervisor Manual Override", () => {
  // Test 1: Standard cashier cannot confirm dynamic QRIS without gateway webhook or supervisor PIN
  it("prevents standard cashier from marking QRIS as paid without gateway confirmation or supervisor PIN", () => {
    const unverifiedState = {
      isGatewayVerified: false,
      supervisorOverride: undefined,
    };

    const canConfirm = canConfirmQrisPayment(unverifiedState);
    expect(canConfirm).toBe(false);
  });

  // Test 2: Webhook payment gateway callback successfully enables confirmation
  it("allows confirmation when payment gateway webhook confirms SUCCESS with matching amount", () => {
    const webhookResult = verifyGatewayWebhook({
      transactionStatus: "SUCCESS",
      invoiceNumber: "INV-DAGO-20261109-881",
      amount: 150000,
      expectedAmount: 150000,
    });

    expect(webhookResult.allowed).toBe(true);
    expect(webhookResult.verification?.type).toBe("GATEWAY_WEBHOOK");
    expect(webhookResult.verification?.referenceNumber).toBe("INV-DAGO-20261109-881");

    const canConfirm = canConfirmQrisPayment({
      isGatewayVerified: webhookResult.allowed,
    });
    expect(canConfirm).toBe(true);
  });

  // Test 3: Gateway webhook rejects non-SUCCESS or amount mismatch
  it("rejects webhook confirmation if status is PENDING or amount mismatches", () => {
    const pendingResult = verifyGatewayWebhook({
      transactionStatus: "PENDING",
      invoiceNumber: "INV-DAGO-01",
      amount: 150000,
      expectedAmount: 150000,
    });
    expect(pendingResult.allowed).toBe(false);

    const mismatchResult = verifyGatewayWebhook({
      transactionStatus: "SUCCESS",
      invoiceNumber: "INV-DAGO-02",
      amount: 100000,
      expectedAmount: 150000,
    });
    expect(mismatchResult.allowed).toBe(false);
    expect(mismatchResult.error).toContain("Ketidakcocokan");
  });

  // Test 4: Static QRIS manual override requires valid supervisor PIN
  it("rejects supervisor manual override when PIN is incorrect or blank", () => {
    const invalidPinResult = authorizeSupervisorQrisOverride({
      pin: "0000",
      referenceNumber: "RRN-99281726",
      note: "QRIS Statis Meja 4",
    });

    expect(invalidPinResult.allowed).toBe(false);
    expect(invalidPinResult.error).toContain("PIN Supervisor tidak valid");

    const emptyPinResult = authorizeSupervisorQrisOverride({
      pin: "",
      referenceNumber: "RRN-99281726",
    });
    expect(emptyPinResult.allowed).toBe(false);
  });

  // Test 5: Static QRIS manual override requires reference number (RRN)
  it("rejects supervisor manual override when reference number is missing or too short", () => {
    const missingRefResult = authorizeSupervisorQrisOverride({
      pin: DEFAULT_SUPERVISOR_PIN,
      referenceNumber: "  ",
    });

    expect(missingRefResult.allowed).toBe(false);
    expect(missingRefResult.error).toContain("Nomor referensi");
  });

  // Test 6: Valid supervisor PIN and reference number successfully authorizes manual QRIS
  it("successfully authorizes manual static QRIS with valid supervisor PIN and reference number", () => {
    const authResult = authorizeSupervisorQrisOverride({
      pin: DEFAULT_SUPERVISOR_PIN,
      referenceNumber: "BCA-RRN-20260914-9981",
      note: "QRIS Statis Akrilik Meja 03",
    });

    expect(authResult.allowed).toBe(true);
    expect(authResult.verification?.type).toBe("SUPERVISOR_MANUAL");
    expect(authResult.verification?.supervisorPinVerified).toBe(true);
    expect(authResult.verification?.referenceNumber).toBe("BCA-RRN-20260914-9981");

    const canConfirm = canConfirmQrisPayment({
      isGatewayVerified: false,
      supervisorOverride: {
        authorized: authResult.allowed,
        referenceNumber: authResult.verification?.referenceNumber,
      },
    });
    expect(canConfirm).toBe(true);
  });
});
