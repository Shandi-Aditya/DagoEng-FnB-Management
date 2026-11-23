import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

import {
  canAdvanceOrderStatus,
  isClientOrderBeforeCooking,
  resolvePostPaymentOrderStatus,
  shouldRestoreClientOrderBOM,
} from "@/contexts/OrderContext";
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

    it("OrderContext enforces payment gate, syncs canonical orderNumber, and preserves audit actions", () => {
      const src = fs.readFileSync(
        path.resolve(process.cwd(), "src/contexts/OrderContext.tsx"),
        "utf-8"
      );
      expect(src).toContain("Pesanan belum lunas tidak dapat masuk dapur / KDS.");
      expect(src).toContain("syncSequenceFromOrderNumber");
      expect(src).toContain("shouldRestoreClientOrderBOM");
      expect(src).toContain("action: auditAction");
      expect(src).toContain('"REFUND_ORDER"');
      expect(src).toContain('"VOID_ORDER"');
      expect(src).not.toContain('tableNumber: newOrderData.tableNumber || "T-01"');
      expect(src).not.toContain("persistent-storage");
    });

    it("orders/page.tsx uses resolvePostPaymentOrderStatus, pre-cook restore guard, and preserves RBAC/shift guards", () => {
      const src = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/(dashboard)/orders/page.tsx"),
        "utf-8"
      );
      expect(src).toContain("resolvePostPaymentOrderStatus(paymentOrder.status)");
      expect(src).toContain("shouldRestoreClientOrderBOM(refundOrderTarget)");
      expect(src).toContain("refundOrderTarget.id");
      expect(src).toContain("paymentOrder.id");
      expect(src).toContain("if (!activeShift)");
      expect(src).toContain("setIsOpenShiftModalOpen(true)");
      expect(src).toContain('const isKitchenStaff = roleSlug === "KITCHEN_STAFF"');
      expect(src).toContain("canExportNominalReports");
      expect(src).toContain("canViewNominals");
    });

    it("pos/page.tsx awaits authoritative orderNumber, syncs sequence, and guards BOM deduction on PAID", () => {
      const src = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/(dashboard)/pos/page.tsx"),
        "utf-8"
      );
      expect(src).toContain("createPosOrderWithSync");
      expect(src).toContain("await serverSync");
      expect(src).toContain("syncSequenceFromOrderNumber(createdOrder.orderNumber)");
      expect(src).toContain('if (createdOrder.paymentStatus === "PAID")');
      expect(src).toContain("deductOrderBOM(bomItems, createdOrder.id)");
    });
  });
});
