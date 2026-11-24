import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dagoeng-v32-foundation-"));
process.env.DATA_DIR_OVERRIDE = tmpRoot;

import {
  filterKitchenOrders,
  getNewIncomingKitchenOrders,
  isOrderEligibleForKds,
  type KitchenFilters,
} from "@/features/kitchen/kitchen-board";
import {
  ensureUniqueSequentialOrderNumber,
  generateSequentialReceiptNumber,
  syncSequenceFromOrderNumber,
} from "@/lib/receipt-publisher";
import {
  deductPersistentOrderBOM,
  getPersistentOrders,
  isOrderBeforeCooking,
  mutatePersistentOrders,
  readPersistentDomainState,
  resetPersistentOrders,
  restorePersistentOrderBOMIfBeforeCooking,
  savePersistentOrder,
  updatePersistentOrderIf,
} from "@/lib/persistent-storage";
import { inventoryDomainSpec } from "@/lib/sync-domains/inventory-spec";
import { INITIAL_INGREDIENTS } from "@/features/inventory/inventory-data";
import type { OrderItemRecord, OrderRecord } from "@/types/order";

const ALL_KDS_FILTERS: KitchenFilters = {
  type: "ALL",
  station: "ALL",
  multiStation: false,
};

function makeItem(overrides: Partial<OrderItemRecord> = {}): OrderItemRecord {
  return {
    id: "it-1",
    productId: "prod-101",
    productName: "Kopi Senja Aren",
    quantity: 1,
    unitPrice: 24000,
    tenantId: "tenant-ks",
    ...overrides,
  };
}

function makeOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: `ord-${Math.random().toString(36).slice(2, 10)}`,
    orderNumber: "ORD-KS-20261123-0001",
    organizationId: "org-dago-hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tableNumber: "T-01",
    customerName: "Tamu Uji",
    orderType: "DINE_IN",
    status: "CONFIRMED",
    paymentStatus: "PAID",
    paymentMethod: "CASH",
    items: [makeItem()],
    subtotal: 24000,
    tax: 2400,
    serviceCharge: 1200,
    total: 27600,
    targetServiceMinutes: 10,
    createdAt: "2026-11-23T10:00:00.000Z",
    statusHistory: [],
    ...overrides,
  };
}

