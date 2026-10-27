import crypto from "crypto";
import { EventTicketOrder } from "@/types/event";

export interface DokuConfig {
  clientId: string;
  secretKey: string;
  apiUrl: string;
  notificationUrl?: string;
  callbackUrl?: string;
}

/**
 * Retrieves DOKU configuration from environment variables.
 * Falls back to sandbox URL if not explicitly set.
 */
export function getDokuConfig(): DokuConfig {
  return {
    clientId: process.env.DOKU_CLIENT_ID || "MCH-DAGOENG-TEST",
    secretKey: process.env.DOKU_SECRET_KEY || "SK-DAGOENG-SECRET-2026",
    apiUrl: process.env.DOKU_API_URL || "https://api-sandbox.doku.com",
    notificationUrl: process.env.DOKU_NOTIFICATION_URL || "/api/webhooks/doku",
    callbackUrl: process.env.DOKU_CALLBACK_URL || "/customer?tab=profile",
  };
}

/**
 * Calculates SHA-256 Base64 digest of the request body.
 * As per official DOKU specification.
 */
export function generateDokuDigest(body: string | object): string {
  const jsonString = typeof body === "string" ? body : JSON.stringify(body);
  return crypto.createHash("sha256").update(jsonString, "utf8").digest("base64");
}

/**
 * Generates official DOKU request signature:
 * Format:
 * Client-Id:{clientId}\n
 * Request-Id:{requestId}\n
 * Request-Timestamp:{requestTimestamp}\n
 * Request-Target:{requestTarget}\n
 * Digest:{digest}
 *
 * Signed with HMAC-SHA256 using Secret-Key and prepended with "HMACSHA256=".
 */
export function generateDokuSignature(params: {
  clientId: string;
  requestId: string;
  requestTimestamp: string;
  requestTarget: string;
  body: string | object;
  secretKey: string;
}): string {
  const digest = generateDokuDigest(params.body);
  const componentString = [
    `Client-Id:${params.clientId}`,
    `Request-Id:${params.requestId}`,
    `Request-Timestamp:${params.requestTimestamp}`,
    `Request-Target:${params.requestTarget}`,
    `Digest:${digest}`,
  ].join("\n");

  const hmac = crypto
    .createHmac("sha256", params.secretKey)
    .update(componentString, "utf8")
    .digest("base64");

  return `HMACSHA256=${hmac}`;
}

/**
 * Verifies authenticity of an incoming DOKU HTTP notification.
 * Performs timing-safe comparison to prevent side-channel attacks.
 */
