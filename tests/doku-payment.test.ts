import { describe, it, expect, beforeEach } from "vitest";
import {
  generateDokuDigest,
  generateDokuSignature,
  verifyDokuNotificationSignature,
  createDokuCheckoutSession,
  getDokuConfig,
} from "@/lib/doku";
import { POST as handleDokuWebhook } from "@/app/api/webhooks/doku/route";
import { POST as handleBookEvent } from "@/app/api/events/[id]/book/route";
import {
  loadBookingsFromDisk,
  saveBookingsToDisk,
  createEventSubmission,
  updateEventStatus,
} from "@/lib/events";
import { EventTicketOrder, CommunityEvent } from "@/types/event";
import { NextRequest } from "next/server";

describe("DOKU Payment Gateway Integration & Production Readiness", () => {
  const mockSecretKey = "SK-DAGOENG-TEST-SECRET-KEY-12345";
  const mockClientId = "MCH-DAGOENG-TEST-001";

  beforeEach(() => {
    process.env.DOKU_CLIENT_ID = mockClientId;
    process.env.DOKU_SECRET_KEY = mockSecretKey;
    process.env.DOKU_API_URL = "https://api-sandbox.doku.com";
    process.env.DOKU_SIMULATION_MODE = "true";
  });

  describe("1. DOKU Cryptographic Signature & Digest", () => {
    it("menghasilkan Base64 SHA-256 Digest yang valid untuk request body", () => {
      const payload = {
        order: { amount: 50000, invoice_number: "INV-TEST-001" },
      };
      const digest = generateDokuDigest(payload);

      expect(digest).toBeDefined();
      expect(typeof digest).toBe("string");
      expect(digest.length).toBeGreaterThan(10);
      // Digest harus konsisten untuk body yang sama
      expect(generateDokuDigest(payload)).toBe(digest);
    });

    it("menghasilkan Signature HMAC-SHA256 sesuai spesifikasi resmi DOKU", () => {
      const requestId = "req-12345-abcde";
      const requestTimestamp = "2026-10-26T10:00:00Z";
      const requestTarget = "/checkout/v1/payment";
      const payload = { order: { amount: 75000, invoice_number: "INV-TEST-002" } };

      const signature = generateDokuSignature({
        clientId: mockClientId,
        requestId,
        requestTimestamp,
        requestTarget,
        body: payload,
        secretKey: mockSecretKey,
      });

      expect(signature).toBeDefined();
      expect(signature.startsWith("HMACSHA256=")).toBe(true);
      expect(signature.length).toBeGreaterThan(20);
    });

    it("memverifikasi signature webhook secara akurat dan menolak signature yang dipalsukan", () => {
      const requestId = "req-webhook-999";
      const requestTimestamp = "2026-10-26T10:05:00Z";
      const requestTarget = "/api/webhooks/doku";
      const rawBody = JSON.stringify({
        order: { invoice_number: "INV-DAGO-EVT-12345", amount: 100000 },
        transaction: { status: "SUCCESS" },
      });

      const validSignature = generateDokuSignature({
        clientId: mockClientId,
        requestId,
        requestTimestamp,
        requestTarget,
        body: rawBody,
        secretKey: mockSecretKey,
      });

      // 1. Valid Signature
      const isValid = verifyDokuNotificationSignature({
        clientId: mockClientId,
        requestId,
        requestTimestamp,
        requestTarget,
        rawBody,
        receivedSignature: validSignature,
        secretKey: mockSecretKey,
      });
      expect(isValid).toBe(true);

      // 2. Tampered Body
      const tamperedBody = JSON.stringify({
        order: { invoice_number: "INV-DAGO-EVT-12345", amount: 1000 }, // Manipulasi nominal
        transaction: { status: "SUCCESS" },
      });
      const isTamperedValid = verifyDokuNotificationSignature({
        clientId: mockClientId,
        requestId,
        requestTimestamp,
        requestTarget,
        rawBody: tamperedBody,
        receivedSignature: validSignature,
        secretKey: mockSecretKey,
      });
      expect(isTamperedValid).toBe(false);

      // 3. Wrong Secret Key
      const isWrongKeyValid = verifyDokuNotificationSignature({
        clientId: mockClientId,
        requestId,
        requestTimestamp,
        requestTarget,
        rawBody,
        receivedSignature: validSignature,
        secretKey: "SK-WRONG-SECRET-KEY",
      });
      expect(isWrongKeyValid).toBe(false);
    });
  });

  describe("2. DOKU Checkout Session Creation", () => {
    it("menginisiasi checkout session dengan invoice unik dan URL pembayaran valid", async () => {
      const mockOrder: EventTicketOrder = {
        id: `tkt-${Date.now()}-mock`,
        ticketCode: `DAGO-EVT-${Math.floor(10000 + Math.random() * 90000)}`,
        eventId: "evt-design-sprint",
        eventTitle: "Design Sprint Workshop 2026",
        eventDate: "2026-11-15T09:00:00Z",
        eventLocation: "Creative Hall Lt. 2",
        guestName: "Budi Santoso",
        guestEmail: "budi.santoso@example.com",
        guestPhone: "081234567890",
        ticketCount: 2,
        unitPrice: 50000,
        totalPrice: 100000,
        platformFeePercent: 20,
        platformFeeAmount: 20000,
        organizerRevenueAmount: 80000,
        paymentMethod: "DOKU_CHECKOUT",
        paymentStatus: "PENDING",
        checkInStatus: "REGISTERED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const session = await createDokuCheckoutSession(mockOrder);

      expect(session).toBeDefined();
      expect(session.paymentUrl).toContain("checkout-link-v2");
      expect(session.invoiceNumber).toBe(`INV-${mockOrder.ticketCode}`);
      expect(session.sessionId).toBeDefined();
    });
  });

  describe("3. Webhook Receiver (/api/webhooks/doku)", () => {
    let testBooking: EventTicketOrder;

    beforeEach(() => {
      const allBookings = loadBookingsFromDisk();
      const ticketCode = `DAGO-EVT-${Math.floor(10000 + Math.random() * 90000)}`;
      testBooking = {
        id: `tkt-${Date.now()}-test-wh`,
        ticketCode,
        eventId: "evt-wh-test",
        eventTitle: "DOKU Webhook Automated Test Event",
        eventDate: "2026-11-20T10:00:00Z",
        eventLocation: "Dago Hall",
        guestName: "Ahmad Rizky",
        guestEmail: "ahmad.rizky@example.com",
        guestPhone: "081987654321",
        ticketCount: 1,
        unitPrice: 150000,
        totalPrice: 150000,
        platformFeePercent: 20,
        platformFeeAmount: 30000,
        organizerRevenueAmount: 120000,
        paymentMethod: "DOKU_CHECKOUT",
        paymentStatus: "PENDING",
        checkInStatus: "REGISTERED",
        dokuInvoiceNumber: `INV-${ticketCode}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      allBookings.unshift(testBooking);
      saveBookingsToDisk(allBookings);
    });

    it("menolak request webhook dengan signature tidak valid (HTTP 401)", async () => {
      const payload = {
        order: { invoice_number: testBooking.dokuInvoiceNumber, amount: 150000 },
        transaction: { status: "SUCCESS" },
      };
      const req = new NextRequest("http://localhost:3000/api/webhooks/doku", {
        method: "POST",
        headers: {
          "client-id": mockClientId,
          "request-id": "req-invalid-sig",
          "request-timestamp": new Date().toISOString(),
          signature: "HMACSHA256=INVALID_SIGNATURE_VALUE_HERE",
        },
        body: JSON.stringify(payload),
      });

      const res = await handleDokuWebhook(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Invalid DOKU signature");
    });

    it("menolak request webhook dengan ketidakcocokan nominal (HTTP 400)", async () => {
      const requestId = "req-amount-mismatch";
      const requestTimestamp = new Date().toISOString();
      const requestTarget = "/api/webhooks/doku";
      const payload = {
        order: { invoice_number: testBooking.dokuInvoiceNumber, amount: 50000 }, // Seharusnya 150000
        transaction: { status: "SUCCESS" },
      };
      const rawBody = JSON.stringify(payload);
      const validSignature = generateDokuSignature({
        clientId: mockClientId,
        requestId,
        requestTimestamp,
        requestTarget,
        body: rawBody,
        secretKey: mockSecretKey,
      });

      const req = new NextRequest("http://localhost:3000/api/webhooks/doku", {
        method: "POST",
        headers: {
          "client-id": mockClientId,
          "request-id": requestId,
          "request-timestamp": requestTimestamp,
          signature: validSignature,
        },
        body: rawBody,
      });

      const res = await handleDokuWebhook(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Amount mismatch");
    });

    it("memverifikasi transaksi sukses, mengubah status pembayaran menjadi PAID, dan mencatat paidAt", async () => {
      const requestId = "req-success-payment";
      const requestTimestamp = new Date().toISOString();
      const requestTarget = "/api/webhooks/doku";
      const payload = {
        order: { invoice_number: testBooking.dokuInvoiceNumber, amount: 150000 },
        transaction: { status: "SUCCESS" },
      };
      const rawBody = JSON.stringify(payload);
      const validSignature = generateDokuSignature({
        clientId: mockClientId,
        requestId,
        requestTimestamp,
        requestTarget,
        body: rawBody,
        secretKey: mockSecretKey,
      });

      const req = new NextRequest("http://localhost:3000/api/webhooks/doku", {
        method: "POST",
        headers: {
          "client-id": mockClientId,
          "request-id": requestId,
          "request-timestamp": requestTimestamp,
          signature: validSignature,
        },
        body: rawBody,
      });

      const res = await handleDokuWebhook(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe("SUCCESS");

      // Verifikasi di penyimpanan disk
      const updatedBookings = loadBookingsFromDisk();
      const found = updatedBookings.find((b) => b.id === testBooking.id);
      expect(found).toBeDefined();
      expect(found?.paymentStatus).toBe("PAID");
      expect(found?.paidAt).toBeDefined();
    });

    it("menangani webhook berulang secara idempoten tanpa menerbitkan ulang", async () => {
      // Tandai booking sebagai PAID terlebih dahulu
      const allBookings = loadBookingsFromDisk();
      const idx = allBookings.findIndex((b) => b.id === testBooking.id);
      allBookings[idx] = {
        ...allBookings[idx],
        paymentStatus: "PAID",
        paidAt: new Date().toISOString(),
      };
      saveBookingsToDisk(allBookings);

      const requestId = "req-duplicate-webhook";
      const requestTimestamp = new Date().toISOString();
      const requestTarget = "/api/webhooks/doku";
      const payload = {
        order: { invoice_number: testBooking.dokuInvoiceNumber, amount: 150000 },
        transaction: { status: "SUCCESS" },
      };
      const rawBody = JSON.stringify(payload);
      const validSignature = generateDokuSignature({
        clientId: mockClientId,
        requestId,
        requestTimestamp,
        requestTarget,
        body: rawBody,
        secretKey: mockSecretKey,
      });

      const req = new NextRequest("http://localhost:3000/api/webhooks/doku", {
        method: "POST",
        headers: {
          "client-id": mockClientId,
          "request-id": requestId,
          "request-timestamp": requestTimestamp,
          signature: validSignature,
        },
        body: rawBody,
      });

      const res = await handleDokuWebhook(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("ALREADY_PROCESSED");
    });
  });

  describe("4. End-to-End Event Booking with DOKU Checkout", () => {
    let paidEvent: CommunityEvent;

    beforeEach(async () => {
      const sub = await createEventSubmission({
        organizerName: "Dago Tech Labs",
        organizerEmail: "labs@dagoeng.com",
        organizerPhone: "081234567890",
        title: `Next.js 14 Production Workshop ${Date.now()}`,
        category: "TECH",
        description: "Hands-on workshop Next.js 14 App Router and DOKU Checkout.",
        startDate: "2026-11-25T09:00:00Z",
        endDate: "2026-11-25T17:00:00Z",
        location: "Lab Komputer Dago Lt. 3",
        maxCapacity: 50,
        isPaid: true,
        price: 100000,
        posterUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97",
      });
      paidEvent = await updateEventStatus(sub.id, "APPROVED");
    });

    it("mengembalikan DOKU paymentUrl dan mencatat dokuInvoiceNumber saat pemesanan event berbayar", async () => {
      const req = new NextRequest(`http://localhost:3000/api/events/${paidEvent.id}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: "Dewi Lestari",
          guestEmail: `dewi.${Date.now()}@example.com`,
          guestPhone: "081298765432",
          ticketCount: 1,
        }),
      });

      const res = await handleBookEvent(req, { params: { id: paidEvent.id } });
      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.paymentUrl).toBeDefined();
      expect(json.data.paymentUrl).toContain("checkout-link-v2");
      expect(json.data.paymentStatus).toBe("PENDING");
      expect(json.data.dokuInvoiceNumber).toBeDefined();
      expect(json.data.dokuInvoiceNumber.startsWith("INV-DAGO-EVT-")).toBe(true);
    });
  });
});
