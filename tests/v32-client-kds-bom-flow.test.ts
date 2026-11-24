import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { mockDeductOrderBOM, mockRestoreOrderBOM, mockLogActivity, mockAddNotification, mockNotify } =
  vi.hoisted(() => ({
    mockDeductOrderBOM: vi.fn(),
    mockRestoreOrderBOM: vi.fn(),
    mockLogActivity: vi.fn(),
    mockAddNotification: vi.fn(),
    mockNotify: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-cashier-sgr",
      name: "Kasir Uji",
      role: { slug: "CASHIER" },
      organization: { id: "org-dago-hub" },
    },
  }),
}));

vi.mock("@/contexts/OutletContext", () => ({
  useOutlet: () => ({
    activeOutletId: "outlet-sgr",
    activeOutlet: { id: "outlet-sgr", name: "Singaraja" },
    isAllOutlets: false,
  }),
}));

vi.mock("@/contexts/DateFilterContext", () => ({
  useDateFilter: () => ({ isDateInRange: () => true }),
}));

vi.mock("@/contexts/ActivityLogContext", () => ({
  useActivityLog: () => ({ logActivity: mockLogActivity }),
}));

vi.mock("@/contexts/InventoryContext", () => ({
  useInventory: () => ({
    deductOrderBOM: mockDeductOrderBOM,
    restoreOrderBOM: mockRestoreOrderBOM,
  }),
}));

vi.mock("@/contexts/NotificationContext", () => ({
  useNotifications: () => ({ addNotification: mockAddNotification }),
}));

vi.mock("@/components/app/notify", () => ({
  notify: mockNotify,
}));

import {
  canAdvanceOrderStatus,
  isClientOrderBeforeCooking,
  OrderProvider,
  resolvePostPaymentOrderStatus,
  shouldRestoreClientOrderBOM,
  useOrders,
} from "@/contexts/OrderContext";
import { isOrderBeforeCooking } from "@/features/orders/orders-domain";
import { getReadyWaiterOrders } from "@/features/waiter/waiter-domain";
import { applyInventoryCommand, inventoryDomainSpec } from "@/lib/sync-domains/inventory-spec";
import { deductOrderItemsBOM, restoreOrderItemsBOM } from "@/features/inventory/inventory-data";
import type { OrderRecord } from "@/types/order";

function makeOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: "ord-client-1",
    orderNumber: "ORD-KS-20261123-0001",
    organizationId: "org-dago-hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tableNumber: "05",
    customerName: "Tamu Uji",
    orderType: "DINE_IN",
    status: "CONFIRMED",
    paymentStatus: "PAID",
    paymentMethod: "QRIS",
    items: [
      {
        id: "it-1",
        productId: "prod-101",
        productName: "Kopi Senja Aren",
        quantity: 2,
        unitPrice: 24000,
        tenantId: "tenant-ks",
      },
    ],
    subtotal: 48000,
    tax: 4800,
    serviceCharge: 2400,
    total: 55200,
    targetServiceMinutes: 10,
    createdAt: "2026-11-23T10:00:00.000Z",
    statusHistory: [],
    ...overrides,
  };
}