export function verifyDokuNotificationSignature(params: {
  clientId: string;
  requestId: string;
  requestTimestamp: string;
  requestTarget: string;
  rawBody: string | object;
  receivedSignature: string;
  secretKey: string;
}): boolean {
  if (!params.receivedSignature || !params.secretKey) {
    return false;
  }

  const expectedSignature = generateDokuSignature({
    clientId: params.clientId,
    requestId: params.requestId,
    requestTimestamp: params.requestTimestamp,
    requestTarget: params.requestTarget,
    body: params.rawBody,
    secretKey: params.secretKey,
  });

  const expectedBuf = Buffer.from(expectedSignature, "utf8");
  const receivedBuf = Buffer.from(params.receivedSignature, "utf8");

  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

export interface DokuCheckoutRequestPayload {
  order: {
    amount: number;
    invoice_number: string;
    currency: string;
    callback_url?: string;
    auto_redirect?: boolean;
    line_items?: Array<{
      id?: string;
      name: string;
      price: number;
      quantity: number;
      category?: string;
    }>;
  };
  payment: {
    payment_due_date: number; // in minutes
  };
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

export interface DokuCheckoutResponse {
  paymentUrl: string;
  invoiceNumber: string;
  sessionId?: string;
  tokenId?: string;
  expiredDate?: string;
}

export class DokuCheckoutError extends Error {
  public readonly isDefiniteFailure: boolean;
  public readonly statusCode?: number;

  constructor(message: string, isDefiniteFailure: boolean, statusCode?: number) {
    super(message);
    this.name = "DokuCheckoutError";
    this.isDefiniteFailure = isDefiniteFailure;
    this.statusCode = statusCode;
  }
}

/**
 * Initiates a DOKU Hosted Checkout session for an event ticket order.
 * Follows DOKU Checkout backend API standards.
 */
export async function createDokuCheckoutSession(
  booking: EventTicketOrder,
  customCallbackUrl?: string
): Promise<DokuCheckoutResponse> {
  const config = getDokuConfig();
  const requestId = crypto.randomUUID();
  const requestTimestamp = new Date().toISOString();
  const requestTarget = "/checkout/v1/payment";

  // Sanitize phone number: DOKU expects standard digits e.g. 62812...
  let phone = booking.guestPhone.replace(/[^0-9]/g, "");
  if (phone.startsWith("0")) {
    phone = "62" + phone.substring(1);
  } else if (!phone.startsWith("62")) {
    phone = "62" + phone;
  }

  // Use unique invoice number: e.g. INV-{ticketCode}-{timestamp}
  const invoiceNumber = `INV-${booking.ticketCode}`;

  const payload: DokuCheckoutRequestPayload = {
    order: {
      amount: Math.round(booking.totalPrice),
      invoice_number: invoiceNumber,
      currency: "IDR",
      callback_url: customCallbackUrl || config.callbackUrl,
      auto_redirect: true,
      line_items: [
        {
          id: booking.eventId,
          name: `Tiket: ${booking.eventTitle.substring(0, 50)}`,
          price: Math.round(booking.unitPrice),
          quantity: booking.ticketCount,
          category: "ticketing",
        },
      ],
    },
    payment: {
      payment_due_date: 60, // 60 minutes payment window
    },
    customer: {
      id: booking.guestEmail.trim().toLowerCase(),
      name: booking.guestName,
      email: booking.guestEmail.trim().toLowerCase(),
      phone: phone || "628120000000",
    },
  };

  const signature = generateDokuSignature({
    clientId: config.clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    body: payload,
    secretKey: config.secretKey,
  });

  // Check if simulated / offline mode is needed (when no production network is available)
  const isSimulationMode =
    process.env.DOKU_SIMULATION_MODE === "true" ||
    config.clientId.includes("TEST") ||
    process.env.NODE_ENV === "test";

  if (isSimulationMode) {
    // In test or simulation environment without live DOKU network
    const simulatedToken = crypto.randomBytes(16).toString("hex");
    const simulatedPaymentUrl = `/checkout-link-v2/${simulatedToken}?invoice=${encodeURIComponent(invoiceNumber)}`;
    return {
      paymentUrl: simulatedPaymentUrl,
      invoiceNumber,
      sessionId: `sess-${simulatedToken.substring(0, 12)}`,
      tokenId: simulatedToken,
      expiredDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  const endpoint = `${config.apiUrl}${requestTarget}`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": config.clientId,
        "Request-Id": requestId,
        "Request-Timestamp": requestTimestamp,
        Signature: signature,
      },
      body: JSON.stringify(payload),
    });
  } catch (netErr: any) {
    // Network level failure: connection dropped or timeout with unknown outcome
    throw new DokuCheckoutError(
      `Kendala jaringan saat menghubungi gateway pembayaran: ${netErr.message || "Timeout"}`,
      false
    );
  }

  const responseData = await response.json().catch(() => null);

  if (!response.ok || !responseData?.response?.payment?.url) {
    const errorMsg =
      responseData?.error_messages?.join(", ") ||
      responseData?.message?.join(", ") ||
      `DOKU Checkout HTTP ${response.status}`;
    // HTTP 4xx means DOKU rejected the request before transaction creation (preflight failure)
    const isDefinitePreflightFailure = response.status >= 400 && response.status < 500;
    throw new DokuCheckoutError(
      `Gagal menginisiasi pembayaran DOKU: ${errorMsg}`,
      isDefinitePreflightFailure,
      response.status
    );
  }

  return {
    paymentUrl: responseData.response.payment.url,
    invoiceNumber,
    sessionId: responseData.response.order?.session_id,
    tokenId: responseData.response.payment?.token_id,
    expiredDate: responseData.response.payment?.expired_date,
  };
}
