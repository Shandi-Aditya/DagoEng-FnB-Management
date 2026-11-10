import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/orders/route";
import { NextRequest } from "next/server";
import { signEdgeSessionToken } from "@/lib/edge-session";
import { EDGE_SESSION_COOKIE_NAME } from "@/lib/edge-session";

function createOrderRequest(body: any, role: string = "CASHIER", email: string = "cashier@dagoeng.com"): NextRequest {
  const token = signEdgeSessionToken({
    userId: `user-${role.toLowerCase()}-1`,
    role,
    scopeLevel: "OUTLET",
    email,
    maxAgeSeconds: 3600,
  });

  return new NextRequest("http://localhost:3000/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: `${EDGE_SESSION_COOKIE_NAME}=${token}`,
    },
    body: JSON.stringify(body),
  });
}

describe("B1 (POS-26 / TC-K02 / TC-I03): Double Payment Prevention and Role Authorization", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "super-secret-session-key-testing-minimum-32-chars-long";
  });

  it("TC-K02: Rejects second payment attempt on an already PAID order with HTTP 409", async () => {
    const orderId = `ord-paid-b1-${Date.now()}`;
    const initialOrder = {
      id: orderId,
      orderNumber: "ORD-B1-001",
      outletId: "outlet-sgr",
      tableNumber: "T-01",
      customerName: "Pelanggan B1",
      orderType: "DINE_IN",
      status: "NEW",
      subtotal: 50000,
      tax: 5000,
      serviceCharge: 2500,
      total: 57500,
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      items: [
        {
          id: "it-1",
          productId: "prod-1",
          productName: "Kopi Senja Aren",
          quantity: 2,
          unitPrice: 25000,
        },
      ],
    };

    // 1. Create order as already PAID
    const createRes = await POST(createOrderRequest(initialOrder, "CASHIER"));
    expect(createRes.status).toBe(200);

    // 2. Attempt a second payment on the same order while status is COOKING
    const secondPaymentAttempt = {
      ...initialOrder,
      status: "COOKING",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      amountPaid: 60000, // Attempting to pay again
    };

    const secondRes = await POST(createOrderRequest(secondPaymentAttempt, "CASHIER"));
    // Expect rejection with 403 because order is already paid and second payment is forbidden
    expect(secondRes.status).toBe(403);
    const body = await secondRes.json();
    expect(body.error).toContain("ORDER_ALREADY_PAID");
  });

  it("TC-I03: Kitchen Staff is rejected from processing or creating PAID orders", async () => {
    const orderId = `ord-kitchen-attempt-${Date.now()}`;
    const kitchenPayment = {
      id: orderId,
      orderNumber: "ORD-KITCHEN-001",
      outletId: "outlet-sgr",
      tableNumber: "T-02",
      customerName: "Tamu Kitchen",
      orderType: "DINE_IN",
      status: "NEW",
      subtotal: 30000,
      total: 30000,
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      items: [
        {
          id: "it-1",
          productId: "prod-2",
          productName: "Classic Americano",
          quantity: 1,
          unitPrice: 30000,
        },
      ],
    };

    const res = await POST(createOrderRequest(kitchenPayment, "KITCHEN_STAFF", "kitchen@dagoeng.com"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("FORBIDDEN");
  });

  it("Allows Kitchen Staff to update workflow status (COOKING -> READY) on already PAID order without modifying payment", async () => {
    const orderId = `ord-workflow-${Date.now()}`;
    const initialOrder = {
      id: orderId,
      orderNumber: "ORD-WORKFLOW-001",
      outletId: "outlet-sgr",
      tableNumber: "T-03",
      customerName: "Tamu Workflow",
      orderType: "DINE_IN",
      status: "KITCHEN_RECEIVED",
      subtotal: 30000,
      total: 30000,
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      items: [
        {
          id: "it-1",
          productId: "prod-2",
          productName: "Classic Americano",
          quantity: 1,
          unitPrice: 30000,
        },
      ],
    };

    // Created as PAID by Cashier
    const createRes = await POST(createOrderRequest(initialOrder, "CASHIER"));
    expect(createRes.status).toBe(200);

    // Kitchen staff advances status to COOKING (no payment changes)
    const workflowUpdate = {
      ...initialOrder,
      status: "COOKING",
    };

    const kitchenRes = await POST(createOrderRequest(workflowUpdate, "KITCHEN_STAFF", "kitchen@dagoeng.com"));
    expect(kitchenRes.status).toBe(200);
    const updated = await kitchenRes.json();
    expect(updated.order.status).toBe("COOKING");
    expect(updated.order.paymentStatus).toBe("PAID");
  });
});