describe("V-32 Wave 2B: Client KDS, Waiter, Orders/POS & BOM Flow", () => {
  describe("1. Waiter Ready Gate", () => {
    it("excludes unpaid (PENDING) and REFUNDED orders from getReadyWaiterOrders", () => {
      const paidReady = makeOrder({
        id: "ord-ready-paid",
        status: "READY",
        paymentStatus: "PAID",
      });
      const unpaidReady = makeOrder({
        id: "ord-ready-pending",
        status: "READY",
        paymentStatus: "PENDING",
      });
      const refundedReady = makeOrder({
        id: "ord-ready-refunded",
        status: "READY",
        paymentStatus: "REFUNDED",
      });

      const ready = getReadyWaiterOrders([paidReady, unpaidReady, refundedReady], "outlet-sgr");
      expect(ready.map((o) => o.id)).toEqual(["ord-ready-paid"]);
    });
  });

  describe("2. Client Payment Gate & Post-Payment Status Mapping", () => {
    it("denies advancing unpaid orders to KDS or downstream fulfillment statuses", () => {
      for (const nextStatus of [
        "KITCHEN_RECEIVED",
        "COOKING",
        "READY",
        "SERVED",
        "COMPLETED",
      ] as const) {
        const res = canAdvanceOrderStatus({ paymentStatus: "PENDING" }, nextStatus);
        expect(res.allowed).toBe(false);
        if (!res.allowed) {
          expect(res.reason).toBe("Pesanan belum lunas tidak dapat masuk dapur / KDS.");
        }
      }

      expect(canAdvanceOrderStatus({ paymentStatus: "REFUNDED" }, "KITCHEN_RECEIVED").allowed).toBe(
        false
      );
      expect(canAdvanceOrderStatus({ paymentStatus: "PENDING" }, "CANCELLED").allowed).toBe(true);
      expect(
        canAdvanceOrderStatus({ paymentStatus: "PENDING" }, "CONFIRMED", "PAID").allowed
      ).toBe(true);
      expect(canAdvanceOrderStatus({ paymentStatus: "PAID" }, "KITCHEN_RECEIVED").allowed).toBe(
        true
      );
    });

    it("maps NEW -> CONFIRMED on payment so paid orders enter KDS instead of skipping to COMPLETED", () => {
      expect(resolvePostPaymentOrderStatus("NEW")).toBe("CONFIRMED");
      expect(resolvePostPaymentOrderStatus("CONFIRMED")).toBe("CONFIRMED");
      expect(resolvePostPaymentOrderStatus("KITCHEN_RECEIVED")).toBe("KITCHEN_RECEIVED");
      expect(resolvePostPaymentOrderStatus("COOKING")).toBe("COOKING");
      expect(resolvePostPaymentOrderStatus("READY")).toBe("READY");
      expect(resolvePostPaymentOrderStatus("SERVED")).toBe("COMPLETED");
      expect(resolvePostPaymentOrderStatus("COMPLETED")).toBe("COMPLETED");
    });
  });

  describe("3. Pre-Cook BOM Restoration Guard & Deterministic Client Deduplication", () => {
    it("allows BOM restoration only for pre-cook orders with bomDeducted=true and !bomRestored", () => {
      expect(isClientOrderBeforeCooking({ status: "NEW" })).toBe(true);
      expect(isClientOrderBeforeCooking({ status: "CONFIRMED" })).toBe(true);
      expect(isClientOrderBeforeCooking({ status: "KITCHEN_RECEIVED" })).toBe(true);
      expect(isClientOrderBeforeCooking({ status: "COOKING" })).toBe(false);
      expect(
        isClientOrderBeforeCooking({
          status: "CONFIRMED",
          cookingStartedAt: "2026-11-23T10:05:00.000Z",
        })
      ).toBe(false);

      // Eligible: paid pre-cook with bomDeducted=true and not yet restored
      expect(
        shouldRestoreClientOrderBOM({
          status: "CONFIRMED",
          bomDeducted: true,
          bomRestored: false,
        })
      ).toBe(true);

      // Skip: unpaid cancel (never deducted BOM)
      expect(
        shouldRestoreClientOrderBOM({
          status: "NEW",
          bomDeducted: false,
        })
      ).toBe(false);
      expect(
        shouldRestoreClientOrderBOM({
          status: "NEW",
        })
      ).toBe(false);

      // Skip: already restored
      expect(
        shouldRestoreClientOrderBOM({
          status: "CONFIRMED",
          bomDeducted: true,
          bomRestored: true,
        })
      ).toBe(false);

      // Skip: COOKING or beyond, or cookingStartedAt set
      for (const status of ["COOKING", "READY", "SERVED", "COMPLETED"] as const) {
        expect(
          shouldRestoreClientOrderBOM({
            status,
            bomDeducted: true,
          })
        ).toBe(false);
      }
      expect(
        shouldRestoreClientOrderBOM({
          status: "CONFIRMED",
          cookingStartedAt: "2026-11-23T10:05:00.000Z",
          bomDeducted: true,
        })
      ).toBe(false);

      // Skip: any tenant in tenantStatuses has reached COOKING or beyond
      for (const stage of ["COOKING", "READY", "SERVED", "COMPLETED"] as const) {
        expect(
          isOrderBeforeCooking({
            status: "CONFIRMED",
            tenantStatuses: { "tenant-ks": stage, "tenant-kitchen": "CONFIRMED" },
          })
        ).toBe(false);
        expect(
          shouldRestoreClientOrderBOM({
            status: "CONFIRMED",
            tenantStatuses: { "tenant-ks": stage, "tenant-kitchen": "CONFIRMED" },
            bomDeducted: true,
          })
        ).toBe(false);
      }
    });

    it("deduplicates deterministic bom-deduct-<orderId> and bom-restore-<orderId> commands", () => {
      const initial = inventoryDomainSpec.defaultState();
      const initialMilk = initial.ingredients.find((i) => i.id === "ing-1")!.stockNumber;
      const orderId = "ord-dedup-1";
      const items = [{ productId: "prod-101", productName: "Kopi Senja Aren", quantity: 1 }];

      const deductRes = deductOrderItemsBOM(initial.ingredients, initial.recipes, items);
      const deductOpId = `bom-deduct-${orderId}`;
      const deductCmd = {
        op: "APPLY_BOM_DELTAS" as const,
        opId: deductOpId,
        deltas: deductRes.logs
          .filter((l) => l.delta !== 0)
          .map((l) => ({ ingredientId: l.ingredientId, delta: l.delta })),
        logs: deductRes.logs,
      };

      const afterFirstDeduct = applyInventoryCommand(initial, deductCmd);
      const afterSecondDeduct = applyInventoryCommand(afterFirstDeduct, deductCmd);
      expect(afterSecondDeduct).toBe(afterFirstDeduct);
      expect(afterSecondDeduct.ingredients.find((i) => i.id === "ing-1")!.stockNumber).toBeCloseTo(
        initialMilk - 0.12,
        3
      );

      const restoreRes = restoreOrderItemsBOM(
        afterSecondDeduct.ingredients,
        afterSecondDeduct.recipes,
        items,
        "ORD-KS-20261123-0001"
      );
      const restoreOpId = `bom-restore-${orderId}`;
      const restoreCmd = {
        op: "APPLY_BOM_DELTAS" as const,
        opId: restoreOpId,
        deltas: restoreRes.logs
          .filter((l) => l.delta !== 0)
          .map((l) => ({ ingredientId: l.ingredientId, delta: l.delta })),
        logs: restoreRes.logs,
      };

      const afterFirstRestore = applyInventoryCommand(afterSecondDeduct, restoreCmd);
      const afterSecondRestore = applyInventoryCommand(afterFirstRestore, restoreCmd);
      expect(afterSecondRestore).toBe(afterFirstRestore);
      expect(afterSecondRestore.ingredients.find((i) => i.id === "ing-1")!.stockNumber).toBeCloseTo(
        initialMilk,
        3
      );
    });
  });

  describe("4. Source & Regression Sanity Checks", () => {
    it("InventoryContext uses deterministic bom-deduct-/bom-restore- opIds and appliedOpIds guard", () => {
      const src = fs.readFileSync(
        path.resolve(process.cwd(), "src/contexts/InventoryContext.tsx"),
        "utf-8"
      );
      expect(src).toContain("`bom-deduct-${cleanOrderId}`");
      expect(src).toContain("`bom-restore-${cleanOrderId}`");
      expect(src).toContain("appliedOpIdsRef");
      expect(src).toContain("hasAppliedOpId");
    });

    it("OrderContext enforces payment gate, uses shared orders-domain helpers, and preserves audit actions", () => {
      const src = fs.readFileSync(
        path.resolve(process.cwd(), "src/contexts/OrderContext.tsx"),
        "utf-8"
      );
      expect(src).toContain("Pesanan belum lunas tidak dapat masuk dapur / KDS.");
      expect(src).toContain("syncSequenceFromOrderNumber");
      expect(src).toContain("isOrderBeforeCooking");
      expect(src).toContain("isKdsGatedStatus");
      expect(src).toContain("toOrderBomItems");
      expect(src).toContain("action: auditAction");
      expect(src).toContain('"REFUND_ORDER"');
      expect(src).toContain('"VOID_ORDER"');
      expect(src).not.toContain('tableNumber: newOrderData.tableNumber || "T-01"');
      expect(src).not.toContain("persistent-storage");
      expect(src).not.toContain("wireOrderOverride");
    });

    it("orders/page.tsx awaits OrderContext server results, avoids duplicate BOM calls, and preserves RBAC/shift guards", () => {
      const src = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/(dashboard)/orders/page.tsx"),
        "utf-8"
      );
      expect(src).toContain("resolvePostPaymentOrderStatus(paymentOrder.status)");
      expect(src).toContain("await advanceOrderStatus(");
      expect(src).toContain("if (syncRes.rejected)");
      expect(src).toContain("isOrderBeforeCooking(resolvedOrder)");
      expect(src).not.toContain("deductOrderBOM(");
      expect(src).not.toContain("restoreOrderBOM(");
      expect(src).toContain("refundOrderTarget.id");
      expect(src).toContain("paymentOrder.id");
      expect(src).toContain("if (!activeShift)");
      expect(src).toContain("setIsOpenShiftModalOpen(true)");
      expect(src).toContain('const isKitchenStaff = roleSlug === "KITCHEN_STAFF"');
      expect(src).toContain("canExportNominalReports");
      expect(src).toContain("canViewNominals");
    });

    it("pos/page.tsx awaits authoritative orderNumber without duplicating sequence or BOM calls", () => {
      const src = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/(dashboard)/pos/page.tsx"),
        "utf-8"
      );
      expect(src).toContain("createPosOrderWithSync");
      expect(src).toContain("await serverSync");
      expect(src).toContain("if (syncResult.rejected)");
      expect(src).not.toContain("syncSequenceFromOrderNumber(");
      expect(src).not.toContain("deductOrderBOM(");
    });
  });

  describe("5. Wave 3 OrderProvider Server-Authority & BOM Guard Behavior", () => {
    let prevWindow: unknown;
    let prevFetch: unknown;
    let prevLocalStorage: unknown;
    const storageMap = new Map<string, string>();

    function mountOrderContext() {
      let captured!: ReturnType<typeof useOrders>;
      function Probe() {
        captured = useOrders();
        return null;
      }
      renderToStaticMarkup(React.createElement(OrderProvider, null, React.createElement(Probe)));
      return captured;
    }

    beforeEach(() => {
      vi.clearAllMocks();
      storageMap.clear();
      prevWindow = (globalThis as { window?: unknown }).window;
      prevFetch = (globalThis as { fetch?: unknown }).fetch;
      prevLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;

      const localStorageMock = {
        getItem: (k: string) => storageMap.get(k) ?? null,
        setItem: (k: string, v: string) => {
          storageMap.set(k, String(v));
        },
        removeItem: (k: string) => {
          storageMap.delete(k);
        },
        clear: () => storageMap.clear(),
      };
      (globalThis as Record<string, unknown>).localStorage = localStorageMock;
      (globalThis as Record<string, unknown>).window = {
        localStorage: localStorageMock,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    });

    afterEach(() => {
      if (prevWindow === undefined) delete (globalThis as Record<string, unknown>).window;
      else (globalThis as Record<string, unknown>).window = prevWindow;
      if (prevFetch === undefined) delete (globalThis as Record<string, unknown>).fetch;
      else (globalThis as Record<string, unknown>).fetch = prevFetch;
      if (prevLocalStorage === undefined)
        delete (globalThis as Record<string, unknown>).localStorage;
      else (globalThis as Record<string, unknown>).localStorage = prevLocalStorage;
    });

    it("does NOT call deductOrderBOM when advanceOrderStatus payment is rejected (403) and rolls back state", async () => {
      const pendingSeed = makeOrder({
        id: "ord-ctx-pay-reject",
        status: "NEW",
        paymentStatus: "PENDING",
      });
      (globalThis as Record<string, unknown>).fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/orders") {
          return new Response(
            JSON.stringify({ error: "FORBIDDEN: ORDER_ALREADY_PAID" }),
            { status: 403, headers: { "content-type": "application/json" } }
          );
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });

      const ctx = mountOrderContext();
      // Seed pending order into live OrderContext via createOrder (offline/server ok for seed)
      let calls = 0;
      (globalThis as Record<string, unknown>).fetch = vi.fn(async () => {
        calls++;
        if (calls === 1) {
          return new Response(JSON.stringify({ success: true, order: pendingSeed }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "FORBIDDEN: ORDER_ALREADY_PAID" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        });
      });

      ctx.createOrder(pendingSeed);
      await new Promise((r) => setTimeout(r, 10));
      const seeded = ctx.getOrderById(pendingSeed.id);
      expect(seeded?.paymentStatus).toBe("PENDING");

      const syncRes = await ctx.advanceOrderStatus(pendingSeed.id, "CONFIRMED", "Pay", {
        paymentStatus: "PAID",
        paymentMethod: "CASH",
      });

      expect(syncRes.rejected).toBe(true);
      expect(mockDeductOrderBOM).not.toHaveBeenCalled();
      expect(ctx.getOrderById(pendingSeed.id)?.paymentStatus).toBe("PENDING");
    });

    it("removes optimistic POS order from state and skips deductOrderBOM when createPosOrderWithSync is rejected", async () => {
      (globalThis as Record<string, unknown>).fetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({ error: "QRIS_PAYMENT_UNVERIFIED [NOT_FOUND]" }),
          { status: 409, headers: { "content-type": "application/json" } }
        );
      });

      const ctx = mountOrderContext();
      const { order, serverSync } = ctx.createPosOrderWithSync({
        id: "ord-pos-reject-1",
        items: makeOrder().items,
        subtotal: 48000,
        tax: 4800,
        serviceCharge: 2400,
        total: 55200,
        paymentMethod: "QRIS",
      });

      expect(ctx.getOrderById(order.id)?.id).toBe(order.id);
      const syncRes = await serverSync;
      expect(syncRes.rejected).toBe(true);
      expect(mockDeductOrderBOM).not.toHaveBeenCalled();
      expect(ctx.getOrderById(order.id)).toBeUndefined();
    });

    it("refuses local restoreOrderBOM on stale client refund/cancel when server omits bomRestored=true (cooking started)", async () => {
      const paidSeed = makeOrder({
        id: "ord-ctx-stale-cancel",
        status: "CONFIRMED",
        paymentStatus: "PAID",
        bomDeducted: true,
      });

      let callNum = 0;
      (globalThis as Record<string, unknown>).fetch = vi.fn(async () => {
        callNum++;
        if (callNum === 1) {
          return new Response(JSON.stringify({ success: true, order: paidSeed }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        // Server noticed kitchen started cooking -> returned CANCELLED without bomRestored: true
        return new Response(
          JSON.stringify({
            success: true,
            order: {
              ...paidSeed,
              status: "CANCELLED",
              paymentStatus: "REFUNDED",
              cookingStartedAt: "2026-11-23T10:05:00.000Z",
            },
            bomRestoration: { restored: false, reason: "already-cooking-or-beyond", restoredItems: 0 },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      });

      const ctx = mountOrderContext();
      ctx.createOrder(paidSeed);
      await new Promise((r) => setTimeout(r, 10));

      const refundRes = await ctx.refundOrder(paidSeed.id, {
        reason: "Komplain",
        supervisorName: "Manager",
      });
      expect(refundRes.rejected).toBe(false);
      expect(refundRes.order?.cookingStartedAt).toBe("2026-11-23T10:05:00.000Z");
      expect(mockRestoreOrderBOM).not.toHaveBeenCalled();

      // Pre-cook case where server confirms bomRestored: true -> client calls restoreOrderBOM once
      const precookSeed = makeOrder({
        id: "ord-ctx-precook-cancel",
        status: "CONFIRMED",
        paymentStatus: "PAID",
        bomDeducted: true,
      });
      let precookCall = 0;
      (globalThis as Record<string, unknown>).fetch = vi.fn(async () => {
        precookCall++;
        if (precookCall === 1) {
          return new Response(JSON.stringify({ success: true, order: precookSeed }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({
            success: true,
            order: {
              ...precookSeed,
              status: "CANCELLED",
              paymentStatus: "REFUNDED",
              bomRestored: true,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      });

      ctx.createOrder(precookSeed);
      await new Promise((r) => setTimeout(r, 10));

      const precookRes = await ctx.refundOrder(precookSeed.id, {
        reason: "Batal sebelum masak",
        supervisorName: "Manager",
      });
      expect(precookRes.rejected).toBe(false);
      expect(mockRestoreOrderBOM).toHaveBeenCalledTimes(1);
      expect(mockRestoreOrderBOM).toHaveBeenCalledWith(
        expect.any(Array),
        precookSeed.orderNumber,
        precookSeed.id
      );
    });
  });
});
