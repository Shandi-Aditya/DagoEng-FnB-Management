/**
 * QRIS Payment Verification & Supervisor Manual Override Module (POS-25 / A4)
 *
 * Ensures QRIS transactions are settled exclusively through:
 * 1. Verified payment gateway webhook callbacks (e.g. DOKU / DagoPay), OR
 * 2. Explicit supervisor PIN manual authorization with a banking RRN / reference code (for static tabletop QRIS).
 */

export const DEFAULT_SUPERVISOR_PIN = "1234";

export interface QRISVerificationDetail {
  type: "GATEWAY_WEBHOOK" | "SUPERVISOR_MANUAL";
  referenceNumber: string;
  supervisorPinVerified?: boolean;
  verifiedAt: string;
  note?: string;
}

export interface QrisVerificationResult {
  allowed: boolean;
  error?: string;
  verification?: QRISVerificationDetail;
}

/**
 * Validates supervisor PIN.
 */
export function verifySupervisorPin(
  pin: string,
  configuredPin = DEFAULT_SUPERVISOR_PIN
): boolean {
  if (!pin) return false;
  return pin.trim() === configuredPin.trim();
}

/**
 * Authorizes a manual QRIS payment using supervisor PIN and reference number (RRN).
 */
export function authorizeSupervisorQrisOverride(params: {
  pin: string;
  referenceNumber: string;
  note?: string;
  configuredPin?: string;
}): QrisVerificationResult {
  if (!verifySupervisorPin(params.pin, params.configuredPin)) {
    return {
      allowed: false,
      error: "PIN Supervisor tidak valid. Otorisasi pembayaran QRIS manual ditolak.",
    };
  }

  const cleanRef = (params.referenceNumber || "").trim();
  if (cleanRef.length < 4) {
    return {
      allowed: false,
      error: "Nomor referensi / RRN struk bank wajib diisi minimal 4 karakter.",
    };
  }

  return {
    allowed: true,
    verification: {
      type: "SUPERVISOR_MANUAL",
      referenceNumber: cleanRef,
      supervisorPinVerified: true,
      verifiedAt: new Date().toISOString(),
      note: params.note || "Otorisasi Manual QRIS Statis oleh Supervisor",
    },
  };
}

/**
 * Verifies gateway webhook payload for QRIS settlement.
 */
export function verifyGatewayWebhook(payload: {
  transactionStatus: string;
  invoiceNumber: string;
  amount: number;
  expectedAmount: number;
}): QrisVerificationResult {
  if (payload.transactionStatus !== "SUCCESS") {
    return {
      allowed: false,
      error: `Gateway status is ${payload.transactionStatus}, expected SUCCESS.`,
    };
  }

  if (Math.round(payload.amount) !== Math.round(payload.expectedAmount)) {
    return {
      allowed: false,
      error: `Ketidakcocokan nominal pembayaran QRIS: Diterima ${payload.amount}, Tagihan ${payload.expectedAmount}.`,
    };
  }

  return {
    allowed: true,
    verification: {
      type: "GATEWAY_WEBHOOK",
      referenceNumber: payload.invoiceNumber,
      verifiedAt: new Date().toISOString(),
      note: "Auto-verified via DagoPay / DOKU QRIS Webhook",
    },
  };
}

/**
 * Evaluates whether QRIS payment confirmation button should be unlocked.
 * Strictly prevents standard cashier from completing unverified QRIS.
 */
export function canConfirmQrisPayment(params: {
  isGatewayVerified: boolean;
  supervisorOverride?: {
    authorized: boolean;
    referenceNumber?: string;
  };
}): boolean {
  if (params.isGatewayVerified) return true;
  if (params.supervisorOverride?.authorized && Boolean(params.supervisorOverride.referenceNumber)) {
    return true;
  }
  return false;
}
