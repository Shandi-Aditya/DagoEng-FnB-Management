import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as ordersRoute from "@/app/api/orders/route";
import { POST as selfOrderPost } from "@/app/api/orders/self-order/route";
import { POST as qrisVerifyPost } from "@/app/api/pos/qris/verify/route";
import { filterKitchenOrders, type KitchenFilters } from "@/features/kitchen/kitchen-board";
import { INITIAL_INGREDIENTS } from "@/features/inventory/inventory-data";
import { INITIAL_PRODUCTS } from "@/lib/master-data-defaults";
import {
  getPersistentOrders,
  readPersistentDomainState,
  savePersistentOrder,
} from "@/lib/persistent-storage";
import {
  resetSupervisorPinRateLimitForTests,
  signQrisWebhookPayload,
} from "@/lib/qris-verification";
import { inventoryDomainSpec } from "@/lib/sync-domains/inventory-spec";
import type { OrderRecord, OrderStatus } from "@/types/order";

const CASHIER_COOKIE = "dagoeng_active_persona=CASHIER_SGR";
const MANAGER_COOKIE = "dagoeng_active_persona=HUB_MANAGER";
const WAITER_COOKIE = "dagoeng_active_persona=WAITER_SGR";
const KITCHEN_COOKIE = "dagoeng_active_persona=KITCHEN_SGR";

const ALL_KDS_FILTERS: KitchenFilters = {
  type: "ALL",
  station: "ALL",
  multiStation: false,
};

const KS_PRODUCT = INITIAL_PRODUCTS.find((p) => p.id === "prod-101") ?? INITIAL_PRODUCTS[0];
const KITCHEN_PRODUCT = INITIAL_PRODUCTS.find((p) => p.tenantId === "tenant-kitchen") ?? INITIAL_PRODUCTS[2];

function makeOrderPayload(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    orderNumber: "ORD-KS-20261123-0001",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tableNumber: "T-01",
    customerName: "Tamu V32",
    orderType: "DINE_IN",
    status: "CONFIRMED",
    paymentStatus: "PAID",
    paymentMethod: "CASH",
    subtotal: KS_PRODUCT.basePrice,
    tax: Math.round(KS_PRODUCT.basePrice * 0.1),
    serviceCharge: Math.round(KS_PRODUCT.basePrice * 0.05),
    total:
      KS_PRODUCT.basePrice +
      Math.round(KS_PRODUCT.basePrice * 0.1) +
      Math.round(KS_PRODUCT.basePrice * 0.05),
    createdAt: "2026-11-23T10:00:00.000Z",
    items: [
      {
        id: `it-${id}`,
        productId: KS_PRODUCT.id,
        tenantId: KS_PRODUCT.tenantId,
        productName: KS_PRODUCT.name,
        quantity: 2,
        unitPrice: KS_PRODUCT.basePrice,
      },
    ],
    ...overrides,
    ...(overrides.subtotal === undefined && overrides.items === undefined
      ? {
          subtotal: KS_PRODUCT.basePrice * 2,
          tax: Math.round(KS_PRODUCT.basePrice * 2 * 0.1),
          serviceCharge: Math.round(KS_PRODUCT.basePrice * 2 * 0.05),
          total:
            KS_PRODUCT.basePrice * 2 +
            Math.round(KS_PRODUCT.basePrice * 2 * 0.1) +
            Math.round(KS_PRODUCT.basePrice * 2 * 0.05),
        }
      : {}),
  };
}

