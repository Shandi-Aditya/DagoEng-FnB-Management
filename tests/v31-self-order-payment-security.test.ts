import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST as ordersPost } from "@/app/api/orders/route";
import { POST as selfOrderPost } from "@/app/api/orders/self-order/route";
import { POST as coworkingBookingsPost } from "@/app/api/coworking/bookings/route";
import {
  GET as qrisVerifyGet,
  POST as qrisVerifyPost,
} from "@/app/api/pos/qris/verify/route";
import { POST as syncPost } from "@/app/api/sync/[domain]/route";
import { INITIAL_PRODUCTS } from "@/lib/master-data-defaults";
import {
  getCoworkingBookings,
  getPersistentOrders,
  getPersistentQrisSession,
  saveCoworkingBooking,
  savePersistentOrder,
  writePersistentData,
} from "@/lib/persistent-storage";
import {
  resetSupervisorPinRateLimitForTests,
  signQrisWebhookPayload,
} from "@/lib/qris-verification";
import { DEFAULT_PLATFORM_SETTINGS } from "@/types/settings";

const CUSTOMER_COOKIE = "dagoeng_active_persona=CUSTOMER_DEMO";
const CASHIER_COOKIE = "dagoeng_active_persona=CASHIER_SGR";

function makeSyncPost(domain: string, body: unknown, cookie?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return [
    new NextRequest(`http://localhost:3000/api/sync/${domain}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ domain }) },
  ] as const;
}

describe("Task V-31: Self-Order & Coworking Payment Security Boundaries", () => {
  let tempDir = "";
  let prevDataDirOverride: string | undefined;
  let prevDisableDemoLogin: string | undefined;
  let prevWebhookSecret: string | undefined;
  let prevSupervisorPin: string | undefined;

  beforeEach(() => {
    prevDataDirOverride = process.env.DATA_DIR_OVERRIDE;
    prevDisableDemoLogin = process.env.DISABLE_DEMO_LOGIN;
    prevWebhookSecret = process.env.QRIS_WEBHOOK_SECRET;
    prevSupervisorPin = process.env.SUPERVISOR_OVERRIDE_PIN;

    delete process.env.DISABLE_DEMO_LOGIN;
    process.env.QRIS_WEBHOOK_SECRET = "test-webhook-secret-v31-secure";
    process.env.SUPERVISOR_OVERRIDE_PIN = "2580";
    resetSupervisorPinRateLimitForTests();

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "v31-sec-"));
    process.env.DATA_DIR_OVERRIDE = tempDir;
  });

  afterEach(() => {
    if (prevDataDirOverride === undefined) delete process.env.DATA_DIR_OVERRIDE;
    else process.env.DATA_DIR_OVERRIDE = prevDataDirOverride;

    if (prevDisableDemoLogin === undefined) delete process.env.DISABLE_DEMO_LOGIN;
    else process.env.DISABLE_DEMO_LOGIN = prevDisableDemoLogin;

    if (prevWebhookSecret === undefined) delete process.env.QRIS_WEBHOOK_SECRET;
    else process.env.QRIS_WEBHOOK_SECRET = prevWebhookSecret;

    if (prevSupervisorPin === undefined) delete process.env.SUPERVISOR_OVERRIDE_PIN;
    else process.env.SUPERVISOR_OVERRIDE_PIN = prevSupervisorPin;

    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("1. Direct /api/orders boundary for unauth & CUSTOMER", () => {
    it("rejects unauthenticated (401) and CUSTOMER (403) attempts to POST PAID orders to /api/orders", async () => {
      const targetProd = INITIAL_PRODUCTS[0];
      const payload = {
        order: {
          id: "ord-direct-paid-1",
          orderNumber: "ORD-DIR-1",
          outletId: "outlet-sgr",
          subtotal: targetProd.basePrice,
          tax: 0,
          serviceCharge: 0,
          total: targetProd.basePrice,
          paymentStatus: "PAID",
          paymentMethod: "QRIS",
          items: [
            {
              productId: targetProd.id,
              productName: targetProd.name,
              quantity: 1,
              unitPrice: targetProd.basePrice,
            },
          ],
        },
      };

      const unauthRes = await ordersPost(
        new NextRequest("http://localhost:3000/api/orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
      expect(unauthRes.status).toBe(401);

      const customerRes = await ordersPost(
        new NextRequest("http://localhost:3000/api/orders", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: CUSTOMER_COOKIE },
          body: JSON.stringify(payload),
        })
      );
      expect(customerRes.status).toBe(403);
    });
  });

  describe("2. /api/orders/self-order payment & mutation hardening", () => {
    const prod = INITIAL_PRODUCTS[0];

    it("rejects PAID paymentStatus, qrisVerification, advanced status with 403 and unknown product with 400", async () => {
      const baseOrder = {
        id: "ord-so-guard-1",
        orderNumber: "SO-GUARD-1",
        tableNumber: "T-01",
        customerName: "Tamu Uji",
        paymentMethod: "QRIS",
        items: [
          {
            id: "it-1",
            productId: prod.id,
            productName: prod.name,
            quantity: 1,
            unitPrice: prod.basePrice,
          },
        ],
      };

      const paidRes = await selfOrderPost(
        new NextRequest("http://localhost:3000/api/orders/self-order", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ order: { ...baseOrder, paymentStatus: "PAID" } }),
        })
      );
      expect(paidRes.status).toBe(403);

      const qrisProofRes = await selfOrderPost(
        new NextRequest("http://localhost:3000/api/orders/self-order", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            order: {
              ...baseOrder,
              id: "ord-so-guard-2",
              qrisVerification: {
                type: "GATEWAY_WEBHOOK",
                referenceNumber: "FORGED-REF",
                invoiceNumber: "SO-GUARD-2",
                verifiedAt: new Date().toISOString(),
              },
            },
          }),
        })
      );
      expect(qrisProofRes.status).toBe(403);

      const statusRes = await selfOrderPost(
        new NextRequest("http://localhost:3000/api/orders/self-order", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            order: { ...baseOrder, id: "ord-so-guard-3", status: "CONFIRMED" },
          }),
        })
      );
      expect(statusRes.status).toBe(403);

      const badProductRes = await selfOrderPost(
        new NextRequest("http://localhost:3000/api/orders/self-order", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            order: {
              ...baseOrder,
              id: "ord-so-guard-4",
              items: [
                {
                  id: "it-fake",
                  productId: "prod-does-not-exist",
                  productName: "Menu Palsu",
                  quantity: 1,
                  unitPrice: 1,
                },
              ],
            },
          }),
        })
      );
      expect(badProductRes.status).toBe(400);
    });

    it("enforces qrSelfOrderQrisOnly (403 for CASH/CASH_COUNTER by default; allows CASH as PENDING when disabled)", async () => {
      for (const method of ["CASH", "CASH_COUNTER"]) {
        const res = await selfOrderPost(
          new NextRequest("http://localhost:3000/api/orders/self-order", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              order: {
                id: `ord-so-nonqris-${method}`,
                orderNumber: `SO-NQ-${method}`,
                tableNumber: "T-02",
                customerName: "Tamu Cash",
                paymentMethod: method,
                items: [
                  {
                    id: "it-1",
                    productId: prod.id,
                    productName: prod.name,
                    quantity: 1,
                    unitPrice: prod.basePrice,
                  },
                ],
              },
            }),
          })
        );
        expect(res.status).toBe(403);
      }

      await writePersistentData("platform_settings.json", {
        ...DEFAULT_PLATFORM_SETTINGS,
        qrSelfOrderQrisOnly: false,
      });

      const cashAllowedRes = await selfOrderPost(
        new NextRequest("http://localhost:3000/api/orders/self-order", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            order: {
              id: "ord-so-cash-allowed",
              orderNumber: "SO-CASH-OK",
              tableNumber: "T-02",
              customerName: "Tamu Cash",
              paymentMethod: "CASH",
              items: [
                {
                  id: "it-1",
                  productId: prod.id,
                  productName: prod.name,
                  quantity: 1,
                  unitPrice: prod.basePrice,
                },
              ],
            },
          }),
        })
      );
      expect(cashAllowedRes.status).toBe(200);
      const cashJson = await cashAllowedRes.json();
      expect(cashJson.order.paymentMethod).toBe("CASH");
      expect(cashJson.order.paymentStatus).toBe("PENDING");
      expect(cashJson.order.status).toBe("NEW");
    });

    it("blocks modifying existing PENDING/PAID orders (403) while allowing customer PENDING -> CANCELLED with intact pricing", async () => {
      const createRes = await selfOrderPost(
        new NextRequest("http://localhost:3000/api/orders/self-order", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            order: {
              id: "ord-so-existing-1",
              orderNumber: "SO-EXIST-1",
              tableNumber: "T-03",
              customerName: "Tamu Exist",
              paymentMethod: "QRIS",
              items: [
                {
                  id: "it-1",
                  productId: prod.id,
                  productName: prod.name,
                  quantity: 2,
                  unitPrice: prod.basePrice,
                },
              ],
            },
          }),
        })
      );
      expect(createRes.status).toBe(200);
      const created = (await createRes.json()).order;

      const qrisSession = await getPersistentQrisSession(created.orderNumber);
      expect(qrisSession).not.toBeNull();
      expect(qrisSession?.status).toBe("PENDING");
      expect(qrisSession?.expectedAmount).toBe(created.total);

      // Attempt to overwrite existing PENDING order items
      const overwriteRes = await selfOrderPost(
        new NextRequest("http://localhost:3000/api/orders/self-order", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            order: {
              id: "ord-so-existing-1",
              orderNumber: "SO-EXIST-1",
              tableNumber: "T-03",
              customerName: "Tamu Exist",
              paymentMethod: "QRIS",
              items: [
                {
                  id: "it-1",
                  productId: prod.id,
                  productName: prod.name,
                  quantity: 1,
                  unitPrice: prod.basePrice,
                },
              ],
            },
          }),
        })
      );
      expect(overwriteRes.status).toBe(403);

      // Customer cancels PENDING order; original items/total/paymentStatus must stay intact
      const cancelRes = await selfOrderPost(
        new NextRequest("http://localhost:3000/api/orders/self-order", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            order: {
              id: "ord-so-existing-1",
              status: "CANCELLED",
              items: [
                {
                  id: "it-tamper",
                  productId: prod.id,
                  productName: prod.name,
                  quantity: 1,
                  unitPrice: 1,
                },
              ],
            },
          }),
        })
      );
      expect(cancelRes.status).toBe(200);
      const cancelled = (await cancelRes.json()).order;
      expect(cancelled.status).toBe("CANCELLED");
      expect(cancelled.paymentStatus).toBe("PENDING");
      expect(cancelled.total).toBe(created.total);
      expect(cancelled.items[0].quantity).toBe(2);

      // Re-sending PAID on an already PAID order must return 403 (not 200)
      await savePersistentOrder({
        ...created,
        id: "ord-so-paid-1",
        orderNumber: "SO-PAID-1",
        paymentStatus: "PAID",
        status: "CONFIRMED",
      });
      const replayPaidRes = await selfOrderPost(
        new NextRequest("http://localhost:3000/api/orders/self-order", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            order: {
              id: "ord-so-paid-1",
              paymentStatus: "PAID",
              items: created.items,
            },
          }),
        })
      );
      expect(replayPaidRes.status).toBe(403);
    });
  });

  describe("3. /api/coworking/bookings customer vs staff QRIS boundaries", () => {
    it("blocks CUSTOMER self-paid / checked-in / CASH / mutation payloads with 403 and allows PENDING QRIS creation & cancellation", async () => {
      const baseBooking = {
        id: "cwb-v31-1",
        bookingCode: "CW-V31-1",
        guestName: "Customer Uji",
        spaceId: "sp-hot-1",
        spaceName: "Hot Desk Flex #01 - #08",
        spaceType: "HOT_DESK",
        bookingType: "HOURLY",
        date: "2026-11-20",
        startTime: "10:00",
        endTime: "12:00",
        duration: 2,
        totalAmount: 1, // tampered amount
      };

      for (const badPatch of [
        { paymentStatus: "PAID" },
        { paidAmount: 30000 },
        { checkInStatus: "CHECKED_IN" },
        { paymentMethod: "CASH" },
        {
          qrisVerification: {
            type: "GATEWAY_WEBHOOK",
            referenceNumber: "FAKE",
            verifiedAt: new Date().toISOString(),
          },
        },
      ]) {
        const res = await coworkingBookingsPost(
          new NextRequest("http://localhost:3000/api/coworking/bookings", {
            method: "POST",
            headers: { "content-type": "application/json", cookie: CUSTOMER_COOKIE },
            body: JSON.stringify({ booking: { ...baseBooking, ...badPatch } }),
          })
        );
        expect(res.status).toBe(403);
      }

      // Valid customer creation forces PENDING + authoritative total (15000 * 2 = 30000)
      const createRes = await coworkingBookingsPost(
        new NextRequest("http://localhost:3000/api/coworking/bookings", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: CUSTOMER_COOKIE },
          body: JSON.stringify({ booking: { ...baseBooking, paymentMethod: "QRIS" } }),
        })
      );
      expect(createRes.status).toBe(200);
      const created = (await createRes.json()).booking;
      expect(created.totalAmount).toBe(30000);
      expect(created.paymentStatus).toBe("PENDING");
      expect(created.paidAmount).toBe(0);
      expect(created.remainingAmount).toBe(30000);
      expect(created.checkInStatus).toBe("RESERVED");

      const cwSession = await getPersistentQrisSession("CW-V31-1");
      expect(cwSession).not.toBeNull();
      expect(cwSession?.status).toBe("PENDING");
      expect(cwSession?.expectedAmount).toBe(30000);

      // Customer cannot mutate PENDING booking fields (only CANCELLED is permitted)
      const mutateRes = await coworkingBookingsPost(
        new NextRequest("http://localhost:3000/api/coworking/bookings", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: CUSTOMER_COOKIE },
          body: JSON.stringify({
            booking: { ...created, guestName: "Nama Diubah" },
          }),
        })
      );
      expect(mutateRes.status).toBe(403);

      // Customer can cancel own PENDING booking
      const cancelRes = await coworkingBookingsPost(
        new NextRequest("http://localhost:3000/api/coworking/bookings", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: CUSTOMER_COOKIE },
          body: JSON.stringify({
            booking: { ...created, checkInStatus: "CANCELLED", totalAmount: 1 },
          }),
        })
      );
      expect(cancelRes.status).toBe(200);
      const cancelled = (await cancelRes.json()).booking;
      expect(cancelled.checkInStatus).toBe("CANCELLED");
      expect(cancelled.totalAmount).toBe(30000);
      expect(cancelled.paymentStatus).toBe("PENDING");

      // Customer cannot modify an already PAID booking
      await saveCoworkingBooking({
        ...created,
        id: "cwb-v31-paid",
        bookingCode: "CW-V31-PAID",
        paymentStatus: "PAID",
        paidAmount: 30000,
        remainingAmount: 0,
      });
      const modifyPaidRes = await coworkingBookingsPost(
        new NextRequest("http://localhost:3000/api/coworking/bookings", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: CUSTOMER_COOKIE },
          body: JSON.stringify({
            booking: {
              id: "cwb-v31-paid",
              bookingCode: "CW-V31-PAID",
              spaceId: "sp-hot-1",
              guestName: "Customer Uji",
              checkInStatus: "CANCELLED",
            },
          }),
        })
      );
      expect(modifyPaidRes.status).toBe(403);
    });

    it("rejects unverified staff QRIS PAID coworking booking with 409, and accepts after SUPERVISOR_OVERRIDE", async () => {
      const bookingPayload = {
        id: "cwb-staff-qris-1",
        bookingCode: "CW-STAFF-1",
        guestName: "Tamu Kasir",
        spaceId: "sp-hot-1",
        spaceName: "Hot Desk Flex #01 - #08",
        spaceType: "HOT_DESK",
        bookingType: "HOURLY",
        date: "2026-11-20",
        startTime: "10:00",
        endTime: "12:00",
        duration: 2,
        totalAmount: 30000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "RESERVED",
      };

      const unverifiedRes = await coworkingBookingsPost(
        new NextRequest("http://localhost:3000/api/coworking/bookings", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: CASHIER_COOKIE },
          body: JSON.stringify({ booking: bookingPayload }),
        })
      );
      expect(unverifiedRes.status).toBe(409);

      const initRes = await qrisVerifyPost(
        new NextRequest("http://localhost:3000/api/pos/qris/verify", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: CASHIER_COOKIE },
          body: JSON.stringify({
            mode: "INIT",
            invoiceNumber: "CW-STAFF-1",
            orderId: "cwb-staff-qris-1",
            expectedAmount: 30000,
          }),
        })
      );
      expect(initRes.status).toBe(200);

      const supRes = await qrisVerifyPost(
        new NextRequest("http://localhost:3000/api/pos/qris/verify", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: CASHIER_COOKIE },
          body: JSON.stringify({
            mode: "SUPERVISOR_OVERRIDE",
            invoiceNumber: "CW-STAFF-1",
            pin: "2580",
            referenceNumber: "RRN-CW-V31",
          }),
        })
      );
      expect(supRes.status).toBe(200);
      const supJson = await supRes.json();
      expect(supJson.verification.invoiceNumber).toBe("CW-STAFF-1");

      const verifiedRes = await coworkingBookingsPost(
        new NextRequest("http://localhost:3000/api/coworking/bookings", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: CASHIER_COOKIE },
          body: JSON.stringify({
            booking: { ...bookingPayload, qrisVerification: supJson.verification },
          }),
        })
      );
      expect(verifiedRes.status).toBe(200);
    });
  });

  describe("4. QRIS verify GET RBAC & HMAC webhook auto-settlement", () => {
    it("forbids CUSTOMER on GET /api/pos/qris/verify (403) and rejects unsigned/bad-sig webhooks (401)", async () => {
      const custGetRes = await qrisVerifyGet(
        new NextRequest("http://localhost:3000/api/pos/qris/verify?invoiceNumber=INV-1", {
          headers: { cookie: CUSTOMER_COOKIE },
        })
      );
      expect(custGetRes.status).toBe(403);

      const cashierGetRes = await qrisVerifyGet(
        new NextRequest("http://localhost:3000/api/pos/qris/verify?invoiceNumber=INV-1", {
          headers: { cookie: CASHIER_COOKIE },
        })
      );
      expect(cashierGetRes.status).toBe(200);

      const badWebhookRes = await qrisVerifyPost(
        new NextRequest("http://localhost:3000/api/pos/qris/verify", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-dago-signature": "bad-sig",
          },
          body: JSON.stringify({
            mode: "WEBHOOK",
            invoiceNumber: "INV-1",
            amount: 50000,
            transactionStatus: "SUCCESS",
          }),
        })
      );
      expect([401, 404]).toContain(badWebhookRes.status);
    });

    it("settles matching PENDING F&B self-order and PENDING coworking booking via HMAC-signed webhook and rejects bad signature with 401", async () => {
      const prod = INITIAL_PRODUCTS[0];

      // 1. Create F&B self-order
      const orderRes = await selfOrderPost(
        new NextRequest("http://localhost:3000/api/orders/self-order", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            order: {
              id: "ord-so-wh-1",
              orderNumber: "SO-WH-1",
              tableNumber: "T-04",
              customerName: "Tamu Webhook",
              paymentMethod: "QRIS",
              items: [
                {
                  id: "it-1",
                  productId: prod.id,
                  productName: prod.name,
                  quantity: 1,
                  unitPrice: prod.basePrice,
                },
              ],
            },
          }),
        })
      );
      expect(orderRes.status).toBe(200);
      const createdOrder = (await orderRes.json()).order;

      // Bad signature on existing session -> 401
      const badSigRes = await qrisVerifyPost(
        new NextRequest("http://localhost:3000/api/pos/qris/verify", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-dago-signature": "forged-hmac",
          },
          body: JSON.stringify({
            mode: "WEBHOOK",
            invoiceNumber: "SO-WH-1",
            amount: createdOrder.total,
            transactionStatus: "SUCCESS",
          }),
        })
      );
      expect(badSigRes.status).toBe(401);

      // Valid HMAC webhook -> settles F&B self-order
      const orderSig = signQrisWebhookPayload({
        invoiceNumber: "SO-WH-1",
        amount: createdOrder.total,
        transactionStatus: "SUCCESS",
      });
      const whOrderRes = await qrisVerifyPost(
        new NextRequest("http://localhost:3000/api/pos/qris/verify", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-dago-signature": orderSig,
          },
          body: JSON.stringify({
            mode: "WEBHOOK",
            invoiceNumber: "SO-WH-1",
            amount: createdOrder.total,
            transactionStatus: "SUCCESS",
          }),
        })
      );
      expect(whOrderRes.status).toBe(200);
      const whOrderJson = await whOrderRes.json();
      expect(whOrderJson.session.consumedByOrderId).toBe("ord-so-wh-1");

      const updatedOrder = (await getPersistentOrders()).find((o) => o.id === "ord-so-wh-1");
      expect(updatedOrder?.paymentStatus).toBe("PAID");
      expect(updatedOrder?.status).toBe("CONFIRMED");

      // 2. Create Coworking booking
      const cwRes = await coworkingBookingsPost(
        new NextRequest("http://localhost:3000/api/coworking/bookings", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: CUSTOMER_COOKIE },
          body: JSON.stringify({
            booking: {
              id: "cwb-wh-1",
              bookingCode: "CW-WH-1",
              guestName: "Tamu CW Webhook",
              spaceId: "sp-hot-1",
              spaceName: "Hot Desk Flex #01 - #08",
              spaceType: "HOT_DESK",
              bookingType: "HOURLY",
              date: "2026-11-20",
              startTime: "10:00",
              endTime: "12:00",
              duration: 2,
              paymentMethod: "QRIS",
            },
          }),
        })
      );
      expect(cwRes.status).toBe(200);
      const createdBooking = (await cwRes.json()).booking;

      const cwSig = signQrisWebhookPayload({
        invoiceNumber: "CW-WH-1",
        amount: createdBooking.totalAmount,
        transactionStatus: "SUCCESS",
      });
      const whCwRes = await qrisVerifyPost(
        new NextRequest("http://localhost:3000/api/pos/qris/verify", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-dago-signature": cwSig,
          },
          body: JSON.stringify({
            mode: "WEBHOOK",
            invoiceNumber: "CW-WH-1",
            amount: createdBooking.totalAmount,
            transactionStatus: "SUCCESS",
          }),
        })
      );
      expect(whCwRes.status).toBe(200);
      const whCwJson = await whCwRes.json();
      expect(whCwJson.session.consumedByOrderId).toBe("cwb-wh-1");

      const updatedBooking = (await getCoworkingBookings()).find((b) => b.id === "cwb-wh-1");
      expect(updatedBooking?.paymentStatus).toBe("PAID");
      expect(updatedBooking?.paidAmount).toBe(createdBooking.totalAmount);
      expect(updatedBooking?.remainingAmount).toBe(0);
    });
  });

  describe("5. /api/sync/tables and /api/sync/coworking-master guards", () => {
    it("rejects unauth & CUSTOMER setting paymentStatus PAID on /api/sync/tables with 403", async () => {
      const unauthPaid = await syncPost(
        ...makeSyncPost("tables", {
          command: {
            op: "PATCH_TABLE_STATUS",
            tableId: "T-01",
            status: "OCCUPIED",
            paymentStatus: "PAID",
          },
        })
      );
      expect(unauthPaid.status).toBe(403);

      const custPaid = await syncPost(
        ...makeSyncPost(
          "tables",
          {
            command: {
              op: "PATCH_TABLE_STATUS",
              tableId: "T-01",
              status: "OCCUPIED",
              paymentStatus: "PAID",
            },
          },
          CUSTOMER_COOKIE
        )
      );
      expect(custPaid.status).toBe(403);

      const custOccupied = await syncPost(
        ...makeSyncPost(
          "tables",
          {
            command: {
              op: "PATCH_TABLE_STATUS",
              tableId: "T-01",
              status: "OCCUPIED",
              paymentStatus: "UNPAID",
            },
          },
          CUSTOMER_COOKIE
        )
      );
      expect(custOccupied.status).toBe(200);
    });

    it("rejects CUSTOMER setting OCCUPIED or checkLog on /api/sync/coworking-master with 403", async () => {
      const custOccupied = await syncPost(
        ...makeSyncPost(
          "coworking-master",
          {
            command: {
              op: "PATCH_SPACE_SESSION",
              spaceId: "sp-hot-1",
              status: "OCCUPIED",
            },
          },
          CUSTOMER_COOKIE
        )
      );
      expect(custOccupied.status).toBe(403);

      const custCheckLog = await syncPost(
        ...makeSyncPost(
          "coworking-master",
          {
            command: {
              op: "PATCH_SPACE_SESSION",
              spaceId: "sp-hot-1",
              status: "RESERVED",
              checkLog: {
                id: "log-forged-1",
                bookingCode: "CW-1",
                guestName: "Forged",
                spaceId: "sp-hot-1",
                spaceName: "Hot Desk",
                checkinDate: "2026-11-20",
                checkinTime: "10:00",
                checkinBy: "Customer",
                status: "ACTIVE_IN",
              },
            },
          },
          CUSTOMER_COOKIE
        )
      );
      expect(custCheckLog.status).toBe(403);

      const custReserved = await syncPost(
        ...makeSyncPost(
          "coworking-master",
          {
            command: {
              op: "PATCH_SPACE_SESSION",
              spaceId: "sp-hot-1",
              status: "RESERVED",
            },
          },
          CUSTOMER_COOKIE
        )
      );
      expect(custReserved.status).toBe(200);
    });
  });
});
