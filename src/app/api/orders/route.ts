import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getPersistentOrders,
  savePersistentOrder,
  getPersistentLoyaltyPoints,
  updatePersistentLoyaltyPoints,
  getPersistentQrisSession,
} from "@/lib/persistent-storage";
import { getRequestAuthUser } from "@/lib/server-auth";
import { OrderRecord } from "@/types/order";
import { RoleSlug } from "@/types/auth";

const ORDER_READ_ROLES: RoleSlug[] = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "CASHIER",
  "WAITER",
  "KITCHEN_STAFF",
];

const ORDER_WRITE_ROLES: RoleSlug[] = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "CASHIER",
];

const OrderItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().optional(),
  productName: z.string().min(1),
  quantity: z.number().finite().positive(),
  unitPrice: z.number().finite().nonnegative(),
});

const OrderPayloadSchema = z.object({
  id: z.string().min(1),
  orderNumber: z.string().optional(),
  outletId: z.string().optional(),
  subtotal: z.number().finite().nonnegative(),
  discount: z.number().finite().nonnegative().optional(),
  tax: z.number().finite().nonnegative().optional(),
  serviceCharge: z.number().finite().nonnegative().optional(),
  total: z.number().finite().nonnegative(),
  items: z.array(OrderItemSchema).optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "REFUNDED"]).optional(),
  paymentMethod: z.enum(["CASH", "QRIS", "EDC", "TRANSFER", "SPLIT"]).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    if (!ORDER_READ_ROLES.includes(auth.role)) {
      return NextResponse.json(
        { error: `FORBIDDEN: Role [${auth.role}] tidak diizinkan mengakses daftar transaksi POS.` },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId");
    const status = searchParams.get("status");
    const customerKey = searchParams.get("customerKey");

    let orders = await getPersistentOrders();
    if (outletId && outletId !== "ALL") {
      orders = orders.filter((o) => o.outletId === outletId);
    }
    if (status) {
      orders = orders.filter((o) => o.status === status || o.paymentStatus === status);
    }

    let loyaltyPoints = await getPersistentLoyaltyPoints();
    if (customerKey) {
      const normalized = customerKey.trim().toLowerCase();
      loyaltyPoints = loyaltyPoints.filter((l) => l.customerKey.toLowerCase() === normalized);
    }

    return NextResponse.json({ orders, loyaltyPoints });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    if (!ORDER_WRITE_ROLES.includes(auth.role)) {
      return NextResponse.json(
        { error: `FORBIDDEN: Role [${auth.role}] tidak memiliki wewenang menyimpan transaksi POS.` },
        { status: 403 }
      );
    }

    const body = await req.json();
    const orderData: OrderRecord = body.order || body;

    if (!orderData || !orderData.id) {
      return NextResponse.json(
        { error: "Order payload with valid id is required." },
        { status: 400 }
      );
    }

    // R8: Validate order schema & mathematical consistency on the server
    const parsed = OrderPayloadSchema.safeParse({
      id: orderData.id,
      orderNumber: orderData.orderNumber,
      outletId: orderData.outletId,
      subtotal: Number(orderData.subtotal ?? 0),
      discount: orderData.discount !== undefined ? Number(orderData.discount) : undefined,
      tax: orderData.tax !== undefined ? Number(orderData.tax) : undefined,
      serviceCharge:
        orderData.serviceCharge !== undefined ? Number(orderData.serviceCharge) : undefined,
      total: Number(orderData.total ?? 0),
      items: Array.isArray(orderData.items) ? orderData.items : undefined,
      paymentStatus: orderData.paymentStatus,
      paymentMethod: orderData.paymentMethod as any,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "INVALID_ORDER_PAYLOAD: Struktur data pesanan tidak valid.",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const v = parsed.data;
    if (v.items && v.items.length > 0) {
      const itemsSubtotal = v.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
      );
      if (Math.abs(itemsSubtotal - v.subtotal) > 2) {
        return NextResponse.json(
          {
            error: `INVALID_ORDER_SUBTOTAL: Subtotal (${v.subtotal}) tidak cocok dengan total harga item (${itemsSubtotal}).`,
          },
          { status: 400 }
        );
      }
    }

    const expectedTotal =
      Math.max(0, v.subtotal - (v.discount ?? 0)) + (v.tax ?? 0) + (v.serviceCharge ?? 0);
    if (Math.abs(expectedTotal - v.total) > 2) {
      return NextResponse.json(
        {
          error: `INVALID_ORDER_TOTAL: Total (${v.total}) tidak konsisten dengan kalkulasi komponen (${expectedTotal}).`,
        },
        { status: 400 }
      );
    }

    // R5: Verify server-side QRIS session before allowing a PAID QRIS order to be saved
    if (orderData.paymentMethod === "QRIS" && orderData.paymentStatus === "PAID") {
      const candidateKeys = [
        orderData.qrisVerification?.referenceNumber,
        orderData.paymentReference,
        orderData.orderNumber,
        orderData.id,
      ].filter((k): k is string => Boolean(k && typeof k === "string" && k.trim()));

      let verifiedQrisSession = null;
      for (const key of candidateKeys) {
        const session = await getPersistentQrisSession(key);
        if (
          session &&
          (session.status === "VERIFIED_WEBHOOK" ||
            session.status === "VERIFIED_SUPERVISOR") &&
          Math.round(session.expectedAmount) === Math.round(v.total)
        ) {
          verifiedQrisSession = session;
          break;
        }
      }

      if (!verifiedQrisSession) {
        return NextResponse.json(
          {
            error:
              "QRIS_PAYMENT_UNVERIFIED: Transaksi QRIS berstatus PAID ditolak karena belum memiliki sesi verifikasi server (webhook/supervisor) dengan nominal yang sesuai.",
          },
          { status: 409 }
        );
      }
    }

    const savedOrder = await savePersistentOrder(orderData);

    // R8: Compute loyalty points strictly on the server (1 point per Rp 10,000 of verified order total)
    // and guarantee idempotency per order.id so duplicate POSTs never double-credit points.
    let loyaltyRecord = null;
    const customerKey = String(
      body.customerKey || (orderData as any).customerPhone || orderData.customerName || ""
    ).trim();

    const isPaidAndValid =
      orderData.paymentStatus === "PAID" && orderData.status !== "CANCELLED";
    const serverEarnedPoints = isPaidAndValid ? Math.floor(v.total / 10000) : 0;

    if (customerKey && serverEarnedPoints > 0) {
      loyaltyRecord = await updatePersistentLoyaltyPoints(
        customerKey,
        serverEarnedPoints,
        orderData.customerName,
        orderData.id
      );
    }

    return NextResponse.json({
      success: true,
      order: savedOrder,
      loyaltyRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