function resetTempFiles(): void {
  for (const filename of ["pos_orders.json", "inventory_state.json"]) {
    const filePath = path.join(tmpRoot, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

describe("V-32 Wave 1 Foundation Invariants", () => {
  beforeEach(async () => {
    resetTempFiles();
    await resetPersistentOrders();
  });

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    delete process.env.DATA_DIR_OVERRIDE;
  });

  describe("1. KDS Payment Gate", () => {
    it("isOrderEligibleForKds allows only PAID and non-CANCELLED orders", () => {
      expect(isOrderEligibleForKds({ paymentStatus: "PAID", status: "NEW" })).toBe(true);
      expect(isOrderEligibleForKds({ paymentStatus: "PAID", status: "CONFIRMED" })).toBe(true);
      expect(isOrderEligibleForKds({ paymentStatus: "PAID", status: "COOKING" })).toBe(true);

      expect(isOrderEligibleForKds({ paymentStatus: "PENDING", status: "NEW" })).toBe(false);
      expect(isOrderEligibleForKds({ paymentStatus: "PENDING", status: "CONFIRMED" })).toBe(false);
      expect(isOrderEligibleForKds({ paymentStatus: "REFUNDED", status: "CONFIRMED" })).toBe(false);
      expect(isOrderEligibleForKds({ paymentStatus: "PAID", status: "CANCELLED" })).toBe(false);
    });

    it("filterKitchenOrders and getNewIncomingKitchenOrders exclude unpaid and cancelled orders while preserving FIFO", () => {
      const orders: OrderRecord[] = [
        makeOrder({
          id: "paid-newer",
          createdAt: "2026-11-23T10:05:00.000Z",
          status: "CONFIRMED",
          paymentStatus: "PAID",
        }),
        makeOrder({
          id: "unpaid-new",
          createdAt: "2026-11-23T09:50:00.000Z",
          status: "NEW",
          paymentStatus: "PENDING",
        }),
        makeOrder({
          id: "cancelled-paid",
          createdAt: "2026-11-23T09:52:00.000Z",
          status: "CANCELLED",
          paymentStatus: "PAID",
          tenantStatuses: { "tenant-ks": "CONFIRMED" },
        }),
        makeOrder({
          id: "refunded-order",
          createdAt: "2026-11-23T09:54:00.000Z",
          status: "CONFIRMED",
          paymentStatus: "REFUNDED",
        }),
        makeOrder({
          id: "paid-older",
          createdAt: "2026-11-23T09:55:00.000Z",
          status: "NEW",
          paymentStatus: "PAID",
        }),
        makeOrder({
          id: "paid-cooking",
          createdAt: "2026-11-23T09:58:00.000Z",
          status: "COOKING",
          paymentStatus: "PAID",
        }),
      ];

      expect(filterKitchenOrders(orders, ALL_KDS_FILTERS).map((o) => o.id)).toEqual([
        "paid-older",
        "paid-cooking",
        "paid-newer",
      ]);

      expect(getNewIncomingKitchenOrders(orders, "tenant-ks").map((o) => o.id)).toEqual([
        "paid-older",
        "paid-newer",
      ]);
    });
  });

  describe("2. Unique Sequential Order Number & Concurrent Persistence", () => {
    it("ensureUniqueSequentialOrderNumber handles missing, malformed, prefix preservation, publisher inference, and case-insensitive collisions", () => {
      const date = new Date("2026-11-23T10:00:00.000Z");

      expect(
        ensureUniqueSequentialOrderNumber({
          orderNumber: "",
          existingNumbers: [],
          date,
        })
      ).toBe("ORD-DAGO-20261123-0001");

      expect(
        ensureUniqueSequentialOrderNumber({
          orderNumber: "malformed-token",
          existingNumbers: [],
          date,
        })
      ).toBe("ORD-DAGO-20261123-0001");

      expect(
        ensureUniqueSequentialOrderNumber({
          orderNumber: "INV-bad",
          existingNumbers: [],
          date,
        })
      ).toBe("INV-DAGO-20261123-0001");

      // Infers publisherCode KS and bumps past case-insensitive / whitespace collision
      expect(
        ensureUniqueSequentialOrderNumber({
          orderNumber: "ORD-KS-20261123-0001",
          existingNumbers: new Set(["  ord-ks-20261123-0001  ", "ORD-KS-20261123-0002"]),
        })
      ).toBe("ORD-KS-20261123-0003");

      // Preserves non-colliding well-formed sequential number
      expect(
        ensureUniqueSequentialOrderNumber({
          orderNumber: "INV-DM-20261123-0004",
          existingNumbers: ["INV-DM-20261123-0001"],
        })
      ).toBe("INV-DM-20261123-0004");
    });

    it("syncSequenceFromOrderNumber is a safe no-op on SSR and advances localStorage when higher in browser", () => {
      expect(() => syncSequenceFromOrderNumber("ORD-KS-20261123-0009")).not.toThrow();

      const backingStore = new Map<string, string>();
      const prevWindow = (globalThis as { window?: unknown }).window;
      const prevStorage = (globalThis as { localStorage?: unknown }).localStorage;

      try {
        const mockStorage = {
          getItem: (key: string) => backingStore.get(key) ?? null,
          setItem: (key: string, value: string) => {
            backingStore.set(key, value);
          },
        };
        (globalThis as { window?: unknown }).window = {};
        (globalThis as { localStorage?: unknown }).localStorage = mockStorage;

        syncSequenceFromOrderNumber("ORD-KS-20261123-0005");
        syncSequenceFromOrderNumber("ORD-KS-20261123-0002"); // lower must not regress

        const next = generateSequentialReceiptNumber({
          prefix: "ORD",
          publisherCode: "KS",
          date: new Date("2026-11-23T10:00:00.000Z"),
          existingNumbers: [],
        });
        expect(next).toBe("ORD-KS-20261123-0006");
      } finally {
        if (prevWindow === undefined) {
          delete (globalThis as { window?: unknown }).window;
        } else {
          (globalThis as { window?: unknown }).window = prevWindow;
        }
        if (prevStorage === undefined) {
          delete (globalThis as { localStorage?: unknown }).localStorage;
        } else {
          (globalThis as { localStorage?: unknown }).localStorage = prevStorage;
        }
      }
    });

    it("resolves 25 concurrent + sequential savePersistentOrder calls with colliding orderNumber into 25 unique sequential numbers", async () => {
      const collidingNumber = "ORD-KS-20261123-0001";

      const concurrentSaves = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          savePersistentOrder(
            makeOrder({
              id: `ord-concurrent-${i + 1}`,
              orderNumber: collidingNumber,
              createdAt: "2026-11-23T10:00:00.000Z",
            })
          )
        )
      );

      const sequentialSaves: OrderRecord[] = [];
      for (let i = 20; i < 25; i++) {
        sequentialSaves.push(
          await savePersistentOrder(
            makeOrder({
              id: `ord-seq-${i + 1}`,
              orderNumber: collidingNumber,
              createdAt: "2026-11-23T10:00:00.000Z",
            })
          )
        );
      }

      const allSaved = [...concurrentSaves, ...sequentialSaves];
      const assignedNumbers = allSaved.map((o) => o.orderNumber);
      expect(new Set(assignedNumbers).size).toBe(25);
      for (let n = 1; n <= 25; n++) {
        expect(assignedNumbers).toContain(`ORD-KS-20261123-${String(n).padStart(4, "0")}`);
      }

      const persisted = await getPersistentOrders();
      expect(persisted).toHaveLength(25);
      expect(new Set(persisted.map((o) => o.orderNumber)).size).toBe(25);

      // Updating an existing order with same id keeps its own orderNumber,
      // while colliding with a different order's number resolves a fresh one.
      const first = persisted.find((o) => o.id === "ord-concurrent-1")!;
      const sameUpdate = await savePersistentOrder({ ...first, notes: "Updated note" });
      expect(sameUpdate.orderNumber).toBe(first.orderNumber);

      const second = persisted.find((o) => o.id === "ord-concurrent-2")!;
      const collidingUpdate = await savePersistentOrder({
        ...second,
        orderNumber: first.orderNumber,
      });
      expect(collidingUpdate.orderNumber).toBe("ORD-KS-20261123-0026");

      // Atomic conditional update rejects stale predicate
      const failUpdate = await updatePersistentOrderIf(
        first.id,
        (cur) => cur.status === "COOKING",
        (cur) => ({ ...cur, status: "READY" })
      );
      expect(failUpdate.updated).toBe(false);
      expect(failUpdate.reason).toBe("PREDICATE_FAILED");

      const okMutate = await mutatePersistentOrders((orders) => ({
        nextOrders: orders,
        result: orders.length,
      }));
      expect(okMutate).toBe(25);
    });
  });

  describe("3. Deterministic Pre-Cook BOM Stock Deduction & Restoration", () => {
    it("isOrderBeforeCooking returns true only before cooking starts and before COOKING/READY/SERVED/COMPLETED", () => {
      expect(isOrderBeforeCooking({ status: "NEW" })).toBe(true);
      expect(isOrderBeforeCooking({ status: "CONFIRMED" })).toBe(true);
      expect(isOrderBeforeCooking({ status: "KITCHEN_RECEIVED" })).toBe(true);
      expect(isOrderBeforeCooking({ status: "CANCELLED" })).toBe(true);

      expect(
        isOrderBeforeCooking({
          status: "CONFIRMED",
          cookingStartedAt: "2026-11-23T10:05:00.000Z",
        })
      ).toBe(false);
      expect(
        isOrderBeforeCooking({
          status: "CANCELLED",
          cookingStartedAt: "2026-11-23T10:05:00.000Z",
        })
      ).toBe(false);
      expect(isOrderBeforeCooking({ status: "COOKING" })).toBe(false);
      expect(isOrderBeforeCooking({ status: "READY" })).toBe(false);
      expect(isOrderBeforeCooking({ status: "SERVED" })).toBe(false);
      expect(isOrderBeforeCooking({ status: "COMPLETED" })).toBe(false);
    });

    it("deducts BOM once idempotently and restores exact stock on pre-cook cancellation", async () => {
      const initialMilk = INITIAL_INGREDIENTS.find((i) => i.id === "ing-1")!.stockNumber;
      const initialCoffee = INITIAL_INGREDIENTS.find((i) => i.id === "ing-2")!.stockNumber;
      const initialCup = INITIAL_INGREDIENTS.find((i) => i.id === "ing-8")!.stockNumber;

      const order = await savePersistentOrder(
        makeOrder({
          id: "ord-bom-precook-1",
          orderNumber: "ORD-KS-20261123-0101",
          status: "CONFIRMED",
          paymentStatus: "PAID",
          items: [
            makeItem({
              productId: "prod-101",
              productName: "Kopi Senja Aren",
              quantity: 2,
            }),
          ],
        })
      );

      const firstDeduct = await deductPersistentOrderBOM(order);
      expect(firstDeduct).toEqual({ applied: true, deductedItems: 1 });

      // Idempotent on second call even with stale order object
      const secondDeduct = await deductPersistentOrderBOM(order);
      expect(secondDeduct).toEqual({ applied: false, deductedItems: 0 });

      const afterDeductState = await readPersistentDomainState(inventoryDomainSpec);
      expect(afterDeductState.ingredients.find((i) => i.id === "ing-1")!.stockNumber).toBeCloseTo(
        initialMilk - 0.24,
        3
      );
      expect(afterDeductState.ingredients.find((i) => i.id === "ing-2")!.stockNumber).toBeCloseTo(
        initialCoffee - 0.036,
        3
      );
      expect(afterDeductState.ingredients.find((i) => i.id === "ing-8")!.stockNumber).toBe(
        initialCup - 2
      );
      expect(afterDeductState.appliedOpIds).toContain("bom-deduct-ord-bom-precook-1");

      const storedAfterDeduct = (await getPersistentOrders()).find((o) => o.id === order.id)!;
      expect(storedAfterDeduct.bomDeducted).toBe(true);

      // Cancel before cooking (status becomes CANCELLED, no cookingStartedAt) -> restores stock cleanly
      const cancelledSnapshot: OrderRecord = {
        ...storedAfterDeduct,
        status: "CANCELLED",
        paymentStatus: "REFUNDED",
      };
      const firstRestore = await restorePersistentOrderBOMIfBeforeCooking(cancelledSnapshot, {
        reason: "Batal sebelum dimasak",
      });
      expect(firstRestore).toEqual({ restored: true, reason: "restored", restoredItems: 1 });

      // Second restore call is a strict no-op (no double restoration)
      const secondRestore = await restorePersistentOrderBOMIfBeforeCooking(cancelledSnapshot);
      expect(secondRestore).toEqual({
        restored: false,
        reason: "already-restored",
        restoredItems: 0,
      });

      const afterRestoreState = await readPersistentDomainState(inventoryDomainSpec);
      expect(afterRestoreState.ingredients.find((i) => i.id === "ing-1")!.stockNumber).toBeCloseTo(
        initialMilk,
        3
      );
      expect(afterRestoreState.ingredients.find((i) => i.id === "ing-2")!.stockNumber).toBeCloseTo(
        initialCoffee,
        3
      );
      expect(afterRestoreState.ingredients.find((i) => i.id === "ing-8")!.stockNumber).toBe(
        initialCup
      );
      expect(afterRestoreState.appliedOpIds).toContain("bom-restore-ord-bom-precook-1");

      const storedAfterRestore = (await getPersistentOrders()).find((o) => o.id === order.id)!;
      expect(storedAfterRestore.bomRestored).toBe(true);
    });

    it("never restores/inflates stock when cancelling an unpaid order that never deducted BOM", async () => {
      const initialMilk = INITIAL_INGREDIENTS.find((i) => i.id === "ing-1")!.stockNumber;

      const unpaidOrder = await savePersistentOrder(
        makeOrder({
          id: "ord-unpaid-cancel-1",
          orderNumber: "ORD-KS-20261123-0201",
          status: "NEW",
          paymentStatus: "PENDING",
          items: [makeItem({ productId: "prod-101", productName: "Kopi Senja Aren", quantity: 3 })],
        })
      );

      const res = await restorePersistentOrderBOMIfBeforeCooking({
        ...unpaidOrder,
        status: "CANCELLED",
      });
      expect(res).toEqual({ restored: false, reason: "bom-not-deducted", restoredItems: 0 });

      const invState = await readPersistentDomainState(inventoryDomainSpec);
      expect(invState.ingredients.find((i) => i.id === "ing-1")!.stockNumber).toBe(initialMilk);
    });

    it("never restores stock for orders already in COOKING / READY / SERVED / COMPLETED or with cookingStartedAt set", async () => {
      const initialMilk = INITIAL_INGREDIENTS.find((i) => i.id === "ing-1")!.stockNumber;

      const paidOrder = await savePersistentOrder(
        makeOrder({
          id: "ord-cooking-void-1",
          orderNumber: "ORD-KS-20261123-0301",
          status: "CONFIRMED",
          paymentStatus: "PAID",
          items: [makeItem({ productId: "prod-101", productName: "Kopi Senja Aren", quantity: 1 })],
        })
      );
      await deductPersistentOrderBOM(paidOrder);

      const expectedDeductedMilk = Number((initialMilk - 0.12).toFixed(3));

      for (const blockedState of [
        { status: "COOKING" as const },
        { status: "READY" as const },
        { status: "SERVED" as const },
        { status: "COMPLETED" as const },
        { status: "CANCELLED" as const, cookingStartedAt: "2026-11-23T10:10:00.000Z" },
      ]) {
        const res = await restorePersistentOrderBOMIfBeforeCooking({
          ...paidOrder,
          ...blockedState,
          bomDeducted: true,
        });
        expect(res.restored).toBe(false);
        expect(res.reason).toBe("already-cooking-or-beyond");
        expect(res.restoredItems).toBe(0);
      }

      const invState = await readPersistentDomainState(inventoryDomainSpec);
      expect(invState.ingredients.find((i) => i.id === "ing-1")!.stockNumber).toBeCloseTo(
        expectedDeductedMilk,
        3
      );
    });
  });
});