function makeReq(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
  cookie?: string,
  headers: Record<string, string> = {}
) {
  const reqHeaders: Record<string, string> = {
    "content-type": "application/json",
    ...headers,
  };
  if (cookie) reqHeaders.cookie = cookie;
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: reqHeaders,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function callOrdersPatch(body: unknown, cookie: string) {
  const patchHandler = (
    ordersRoute as unknown as {
      PATCH?: (req: NextRequest) => Promise<Response>;
    }
  ).PATCH;
  if (typeof patchHandler !== "function") {
    throw new Error("PATCH handler is not exported from /api/orders");
  }
  return patchHandler(makeReq("/api/orders", "PATCH", body, cookie));
}

describe("V-32 Wave 2A: KDS Payment Gate, BOM Lifecycle & Canonical Order Uniqueness", () => {
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
    process.env.QRIS_WEBHOOK_SECRET = "test-webhook-secret-v32-secure";
    process.env.SUPERVISOR_OVERRIDE_PIN = "9137";
    resetSupervisorPinRateLimitForTests();

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "v32-backend-"));
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

  describe("1. KDS Payment Gate on POST/PATCH /api/orders and POST /api/orders/self-order", () => {
    const gatedStatuses: OrderStatus[] = [
      "KITCHEN_RECEIVED",
      "COOKING",
      "READY",
      "SERVED",
      "COMPLETED",
    ];

    it("rejects unpaid (PENDING) orders targeting KDS/post-KDS statuses on POST /api/orders and /api/orders/self-order with 403, while keeping WAITER CONFIRMED/PENDING at 200", async () => {
      const waiterOk = await ordersRoute.POST(
        makeReq(
          "/api/orders",
          "POST",
          {
            order: makeOrderPayload("ord-waiter-ok", {
              status: "CONFIRMED",
              paymentStatus: "PENDING",
            }),
          },
          WAITER_COOKIE
        )
      );
      expect(waiterOk.status).toBe(200);

      for (const targetStatus of gatedStatuses) {
        const postRes = await ordersRoute.POST(
          makeReq(
            "/api/orders",
            "POST",
            {
              order: makeOrderPayload(`ord-unpaid-post-${targetStatus}`, {
                status: targetStatus,
                paymentStatus: "PENDING",
              }),
            },
            CASHIER_COOKIE
          )
        );
        expect(postRes.status).toBe(403);

        const selfRes = await selfOrderPost(
          makeReq("/api/orders/self-order", "POST", {
            order: {
              id: `ord-so-unpaid-${targetStatus}`,
              tableNumber: "T-02",
              customerName: "Tamu Nakal",
              paymentMethod: "QRIS",
              paymentStatus: "PENDING",
              status: targetStatus,
              items: [
                {
                  id: "it-so-1",
                  productId: KS_PRODUCT.id,
                  productName: KS_PRODUCT.name,
                  quantity: 1,
                  unitPrice: KS_PRODUCT.basePrice,
                },
              ],
            },
          })
        );
        expect(selfRes.status).toBe(403);
      }
    });

    it("rejects advancing an existing PENDING order into KDS/post-KDS statuses via PATCH /api/orders with 403", async () => {
      const createRes = await ordersRoute.POST(
        makeReq(
          "/api/orders",
          "POST",
          {
            order: makeOrderPayload("ord-pending-patch-1", {
              status: "CONFIRMED",
              paymentStatus: "PENDING",
            }),
          },
          WAITER_COOKIE
        )
      );
      expect(createRes.status).toBe(200);

      for (const targetStatus of gatedStatuses) {
        const patchRes = await callOrdersPatch(
          { id: "ord-pending-patch-1", status: targetStatus },
          KITCHEN_COOKIE
        );
        expect(patchRes.status).toBe(403);
      }

      const persisted = (await getPersistentOrders()).find(
        (o) => o.id === "ord-pending-patch-1"
      );
      expect(persisted?.status).toBe("CONFIRMED");
      expect(persisted?.paymentStatus).toBe("PENDING");
      expect(filterKitchenOrders([persisted!], ALL_KDS_FILTERS)).toHaveLength(0);
    });
  });

  describe("2. Paid KDS Admission & QRIS Settlement BOM Deduction", () => {
    it("admits PAID CONFIRMED order to KDS and settles NEW/PENDING QRIS self-order via webhook with idempotent single BOM deduction", async () => {
      const initialMilk = INITIAL_INGREDIENTS.find((i) => i.id === "ing-1")!.stockNumber;
      const initialCoffee = INITIAL_INGREDIENTS.find((i) => i.id === "ing-2")!.stockNumber;
      const initialCup = INITIAL_INGREDIENTS.find((i) => i.id === "ing-8")!.stockNumber;

      // Paid CONFIRMED order via /api/orders enters KDS and deducts BOM once
      const paidPosRes = await ordersRoute.POST(
        makeReq(
          "/api/orders",
          "POST",
          {
            order: makeOrderPayload("ord-paid-kds-1", {
              status: "CONFIRMED",
              paymentStatus: "PAID",
              paymentMethod: "CASH",
              items: [
                {
                  id: "it-pos-1",
                  productId: KS_PRODUCT.id,
                  tenantId: KS_PRODUCT.tenantId,
                  productName: KS_PRODUCT.name,
                  quantity: 1,
                  unitPrice: KS_PRODUCT.basePrice,
                },
              ],
              subtotal: KS_PRODUCT.basePrice,
              tax: Math.round(KS_PRODUCT.basePrice * 0.1),
              serviceCharge: Math.round(KS_PRODUCT.basePrice * 0.05),
              total:
                KS_PRODUCT.basePrice +
                Math.round(KS_PRODUCT.basePrice * 0.1) +
                Math.round(KS_PRODUCT.basePrice * 0.05),
            }),
          },
          CASHIER_COOKIE
        )
      );
      expect(paidPosRes.status).toBe(200);
      const paidPosJson = await paidPosRes.json();
      expect(paidPosJson.order.bomDeducted).toBe(true);
      expect(filterKitchenOrders([paidPosJson.order], ALL_KDS_FILTERS)).toHaveLength(1);

      // Self-order NEW/PENDING QRIS does NOT appear in KDS and does NOT deduct BOM yet
      const soRes = await selfOrderPost(
        makeReq("/api/orders/self-order", "POST", {
          order: {
            id: "ord-so-qris-bom-1",
            tableNumber: "T-05",
            customerName: "Tamu QRIS",
            paymentMethod: "QRIS",
            items: [
              {
                id: "it-so-1",
                productId: KS_PRODUCT.id,
                productName: KS_PRODUCT.name,
                quantity: 2,
                unitPrice: KS_PRODUCT.basePrice,
              },
            ],
          },
        })
      );
      expect(soRes.status).toBe(200);
      const createdSelfOrder: OrderRecord = (await soRes.json()).order;
      expect(createdSelfOrder.status).toBe("NEW");
      expect(createdSelfOrder.paymentStatus).toBe("PENDING");
      expect(filterKitchenOrders([createdSelfOrder], ALL_KDS_FILTERS)).toHaveLength(0);

      // Settle via QRIS webhook
      const sig = signQrisWebhookPayload({
        invoiceNumber: createdSelfOrder.orderNumber,
        amount: createdSelfOrder.total,
        transactionStatus: "SUCCESS",
      });
      const whRes1 = await qrisVerifyPost(
        makeReq(
          "/api/pos/qris/verify",
          "POST",
          {
            mode: "WEBHOOK",
            invoiceNumber: createdSelfOrder.orderNumber,
            amount: createdSelfOrder.total,
            transactionStatus: "SUCCESS",
          },
          undefined,
          { "x-dago-signature": sig }
        )
      );
      expect(whRes1.status).toBe(200);

      const settledOrder = (await getPersistentOrders()).find(
        (o) => o.id === "ord-so-qris-bom-1"
      )!;
      expect(settledOrder.paymentStatus).toBe("PAID");
      expect(settledOrder.status).toBe("CONFIRMED");
      expect(settledOrder.bomDeducted).toBe(true);
      expect(filterKitchenOrders([settledOrder], ALL_KDS_FILTERS)).toHaveLength(1);

      // Repeat webhook verify must NOT double-deduct stock
      const whRes2 = await qrisVerifyPost(
        makeReq(
          "/api/pos/qris/verify",
          "POST",
          {
            mode: "WEBHOOK",
            invoiceNumber: createdSelfOrder.orderNumber,
            amount: createdSelfOrder.total,
            transactionStatus: "SUCCESS",
          },
          undefined,
          { "x-dago-signature": sig }
        )
      );
      expect(whRes2.status).toBe(200);

      const invState = await readPersistentDomainState(inventoryDomainSpec);
      expect(invState.appliedOpIds).toContain("bom-deduct-ord-paid-kds-1");
      expect(invState.appliedOpIds).toContain("bom-deduct-ord-so-qris-bom-1");
      // Total quantity deducted = 1 (POS) + 2 (self-order) = 3 Kopi Senja Aren
      expect(invState.ingredients.find((i) => i.id === "ing-1")!.stockNumber).toBeCloseTo(
        initialMilk - 0.36,
        3
      );
      expect(invState.ingredients.find((i) => i.id === "ing-2")!.stockNumber).toBeCloseTo(
        initialCoffee - 0.054,
        3
      );
      expect(invState.ingredients.find((i) => i.id === "ing-8")!.stockNumber).toBe(
        initialCup - 3
      );
    });

    it("promotes NEW/PENDING QRIS self-order to CONFIRMED/PAID and deducts BOM once via SUPERVISOR_OVERRIDE", async () => {
      const initialMilk = INITIAL_INGREDIENTS.find((i) => i.id === "ing-1")!.stockNumber;

      const soRes = await selfOrderPost(
        makeReq("/api/orders/self-order", "POST", {
          order: {
            id: "ord-so-sup-bom-1",
            tableNumber: "T-08",
            customerName: "Tamu Override",
            paymentMethod: "QRIS",
            items: [
              {
                id: "it-so-sup-1",
                productId: KS_PRODUCT.id,
                productName: KS_PRODUCT.name,
                quantity: 1,
                unitPrice: KS_PRODUCT.basePrice,
              },
            ],
          },
        })
      );
      expect(soRes.status).toBe(200);
      const created: OrderRecord = (await soRes.json()).order;

      const supRes1 = await qrisVerifyPost(
        makeReq(
          "/api/pos/qris/verify",
          "POST",
          {
            mode: "SUPERVISOR_OVERRIDE",
            invoiceNumber: created.orderNumber,
            pin: "9137",
            referenceNumber: "RRN-V32-001",
          },
          MANAGER_COOKIE
        )
      );
      expect(supRes1.status).toBe(200);

      const settled = (await getPersistentOrders()).find((o) => o.id === "ord-so-sup-bom-1")!;
      expect(settled.paymentStatus).toBe("PAID");
      expect(settled.status).toBe("CONFIRMED");
      expect(settled.bomDeducted).toBe(true);
      expect(filterKitchenOrders([settled], ALL_KDS_FILTERS)).toHaveLength(1);

      // Repeat override rejected with 409 and never double-deducts
      const supRes2 = await qrisVerifyPost(
        makeReq(
          "/api/pos/qris/verify",
          "POST",
          {
            mode: "SUPERVISOR_OVERRIDE",
            invoiceNumber: created.orderNumber,
            pin: "9137",
            referenceNumber: "RRN-V32-002",
          },
          MANAGER_COOKIE
        )
      );
      expect(supRes2.status).toBe(409);

      const invState = await readPersistentDomainState(inventoryDomainSpec);
      expect(invState.ingredients.find((i) => i.id === "ing-1")!.stockNumber).toBeCloseTo(
        initialMilk - 0.12,
        3
      );
    });
  });

  describe("3. Pre-Cook vs Post-Cook BOM Restoration on Cancel/Void/Refund", () => {
    it("restores BOM stock to exact initial levels on pre-cook PAID cancel via PATCH and DELETE, without double-restoration", async () => {
      const initialMilk = INITIAL_INGREDIENTS.find((i) => i.id === "ing-1")!.stockNumber;
      const initialCup = INITIAL_INGREDIENTS.find((i) => i.id === "ing-8")!.stockNumber;

      // Case A: PAID pre-cook CONFIRMED cancelled via PATCH
      const createA = await ordersRoute.POST(
        makeReq(
          "/api/orders",
          "POST",
          { order: makeOrderPayload("ord-cancel-patch-1") },
          CASHIER_COOKIE
        )
      );
      expect(createA.status).toBe(200);
      expect((await createA.json()).order.bomDeducted).toBe(true);

      const midState = await readPersistentDomainState(inventoryDomainSpec);
      expect(midState.ingredients.find((i) => i.id === "ing-1")!.stockNumber).toBeCloseTo(
        initialMilk - 0.24,
        3
      );

      const patchCancel1 = await callOrdersPatch(
        { id: "ord-cancel-patch-1", status: "CANCELLED", voidReason: "Salah pesan" },
        MANAGER_COOKIE
      );
      expect(patchCancel1.status).toBe(200);
      const cancelJson1 = await patchCancel1.json();
      expect(cancelJson1.order.status).toBe("CANCELLED");
      expect(cancelJson1.order.bomRestored).toBe(true);

      // Repeat cancel via PATCH must NOT double-restore
      const patchCancel2 = await callOrdersPatch(
        { id: "ord-cancel-patch-1", status: "CANCELLED" },
        MANAGER_COOKIE
      );
      expect(patchCancel2.status).toBe(200);

      let invAfterA = await readPersistentDomainState(inventoryDomainSpec);
      expect(invAfterA.ingredients.find((i) => i.id === "ing-1")!.stockNumber).toBeCloseTo(
        initialMilk,
        3
      );
      expect(invAfterA.ingredients.find((i) => i.id === "ing-8")!.stockNumber).toBe(initialCup);

      // Case B: PAID pre-cook KITCHEN_RECEIVED (no cookingStartedAt) cancelled via DELETE
      const createB = await ordersRoute.POST(
        makeReq(
          "/api/orders",
          "POST",
          {
            order: makeOrderPayload("ord-cancel-delete-1", {
              status: "KITCHEN_RECEIVED",
              paymentStatus: "PAID",
            }),
          },
          CASHIER_COOKIE
        )
      );
      expect(createB.status).toBe(200);
      expect((await createB.json()).order.bomDeducted).toBe(true);

      const delRes1 = await ordersRoute.DELETE(
        makeReq(
          "/api/orders?id=ord-cancel-delete-1",
          "DELETE",
          { voidReason: "Tamu batal sebelum dimasak" },
          MANAGER_COOKIE
        )
      );
      expect(delRes1.status).toBe(200);
      const delJson1 = await delRes1.json();
      expect(delJson1.order.status).toBe("CANCELLED");
      expect(delJson1.order.bomRestored).toBe(true);

      // Repeat DELETE must NOT double-restore
      const delRes2 = await ordersRoute.DELETE(
        makeReq("/api/orders?id=ord-cancel-delete-1", "DELETE", undefined, MANAGER_COOKIE)
      );
      expect(delRes2.status).toBe(200);

      invAfterA = await readPersistentDomainState(inventoryDomainSpec);
      expect(invAfterA.ingredients.find((i) => i.id === "ing-1")!.stockNumber).toBeCloseTo(
        initialMilk,
        3
      );
      expect(invAfterA.ingredients.find((i) => i.id === "ing-8")!.stockNumber).toBe(initialCup);
    });

    it("leaves stock unchanged (zero inflation) when cancelling an UNPAID (PENDING) order", async () => {
      const initialMilk = INITIAL_INGREDIENTS.find((i) => i.id === "ing-1")!.stockNumber;

      const createUnpaid = await ordersRoute.POST(
        makeReq(
          "/api/orders",
          "POST",
          {
            order: makeOrderPayload("ord-unpaid-cancel-api", {
              status: "CONFIRMED",
              paymentStatus: "PENDING",
            }),
          },
          WAITER_COOKIE
        )
      );
      expect(createUnpaid.status).toBe(200);
      expect((await createUnpaid.json()).order.bomDeducted).toBeUndefined();

      const cancelUnpaid = await callOrdersPatch(
        { id: "ord-unpaid-cancel-api", status: "CANCELLED" },
        MANAGER_COOKIE
      );
      expect(cancelUnpaid.status).toBe(200);
      const cancelJson = await cancelUnpaid.json();
      expect(cancelJson.order.bomRestored).toBeFalsy();

      const invState = await readPersistentDomainState(inventoryDomainSpec);
      expect(invState.ingredients.find((i) => i.id === "ing-1")!.stockNumber).toBe(initialMilk);
    });

    it("does NOT restore BOM stock when cancelling COOKING / READY / SERVED / COMPLETED orders or orders with cookingStartedAt set", async () => {
      const initialMilk = INITIAL_INGREDIENTS.find((i) => i.id === "ing-1")!.stockNumber;

      const blockedCases: Array<{
        id: string;
        status: OrderStatus;
        cookingStartedAt?: string;
      }> = [
        { id: "ord-postcook-cooking", status: "COOKING" },
        { id: "ord-postcook-ready", status: "READY" },
        { id: "ord-postcook-served", status: "SERVED" },
        { id: "ord-postcook-completed", status: "COMPLETED" },
        {
          id: "ord-postcook-ts",
          status: "KITCHEN_RECEIVED",
          cookingStartedAt: "2026-11-23T10:05:00.000Z",
        },
      ];

      for (const tc of blockedCases) {
        const res = await ordersRoute.POST(
          makeReq(
            "/api/orders",
            "POST",
            {
              order: makeOrderPayload(tc.id, {
                status: tc.status,
                paymentStatus: "PAID",
                ...(tc.cookingStartedAt ? { cookingStartedAt: tc.cookingStartedAt } : {}),
                items: [
                  {
                    id: `it-${tc.id}`,
                    productId: KS_PRODUCT.id,
                    tenantId: KS_PRODUCT.tenantId,
                    productName: KS_PRODUCT.name,
                    quantity: 1,
                    unitPrice: KS_PRODUCT.basePrice,
                  },
                ],
                subtotal: KS_PRODUCT.basePrice,
                tax: Math.round(KS_PRODUCT.basePrice * 0.1),
                serviceCharge: Math.round(KS_PRODUCT.basePrice * 0.05),
                total:
                  KS_PRODUCT.basePrice +
                  Math.round(KS_PRODUCT.basePrice * 0.1) +
                  Math.round(KS_PRODUCT.basePrice * 0.05),
              }),
            },
            CASHIER_COOKIE
          )
        );
        expect(res.status).toBe(200);

        const cancelRes = await callOrdersPatch(
          {
            id: tc.id,
            status: "CANCELLED",
            paymentStatus: "REFUNDED",
            refundReason: "Komplain pasca-masak",
          },
          MANAGER_COOKIE
        );
        expect(cancelRes.status).toBe(200);
        const cancelJson = await cancelRes.json();
        expect(cancelJson.order.status).toBe("CANCELLED");
        expect(cancelJson.order.bomRestored).toBeFalsy();
      }

      const invState = await readPersistentDomainState(inventoryDomainSpec);
      // 5 orders * 1 Kopi Senja Aren (0.12L milk each = 0.60L deducted, 0 restored)
      expect(invState.ingredients.find((i) => i.id === "ing-1")!.stockNumber).toBeCloseTo(
        initialMilk - 0.6,
        3
      );
      for (const tc of blockedCases) {
        expect(invState.appliedOpIds).not.toContain(`bom-restore-${tc.id}`);
      }
    });
  });

  describe("4. Sequential & Concurrent Canonical Order Number Uniqueness", () => {
    it("produces 40 strictly unique canonical ORD-KS-YYYYMMDD-NNNN numbers for 20 sequential + 20 concurrent POST /api/orders with colliding orderNumber", async () => {
      const collidingNumber = "ORD-KS-20261123-0001";
      const seqOrders: OrderRecord[] = [];
      for (let i = 0; i < 20; i++) {
        const res = await ordersRoute.POST(
          makeReq(
            "/api/orders",
            "POST",
            {
              order: makeOrderPayload(`ord-pos-seq-${i + 1}`, {
                orderNumber: collidingNumber,
              }),
            },
            CASHIER_COOKIE
          )
        );
        expect(res.status).toBe(200);
        seqOrders.push((await res.json()).order);
      }

      const concurrentResponses = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          ordersRoute.POST(
            makeReq(
              "/api/orders",
              "POST",
              {
                order: makeOrderPayload(`ord-pos-conc-${i + 1}`, {
                  orderNumber: collidingNumber,
                }),
              },
              CASHIER_COOKIE
            )
          )
        )
      );
      const concOrders: OrderRecord[] = [];
      for (const res of concurrentResponses) {
        expect(res.status).toBe(200);
        concOrders.push((await res.json()).order);
      }

      const allNumbers = [...seqOrders, ...concOrders].map((o) => o.orderNumber);
      expect(allNumbers).toHaveLength(40);
      expect(new Set(allNumbers).size).toBe(40);
      for (const num of allNumbers) {
        expect(num).toMatch(/^ORD-KS-20261123-\d{4,}$/);
      }

      const persisted = await getPersistentOrders();
      expect(persisted).toHaveLength(40);
      expect(new Set(persisted.map((o) => o.orderNumber)).size).toBe(40);
    });

    it("produces 40 strictly unique canonical ORD-<CODE>-YYYYMMDD-NNNN numbers for 20 sequential + 20 concurrent POST /api/orders/self-order", async () => {
      const seqOrders: OrderRecord[] = [];
      for (let i = 0; i < 20; i++) {
        const res = await selfOrderPost(
          makeReq("/api/orders/self-order", "POST", {
            order: {
              id: `ord-so-seq-${i + 1}`,
              orderNumber: "ORD-KS-20261123-0001",
              tableNumber: `T-${i + 1}`,
              customerName: `Guest Seq ${i + 1}`,
              paymentMethod: "QRIS",
              createdAt: "2026-11-23T10:00:00.000Z",
              items: [
                {
                  id: `it-so-seq-${i + 1}`,
                  productId: KS_PRODUCT.id,
                  productName: KS_PRODUCT.name,
                  quantity: 1,
                  unitPrice: KS_PRODUCT.basePrice,
                },
              ],
            },
          })
        );
        expect(res.status).toBe(200);
        seqOrders.push((await res.json()).order);
      }

      const concurrentResponses = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          selfOrderPost(
            makeReq("/api/orders/self-order", "POST", {
              order: {
                id: `ord-so-conc-${i + 1}`,
                orderNumber: "ORD-KS-20261123-0001",
                tableNumber: `T-${i + 21}`,
                customerName: `Guest Conc ${i + 1}`,
                paymentMethod: "QRIS",
                createdAt: "2026-11-23T10:00:00.000Z",
                items: [
                  {
                    id: `it-so-conc-${i + 1}`,
                    productId: KS_PRODUCT.id,
                    productName: KS_PRODUCT.name,
                    quantity: 1,
                    unitPrice: KS_PRODUCT.basePrice,
                  },
                ],
              },
            })
          )
        )
      );

      const concOrders: OrderRecord[] = [];
      for (const res of concurrentResponses) {
        expect(res.status).toBe(200);
        concOrders.push((await res.json()).order);
      }

      const allNumbers = [...seqOrders, ...concOrders].map((o) => o.orderNumber);
      expect(allNumbers).toHaveLength(40);
      expect(new Set(allNumbers).size).toBe(40);
      for (const num of allNumbers) {
        expect(num).toMatch(/^ORD-KS-20261123-\d{4,}$/);
      }

      // Multi-tenant self-order resolves publisher code DAGO
      const multiRes = await selfOrderPost(
        makeReq("/api/orders/self-order", "POST", {
          order: {
            id: "ord-so-multi-1",
            tableNumber: "T-99",
            customerName: "Guest Multi",
            paymentMethod: "QRIS",
            createdAt: "2026-11-23T10:00:00.000Z",
            items: [
              {
                id: "it-m1",
                productId: KS_PRODUCT.id,
                productName: KS_PRODUCT.name,
                quantity: 1,
                unitPrice: KS_PRODUCT.basePrice,
              },
              {
                id: "it-m2",
                productId: KITCHEN_PRODUCT.id,
                productName: KITCHEN_PRODUCT.name,
                quantity: 1,
                unitPrice: KITCHEN_PRODUCT.basePrice,
              },
            ],
          },
        })
      );
      expect(multiRes.status).toBe(200);
      const multiOrder: OrderRecord = (await multiRes.json()).order;
      expect(multiOrder.orderNumber).toMatch(/^ORD-DAGO-20261123-\d{4,}$/);
    });
  });

  // Keep savePersistentOrder import exercised cleanly for pre-seed sanity if needed
  it("sanity: savePersistentOrder helper remains compatible with route tests", async () => {
    const pre = await savePersistentOrder({
      ...(makeOrderPayload("ord-sanity-1") as unknown as OrderRecord),
      statusHistory: [],
    });
    expect(pre.orderNumber).toBe("ORD-KS-20261123-0001");
  });
});
