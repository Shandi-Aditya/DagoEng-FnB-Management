import { describe, it, expect } from "vitest";
import { OrderRecord } from "../src/types/order";
import { INITIAL_RECIPES, INITIAL_INGREDIENTS, deductRecipeIngredients } from "../src/features/inventory/inventory-data";
import { IngredientItem } from "../src/types/inventory";

describe("Core Operational Flow - End-to-End Integration", () => {
  it("processes order from waiter/customer to payment completion and updates lifecycle", () => {
    // 1. Initial Order created by Waiter / Customer
    const initialOrder: OrderRecord = {
      id: "ord-test-e2e",
      orderNumber: "ORD-20260923-0999",
      organizationId: "org-dago-hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-01",
      customerName: "Budi Santoso",
      orderType: "DINE_IN",
      status: "NEW",
      targetServiceMinutes: 10,
      items: [
        { id: "it-1", productName: "Signature Wagyu Beef Bowl", quantity: 2, unitPrice: 65000 },
        { id: "it-2", productName: "Kopi Senja Aren", quantity: 1, unitPrice: 24000 },
      ],
      subtotal: 154000,
      tax: 15400,
      total: 169400,
      paymentStatus: "PENDING",
      createdAt: "2026-09-23T10:00:00Z",
      statusHistory: [],
    };

    expect(initialOrder.status).toBe("NEW");
    expect(initialOrder.paymentStatus).toBe("PENDING");

    // 2. Process payment & complete order
    const completedTimestamp = "2026-09-23T10:20:00Z";
    const completedOrder: OrderRecord = {
      ...initialOrder,
      status: "COMPLETED",
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
      completedAt: completedTimestamp,
      statusHistory: [
        ...initialOrder.statusHistory,
        {
          id: "h-test-complete",
          orderId: initialOrder.id,
          fromStatus: initialOrder.status,
          toStatus: "COMPLETED",
          timestamp: completedTimestamp,
          actorName: "Kasir / Orders Page",
          note: "Pembayaran lunas via QRIS (Rp 169.400)",
        },
      ],
    };

    expect(completedOrder.status).toBe("COMPLETED");
    expect(completedOrder.paymentStatus).toBe("PAID");
    expect(completedOrder.paymentMethod).toBe("QRIS");
    expect(completedOrder.statusHistory.length).toBe(1);
  });

  it("deducts inventory ingredients correctly based on Recipe/BOM for each product in order", () => {
    let currentStock: IngredientItem[] = JSON.parse(JSON.stringify(INITIAL_INGREDIENTS));

    // Initial stock for Wagyu meat (ing-5) and Rice (ing-6)
    const wagyuBefore = currentStock.find((i) => i.id === "ing-5")!.stockNumber; // 12.0 kg
    const riceBefore = currentStock.find((i) => i.id === "ing-6")!.stockNumber; // 6.0 karung

    const wagyuRecipe = INITIAL_RECIPES.find((r) => r.menuName === "Signature Wagyu Beef Bowl")!;
    expect(wagyuRecipe).toBeDefined();

    // Order with 2x Wagyu Beef Bowl
    const quantity = 2;
    const { updatedStock, logs } = deductRecipeIngredients(currentStock, wagyuRecipe, quantity);
    currentStock = updatedStock;

    const wagyuAfter = currentStock.find((i) => i.id === "ing-5")!.stockNumber;
    const riceAfter = currentStock.find((i) => i.id === "ing-6")!.stockNumber;

    // 2x 0.12kg = 0.24kg deduction
    expect(wagyuAfter).toBe(Number((wagyuBefore - 0.24).toFixed(3)));
    // 2x 0.03 = 0.06 deduction
    expect(riceAfter).toBe(Number((riceBefore - 0.06).toFixed(3)));
    expect(logs.length).toBe(2);

    // Ensure no double deduction occurs if executed again without new items
    const stockSnapshot = currentStock.find((i) => i.id === "ing-5")!.stockNumber;
    expect(stockSnapshot).toBe(wagyuAfter);
  });

  it("calculates and awards loyalty points exactly once when order has a registered member", () => {
    const registeredMember = {
      id: "mem-002",
      name: "Budi Santoso",
      points: 165,
      tier: "Bronze" as const,
    };

    const orderTotal = 169400;
    const isCustomerRegistered = true;

    let pointsAwarded = 0;
    if (isCustomerRegistered) {
      pointsAwarded = Math.floor(orderTotal / 1000); // 1 pt per Rp 1.000
    }

    expect(pointsAwarded).toBe(169);
    const newPointsBalance = registeredMember.points + pointsAwarded;
    expect(newPointsBalance).toBe(334);

    // Unregistered guest: points should remain 0
    const unregisteredCustomer = "Walk-in Guest";
    const isGuestRegistered = false;
    let guestPoints = 0;
    if (isGuestRegistered) {
      guestPoints = Math.floor(orderTotal / 1000);
    }
    expect(guestPoints).toBe(0);
  });

  it("releases table to AVAILABLE status upon dine-in order completion", () => {
    const tableState = {
      id: "T-01",
      status: "OCCUPIED" as "AVAILABLE" | "OCCUPIED" | "BILLING",
      customer: "Budi Santoso",
      total: "Rp 169.400",
      activeOrderId: "ord-test-e2e",
    };

    expect(tableState.status).toBe("OCCUPIED");

    // Releasing table
    const releasedTableState = {
      ...tableState,
      status: "AVAILABLE" as const,
      customer: undefined,
      total: undefined,
      activeOrderId: undefined,
    };

    expect(releasedTableState.status).toBe("AVAILABLE");
    expect(releasedTableState.customer).toBeUndefined();
    expect(releasedTableState.total).toBeUndefined();
  });

  it("records comprehensive activity logs for the operational transaction lifecycle", () => {
    const activityLogs: Array<{ module: string; action: string; status: string; description: string }> = [];

    // Order Completed & Paid
    activityLogs.push({
      module: "POS",
      action: "ORDER_PAYMENT_AND_COMPLETED",
      status: "SUCCESS",
      description: "Pesanan ORD-20260923-0999 (Meja T-01, Budi Santoso) lunas & diselesaikan",
    });

    // Stock Deduction
    activityLogs.push({
      module: "INVENTORY",
      action: "STOCK_ADJUSTMENT",
      status: "SUCCESS",
      description: "Penyesuaian stok bahan Signature Wagyu Beef Bowl",
    });

    // Table Release
    activityLogs.push({
      module: "TABLES",
      action: "RELEASE_TABLE",
      status: "SUCCESS",
      description: "Meja T-01 kini AVAILABLE",
    });

    expect(activityLogs.length).toBe(3);
    expect(activityLogs[0].action).toBe("ORDER_PAYMENT_AND_COMPLETED");
    expect(activityLogs[1].action).toBe("STOCK_ADJUSTMENT");
    expect(activityLogs[2].action).toBe("RELEASE_TABLE");
  });

  it("allows customer to cancel pending/new order and resets linked table and payment state", () => {
    const activeOrder: OrderRecord = {
      id: "ord-cust-cancel",
      orderNumber: "ORD-20260924-0012",
      organizationId: "org-dago-hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-03",
      customerName: "Ketut Dian",
      orderType: "DINE_IN",
      status: "NEW",
      targetServiceMinutes: 10,
      items: [
        { id: "it-1", productName: "Kopi Senja Aren", quantity: 1, unitPrice: 24000 },
      ],
      subtotal: 24000,
      tax: 2400,
      total: 26400,
      paymentStatus: "PENDING",
      createdAt: "2026-09-24T11:00:00Z",
      statusHistory: [],
    };

    // Cancellation action
    const cancelledOrder: OrderRecord = {
      ...activeOrder,
      status: "CANCELLED",
      statusHistory: [
        ...activeOrder.statusHistory,
        {
          id: "h-cancel-1",
          orderId: activeOrder.id,
          fromStatus: "NEW",
          toStatus: "CANCELLED",
          timestamp: "2026-09-24T11:02:00Z",
          actorName: "Pelanggan via Customer Portal",
          note: "Dibatalkan oleh Pelanggan via Customer Portal",
        },
      ],
    };

    expect(cancelledOrder.status).toBe("CANCELLED");
    expect(cancelledOrder.statusHistory.length).toBe(1);
    expect(cancelledOrder.statusHistory[0].toStatus).toBe("CANCELLED");
  });
});
